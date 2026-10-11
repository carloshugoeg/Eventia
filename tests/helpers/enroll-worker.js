import { parentPort, workerData } from 'node:worker_threads';
import { openDatabase } from '../../src/infrastructure/database.js';
import { createApplication } from '../../src/app.js';

const db = openDatabase(workerData.path);
const app = createApplication(db);
parentPort.postMessage({ type: 'ready' });
Atomics.wait(new Int32Array(workerData.gate), 0, 0);
try {
  const user = app.users.ensureExists(workerData.userId);
  const result = app.registrations.enroll(user, workerData.eventId, workerData.idempotencyKey);
  parentPort.postMessage({ type: 'result', ok: true, id: result.registration.id });
} catch (error) {
  parentPort.postMessage({ type: 'result', ok: false, code: error.code, message: error.message });
} finally { db.close(); }
