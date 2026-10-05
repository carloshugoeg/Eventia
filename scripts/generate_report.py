"""Genera el informe de fase 1. Dependencia opcional: reportlab."""
from pathlib import Path
from xml.sax.saxutils import escape
from reportlab.pdfgen import canvas
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, Flowable, Preformatted
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'output/pdf/Eventia_Fase_1.pdf'
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
GREEN = colors.HexColor('#154f46')
INK = colors.HexColor('#19362f')
MUTED = colors.HexColor('#607265')
LINE = colors.HexColor('#dce1d3')
PAPER = colors.HexColor('#f7f7f0')

font_dir = Path('C:/Windows/Fonts')
if (font_dir / 'arial.ttf').exists():
    pdfmetrics.registerFont(TTFont('Body', str(font_dir / 'arial.ttf')))
    pdfmetrics.registerFont(TTFont('BodyBold', str(font_dir / 'arialbd.ttf')))
    pdfmetrics.registerFontFamily('Body', normal='Body', bold='BodyBold')
    BODY, BOLD = 'Body', 'BodyBold'
else:
    BODY, BOLD = 'Helvetica', 'Helvetica-Bold'

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name='Text', fontName=BODY, fontSize=9.3, leading=14.1, textColor=INK, spaceAfter=9))
styles.add(ParagraphStyle(name='Lead', fontName=BODY, fontSize=11, leading=16, textColor=INK, spaceAfter=15))
styles.add(ParagraphStyle(name='Section', fontName=BOLD, fontSize=19, leading=25, textColor=GREEN, spaceAfter=14))
styles.add(ParagraphStyle(name='Sub', fontName=BOLD, fontSize=11.3, leading=16, textColor=GREEN, spaceBefore=8, spaceAfter=9))
styles.add(ParagraphStyle(name='SmallText', fontName=BODY, fontSize=8, leading=11.5, textColor=MUTED, spaceAfter=6))
styles.add(ParagraphStyle(name='Cell', fontName=BODY, fontSize=8.3, leading=12.1, textColor=INK))
styles.add(ParagraphStyle(name='HeadCell', fontName=BOLD, fontSize=8.5, leading=12, textColor=colors.white))
styles.add(ParagraphStyle(name='ReportCode', fontName='Courier', fontSize=7.6, leading=11.5, textColor=INK, backColor=PAPER, borderPadding=9, spaceAfter=12))
story = []

def p(text, style='Text'):
    story.append(Paragraph(text, styles[style]))

def title(number, text):
    p(f'FASE 1 / {number}', 'SmallText')
    p(text, 'Section')

def table(headers, rows, widths):
    values = [[Paragraph(escape(str(v)), styles['HeadCell']) for v in headers]]
    values += [[Paragraph(escape(str(v)), styles['Cell']) for v in row] for row in rows]
    result = Table(values, colWidths=widths, repeatRows=1, hAlign='LEFT')
    result.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), GREEN),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [PAPER, colors.white]),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 10), ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 9), ('BOTTOMPADDING', (0, 0), (-1, -1), 9),
        ('LINEBELOW', (0, 0), (-1, 0), .5, GREEN),
        ('LINEBELOW', (0, 1), (-1, -1), .35, LINE)
    ]))
    story.append(result)
    story.append(Spacer(1, 12))

