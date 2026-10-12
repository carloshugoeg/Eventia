# Auditoría de seguridad de Eventia — Fase 2

**Curso:** Programación Web · Universidad Rafael Landívar  
**Plataforma auditada:** Eventia (MVP local, monolito modular Node.js + SQLite)  
**Alcance:** revisión estática del código en `src/`, `public/`, `database/`, `scripts/` y pruebas en `tests/`, alineada con la Fase 2 de la actividad *Eventia: seguridad en aplicaciones web*.  
**Fecha de revisión:** octubre 2026  
**Método:** inspección de código, contratos de API, esquema SQL y casos de prueba existentes. No se ejecutó un pentest externo ni un despliegue público.

---

## 1. Resumen ejecutivo

Eventia ya incorpora controles sólidos para un MVP académico local: hashing con `scrypt`, sesiones por cookie `HttpOnly`/`SameSite=Strict`, consultas parametrizadas, validación en backend, control de cupos concurrente, privacidad de inscripciones/notificaciones, cabeceras HTTP defensivas y **cero dependencias npm**.

Los riesgos más relevantes no son fallos de lógica interna “rotos”, sino **condiciones de despliegue y diseño**:

| Severidad | Hallazgo |
|---|---|
| Alta (si se expone a red) | Tráfico HTTP en claro: susceptible a *man-in-the-middle* (credenciales y cookie de sesión). |
| Media | Cualquier persona puede registrarse como organizador (`role` libre al crear cuenta). |
| Media | Política de contraseñas limitada a longitud (8–128); sin complejidad ni MFA. |
| Baja | Contraseña de demostración documentada y fijada en `seed`. |
| Baja | Registro limitado de seguridad (casi solo `console.error`). |
| Informativa | No existen rutas de edición/eliminación de eventos; la pregunta de “modificar el evento de otro” no aplica aún. |

**Veredicto:** adecuado y razonablemente endurecido para uso **local en `127.0.0.1`**. No debe publicarse en Internet sin HTTPS, cookie `Secure`, origen configurado y revisión de roles.

---

## 2. Superficie de ataque y entry points

### 2.1 Entry points HTTP

| Entry point | Método | Autenticación | Riesgo principal |
|---|---|---|---|
| `/`, `/app.js`, `/styles.css`, `/favicon.svg` | GET | Público | XSS almacenado/reflejado si el front no escapa datos |
| `/api/health` | GET | Público | Reconocimiento |
| `/api/auth/register` | POST | Público | Fuerza bruta, cuentas masivas, elevación a organizador |
| `/api/auth/login` | POST | Público | Fuerza bruta, *credential stuffing* |
| `/api/auth/logout` | POST | Cookie opcional | Invalidación de sesión |
| `/api/auth/me` | GET | Cookie opcional | Enumeración de estado de sesión |
| `/api/events` | GET | Público | Inyección en búsqueda; *scraping* |
| `/api/events` | POST | Organizador | Publicación abusiva / spam |
| `/api/events/:id` | GET | Público | Enumeración de IDs |
| `/api/events/:id/registrations` | POST | Autenticado | Sobrecupo, inscripción no autorizada |
| `/api/registrations` | GET | Autenticado | IDOR / fuga de inscripciones ajenas |
| `/api/notifications` | GET | Autenticado | IDOR / fuga de notificaciones |
| `/api/notifications/:id/read` | PATCH | Titular | IDOR al marcar leídas |

### 2.2 Otros puntos de entrada

- **Cookie `eventia_session`:** token de sesión (64 hex). Si se filtra, permite suplantar al usuario hasta que expire o se cierre sesión.
- **Archivo SQLite (`DATABASE_PATH`):** acceso al disco = acceso a hashes, sesiones e inscripciones.
- **Variables de entorno (`.env`):** `HOST`, `PORT`, `DATABASE_PATH`, `APP_ORIGIN`, `COOKIE_SECURE`.
- **Script `seed`:** crea cuentas conocidas con contraseña fija de demostración.
- **Proceso Node en `127.0.0.1`:** por defecto no es alcanzable desde otras máquinas; si `HOST=0.0.0.0`, la superficie se amplía de inmediato.

### 2.3 Flujo de confianza

