export function createRegistrationsRepository(db) {
  return {
    find: (userId, eventId) => db.prepare('SELECT * FROM registrations WHERE user_id = ? AND event_id = ?').get(userId, eventId),
    byId: (id) => db.prepare('SELECT * FROM registrations WHERE id = ?').get(id),
    insert(registration) {
      db.prepare('INSERT INTO registrations (id, user_id, event_id, created_at) VALUES (?, ?, ?, ?)')
        .run(registration.id, registration.user_id, registration.event_id, registration.created_at);
    },
    idempotency: (userId, key) => db.prepare('SELECT event_id, registration_id FROM idempotency_keys WHERE user_id = ? AND key = ?')
      .get(userId, key),
    saveIdempotency(row) {
      db.prepare(`INSERT INTO idempotency_keys (user_id, key, event_id, registration_id, created_at)
        VALUES (?, ?, ?, ?, ?)`).run(row.user_id, row.key, row.event_id, row.registration_id, row.created_at);
    },
    list: (userId) => db.prepare('SELECT * FROM registrations WHERE user_id = ? ORDER BY created_at DESC').all(userId)
  };
}
