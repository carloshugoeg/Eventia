export function createNotificationsRepository(db) {
  return {
    insert(notification) {
      db.prepare('INSERT INTO notifications (id, user_id, registration_id, message, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(notification.id, notification.user_id, notification.registration_id, notification.message, notification.created_at);
    },
    list: (userId) => db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC').all(userId),
    markRead: (id, userId) => db.prepare('UPDATE notifications SET read_at = COALESCE(read_at, ?) WHERE id = ? AND user_id = ?')
      .run(new Date().toISOString(), id, userId).changes
  };
}