```text
Navegador  --HTTP-->  createHttpServer  -->  servicios (users/events/registrations/notifications)
                              |                         |
                         cookie sesión              SQLite (parametrizado)
                              |
                    comprobación de Origin
                    (POST/PATCH/DELETE)
```

No hay API entre módulos ni llamadas a terceros; el riesgo de SSRF / cadena de suministro externa es mínimo en este alcance.

---

## 3. Revisión por aspectos de la Fase 2

### 3.1 Autenticación

**Pregunta:** ¿Qué mecanismos utilizan para identificar usuarios?

**Hallazgo:** identificación por **sesión basada en cookie**, no por JWT en `localStorage`.

| Control | Estado | Evidencia |
|---|---|---|
| Registro e inicio de sesión | Implementado | `POST /api/auth/register`, `POST /api/auth/login` |
| Token de sesión | 32 bytes aleatorios (`randomBytes`) | `users/service.js` → `startSession` |
| Almacenamiento del token | Solo el **hash SHA-256** en tabla `sessions` | `digest(token)` |
| Cookie | `HttpOnly`, `SameSite=Strict`, `Path=/`, `Max-Age=7d` | `http/server.js` |
| Cookie `Secure` | Opcional (`COOKIE_SECURE=true`) | Por defecto **ausente** (HTTP local) |
| Expiración | 7 días; sesiones vencidas no autentican | `authenticate` + `expires_at` |
| Logout | Elimina sesión y caduca cookie | `logout` + `Max-Age=0` |
| Rate limiting login/registro | 30 intentos / IP / minuto | mapa en memoria `attempts` |
| Mitigación timing en login | Hash *dummy* si el correo no existe + `timingSafeEqual` | `login` |

**Riesgos residuales**

- El rate limit vive en memoria del proceso: se reinicia al reiniciar el servidor y no es compartido entre instancias.
- No hay bloqueo prolongado de cuenta ni CAPTCHA.
- Sin autenticación multifactor.

**Conclusión:** mecanismo adecuado para el MVP. Identifica usuarios de forma correcta y con buenas prácticas básicas.

---

### 3.2 Autorización

**Pregunta:** ¿Un usuario puede modificar eventos que pertenecen a otro organizador?

**Hallazgo:** en esta versión **no existen endpoints de edición, actualización ni eliminación de eventos**. Un atacante no puede modificar el evento de otro (ni el propio) por la API actual.

Controles de autorización que sí existen:

| Recurso | Regla | Controles |
|---|---|---|
| Publicar evento | Solo `role === 'organizer'` | `requireOrganizer` |
| Inscribirse | Usuario autenticado | `requireUser` |
| Listar inscripciones | Solo las del `user.id` | `repository.list(userId)` |
| Listar / marcar notificaciones | Solo del titular | `list(user.id)` / `markRead(id, user.id)` |
| Mutaciones cross-site | Origin permitido o `Sec-Fetch-Site` | rechazo `403 INVALID_ORIGIN` |

**Riesgos residuales**

1. **Elevación de privilegios por diseño:** al registrarse se puede elegir `role: "organizer"`. Cualquiera puede publicar eventos.
2. Cuando se implemente edición (Fase 3 / siguientes), habrá que comprobar `event.organizer_id === user.id` en backend; hoy esa regla no está porque no hay superficie que la necesite.
3. Los eventos y su disponibilidad son públicos: no es un fallo, pero facilita enumeración.

**Conclusión:** no hay IDOR evidente en inscripciones/notificaciones. La pregunta de modificación cruzada queda **cubierta por ausencia de funcionalidad**, no por una regla explícita de ownership en `UPDATE`.

---

### 3.3 Validación

**Pregunta:** ¿El backend comprueba los datos recibidos?

**Sí.** La validación no depende del formulario HTML; el servidor vuelve a comprobar:

| Entrada | Validación backend |
|---|---|
| Cuerpo HTTP | Solo `application/json`; máximo 16 KiB; objeto JSON (no arrays) |
| Nombre / título / descripción / lugar | Longitudes mín/máx, `trim` |
| Correo | Longitud + regex básica + normalización a minúsculas |
| Contraseña | Tipo string, 8–128 caracteres |
| Rol | Solo `participant` \| `organizer` |
| Categoría | Lista blanca |
| Fecha de evento | Debe ser futura y parseable |
| Cupo | Entero seguro entre 1 y 10 000 |
| Búsqueda `q` | Máx. 120 caracteres; comodines LIKE escapados |
| `offset` | Entero ≥ 0 |