class Architecture(Flowable):
    def __init__(self):
        Flowable.__init__(self)
        self.width = 511
        self.height = 272

    def draw(self):
        c = self.canv
        def box(x, y, w, h, label, color, light=False, sub=None):
            c.setFillColor(colors.HexColor(color)); c.roundRect(x, y, w, h, 6, fill=1, stroke=0)
            c.setFillColor(colors.white if light else INK); c.setFont(BOLD, 9)
            c.drawCentredString(x+w/2, y+h/2 + (4 if sub else -3), label)
            if sub:
                c.setFont(BODY, 7.2); c.drawCentredString(x+w/2, y+h/2-9, sub)
        def arrow(x1,y1,x2,y2):
            c.setStrokeColor(GREEN); c.setFillColor(GREEN); c.setLineWidth(.8); c.line(x1,y1,x2,y2)
            path = c.beginPath(); path.moveTo(x2,y2); path.lineTo(x2-2.5,y2+5); path.lineTo(x2+2.5,y2+5); path.close(); c.drawPath(path,fill=1,stroke=0)
        c.setFillColor(PAPER); c.roundRect(0,0,511,272,10,fill=1,stroke=0)
        box(157,234,197,29,'Usuario / Organizador','#e8eacb')
        arrow(255.5,234,255.5,219)
        c.setFillColor(colors.white); c.setStrokeColor(LINE); c.roundRect(10,22,491,197,8,fill=1,stroke=1)
        c.setFillColor(MUTED); c.setFont(BODY,7.5); c.drawString(20,204,'UNA APLICACIÓN NODE.JS')
        box(157,167,197,29,'Interfaz web','#dce7dd')
        arrow(255.5,167,255.5,155)
        box(157,127,197,28,'Controladores HTTP / API JSON','#154f46',True)
        c.setStrokeColor(GREEN); c.line(255.5,127,255.5,118); c.line(72,118,439,118)
        entries = [('Usuarios','#dce7dd','Identidad'),('Eventos','#efd7c4','Catálogo y cupos'),('Inscripciones','#dce1ed','Coordina reserva'),('Notificaciones','#e8dbde','Confirmación')]
        for i,(label,color,sub) in enumerate(entries):
            x=18+i*122
            arrow(x+54,118,x+54,107)
            box(x,75,108,32,label,color,sub=sub)
        arrow(255.5,69,255.5,56)
        box(90,29,331,28,'Repositorios propios + unidad de trabajo','#e8eacb')
        arrow(255.5,29,255.5,18)
        box(144,0,223,20,'SQLite: base relacional local','#154f46',True)


title('01', 'Eventia: definición del MVP')
p('Diseñar hoy, escalar mañana', 'Lead')
p('Universidad Rafael Landívar · Programación Web<br/>Docente: Ing. Manuel Rojas · 5 de octubre de 2026', 'SmallText')
p('<b>Problema:</b> conectar a quienes publican actividades con personas que quieren descubrirlas e inscribirse. La empresa inicia con un equipo pequeño y necesita validar el uso del producto.')
p('<b>Valor del MVP:</b> publicar un evento, encontrarlo y reservar una plaza con confirmación, manteniendo correctos los cupos.')
p('Incluimos en el MVP', 'Sub')
table(['Funcionalidad', 'Alcance y justificación'], [
    ['Registro de usuarios', 'Registro, inicio y cierre de sesión. Identifica a organizadores y participantes y protege datos propios.'],
    ['Publicación de eventos', 'Título, descripción, categoría, lugar, fecha y capacidad. Crea la oferta; solo organizadores.'],
    ['Consulta y búsqueda', 'Catálogo, detalle, búsqueda y filtro por categoría. Permite descubrir actividades relevantes.'],
    ['Inscripción', 'Una plaza por usuario y evento. Completa la acción principal del producto.'],
    ['Control de cupos', 'Disponibilidad visible y reserva transaccional. Impide exceder la capacidad.'],
    ['Consulta de inscripciones', 'Pantalla privada de inscripciones. Permite comprobar los planes confirmados.'],
    ['Notificación', 'Confirmación interna persistida y lectura. Da certeza de una inscripción exitosa.']
], [130,381])
p('Dejamos para después', 'Sub')
p('Pagos, QR y control de asistencia, cancelaciones y listas de espera, reportes avanzados y recomendaciones, correo/SMS y administración avanzada. Agregan reglas o dependencias que no son necesarias para validar el flujo inicial.')
p('La actividad no indica el canal de notificación: se adopta el canal interno de Eventia. La fase 2 queda fuera de esta entrega.', 'SmallText')
story.append(PageBreak())

title('02', 'Arquitectura inicial')
p('<b>Monolito modular</b>, organizado por funcionalidades, con capas sencillas y una base de datos relacional única. Una aplicación sirve la interfaz y atiende la API.')
story.append(Architecture()); story.append(Spacer(1,12))
p('Figura 1. Arquitectura física inicial. Las relaciones entre servicios se detallan en la página siguiente. Fuente editable: docs/arquitectura.mmd y docs/arquitectura.svg.', 'SmallText')
table(['Componente', 'Responsabilidad'], [
    ['Interfaz web', 'Catálogo, formularios, disponibilidad, inscripciones y notificaciones.'],
    ['Controladores HTTP', 'Enrutar, identificar sesión, interpretar JSON y devolver errores.'],
    ['Usuarios', 'Registro, contraseñas, identidad y sesiones.'],
    ['Eventos', 'Publicación, búsqueda, consulta y reserva de cupos.'],
    ['Inscripciones', 'Coordinar el flujo, impedir duplicados y consultar registros propios.'],
    ['Notificaciones', 'Crear, consultar y marcar confirmaciones internas como leídas.'],
    ['Persistencia', 'Repositorios por módulo y una unidad de trabajo con commit/rollback.']
], [136,375])
p('<b>Justificación:</b> responsabilidades cohesionadas, contratos internos y cambios localizados permiten evolucionar gradualmente. Un solo despliegue reduce la coordinación operativa del equipo pequeño. La clase distingue rendimiento de escalabilidad y exige evidencia antes de añadir complejidad.')
story.append(PageBreak())

