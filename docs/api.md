# API y contratos de Eventia

La interfaz y API comparten origen. Las respuestas son JSON. Los cuerpos de acciones deben usar `Content-Type: application/json`; el límite es 16 KiB. La sesión viaja en la cookie `eventia_session`, no en el almacenamiento del navegador.

## Rutas

| Método | Ruta | Acceso | Resultado |
|---|---|---|---|
| GET | `/api/health` | Público | Estado del servidor. |
| GET | `/api/auth/me` | Público | Usuario autenticado o `null`. |
| POST | `/api/auth/register` | Público | Crea cuenta e inicia sesión (201). |
| POST | `/api/auth/login` | Público | Verifica credenciales e inicia sesión (200). |
| POST | `/api/auth/logout` | Sesión si existe | Invalida sesión y elimina cookie. |
| GET | `/api/events?q=&category=&offset=0` | Público | Próximos eventos y total; páginas de 24. |
| GET | `/api/events/:id` | Público | Detalle y disponibilidad actual. |
| POST | `/api/events` | Organizador | Publica evento (201). |
| POST | `/api/events/:id/registrations` | Autenticado | Reserva plaza, inscripción y confirmación (201). |
| GET | `/api/registrations` | Autenticado | Inscripciones propias con detalle del evento. |
| GET | `/api/notifications` | Autenticado | Confirmaciones propias. |
| PATCH | `/api/notifications/:id/read` | Titular | Marca notificación como leída. |

Todas las acciones sin campos envían `{}`. No hay rutas de edición, eliminación o cancelación en esta fase.

## Cuerpos principales

Registro:

```json
{
  "name": "Nombre del usuario",
  "email": "persona@example.com",
  "password": "UnaClaveDe8OMasCaracteres",
  "role": "participant"
}
```

Los roles admitidos son `participant` y `organizer`; no existe un rol administrador. Cualquier persona puede elegir organizar al crear su cuenta. La contraseña admite de 8 a 128 caracteres.

Publicación:

```json
{
  "title": "Taller de ideas locales",
  "description": "Una tarde para compartir y construir proyectos en comunidad.",
  "category": "Tecnología",
  "location": "Centro de Xela",
  "starts_at": "2026-12-10T22:00:00.000Z",
  "capacity": 30
}
```

La fecha debe ser futura. El ejemplo equivale a las 16:00 en Guatemala. Las categorías admitidas son Tecnología, Arte y cultura, Comunidad, Bienestar y Música. El campo capacity es un número entero de 1 a 10,000.

## Errores

Formato: `{ "error": "Mensaje legible", "code": "CODIGO" }`.

| Estado | Casos |
|---|---|
| 400 | Validación, JSON incorrecto o categoría inválida. |
| 401 | Sesión ausente, vencida o credenciales incorrectas. |
| 403 | Rol insuficiente o solicitud desde un origen no permitido. |
| 404 | Ruta, evento o notificación inexistente/no perteneciente al titular. |
| 409 | Correo existente, inscripción duplicada, evento lleno o ya iniciado. |
| 413 / 415 | Cuerpo demasiado grande / tipo de contenido no admitido. |
| 429 | Más de 30 intentos de registro/inicio de sesión por IP por minuto. |
| 503 | Base ocupada después de agotar la espera de bloqueo. |
| 500 | Fallo interno, sin revelar detalles al cliente. |

## Contratos internos

Los servicios de módulos se exponen como objetos desde `createApplication(db)` en `src/app.js`. Las dependencias son explícitas, sin HTTP entre módulos:

- Usuarios: `register`, `login`, `startSession`, `authenticate`, `logout`, `ensureExists`.
- Eventos: `list`, `get`, `publish`, `reservePlace`.
- Inscripciones: `enroll`, `list`.
- Notificaciones: `confirmRegistration`, `list`, `markRead`.

`reservePlace` y `confirmRegistration` son operaciones internas del flujo coordinado por Inscripciones. No se exponen como acciones HTTP independientes. La unidad de trabajo comparte la conexión entre repositorios; sus operaciones son síncronas y no contienen llamadas de red.
