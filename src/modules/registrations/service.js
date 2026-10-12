import { randomUUID } from 'node:crypto';
import { AppError, requireUser } from '../../shared/errors.js';

function enrollmentQuantity(input = {}) {
  const quantity = input.quantity === undefined ? 1 : input.quantity;
  if (!Number.isSafeInteger(quantity) || quantity < 1) {
    throw new AppError(400, 'La cantidad de inscripciones debe ser un entero mayor que cero.', 'INVALID_QUANTITY');
  }
  if (quantity !== 1) {
    throw new AppError(400, 'En esta versión solo puedes reservar un lugar por inscripción.', 'INVALID_QUANTITY');
  }
  return quantity;
}

export function createRegistrationsService({ repository, users, events, notifications, transaction }) {
  return {
    enroll(user, eventId, input = {}) {
      requireUser(user);
      enrollmentQuantity(input);
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
    list(user, { requestedUserId } = {}) {
      requireUser(user);
      if (requestedUserId != null && requestedUserId !== '' && requestedUserId !== user.id) {
        throw new AppError(403, 'No puedes consultar las inscripciones de otro usuario.', 'FORBIDDEN');
      }
      return repository.list(user.id).map(registration => ({ ...registration, event: events.get(registration.event_id) }));
    }
  };
}
