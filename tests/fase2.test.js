import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdirSync, rmSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { Worker } from 'node:worker_threads';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { openDatabase } from '../src/infrastructure/database.js';
import { createApplication } from '../src/app.js';
import { createHttpServer } from '../src/http/server.js';

const account = (role = 'participant') => ({ name: 'Persona de prueba', email: `${randomUUID()}@test.example`, password: 'PruebaSegura123!', role });
const eventData = (overrides = {}) => ({
  title: 'Encuentro de prueba',
  description: 'Una actividad para compartir ideas con la comunidad local.',
  category: 'Tecnología', location: 'Centro de Xela', starts_at: new Date(Date.now() + 86400000).toISOString(), capacity: 2, ...overrides
});

async function fixture(t, options = {}) {
  const db = openDatabase(':memory:');
  t.after(() => db.close());
  const app = createApplication(db, options);
  const organizer = await app.users.register(account('organizer'));
  const participant = await app.users.register(account());
  const event = app.events.publish(organizer, eventData());
  return { db, app, organizer, participant, event };
}

const code = expected => error => error.code === expected;

function deliver(app, now) {
  let guard = 0;
  let processed = 0;
  while (guard < 30) {
    const count = app.processOutbox(now);
    processed += count;
    guard += 1;
    if (!count) break;
  }
  return processed;
}

