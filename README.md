# Eventia · Fase 1

MVP funcional de una plataforma para descubrir eventos, publicarlos e inscribirse con control de cupos. Implementa un **monolito modular**, una interfaz web adaptable y persistencia relacional local.

## Ejecutar

Requisito: **Node.js 24.13 o una versión posterior de la rama 24**. No se necesitan paquetes npm, una cuenta externa ni credenciales de base de datos.

Desde esta carpeta, en PowerShell:

```powershell
npm.cmd run seed
npm.cmd start
```

Abre **http://localhost:3000**. En otras terminales se puede usar `npm` en lugar de `npm.cmd`.

El servidor crea `data/eventia.sqlite` automáticamente. Los datos sobreviven al reinicio. `seed` agrega los datos de demostración sin borrar registros existentes; conviene ejecutarlo antes de iniciar el servidor. Para trabajar sin datos de ejemplo, ejecuta solo `npm.cmd start`.

Para detener el servidor, usa `Ctrl+C` en su terminal. Para desarrollar con reinicio automático: `npm.cmd run dev`.

## Cuentas de demostración

Todas usan la contraseña **`Eventia2026!`**, exclusivamente para esta demostración local.

| Cuenta | Correo | Permisos |
|---|---|---|
| Organizador | `organizador@eventia.demo` | Publicar eventos y participar |
| Andrea | `andrea@eventia.demo` | Consultar e inscribirse |
| Diego | `diego@eventia.demo` | Consultar e inscribirse |

Las cuentas de demostración solo se crean mediante `seed`. También puedes crear tus propias cuentas desde la interfaz. El tipo de cuenta se elige al registrarse; el MVP permite que cualquier persona sea organizadora.

Se incluyen seis eventos con fechas futuras relativas al momento de ejecutar `seed`. Uno se llama **«Laboratorio de ideas: última plaza»** y tiene capacidad de una persona. Volver a ejecutar `seed` no cambia las fechas ni reinicia los cupos de eventos existentes.

## Entregables de la actividad

- [Propuesta completa de fase 1](docs/fase-1.md): definición del MVP, decisiones, componentes, responsabilidades, relaciones, almacenamiento y comunicaciones.
- [Diagrama de arquitectura](docs/arquitectura.svg), editable como [Mermaid](docs/arquitectura.mmd).
- [Guía de demostración y criterios de aceptación](docs/demostracion.md).
- [API y estructura del código](docs/api.md).
- [Resultados de verificación](docs/verificacion.md).
- [Auditoría de seguridad (fase 2)](docs/auditoria-seguridad-fase-2.md).
- [Controles de seguridad implementados (fase 3)](docs/fase-3-controles-seguridad.md).
- [Actividad 23: auditoría, rediseño, permisos y evidencias](docs/actividad-23-seguridad-apis.md).
- [OpenAPI Actividad 23 (tres endpoints)](docs/openapi-actividad-23.yaml).
- [Informe PDF Actividad 23](output/pdf/Eventia_Actividad_23.pdf) (incluye el enlace al repositorio al inicio).
- [Informe para entregar (Fase 1)](output/pdf/Eventia_Fase_1.pdf).
- Aplicación ejecutable en `src/` y `public/`; esquema SQL en `database/schema.sql`.

**Repositorio:** https://github.com/carloshugoeg/Eventia

## Verificación

```powershell
npm.cmd run check
npm.cmd test
```

Los tests trabajan con bases aisladas y no modifican los datos de demostración. Incluyen el flujo completo, sobrecupo, duplicados, permisos, privacidad, edición solo por el organizador dueño, cantidad de inscripción inválida, persistencia y rollback. Una prueba abre **ocho conexiones independientes**, las libera simultáneamente y comprueba que solo **tres** consiguen las **tres plazas** disponibles.

## Estructura

```text
src/
  server.js                 Arranque y configuración
  app.js                    Composición e inyección de dependencias
  http/server.js            Rutas/controladores HTTP y sesiones
  infrastructure/database.js Conexión y unidad de trabajo
  shared/errors.js          Errores y validaciones comunes
  modules/
    users/                  Usuarios y sesiones
    events/                 Eventos y control de cupos
    registrations/          Inscripciones y coordinación del flujo
    notifications/          Confirmaciones internas
public/                     Interfaz, estilos e ilustraciones SVG
database/schema.sql         Tablas, índices y restricciones
tests/                      Tests de integración, HTTP y concurrencia
docs/                       Propuesta, diagramas y evidencia
scripts/                    Datos de demostración, sintaxis e informe
```

Cada módulo tiene `service.js` y `repository.js`. Los repositorios conocen SQL; los servicios aplican reglas y se comunican mediante contratos internos. Inscripciones no modifica las tablas de Eventos o Notificaciones directamente. Todas las operaciones del flujo de inscripción comparten una conexión y transacción.

## Decisiones y límites actuales

- **SQLite sustituye a PostgreSQL en esta entrega local** para que pueda ejecutarse sin credenciales o servicios adicionales. Conserva la arquitectura relacional, las transacciones y las restricciones. No se incluye un adaptador PostgreSQL ni se afirma haber probado ese motor.
- `node:sqlite` es experimental en la versión de Node usada. Su advertencia al arrancar es esperada. Se fija la rama de Node y se verificó la versión 24.13.0.
- SQLite permite un escritor a la vez; las llamadas a la base son síncronas. Es adecuado para el alcance local de esta fase, pero limita la concurrencia y puede bloquear brevemente el proceso. La reserva usa `BEGIN IMMEDIATE`, WAL, espera de bloqueo y una actualización condicional. No se propone distribuir el archivo de SQLite entre servidores.
- El contador `occupied` se guarda para la actualización condicional; solo se modifica junto con una inscripción, dentro de una transacción. La disponibilidad es `capacity - occupied`.
- Las confirmaciones son notificaciones persistidas **dentro de la plataforma**. No se envían correos, SMS ni mensajes externos.
- Los módulos comparten despliegue y base de datos; no pueden escalarse o desplegarse individualmente en esta versión.
- Los eventos son gratuitos, sin cancelaciones, edición, pagos, listas de espera, reportes ni administración avanzada. Las reglas de cancelación y cambios de capacidad quedan para después.
- Las fechas se almacenan en UTC y se presentan con la zona `America/Guatemala`. El formulario de publicación declara UTC-6.
- Autenticación con scrypt y salt aleatorio; sesiones de siete días con token aleatorio cuyo hash se almacena; cookies `HttpOnly`, `SameSite=Strict`; comprobación de origen y consultas parametrizadas.
- El servidor se vincula a `127.0.0.1` por defecto. La entrega se verifica como MVP local. Para publicarlo se requiere configurar HTTPS, origen, cookies seguras y operación del servicio.

Opcionalmente copia `.env.example` como `.env` para cambiar puerto y ruta de datos. El programa lo carga automáticamente. No sobrescribas una base existente para repetir la demostración: usa una ruta nueva mediante `DATABASE_PATH`.

El informe PDF de Fase 1 se regenera con `python scripts/generate_report.py` si Python dispone de `reportlab`. El PDF de la Actividad 23 se regenera con `python scripts/generate_actividad_23_report.py`. La aplicación no necesita Python. Las imágenes y logs de evidencia se guardan en `docs/evidencia/`.
