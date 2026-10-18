"""Genera el PDF de entrega de la Actividad 23. Dependencia: reportlab."""
from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    PageBreak,
    Paragraph,
    Preformatted,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'output/pdf/Eventia_Actividad_23.pdf'
OUTPUT.parent.mkdir(parents=True, exist_ok=True)

GREEN = colors.HexColor('#154f46')
INK = colors.HexColor('#19362f')
MUTED = colors.HexColor('#607265')
LINE = colors.HexColor('#dce1d3')
PAPER = colors.HexColor('#f7f7f0')

font_candidates = [
    Path('/System/Library/Fonts/Supplemental/Arial.ttf'),
    Path('/Library/Fonts/Arial Unicode.ttf'),
    Path('C:/Windows/Fonts/arial.ttf'),
]
bold_candidates = [
    Path('/System/Library/Fonts/Supplemental/Arial Bold.ttf'),
    Path('C:/Windows/Fonts/arialbd.ttf'),
]

BODY, BOLD = 'Helvetica', 'Helvetica-Bold'
for regular, bold in zip(font_candidates, bold_candidates):
    if regular.exists() and bold.exists():
        pdfmetrics.registerFont(TTFont('Body', str(regular)))
        pdfmetrics.registerFont(TTFont('BodyBold', str(bold)))
        pdfmetrics.registerFontFamily('Body', normal='Body', bold='BodyBold')
        BODY, BOLD = 'Body', 'BodyBold'
        break

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name='CoverTitle', fontName=BOLD, fontSize=22, leading=28, textColor=GREEN, alignment=TA_CENTER, spaceAfter=12))
styles.add(ParagraphStyle(name='CoverSub', fontName=BODY, fontSize=11, leading=16, textColor=INK, alignment=TA_CENTER, spaceAfter=8))
styles.add(ParagraphStyle(name='CoverMeta', fontName=BODY, fontSize=9, leading=13, textColor=MUTED, alignment=TA_CENTER, spaceAfter=6))
styles.add(ParagraphStyle(name='Text', fontName=BODY, fontSize=9.2, leading=13.5, textColor=INK, spaceAfter=8))
styles.add(ParagraphStyle(name='Lead', fontName=BODY, fontSize=10.5, leading=15, textColor=INK, spaceAfter=12))
styles.add(ParagraphStyle(name='Section', fontName=BOLD, fontSize=16, leading=21, textColor=GREEN, spaceBefore=4, spaceAfter=12))
styles.add(ParagraphStyle(name='Sub', fontName=BOLD, fontSize=11, leading=15, textColor=GREEN, spaceBefore=10, spaceAfter=7))
styles.add(ParagraphStyle(name='SmallText', fontName=BODY, fontSize=8, leading=11.5, textColor=MUTED, spaceAfter=6))
styles.add(ParagraphStyle(name='Cell', fontName=BODY, fontSize=7.4, leading=10.5, textColor=INK))
styles.add(ParagraphStyle(name='HeadCell', fontName=BOLD, fontSize=7.6, leading=10.5, textColor=colors.white))
styles.add(ParagraphStyle(name='BulletItem', fontName=BODY, fontSize=9.2, leading=13.5, textColor=INK, leftIndent=12, spaceAfter=4))
styles.add(ParagraphStyle(
    name='CodeBlock', fontName='Courier', fontSize=6.8, leading=9.5, textColor=INK,
    backColor=PAPER, borderPadding=8, spaceAfter=10
))

story = []


def p(text, style='Text'):
    story.append(Paragraph(text, styles[style]))


def section(number, title):
    p(f'ENTREGABLE {number}', 'SmallText')
    p(title, 'Section')


def table(headers, rows, widths):
    values = [[Paragraph(escape(str(v)), styles['HeadCell']) for v in headers]]
    values += [[Paragraph(escape(str(v)), styles['Cell']) for v in row] for row in rows]
    result = Table(values, colWidths=widths, repeatRows=1, hAlign='LEFT')
    result.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), GREEN),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [PAPER, colors.white]),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LINEBELOW', (0, 0), (-1, 0), 0.5, GREEN),
        ('LINEBELOW', (0, 1), (-1, -1), 0.35, LINE),
    ]))
    story.append(result)
    story.append(Spacer(1, 10))


