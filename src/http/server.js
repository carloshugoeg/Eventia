import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { AppError } from '../shared/errors.js';

const assets = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/favicon.svg', ['favicon.svg', 'image/svg+xml']]
]);

function reply(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(JSON.stringify(body));
}

async function body(req) {
  if (req.headers['content-type']?.split(';')[0].trim() !== 'application/json') {
    throw new AppError(415, 'La solicitud debe usar application/json.');
  }
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 16384) throw new AppError(413, 'La solicitud es demasiado grande.');
    chunks.push(chunk);
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value;
  } catch { throw new AppError(400, 'El contenido de la solicitud no es válido.'); }
}

function sessionToken(req) {
  return (req.headers.cookie ?? '').split(';').map(part => part.trim()).find(part => part.startsWith('eventia_session='))?.slice(16);
}

export function createHttpServer(app, { secureCookie = false, allowedOrigins = [] } = {}) {
  const cookie = (token, age = 604800) => `eventia_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${secureCookie ? '; Secure' : ''}`;
  const attempts = new Map();
  return createServer({ requestTimeout: 15000, headersTimeout: 10000 }, async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    try {
      const url = new URL(req.url, 'http://localhost');
      const method = req.method;
      if (method === 'GET' && assets.has(url.pathname)) {
        const [file, type] = assets.get(url.pathname);
        const content = await readFile(new URL(`../../public/${file}`, import.meta.url));
        res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
        return res.end(content);
      }
      if (url.pathname === '/api/health' && method === 'GET') return reply(res, 200, { status: 'ok' });
      if (['POST', 'PATCH', 'DELETE'].includes(method)) {
        const origin = req.headers.origin;
        const port = res.socket.localPort;
        const accepted = new Set([`http://localhost:${port}`, `http://127.0.0.1:${port}`, ...allowedOrigins]);
        if (req.headers['sec-fetch-site'] === 'cross-site' || (origin && !accepted.has(origin))) {
          throw new AppError(403, 'Origen de solicitud no permitido.', 'INVALID_ORIGIN');
        }
      }
      const token = sessionToken(req);
      const user = app.users.authenticate(token);
      if (url.pathname === '/api/auth/me' && method === 'GET') return reply(res, 200, { user });
      if (['/api/auth/register', '/api/auth/login'].includes(url.pathname) && method === 'POST') {
        const now = Date.now();
        for (const [key, value] of attempts) if (value.until <= now) attempts.delete(key);
        const ip = req.socket.remoteAddress;
        const attempt = attempts.get(ip) ?? { count: 0, until: now + 60000 };
        if (++attempt.count > 30) throw new AppError(429, 'Demasiados intentos. Espera un minuto.', 'RATE_LIMITED');
        attempts.set(ip, attempt);
        const input = await body(req);
        const registered = url.pathname.endsWith('/register');
        const account = registered ? await app.users.register(input) : await app.users.login(input);
        return reply(res, registered ? 201 : 200, { user: account }, { 'Set-Cookie': cookie(app.users.startSession(account)) });
      }
      if (url.pathname === '/api/auth/logout' && method === 'POST') {
        await body(req);
        app.users.logout(token);
        return reply(res, 200, { ok: true }, { 'Set-Cookie': cookie('', 0) });
      }
      if (url.pathname === '/api/events' && method === 'GET') {
        return reply(res, 200, app.events.list({ q: url.searchParams.get('q') ?? '', category: url.searchParams.get('category') ?? '',
          offset: Number(url.searchParams.get('offset') ?? '0') }));
      }
      if (url.pathname === '/api/events' && method === 'POST') {
        return reply(res, 201, { event: app.events.publish(user, await body(req)) });
      }
      const eventMatch = url.pathname.match(/^\/api\/events\/([^/]+)$/);
      if (eventMatch && method === 'GET') return reply(res, 200, { event: app.events.get(eventMatch[1]) });
      const enrollMatch = url.pathname.match(/^\/api\/events\/([^/]+)\/registrations$/);
      if (enrollMatch && method === 'POST') {
        await body(req);
        return reply(res, 201, app.registrations.enroll(user, enrollMatch[1]));
      }
      if (url.pathname === '/api/registrations' && method === 'GET') return reply(res, 200, { registrations: app.registrations.list(user) });
      if (url.pathname === '/api/notifications' && method === 'GET') return reply(res, 200, { notifications: app.notifications.list(user) });
      const readMatch = url.pathname.match(/^\/api\/notifications\/([^/]+)\/read$/);
      if (readMatch && method === 'PATCH') {
        await body(req);
        app.notifications.markRead(user, readMatch[1]);
        return reply(res, 200, { ok: true });
      }
      throw new AppError(404, 'Ruta no encontrada.', 'NOT_FOUND');
    } catch (error) {
      if (error instanceof AppError) return reply(res, error.status, { error: error.message, code: error.code });
      if (error.message?.includes('database is locked')) return reply(res, 503, { error: 'El sistema está ocupado. Intenta nuevamente.', code: 'BUSY' });
      console.error('Error interno:', error);
      reply(res, 500, { error: 'No pudimos completar la operación.', code: 'INTERNAL_ERROR' });
    }
  });
}
