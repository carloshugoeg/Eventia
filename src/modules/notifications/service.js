import { randomUUID } from 'node:crypto';
import { AppError, requireUser } from '../../shared/errors.js';

export function createNotificationsService(repository, outbox) {
  return {
    confirmRegistration(userId, registration, event) {
      outbox.append({
        type: 'registration.confirmed',
        payload: {
          userId,
          registrationId: registration.id,
          eventId: event.id,
          eventTitle: event.title,
          organizerId: event.organizer_id,
          capacity: event.capacity,
          createdAt: registration.created_at
        }
      });
    },
    deliver(payload) {
      const notification = {
        id: randomUUID(),
        user_id: payload.userId,
        registration_id: payload.registrationId,
        message: `Tu inscripción a «${payload.eventTitle}» está confirmada. ¡Te esperamos!`,
        created_at: new Date().toISOString()
      };
      try {
        repository.insert(notification);
      } catch (error) {
        if (!String(error.message).includes('UNIQUE constraint failed: notifications.registration_id')) throw error;
      }
    },
    list(user) {
      requireUser(user);
      return repository.list(user.id);
    },
    markRead(user, id) {
      requireUser(user);
      if (!repository.markRead(id, user.id)) throw new AppError(404, 'Notificación no encontrada.', 'NOTIFICATION_NOT_FOUND');
    }
  };
}
