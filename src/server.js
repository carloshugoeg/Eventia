import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { openDatabase } from './infrastructure/database.js';
import { loadConfig } from './infrastructure/config.js';
import { createApplication } from './app.js';
import { createHttpServer } from './http/server.js';

if (existsSync('.env')) loadEnvFile('.env');
const config = loadConfig();
const db = openDatabase(config.databasePath);
const server = createHttpServer(createApplication(db, config), config);
server.on('error', error => { console.error(`No se pudo iniciar Eventia: ${error.message}`); db.close(); process.exitCode = 1; });
server.listen(config.port, config.host, () => console.log(`Eventia está disponible en http://localhost:${config.port}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => { db.close(); process.exit(0); }));