test('anotar la bandeja dentro de la reserva: si falla después, no queda inscripción ni cupo ni evento', async t => {
  const { app, db, participant, event } = await fixture(t);
  const record = app.notifications.confirmRegistration;
  app.notifications.confirmRegistration = (...args) => {
    record(...args);
    throw new Error('Fallo después de la bandeja');
  };
  assert.throws(() => app.registrations.enroll(participant, event.id), /Fallo después de la bandeja/);
  assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM outbox WHERE type = 'registration.confirmed'`).get().n, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM registrations').get().n, 0);
  assert.equal(app.events.get(event.id).occupied, 0);
});

test('el worker crea una notificación y un reporte, y repetirlo no duplica ninguno', async t => {
  const { app, db, organizer, participant, event } = await fixture(t);
  assert.equal(deliver(app), 1);
  assert.deepEqual(app.reports.list(organizer), [{
    event_id: event.id,
    title: 'Encuentro de prueba',
    capacity: 2,
    registrations: 0,
    occupancy_pct: 0,
    timeline: []
  }]);
  const result = app.registrations.enroll(participant, event.id);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM notifications').get().n, 0);
  assert.equal(deliver(app), 1);
  const notification = app.notifications.list(participant)[0];
  assert.equal(notification.registration_id, result.registration.id);
  assert.equal(notification.message, 'Tu inscripción a «Encuentro de prueba» está confirmada. ¡Te esperamos!');
  const day = result.registration.created_at.slice(0, 10);
  assert.deepEqual(app.reports.list(organizer), [{
    event_id: event.id,
    title: 'Encuentro de prueba',
    capacity: 2,
    registrations: 1,
    occupancy_pct: 50,
    timeline: [{ day, registrations: 1 }]
  }]);
  assert.equal(deliver(app), 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM notifications').get().n, 1);
  assert.equal(app.reports.list(organizer)[0].registrations, 1);
});

test('un participante no consulta reportes', async t => {
  const { app, participant } = await fixture(t);
  assert.throws(() => app.reports.list(participant), code('FORBIDDEN'));
});

test('si la entrega falla, la inscripción sigue válida y el reintento no duplica', async t => {
  const { app, db, organizer, participant, event } = await fixture(t);
  deliver(app);
  const deliverNotification = app.notifications.deliver;
  let failures = 1;
  app.notifications.deliver = (payload) => {
    if (failures) {
      failures -= 1;
      throw new Error('correo caído');
    }
    deliverNotification(payload);
  };
  app.registrations.enroll(participant, event.id);
  const before = new Date();
  assert.equal(app.processOutbox(before), 0);
  const pending = db.prepare(`SELECT attempts, status, last_error, next_attempt_at FROM outbox WHERE type = 'registration.confirmed'`).get();
  assert.equal(pending.attempts, 1);
  assert.equal(pending.status, 'pending');
  assert.match(pending.last_error, /correo caído/);
  assert.ok(pending.next_attempt_at > before.toISOString());
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM notifications').get().n, 0);
  assert.equal(app.reports.list(organizer)[0].registrations, 0);
  assert.equal(app.processOutbox(new Date(before.getTime() + 10000)), 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM notifications').get().n, 1);
  assert.equal(app.reports.list(organizer)[0].registrations, 1);
  assert.equal(app.processOutbox(new Date(before.getTime() + 20000)), 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM notifications').get().n, 1);
  assert.equal(app.reports.list(organizer)[0].registrations, 1);
});

test('agotados los reintentos, el evento queda muerto y no crea la notificación', async t => {
  const { app, db, participant, event } = await fixture(t, { outboxMaxAttempts: 1 });
  deliver(app);
  app.notifications.deliver = () => { throw new Error('proveedor caído'); };
  app.registrations.enroll(participant, event.id);
  const now = new Date();
  assert.equal(app.processOutbox(now), 0);
  assert.equal(db.prepare(`SELECT status FROM outbox WHERE type = 'registration.confirmed'`).get().status, 'dead');
  assert.equal(app.processOutbox(new Date(now.getTime() + 60000)), 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM notifications').get().n, 0);
  assert.equal(app.events.get(event.id).occupied, 1);
});

test('la misma clave de idempotencia devuelve la misma inscripción y no ocupa otra plaza', async t => {
  const { app, db, participant, organizer, event } = await fixture(t);
  const key = 'reintento-seguro-01';
  const first = app.registrations.enroll(participant, event.id, key);
  const second = app.registrations.enroll(participant, event.id, key);
  assert.equal(second.replayed, true);
  assert.equal(second.registration.id, first.registration.id);
  assert.equal(app.events.get(event.id).occupied, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM registrations').get().n, 1);
  assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM outbox WHERE type = 'registration.confirmed'`).get().n, 1);
  const other = app.events.publish(organizer, eventData({ title: 'Otro encuentro de prueba' }));
  assert.throws(() => app.registrations.enroll(participant, other.id, key), code('IDEMPOTENCY_CONFLICT'));
  assert.equal(app.events.get(other.id).occupied, 0);
  assert.throws(() => app.registrations.enroll(participant, event.id, 'corta'), code('INVALID_IDEMPOTENCY_KEY'));
});

test('HTTP: la clave repetida, el límite y la sala de espera no crean inscripciones de más', async t => {
  const { app, db, organizer } = await fixture(t);
  const server = createHttpServer(app, { registrationRateLimit: 2, registrationRateWindowMs: 60000, admissionLimit: 16, admissionRetryAfterSeconds: 2 });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const registered = await fetch(`${base}/api/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(account())
  });
  const cookie = registered.headers.get('set-cookie').split(';')[0];
  const send = (eventId, headers = {}) => fetch(`${base}/api/events/${eventId}/registrations`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie, ...headers }, body: '{}'
  });
  const second = app.events.publish(organizer, eventData({ title: 'Segundo encuentro local' }));
  const third = app.events.publish(organizer, eventData({ title: 'Tercer encuentro local' }));
  const key = 'http-reintento-01';
  const first = await send(second.id, { 'Idempotency-Key': key });
  const replay = await send(second.id, { 'Idempotency-Key': key });
  assert.equal(first.status, 201);
  assert.equal(replay.status, 201);
  assert.equal((await replay.json()).registration.id, (await first.json()).registration.id);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM registrations WHERE event_id = ?').get(second.id).n, 1);
  const blocked = await send(third.id);
  assert.equal(blocked.status, 429);
  assert.equal(blocked.headers.get('retry-after'), '60');
  assert.equal((await blocked.json()).code, 'RATE_LIMITED');
  assert.equal(app.events.get(third.id).occupied, 0);

  const waiting = createHttpServer(app, { admissionLimit: 0, admissionRetryAfterSeconds: 3 });
  waiting.listen(0, '127.0.0.1');
  await once(waiting, 'listening');
  t.after(() => new Promise(resolve => waiting.close(resolve)));
  const waitingBase = `http://127.0.0.1:${waiting.address().port}`;
  const held = await fetch(`${waitingBase}/api/events/${third.id}/registrations`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: '{}'
  });
  assert.equal(held.status, 429);
  assert.equal(held.headers.get('retry-after'), '3');
  assert.equal((await held.json()).code, 'WAITING_ROOM');
  assert.equal(app.events.get(third.id).occupied, 0);
});

