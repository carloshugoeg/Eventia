# Situaciones de control de acceso

Cada situación responde las cuatro preguntas del enunciado. El orden de comprobaciones es el orden real de `events.update` y de `registrations.list`.

## Situación A. Un organizador modifica un evento de otro organizador

1. Rechazar.
2. El backend comprueba, en este orden, sesión válida, rol `organizer`, que el evento exista y que `organizer_id` sea el id del actor. En esta situación falla la última.
3. `403 FORBIDDEN`. El cuerpo es `{"error":"Solo el organizador de este evento puede modificarlo.","code":"FORBIDDEN"}`.
4. ReBAC. La relación que importa es dueño del evento. Ser organizador es RBAC y no alcanza, porque el otro actor también tiene ese rol.

Estado: implementado + probado. La captura HTTP de un segundo organizador está en `evidencias/prueba-4.txt`.

Un 404 ocultaría un id que el catálogo ya publica. Ver el identificador ajeno está permitido. Escribir no lo está.

## Situación B. Un usuario registrado consulta inscripciones de otra persona

1. Rechazar.
2. El backend comprueba la sesión y, si el query `userId` viene y no es el id del actor, responde 403. La consulta SQL usa siempre el id del actor, no el id pedido.
3. `403 FORBIDDEN`. El cuerpo es `{"error":"No puedes consultar las inscripciones de otro usuario.","code":"FORBIDDEN"}`.
4. ReBAC sobre el conjunto de inscripciones de esa persona. El rol de usuario registrado no autoriza a leer las de otro.

Estado: implementado + probado. Captura en `evidencias/prueba-5.txt`.

## Situación C. Un administrador con sesión vencida intenta una operación administrativa

1. Rechazar.
2. `authenticate` no encuentra una fila con `expires_at` posterior a ahora. El actor queda en `null`. `requireUser` responde 401 antes de leer `role`.
3. `401 UNAUTHENTICATED`. El cuerpo es `{"error":"Inicia sesión para continuar.","code":"UNAUTHENTICATED"}`.
4. La autenticación va antes que RBAC. Un rol administrador, si existiera, no se evaluaría con la sesión ya vencida. Habría que iniciar sesión de nuevo y, después, aplicar el permiso de administrador.

Estado: implementado + probado en la puerta de sesión. No hay cuenta administrador en el esquema, así que la captura usa la sesión vencida de `andrea@eventia.demo` en `GET /api/registrations`. Es la misma búsqueda de `sessions` que vería cualquier rol. Captura en `evidencias/prueba-6.txt`.

## Situación D. Un organizador modifica un evento propio que ya cerró

1. Rechazar.
2. El backend comprueba sesión, rol `organizer`, que el evento exista, ownership y después el `starts_at` guardado. Si ese instante es anterior o igual a ahora, la operación se detiene. `parseEventFields` no corre, así que una fecha futura en el cuerpo no reabre el evento.
3. `409 EVENT_CLOSED`. El cuerpo es `{"error":"Este evento ya inició y no admite cambios.","code":"EVENT_CLOSED"}`.
4. ABAC sobre ReBAC. El actor sí es dueño. El atributo que cierra la operación es el estado temporal del evento. El mismo código `EVENT_CLOSED` ya se usa cuando alguien intenta inscribirse a un evento iniciado.

Estado: implementado + probado. Captura del dueño en `evidencias/situacion-d.txt`. El `GET` posterior, en `evidencias/situacion-d-lectura.txt`, sigue con el título anterior y con `starts_at` en `2020-01-01T00:00:00.000Z`.

El código es 409 porque el ownership ya pasó. El conflicto es el estado del recurso.

Un organizador que no es dueño, sobre ese mismo evento cerrado, recibe 403. La comprobación de ownership ocurre antes que la de cierre. Captura en `evidencias/situacion-d-ajeno.txt`.
