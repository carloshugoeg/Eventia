import { unitOfWork } from './infrastructure/database.js';
import { createTtlCache } from './infrastructure/cache.js';
import { createSqliteSessionStore } from './infrastructure/session-store.js';
import { createUsersRepository } from './modules/users/repository.js';
import { createUsersService } from './modules/users/service.js';
import { createEventsRepository } from './modules/events/repository.js';
import { createEventsService } from './modules/events/service.js';
import { createRegistrationsRepository } from './modules/registrations/repository.js';
import { createRegistrationsService } from './modules/registrations/service.js';
import { createNotificationsRepository } from './modules/notifications/repository.js';
import { createNotificationsService } from './modules/notifications/service.js';
import { createOutboxRepository } from './modules/outbox/repository.js';
import { createOutboxProcessor } from './modules/outbox/processor.js';
import { createReportsRepository } from './modules/reports/repository.js';
import { createReportsService } from './modules/reports/service.js';

export function createApplication(db, options = {}) {
  const transaction = unitOfWork(db);
  const outbox = createOutboxRepository(db);
  const users = createUsersService(createUsersRepository(db), createSqliteSessionStore(db));
  const events = createEventsService(createEventsRepository(db), users, {
    cache: createTtlCache(options.catalogCacheTtlMs ?? 0),
    outbox,
    transaction
  });
  const notifications = createNotificationsService(createNotificationsRepository(db), outbox);
  const reports = createReportsService(createReportsRepository(db));
  const registrations = createRegistrationsService({
    repository: createRegistrationsRepository(db),
    users, events, notifications, transaction
  });
  const processor = createOutboxProcessor({
    outbox,
    transaction,
    handlers: {
      'registration.confirmed'(payload, row) {
        notifications.deliver(payload);
        reports.applyRegistration(row.id, payload);
      },
      'event.published'(payload, row) {
        reports.applyPublished(row.id, payload);
      }
    },
    backoffMs: options.outboxBackoffMs,
    maxAttempts: options.outboxMaxAttempts,
    leaseMs: options.outboxLeaseMs
  });
  return {
    users, events, registrations, notifications, reports,
    processOutbox: (now) => processor.processBatch(now ? { now } : {}),
    health() {
      const database = db.prepare('SELECT 1 AS ok').get()?.ok === 1 ? 'ok' : 'error';
      return {
        status: database === 'ok' ? 'ok' : 'error',
        database,
        search: events.searchEngine,
        outbox: { pending: outbox.pending() }
      };
    }
  };
}
