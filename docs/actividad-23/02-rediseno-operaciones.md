# Rediseño de las siete operaciones

Cada operación redefine método, acceso, datos, validaciones, autorización, respuestas y errores. Las rutas en español del enunciado se mapean a las rutas reales de Eventia entre paréntesis.

---

## 1. Consulta de inscripción propia

**Endpoint:** `GET /api/inscripciones/{id}` (Eventia: listado propio `GET /api/registrations`; no se expone lectura por id ajeno)

**Función.** Devuelve una inscripción solo si el solicitante es el titular o el organizador del evento.

**Quién.** Usuario autenticado (titular) u organizador del evento asociado. Administrador si la política lo permite.

**Datos recibidos.** `id` en la ruta. Sin cuerpo.

**Validaciones.** `id` con formato esperado. Sesión válida.

**Autorización.** Tras cargar el recurso, `inscripcion.usuarioId === actor.id` **o** `evento.organizadorId === actor.id` **o** rol administrador. Si falla, `403` o `404` (sin filtrar existencia a terceros si la política es opaca).

**Respuesta esperada.** `200` con `{ id, eventoId, usuarioId, creadoEn }` sin campos ajenos innecesarios.

**Errores.** `401` sin autenticación. `403`/`404` sin permiso. `404` si no existe.

---

## 2. Registro de usuarios

**Endpoint:** `POST /api/usuarios` (Eventia: `POST /api/auth/register`)

**Función.** Crea una cuenta con rol por defecto seguro e inicia sesión.

**Quién.** Visitante (público).

**Datos recibidos.** `nombre`, `correo`, `password`. Opcional en MVP académico: `role` solo `participant` | `organizer`. Nunca `administrador` desde el cliente.

**Validaciones.** Nombre y correo con longitud y formato. Contraseña 8–128 caracteres. Rechazar propiedades desconocidas. Normalizar correo a minúsculas.

**Autorización.** Ningún caller anónimo puede fijar roles privilegiados. El servidor asigna el rol.

**Respuesta esperada.** `201` con perfil público `{ id, nombre, correo, rol }` y cookie de sesión. Sin `passwordHash`.

**Errores.** `400` datos inválidos. `409` correo ya registrado. `429` demasiados intentos.

---

## 3. Creación de eventos

**Endpoint:** `POST /api/eventos` (Eventia: `POST /api/events`)

**Función.** Publica un evento del organizador autenticado.

**Quién.** Organizador autenticado.

**Datos recibidos.** Ejemplo:

```json
{
  "titulo": "Concierto universitario",
  "cupo": 150,
  "precio": 75
}
```

En Eventia el equivalente usa `title`, `capacity`, y no modela precio (eventos gratuitos), más `description`, `category`, `location`, `starts_at`.

**Validaciones.** Título no vacío. Cupo entero positivo (Eventia: 1–10000). Precio ≥ 0 si aplica. Fecha futura. Categoría en lista blanca. Rechazar propiedades no permitidas.

**Autorización.** Sesión válida y `rol === organizador`. `organizadorId` se toma de la sesión, no del cuerpo.

**Respuesta esperada.** `201 Created` con el evento creado.

**Errores.** `400` datos inválidos. `401` sin autenticación. `403` sin rol organizador.

---

## 4. Modificación de eventos

**Endpoint:** `PUT /api/eventos/{id}` (Eventia: `PATCH /api/events/{id}`)

**Función.** Actualiza un evento propio.

**Quién.** Organizador autenticado **dueño** del recurso. Administrador solo si la política lo define de forma explícita.

**Datos recibidos.** Mismos campos que creación (parcial o completo según contrato).

**Validaciones.** Igual que creación. El cupo no puede ser menor que las plazas ya ocupadas.

**Autorización.** Rol organizador **y** `evento.organizadorId === actor.id`.

**Respuesta esperada.** `200` con el evento actualizado.

**Errores.** `400` inválido. `401` sin sesión. `403` evento ajeno o sin rol. `404` inexistente.

---

## 5. Inscripción a un evento

**Endpoint:** `POST /api/eventos/{id}/inscripciones` (Eventia: `POST /api/events/{id}/registrations`)

**Función.** Reserva plaza(s) para el usuario autenticado.

**Quién.** Usuario registrado autenticado.

**Datos recibidos.** `{ "cantidad": 1 }` (máximo permitido por política; Eventia solo admite `1`).

**Validaciones.** `cantidad` entero ≥ 1 y ≤ máximo (p. ej. 1). Evento existente y abierto. Usuario no inscrito aún si hay unicidad.

**Autorización.** Sesión válida. El `usuarioId` de la inscripción es el de la sesión, nunca el del cuerpo.

**Controles de cupo.** Transacción. Actualización condicional `occupied < capacity`. Rechazo si no hay cupo.

**Respuesta esperada.** `201` con la inscripción y confirmación interna.

**Errores.** `400` cantidad inválida. `401` sin sesión. `404` evento inexistente. `409` lleno, cerrado o duplicado.

---

## 6. Consulta de perfil de usuario

**Endpoint:** `GET /api/usuarios/{id}` (Eventia no expone este GET; el perfil propio va en `GET /api/auth/me`)

**Función.** Devuelve un perfil según el nivel de acceso.

**Quién.** Público: vista mínima si se permite. Propietario o administrador: vista ampliada sin secretos.

**Datos recibidos.** `id` en la ruta.

**Validaciones.** `id` válido.

**Autorización.** Campos según relación actor–recurso. Nunca incluir `passwordHash`.

**Respuesta esperada.** `200` con `{ id, nombre, correo }` (o menos en vista pública).

**Errores.** `401`/`403` según política. `404` si no existe.

---

## 7. Inicio de sesión

**Endpoint:** `POST /api/auth/login`

**Función.** Verifica credenciales e inicia sesión.

**Quién.** Visitante.

**Datos recibidos.** `{ "correo", "password" }`.

**Validaciones.** Tipos y longitudes. Rate limit por IP (y opcionalmente por correo).

**Autorización.** No aplica rol. Credenciales válidas.

**Controles.** Mensaje único de fallo. Hash dummy si el correo no existe. Cookie `HttpOnly` + `SameSite`.

**Respuesta esperada.** `200` con perfil público y cookie de sesión.

**Errores.** `401` credenciales incorrectas (mensaje genérico). `429` demasiados intentos. `400` cuerpo inválido.
