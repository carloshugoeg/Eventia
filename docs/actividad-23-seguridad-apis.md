# Actividad 23 — Eventia: de una API insegura a un diseño seguro

**Curso:** Programación Web · Universidad Rafael Landívar  
**Repositorio:** https://github.com/carloshugoeg/Eventia  

---

## 1. Auditoría de las siete APIs

Referencia: [OWASP API Security Top 10](https://owasp.org/API-Security/).

| API | Problema identificado | Riesgo OWASP API | Solución propuesta |
|---|---|---|---|
| **API 1** `GET /api/inscripciones/125` | Solo verifica que la inscripción exista; no comprueba que pertenezca al solicitante (IDOR). | **API1 Broken Object Level Authorization** | Exigir autenticación y `inscripcion.usuarioId === usuario.id` (o rol admin). Responder 403/404 sin filtrar datos ajenos. |
| **API 2** `POST /api/usuarios` | Mass assignment: el cliente envía `rol: administrador` y el backend lo persiste. | **API3 Broken Object Property Level Authorization** (también API5 Broken Function Level Authorization) | Lista blanca de campos; asignar rol por defecto (`usuario`/`participant`); rechazar `administrador` desde el cliente. |
| **API 3** `POST /api/eventos` | Cupo/precio negativos sin validar; cualquier autenticado puede crear eventos. | **API4 Unrestricted Resource Consumption** / diseño inseguro; **API5 Broken Function Level Authorization** | Validar cupo > 0, precio ≥ 0; exigir rol organizador; rechazar propiedades no permitidas. |
| **API 4** `PUT /api/eventos/25` | Comprueba rol organizador pero no ownership del recurso. | **API1 Broken Object Level Authorization** | Verificar `evento.organizadorId === usuario.id` además del rol. |
| **API 5** `POST /api/eventos/25/inscripciones` | Sin tope de cantidad por usuario; sin control seguro de cupos concurrentes. | **API4 Unrestricted Resource Consumption**; integridad / diseño inseguro | Limitar `cantidad` (p. ej. 1); reserva atómica/condicional del cupo en transacción. |
| **API 6** `GET /api/usuarios/35` | Expone `passwordHash`, teléfono y rol aunque el front solo usa nombre/correo. | **API3 Broken Object Property Level Authorization** | DTO público sin secretos; campos sensibles solo para el titular o admin. |
| **API 7** `POST /api/auth/login` | Intentos ilimitados; mensajes distintos revelan si el correo existe. | **API2 Broken Authentication**; **API8 Security Misconfiguration** (mensajes) | Rate limiting; mensaje genérico («Correo o contraseña incorrectos»); hashing con tiempo comparable. |

### Consecuencias (resumen)

1. **API 1:** filtración de PII (nombre, correo) de otros inscritos.  
2. **API 2:** elevación de privilegios a administrador.  
3. **API 3:** inventario corrupto, eventos imposibles, spam de publicaciones.  
4. **API 4:** sabotaje o alteración de eventos de otros organizadores.  
5. **API 5:** acaparamiento de cupos y sobrecupo bajo concurrencia.  
6. **API 6:** fuga de hashes (reutilización offline) y datos personales.  
7. **API 7:** fuerza bruta y enumeración de cuentas.

---

## 2. Rediseño de las siete operaciones

Las rutas del MVP Eventia usan inglés (`/api/events`, `/api/registrations`, …). El rediseño conserva la intención de cada API del enunciado.

### API 1 — Consulta de inscripción

| Campo | Definición |
|---|---|
| Método / ruta | `GET /api/registrations` (listado propio) o, si se expone detalle, `GET /api/registrations/{id}` |
| Función | Devolver inscripciones del usuario autenticado |
| Quién | Usuario registrado (titular) |
| Datos | Path/query opcional; sin `userId` ajeno |
| Validaciones | Sesión válida; UUID bien formado si hay id |
| Autorización | Solo recursos con `user_id === sesión.id` |
| Respuesta 200 | Lista o detalle sin datos de terceros |
| Errores | 401, 403 (si pide ajeno), 404 |

### API 2 — Registro de usuarios

| Campo | Definición |
|---|---|
| Método / ruta | `POST /api/auth/register` |
| Función | Crear cuenta e iniciar sesión |
| Quién | Visitante |
| Datos | `name`, `email`, `password`, `role` opcional ∈ {`participant`,`organizer`} |
| Validaciones | Correo válido; contraseña 8–128; rol en lista blanca; **nunca** `administrador` |
| Autorización | Público; no eleva a admin |
| Respuesta 201 | Usuario público (`id`, `name`, `email`, `role`) + cookie de sesión |
| Errores | 400, 409 (correo existente), 429 |

### API 3 — Creación de eventos

| Campo | Definición |
|---|---|
| Método / ruta | `POST /api/events` |
| Función | Publicar evento |
| Quién | Organizador autenticado |
| Datos | `title`, `description`, `category`, `location`, `starts_at`, `capacity` |
| Validaciones | Título no vacío; cupo entero 1–10000; fecha futura; categoría en lista |
| Autorización | `requireOrganizer` |
| Respuesta 201 | Evento creado |
| Errores | 400, 401, 403 |

### API 4 — Modificación de eventos

| Campo | Definición |
|---|---|
| Método / ruta | `PATCH /api/events/{id}` |
| Función | Actualizar evento propio |
| Quién | Organizador dueño |
| Datos | Mismos campos que creación |
| Validaciones | Igual que creación; cupo ≥ ocupados |
| Autorización | Rol organizador **y** `organizer_id === user.id` |
| Respuesta 200 | Evento actualizado |
| Errores | 400, 401, 403, 404 |

### API 5 — Inscripciones

| Campo | Definición |
|---|---|
| Método / ruta | `POST /api/events/{id}/registrations` |
| Función | Reservar plaza |
| Quién | Usuario autenticado |
| Datos | `quantity` opcional (solo `1`) |
| Validaciones | `quantity` entero ≥ 1 y = 1; evento futuro; cupo disponible |
| Autorización | Sesión válida; una inscripción por usuario/evento |
| Controles | Transacción + `UPDATE … WHERE occupied < capacity` |
| Respuesta 201 | Inscripción + notificación + evento |
| Errores | 400, 401, 409 |

### API 6 — Consulta de usuarios

| Campo | Definición |
|---|---|
| Método / ruta | `GET /api/auth/me` (perfil propio) |
| Función | Datos públicos del usuario autenticado |
| Quién | Usuario autenticado (o `null` si visitante) |
| Datos | Ninguno en cuerpo |
| Validaciones | Cookie de sesión |
| Autorización | Solo el titular ve su perfil; **nunca** `password_hash` |
| Respuesta 200 | `{ user: { id, name, email, role } \| null }` |
| Errores | — |

### API 7 — Inicio de sesión

| Campo | Definición |
|---|---|
| Método / ruta | `POST /api/auth/login` |
| Función | Autenticar y emitir sesión |
| Quién | Visitante |
| Datos | `email`, `password` |
| Validaciones | Formato de correo; longitud de contraseña |
| Controles | Rate limit (30/IP/min); mensaje genérico; scrypt + timingSafeEqual |
| Respuesta 200 | Usuario público + cookie |
| Errores | 400, 401 genérico, 429 |

---

## 3. Matriz de roles y permisos

| Operación | Visitante | Usuario registrado | Organizador | Administrador* |
|---|---|---|---|---|
| 1. Consultar eventos públicos | Permitido | Permitido | Permitido | Permitido |
| 2. Crear eventos | Denegado | Denegado | Permitido | Permitido |
| 3. Modificar eventos propios | Denegado | Denegado | Permitido **si** `organizer_id` coincide | Permitido |
| 4. Modificar eventos ajenos | Denegado | Denegado | **Denegado** (rol ≠ ownership) | Permitido |
| 5. Inscribirse en eventos | Denegado | Permitido | Permitido | Permitido |
| 6. Consultar inscripciones propias | Denegado | Permitido (solo las suyas) | Permitido (solo las suyas) | Permitido |
| 7. Consultar inscritos de un evento como organizador | Denegado | Denegado | Permitido **si** es dueño del evento | Permitido |
| 8. Administrar usuarios | Denegado | Denegado | Denegado | Permitido |

\*En el MVP actual no existe rol `administrador` en runtime; la columna define la política objetivo. Tener rol organizador **no** autoriza operar sobre recursos ajenos.

---

## 4. Documentación OpenAPI

Archivo: [`docs/openapi-actividad-23.yaml`](openapi-actividad-23.yaml)

Endpoints documentados:

1. `POST /api/events` — publicación (organizador).  
2. `PATCH /api/events/{eventId}` — edición con ownership.  
3. `POST /api/events/{eventId}/registrations` — inscripción con validación de cantidad y cupos.

Cada operación incluye descripción, cuerpo/parámetros, esquemas, códigos HTTP y `security: sessionCookie`.

---

## 5. Controles implementados y evidencias

### Control A — Ownership en modificación de eventos (API 4)

| Elemento | Detalle |
|---|---|
| Comportamiento anterior | Riesgo: organizador podía alterar eventos ajenos si solo se validaba el rol. |
| Problema | API1 Broken Object Level Authorization |
| Modificación | `PATCH /api/events/:id` exige `event.organizer_id === user.id` |
| Prueba válida | Dueño → `200` y título actualizado |
| Prueba inválida | Otro organizador / participante → `403 FORBIDDEN` |
| Resultado | Cubierto por tests `fase 3: solo el organizador dueño…` y `HTTP fase 3: PATCH ajeno…` |

### Control B — Cantidad de inscripción y anti-sobrecupo (API 5)

| Elemento | Detalle |
|---|---|
| Comportamiento anterior | Riesgo: `cantidad` arbitraria y carrera de cupos. |
| Problema | API4 Unrestricted Resource Consumption / diseño inseguro |
| Modificación | `quantity` debe ser entero ≥ 1 y solo `1`; reserva SQL condicional |
| Prueba válida | `quantity: 1` o omitido → `201` |
| Prueba inválida | `0`, `-1`, `2` → `400 INVALID_QUANTITY`; cupo agotado → `409` |
| Resultado | Tests `fase 3: la cantidad…` y concurrencia 8 vs 3 cupos |

Evidencia automatizada: `docs/evidencia/actividad-23-pruebas.txt` (`npm test` → 19/19 pass).

---

## 6. Enlace al repositorio

**https://github.com/carloshugoeg/Eventia**

---

## 7. Preguntas finales

1. **¿Cuál de las siete APIs representa el mayor riesgo?**  
   La **API 2 (registro con asignación de rol)** es el mayor riesgo sistémico: un atacante se convierte en administrador y luego abusa de todas las demás operaciones. La API 1 y la 6 también son graves por fuga de PII/hashes, pero la elevación de privilegios compromete el control de toda la plataforma.

2. **¿Por qué JWT no garantiza que una API esté protegida?**  
   JWT solo prueba identidad/firma (autenticación). Sin autorización por recurso (ownership), validación de entrada, rate limiting y diseño de permisos, un token válido sigue pudiendo leer o modificar objetos ajenos.

3. **¿Diferencia entre validar datos y autorizar?**  
   Validar comprueba forma y reglas de negocio del payload (cupo > 0). Autorizar decide si **ese** sujeto puede ejecutar la acción sobre **ese** recurso (¿es el dueño?).

4. **¿Por qué documentar autenticación en OpenAPI no implementa seguridad?**  
   OpenAPI es contrato/documentación. Los controles reales viven en el código (middleware, servicios, SQL). Un esquema con `security` no rechaza por sí solo una petición.

5. **¿Qué controles mantener al pasar a servicios independientes?**  
   Autenticación centralizada (o tokens cortos), autorización en cada servicio (nunca confiar solo en el gateway), validación en cada borde, rate limiting, auditoría, secretos fuera del código, TLS, y políticas de least privilege entre servicios (mTLS / identidades de servicio).
