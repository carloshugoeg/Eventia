# Guía de demostración de la fase 1

## Preparación

1. Instalar o disponer de Node.js 24.13 o posterior dentro de la rama 24.
2. Abrir una terminal en la carpeta del proyecto.
3. Ejecutar `npm.cmd run seed`, luego `npm.cmd start`.
4. Abrir `http://localhost:3000`.

Las cuentas de ejemplo usan `Eventia2026!`. El organizador es `organizador@eventia.demo`; los participantes son `andrea@eventia.demo` y `diego@eventia.demo`. Los eventos y cuentas se guardan; reiniciar la aplicación no los borra.

## Recorrido A: flujo principal completo

1. Entrar al catálogo sin sesión: comprobar que se pueden ver y buscar eventos.
2. Abrir «Ideas que se convierten en código» y observar su disponibilidad.
3. Seleccionar «Inicia sesión para inscribirte» e ingresar como Andrea.
4. El detalle del evento vuelve a abrirse después del inicio de sesión. Seleccionar «Reservar mi lugar».
5. Comprobar que aparece la confirmación y que la disponibilidad disminuye en uno.
6. Cerrar el detalle y abrir «Mis inscripciones»: el evento debe aparecer como confirmado.
7. Abrir «Notificaciones»: comprobar el mensaje y marcarlo como leído.
8. Cerrar sesión, volver a entrar y comprobar que la inscripción sigue guardada.

Si Andrea ya estaba inscrita por una demostración anterior, crear una cuenta nueva o publicar otro evento. No se incluye cancelación en este MVP.

## Recorrido B: publicar un evento

1. Cerrar sesión si existe una cuenta activa.
2. Iniciar sesión como `organizador@eventia.demo`.
3. Seleccionar «Publicar evento».
4. Completar título, descripción de al menos 20 caracteres, lugar, fecha futura, capacidad y categoría.
5. Publicar. Comprobar que se abre el detalle y el evento aparece en el catálogo.
6. Ingresar como un participante: el botón de publicación no aparece y la API rechaza publicar con ese rol.

## Recorrido C: control de la última plaza

1. Usar un evento nuevo con capacidad 1 o «Laboratorio de ideas: última plaza», si todavía no tiene inscripciones.
2. Abrir dos sesiones independientes: un navegador con Andrea y otro navegador o ventana privada con Diego.
3. Abrir el mismo detalle en ambas sesiones antes de inscribirse: las dos pueden ver un lugar disponible.
4. Solicitar inscripción desde ambas sesiones.
5. Solo una debe obtener confirmación; la otra debe recibir el mensaje de cupos agotados.
6. Comprobar que disponibilidad = 0 y ocupados = 1; solo la persona que consiguió plaza tiene inscripción y notificación.

La prueba automatizada de concurrencia usa ocho conexiones independientes para tres plazas. Este recorrido sirve para explicar el comportamiento desde la interfaz.

## Recorrido D: errores y privacidad

- Intentar inscribirse de nuevo: se conserva una sola inscripción y no cambia el cupo.
- Intentar publicar con fecha pasada o capacidad inválida: se rechaza la solicitud.
- Cerrar sesión: «Mis inscripciones» pide autenticación.
- Ingresar con otra cuenta: no aparecen las inscripciones ni confirmaciones de la anterior.

## Relacionar arquitectura y código

| Evidencia a mostrar | Archivo |
|---|---|
| Composición de los cuatro módulos e inyección de dependencias | `src/app.js` |
| Rutas/controladores y autenticación HTTP | `src/http/server.js` |
| Coordinación del flujo de inscripción mediante contratos | `src/modules/registrations/service.js` |
| Regla de reserva de cupo | `src/modules/events/service.js` |
| Actualización SQL condicional | `src/modules/events/repository.js` |
| Transacción con commit y rollback | `src/infrastructure/database.js` |
| Restricciones de datos y relaciones | `database/schema.sql` |
| Confirmación persistida | `src/modules/notifications/service.js` |
| Verificación con escritores simultáneos | `tests/eventia.test.js` y `tests/helpers/enroll-worker.js` |

## Lista de aceptación de la entrega

- [x] Definición del MVP con funcionalidades incluidas, aplazadas y justificaciones.
- [x] Propuesta escrita con arquitectura, módulos, responsabilidades y relaciones.
- [x] Almacenamiento y comunicaciones documentados.
- [x] Diagrama inicial legible y fuente editable.
- [x] Al menos tres dependencias justificadas.
- [x] Primera versión ejecutable con un flujo completo y persistencia.
- [x] Código que refleja la arquitectura propuesta.
- [x] Tests y evidencia de funcionamiento.

La fase 2 queda pendiente por decisión de alcance de la actividad actual.
