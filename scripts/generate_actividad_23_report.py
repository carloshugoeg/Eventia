"""Genera el PDF de entregables de la Actividad 23. Requiere reportlab."""
from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    KeepTogether,
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
REPO = 'https://github.com/carloshugoeg/Eventia'

GREEN = colors.HexColor('#154f46')
INK = colors.HexColor('#19362f')
MUTED = colors.HexColor('#607265')
LINE = colors.HexColor('#dce1d3')
PAPER = colors.HexColor('#f7f7f0')
ACCENT = colors.HexColor('#2a6b5e')

font_candidates = [
    Path('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'),
    Path('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'),
]
if font_candidates[0].exists():
    pdfmetrics.registerFont(TTFont('Body', str(font_candidates[0])))
    pdfmetrics.registerFont(TTFont('BodyBold', str(font_candidates[1])))
    pdfmetrics.registerFontFamily('Body', normal='Body', bold='BodyBold')
    BODY, BOLD = 'Body', 'BodyBold'
else:
    BODY, BOLD = 'Helvetica', 'Helvetica-Bold'

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name='CoverTitle', fontName=BOLD, fontSize=22, leading=28, textColor=GREEN, alignment=TA_CENTER, spaceAfter=10))
styles.add(ParagraphStyle(name='CoverSub', fontName=BODY, fontSize=11, leading=16, textColor=INK, alignment=TA_CENTER, spaceAfter=8))
styles.add(ParagraphStyle(name='RepoLink', fontName=BOLD, fontSize=12, leading=16, textColor=ACCENT, alignment=TA_CENTER, spaceAfter=18))
styles.add(ParagraphStyle(name='Text', fontName=BODY, fontSize=9.2, leading=13.5, textColor=INK, spaceAfter=8))
styles.add(ParagraphStyle(name='Lead', fontName=BODY, fontSize=10.5, leading=15, textColor=INK, spaceAfter=12))
styles.add(ParagraphStyle(name='Section', fontName=BOLD, fontSize=14, leading=18, textColor=GREEN, spaceBefore=6, spaceAfter=10))
styles.add(ParagraphStyle(name='Sub', fontName=BOLD, fontSize=10.5, leading=14, textColor=GREEN, spaceBefore=8, spaceAfter=6))
styles.add(ParagraphStyle(name='SmallText', fontName=BODY, fontSize=8, leading=11, textColor=MUTED, spaceAfter=6))
styles.add(ParagraphStyle(name='Cell', fontName=BODY, fontSize=7.4, leading=10.2, textColor=INK))
styles.add(ParagraphStyle(name='HeadCell', fontName=BOLD, fontSize=7.6, leading=10, textColor=colors.white))
styles.add(ParagraphStyle(name='Item', fontName=BODY, fontSize=9, leading=13, textColor=INK, leftIndent=12, spaceAfter=4))
styles.add(ParagraphStyle(
    name='CodeBlock', fontName='Courier', fontSize=7.2, leading=10,
    textColor=INK, backColor=PAPER, borderPadding=8, spaceAfter=10
))

story = []


def p(text, style='Text'):
    story.append(Paragraph(text, styles[style]))


def section(title):
    p(title, 'Section')


def table(headers, rows, widths):
    values = [[Paragraph(escape(str(v)), styles['HeadCell']) for v in headers]]
    values += [[Paragraph(escape(str(v)), styles['Cell']) for v in row] for row in rows]
    result = Table(values, colWidths=widths, repeatRows=1, hAlign='LEFT')
    result.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), GREEN),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [PAPER, colors.white]),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LINEBELOW', (0, 0), (-1, 0), 0.5, GREEN),
        ('LINEBELOW', (0, 1), (-1, -1), 0.3, LINE),
    ]))
    story.append(result)
    story.append(Spacer(1, 10))


# --- Portada / enlace al repo primero ---
story.append(Spacer(1, 1.2 * cm))
p('Universidad Rafael Landívar', 'CoverSub')
p('Campus San Alberto Hurtado, S.J. de Quetzaltenango', 'SmallText')
p('Curso: Programación Web · Ing. Manuel Rojas', 'SmallText')
story.append(Spacer(1, 0.6 * cm))
p('Actividad 23', 'SmallText')
p('Eventia: de una API insegura a un diseño seguro', 'CoverTitle')
p('Entregables completos de la auditoría, rediseño, permisos, OpenAPI, controles y respuestas.', 'Lead')
story.append(Spacer(1, 0.4 * cm))
p('Enlace al repositorio actualizado', 'Sub')
p(f'<link href="{REPO}">{REPO}</link>', 'RepoLink')
p('El contenido de los entregables continúa a continuación.', 'Text')

story.append(PageBreak())

