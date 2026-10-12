# Fase 3: Implementación de controles de seguridad

A partir de la [auditoría de Fase 2](auditoria-seguridad-fase-2.md), se implementaron controles reales en Eventia. Cada mejora rechaza una operación inválida o no autorizada y cuenta con prueba automatizada.

## Controles implementados

### Control 1 — Solo el organizador dueño puede modificar su evento

| Elemento | Descripción |
|---|---|
| **Problema identificado** | No existía una vía de edición, pero al agregar modificación sin comprobar el dueño cualquier organizador (u otro rol mal validado) podría alterar eventos ajenos: cambio de cupo, lugar o título con impacto en inscripciones ya hechas. |
| **Riesgo OWASP relacionado** | **A01 Broken Access Control** (falta de autorización por recurso / IDOR sobre eventos). |
| **Corrección aplicada** | Se agregó `PATCH /api/events/:id` y `events.update`. El backend exige sesión de organizador **y** `event.organizer_id === user.id`. Si no coincide, responde `403 FORBIDDEN`. Además, el cupo no puede bajar por debajo de `occupied`. En la UI, «Editar mi evento» solo aparece al organizador dueño. |
| **Prueba realizada** | `npm test` → `fase 3: solo el organizador dueño puede modificar su evento` y `HTTP fase 3: PATCH ajeno…`. Un participante y otro organizador intentan `PATCH`; el dueño sí puede actualizar el título. |
| **Resultado** | Los intentos ajenos reciben `403` con código `FORBIDDEN`. El dueño obtiene `200` y el título queda actualizado. |

**Archivos clave:** `src/modules/events/service.js`, `src/modules/events/repository.js`, `src/http/server.js`, `public/app.js`.

---

### Control 2 — Cantidad de inscripción > 0 e impedir sobrecupo

| Elemento | Descripción |
|---|---|
| **Problema identificado** | Una inscripción con `quantity` 0, negativa o mayor que 1 podría romper la regla de negocio («un lugar por persona») o intentarse abusar para reservar en bloque. Sin validación explícita, el cuerpo JSON podía pasar valores absurdos. El sobrecupo ya se combatía en SQL; se reforzó la comprobación de disponibilidad en el servicio. |
| **Riesgo OWASP relacionado** | **A04 Insecure Design** (reglas de negocio incompletas) y, en carrera de cupos, integridad del recurso (**A01** sobre el cupo como recurso limitado). |
| **Corrección aplicada** | `registrations.enroll` exige `quantity` entero **≥ 1** (por defecto `1`) y, en esta versión, solo admite `1`. Valores `0`, negativos o `> 1` → `400 INVALID_QUANTITY`. `reservePlace` rechaza si `available < 1` y la actualización SQL sigue siendo condicional (`occupied < capacity`). |
| **Prueba realizada** | `npm test` → `fase 3: la cantidad de inscripción debe ser mayor que cero y no se permite sobrecupo` y el caso HTTP con `{ "quantity": 0 }`. |
| **Resultado** | `quantity: 0` / `-1` / `2` se rechazan con `400`. Con cupo 2, la tercera inscripción recibe `409 EVENT_FULL` y `occupied` permanece en 2. |

**Archivos clave:** `src/modules/registrations/service.js`, `src/modules/events/service.js`, `src/http/server.js`.

---

### Control adicional — Inscripciones privadas (rechazo de `userId` ajeno)

| Elemento | Descripción |
|---|---|
| **Problema identificado** | Aunque el listado ya filtraba por la sesión, un cliente podría intentar `GET /api/registrations?userId=<otro>` esperando leer datos ajenos. |
| **Riesgo OWASP relacionado** | **A01 Broken Access Control** (IDOR / consulta de datos privados). |
| **Corrección aplicada** | Si llega `userId` y no coincide con el usuario autenticado → `403 FORBIDDEN` («No puedes consultar las inscripciones de otro usuario»). |
| **Prueba realizada** | `fase 3: no se pueden consultar inscripciones privadas…` y el caso HTTP con `?userId=` de otro usuario. |
| **Resultado** | La API responde `403` y no filtra el listado por el identificador pedido. |

---

### Mejora operativa — Credenciales de demo por variable de entorno

La contraseña de `npm run seed` se lee de `DEMO_PASSWORD` (ver `.env.example`). No sustituye a los dos controles anteriores; reduce secretos fijos en el flujo de demostración.

---

## Cómo demostrar los rechazos

```powershell
npm.cmd test
```

Pruebas relevantes:

- `fase 3: solo el organizador dueño puede modificar su evento`
- `fase 3: la cantidad de inscripción debe ser mayor que cero y no se permite sobrecupo`
- `fase 3: no se pueden consultar inscripciones privadas de otro usuario`
- `HTTP fase 3: PATCH ajeno, cantidad inválida y userId ajeno se rechazan`

Demostración manual rápida (servidor en `http://localhost:3000`):

1. Inicia sesión como organizador A, publica un evento, copia su id.
2. Cierra sesión, entra como otro usuario (organizador B o participante).
3. `PATCH /api/events/<id>` con un cuerpo válido → debe fallar con **403**.
4. Como participante, `POST /api/events/<id>/registrations` con `{ "quantity": 0 }` → **400**.
5. `GET /api/registrations?userId=<id-de-otro>` → **403**.

---

## Archivos modificados en esta fase

| Archivo | Cambio |
|---|---|
| `src/modules/events/service.js` | `update` con ownership; validación de cupo vs ocupados; chequeo `available` |
| `src/modules/events/repository.js` | `UPDATE` condicionado a `id` + `organizer_id` |
| `src/modules/registrations/service.js` | Validación de `quantity`; rechazo de `userId` ajeno en `list` |
| `src/http/server.js` | Ruta `PATCH /api/events/:id`; pasa body a enroll y `userId` a list |
| `public/app.js` | Edición de evento propio en la UI |
| `scripts/seed.js` / `.env.example` | `DEMO_PASSWORD` |
| `tests/eventia.test.js` | Pruebas de rechazo Fase 3 |
| `docs/api.md` | Contrato actualizado |
| `docs/fase-3-controles-seguridad.md` | Este documento |
