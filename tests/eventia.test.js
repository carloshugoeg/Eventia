import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdirSync, rmSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { Worker } from 'node:worker_threads';
import { once } from 'node:events';
import { openDatabase, unitOfWork } from '../src/infrastructure/database.js';
import { createApplication } from '../src/app.js';
import { createRegistrationsRepository } from '../src/modules/registrations/repository.js';
import { createRegistrationsService } from '../src/modules/registrations/service.js';
import { createHttpServer } from '../src/http/server.js';

const account = (role = 'participant') => ({ name:'Persona de prueba', email:`${randomUUID()}@test.example`, password:'PruebaSegura123!', role });
const eventData = (overrides = {}) => ({ title:'Encuentro de prueba', description:'Una actividad para compartir ideas con la comunidad local.',
  category:'Tecnología', location:'Centro de Xela', starts_at:new Date(Date.now()+86400000).toISOString(), capacity:2, ...overrides });

async function fixture(t, path = ':memory:') {
  const db = openDatabase(path); t.after(() => db.close());
  const app = createApplication(db);
  const organizer = await app.users.register(account('organizer'));
  const participant = await app.users.register(account());
  const event = app.events.publish(organizer, eventData());
  return { db, app, organizer, participant, event };
}
const code = expected => error => error.code === expected;

test('flujo completo: consultar, inscribirse, actualizar cupo y recibir confirmación persistida', async t => {
  const { app, participant, event } = await fixture(t);
  assert.equal(app.events.get(event.id).available, 2);
  const result = app.registrations.enroll(participant, event.id);
  assert.equal(result.event.available, 1);
  assert.equal(result.event.occupied, 1);
  assert.equal(app.registrations.list(participant)[0].event.id, event.id);
  const notification = app.notifications.list(participant)[0];
  assert.equal(notification.registration_id, result.registration.id);
  assert.match(notification.message, /confirmada/);
  app.notifications.markRead(participant, notification.id);
  assert.ok(app.notifications.list(participant)[0].read_at);
});

test('una inscripción duplicada no ocupa otra plaza ni crea otra notificación', async t => {
  const { app, db, participant, event } = await fixture(t);
  app.registrations.enroll(participant, event.id);
  assert.throws(() => app.registrations.enroll(participant, event.id), code('ALREADY_REGISTERED'));
  assert.equal(app.events.get(event.id).occupied, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM registrations').get().n, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM notifications').get().n, 1);
});

test('un evento lleno rechaza la siguiente solicitud y mantiene su capacidad', async t => {
  const { app, organizer, participant } = await fixture(t);
  const event = app.events.publish(organizer, eventData({ capacity:1 }));
  const second = await app.users.register(account());
  app.registrations.enroll(participant, event.id);
  assert.throws(() => app.registrations.enroll(second, event.id), code('EVENT_FULL'));
  assert.equal(app.events.get(event.id).occupied, 1);
  assert.equal(app.registrations.list(second).length, 0);
});

test('si falla la confirmación, se revierten inscripción y cupo', async t => {
  const { app, db, participant, event } = await fixture(t);
  const failing = createRegistrationsService({ repository:createRegistrationsRepository(db), users:app.users, events:app.events,
    notifications:{ confirmRegistration() { throw new Error('Fallo simulado'); } }, transaction:unitOfWork(db) });
  assert.throws(() => failing.enroll(participant, event.id), /Fallo simulado/);
  assert.equal(app.events.get(event.id).occupied, 0);
  assert.equal(app.registrations.list(participant).length, 0);
  assert.equal(app.notifications.list(participant).length, 0);
});

test('un evento que ya empezó cierra inscripciones y sale del catálogo', async t => {
  const { app, db, participant, event } = await fixture(t);
  db.prepare('UPDATE events SET starts_at = ? WHERE id = ?').run(new Date(Date.now()-1000).toISOString(), event.id);
  assert.throws(() => app.registrations.enroll(participant, event.id), code('EVENT_CLOSED'));
  assert.equal(app.events.list().events.length, 0);
  assert.equal(app.events.get(event.id).occupied, 0);
});

test('publicar e inscribirse exige autenticación y publicar exige organizador', async t => {
  const { app, participant, event } = await fixture(t);
  assert.throws(() => app.events.publish(null, eventData()), code('UNAUTHENTICATED'));
  assert.throws(() => app.events.publish(participant, eventData()), code('FORBIDDEN'));
  assert.throws(() => app.registrations.enroll(null, event.id), code('UNAUTHENTICATED'));
});

