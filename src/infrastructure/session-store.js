export function createSqliteSessionStore(db) {
  return {
    put(tokenHash, userId, expiresAt) {
      db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(new Date().toISOString());
      db.prepare('INSERT INTO sessions VALUES (?, ?, ?)').run(tokenHash, userId, expiresAt);
    },
    get(tokenHash) {
      return db.prepare(`SELECT u.id, u.name, u.email, u.role FROM sessions s
        JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?`)
        .get(tokenHash, new Date().toISOString());
    },
    delete(tokenHash) {
      db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
    }
  };
}