**Riesgo residual:** la regex de correo es permisiva (no valida RFC completo). Suficiente para el MVP; no evita dominios inexistentes.

**Conclusión:** el backend **sí valida** de forma consistente; hay pruebas que rechazan capacidad inválida, fechas pasadas y roles inventados.

---

### 3.4 Control de cupos

**Pregunta:** ¿Se impide una inscripción que exceda los cupos disponibles?

**Sí**, en varias capas:

1. **Actualización condicional:**  
   `UPDATE ... SET occupied = occupied + 1 WHERE id = ? AND occupied < capacity AND starts_at > ?`
2. **Transacción `BEGIN IMMEDIATE`** en el flujo de inscripción (reserva + registro + notificación).
3. **Restricción SQL:** `CHECK (occupied >= 0 AND occupied <= capacity)`.
4. **Unicidad:** `UNIQUE (user_id, event_id)` evita doble inscripción.
5. **Prueba de concurrencia:** 8 conexiones compiten por 3 plazas; solo 3 ganan.

**Conclusión:** el sobrecupo está controlado incluso bajo competencia. Riesgo residual bajo en el modelo SQLite de un solo escritor.

---

### 3.5 Contraseñas

**Pregunta:** ¿Cómo se almacenan las contraseñas?

| Aspecto | Detalle |
|---|---|
| Algoritmo | `scrypt` (Node `crypto`) |
| Salt | 16 bytes aleatorios por usuario |
| Formato persistido | `saltHex:keyHex` (64 bytes derivados) |
| Comparación | `timingSafeEqual` |
| Exposición API | `password_hash` **no** se devuelve en respuestas |
| Política | Solo longitud 8–128; sin mayúsculas/números/símbolos obligatorios |

Cuentas de demostración (`Eventia2026!`) están documentadas a propósito para la demo local; **no deben usarse en un entorno real**.

**Conclusión:** almacenamiento correcto (no hay texto plano). Política de complejidad mejorable.

---

### 3.6 Secretos

**Pregunta:** ¿Existen credenciales escritas directamente en el código?

| Elemento | ¿Hardcodeado? | Evaluación |
|---|---|---|
| Claves de API / DB cloud | No | No aplica (SQLite local) |
| Configuración operativa | No | `.env` / `.env.example` |
| Contraseña demo en `scripts/seed.js` | Sí | Aceptable solo como seed académico |
| Secretos de sesión | No | Tokens aleatorios por sesión |

No hay cadenas tipo API keys, contraseñas de producción ni connection strings sensibles en el código de la aplicación.

**Conclusión:** bien separado para el MVP. El único “secreto” fijo es la contraseña de demostración del seed.

---

### 3.7 Manejo de errores

**Pregunta:** ¿Se expone información interna de la aplicación?

| Tipo | Respuesta al cliente | Interno |
|---|---|---|
| `AppError` | Mensaje + `code` controlados | — |
| Base bloqueada | `503` genérico (`BUSY`) | — |
| Error inesperado | `500` “No pudimos completar la operación.” | `console.error` |

No se envían stack traces, rutas de archivos ni SQL al cliente. Los códigos (`EVENT_FULL`, `INVALID_CREDENTIALS`, etc.) son deliberados y útiles para la UI.

**Riesgo residual:** el login unifica el mensaje (“Correo o contraseña incorrectos”), lo cual es correcto; el registro sí revela si el correo ya existe (`EMAIL_EXISTS`) — compromiso usabilidad/privacidad habitual.

**Conclusión:** no se observa fuga de información interna en respuestas HTTP.

---

### 3.8 Dependencias

**Pregunta:** ¿Existen vulnerabilidades conocidas en los paquetes utilizados?

`package.json` **no declara dependencias npm**. Solo se usan módulos nativos de Node (`http`, `crypto`, `fs`, `sqlite`, etc.).

| Aspecto | Evaluación |
|---|---|
| Cadena de suministro npm | Riesgo muy bajo (sin paquetes de terceros) |
| `node:sqlite` | API experimental; requiere Node ≥ 24.13 |
| Actualizaciones | La seguridad depende de mantener Node actualizado |

**Conclusión:** no hay CVEs de dependencias de aplicación que auditar vía `npm audit`. El riesgo se concentra en la versión de Node del entorno.

