import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { openDatabase } from '../src/infrastructure/database.js';
import { loadConfig } from '../src/infrastructure/config.js';
import { createApplication } from '../src/app.js';

if (existsSync('.env')) loadEnvFile('.env');
const config = loadConfig();
const db = openDatabase(config.databasePath);
const app = createApplication(db, config);
let stopped = false;
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { stopped = true; });

console.log('Worker de notificaciones y reportes escuchando la bandeja.');

while (!stopped) {
  let processed = 0;
  try {
    processed = app.processOutbox();
  } catch (error) {
    console.error('El worker no pudo leer la bandeja:', error.message);
  }
  if (!processed) {
    const step = 50;
    for (let waited = 0; waited < config.outboxPollMs && !stopped; waited += step) {
      await new Promise(resolve => setTimeout(resolve, Math.min(step, config.outboxPollMs - waited)));
    }
  }
}

db.close();
