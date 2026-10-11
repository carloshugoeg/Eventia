import { randomUUID } from 'node:crypto';
import { AppError, requireUser } from '../../shared/errors.js';

function normalizeKey(key) {
  if (key == null || key === '') return null;
  if (typeof key !== 'string' || !/^[A-Za-z0-9_-]{8,80}$/.test(key)) {
    throw new AppError(400, 'La clave de idempotencia no es válida.', 'INVALID_IDEMPOTENCY_KEY');
  }
  return key;
}

export function createRegistrationsService({ repository, users, events, notifications, transaction }) {
  return {
    enroll(user, eventId, idempotencyKey = null) {
      requireUser(user);
      const key = normalizeKey(idempotencyKey);
      try {
        return transaction(() => {
          if (key) {
            const prior = repository.idempotency(user.id, key);
            if (prior) {
              if (prior.event_id !== eventId) {
                throw new AppError(409, 'Esta clave de idempotencia ya se usó para otro evento.', 'IDEMPOTENCY_CONFLICT');
              }
              return {
                registration: repository.byId(prior.registration_id),
                notification: null,
                event: events.get(eventId),
                replayed: true
              };
            }
          }
          users.ensureExists(user.id);
          if (repository.find(user.id, eventId)) {
            throw new AppError(409, 'Ya estás inscrito en este evento.', 'ALREADY_REGISTERED');
          }
          const reserved = events.reservePlace(eventId);
          const registration = {
            id: randomUUID(),
            user_id: user.id,
            event_id: eventId,
            created_at: new Date().toISOString()
          };
          repository.insert(registration);
          notifications.confirmRegistration(user.id, registration, reserved);
          if (key) {
            repository.saveIdempotency({
              user_id: user.id,
              key,
              event_id: eventId,
              registration_id: registration.id,
              created_at: registration.created_at
            });
          }
          return { registration, notification: null, event: events.get(eventId), replayed: false };
        });
      } finally {
        events.invalidate();
      }
    },
    list(user) {
      requireUser(user);
      return repository.list(user.id).map(registration => ({ ...registration, event: events.get(registration.event_id) }));
    }
  };
}
