import { AppError, requireUser } from '../../shared/errors.js';

function applied(repository, outboxId) {
  try {
    repository.markApplied(outboxId);
    return true;
  } catch (error) {
    if (String(error.message).includes('UNIQUE constraint failed: report_applied.outbox_id')) return false;
    throw error;
  }
}

export function createReportsService(repository) {
  return {
    applyPublished(outboxId, payload, now = new Date()) {
      if (!applied(repository, outboxId)) return;
      repository.ensureEvent(payload, now.toISOString());
    },
    applyRegistration(outboxId, payload, now = new Date()) {
      if (!applied(repository, outboxId)) return;
      repository.ensureEvent(payload, now.toISOString());
      repository.increment(payload.eventId, now.toISOString());
      repository.addDay(payload.eventId, String(payload.createdAt).slice(0, 10));
    },
    list(user) {
      requireUser(user);
      if (user.role !== 'organizer') {
        throw new AppError(403, 'Los reportes están disponibles para organizadores.', 'FORBIDDEN');
      }
      return repository.eventsFor(user.id).map(event => ({
        event_id: event.event_id,
        title: event.title,
        capacity: event.capacity,
        registrations: event.registrations,
        occupancy_pct: Math.round((event.registrations * 1000) / event.capacity) / 10,
        timeline: repository.timeline(event.event_id).map(point => ({ day: point.day, registrations: point.registrations }))
      }));
    }
  };
}
