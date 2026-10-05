import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { openDatabase } from './infrastructure/database.js';
import { createApplication } from './app.js';
import { createHttpServer } from './http/server.js';

if (existsSync('.env')) loadEnvFile('.env');
const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT debe ser un puerto válido.');
const host = process.env.HOST ?? '127.0.0.1';
const db = openDatabase(process.env.DATABASE_PATH ?? './data/eventia.sqlite');
const server = createHttpServer(createApplication(db), {
  secureCookie: process.env.COOKIE_SECURE === 'true',
  allowedOrigins: process.env.APP_ORIGIN ? [process.env.APP_ORIGIN] : []
});
server.on('error', error => { console.error(`No se pudo iniciar Eventia: ${error.message}`); db.close(); process.exitCode = 1; });
server.listen(port, host, () => console.log(`Eventia está disponible en http://localhost:${port}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => { db.close(); process.exit(0); }));
