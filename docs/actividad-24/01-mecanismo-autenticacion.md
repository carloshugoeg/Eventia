# Sesiones de servidor para la versión actual

Eventia es un monolito modular de un solo origen. Un proceso Node y una base SQLite ya guardan usuarios, eventos e inscripciones. La comparación de abajo elige un mecanismo para esa forma, no para un conjunto de servicios separados.

## Alternativas

| Alternativa | Qué guarda cada parte | Encaje con Eventia hoy |
|---|---|---|
| Sesiones de servidor con cookies seguras | El servidor guarda la sesión. El navegador solo reenvía un identificador opaco. | Ya está en el código. |
| Tokens JWT | El cliente guarda un token firmado. El servidor valida firma y claims. | El cierre de sesión antes del vencimiento vuelve a pedir estado en el servidor. |
| OpenID Connect | Un proveedor externo autentica y entrega un id token. | Sirve si varias aplicaciones comparten un login institucional. Este MVP no lo hace. |

## ¿Qué alternativa utilizarían para la versión actual de Eventia?

Sesiones de servidor con la cookie `eventia_session`.

El enunciado pide elegir un mecanismo. Esta entrega usa la sesión de servidor.

## ¿Por qué consideran que es adecuada para su arquitectura?

La página y la API comparten origen. `fetch` envía la cookie sin que el JavaScript de la página lea el secreto, porque la cookie es `HttpOnly`. SQLite ya es el almacén de usuarios. Guardar el hash del token y `expires_at` en `sessions` no pide otro servicio.

Cada operación de eventos o inscripciones sigue en el mismo proceso que conoce al actor. La autorización de dueño no cambia de lugar si la identidad llega por cookie.

## ¿Qué ventajas y limitaciones presenta?

Ventajas de esta sesión:

- `POST /api/auth/logout` borra la fila. La siguiente petición deja de tener actor.
- El token no se guarda en `localStorage`.
- La comprobación de vencimiento está en SQL, en cada lectura de sesión.

Limitaciones:

- La sesión vive en esta base. Varias réplicas del proceso necesitarían el mismo almacén.
- La cookie no viaja como credencial entre servicios de otro origen.
- El registro público todavía acepta `role: "organizer"`. Eso es una regla de alta, no una propiedad de la cookie.

JWT queda fuera por una razón concreta. Un token firmado y todavía vigente seguiría exigiendo las mismas comprobaciones de dueño. Invalidarlo antes de su vencimiento pide una lista de revocación. Esa lista es otra tabla de sesión.

OpenID Connect queda fuera porque el enunciado no pide un proveedor institucional y Eventia no comparte cuentas con otra aplicación.

## ¿Cómo se mantendría la autenticación entre solicitudes?

`users.startSession` genera 32 bytes aleatorios y los muestra como 64 caracteres hexadecimales. En `sessions` se guarda el SHA-256 de ese valor, el `user_id` y `expires_at` a siete días del alta. La respuesta lleva:

`Set-Cookie: eventia_session=<token>; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800`

Si `COOKIE_SECURE` es `true`, la cookie también lleva `Secure`.

En cada petición, `users.authenticate` acepta solo un token de 64 hexadecimales, calcula el hash y busca una fila con `expires_at` posterior a ahora. Si no hay cookie, el formato no coincide o la fila no está, el actor es `null`.

Las rutas protegidas llaman a `requireUser` y responden `401 UNAUTHENTICATED`. La ruta usada en las pruebas es `GET /api/registrations`. `GET /api/auth/me` no sirve para ese rechazo: sin sesión responde `200` con `user: null`.

## ¿Cómo manejarían el cierre de sesión y la expiración de las credenciales?

La sesión termina en el primero de estos dos momentos.

- El usuario llama a `POST /api/auth/logout`. El servidor borra ese `token_hash` y envía `Max-Age=0`.
- Pasan siete días desde `startSession`. No hay renovación por actividad. `repository.session` exige `expires_at` posterior a ahora. El `Max-Age` de la cookie copia ese plazo, pero el servidor no confía en él.

Una cookie de 64 hexadecimales que no existe, y una cookie cuya fila ya tiene `expires_at` en el año 2000, producen el mismo `401` en `GET /api/registrations`. Las dos capturas están en [06-evidencias-pruebas.md](06-evidencias-pruebas.md).
