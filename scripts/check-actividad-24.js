#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const base = join(root, 'docs', 'actividad-24');

let failed = 0;

function fail(message) {
  console.error(message);
  failed += 1;
}

const checks = [
  {
    file: '01-mecanismo-autenticacion.md',
    mustInclude: ['JWT', 'OpenID Connect', 'eventia_session']
  },
  {
    file: '02-diagrama-flujo.md',
    mustInclude: ['sequenceDiagram', '401', 'expires_at']
  },
  {
    file: '03-matriz-permisos.md',
    mustInclude: ['Visitante', 'Organizador', 'Administrador', 'ownership']
  },
  {
    file: '04-situaciones-acceso.md',
    mustInclude: ['Situación A', 'Situación B', 'Situación C', 'Situación D', 'RBAC', 'ABAC', 'ReBAC']
  },
  {
    file: '05-controles-implementados.md',
    mustInclude: ['organizer_id', 'src/modules/registrations/service.js', 'github.com/carloshugoeg/Eventia']
  },
  {
    file: '06-evidencias-pruebas.md',
    mustInclude: ['Prueba 1', 'Prueba 6', '401', '403', 'evidencias/prueba-1.txt']
  },
  {
    file: 'README.md',
    mustInclude: ['github.com/carloshugoeg/Eventia', 'capturar.sh']
  }
];

for (const check of checks) {
  const path = join(base, check.file);
  if (!existsSync(path)) {
    fail(`MISSING ${check.file}`);
    continue;
  }
  const text = readFileSync(path, 'utf8');
  const missing = check.mustInclude.filter(marker => !text.includes(marker));
  if (missing.length) fail(`INCOMPLETE ${check.file}: missing ${missing.join(', ')}`);
  else console.log(`OK ${check.file}`);
}

const transcripts = [
  ['prueba-1.txt', 'HTTP/1.1 401'],
  ['prueba-2.txt', 'HTTP/1.1 200'],
  ['prueba-3.txt', 'HTTP/1.1 200'],
  ['prueba-4.txt', 'HTTP/1.1 403'],
  ['prueba-5.txt', 'HTTP/1.1 403'],
  ['prueba-6.txt', 'HTTP/1.1 401'],
  ['prueba-6-token-invalido.txt', 'HTTP/1.1 401'],
  ['situacion-d.txt', 'HTTP/1.1 409'],
  ['situacion-d-ajeno.txt', 'HTTP/1.1 403']
];
for (const [name, marker] of transcripts) {
  const path = join(base, 'evidencias', name);
  if (!existsSync(path)) {
    fail(`MISSING evidencias/${name}`);
    continue;
  }
  const text = readFileSync(path, 'utf8');
  if (!text.includes(marker)) fail(`INCOMPLETE evidencias/${name}: missing ${marker}`);
  else console.log(`OK evidencias/${name}`);
}

const situations = existsSync(join(base, '04-situaciones-acceso.md'))
  ? readFileSync(join(base, '04-situaciones-acceso.md'), 'utf8')
  : '';
if (situations.includes('no implementado')) {
  fail('04-situaciones-acceso.md marca una situación como no implementado');
}

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log('\nActividad 24 package verification passed');
