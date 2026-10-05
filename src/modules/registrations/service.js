import { randomUUID } from 'node:crypto';
import { AppError, requireUser } from '../../shared/errors.js';

export function createRegistrationsService({ repository, users, events, notifications, transaction }) {
  return {
    enroll(user, eventId) {
      requireUser(user);
      return transaction(() => {
        users.ensureExists(user.id);
        if (repository.find(user.id, eventId)) {
          throw new AppError(409, 'Ya estás inscrito en este evento.', 'ALREADY_REGISTERED');
        }
        const event = events.reservePlace(eventId);
        const registration = { id: randomUUID(), user_id: user.id, event_id: eventId, created_at: new Date().toISOString() };
        repository.insert(registration);
        const notification = notifications.confirmRegistration(user.id, registration.id, event.title);
        return { registration, notification, event: events.get(eventId) };
      });
    },
    list(user) {
      requireUser(user);
      return repository.list(user.id).map(registration => ({ ...registration, event: events.get(registration.event_id) }));
    }
  };
}