# --- 1. Auditoría ---
section('1. Auditoría de las siete APIs')
p(
    'Se analizaron las siete APIs del enunciado. Algunas presentan más de un riesgo; '
    'se indica el principal según OWASP API Security Top 10.'
)
table(
    ['API', 'Problema identificado', 'Riesgo OWASP API', 'Solución propuesta'],
    [
        [
            'API 1\nGET /api/inscripciones/125',
            'Solo comprueba que exista la inscripción; no verifica pertenencia al solicitante (IDOR).',
            'API1 Broken Object Level Authorization',
            'Exigir autenticación y que inscripcion.usuarioId == usuario.id. Responder 403/404 sin filtrar datos ajenos.',
        ],
        [
            'API 2\nPOST /api/usuarios',
            'Mass assignment: el cliente envía rol administrador y el backend lo persiste.',
            'API3 Broken Object Property Level Authorization (también API5)',
            'Lista blanca de campos; rol por defecto; rechazar administrador desde el cliente.',
        ],
        [
            'API 3\nPOST /api/eventos',
            'Cupo/precio negativos sin validar; cualquier autenticado puede crear eventos.',
            'API4 Unrestricted Resource Consumption + API5 Broken Function Level Authorization',
            'Validar cupo > 0 y precio >= 0; exigir rol organizador; rechazar propiedades no permitidas.',
        ],
        [
            'API 4\nPUT /api/eventos/25',
            'Verifica rol organizador pero no ownership del evento.',
            'API1 Broken Object Level Authorization',
            'Comprobar evento.organizadorId == usuario.id además del rol.',
        ],
        [
            'API 5\nPOST …/inscripciones',
            'Sin tope de cantidad por usuario; cupos inseguros bajo concurrencia.',
            'API4 Unrestricted Resource Consumption / diseño inseguro',
            'Limitar cantidad (p. ej. 1); reserva atómica/condicional en transacción.',
        ],
        [
            'API 6\nGET /api/usuarios/35',
            'Devuelve passwordHash y campos sensibles aunque el front solo usa nombre/correo.',
            'API3 Broken Object Property Level Authorization',
            'DTO público sin secretos; datos sensibles solo para titular o admin.',
        ],
        [
            'API 7\nPOST /api/auth/login',
            'Intentos ilimitados; mensajes distintos revelan si el correo existe.',
            'API2 Broken Authentication (+ API8 por mensajes)',
            'Rate limiting; mensaje genérico; hashing con tiempo comparable.',
        ],
    ],
    [72, 150, 120, 145],
)

p('<b>Consecuencias:</b> fuga de PII (API 1/6), elevación a administrador (API 2), inventario corrupto y spam (API 3), '
  'sabotaje de eventos ajenos (API 4), acaparamiento/sobrecupo (API 5), fuerza bruta y enumeración de cuentas (API 7).', 'Text')

story.append(PageBreak())

# --- 2. Rediseño ---
section('2. Rediseño de las siete operaciones')
p('Las rutas del MVP Eventia usan inglés (/api/events, /api/registrations, …). El rediseño conserva la intención de cada API del enunciado.')

redesigns = [
    ('API 1 — Consulta de inscripción', [
        'Método/ruta: GET /api/registrations (listado propio).',
        'Función: devolver solo inscripciones del usuario autenticado.',
        'Quién: usuario registrado (titular).',
        'Validaciones: sesión válida; rechazar userId ajeno.',
        'Autorización: recursos con user_id === sesión.id.',
        'Respuesta: 200 con lista propia. Errores: 401, 403, 404.',
    ]),
    ('API 2 — Registro de usuarios', [
        'Método/ruta: POST /api/auth/register.',
        'Datos: name, email, password; role opcional ∈ {participant, organizer}.',
        'Validaciones: correo válido; contraseña 8–128; lista blanca de rol; nunca administrador.',
        'Respuesta: 201 + cookie. Errores: 400, 409, 429.',
    ]),
    ('API 3 — Creación de eventos', [
        'Método/ruta: POST /api/events.',
        'Acceso: organizador autenticado.',
        'Datos: title, description, category, location, starts_at, capacity.',
        'Controles: autenticación, rol, cupo 1–10000, fecha futura, categoría en lista.',
        'Respuestas: 201 / 400 / 401 / 403.',
    ]),
    ('API 4 — Modificación de eventos', [
        'Método/ruta: PATCH /api/events/{id}.',
        'Acceso: organizador dueño (rol + ownership).',
        'Controles: organizer_id === user.id; cupo >= ocupados.',
        'Respuestas: 200 / 400 / 401 / 403 / 404.',
    ]),
    ('API 5 — Inscripciones', [
        'Método/ruta: POST /api/events/{id}/registrations.',
        'Datos: quantity opcional (solo 1).',
        'Controles: quantity >= 1 y = 1; transacción; UPDATE condicional de cupo.',
        'Respuestas: 201 / 400 / 401 / 409.',
    ]),
    ('API 6 — Consulta de usuarios', [
        'Método/ruta: GET /api/auth/me.',
        'Respuesta pública: { id, name, email, role } o null. Nunca password_hash.',
    ]),
    ('API 7 — Inicio de sesión', [
        'Método/ruta: POST /api/auth/login.',
        'Controles: rate limit 30/IP/min; mensaje genérico; scrypt + timingSafeEqual.',
        'Respuestas: 200 / 400 / 401 genérico / 429.',
    ]),
]

