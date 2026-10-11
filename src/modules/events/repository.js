const projection = `e.*, (e.capacity - e.occupied) AS available`;

function wordQuery(query) {
  return /^[\p{L}\p{N}]+(?:\s+[\p{L}\p{N}]+)*$/u.test(query);
}

function matchExpression(query) {
  return query.split(/\s+/).map(token => `"${token.replaceAll('"', '')}"`).join(' ');
}

export function createEventsRepository(db) {
  let fts = false;
  try {
    db.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS events_fts USING fts5(
      event_id UNINDEXED, title, description, tokenize = "unicode61 remove_diacritics 2")`);
    const events = db.prepare('SELECT COUNT(*) AS n FROM events').get().n;
    const indexed = db.prepare('SELECT COUNT(*) AS n FROM events_fts').get().n;
    if (events !== indexed) {
      db.exec('DELETE FROM events_fts');
      db.prepare('INSERT INTO events_fts (event_id, title, description) SELECT id, title, description FROM events').run();
    }
    fts = true;
  } catch {
    fts = false;
  }
  const insertEvent = db.prepare(`INSERT INTO events
    (id, organizer_id, title, description, category, location, starts_at, capacity, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const insertFts = fts
    ? db.prepare('INSERT INTO events_fts (event_id, title, description) VALUES (?, ?, ?)')
    : null;
  return {
    engine: fts ? 'fts5' : 'like',
    list(query = '', category = '', offset = 0, limit = 24) {
      const text = query.trim();
      if (fts && wordQuery(text)) {
        const params = [matchExpression(text), new Date().toISOString(), category, category];
        const filter = `events_fts MATCH ? AND e.starts_at > ? AND (? = '' OR e.category = ?)`;
        const events = db.prepare(`SELECT ${projection} FROM events e
          JOIN events_fts ON events_fts.event_id = e.id
          WHERE ${filter} ORDER BY e.starts_at, e.id LIMIT ? OFFSET ?`).all(...params, limit, offset);
        const { total } = db.prepare(`SELECT COUNT(*) AS total FROM events e
          JOIN events_fts ON events_fts.event_id = e.id WHERE ${filter}`).get(...params);
        return { events, total };
      }
      const escaped = text.replace(/[\\%_]/g, '\\$&');
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
      insertEvent.run(event.id, event.organizer_id, event.title, event.description, event.category,
        event.location, event.starts_at, event.capacity, event.created_at);
      insertFts?.run(event.id, event.title, event.description);
    },
    reserve: (id) => db.prepare(`UPDATE events SET occupied = occupied + 1
      WHERE id = ? AND occupied < capacity AND starts_at > ?`).run(id, new Date().toISOString()).changes
  };
}