test('la caché del catálogo se invalida al publicar y al reservar', async t => {
  const { app, db, organizer, participant, event } = await fixture(t, { catalogCacheTtlMs: 60000 });
  assert.equal(app.events.get(event.id).title, 'Encuentro de prueba');
  assert.equal(app.events.list().events.find(item => item.id === event.id).title, 'Encuentro de prueba');
  db.prepare('UPDATE events SET title = ? WHERE id = ?').run('Título ya cambiado', event.id);
  assert.equal(app.events.get(event.id).title, 'Encuentro de prueba');
  assert.equal(app.events.list().events.find(item => item.id === event.id).title, 'Encuentro de prueba');
  app.registrations.enroll(participant, event.id);
  assert.equal(app.events.get(event.id).title, 'Título ya cambiado');
  db.prepare('UPDATE events SET title = ? WHERE id = ?').run('Título oculto un momento', event.id);
  assert.equal(app.events.get(event.id).title, 'Título ya cambiado');
  app.events.publish(organizer, eventData({ title: 'Otro encuentro visible' }));
  assert.equal(app.events.get(event.id).title, 'Título oculto un momento');
  assert.equal(app.events.list({ q: 'visible' }).events[0].title, 'Otro encuentro visible');
});

test('la búsqueda por palabra encuentra el evento publicado y descarta el resto', async t => {
  const { app, organizer } = await fixture(t);
  const special = app.events.publish(organizer, eventData({
    title: 'Taller de robótica',
    description: 'Construiremos un prototipo pequeño durante la tarde en quetzaltenango.'
  }));
  assert.equal(app.events.searchEngine === 'fts5' || app.events.searchEngine === 'like', true);
  assert.equal(app.events.list({ q: 'quetzaltenango' }).events[0].id, special.id);
  assert.equal(app.events.list({ q: 'quetzaltenango' }).total, 1);
  assert.equal(app.events.list({ q: 'noexistexyz' }).events.length, 0);
});