---

## 4. Protocolos y transporte (HTTPS / MITM)

### 4.1 Estado actual

- El servidor escucha por defecto en **`http://127.0.0.1:3000`** (sin TLS).
- README y `.env.example` advierten que un despliegue real requiere HTTPS, `APP_ORIGIN` y `COOKIE_SECURE=true`.

### 4.2 Man-in-the-middle (MITM)

| Escenario | Riesgo |
|---|---|
| Uso solo en localhost | Bajo: el tráfico no sale a la red local/internet |
| `HOST=0.0.0.0` + HTTP en LAN/Wi‑Fi | **Alto:** un atacante en la misma red puede capturar correo, contraseña y cookie de sesión |
| Despliegue público sin HTTPS | **Crítico:** interceptación, secuestro de sesión, manipulación de respuestas |
| Cookie sin flag `Secure` en HTTPS | Medio: la cookie podría enviarse también por HTTP si el usuario visita una URL insegura |

**Ataques MITM posibles si se expone en claro**

1. Captura de credenciales en `POST /api/auth/login` o `/register`.
2. Robo de `eventia_session` y reutilización desde otro cliente.
3. Manipulación de respuestas JSON (catálogo de eventos, mensajes de error).
4. Downgrade / falta de HSTS (hoy no aplica porque no hay HTTPS).

**Medidas recomendadas antes de exponer Eventia**

- Terminar TLS (reverse proxy o certificado) y forzar redirección HTTP → HTTPS.
- `COOKIE_SECURE=true` y `APP_ORIGIN=https://…`.
- Considerar HSTS en el proxy.
- Mantener `HOST` restringido o firewall hasta tener TLS.

---

## 5. Inyecciones y XSS

### 5.1 Inyección SQL

**Estado: mitigado.**

- Repositorios usan `db.prepare(...).get/run/all` con placeholders `?`.
- En búsquedas `LIKE`, se escapan `\`, `%` y `_` y se usa `ESCAPE '\'`.
- Hay test explícito con payload `' OR 1=1 --` que no devuelve filas indebidas.
- Esquema `STRICT` + `FOREIGN KEYS` + `CHECK` reduce datos inconsistentes.

No se encontró concatenación de entrada de usuario dentro de SQL.

### 5.2 Cross-Site Scripting (XSS)

**Estado: mitigado en la UI actual.**

- `public/app.js` define `escape()` para `& < > " '`.
- Títulos, descripciones, lugares, nombres, mensajes e IDs insertados en HTML pasan por `escape`.
- CSP: `default-src 'self'; script-src 'self'; …` reduce impacto de scripts inline/externos.

**Riesgo residual bajo:** si en el futuro se inserta HTML “rico” sin escapar, o se relaja la CSP, el XSS almacenado en campos de evento volvería a ser viable.

### 5.3 Otras inyecciones

| Tipo | ¿Aplica? | Notas |
|---|---|---|
| Command injection | No observado | No se ejecutan shells con input de usuario |
| Path traversal | Bajo | Assets estáticos desde mapa fijo, no desde path libre del cliente |
| Header injection | Bajo | Respuestas construidas sin reflejar headers arbitrarios |
| JSON / prototype pollution | Bajo | Se exige objeto plano; no se hace merge profundo inseguro |

---

## 6. OWASP Top 10 (2021) aplicado a Eventia

| # | Riesgo OWASP | Situación en Eventia | Severidad actual* |
|---|---|---|---|
| **A01** | Broken Access Control | Inscripciones/notificaciones filtradas por usuario; publicación exige organizador; **no hay edición de eventos**; rol organizador autoasignable | Media (diseño de roles) |
| **A02** | Cryptographic Failures | Contraseñas con `scrypt`+salt; sesión hasheada; **transporte HTTP sin cifrar** si se expone | Alta si se publica; Baja en localhost |
| **A03** | Injection | SQL parametrizado; XSS escapado; CSP | Baja |
| **A04** | Insecure Design | Eventos gratuitos, sin cancelación; cualquiera puede ser organizador; sin MFA | Media |
| **A05** | Security Misconfiguration | Cabeceras (`X-Frame-Options`, CSP, `nosniff`); bind local; Secure cookie opcional | Baja–Media |
| **A06** | Vulnerable and Outdated Components | Sin dependencias npm; riesgo = versión de Node / `node:sqlite` experimental | Baja |
| **A07** | Identification and Authentication Failures | Sesiones sólidas, rate limit básico, timing-safe login; política de password débil | Baja–Media |
| **A08** | Software and Data Integrity Failures | Sin pipeline CI de integridad ni firmas; alcance local | Baja |
| **A09** | Security Logging and Monitoring Failures | Casi no hay auditoría de accesos fallidos persistente | Media (operación) |
| **A10** | Server-Side Request Forgery | No hay fetch a URLs controladas por el usuario | N/A / Baja |

