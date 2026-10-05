import { randomUUID } from 'node:crypto';
import { AppError, requireUser } from '../../shared/errors.js';

export function createNotificationsService(repository) {
  return {
    confirmRegistration(userId, registrationId, title) {
      const notification = { id: randomUUID(), user_id: userId, registration_id: registrationId,
        message: `Tu inscripción a «${title}» está confirmada. ¡Te esperamos!`, created_at: new Date().toISOString(), read_at: null };
      repository.insert(notification);
      return notification;
    },
    list(user) { requireUser(user); return repository.list(user.id); },
    markRead(user, id) {
      requireUser(user);
      if (!repository.markRead(id, user.id)) throw new AppError(404, 'Notificación no encontrada.', 'NOTIFICATION_NOT_FOUND');
    }
  };
}
