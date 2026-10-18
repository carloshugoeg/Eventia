#!/usr/bin/env node
/**
 * Verifies Actividad 23 deliverable files exist and contain required markers.
 * Exit 0 on pass, 1 on fail.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const base = join(root, 'docs', 'actividad-23');

const checks = [
  {
    file: '01-auditoria-apis.md',
    mustInclude: ['API 1', 'API 2', 'API 3', 'API 4', 'API 5', 'API 6', 'API 7', 'OWASP']
  },
  {
    file: '02-rediseno-operaciones.md',
    mustInclude: ['Endpoint:', 'Autorización', '401', '403']
  },
  {
    file: '03-matriz-permisos.md',
    mustInclude: ['Visitante', 'Organizador', 'Administrador', 'ownership']
  },
  {
    file: 'openapi.yaml',
    mustInclude: ['openapi:', '/api/events/{id}', '/api/events/{id}/registrations', '/api/registrations', 'sessionCookie']
  },
  {
    file: '05-evidencias-controles.md',
    mustInclude: [
      'Comportamiento anterior',
      'Problema de seguridad identificado',
      'Modificación realizada',
      'Prueba con datos válidos',
      'Prueba con',
      'Resultado'
    ]
  },
  {
    file: '06-preguntas-finales.md',
    mustInclude: ['JWT', 'validar', 'autorizar', 'OpenAPI', 'servicios independientes']
  },
  {
    file: 'README.md',
    mustInclude: ['github.com/carloshugoeg/Eventia']
  }
];

let failed = 0;
for (const check of checks) {
  const path = join(base, check.file);
  if (!existsSync(path)) {
    console.error(`MISSING ${check.file}`);
    failed += 1;
    continue;
  }
  const text = readFileSync(path, 'utf8');
  const missing = check.mustInclude.filter(marker => !text.includes(marker));
  if (missing.length) {
    console.error(`INCOMPLETE ${check.file}: missing ${missing.join(', ')}`);
    failed += 1;
  } else {
    console.log(`OK ${check.file}`);
  }
}

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log('\nActividad 23 package verification passed');
