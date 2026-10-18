# Actividad 23. Eventia: de una API insegura a un diseño seguro

Paquete de entrega alineado con el enunciado del curso Programación Web (URL / campus Quetzaltenango).

## Entregables

| # | Entregable | Archivo |
|---|---|---|
| 1 | Auditoría de las siete APIs (problema, OWASP API Top 10, solución) | [01-auditoria-apis.md](01-auditoria-apis.md) |
| 2 | Rediseño de las siete operaciones | [02-rediseno-operaciones.md](02-rediseno-operaciones.md) |
| 3 | Matriz de roles y permisos | [03-matriz-permisos.md](03-matriz-permisos.md) |
| 4 | OpenAPI de tres endpoints corregidos | [openapi.yaml](openapi.yaml) |
| 5 | Evidencias de dos controles implementados y probados | [05-evidencias-controles.md](05-evidencias-controles.md) |
| 6 | Enlace al repositorio | https://github.com/carloshugoeg/Eventia |
| 7 | Respuestas a las preguntas finales | [06-preguntas-finales.md](06-preguntas-finales.md) |

## Controles en código

Los dos controles exigidos están en el repositorio (ownership en `PATCH /api/events/:id` y validación de `quantity` / cupos). Ver evidencias y `npm test`.

## Verificación del paquete

```bash
node scripts/check-actividad-23.js
npm test
```
