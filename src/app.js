import { unitOfWork } from './infrastructure/database.js';
import { createUsersRepository } from './modules/users/repository.js';
import { createUsersService } from './modules/users/service.js';
import { createEventsRepository } from './modules/events/repository.js';
import { createEventsService } from './modules/events/service.js';
import { createRegistrationsRepository } from './modules/registrations/repository.js';
import { createRegistrationsService } from './modules/registrations/service.js';
import { createNotificationsRepository } from './modules/notifications/repository.js';
import { createNotificationsService } from './modules/notifications/service.js';

export function createApplication(db) {
  const users = createUsersService(createUsersRepository(db));
  const events = createEventsService(createEventsRepository(db), users);
  const notifications = createNotificationsService(createNotificationsRepository(db));
  const registrations = createRegistrationsService({ repository: createRegistrationsRepository(db),
    users, events, notifications, transaction: unitOfWork(db) });
  return { users, events, registrations, notifications };
}
