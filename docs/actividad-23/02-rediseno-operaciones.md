# Rediseño de las siete operaciones

Cada operación redefine método, acceso, datos, validaciones, autorización, respuestas y errores. Las rutas en español del enunciado se mapean a las rutas reales de Eventia entre paréntesis.

---

## 1. Consulta de inscripción propia

**Endpoint (caso):** `GET /api/inscripciones/{id}`  
**Eventia implementado:** `GET /api/registrations` (solo filas del caller). No hay `GET` por id de inscripción ajena. Un organizador consulta inscritos de su evento en una operación distinta (entregable de matriz, operación 7), no en este listado.

**Función.** Devuelve las inscripciones del usuario autenticado.

**Quién.** Usuario registrado autenticado (titular). Administrador solo con política explícita fuera del MVP.

**Datos recibidos.** Sin cuerpo. Query opcional `userId` solo si coincide con la sesión.

**Validaciones.** Sesión válida.

**Autorización.** El listado filtra por `actor.id`. Si `userId` es de otro usuario, `403`.

**Respuesta esperada.** `200` con `{ registrations: [...] }`, cada ítem con el `event` anidado. Sin datos de otros usuarios.

**Errores.** `401` sin autenticación. `403` si se pide `userId` ajeno.

---

## 2. Registro de usuarios

**Endpoint:** `POST /api/usuarios` (Eventia: `POST /api/auth/register`)

**Función.** Crea una cuenta con rol por defecto seguro e inicia sesión.

**Quién.** Visitante (público).

**Datos recibidos.** `nombre`, `correo`, `password`.

**Validaciones.** Nombre y correo con longitud y formato. Contraseña 8–128 caracteres. Rechazar propiedades desconocidas. Normalizar correo a minúsculas. Ignorar cualquier `rol`/`role`/`administrador` enviado por el cliente.

**Autorización.** El servidor asigna siempre el rol por defecto (`usuario` / `participant`). Promover a organizador o administrador es una operación de administración (matriz, operación 8), no del registro público.

**Nota sobre Eventia actual.** El MVP aún acepta `role: participant | organizer` en el registro. Eso queda como deuda respecto al rediseño ideal de la API 2. No acepta `administrador`.

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