for title, bullets in redesigns:
    block = [Paragraph(title, styles['Sub'])]
    for item in bullets:
        block.append(Paragraph(f'• {escape(item)}', styles['Item']))
    story.append(KeepTogether(block))

story.append(PageBreak())

# --- 3. Matriz ---
section('3. Matriz de roles y permisos')
p('Tener un rol no equivale a estar autorizado sobre un recurso concreto. El organizador solo modifica eventos propios.')
table(
    ['Operación', 'Visitante', 'Usuario', 'Organizador', 'Administrador*'],
    [
        ['Consultar eventos públicos', 'Permitido', 'Permitido', 'Permitido', 'Permitido'],
        ['Crear eventos', 'Denegado', 'Denegado', 'Permitido', 'Permitido'],
        ['Modificar eventos propios', 'Denegado', 'Denegado', 'Permitido si es dueño', 'Permitido'],
        ['Modificar eventos ajenos', 'Denegado', 'Denegado', 'Denegado', 'Permitido'],
        ['Inscribirse en eventos', 'Denegado', 'Permitido', 'Permitido', 'Permitido'],
        ['Consultar inscripciones propias', 'Denegado', 'Solo las suyas', 'Solo las suyas', 'Permitido'],
        ['Consultar inscritos de un evento (org.)', 'Denegado', 'Denegado', 'Si es dueño del evento', 'Permitido'],
        ['Administrar usuarios', 'Denegado', 'Denegado', 'Denegado', 'Permitido'],
    ],
    [150, 78, 78, 100, 80],
)
p('* En el MVP actual no existe rol administrador en runtime; la columna define la política objetivo.', 'SmallText')

# --- 4. OpenAPI ---
section('4. Documentación OpenAPI (tres endpoints)')
p('Archivo en el repositorio: docs/openapi-actividad-23.yaml')
p('Coincide con permisos y validaciones de la Fase 2 (rediseño).')
table(
    ['Endpoint', 'Acceso', 'Autenticación', 'Códigos clave'],
    [
        ['POST /api/events', 'Organizador', 'Cookie eventia_session', '201, 400, 401, 403'],
        ['PATCH /api/events/{eventId}', 'Organizador dueño', 'Cookie eventia_session', '200, 400, 401, 403, 404'],
        ['POST /api/events/{id}/registrations', 'Usuario autenticado', 'Cookie eventia_session', '201, 400, 401, 409'],
    ],
    [170, 100, 120, 120],
)

openapi_excerpt = """# Fragmento OpenAPI 3.0.3
paths:
  /api/events:
    post:
      security: [{ sessionCookie: [] }]
      summary: Publicar un evento
      responses:
        '201': { description: Evento creado }
        '403': { description: Sin rol organizador }
  /api/events/{eventId}:
    patch:
      security: [{ sessionCookie: [] }]
      summary: Modificar evento propio (ownership)
      responses:
        '200': { description: Actualizado }
        '403': { description: Evento ajeno }
  /api/events/{eventId}/registrations:
    post:
      security: [{ sessionCookie: [] }]
      summary: Inscribirse (quantity = 1)
      responses:
        '201': { description: Confirmada }
        '400': { description: INVALID_QUANTITY }"""
story.append(Preformatted(openapi_excerpt, styles['CodeBlock']))

story.append(PageBreak())

# --- 5. Evidencias ---
section('5. Evidencias de dos controles implementados')

p('Control A — Ownership en modificación de eventos (API 4)', 'Sub')
table(
    ['Elemento', 'Detalle'],
    [
        ['Comportamiento anterior', 'Riesgo de que un organizador altere eventos ajenos si solo se valida el rol.'],
        ['Problema de seguridad', 'OWASP API1 Broken Object Level Authorization.'],
        ['Modificación realizada', 'PATCH /api/events/:id exige event.organizer_id === user.id en el servicio.'],
        ['Prueba con datos válidos', 'Dueño actualiza título → HTTP 200.'],
        ['Prueba no autorizada', 'Otro organizador o participante → HTTP 403 FORBIDDEN.'],
        ['Resultado', 'Tests: fase 3 ownership + HTTP PATCH ajeno. Archivos: events/service.js, http/server.js.'],
    ],
    [130, 380],
)