test('salud reporta la base y la bandeja pendiente', async t => {
  const { app, event } = await fixture(t);
  const health = app.health();
  assert.equal(health.status, 'ok');
  assert.equal(health.database, 'ok');
  assert.equal(health.search, app.events.searchEngine);
  assert.equal(health.outbox.pending, 1);
  const server = createHttpServer(app);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/health`);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, 'ok');
  assert.equal(app.events.get(event.id).capacity, 2);
});

test('cuatro reservas concurrentes con la misma clave ocupan una sola plaza', async t => {
  const root = resolve('tmp/tests');
  const directory = resolve(root, `idem-${randomUUID()}`);
  mkdirSync(directory, { recursive: true });
  let db;
  t.after(() => { if (db) db.close(); rmSync(directory, { recursive: true, force: true }); });
  const path = resolve(directory, 'idem.sqlite');
  db = openDatabase(path);
  const app = createApplication(db);
  const organizer = await app.users.register(account('organizer'));
  const participant = await app.users.register(account());
  const event = app.events.publish(organizer, eventData({ capacity: 5 }));
  const gate = new SharedArrayBuffer(4);
  const tasks = Array.from({ length: 4 }, () => {
    const worker = new Worker(new URL('./helpers/enroll-worker.js', import.meta.url), {
      workerData: { path, userId: participant.id, eventId: event.id, gate, idempotencyKey: 'misma-clave-concurrente' }
    });
    let readyResolve, readyReject, resultResolve, resultReject;
    const ready = new Promise((resolvePromise, reject) => { readyResolve = resolvePromise; readyReject = reject; });
    const result = new Promise((resolvePromise, reject) => { resultResolve = resolvePromise; resultReject = reject; });
    worker.on('message', message => { if (message.type === 'ready') readyResolve(); else resultResolve(message); });
    worker.on('error', error => { readyReject(error); resultReject(error); });
    worker.on('exit', exit => { if (exit) { const error = new Error(`Worker terminó con código ${exit}`); readyReject(error); resultReject(error); } });
    return { ready, result, worker };
  });
  t.after(async () => { await Promise.all(tasks.map(task => task.worker.terminate())); });
  await Promise.all(tasks.map(task => task.ready));
  Atomics.store(new Int32Array(gate), 0, 1);
  Atomics.notify(new Int32Array(gate), 0);
  const results = await Promise.all(tasks.map(task => task.result));
  assert.equal(results.filter(item => item.ok).length, 4);
  assert.equal(app.events.get(event.id).occupied, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM registrations').get().n, 1);
  assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM outbox WHERE type = 'registration.confirmed'`).get().n, 1);
});

test('el proceso del worker entrega una vez y el segundo arranque no duplica', async t => {
  const root = resolve('tmp/tests');
  const directory = resolve(root, `proc-${randomUUID()}`);
  mkdirSync(directory, { recursive: true });
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const path = resolve(directory, 'worker.sqlite');
  const db = openDatabase(path);
  const app = createApplication(db);
  const organizer = await app.users.register(account('organizer'));
  const participant = await app.users.register(account());
  const event = app.events.publish(organizer, eventData({ capacity: 3 }));
  app.registrations.enroll(participant, event.id);
  db.close();
  const start = () => spawn(process.execPath, ['scripts/notifications-worker.js'], {
    env: { ...process.env, DATABASE_PATH: path, OUTBOX_POLL_MS: '50', HOST: '127.0.0.1', PORT: '3000' },
    stdio: 'ignore'
  });
  const child = start();
  t.after(() => { if (child.exitCode === null) child.kill('SIGTERM'); });
  const deadline = Date.now() + 8000;
  let notifications = 0;
  let registrations = 0;
  while (Date.now() < deadline) {
    const check = openDatabase(path);
    notifications = check.prepare('SELECT COUNT(*) AS n FROM notifications').get().n;
    registrations = check.prepare('SELECT COALESCE(SUM(registrations), 0) AS n FROM report_events').get().n;
    check.close();
    if (notifications === 1 && registrations === 1) break;
    await new Promise(resolvePromise => setTimeout(resolvePromise, 100));
  }
  assert.equal(notifications, 1);
  assert.equal(registrations, 1);
  child.kill('SIGTERM');
  await once(child, 'exit');
  const again = start();
  await new Promise(resolvePromise => setTimeout(resolvePromise, 500));
  again.kill('SIGTERM');
  await once(again, 'exit');
  const check = openDatabase(path);
  assert.equal(check.prepare('SELECT COUNT(*) AS n FROM notifications').get().n, 1);
  assert.equal(check.prepare('SELECT COALESCE(SUM(registrations), 0) AS n FROM report_events').get().n, 1);
  assert.equal(check.prepare('SELECT occupied FROM events WHERE id = ?').get(event.id).occupied, 1);
  check.close();
});
