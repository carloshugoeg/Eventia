import { randomBytes, randomUUID, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { AppError, text, requireUser } from '../../shared/errors.js';

const derive = promisify(scrypt);
const publicUser = ({ id, name, email, role }) => ({ id, name, email, role });
const digest = (value) => createHash('sha256').update(value).digest('hex');

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await derive(password, salt, 64);
  return `${salt}:${key.toString('hex')}`;
}

async function verifyPassword(password, hash) {
  const [salt, expected] = hash.split(':');
  const key = await derive(password, salt, 64);
  return timingSafeEqual(key, Buffer.from(expected, 'hex'));
}

export function createUsersService(repository, sessions) {
  return {
    async register(input) {
      const name = text(input.name, 'Nombre', 2, 80);
      const email = text(input.email, 'Correo', 5, 254).toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AppError(400, 'Escribe un correo válido.');
      if (typeof input.password !== 'string' || input.password.length < 8 || input.password.length > 128) {
        throw new AppError(400, 'La contraseña debe contener entre 8 y 128 caracteres.');
      }
      const role = input.role ?? 'participant';
      if (!['participant', 'organizer'].includes(role)) throw new AppError(400, 'Tipo de cuenta inválido.');
      const user = {
        id: randomUUID(), name, email, role,
        password_hash: await hashPassword(input.password), created_at: new Date().toISOString()
      };
      try { repository.insert(user); }
      catch (error) {
        if (error.message.includes('UNIQUE constraint failed: users.email')) {
          throw new AppError(409, 'Este correo ya tiene una cuenta.', 'EMAIL_EXISTS');
        }
        throw error;
      }
      return publicUser(user);
    },
    async login(input) {
      const email = text(input.email, 'Correo', 5, 254).toLowerCase();
      if (typeof input.password !== 'string' || input.password.length > 128) {
        throw new AppError(400, 'Escribe una contraseña válida.');
      }
      const user = repository.byEmail(email);
      // Ejecutar una derivación también cuando no existe el correo evita una respuesta inmediata.
      const dummyHash = '00000000000000000000000000000000:' + '00'.repeat(64);
      const valid = await verifyPassword(input.password, user?.password_hash ?? dummyHash);
      if (!user || !valid) throw new AppError(401, 'Correo o contraseña incorrectos.', 'INVALID_CREDENTIALS');
      return publicUser(user);
    },
    startSession(user) {
      const token = randomBytes(32).toString('hex');
      sessions.put(digest(token), user.id, new Date(Date.now() + 7 * 86400000).toISOString());
      return token;
    },
    authenticate(token) {
      return /^[a-f0-9]{64}$/.test(token ?? '') ? sessions.get(digest(token)) ?? null : null;
    },
    logout(token) { if (token) sessions.delete(digest(token)); },
    ensureExists(id) {
      return requireUser(repository.byId(id));
    }
  };
}
