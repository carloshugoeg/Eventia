# Controles implementados en el repositorio

Repositorio: https://github.com/carloshugoeg/Eventia

La respuesta de rechazo la produce el servicio en el servidor.

## Autenticación ya presente

| Demostración | Dónde | Evidencia |
|---|---|---|
| Inicio de sesión | `POST /api/auth/login` y `POST /api/auth/register` llaman a `users.startSession` | `evidencias/00-login-organizador.txt` |
| Ruta protegida con sesión válida | `GET /api/registrations` | `evidencias/prueba-2.txt` |
| Sin autenticación | el mismo `GET` sin cookie | `evidencias/prueba-1.txt` |
| Credencial inválida o vencida | cookie de 64 hexadecimales inexistente, o `expires_at` en el año 2000 | `evidencias/prueba-6-token-invalido.txt` y `evidencias/prueba-6.txt` |

Archivos de la sesión: `src/modules/users/service.js` (`startSession`, `authenticate`, `logout`), `src/modules/users/repository.js` (`session` exige `expires_at` posterior a ahora) y `src/http/server.js` (cookie `eventia_session`).

## Control 1. El organizador solo modifica eventos propios

`events.update` en `src/modules/events/service.js` hace estas comprobaciones antes de escribir.

1. `requireOrganizer`. Sin actor, 401. Con otro rol, 403.
2. El evento existe. Si no, 404.
3. `organizer_id` es el id del actor. Si no, 403.
4. `starts_at` guardado es posterior a ahora. Si no, 409 `EVENT_CLOSED`.
5. Solo entonces `parseEventFields` y `repository.update`.

El `UPDATE` de `src/modules/events/repository.js` también exige `organizer_id` en el `WHERE`. La respuesta HTTP de rechazo sale en el paso 3, antes de esa sentencia.

La ruta es `PATCH /api/events/:id`.

Prueba autorizada: `evidencias/prueba-3.txt`, código 200. Prueba no autorizada, con un segundo organizador: `evidencias/prueba-4.txt`, código 403. El `GET` siguiente conserva el título del dueño: `evidencias/prueba-4-lectura.txt`.

## Control 2. El usuario solo consulta sus inscripciones

`registrations.list` en `src/modules/registrations/service.js` llama a `requireUser`. Si llega un `userId` distinto del actor, lanza 403. La lista que devuelve sale de `repository.list(user.id)`.

La ruta es `GET /api/registrations`. Un `userId` ajeno está cubierto por `evidencias/prueba-5.txt`, código 403.

## Situación D en el mismo `events.update`

El paso 4 del control 1 es el cierre. Corre antes de leer la fecha nueva del cuerpo. La captura del dueño es `evidencias/situacion-d.txt`, código 409. La lectura posterior es `evidencias/situacion-d-lectura.txt`.

## Cómo verificar

```bash
npm test
npm run evidencias:actividad-24
```

`npm test` incluye la prueba `un evento ya iniciado rechaza el PATCH del dueño y no cambia el título`. Esa prueba observa el 409 del dueño, el 403 de otro organizador, el 401 sin sesión y el título intacto.
