# Actividad 24. Eventia: autenticación y control de acceso

Este paquete responde el enunciado de Programación Web. El mecanismo elegido es la sesión de servidor que Eventia ya usa. Un evento cuyo `starts_at` guardado ya pasó rechaza el `PATCH` del dueño con `409 EVENT_CLOSED`.

## Entregables

| # | Entregable | Archivo |
|---|---|---|
| 1 | Comparación y justificación del mecanismo | [01-mecanismo-autenticacion.md](01-mecanismo-autenticacion.md) |
| 2 | Diagrama del flujo de autenticación | [02-diagrama-flujo.md](02-diagrama-flujo.md) |
| 3 | Matriz de roles y permisos | [03-matriz-permisos.md](03-matriz-permisos.md) |
| 4 | Análisis de las situaciones A, B, C y D | [04-situaciones-acceso.md](04-situaciones-acceso.md) |
| 5 | Controles en el repositorio | [05-controles-implementados.md](05-controles-implementados.md) y https://github.com/carloshugoeg/Eventia |
| 6 | Evidencias de las seis pruebas | [06-evidencias-pruebas.md](06-evidencias-pruebas.md) y [evidencias/](evidencias/) |

## Reproducir

La contraseña de las cuentas sembradas es `Eventia2026!`, salvo que `DEMO_PASSWORD` indique otra.

```bash
npm test
npm run evidencias:actividad-24
npm run check:actividad-24
```

`npm run evidencias:actividad-24` ejecuta `docs/actividad-24/evidencias/capturar.sh`. Ese script siembra una base temporal, arranca el servidor en el puerto 39241 y escribe las transcripciones curl en `evidencias/`. Si el puerto está ocupado, libéralo y vuelve a ejecutar el comando.

## Entrega

1. Abre esta carpeta, `docs/actividad-24`.
2. Confirma el PDF del enunciado, este índice y los archivos `01` a `06`.
3. Confirma que `evidencias/` trae las transcripciones curl de las seis pruebas.
4. Comprime la carpeta completa.
5. Súbela a la plataforma del curso. Si piden el repositorio, usa https://github.com/carloshugoeg/Eventia.
