import { randomUUID } from 'node:crypto';

export function createOutboxRepository(db) {
  return {
    append({ type, payload, now = new Date().toISOString() }) {
      const id = randomUUID();
      db.prepare(`INSERT INTO outbox (id, type, payload, status, attempts, next_attempt_at, created_at)
        VALUES (?, ?, ?, 'pending', 0, ?, ?)`).run(id, type, JSON.stringify(payload), now, now);
      return id;
    },
    claim(nowIso, leaseIso) {
      return db.prepare(`UPDATE outbox
        SET attempts = attempts + 1, next_attempt_at = ?
        WHERE id = (
          SELECT id FROM outbox
          WHERE status = 'pending' AND next_attempt_at <= ?
          ORDER BY created_at, id
          LIMIT 1
        )
        AND status = 'pending'
        RETURNING id, type, payload, attempts`).get(leaseIso, nowIso);
    },
    markProcessed(id, nowIso) {
      db.prepare(`UPDATE outbox SET status = 'processed', processed_at = ?, last_error = NULL
        WHERE id = ? AND status = 'pending'`).run(nowIso, id);
    },
    fail(id, { status, nextAttemptAt, error }) {
      db.prepare(`UPDATE outbox SET status = ?, next_attempt_at = ?, last_error = ?
        WHERE id = ? AND status = 'pending'`).run(status, nextAttemptAt, error, id);
    },
    pending() {
      return db.prepare(`SELECT COUNT(*) AS n FROM outbox WHERE status = 'pending'`).get().n;
    }
  };
}