\*Severidad relativa al contexto del MVP académico local.

### Relación con funcionalidades concretas

1. **Inscripción con cupos (A01/A04):** la reserva condicional evita condición de carrera que daría plazas de más (impacto de integridad del negocio).
2. **Login/registro (A02/A07):** sin HTTPS en red abierta, A02 domina aunque el hashing sea correcto.
3. **Búsqueda de eventos (A03):** el escape de comodines evita que `%` o `_` alteren el resultado de forma no intencional y bloquea inyección clásica.
4. **Listado de inscripciones (A01):** filtrar por `user.id` evita que Andrea vea las de Diego.

---

## 7. Otros vectores revisados

### 7.1 CSRF

Mitigaciones presentes:

- `SameSite=Strict` en la cookie de sesión.
- Comprobación de `Origin` (y rechazo de `Sec-Fetch-Site: cross-site`) en `POST`/`PATCH`/`DELETE`.

Riesgo residual bajo en navegadores modernos. Una API consumida desde otro origen legítimo requeriría configurar `APP_ORIGIN`.

### 7.2 Clickjacking

`X-Frame-Options: DENY` y CSP `frame-ancestors 'none'` mitigan el encuadre en iframes.

### 7.3 Fuerza bruta

Rate limit de 30/min/IP en login y registro. No protege contra botnets distribuidas; suficiente para demo local.

### 7.4 Enumeración de usuarios

- Login: mensaje genérico (bien).
- Registro: revela correo ya registrado (aceptable con matiz de privacidad).

### 7.5 Denegación de servicio

- Límite de body 16 KiB y timeouts de request/headers.
- SQLite de un escritor puede responder `503 BUSY` bajo carga; no es DoS de red complejo, pero sí un límite de capacidad.

### 7.6 Persistencia y acceso al archivo

Quien lea `data/eventia.sqlite` obtiene hashes `scrypt` (no reversibles fácilmente) y hashes de sesión. Proteger permisos del archivo en el SO es parte del modelo de amenaza local.

---

## 8. Matriz de hallazgos

| ID | Hallazgo | OWASP | Severidad | Estado |
|---|---|---|---|---|
| H1 | Ausencia de TLS / exposición MITM si se publica en HTTP | A02 | Alta* | Pendiente de despliegue |
| H2 | Rol `organizer` elegible por cualquier registro | A01 / A04 | Media | Diseño actual del MVP |
| H3 | Política de contraseñas solo por longitud | A07 | Media | Mejora recomendada |
| H4 | Rate limit no persistente / por proceso | A07 | Baja | Aceptable en local |
| H5 | Contraseña demo fija en seed/README | A07 | Baja | Solo demostración |
| H6 | Logging de seguridad mínimo | A09 | Baja–Media | Mejora operativa |
| H7 | Sin rutas de edición → ownership no codificado aún | A01 | Informativa | Vigilar en Fase 3 |
| H8 | SQL injection | A03 | — | Mitigado |
| H9 | XSS en renderizado actual | A03 | — | Mitigado |
| H10 | Sobrecupo / carrera en inscripciones | A04 | — | Mitigado |
| H11 | IDOR inscripciones/notificaciones | A01 | — | Mitigado |
| H12 | Secretos de producción en código | A02 / A05 | — | No observados |
| H13 | Dependencias npm vulnerables | A06 | — | N/A (sin deps) |

\*Alta solo si el servicio deja de ser estrictamente local.

---

## 9. Controles ya presentes (inventario positivo)

Para la entrega de Fase 2 conviene dejar explícito qué ya está bien:

