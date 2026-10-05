import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export function openDatabase(path = './data/eventia.sqlite') {
  if (path !== ':memory:') mkdirSync(dirname(resolve(path)), { recursive: true });
  const db = new DatabaseSync(path, { timeout: 5000, enableForeignKeyConstraints: true });
  db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  db.exec(readFileSync(new URL('../../database/schema.sql', import.meta.url), 'utf8'));
  return db;
}

// Los servicios participantes usan la misma conexión y no esperan tareas externas.
export function unitOfWork(db) {
  return (operation) => {
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = operation();
      if (result && typeof result.then === 'function') {
        throw new Error('Una transacción no debe contener operaciones asíncronas.');
      }
      db.exec('COMMIT');
      return result;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  };
}
