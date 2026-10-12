import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { openDatabase } from '../src/infrastructure/database.js';
import { createApplication } from '../src/app.js';

if (existsSync('.env')) loadEnvFile('.env');
const demoPassword = process.env.DEMO_PASSWORD ?? 'Eventia2026!';
const db = openDatabase(process.env.DATABASE_PATH ?? './data/eventia.sqlite');
const app = createApplication(db);
const accounts = [
  { name: 'Colectivo Xela', email: 'organizador@eventia.demo', role: 'organizer' },
  { name: 'Andrea López', email: 'andrea@eventia.demo', role: 'participant' },
  { name: 'Diego Méndez', email: 'diego@eventia.demo', role: 'participant' }
];
try {
  for (const account of accounts) {
    try { await app.users.register({ ...account, password: demoPassword }); }
    catch (error) { if (error.code !== 'EMAIL_EXISTS') throw error; }
  }
  const organizer = await app.users.login({ email: accounts[0].email, password: demoPassword });
  const examples = [
    ['Ideas que se convierten en código', 'Tecnología', 'Centro de innovación · Zona 3', 40, 7,
      'Una tarde para crear, compartir y conectar. Construye tu primera idea web junto a la comunidad tecnológica de Xela. No necesitas experiencia previa.'],
    ['Una ciudad, muchas historias', 'Arte y cultura', 'Casa de la Cultura · Centro histórico', 25, 10,
      'Descubre Quetzaltenango a través de sus relatos y su arquitectura. Un recorrido conversado con artistas y narradores locales.'],
    ['Encuentro de creadores locales', 'Comunidad', 'Parque Central · Quetzaltenango', 60, 14,
      'Conoce proyectos que están transformando nuestra ciudad. Comparte tu iniciativa, encuentra colaboradores y celebra las ideas locales.'],
    ['Pausa, respira, reconecta', 'Bienestar', 'Jardín Botánico · Zona 1', 18, 17,
      'Regálate una mañana de movimiento suave y respiración al aire libre. Trae ropa cómoda, agua y una esterilla si tienes.'],
    ['Sesiones acústicas al atardecer', 'Música', 'Patio del Centro · Zona 1', 30, 21,
      'Disfruta una selección de artistas independientes en un espacio cercano. Una tarde de música original y nuevas conexiones.'],
    ['Laboratorio de ideas: última plaza', 'Tecnología', 'Espacio Abierto · Zona 3', 1, 24,
      'Una sesión práctica para transformar una idea en un prototipo. Este evento tiene una sola plaza para demostrar el control de cupos del MVP.']
  ];
  for (const [title, category, location, capacity, days, description] of examples) {
    if (db.prepare('SELECT id FROM events WHERE title = ? AND organizer_id = ?').get(title, organizer.id)) continue;
    const date = new Date(); date.setUTCDate(date.getUTCDate() + days); date.setUTCHours(22, 0, 0, 0);
    app.events.publish(organizer, { title, category, location, capacity, description, starts_at: date.toISOString() });
  }
  console.log('Datos de demostración listos. No se borraron registros existentes.');
  console.log('Cuentas: organizador@eventia.demo, andrea@eventia.demo, diego@eventia.demo');
  console.log(`Contraseña de demostración: ${demoPassword}${process.env.DEMO_PASSWORD ? ' (DEMO_PASSWORD)' : ''}`);
} finally { db.close(); }