test('rechaza capacidad fraccionaria, fechas pasadas y cuentas inválidas', async t => {
  const { app, organizer } = await fixture(t);
  for (const capacity of [0, 1.5, '10', 10001]) assert.throws(() => app.events.publish(organizer, eventData({ capacity })), error => error.status === 400);
  assert.throws(() => app.events.publish(organizer, eventData({ starts_at:'2020-01-01T00:00:00Z' })), error => error.status === 400);
  await assert.rejects(app.users.register({ ...account(), password:'123' }), error => error.status === 400);
  await assert.rejects(app.users.register({ ...account(), role:'admin' }), error => error.status === 400);
});

test('hash de contraseña, correo normalizado y credenciales incorrectas', async t => {
  const { app, db } = await fixture(t);
  const input = account(); input.email = input.email.toUpperCase();
  const user = await app.users.register(input);
  assert.equal(user.email, input.email.toLowerCase());
  assert.equal(user.password_hash, undefined);
  const stored = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(user.id).password_hash;
  assert.notEqual(stored, input.password); assert.match(stored, /^[a-f0-9]{32}:[a-f0-9]{128}$/);
  assert.equal((await app.users.login(input)).id, user.id);
  await assert.rejects(app.users.login({ ...input, password:'incorrecta' }), code('INVALID_CREDENTIALS'));
  await assert.rejects(app.users.register(input), code('EMAIL_EXISTS'));
});

test('sesiones expiran y cerrar sesión invalida el token', async t => {
  const { app, db, participant } = await fixture(t);
  const token = app.users.startSession(participant);
  assert.equal(app.users.authenticate(token).id, participant.id);
  assert.equal(db.prepare('SELECT token_hash FROM sessions').get().token_hash.length, 64);
  app.users.logout(token); assert.equal(app.users.authenticate(token), null);
  const expired = app.users.startSession(participant);
  db.prepare('UPDATE sessions SET expires_at = ?').run('2000-01-01T00:00:00.000Z');
  assert.equal(app.users.authenticate(expired), null);
});

test('búsqueda y filtros tratan comodines SQL como texto y rechazan entradas inválidas', async t => {
  const { app, organizer, event } = await fixture(t);
  const special = app.events.publish(organizer, eventData({ title:'100% de ideas_locales', category:'Comunidad' }));
  assert.equal(app.events.list({ q:'%' }).events[0].id, special.id);
  assert.equal(app.events.list({ q:'_' }).events.length, 1);
  assert.equal(app.events.list({ category:'Tecnología' }).events[0].id, event.id);
  assert.equal(app.events.list({ q:"' OR 1=1 --" }).events.length, 0);
  assert.throws(() => app.events.list({ offset:-1 }), error => error.status === 400);
});

test('las inscripciones y notificaciones son privadas por usuario', async t => {
  const { app, participant, event } = await fixture(t);
  const other = await app.users.register(account());
  app.registrations.enroll(participant, event.id);
  assert.equal(app.registrations.list(other).length, 0);
  assert.equal(app.notifications.list(other).length, 0);
  const notification = app.notifications.list(participant)[0];
  assert.throws(() => app.notifications.markRead(other, notification.id), code('NOTIFICATION_NOT_FOUND'));
  assert.equal(app.notifications.list(participant)[0].read_at, null);
});

test('la base impide sobrecupo, duplicados y relaciones inexistentes', async t => {
  const { db, app, participant, event } = await fixture(t);
  assert.throws(() => db.prepare('UPDATE events SET occupied = capacity + 1 WHERE id = ?').run(event.id), /CHECK constraint/);
  app.registrations.enroll(participant, event.id);
  assert.throws(() => db.prepare('INSERT INTO registrations VALUES (?, ?, ?, ?)').run(randomUUID(), participant.id, event.id, new Date().toISOString()), /UNIQUE constraint/);
  assert.throws(() => db.prepare('INSERT INTO registrations VALUES (?, ?, ?, ?)').run(randomUUID(), randomUUID(), event.id, new Date().toISOString()), /FOREIGN KEY constraint/);
});

