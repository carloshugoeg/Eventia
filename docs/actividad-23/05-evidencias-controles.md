# Evidencias de dos controles implementados

Controles tomados de la auditoría y aplicados en el proyecto Eventia. Las pruebas automatizadas viven en `tests/eventia.test.js`. Comando: `npm test`.

---

## Control 1. Ownership al modificar eventos (API 4 del caso)

### 1. Comportamiento anterior

No existía `PATCH`/`PUT` de eventos, o un diseño inseguro habría permitido a cualquier organizador autenticado alterar el evento `25` de otro.

### 2. Problema de seguridad identificado

Autorización por rol sin comprobar el dueño del recurso (OWASP API1 / A01 Broken Access Control). Un organizador podía modificar eventos ajenos.

### 3. Modificación realizada

- Ruta `PATCH /api/events/:id`.
- En `events.update`: exige organizador y `event.organizer_id === user.id`.
- El repositorio actualiza con `WHERE id = ? AND organizer_id = ?`.
- La UI solo muestra edición al dueño.

Archivos: `src/modules/events/service.js`, `src/modules/events/repository.js`, `src/http/server.js`, `public/app.js`.

### 4. Prueba con datos válidos

1. Inicia sesión como organizador A.
2. Publica un evento y anota su `id`.
3. `PATCH /api/events/{id}` con cuerpo válido (título nuevo, mismos demás campos).

**Resultado esperado y obtenido.** `200`. El título queda actualizado. Cubierto por `fase 3: solo el organizador dueño puede modificar su evento`.

### 5. Prueba con acceso no autorizado

1. Con organizador B (u otro usuario), `PATCH` al mismo `id` con cuerpo válido.

**Resultado esperado y obtenido.** `403` con código `FORBIDDEN`. Cubierto por `HTTP fase 3: PATCH ajeno, cantidad inválida y userId ajeno se rechazan`.

### 6. Resultado

Solo el dueño modifica. El rol organizador no implica permiso sobre eventos de otros.

---

## Control 2. Cantidad de inscripción y cupos (API 5 del caso)

### 1. Comportamiento anterior

El enunciado permite `cantidad: 500` sin tope y sin reserva concurrente segura, lo que habilita acaparamiento y sobrecupo.

### 2. Problema de seguridad identificado

Consumo ilimitado del flujo de inscripción y condición de carrera en el cupo (OWASP API4 / API6; integridad del cupo).

### 3. Modificación realizada

- `registrations.enroll` exige `quantity` entero ≥ 1 y, en esta versión, solo `1`.
- Valores `0`, negativos o `> 1` → `400 INVALID_QUANTITY`.
- `reservePlace` rechaza si `available < 1`.
- SQL condicional `occupied < capacity` dentro de transacción `BEGIN IMMEDIATE`.
- Prueba de concurrencia: 8 clientes, 3 plazas, solo 3 éxitos.

Archivos: `src/modules/registrations/service.js`, `src/modules/events/service.js`, `src/http/server.js`.

### 4. Prueba con datos válidos

1. Usuario autenticado.
2. `POST /api/events/{id}/registrations` con `{}` o `{ "quantity": 1 }` sobre un evento con cupo libre.

**Resultado esperado y obtenido.** `201`. Inscripción creada y `occupied` incrementa en 1.

### 5. Prueba con datos inválidos

1. Mismo endpoint con `{ "quantity": 0 }` (también `-1` o `2`).
2. Tercera inscripción cuando el cupo es 2.

**Resultado esperado y obtenido.** `400 INVALID_QUANTITY` para cantidad inválida. `409 EVENT_FULL` al superar el cupo. Cubierto por `fase 3: la cantidad de inscripción debe ser mayor que cero y no se permite sobrecupo`.

### 6. Resultado

El backend rechaza cantidades abusivas y mantiene el cupo bajo concurrencia.

---

## Cómo reproducir

```bash
npm test
```

Casos relevantes:

- `fase 3: solo el organizador dueño puede modificar su evento`
- `fase 3: la cantidad de inscripción debe ser mayor que cero y no se permite sobrecupo`
- `HTTP fase 3: PATCH ajeno, cantidad inválida y userId ajeno se rechazan`

Demostración manual con Thunder Client o Postman: servidor en `http://127.0.0.1:3000`, cookie de sesión tras login, mismas peticiones PATCH y POST anteriores.

Detalle adicional de Fase 3: [../fase-3-controles-seguridad.md](../fase-3-controles-seguridad.md).
