# Auditoría de las siete APIs

Caso de estudio de la Actividad 23. Las APIs descritas abajo son el diseño inseguro del enunciado. La referencia de riesgos es [OWASP API Security Top 10 (2023)](https://owasp.org/API-Security/).

## Tabla resumen

| API | Problema identificado | Riesgo OWASP API | Solución propuesta |
|---|---|---|---|
| API 1 | `GET /api/inscripciones/{id}` solo comprueba que la inscripción exista. No verifica que pertenezca al solicitante. | **API1** Broken Object Level Authorization (BOLA / IDOR). Secundario: **API3** si se filtran campos de otras personas. | Exigir autenticación. Autorizar por titular (`usuarioId === usuario autenticado`) o por organizador del evento asociado. Responder `404` o `403` si no hay derecho. No filtrar datos ajenos. |
| API 2 | `POST /api/usuarios` persiste el `rol` enviado por el cliente. Un atacante se registra como `administrador`. | **API5** Broken Function Level Authorization (elevación de privilegios). También **API3** Broken Object Property Level Authorization (mass assignment). | Lista blanca de campos. Ignorar o forzar `rol` (por defecto `usuario`). Solo un administrador autenticado puede asignar roles privilegiados. Validar correo y política de contraseña. |
| API 3 | `POST /api/eventos` acepta `cupo` y `precio` negativos. Cualquier usuario autenticado puede crear eventos. | **API5** Broken Function Level Authorization (falta de rol). Validación ausente se alinea con diseño inseguro / abuso de recurso (**API4** si se abusa del cupo). | Autenticación + rol `organizador`. Validar título no vacío, cupo entero `> 0`, precio `≥ 0`. Rechazar propiedades no permitidas. |
| API 4 | `PUT /api/eventos/{id}` exige rol organizador, pero no comprueba ownership. Un organizador edita eventos ajenos. | **API1** Broken Object Level Authorization. | Tras autenticar y comprobar rol, exigir `evento.organizadorId === usuario.id`. Actualización condicionada en persistencia. |
| API 5 | `POST /api/eventos/{id}/inscripciones` acepta `cantidad: 500` sin tope por usuario. No hay control seguro de cupos bajo concurrencia. | **API4** Unrestricted Resource Consumption. **API6** Unrestricted Access to Sensitive Business Flows (flujo de inscripción). | Límite de cantidad por solicitud y por usuario. Reserva atómica (`UPDATE` condicional o bloqueo de fila). Transacción. Rechazar si no hay cupo. |
| API 6 | `GET /api/usuarios/{id}` devuelve `passwordHash`, teléfono y rol aunque el front solo use nombre y correo. | **API3** Broken Object Property Level Authorization (exposición excesiva de datos). | DTO público con campos mínimos. Nunca devolver hashes ni secretos. Autorizar quién puede ver el perfil (propio, admin, o vista pública reducida). |
| API 7 | `POST /api/auth/login` sin límite de intentos. Mensajes distintos para correo inexistente vs contraseña incorrecta. | **API2** Broken Authentication. | Rate limiting por IP y por cuenta. Mensaje genérico único. Comparación en tiempo constante. Bloqueo temporal o CAPTCHA tras umbral. |

## Detalle por API

### API 1. Consulta de inscripciones

1. **Qué está mal.** Autorización a nivel de objeto ausente. Conocer o adivinar un `id` basta para leer la inscripción.
2. **Consecuencias.** Lectura de PII (nombre, correo), enumeración de asistentes, preparación de fraude o phishing.
3. **OWASP.** API1 (principal).
4. **Control.** Autenticación + comprobación de titularidad o de rol de organizador del evento.

### API 2. Registro de usuarios

1. **Qué está mal.** Confianza en el cliente para el campo `rol`.
2. **Consecuencias.** Escalada a administrador, bypass de toda la matriz de permisos.
3. **OWASP.** API5 (principal), API3 (mass assignment).
4. **Control.** El servidor asigna el rol. Separar registro público de administración de usuarios.

### API 3. Creación de eventos

1. **Qué está mal.** Sin validación de negocio y sin restricción de función (quién puede crear).
2. **Consecuencias.** Eventos con cupo o precio absurdos, spam de publicaciones, integridad de negocio rota.
3. **OWASP.** API5 (quién crea). Validación de entrada como control obligatorio asociado.
4. **Control.** Rol organizador + validaciones numéricas y de esquema.

### API 4. Modificación de eventos

1. **Qué está mal.** Autorización por rol sin ownership.
2. **Consecuencias.** Sabotaje de eventos ajenos, cambio de cupos o precios, daño reputacional.
3. **OWASP.** API1.
4. **Control.** `organizadorId` del recurso igual al actor. Diferenciar rol de permiso sobre el recurso.

### API 5. Inscripciones

1. **Qué está mal.** Sin tope de cantidad y sin reserva concurrente segura.
2. **Consecuencias.** Acaparamiento de cupos, sobrecupo real, venta o reventa fraudulenta de plazas.
3. **OWASP.** API4 y API6.
4. **Control.** `cantidad` acotada, transacción, actualización condicional del cupo ocupado.

### API 6. Consulta de usuarios

1. **Qué está mal.** Respuesta con propiedades sensibles (`passwordHash`).
2. **Consecuencias.** Material para offline cracking, fuga de teléfono y rol, reutilización de credenciales.
3. **OWASP.** API3.
4. **Control.** Serialización explícita. El hash nunca sale del almacén.

### API 7. Inicio de sesión

1. **Qué está mal.** Fuerza bruta ilimitada y enumeración de cuentas por mensaje.
2. **Consecuencias.** Compromiso de cuentas débiles, mapa de correos registrados.
3. **OWASP.** API2.
4. **Control.** Rate limit, respuesta uniforme, hashing lento (scrypt/argon2), registro de intentos fallidos.

## Nota sobre Eventia implementado

El repositorio Eventia ya mitiga varios de estos riesgos en rutas equivalentes (`/api/registrations`, `/api/events`, `/api/auth/login`). La evidencia de dos controles concretos está en [05-evidencias-controles.md](05-evidencias-controles.md).