p('Control B — Cantidad de inscripción y anti-sobrecupo (API 5)', 'Sub')
table(
    ['Elemento', 'Detalle'],
    [
        ['Comportamiento anterior', 'Riesgo de quantity arbitraria y carrera de cupos.'],
        ['Problema de seguridad', 'OWASP API4 Unrestricted Resource Consumption / diseño inseguro.'],
        ['Modificación realizada', 'quantity entero >= 1 y solo 1; reserva SQL condicional en transacción.'],
        ['Prueba con datos válidos', 'quantity: 1 u omitido → HTTP 201.'],
        ['Prueba inválida', '0, -1 o 2 → 400 INVALID_QUANTITY; cupo agotado → 409; 8 hilos vs 3 cupos → solo 3 OK.'],
        ['Resultado', 'Tests fase 3 quantity + concurrencia. Archivos: registrations/service.js, events/service.js.'],
    ],
    [130, 380],
)

p('Evidencia automatizada (npm test): 19/19 pruebas pasaron, incluidas las de Fase 3 / Actividad 23.', 'Text')
evidence_path = ROOT / 'docs/evidencia/actividad-23-pruebas.txt'
if evidence_path.exists():
    lines = evidence_path.read_text(encoding='utf-8', errors='replace').splitlines()
    interesting = [ln for ln in lines if 'fase 3' in ln.lower() or ln.startswith('# tests') or ln.startswith('# pass') or ln.startswith('# fail') or 'HTTP fase 3' in ln or 'concurrentes' in ln]
    snippet = '\n'.join(interesting[-20:]) if interesting else '\n'.join(lines[-25:])
    story.append(Preformatted(snippet[:1800], styles['CodeBlock']))

# --- 6. Repo ---
section('6. Enlace al repositorio')
p(f'<link href="{REPO}"><b>{REPO}</b></link>', 'Lead')
p('Documentación adicional en el repo: docs/actividad-23-seguridad-apis.md, docs/openapi-actividad-23.yaml, docs/fase-3-controles-seguridad.md.', 'Text')

# --- 7. Preguntas ---
section('7. Respuestas a las preguntas finales')
answers = [
    (
        '1. ¿Cuál de las siete APIs representa el mayor riesgo?',
        'La API 2 (registro con asignación de rol). Un atacante se convierte en administrador y puede abusar del resto de operaciones. '
        'Las APIs 1 y 6 son graves por fuga de PII/hashes, pero la elevación de privilegios compromete el control de toda la plataforma.',
    ),
    (
        '2. ¿Por qué utilizar JWT no garantiza que una API esté protegida?',
        'JWT solo acredita identidad/firma (autenticación). Sin autorización por recurso, validación, rate limiting y diseño de permisos, '
        'un token válido puede leer o modificar objetos ajenos.',
    ),
    (
        '3. ¿Qué diferencia existe entre validar los datos y autorizar una operación?',
        'Validar comprueba forma y reglas del payload (p. ej. cupo > 0). Autorizar decide si ese sujeto puede ejecutar la acción sobre ese recurso '
        '(p. ej. si es el dueño del evento).',
    ),
    (
        '4. ¿Por qué documentar la autenticación en OpenAPI no significa que la seguridad ya esté implementada?',
        'OpenAPI es contrato/documentación. Los controles reales viven en el código (middleware, servicios, SQL). '
        'Un esquema con security no rechaza por sí solo una petición.',
    ),
    (
        '5. ¿Qué controles mantener al evolucionar a servicios independientes?',
        'Autenticación centralizada o tokens cortos; autorización en cada servicio; validación en cada borde; rate limiting; '
        'auditoría; secretos fuera del código; TLS; least privilege entre servicios (identidades de servicio / mTLS).',
    ),
]
for q, a in answers:
    p(q, 'Sub')
    p(a, 'Text')

story.append(Spacer(1, 16))
p(f'Repositorio: {REPO}', 'SmallText')
p('Generado para la Actividad 23 · Programación Web · Eventia', 'SmallText')


def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.4)
    canvas.line(1.6 * cm, 1.4 * cm, A4[0] - 1.6 * cm, 1.4 * cm)
    canvas.setFont(BODY, 8)
    canvas.setFillColor(MUTED)
    canvas.drawString(1.6 * cm, 0.9 * cm, 'Eventia · Actividad 23')
    canvas.drawRightString(A4[0] - 1.6 * cm, 0.9 * cm, f'Página {doc.page}')
    canvas.restoreState()


doc = SimpleDocTemplate(
    str(OUTPUT),
    pagesize=A4,
    leftMargin=1.6 * cm,
    rightMargin=1.6 * cm,
    topMargin=1.6 * cm,
    bottomMargin=2 * cm,
    title='Eventia — Actividad 23',
    author='Eventia',
)
doc.build(story, onFirstPage=footer, onLaterPages=footer)
print(f'PDF generado: {OUTPUT}')
