# Matriz de roles y permisos

Roles del enunciado: Visitante, Usuario registrado, Organizador, Administrador.

En Eventia implementado hoy existen `participant` (usuario registrado) y `organizer`. No hay rol administrador en código. La columna Administrador describe la política propuesta para cuando exista.

Convención: **P** = permitido. **D** = denegado. Las notas marcan condiciones de recurso (ownership), no solo de rol.

## Matriz

| Operación | Visitante | Usuario registrado | Organizador | Administrador |
|---|---|---|---|---|
| 1. Consultar eventos públicos | P | P | P | P |
| 2. Crear eventos | D | D | P | P (si la política lo delega) |
| 3. Modificar eventos propios | D | D | P solo si `organizadorId === actor.id` | P solo con auditoría y justificación |
| 4. Modificar eventos ajenos | D | D | D | P condicionado (soporte / moderación) |
| 5. Inscribirse en eventos | D | P (sesión + cupo) | P como participante | P si la política lo permite |
| 6. Consultar inscripciones propias | D | P (solo las suyas) | P (solo las suyas) | P con justificación |
| 7. Consultar inscripciones de un evento como organizador | D | D | P solo de eventos propios | P |
| 8. Administrar usuarios | D | D | D | P |

## Condiciones adicionales

1. **Consultar eventos públicos.** Sin autenticación. No incluye datos privados de inscritos.
2. **Crear eventos.** Exige autenticación y rol organizador (o administrador). El dueño del recurso nace de la sesión.
3. **Modificar eventos propios.** Tener rol organizador no basta. Hace falta ownership del evento concreto.
4. **Modificar eventos ajenos.** Un organizador no puede editar el de otro. Solo un administrador bajo política explícita.
5. **Inscribirse.** Usuario autenticado. `usuarioId` forzado desde la sesión. Cupo y unicidad en backend.
6. **Inscripciones propias.** Filtrar siempre por `actor.id`. Un `userId` de consulta ajeno se rechaza.
7. **Inscripciones del evento (organizador).** Solo si el actor es dueño del evento (o admin).
8. **Administrar usuarios.** Crear, desactivar, cambiar roles privilegiados. Nunca expuesto a registro público.

## Rol frente a autorización de recurso

| Concepto | Significado |
|---|---|
| Rol | Capacidad global (p. ej. “puede publicar”). |
| Autorización de recurso | Derecho sobre un objeto concreto (p. ej. “este evento es mío”). |

Fallar solo el chequeo de rol deja abierta la API 4 del caso (organizador edita eventos ajenos). Fallar solo el de objeto deja abierta la API 1 (lectura de inscripción ajena).