title('03', 'Dependencias, datos y comunicaciones')
p('Dependencias justificadas', 'Sub')
table(['Componente', 'Se relaciona con', 'Qué necesita / contrato'], [
    ['Inscripciones', 'Usuarios', 'Validar identidad: ensureExists(userId).'],
    ['Inscripciones', 'Eventos', 'Reservar cupo y consultar estado: reservePlace y get.'],
    ['Inscripciones', 'Notificaciones', 'Guardar confirmación: confirmRegistration.'],
    ['Eventos', 'Usuarios', 'Identidad pública del organizador: ensureExists.'],
    ['Interfaz', 'Controladores HTTP', 'Consultar y solicitar acciones mediante API JSON.']
], [105,114,292])
p('No hay dependencias circulares entre servicios. Inscripciones no modifica directamente las tablas de otros módulos. El archivo src/app.js compone e inyecta las dependencias.')
p('Almacenamiento de datos', 'Sub')
table(['Tabla / propietario', 'Datos y reglas principales'], [
    ['users / Usuarios', 'Identidad, correo único, hash de contraseña y tipo de cuenta.'],
    ['sessions / Usuarios', 'Hash de token, usuario y vencimiento de siete días.'],
    ['events / Eventos', 'Información, organizador, fecha UTC, capacidad y ocupados.'],
    ['registrations / Inscripciones', 'Usuario, evento, fecha. UNIQUE(user_id, event_id).'],
    ['notifications / Notificaciones', 'Destinatario, inscripción única, mensaje, fecha y lectura.']
], [170,341])
p('Claves foráneas; capacidad entre 1 y 10,000; ocupados entre cero y capacidad. Disponibilidad = capacidad - ocupados. Contraseñas con scrypt y salt aleatorio; sesiones con cookie HttpOnly y SameSite=Strict.')
p('Comunicaciones', 'Sub')
p('Navegador/backend: HTTP local y JSON; HTTPS al desplegar. Entre módulos: llamadas síncronas dentro del proceso. Repositorios/base: SQL parametrizado sobre una conexión compartida. La notificación es interna; no hay broker ni proveedor externo.')
p('<b>Decisión de implementación:</b> SQLite local sustituye a PostgreSQL para arrancar sin credenciales o instalación adicional. Se conserva el modelo relacional. No se incluye ni se afirma haber probado una migración PostgreSQL.')
story.append(PageBreak())

title('04', 'Flujo completo y control de cupos')
p('Consultar evento → visualizar disponibilidad → inscribirse → actualizar cupo → recibir confirmación → consultar inscripción.', 'Lead')
table(['Paso', 'Comportamiento construido'], [
    ['1. Descubrir', 'El usuario consulta catálogo, busca y abre un detalle con disponibilidad.'],
    ['2. Identificarse', 'Inicia sesión o crea una cuenta; el servidor verifica la sesión.'],
    ['3. Iniciar transacción', 'Inscripciones usa BEGIN IMMEDIATE y comprueba duplicados.'],
    ['4. Reservar', 'Eventos incrementa ocupados solo si hay cupo y no ha empezado.'],
    ['5. Persistir', 'Se insertan la inscripción y la confirmación interna.'],
    ['6. Confirmar', 'COMMIT guarda todo; cualquier fallo produce ROLLBACK completo.'],
    ['7. Mostrar', 'Se actualiza disponibilidad y se muestran inscripción y notificación.']
], [117,394])
p('La disponibilidad de la pantalla es informativa. La reserva se valida nuevamente en el servidor y dentro de la transacción.')
story.append(Preformatted('BEGIN IMMEDIATE;\nUPDATE events SET occupied = occupied + 1\nWHERE id = ? AND occupied < capacity AND starts_at > ?;\n-- Debe actualizarse exactamente una fila.\nINSERT INTO registrations (...) VALUES (...);\nINSERT INTO notifications (...) VALUES (...);\nCOMMIT; -- ROLLBACK ante cualquier fallo', styles['ReportCode']))
p('El bloque anterior es un esquema explicativo. En el código, Inscripciones coordina los contratos de Eventos y Notificaciones; los repositorios ejecutan el SQL con la misma conexión. No se espera ninguna llamada externa durante la transacción.', 'SmallText')
p('Criterios de aceptación', 'Sub')
p('Registro y publicación funcionan; el usuario puede completar la inscripción y consultarla; recibe una confirmación persistida; duplicados y sobrecupo se rechazan; los datos son privados por usuario; un fallo revierte la operación; el estado sobrevive al reinicio.')
p('Reflejo en el código', 'Sub')
p('src/modules/registrations/service.js coordina el flujo. Eventos conserva las reglas de cupos; Notificaciones conserva la confirmación. src/infrastructure/database.js controla la transacción y database/schema.sql las restricciones.', 'SmallText')
story.append(PageBreak())

