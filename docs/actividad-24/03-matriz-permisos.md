# Matriz de roles y permisos

Los roles del enunciado son visitante, usuario registrado, organizador y administrador. En el código existen `participant` y `organizer`. No hay rol `admin` ni alta pública que lo cree. La columna Administrador describe el permiso previsto. Esa columna es política.

P significa permitido cuando se cumple la condición de la fila. D significa denegado.

El estado de cada fila usa una de estas etiquetas. `implementado + probado` significa que la API lo hace y hay una prueba o una transcripción. `política` significa que la fila describe una regla que el repositorio todavía no ejecuta.

La condición de recurso es ownership. El `organizer_id` o el `user_id` guardado tiene que ser el id del actor. El rol abre una capacidad global, como publicar. No sustituye esa relación.

## Matriz

| Operación | Visitante | Usuario registrado | Organizador | Administrador | Estado |
|---|---|---|---|---|---|
| 1. Consultar eventos públicos | P | P | P | P | implementado + probado |
| 2. Inscribirse en eventos | D, 401 | P | P | P | implementado + probado |
| 3. Consultar inscripciones propias | D, 401 | P, solo las suyas | P, solo las suyas | P, con justificación de soporte | implementado + probado |
| 4. Crear eventos | D, 401 | D, 403 | P | P | implementado + probado |
| 5. Modificar eventos propios | D | D | P si es dueño y el evento no ha iniciado. Si `starts_at` ya pasó, 409 | P, con registro de la acción | implementado + probado |
| 6. Modificar eventos de otros organizadores | D | D | D, 403 | P, como moderación | 403 del organizador ajeno, implementado + probado. El permiso de administrador es política |
| 7. Consultar participantes de eventos propios | D | D | P si es dueño del evento | P | política |
| 8. Administrar usuarios | D | D | D | P | política |

## Condiciones

1. Consultar eventos públicos no pide cookie. El listado no incluye inscritos. Solo entran eventos con `starts_at` posterior a ahora.
2. Inscribirse exige sesión, cupo libre, una sola inscripción por usuario y un evento que no haya iniciado. El `user_id` sale de la sesión. La cantidad válida es 1.
3. Consultar inscripciones propias filtra siempre por el id del actor. Un `userId` de otra persona responde 403.
4. Crear eventos exige rol `organizer`. El `organizer_id` del evento nuevo es el id de la sesión, no un campo del cuerpo.
5. Modificar eventos propios exige rol `organizer`, ownership y `starts_at` guardado posterior a ahora. Una fecha futura en el cuerpo no reabre un evento ya iniciado. El rechazo es `409 EVENT_CLOSED`.
6. Modificar el evento de otro organizador se rechaza con 403 aunque el actor también sea organizador. Ver los identificadores ajenos en el catálogo no concede la escritura.
7. Consultar participantes del evento propio no tiene ruta. El permiso del dueño queda como política.
8. Administrar usuarios no tiene ruta. El registro solo acepta `participant` y `organizer`.
