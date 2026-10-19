# Evidencias de las seis pruebas

Los códigos de esta página salen de las transcripciones `curl -i` en [evidencias/](evidencias/). Se regeneran con `npm run evidencias:actividad-24`. La corrida de esta entrega es del 19 de octubre de 2026.

La ruta privada de las seis pruebas es `GET /api/registrations`. `GET /api/auth/me` responde 200 con `user: null` cuando no hay sesión, así que esa ruta no muestra el 401.

Las cuentas sembradas son `organizador@eventia.demo` (Colectivo Xela, dueño de los eventos de ejemplo), `andrea@eventia.demo` y `diego@eventia.demo`. Organizador B se registra durante la captura como `orgb@eventia.demo` con rol `organizer`. La contraseña es `Eventia2026!`.

## Prueba 1. Ruta privada sin autenticación

| Campo | Valor |
|---|---|
| Operación realizada | `GET /api/registrations` sin cookie |
| Usuario o rol utilizado | Visitante |
| Resultado esperado | Rechazar |
| Código HTTP obtenido | 401 |
| Resultado real | `{"error":"Inicia sesión para continuar.","code":"UNAUTHENTICATED"}` |
| Captura de evidencia | [evidencias/prueba-1.txt](evidencias/prueba-1.txt) |

## Prueba 2. Ruta privada con autenticación válida

| Campo | Valor |
|---|---|
| Operación realizada | `GET /api/registrations` con la cookie de Andrea |
| Usuario o rol utilizado | Usuario registrado, `andrea@eventia.demo` |
| Resultado esperado | Permitir |
| Código HTTP obtenido | 200 |
| Resultado real | `{"registrations":[]}` |
| Captura de evidencia | [evidencias/prueba-2.txt](evidencias/prueba-2.txt) |

## Prueba 3. Modificar un evento propio

| Campo | Valor |
|---|---|
| Operación realizada | `PATCH /api/events/{id}` del primer evento público, con título nuevo y fecha futura |
| Usuario o rol utilizado | Organizador dueño, Colectivo Xela |
| Resultado esperado | Permitir |
| Código HTTP obtenido | 200 |
| Resultado real | El evento queda con el título `Evento editado por su dueño` |
| Captura de evidencia | [evidencias/prueba-3.txt](evidencias/prueba-3.txt) |

## Prueba 4. Modificar el evento de otro organizador

| Campo | Valor |
|---|---|
| Operación realizada | `PATCH /api/events/{id}` del mismo evento, pidiendo el título `Intento de cambio ajeno` |
| Usuario o rol utilizado | Organizador B, `orgb@eventia.demo`, que no es el dueño |
| Resultado esperado | Rechazar por ownership |
| Código HTTP obtenido | 403 |
| Resultado real | `{"error":"Solo el organizador de este evento puede modificarlo.","code":"FORBIDDEN"}` |
| Captura de evidencia | [evidencias/prueba-4.txt](evidencias/prueba-4.txt) |

El `GET /api/events/{id}` siguiente sigue mostrando `Evento editado por su dueño`. El título pedido por Organizador B no se escribió. Captura en [evidencias/prueba-4-lectura.txt](evidencias/prueba-4-lectura.txt).

El respaldo de servicio es la prueba `fase 3: solo el organizador dueño puede modificar su evento`. La prueba HTTP anterior del repositorio usa un participante como intruso, así que el 403 de un segundo organizador queda en esta transcripción.

## Prueba 5. Consultar inscripciones de otro usuario

| Campo | Valor |
|---|---|
| Operación realizada | `GET /api/registrations?userId={id de Diego}` |
| Usuario o rol utilizado | Usuario registrado, `andrea@eventia.demo` |
| Resultado esperado | Rechazar |
| Código HTTP obtenido | 403 |
| Resultado real | `{"error":"No puedes consultar las inscripciones de otro usuario.","code":"FORBIDDEN"}` |
| Captura de evidencia | [evidencias/prueba-5.txt](evidencias/prueba-5.txt) |

## Prueba 6. Sesión inválida o vencida

Las dos variantes piden `GET /api/registrations`.

Cookie forjada, 64 hexadecimales que no están en `sessions`:

| Campo | Valor |
|---|---|
| Operación realizada | `GET /api/registrations` |
| Usuario o rol utilizado | Cookie `eventia_session` inexistente |
| Resultado esperado | Rechazar |
| Código HTTP obtenido | 401 |
| Resultado real | `{"error":"Inicia sesión para continuar.","code":"UNAUTHENTICATED"}` |
| Captura de evidencia | [evidencias/prueba-6-token-invalido.txt](evidencias/prueba-6-token-invalido.txt) |

Sesión vencida. Se actualiza `expires_at` de Andrea a `2000-01-01T00:00:00.000Z` y se repite el `GET` con su cookie:

| Campo | Valor |
|---|---|
| Operación realizada | `GET /api/registrations` |
| Usuario o rol utilizado | `andrea@eventia.demo`, sesión ya vencida |
| Resultado esperado | Rechazar |
| Código HTTP obtenido | 401 |
| Resultado real | `{"error":"Inicia sesión para continuar.","code":"UNAUTHENTICATED"}` |
| Captura de evidencia | [evidencias/prueba-6.txt](evidencias/prueba-6.txt) |

El vencimiento también está cubierto a nivel de servicio por `sesiones expiran y cerrar sesión invalida el token`. La cookie forjada de esta prueba es la captura HTTP.

## Situación D. Evento propio ya iniciado

No es una de las seis pruebas del enunciado. Confirma el rechazo que describe [04-situaciones-acceso.md](04-situaciones-acceso.md).

| Campo | Valor |
|---|---|
| Operación realizada | `PATCH /api/events/{id}` del dueño, después de poner `starts_at` en `2020-01-01T00:00:00.000Z`. El cuerpo pide el título `Reapertura prohibida` y una fecha futura |
| Usuario o rol utilizado | Colectivo Xela, dueño |
| Resultado esperado | Rechazar. El cuerpo no reabre el evento |
| Código HTTP obtenido | 409 |
| Resultado real | `{"error":"Este evento ya inició y no admite cambios.","code":"EVENT_CLOSED"}` |
| Captura de evidencia | [evidencias/situacion-d.txt](evidencias/situacion-d.txt) |

El `GET` posterior conserva el título `Evento editado por su dueño` y `starts_at` en `2020-01-01T00:00:00.000Z`. Captura en [evidencias/situacion-d-lectura.txt](evidencias/situacion-d-lectura.txt).

El mismo evento, con Organizador B, responde 403. Captura en [evidencias/situacion-d-ajeno.txt](evidencias/situacion-d-ajeno.txt).
