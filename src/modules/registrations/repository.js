export function createRegistrationsRepository(db) {
  return {
    find: (userId, eventId) => db.prepare('SELECT * FROM registrations WHERE user_id = ? AND event_id = ?').get(userId, eventId),
    insert(registration) {
      db.prepare('INSERT INTO registrations (id, user_id, event_id, created_at) VALUES (?, ?, ?, ?)')
        .run(registration.id, registration.user_id, registration.event_id, registration.created_at);
    },
    // Solo se leen registros propios; los datos de eventos llegan por su contrato público.
    list: (userId) => db.prepare('SELECT * FROM registrations WHERE user_id = ? ORDER BY created_at DESC').all(userId)
  };
}