def footer(canvas, doc):
    canvas.saveState()
    canvas.setFont(BODY, 8)
    canvas.setFillColor(MUTED)
    canvas.drawString(2 * cm, 1.2 * cm, 'Eventia · Actividad 23 · Programación Web')
    canvas.drawRightString(A4[0] - 2 * cm, 1.2 * cm, f'{doc.page}')
    canvas.restoreState()


# --- Portada ---
story.append(Spacer(1, 2.2 * cm))
p('Universidad Rafael Landívar', 'CoverMeta')
p('Campus San Alberto Hurtado, S.J. de Quetzaltenango', 'CoverMeta')
p('Curso: Programación Web · Docente: Ing. Manuel Rojas', 'CoverMeta')
story.append(Spacer(1, 1.2 * cm))
p('Eventia: de una API insegura a un diseño seguro', 'CoverTitle')
p('Actividad 23 · Entrega completa', 'CoverSub')
story.append(Spacer(1, 0.8 * cm))
p('Integrantes', 'CoverSub')
p('ESCOBAR GÓMEZ CARLOS HUGO · Carné est1563824', 'CoverMeta')
p('GARCÍA COYOY HÉCTOR JORDIN ADOLFO · Carné est2427124', 'CoverMeta')
story.append(Spacer(1, 1.2 * cm))
p(
    'Repositorio: <link href="https://github.com/carloshugoeg/Eventia">'
    'https://github.com/carloshugoeg/Eventia</link>',
    'CoverSub'
)
p('Contenido: auditoría, rediseño, matriz de permisos, OpenAPI, evidencias de controles y preguntas finales.', 'CoverMeta')
story.append(PageBreak())

# --- Entregable 1 ---
section('1', 'Auditoría de las siete APIs')
p('Caso del enunciado. Riesgos según OWASP API Security Top 10 (2023).', 'Lead')
table(
    ['API', 'Problema identificado', 'Riesgo OWASP API', 'Solución propuesta'],
    [
        [
            'API 1',
            'GET /api/inscripciones/{id} solo comprueba existencia. No verifica titularidad.',
            'API1 Broken Object Level Authorization (BOLA/IDOR). Secundario: API3.',
            'Autenticación + titularidad o organizador del evento. 403/404 sin filtrar datos ajenos.',
        ],
        [
            'API 2',
            'POST /api/usuarios persiste el rol enviado por el cliente (p. ej. administrador).',
            'API3 Broken Object Property Level Authorization (mass assignment). Secundario: API5.',
            'Ignorar rol del cliente. Asignar usuario por defecto. Solo admin puede promover roles.',
        ],
        [
            'API 3',
            'POST /api/eventos acepta cupo/precio negativos. Cualquier autenticado puede crear.',
            'API5 Broken Function Level Authorization. Validación de entrada aparte.',
            'Rol organizador. Cupo > 0, precio ≥ 0, título requerido. Rechazar campos extra.',
        ],
        [
            'API 4',
            'PUT /api/eventos/{id} exige rol organizador pero no ownership.',
            'API1 Broken Object Level Authorization.',
            'Exigir evento.organizadorId === actor.id. UPDATE condicionado.',
        ],
        [
            'API 5',
            'POST inscripciones con cantidad 500 y sin control concurrente de cupos.',
            'API6 Unrestricted Access to Sensitive Business Flows. Secundario: API4.',
            'Tope de cantidad, transacción, UPDATE occupied < capacity.',
        ],
        [
            'API 6',
            'GET /api/usuarios/{id} devuelve passwordHash y campos sensibles.',
            'API3 Broken Object Property Level Authorization (exposición excesiva).',
            'DTO mínimo. Nunca devolver hashes. Autorizar vista de perfil.',
        ],
        [
            'API 7',
            'Login sin rate limit. Mensajes distintos para correo vs contraseña.',
            'API2 Broken Authentication.',
            'Rate limit, mensaje genérico, comparación timing-safe, hashing lento.',
        ],
    ],
    [42, 145, 145, 145],
)
p('Detalle (problema, consecuencia, OWASP, control)', 'Sub')
detalle = [
    ('API 1', 'Sin autorización a nivel de objeto.', 'Fuga de PII y enumeración de asistentes.', 'API1', 'Auth + titularidad.'),
    ('API 2', 'Mass assignment del rol.', 'Escalada a administrador y bypass de permisos.', 'API3', 'Rol asignado por el servidor.'),
    ('API 3', 'Sin rol ni validación de cupo/precio.', 'Spam de eventos e integridad rota.', 'API5', 'Organizador + validaciones.'),
    ('API 4', 'Rol sin ownership.', 'Sabotaje de eventos ajenos.', 'API1', 'Ownership obligatorio.'),
    ('API 5', 'Sin tope ni reserva atómica.', 'Acaparamiento y sobrecupo.', 'API6', 'Cantidad acotada + SQL condicional.'),
    ('API 6', 'Exposición de passwordHash.', 'Material para cracking offline.', 'API3', 'Serialización explícita.'),
    ('API 7', 'Fuerza bruta y enumeración.', 'Compromiso de cuentas y mapa de correos.', 'API2', 'Rate limit + mensaje único.'),
]
for api, mal, cons, owasp, ctrl in detalle:
    p(f'<b>{api}.</b> Qué está mal: {mal} Consecuencia: {cons} OWASP: {owasp}. Control: {ctrl}')