1. Hashing `scrypt` + salt aleatorio + comparación en tiempo constante.  
2. Sesiones con token opaco y hash en base de datos.  
3. Cookies `HttpOnly` + `SameSite=Strict`.  
4. Validación de entrada en servicios, no solo en el cliente.  
5. Consultas SQL parametrizadas y escape de `LIKE`.  
6. Control de cupos atómico + restricciones de esquema + tests de concurrencia.  
7. Autorización por rol al publicar y por titular en inscripciones/notificaciones.  
8. Protección de origen en mutaciones (anti-CSRF básico).  
9. Cabeceras CSP, `X-Frame-Options`, `nosniff`, `Referrer-Policy`.  
10. Errores 500 genéricos sin stack al cliente.  
11. Rate limiting elemental en auth.  
12. Sin dependencias npm de terceros.

---

## 10. Recomendaciones priorizadas (insumo para Fase 3)

Orden sugerido si se implementan mejoras reales:

1. **Impedir sobrecupo / validar cantidad > 0** — ya cubierto; documentar evidencia de prueba existente.  
2. **Ownership al editar eventos** — cuando exista `PATCH/PUT`, exigir `organizer_id === user.id`.  
3. **Privacidad de inscripciones** — ya cubierta; mantener el filtro por usuario.  
4. **Variables de entorno** — ya parcialmente; asegurar que ningún secreto nuevo se hardcodee.  
5. **Hashing de contraseñas** — ya implementado; endurecer política (complejidad) si se pide mejora.  
6. **Errores internos** — ya genéricos; opcional: no loguear bodies con contraseñas.  
7. **Antes de publicar:** HTTPS + `COOKIE_SECURE` + `APP_ORIGIN` + bind/firewall.

Candidatos claros a “al menos dos controles” de la Fase 3 si se desea demostrar rechazo explícito en una demo:

- Rechazo de inscripción cuando `available === 0` (ya existe; evidenciar con el evento de 1 cupo).  
- Rechazo de origen no permitido (`403 INVALID_ORIGIN`).  
- Rechazo de participante al publicar (`403 FORBIDDEN`).  
- Rechazo al marcar notificación ajena (`404 NOTIFICATION_NOT_FOUND`).

---

## 11. Evidencia de verificación existente

Las pruebas automatizadas (`npm test`) ya ejercitan varios controles de seguridad:

- Publicación sin sesión / sin rol organizador → `UNAUTHENTICATED` / `FORBIDDEN`.  
- Hash de contraseña distinto del texto plano; login incorrecto → `INVALID_CREDENTIALS`.  
- Sesión expirada e invalidación por logout.  
- Payload tipo inyección en búsqueda sin resultados indebidos.  
- Privacidad de inscripciones y notificaciones entre usuarios.  
- Origin no confiable → `403`.  
- Cookie con `HttpOnly` y `SameSite=Strict`.  
- Concurrencia de cupos (8 vs 3).  
- Constraints SQL de sobrecupo, unicidad y FK.

---

## 12. Conclusión

La auditoría de Fase 2 muestra que Eventia **no es una aplicación “abierta” a nivel de lógica de negocio**: autentica, autoriza lo que expone, valida en servidor, protege cupos y evita las inyecciones clásicas. El modelo de amenaza crítico cambia cuando se abandona localhost: **sin HTTPS, el canal es el eslabón débil (MITM)**, aunque el almacenamiento de contraseñas y la autorización interna estén bien resueltos.

Para la continuidad del curso, las mejoras de Fase 3 deberían enfocarse en **controles demostrables ya alineados con huecos de diseño o con evidencia de rechazo**, y en documentar explícitamente el plan de endurecimiento de transporte si la app se publica.

---

### Archivos revisados (referencia)

- `src/http/server.js` — rutas, cookies, origen, cabeceras, errores  
- `src/modules/users/service.js` — auth, hashing, sesiones  
- `src/modules/events/service.js` / `repository.js` — publicación, búsqueda, cupos  
- `src/modules/registrations/service.js` / `repository.js` — inscripción y privacidad  
- `src/modules/notifications/service.js` / `repository.js` — titularidad  
- `src/shared/errors.js` — autorización y validación de texto  
- `src/infrastructure/database.js` — transacciones  
- `database/schema.sql` — restricciones de integridad  
- `public/app.js` — escape XSS  
- `package.json`, `.env.example`, `scripts/seed.js`, `tests/eventia.test.js`, `docs/api.md`