test('HTTP: cookies, autenticación, publicación, flujo completo y cierre de sesión', async t => {
  const { app, event } = await fixture(t);
  const server = createHttpServer(app); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const send = (path, data = {}, cookie = '', method = 'POST', headers = {}) => fetch(base+path, { method,
    headers:{ 'Content-Type':'application/json', Cookie:cookie, ...headers }, body:JSON.stringify(data) });
  assert.equal((await fetch(base+'/')).status, 200);
  assert.equal((await fetch(base+'/api/registrations')).status, 401);
  const registered = await send('/api/auth/register', account()); assert.equal(registered.status, 201);
  const header = registered.headers.get('set-cookie'); assert.match(header, /HttpOnly/); assert.match(header, /SameSite=Strict/);
  const cookie = header.split(';')[0];
  assert.equal((await send('/api/events', eventData(), cookie)).status, 403);
  assert.equal((await send(`/api/events/${event.id}/registrations`, {}, cookie, 'POST', { Origin:'https://untrusted.example' })).status, 403);
  const enrolled = await send(`/api/events/${event.id}/registrations`, {}, cookie); assert.equal(enrolled.status, 201);
  const result = await enrolled.json(); assert.equal(result.event.available, 1);
  assert.equal((await send(`/api/events/${event.id}/registrations`, {}, cookie)).status, 409);
  assert.equal((await (await fetch(base+'/api/registrations', { headers:{ Cookie:cookie } })).json()).registrations.length, 1);
  const list = await (await fetch(base+'/api/notifications', { headers:{ Cookie:cookie } })).json();
  assert.equal(list.notifications.length, 1);
  assert.equal((await send(`/api/notifications/${list.notifications[0].id}/read`, {}, cookie, 'PATCH')).status, 200);
  assert.equal((await send('/api/auth/logout', {}, cookie)).status, 200);
  assert.equal((await (await fetch(base+'/api/auth/me', { headers:{ Cookie:cookie } })).json()).user, null);
});

test('fase 3: solo el organizador dueño puede modificar su evento', async t => {
  const { app, organizer, participant, event } = await fixture(t);
  const other = await app.users.register(account('organizer'));
  const patch = { ...eventData(), title: 'Título actualizado del encuentro' };
  assert.throws(() => app.events.update(null, event.id, patch), code('UNAUTHENTICATED'));
  assert.throws(() => app.events.update(participant, event.id, patch), code('FORBIDDEN'));
  assert.throws(() => app.events.update(other, event.id, patch), code('FORBIDDEN'));
  const updated = app.events.update(organizer, event.id, patch);
  assert.equal(updated.title, 'Título actualizado del encuentro');
  assert.equal(updated.organizer_id, organizer.id);
  app.registrations.enroll(participant, event.id);
  assert.throws(
    () => app.events.update(organizer, event.id, { ...patch, capacity: 0 }),
    error => error.status === 400
  );
});

test('fase 3: la cantidad de inscripción debe ser mayor que cero y no se permite sobrecupo', async t => {
  const { app, participant, event } = await fixture(t);
  const second = await app.users.register(account());
  const third = await app.users.register(account());
  assert.throws(() => app.registrations.enroll(participant, event.id, { quantity: 0 }), code('INVALID_QUANTITY'));
  assert.throws(() => app.registrations.enroll(participant, event.id, { quantity: -1 }), code('INVALID_QUANTITY'));
  assert.throws(() => app.registrations.enroll(participant, event.id, { quantity: 2 }), code('INVALID_QUANTITY'));
  app.registrations.enroll(participant, event.id, { quantity: 1 });
  app.registrations.enroll(second, event.id);
  assert.throws(() => app.registrations.enroll(third, event.id), code('EVENT_FULL'));
  assert.equal(app.events.get(event.id).occupied, 2);
  assert.equal(app.events.get(event.id).available, 0);
});

test('fase 3: no se pueden consultar inscripciones privadas de otro usuario', async t => {
  const { app, participant, event } = await fixture(t);
  const other = await app.users.register(account());
  app.registrations.enroll(participant, event.id);
  assert.equal(app.registrations.list(other).length, 0);
  assert.throws(
    () => app.registrations.list(other, { requestedUserId: participant.id }),
    code('FORBIDDEN')
  );
  assert.equal(app.registrations.list(participant, { requestedUserId: participant.id }).length, 1);
});

