import { randomUUID } from 'node:crypto';
import { AppError, text, requireOrganizer } from '../../shared/errors.js';

export const categories = ['Tecnología', 'Arte y cultura', 'Comunidad', 'Bienestar', 'Música'];

function parseEventFields(input, { occupied = 0 } = {}) {
  const title = text(input.title, 'Título', 4, 100);
  const description = text(input.description, 'Descripción', 20, 2000);
  const location = text(input.location, 'Lugar', 3, 160);
  if (!categories.includes(input.category)) throw new AppError(400, 'Selecciona una categoría válida.');
  const date = typeof input.starts_at === 'string' ? new Date(input.starts_at) : new Date(NaN);
  if (!Number.isFinite(date.getTime()) || date.getTime() <= Date.now()) {
    throw new AppError(400, 'La fecha del evento debe estar en el futuro.');
  }
  if (!Number.isSafeInteger(input.capacity) || input.capacity < 1 || input.capacity > 10000) {
    throw new AppError(400, 'El cupo debe ser un número entero entre 1 y 10,000.');
  }
  if (input.capacity < occupied) {
    throw new AppError(400, 'El cupo no puede ser menor que las inscripciones ya confirmadas.', 'CAPACITY_TOO_LOW');
  }
  return { title, description, location, category: input.category, starts_at: date.toISOString(), capacity: input.capacity };
}

export function createEventsService(repository, users) {
  const describe = event => ({ ...event, organizer_name: users.ensureExists(event.organizer_id).name });
  const service = {
    list({ q = '', category = '', offset = 0 } = {}) {
      if (typeof q !== 'string' || q.length > 120) throw new AppError(400, 'La búsqueda admite hasta 120 caracteres.');
      if (category && !categories.includes(category)) throw new AppError(400, 'Categoría inválida.');
      if (!Number.isSafeInteger(offset) || offset < 0) throw new AppError(400, 'Página inválida.');
      const result = repository.list(q.trim(), category, offset);
      return { ...result, events: result.events.map(describe) };
    },
    get(id) {
      const event = repository.get(id);
      if (!event) throw new AppError(404, 'No encontramos este evento.', 'EVENT_NOT_FOUND');
      return describe(event);
    },
    publish(user, input) {
      requireOrganizer(user);
      const fields = parseEventFields(input);
      const event = { id: randomUUID(), organizer_id: user.id, ...fields, created_at: new Date().toISOString() };
      repository.insert(event);
      return service.get(event.id);
    },
    update(user, id, input) {
      requireOrganizer(user);
      const current = repository.get(id);
      if (!current) throw new AppError(404, 'No encontramos este evento.', 'EVENT_NOT_FOUND');
      if (current.organizer_id !== user.id) {
        throw new AppError(403, 'Solo el organizador de este evento puede modificarlo.', 'FORBIDDEN');
      }
      const fields = parseEventFields(input, { occupied: current.occupied });
      repository.update({ id, organizer_id: user.id, ...fields });
      return service.get(id);
    },
    reservePlace(id) {
      const event = service.get(id);
      if (event.starts_at <= new Date().toISOString()) throw new AppError(409, 'Las inscripciones de este evento ya cerraron.', 'EVENT_CLOSED');
      if (event.available < 1) throw new AppError(409, 'Este evento ya no tiene cupos disponibles.', 'EVENT_FULL');
      if (repository.reserve(id) !== 1) throw new AppError(409, 'Este evento ya no tiene cupos disponibles.', 'EVENT_FULL');
      return event;
    }
  };
  return service;
}
