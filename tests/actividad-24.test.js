import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { openDatabase } from '../src/infrastructure/database.js';
import { createApplication } from '../src/app.js';
import { createHttpServer } from '../src/http/server.js';

const account = (role = 'participant') => ({
  name: 'Persona de prueba',
  email: `${randomUUID()}@test.example`,
  password: 'PruebaSegura123!',
  role
});

const eventData = (overrides = {}) => ({
  title: 'Encuentro de prueba',
  description: 'Una actividad para compartir ideas con la comunidad local.',
  category: 'Tecnología',
  location: 'Centro de Xela',
  starts_at: new Date(Date.now() + 86400000).toISOString(),
  capacity: 2,
  ...overrides
});

const code = expected => error => error.code === expected;

test('Actividad 24: un evento cerrado no se reabre con PATCH', async t => {
  const db = openDatabase(':memory:');
  t.after(() => db.close());
  const app = createApplication(db);
  const organizer = await app.users.register(account('organizer'));
  const other = await app.users.register(account('organizer'));
  const event = app.events.publish(organizer, eventData());
  db.prepare('UPDATE events SET starts_at = ? WHERE id = ?').run('2020-01-01T00:00:00.000Z', event.id);
  const patch = eventData({ title: 'Reapertura prohibida' });
  assert.throws(() => app.events.update(organizer, event.id, patch), code('EVENT_CLOSED'));
  assert.equal(app.events.get(event.id).title, event.title);
  assert.equal(app.events.get(event.id).starts_at, '2020-01-01T00:00:00.000Z');
  assert.throws(() => app.events.update(other, event.id, patch), code('FORBIDDEN'));
  assert.throws(() => app.events.update(null, event.id, patch), code('UNAUTHENTICATED'));
});

test('Actividad 24: las inscripciones ajenas se rechazan y las propias no', async t => {
  const db = openDatabase(':memory:');
  t.after(() => db.close());
  const app = createApplication(db);
  const participant = await app.users.register(account());
  const other = await app.users.register(account());
  const organizer = await app.users.register(account('organizer'));
  const event = app.events.publish(organizer, eventData());
  app.registrations.enroll(participant, event.id);
  assert.throws(() => app.registrations.list(null), code('UNAUTHENTICATED'));
  assert.throws(
    () => app.registrations.list(other, { requestedUserId: participant.id }),
    code('FORBIDDEN')
  );
  assert.equal(app.registrations.list(participant, { requestedUserId: participant.id }).length, 1);
});

test('Actividad 24: las seis pruebas HTTP y el evento cerrado', async t => {
  const db = openDatabase(':memory:');
  t.after(() => db.close());
  const app = createApplication(db);
  const server = createHttpServer(app);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;

  const send = async (path, { method = 'GET', cookie = '', body } = {}) => {
    const headers = {};
    if (cookie) headers.Cookie = cookie;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await fetch(`${base}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const json = await response.json();
    return {
      status: response.status,
      json,
      cookie: response.headers.get('set-cookie')?.split(';')[0] ?? ''
    };
  };

  const anonymous = await send('/api/registrations');
  assert.equal(anonymous.status, 401);
  assert.equal(anonymous.json.code, 'UNAUTHENTICATED');

  const registered = await send('/api/auth/register', { method: 'POST', body: account() });
  assert.equal(registered.status, 201);
  const ownList = await send('/api/registrations', { cookie: registered.cookie });
  assert.equal(ownList.status, 200);

  const owner = await send('/api/auth/register', { method: 'POST', body: account('organizer') });
  const created = await send('/api/events', {
    method: 'POST',
    cookie: owner.cookie,
    body: eventData({ title: 'Evento propio para editar' })
  });
  assert.equal(created.status, 201);
  const eventId = created.json.event.id;
  const patched = await send(`/api/events/${eventId}`, {
    method: 'PATCH',
    cookie: owner.cookie,
    body: eventData({ title: 'Evento propio actualizado ok' })
  });
  assert.equal(patched.status, 200);
  assert.equal(patched.json.event.title, 'Evento propio actualizado ok');

  const other = await send('/api/auth/register', { method: 'POST', body: account('organizer') });
  const denied = await send(`/api/events/${eventId}`, {
    method: 'PATCH',
    cookie: other.cookie,
    body: eventData({ title: 'Intento no autorizado' })
  });
  assert.equal(denied.status, 403);
  assert.equal(denied.json.code, 'FORBIDDEN');

  const foreign = await send(`/api/registrations?userId=${encodeURIComponent(owner.json.user.id)}`, {
    cookie: registered.cookie
  });
  assert.equal(foreign.status, 403);
  assert.equal(foreign.json.code, 'FORBIDDEN');

  db.prepare('UPDATE sessions SET expires_at = ? WHERE user_id = ?')
    .run('2000-01-01T00:00:00.000Z', registered.json.user.id);
  const expired = await send('/api/registrations', { cookie: registered.cookie });
  assert.equal(expired.status, 401);
  assert.equal(expired.json.code, 'UNAUTHENTICATED');

  const forged = await send('/api/registrations', { cookie: `eventia_session=${'ab'.repeat(32)}` });
  assert.equal(forged.status, 401);
  assert.equal(forged.json.code, 'UNAUTHENTICATED');

  db.prepare('UPDATE events SET starts_at = ? WHERE id = ?').run('2020-01-01T00:00:00.000Z', eventId);
  const closed = await send(`/api/events/${eventId}`, {
    method: 'PATCH',
    cookie: owner.cookie,
    body: eventData({ title: 'Reapertura prohibida' })
  });
  assert.equal(closed.status, 409);
  assert.equal(closed.json.code, 'EVENT_CLOSED');
  const still = await send(`/api/events/${eventId}`);
  assert.equal(still.json.event.title, 'Evento propio actualizado ok');
  assert.equal(still.json.event.starts_at, '2020-01-01T00:00:00.000Z');

  const closedOther = await send(`/api/events/${eventId}`, {
    method: 'PATCH',
    cookie: other.cookie,
    body: eventData({ title: 'Ajeno sobre cerrado' })
  });
  assert.equal(closedOther.status, 403);
  assert.equal(closedOther.json.code, 'FORBIDDEN');
});
