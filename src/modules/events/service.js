import { randomUUID } from 'node:crypto';
import { AppError, text, requireOrganizer } from '../../shared/errors.js';

export const categories = ['Tecnología', 'Arte y cultura', 'Comunidad', 'Bienestar', 'Música'];

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
      const title = text(input.title, 'Título', 4, 100);
      const description = text(input.description, 'Descripción', 20, 2000);
      const location = text(input.location, 'Lugar', 3, 160);
      if (!categories.includes(input.category)) throw new AppError(400, 'Selecciona una categoría válida.');
      const date = typeof input.starts_at === 'string' ? new Date(input.starts_at) : new Date(NaN);
      if (!Number.isFinite(date.getTime()) || date.getTime() <= Date.now()) throw new AppError(400, 'La fecha del evento debe estar en el futuro.');
      if (!Number.isSafeInteger(input.capacity) || input.capacity < 1 || input.capacity > 10000) {
        throw new AppError(400, 'El cupo debe ser un número entero entre 1 y 10,000.');
      }
      const event = { id: randomUUID(), organizer_id: user.id, title, description, location,
        category: input.category, starts_at: date.toISOString(), capacity: input.capacity, created_at: new Date().toISOString() };
      repository.insert(event);
      return service.get(event.id);
    },
    reservePlace(id) {
      const event = service.get(id);
      if (event.starts_at <= new Date().toISOString()) throw new AppError(409, 'Las inscripciones de este evento ya cerraron.', 'EVENT_CLOSED');
      if (repository.reserve(id) !== 1) throw new AppError(409, 'Este evento ya no tiene cupos disponibles.', 'EVENT_FULL');
      return event;
    }
  };
  return service;
}