story.append(PageBreak())

# --- Entregable 2 ---
section('2', 'Rediseño de las siete operaciones')
p('Cada operación define método, acceso, datos, validaciones, autorización, respuesta y errores.', 'Lead')

ops = [
    (
        '1. Consulta de inscripción propia',
        'GET /api/inscripciones/{id} (Eventia: GET /api/registrations)',
        'Listar solo inscripciones del caller.',
        'Usuario autenticado (titular).',
        'Sesión válida. userId ajeno → 403.',
        'Filtrar por actor.id.',
        '200 { registrations }. 401 / 403.',
    ),
    (
        '2. Registro de usuarios',
        'POST /api/usuarios (Eventia: POST /api/auth/register)',
        'Crear cuenta con rol por defecto seguro.',
        'Visitante.',
        'Nombre, correo, password. Ignorar rol del cliente.',
        'Servidor asigna participant/usuario.',
        '201 perfil público + cookie. 400 / 409 / 429.',
    ),
    (
        '3. Creación de eventos',
        'POST /api/eventos (Eventia: POST /api/events)',
        'Publicar evento del organizador.',
        'Organizador autenticado.',
        'Título, cupo > 0, precio ≥ 0 (si aplica), fecha futura.',
        'rol organizador. organizadorId desde sesión.',
        '201 Created. 400 / 401 / 403.',
    ),
    (
        '4. Modificación de eventos',
        'PUT /api/eventos/{id} (Eventia: PATCH /api/events/{id})',
        'Actualizar evento propio.',
        'Organizador dueño.',
        'Mismas validaciones que creación. Cupo ≥ occupied.',
        'rol + organizadorId === actor.id.',
        '200. 400 / 401 / 403 / 404.',
    ),
    (
        '5. Inscripción a un evento',
        'POST /api/eventos/{id}/inscripciones (Eventia: .../registrations)',
        'Reservar plaza del usuario autenticado.',
        'Usuario registrado.',
        'cantidad ≥ 1 y ≤ máximo (Eventia: solo 1).',
        'usuarioId desde sesión. Reserva atómica.',
        '201. 400 / 401 / 404 / 409.',
    ),
    (
        '6. Consulta de perfil',
        'GET /api/usuarios/{id} (Eventia: GET /api/auth/me)',
        'Perfil según nivel de acceso, sin secretos.',
        'Propietario / admin / vista pública mínima.',
        'id válido.',
        'Nunca passwordHash.',
        '200 campos mínimos. 401 / 403 / 404.',
    ),
    (
        '7. Inicio de sesión',
        'POST /api/auth/login',
        'Verificar credenciales e iniciar sesión.',
        'Visitante.',
        'correo + password. Rate limit.',
        'Mensaje genérico de fallo. Cookie HttpOnly.',
        '200 + cookie. 401 / 429 / 400.',
    ),
]
for title, endpoint, funcion, quien, valid, authz, resp in ops:
    p(title, 'Sub')
    p(f'<b>Endpoint:</b> {escape(endpoint)}')
    p(f'<b>Función:</b> {escape(funcion)}')
    p(f'<b>Quién:</b> {escape(quien)}')
    p(f'<b>Validaciones:</b> {escape(valid)}')
    p(f'<b>Autorización:</b> {escape(authz)}')
    p(f'<b>Respuestas / errores:</b> {escape(resp)}')
story.append(PageBreak())

