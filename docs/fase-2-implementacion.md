# Eventia fase 2, implementación local

Esta guía dice qué de la arquitectura a cinco años quedó en el código, y cómo ejecutarlo en una máquina sin credenciales.

## Cómo ejecutarlo

Requisito: Node.js 24.13 o una versión posterior de la rama 24. No hace falta `npm install`.

En una terminal:

```powershell
npm.cmd run seed
npm.cmd start
```

En otra terminal, desde la misma carpeta:

```powershell
npm.cmd run worker
```

Abre http://localhost:3000. Entra como `organizador@eventia.demo` con la contraseña `Eventia2026!`. La sección **Reportes** lista los eventos del organizador. Inscribe a Andrea o a Diego en un evento. Cuando el worker haya leído la bandeja, la notificación aparece en **Notificaciones** y el reporte suma una inscripción.

`GET /api/health` responde `status`, `database`, `search` y `outbox.pending`.

Las variables opcionales están en `.env.example`. Copia ese archivo a `.env` solo si quieres cambiar el puerto, la ruta de la base, la caché o los límites.

## Qué se conservó

Usuarios, Eventos e Inscripciones siguen en un proceso. La reserva sigue siendo una transacción con `BEGIN IMMEDIATE` y el `UPDATE` condicional `occupied < capacity`. El `UNIQUE (user_id, event_id)` sigue impidiendo el duplicado. Los módulos no escriben las tablas de otro módulo. Las contraseñas siguen con scrypt y la cookie sigue siendo `HttpOnly` y `SameSite=Strict`.

## Qué se modificó

La inscripción acepta el encabezado `Idempotency-Key`. La misma clave, la misma cuenta y el mismo evento devuelven la inscripción ya creada y no ocupan otra plaza. La misma clave en otro evento responde 409 con código `IDEMPOTENCY_CONFLICT`.

Cada `POST` de inscripción cuenta para un límite por cuenta y otro por IP. El valor de arranque es 20 solicitudes por minuto. Al pasarlo, la API responde 429 con `Retry-After` y código `RATE_LIMITED`.

Hay un contador de inscripciones en curso. Con `ADMISSION_LIMIT=0` cada `POST` de inscripción responde 429, código `WAITING_ROOM`, y encabezado `Retry-After`. Ese caso está probado. Un límite de 1 o más no rechaza todavía una segunda solicitud que llega mientras la primera sigue dentro del manejador. La reserva es síncrona, así que la segunda entra cuando la primera ya soltó el contador. Ese solapamiento queda pendiente.

El catálogo y el detalle usan una caché en memoria. `CATALOG_CACHE_TTL_MS` vale 2000 en el servidor. Publicar o reservar vacía la caché. Los tests arrancan con la caché apagada para que un `UPDATE` directo en SQL no se quede oculto.

La búsqueda crea una tabla FTS5 cuando el motor la incluye. Una consulta de letras y números usa ese índice. Una consulta con símbolos, como `%` o `_`, se queda en `LIKE` para tratar esos caracteres como texto. Si el error es `no such module`, el arranque usa `LIKE`. Cualquier otro error de esa tabla detiene el arranque. El índice `(category, starts_at)` cubre la fecha y la categoría. En Node 24.21.0 el motor activo es `fts5`. En el Node 22.14.0 de esta máquina el módulo no existe y el motor es `like`. Los 27 tests pasaron en los dos. `/api/health` publica el motor en el campo `search`.

La sesión pasa por `createSqliteSessionStore` en `src/infrastructure/session-store.js`. El servicio de usuarios llama `put`, `get` y `delete`. La tabla `sessions` sigue siendo la implementación local.

La configuración de puerto, base, cookie, caché, límites y bandeja sale de variables de entorno en `loadConfig`.

## Qué se separó

La transacción de inscripción inserta la fila de `registrations`, actualiza el cupo y inserta un evento `registration.confirmed` en `outbox`. No inserta la notificación. Si esa anotación falla, la transacción revierte inscripción y cupo.

`scripts/notifications-worker.js` es otro proceso. Lee la bandeja, crea la notificación y actualiza el modelo de reportes. Si el manejador falla, la fila sigue `pending`, `attempts` sube y `next_attempt_at` se aleja el doble del intervalo anterior. Tras `OUTBOX_MAX_ATTEMPTS` la fila pasa a `dead` y la inscripción no se revierte. Volver a procesar una fila ya entregada no crea otra notificación ni suma otra inscripción. La notificación tiene `UNIQUE (registration_id)`. El reporte guarda el `outbox_id` en `report_applied` antes de incrementar.

Publicar un evento anota `event.published` en la misma transacción que el `INSERT`. El worker crea la fila del reporte con cero inscripciones.

Los reportes no consultan `registrations` para armar la estadística. Leen `report_events` y `report_registrations_by_day`. `GET /api/reports` exige organizador y devuelve solo sus eventos, con `registrations`, `occupancy_pct` y `timeline`.

En la arquitectura de cinco años, notificaciones y reportes serían servicios con cola y bases propias. Aquí los dos manejadores viven en un worker y en la misma base, porque no hay un broker que se pueda levantar sin credenciales. El contrato que los separa del núcleo es la fila de la bandeja, no una llamada en el proceso de la reserva.

## Qué quedó como escala local

Varias instancias del monolito, PostgreSQL, réplicas, Redis y un broker no están en este código. No hay una migración a PostgreSQL porque este entorno no puede probarla.

Para llevarlo después, sin cambiar las reglas de cupos:

- PostgreSQL reemplaza `node:sqlite` dentro de `openDatabase`, los repositorios y `unitOfWork`. Los servicios no conocen el motor. El `UPDATE` condicional se conserva.
- Redis, u otro almacén con expiración, implementa `put`, `get` y `delete` del almacén de sesiones. El hash del token y la caducidad no cambian.
- El límite de inscripciones y la sala de espera salen del `Map` del proceso y pasan a ese mismo almacén compartido. Si no, cada instancia contaría por su lado.
- La caché del catálogo puede pasar a un caché compartido. La invalidación al publicar y al reservar se mantiene.
- Hoy un solo worker despacha según el campo `type`. Dos procesos distintos tendrían que reclamar tipos distintos. Esa selección no está hecha, porque aquí no hay una segunda cola que probar.

## Pendiente

- Rechazar dos inscripciones simultáneas cuando `ADMISSION_LIMIT` es 1 o mayor. Hoy solo el valor 0 responde 429 de sala de espera.
- Reclamar la bandeja por `type`, para que un worker de notificaciones y otro de reportes no se quiten eventos.
- Cola real, correo, push, SMS, CDN, PostgreSQL, Redis y varias instancias. La sección anterior dice dónde enchufarlos.

## Qué no incluye

No hay correo, push ni SMS. La notificación sigue siendo una fila interna. No hay cancelaciones, pagos ni edición de eventos. No hay CDN. La sala de espera no ordena personas en una cola persistente. Devuelve 429 para que el cliente reintente.