test('HTTP fase 3: PATCH ajeno, cantidad inválida y userId ajeno se rechazan', async t => {
  const { app, organizer, event } = await fixture(t);
  const server = createHttpServer(app); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const send = (path, data = {}, cookie = '', method = 'POST') => fetch(base + path, {
    method, headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify(data)
  });
  const ownerReg = await send('/api/auth/register', account('organizer'));
  assert.equal(ownerReg.status, 201);
  const ownerCookie = ownerReg.headers.get('set-cookie').split(';')[0];
  const created = await send('/api/events', eventData({ title: 'Evento propio para editar' }), ownerCookie);
  assert.equal(created.status, 201);
  const owned = await created.json();

  const outsiderReg = await send('/api/auth/register', account());
  assert.equal(outsiderReg.status, 201);
  const outsiderCookie = outsiderReg.headers.get('set-cookie').split(';')[0];

  const denied = await send(`/api/events/${owned.event.id}`, eventData({ title: 'Intento no autorizado' }), outsiderCookie, 'PATCH');
  assert.equal(denied.status, 403);
  assert.equal((await denied.json()).code, 'FORBIDDEN');

  const allowed = await send(`/api/events/${owned.event.id}`, eventData({ title: 'Evento propio actualizado ok' }), ownerCookie, 'PATCH');
  assert.equal(allowed.status, 200);
  assert.equal((await allowed.json()).event.title, 'Evento propio actualizado ok');

  const badQuantity = await send(`/api/events/${event.id}/registrations`, { quantity: 0 }, outsiderCookie);
  assert.equal(badQuantity.status, 400);
  assert.equal((await badQuantity.json()).code, 'INVALID_QUANTITY');

  const peek = await fetch(`${base}/api/registrations?userId=${encodeURIComponent(organizer.id)}`, {
    headers: { Cookie: outsiderCookie }
  });
  assert.equal(peek.status, 403);
  assert.equal((await peek.json()).code, 'FORBIDDEN');
});

test('HTTP: valida JSON, tamaño del cuerpo y rutas inexistentes', async t => {
  const { app } = await fixture(t);
  const server = createHttpServer(app); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(base+'/api/auth/login', { method:'POST', body:'x' })).status, 415);
  assert.equal((await fetch(base+'/api/auth/login', { method:'POST', headers:{ 'Content-Type':'application/json' }, body:'{' })).status, 400);
  assert.equal((await fetch(base+'/api/auth/login', { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ text:'x'.repeat(20000) }) })).status, 413);
  assert.equal((await fetch(base+'/database/schema.sql')).status, 404);
});

test('8 conexiones concurrentes compiten por 3 cupos: solo 3 inscripciones y 3 confirmaciones', async t => {
  const root = resolve('tmp/tests');
  const directory = resolve(root, `race-${randomUUID()}`);
  assert.ok(directory.startsWith(root+sep)); mkdirSync(directory, { recursive:true });
  let db;
  t.after(() => { if (db) db.close(); assert.ok(directory.startsWith(root+sep)); rmSync(directory, { recursive:true, force:true }); });
  const path = resolve(directory, 'race.sqlite'); db = openDatabase(path);
  const app = createApplication(db);
  const organizer = await app.users.register(account('organizer'));
  const event = app.events.publish(organizer, eventData({ capacity:3 }));
  const users = [];
  for (let i=0; i<8; i++) users.push(await app.users.register(account()));
  const gate = new SharedArrayBuffer(4);
  const tasks = users.map(user => {
    const worker = new Worker(new URL('./helpers/enroll-worker.js', import.meta.url), { workerData:{ path, userId:user.id, eventId:event.id, gate } });
    let readyResolve, readyReject, resultResolve, resultReject;
    const ready = new Promise((resolve, reject) => { readyResolve=resolve; readyReject=reject; });
    const result = new Promise((resolve, reject) => { resultResolve=resolve; resultReject=reject; });
    worker.on('message', message => { if (message.type === 'ready') readyResolve(); else resultResolve(message); });
    worker.on('error', error => { readyReject(error); resultReject(error); });
    worker.on('exit', exit => { if (exit) { const error = new Error(`Worker terminó con código ${exit}`); readyReject(error); resultReject(error); } });
    return { ready, result, worker };
  });
  t.after(async () => { await Promise.all(tasks.map(task => task.worker.terminate())); });
  await Promise.all(tasks.map(task => task.ready));
  Atomics.store(new Int32Array(gate), 0, 1); Atomics.notify(new Int32Array(gate), 0);
  const results = await Promise.all(tasks.map(task => task.result));
  assert.equal(results.filter(item => item.ok).length, 3);
  assert.equal(results.filter(item => item.code === 'EVENT_FULL').length, 5);
  assert.equal(app.events.get(event.id).occupied, 3);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM registrations').get().n, 3);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM notifications').get().n, 3);
  await Promise.all(tasks.map(task => task.worker.terminate()));
  db.close(); db = openDatabase(path);
  assert.equal(createApplication(db).events.get(event.id).available, 0);
  assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
});
