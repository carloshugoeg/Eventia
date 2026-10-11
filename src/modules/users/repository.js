export function createUsersRepository(db) {
  return {
    byEmail: (email) => db.prepare('SELECT * FROM users WHERE email = ?').get(email),
    byId: (id) => db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(id),
    insert(user) {
      db.prepare(`INSERT INTO users (id, name, email, password_hash, role, created_at)
        VALUES (?, ?, ?, ?, ?, ?)`).run(user.id, user.name, user.email, user.password_hash, user.role, user.created_at);
    }
  };
}
