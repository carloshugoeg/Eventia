export function createUsersRepository(db) {
  return {
    byEmail: (email) => db.prepare('SELECT * FROM users WHERE email = ?').get(email),
    byId: (id) => db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(id),
    insert(user) {
      db.prepare(`INSERT INTO users (id, name, email, password_hash, role, created_at)
        VALUES (?, ?, ?, ?, ?, ?)`).run(user.id, user.name, user.email, user.password_hash, user.role, user.created_at);
    },
    createSession(hash, userId, expiresAt) {
      db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(new Date().toISOString());
      db.prepare('INSERT INTO sessions VALUES (?, ?, ?)').run(hash, userId, expiresAt);
    },
    session(hash) {
      return db.prepare(`SELECT u.id, u.name, u.email, u.role FROM sessions s
        JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?`)
        .get(hash, new Date().toISOString());
    },
    deleteSession: (hash) => db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hash)
  };
}
