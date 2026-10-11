export function createReportsRepository(db) {
  const ensureEvent = db.prepare(`INSERT INTO report_events
    (event_id, organizer_id, title, capacity, registrations, updated_at)
    VALUES (?, ?, ?, ?, 0, ?)
    ON CONFLICT(event_id) DO NOTHING`);
  return {
    markApplied(outboxId) {
      db.prepare('INSERT INTO report_applied (outbox_id) VALUES (?)').run(outboxId);
    },
    ensureEvent(payload, nowIso) {
      ensureEvent.run(payload.eventId, payload.organizerId, payload.title ?? payload.eventTitle, payload.capacity, nowIso);
    },
    increment(eventId, nowIso) {
      db.prepare('UPDATE report_events SET registrations = registrations + 1, updated_at = ? WHERE event_id = ?')
        .run(nowIso, eventId);
    },
    addDay(eventId, day) {
      db.prepare(`INSERT INTO report_registrations_by_day (event_id, day, registrations) VALUES (?, ?, 1)
        ON CONFLICT(event_id, day) DO UPDATE SET registrations = registrations + 1`).run(eventId, day);
    },
    eventsFor(organizerId) {
      return db.prepare(`SELECT event_id, title, capacity, registrations FROM report_events
        WHERE organizer_id = ? ORDER BY title, event_id`).all(organizerId);
    },
    timeline(eventId) {
      return db.prepare(`SELECT day, registrations FROM report_registrations_by_day
        WHERE event_id = ? ORDER BY day`).all(eventId);
    }
  };
}