# --- Entregable 3 ---
section('3', 'Matriz de roles y permisos')
p('P = permitido. D = denegado. Ownership es condición de recurso, no solo de rol.', 'Lead')
table(
    ['Operación', 'Visitante', 'Usuario registrado', 'Organizador', 'Administrador'],
    [
        ['1. Consultar eventos públicos', 'P', 'P', 'P', 'P'],
        ['2. Crear eventos', 'D', 'D', 'P', 'P (si política)'],
        ['3. Modificar eventos propios', 'D', 'D', 'P si es dueño', 'P con auditoría'],
        ['4. Modificar eventos ajenos', 'D', 'D', 'D', 'P condicionado'],
        ['5. Inscribirse en eventos', 'D', 'P (sesión+cupo)', 'P como participante', 'P si política'],
        ['6. Consultar inscripciones propias', 'D', 'P (solo suyas)', 'P (solo suyas)', 'P justificado'],
        ['7. Inscripciones del evento (organizador)', 'D', 'D', 'P eventos propios', 'P'],
        ['8. Administrar usuarios', 'D', 'D', 'D', 'P'],
    ],
    [150, 70, 95, 95, 95],
)
p(
    '<b>Rol vs recurso.</b> El rol es capacidad global (puede publicar). '
    'La autorización de recurso es derecho sobre un objeto concreto (este evento es mío). '
    'Fallar solo el rol abre la API 4. Fallar solo el objeto abre la API 1.'
)
p(
    'En Eventia hoy existen participant y organizer. La columna Administrador es política propuesta.'
)
story.append(PageBreak())

# --- Entregable 4 ---
section('4', 'Documentación OpenAPI (tres endpoints)')
p(
    'Spec completo en docs/actividad-23/openapi.yaml. Autenticación: cookie eventia_session. '
    'Alineado al rediseño y a la implementación.',
    'Lead',
)
p('PATCH /api/events/{id} — modificar evento propio', 'Sub')
p('Acceso: organizador dueño. Body: title, description, category, location, starts_at, capacity.')
p('200 { event }. 400 (incl. CAPACITY_TOO_LOW). 401. 403 evento ajeno. 404.')
p('POST /api/events/{id}/registrations — inscribirse', 'Sub')
p('Acceso: autenticado. Body JSON obligatorio ({} o { quantity: 1 }). Solo quantity = 1.')
p('201 { registration, notification, event }. 400 INVALID_QUANTITY. 401. 404. 409. 415.')
p('GET /api/registrations — listar propias', 'Sub')
p('Acceso: autenticado. Query userId solo si coincide con la sesión.')
p('200 { registrations } con event anidado. 401. 403 si userId ajeno.')
openapi_excerpt = '''openapi: 3.0.3
info:
  title: Eventia API (endpoints corregidos)
  version: 1.0.0
paths:
  /api/events/{id}:
    patch:
      security: [{ sessionCookie: [] }]
      summary: Modificar un evento propio
  /api/events/{id}/registrations:
    post:
      security: [{ sessionCookie: [] }]
      summary: Inscribirse en un evento
  /api/registrations:
    get:
      security: [{ sessionCookie: [] }]
      summary: Listar inscripciones propias
components:
  securitySchemes:
    sessionCookie:
      type: apiKey
      in: cookie
      name: eventia_session'''
story.append(Preformatted(openapi_excerpt, styles['CodeBlock']))
story.append(PageBreak())

# --- Entregable 5 ---
section('5', 'Evidencias de dos controles implementados')
p('Control 1. Ownership al modificar eventos (API 4)', 'Sub')
p('<b>1. Comportamiento anterior.</b> Un PATCH/PUT que solo exigía rol organizador permitía alterar eventos ajenos.')
p('<b>2. Problema.</b> OWASP API1 Broken Object Level Authorization.')
p(
    '<b>3. Modificación.</b> PATCH /api/events/:id. events.update exige organizer_id === user.id. '
    'UPDATE con WHERE id AND organizer_id. UI solo al dueño.'
)
p('<b>4. Prueba válida.</b> Organizador A hace PATCH de su evento → 200, título actualizado.')
p('<b>5. Prueba no autorizada.</b> Organizador B hace PATCH al mismo id → 403 FORBIDDEN.')
p('<b>6. Resultado.</b> Solo el dueño modifica. Cubierto por npm test (fase 3 ownership / HTTP PATCH ajeno).')

