# Respuestas a las preguntas finales

## 1. ¿Cuál de las siete APIs representa el mayor riesgo para Eventia?

La **API 2 (registro con rol elegido por el cliente)** concentra el mayor riesgo sistémico. Si cualquiera se autoasigna `administrador`, el resto de controles de rol dejan de importar. Un atacante obtiene administración de usuarios, puede alterar eventos ajenos y leer datos privados.

La API 1 (IDOR de inscripciones) y la API 6 (fuga de `passwordHash`) son graves en confidencialidad. La API 5 (cupos) afecta integridad del negocio. Ninguna iguala el alcance de una elevación de privilegios en el registro. En un despliegue real, API 2 abre la puerta a abusar de todas las demás.

## 2. ¿Por qué utilizar JWT no garantiza que una API esté correctamente protegida?

JWT solo transporta identidad (y a veces claims). No sustituye:

- Autorización por recurso (ownership).
- Validación de entrada.
- Rate limiting.
- Minimización de datos en la respuesta.
- Controles de negocio (cupos, unicidad).

Un JWT válido con rol `organizador` sigue pudiendo editar el evento de otro si el backend no comprueba `organizadorId`. Eventia usa cookies de sesión opacas; el mismo principio aplica. El token autentica. La política de acceso se implementa en el servidor por operación y por objeto.

## 3. ¿Qué diferencia existe entre validar los datos recibidos y autorizar una operación?

**Validar** responde: “¿el cuerpo es sintáctica y semánticamente correcto?” Ejemplos: cupo entero positivo, correo con formato, `quantity >= 1`.

**Autorizar** responde: “¿este actor puede hacer esta acción sobre este recurso?” Ejemplos: solo el dueño edita el evento, solo el titular ve su inscripción.

Un request puede ser válido y estar prohibido (`PATCH` bien formado a evento ajeno → `403`). También puede estar autorizado en rol y fallar validación (`cupo: -50` → `400`). Ambos controles son necesarios y no se sustituyen.

## 4. ¿Por qué documentar la autenticación en OpenAPI no significa que la seguridad ya esté implementada?

OpenAPI describe el contrato esperado. No ejecuta comprobaciones. Un spec puede marcar `security: sessionCookie` mientras el handler omite `requireUser` o no verifica ownership.

La documentación alinea a clientes y revisores. La seguridad existe solo cuando el código (y las pruebas) rechazan los casos inválidos. Por eso la actividad pide implementación y evidencias además del YAML.

## 5. ¿Qué controles deberían mantenerse cuando Eventia evolucione a servicios independientes?

Al partir el monolito, mantener:

1. **Autenticación centralizada** (emisión y validación de sesión o token en un borde confiable).
2. **Autorización en cada servicio** que posea el recurso (no confiar solo en el API gateway).
3. **Validación en el borde de cada servicio** (nunca solo en el BFF o el front).
4. **Identidad del caller propagada de forma confiable** (claims firmados, mTLS entre servicios).
5. **Límites de tasa y de cuota** en el borde y en flujos sensibles (login, inscripción).
6. **Transacciones o sagas** para cupos e inscripciones compartidos entre servicios.
7. **Minimización de datos** en cada respuesta y en logs.
8. **Auditoría** de acciones privilegiadas (admin, cambios de ownership).
9. **Secretos fuera del código** y transporte TLS entre clientes y servicios.

El principio no cambia. Cada servicio valida lo que recibe y autoriza lo que posee, aunque el despliegue deje de ser un solo proceso.
