const projection = `e.*, (e.capacity - e.occupied) AS available`;

export function createEventsRepository(db) {
  return {
    list(query = '', category = '', offset = 0, limit = 24) {
      const escaped = query.replace(/[\\%_]/g, '\\$&');
      const params = [new Date().toISOString(), `%${escaped}%`, `%${escaped}%`, category, category];
      const filter = `e.starts_at > ? AND (e.title LIKE ? ESCAPE '\\' OR e.description LIKE ? ESCAPE '\\')
        AND (? = '' OR e.category = ?)`;
      const events = db.prepare(`SELECT ${projection} FROM events e
        WHERE ${filter} ORDER BY e.starts_at, e.id LIMIT ? OFFSET ?`).all(...params, limit, offset);
      const { total } = db.prepare(`SELECT COUNT(*) AS total FROM events e WHERE ${filter}`).get(...params);
      return { events, total };
    },
    get: (id) => db.prepare(`SELECT ${projection} FROM events e WHERE e.id = ?`).get(id),
    insert(event) {
      db.prepare(`INSERT INTO events
        (id, organizer_id, title, description, category, location, starts_at, capacity, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(event.id, event.organizer_id, event.title,
        event.description, event.category, event.location, event.starts_at, event.capacity, event.created_at);
    },
    reserve: (id) => db.prepare(`UPDATE events SET occupied = occupied + 1
      WHERE id = ? AND occupied < capacity AND starts_at > ?`).run(id, new Date().toISOString()).changes
  };
}