p('Control 2. Cantidad de inscripción y cupos (API 5)', 'Sub')
p('<b>1. Comportamiento anterior.</b> cantidad: 500 sin tope y sin reserva concurrente segura.')
p('<b>2. Problema.</b> OWASP API6 (principal); API4 secundario.')
p(
    '<b>3. Modificación.</b> quantity entero ≥ 1 y solo 1. reservePlace si available ≥ 1. '
    'SQL occupied &lt; capacity en transacción BEGIN IMMEDIATE. Concurrencia 8 vs 3 plazas.'
)
p('<b>4. Prueba válida.</b> POST .../registrations con {} o { quantity: 1 } → 201.')
p('<b>5. Prueba inválida.</b> quantity 0/-1/2 → 400 INVALID_QUANTITY. Tercera plaza con cupo 2 → 409 EVENT_FULL.')
p('<b>6. Resultado.</b> Backend rechaza abuso y mantiene cupo. Cubierto por npm test.')
p('Reproducción: npm test · Casos fase 3 ownership, quantity y HTTP rechazo.', 'SmallText')
story.append(PageBreak())

# --- Entregable 6 ---
section('6', 'Enlace al repositorio')
p('https://github.com/carloshugoeg/Eventia', 'Lead')
p('Paquete de la Actividad 23 en docs/actividad-23/. Controles en código y pruebas en tests/eventia.test.js.')
p('Verificación: node scripts/check-actividad-23.js && npm test')
story.append(PageBreak())

# --- Entregable 7 ---
section('7', 'Respuestas a las preguntas finales')
p('1. ¿Cuál de las siete APIs representa el mayor riesgo?', 'Sub')
p(
    'La API 2 (registro con rol elegido por el cliente). Si cualquiera se autoasigna administrador, '
    'el resto de controles de rol dejan de importar. API 1 y API 6 son graves en confidencialidad; '
    'API 5 afecta integridad del negocio. Ninguna iguala el alcance de esa elevación de privilegios.'
)
p('2. ¿Por qué JWT no garantiza que una API esté protegida?', 'Sub')
p(
    'JWT transporta identidad (y claims). No sustituye autorización por recurso, validación, '
    'rate limiting, minimización de datos ni reglas de negocio. Un JWT con rol organizador sigue '
    'pudiendo editar un evento ajeno si el backend no comprueba organizadorId. El token autentica; '
    'la política se implementa en el servidor.'
)
p('3. ¿Diferencia entre validar datos y autorizar una operación?', 'Sub')
p(
    'Validar: ¿el cuerpo es sintáctica y semánticamente correcto? (cupo entero positivo, quantity ≥ 1). '
    'Autorizar: ¿este actor puede hacer esta acción sobre este recurso? Un request puede ser válido '
    'y estar prohibido (403), o autorizado y fallar validación (400). Ambos son necesarios.'
)
p('4. ¿Por qué documentar autenticación en OpenAPI no implementa seguridad?', 'Sub')
p(
    'OpenAPI describe el contrato. No ejecuta comprobaciones. Un spec puede marcar security mientras '
    'el handler omite requireUser u ownership. La seguridad existe cuando el código y las pruebas rechazan '
    'los casos inválidos.'
)
p('5. ¿Qué controles mantener con servicios independientes?', 'Sub')
for item in [
    'Autenticación centralizada en un borde confiable.',
    'Autorización en cada servicio que posea el recurso.',
    'Validación en el borde de cada servicio.',
    'Identidad del caller propagada de forma confiable (claims firmados / mTLS).',
    'Límites de tasa en login e inscripción.',
    'Transacciones o sagas para cupos compartidos.',
    'Minimización de datos en respuestas y logs.',
    'Auditoría de acciones privilegiadas.',
    'Secretos fuera del código y TLS entre clientes y servicios.',
]:
    p(f'• {item}', 'BulletItem')

doc = SimpleDocTemplate(
    str(OUTPUT),
    pagesize=A4,
    leftMargin=1.7 * cm,
    rightMargin=1.7 * cm,
    topMargin=1.6 * cm,
    bottomMargin=2 * cm,
    title='Eventia Actividad 23',
    author='Eventia / Programación Web',
)
doc.build(story, onFirstPage=footer, onLaterPages=footer)
print(OUTPUT)