title('05', 'Ejecución, verificación y alcance')
p('<b>Requisito:</b> Node.js 24.13 o posterior dentro de la rama 24. No se necesitan paquetes npm ni credenciales externas.')
story.append(Preformatted('npm.cmd run seed\nnpm.cmd start\n# Abrir http://localhost:3000\n\nnpm.cmd run check\nnpm.cmd test', styles['ReportCode']))
table(['Cuenta de demostración', 'Correo'], [
    ['Organizador', 'organizador@eventia.demo'],
    ['Participante Andrea', 'andrea@eventia.demo'],
    ['Participante Diego', 'diego@eventia.demo']
], [172,339])
p('Contraseña de las tres cuentas: Eventia2026! Solo para demostración local. seed agrega seis eventos futuros, incluido uno de una plaza, sin borrar datos existentes.', 'SmallText')
p('Verificación realizada', 'Sub')
table(['Comprobación', 'Resultado'], [
    ['Sintaxis y tests', 'Sintaxis válida. 15 tests automatizados aprobados, sin fallos.'],
    ['Concurrencia real', 'Ocho conexiones independientes para tres plazas: tres inscripciones y tres confirmaciones.'],
    ['Integridad y rollback', 'Duplicados y sobrecupo rechazados; fallo simulado revierte cupo e inscripción.'],
    ['HTTP y privacidad', 'Cookies, autenticación, roles, origen, límites de entrada y datos por titular verificados.'],
    ['Navegador', 'Registro, publicación, inscripción, consulta y lectura de confirmación; persistencia tras recarga.'],
    ['Diseño adaptable', 'Revisión de catálogo y detalle en escritorio y móvil; evidencia en docs/evidencia/.']
], [146,365])
p('Límites documentados', 'Sub')
p('Un despliegue; SQLite con un escritor a la vez y acceso síncrono; node:sqlite experimental en Node 24.13. Confirmaciones internas, eventos gratuitos y sin cancelaciones. La entrega se verifica localmente, sin operación productiva ni fase 2.', 'SmallText')
p('Referencias y entregables', 'Sub')
p('Manuel Rojas: clase 21 (diapositivas 10-19, 21-22) y Actividad 21 (fase 1, páginas 1-2). Documentación oficial de Node.js 24 y SQLite consultada para implementación. Martin Fowler: Monolith First. Referencias completas: docs/fase-1.md.', 'SmallText')
p('Propuesta editable: docs/fase-1.md. Arquitectura: docs/arquitectura.svg y .mmd. Guía: docs/demostracion.md. API: docs/api.md. Evidencia: docs/verificacion.md. Aplicación: src/ y public/. Esquema: database/schema.sql.', 'SmallText')

def footer(c, doc):
    c.saveState()
    width, height = A4
    c.setStrokeColor(LINE); c.line(42,height-36,width-42,height-36)
    c.setFont(BOLD,8); c.setFillColor(GREEN); c.drawString(42,height-27,'EVENTIA')
    c.setFont(BODY,7.5); c.setFillColor(MUTED); c.drawRightString(width-42,height-27,'DISEÑAR HOY, ESCALAR MAÑANA · FASE 1')
    c.line(42,35,width-42,35); c.setFont(BODY,7.3)
    c.drawString(42,22,'Programación Web · Universidad Rafael Landívar')
    c.drawRightString(width-42,22,f'{doc.page}')
    c.restoreState()

doc = SimpleDocTemplate(str(OUTPUT), pagesize=A4, leftMargin=42, rightMargin=42,
    topMargin=49, bottomMargin=48, title='Eventia - Fase 1: MVP y arquitectura', author='Proyecto Eventia')
doc.build(story, onFirstPage=footer, onLaterPages=footer)
print(OUTPUT)
