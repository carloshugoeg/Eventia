# Verificación de Eventia · Fase 1

Fecha: **5 de octubre de 2026**. Entorno verificado: Windows, Node.js **24.13.0**, SQLite **3.50.4** incluido en Node. Aplicación y datos de prueba locales.

## Comprobaciones automatizadas

| Comando | Resultado |
|---|---|
| `npm.cmd run check` | Sintaxis JavaScript válida. |
| `npm.cmd test` | **15 tests aprobados; 0 fallos, 0 omitidos.** |

Salida completa: [pruebas](evidencia/pruebas.txt) y [sintaxis](evidencia/sintaxis.txt).

Los tests no usan la base de demostración. Verifican:

1. Consulta, inscripción, actualización de cupo y confirmación persistida.
2. Duplicados sin consumo adicional de cupo ni nuevas notificaciones.
3. Rechazo de inscripción a un evento lleno.
4. Rollback completo cuando falla la creación de la confirmación.
5. Cierre de inscripciones de un evento iniciado.
6. Autenticación y autorización para publicar e inscribirse.
7. Validaciones de fechas, capacidad y cuentas.
8. Hash de contraseña, normalización de correo y credenciales incorrectas.
9. Expiración y cierre de sesiones.
10. Búsqueda, filtros y tratamiento de comodines SQL como texto literal.
11. Privacidad de inscripciones y notificaciones por usuario.
12. Restricciones de sobrecupo, duplicados y claves foráneas en la base.
13. Flujo completo por HTTP y cookies de sesión.
14. Límites de cuerpo, formato JSON y rutas inexistentes.
15. Escritores concurrentes, persistencia tras reabrir la base e integridad.

## Concurrencia con conexiones independientes

La prueba crea un evento con tres cupos y ocho usuarios. Ocho workers abren conexiones separadas al mismo archivo SQLite, esperan una barrera común y solicitan inscripción al liberarla.

Resultado: **3 inscripciones aceptadas, 5 rechazadas por falta de cupo, 3 confirmaciones y 0 lugares disponibles**. El contador de ocupados queda en 3. Después se cierra y reabre la base; el resultado se conserva y `PRAGMA integrity_check` devuelve `ok`.

Esto verifica integridad con carga acotada. No constituye una prueba de capacidad para el escenario de 750,000 usuarios de la fase 2.

## Navegador y experiencia de usuario

Se usó una base separada `tmp/ui-verification.sqlite` en un servidor local de prueba. Se completaron por la interfaz:

- Registro de un organizador y de un participante.
- Publicación de un evento futuro con capacidad 2.
- Cierre de sesión y entrada con la cuenta del participante.
- Consulta e inscripción; la disponibilidad pasó de 2 a 1.
- Consulta de la inscripción propia y de su confirmación.
- Marcado de la notificación como leída y persistencia después de recargar.

En el catálogo de demostración se verificaron búsqueda, estado sin resultados, restauración del catálogo y filtro por categoría. Se revisaron escritorio (1440 px) y móvil (390 px), incluyendo el detalle en modal. La revisión móvil no detectó desbordamiento horizontal. La consola del navegador no registró errores durante estas comprobaciones.

Evidencia visual:

- [Catálogo de escritorio](evidencia/escritorio.png).
- [Catálogo móvil](evidencia/movil.png).
- [Detalle móvil](evidencia/detalle-movil.png).
- [Confirmación persistida](evidencia/confirmacion.png).

## Documentación e informe

La propuesta cubre los cuatro puntos de la fase 1: alcance del MVP; arquitectura, responsabilidades, relaciones, datos y comunicaciones; dependencias justificadas; versión ejecutable y flujo completo. El informe PDF tiene cinco páginas, renderizadas y revisadas visualmente para comprobar tablas, diagrama, márgenes y texto.

## Límites de esta evidencia

Se verificó SQLite, no PostgreSQL; aplicación local, no despliegue productivo; notificaciones internas, no entrega de correo. `node:sqlite` es experimental en la versión usada y SQLite permite un único escritor. Los límites y decisiones de alcance están documentados en la propuesta y en README.
