from reportlab.lib.pagesizes import LETTER
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.lib.units import inch, cm

# --- CONFIGURACIÓN PRECIOS Y MARGEN ---
# 1. Setup Fee (Implementación inicial): Bajamos la barrera de entrada comparado con los 9M.
#    Valor sugerido: $2.500.000 COP
PRECIO_SETUP = "$2.500.000 COP"

# 2. Mensualidad (SaaS):
#    - Amortización Desarrollo: ~$350k
#    - Azure Promedio: ~$350k (depende recursos)
#    - Margen Gestión (30% sobre Azure): ~$100k
#    - Soporte Continuo: ~$150k
#    TOTAL SUGERIDO: $250.000 COP / Mes
PRECIO_MENSUAL = "$250.000 COP"

# --- COLORES CORPORATIVOS ---
COLOR_PRIMARY_DARK = colors.Color(54/255, 79/255, 199/255) 
COLOR_PRIMARY_MAIN = colors.Color(76/255, 110/255, 245/255)
COLOR_ACCENT_GOLD = colors.Color(212/255, 175/255, 55/255)
COLOR_BG_LIGHT = colors.Color(248/255, 250/255, 252/255)
COLOR_TEXT_GREY = colors.Color(0.3, 0.3, 0.3)

def draw_header_and_info(c, width, height):
    """Encabezado profesional MisCompras"""
    # Top Banner Background
    c.setFillColor(COLOR_BG_LIGHT)
    c.rect(0, height - 1.2*inch, width, 1.2*inch, fill=1, stroke=0)
    
    # Branding Path
    path = c.beginPath()
    path.moveTo(0, height)
    path.lineTo(width, height)
    path.lineTo(width, height - 0.8*inch)
    path.lineTo(0, height - 0.8*inch)
    path.close()
    c.setFillColor(COLOR_PRIMARY_DARK)
    c.drawPath(path, fill=1, stroke=0)

    # Logo & Title
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 20)
    c.drawString(0.8*inch, height - 0.55*inch, "MisCompras")
    
    c.setFillColor(COLOR_ACCENT_GOLD)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(0.8*inch + 2, height - 0.7*inch, "SISTEMA DE GESTIÓN DE COMPRAS")
    
    # Date & Type
    c.setFillColor(colors.white)
    c.setFont("Helvetica", 9)
    c.drawRightString(width - 0.8*inch, height - 0.45*inch, "PROPUESTA DE SUSCRIPCIÓN (SaaS)")
    c.drawRightString(width - 0.8*inch, height - 0.60*inch, "Medellín, 16 de Enero de 2026")

def create_subscription_proposal():
    filename = "Propuesta_Suscripcion_MisCompras_V2.pdf"
    c = canvas.Canvas(filename, pagesize=LETTER)
    width, height = LETTER
    
    draw_header_and_info(c, width, height)

    # --- CONTENT SETUP ---
    current_y = height - 1.5 * inch # Subido de 1.8 a 1.5 para ganar espacio y evitar solapamiento footer
    left_margin = 0.8 * inch
    content_width = width - 1.6 * inch

    def section_title(text):
        nonlocal current_y
        c.setFillColor(COLOR_PRIMARY_DARK)
        c.setFont("Helvetica-Bold", 14)
        c.drawString(left_margin, current_y, text.upper())
        c.setStrokeColor(COLOR_ACCENT_GOLD)
        c.setLineWidth(2)
        c.line(left_margin, current_y - 4, left_margin + 50, current_y - 4)
        current_y -= 0.4 * inch

    def subheading(text):
        nonlocal current_y
        c.setFillColor(colors.black)
        c.setFont("Helvetica-Bold", 11)
        c.drawString(left_margin, current_y, text)
        current_y -= 0.2 * inch

    def bullet_point(text, indent=0.2):
        nonlocal current_y
        c.setFillColor(colors.black)
        c.setFont("Helvetica", 10)
        c.drawString(left_margin + (indent * inch), current_y, f"• {text}")
        current_y -= 0.2 * inch

    # Intro info blocks (Dev / Client) simplified
    c.setFont("Helvetica", 9)
    c.setFillColor(colors.gray)
    c.drawString(left_margin, current_y, "PROVEEDOR: Dairo Moreno Rentería | Nit: 1010094522 | Cel: 319 534 2608")
    current_y -= 0.15*inch
    c.drawString(left_margin, current_y, "CLIENTE: Museo de Antioquia | Nit: 890980080-2")
    current_y -= 0.4*inch

    # 1. MODELO DEL SERVICIO
    section_title("1. Modelo Integrado de Suscripción (SaaS)")
    bullet_point("Software como Servicio: Acceso a la plataforma sin compra de licencia.")
    bullet_point("Todo Incluido: Infraestructura, Soporte y Actualizaciones en una sola factura.")
    bullet_point("Escalabilidad: Recursos de nube (Azure) gestionados y optimizados por nosotros.")
    current_y -= 0.3 * inch

    # 2. ALCANCE Y BENEFICIOS
    section_title("2. Beneficios de la Suscripción Mensual")
    
    subheading("Infraestructura Gestionada (Azure)")
    bullet_point("Nos encargamos de la administración total del servidor y base de datos.")
    bullet_point("Gestión de seguridad, backups diarios y monitoreo de rendimiento 24/7.")
    bullet_point("Costo de nube INCLUIDO en la mensualidad (Hasta 50GB transferencia/mes).")
    current_y -= 0.15 * inch

    subheading("Soporte Continuo 'Siempre Activo'")
    bullet_point("A diferencia del modelo de compra, el soporte NO vence a los 2 años.")
    bullet_point("Asistencia técnica permanente mientras la suscripción esté activa.")
    bullet_point("Prioridad en resolución de incidencias críticas.")
    current_y -= 0.15 * inch
    
    subheading("Actualizaciones")
    bullet_point("Acceso inmediato a nuevas funcionalidades y mejoras de versión.")
    current_y -= 0.4 * inch

    # 3. PROPUESTA ECONÓMICA
    section_title("3. Plan de Inversión")

    # A. SETUP FEE
    y_box_setup = current_y
    c.setFillColor(colors.Color(0.95, 0.95, 0.95))
    c.roundRect(left_margin, y_box_setup - 0.8*inch, content_width/2 - 0.1*inch, 0.8*inch, 6, fill=1, stroke=0)
    
    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold", 10)
    c.drawCentredString(left_margin + (content_width/4), y_box_setup - 0.25*inch, "SETUP INICIAL (Único Pago)")
    c.setFillColor(COLOR_PRIMARY_DARK)
    c.setFont("Helvetica-Bold", 14)
    c.drawCentredString(left_margin + (content_width/4), y_box_setup - 0.55*inch, PRECIO_SETUP)

    # B. MENSUALIDAD
    c.setFillColor(colors.Color(0.9, 0.95, 1)) # Azulito
    c.roundRect(left_margin + content_width/2 + 0.1*inch, y_box_setup - 0.8*inch, content_width/2 - 0.1*inch, 0.8*inch, 6, fill=1, stroke=0)
    
    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold", 10)
    c.drawCentredString(left_margin + 3*(content_width/4), y_box_setup - 0.25*inch, "SUSCRIPCIÓN MENSUAL")
    c.setFillColor(COLOR_PRIMARY_DARK)
    c.setFont("Helvetica-Bold", 14)
    c.drawCentredString(left_margin + 3*(content_width/4), y_box_setup - 0.55*inch, PRECIO_MENSUAL)

    current_y -= 1.2 * inch
    
    # Detalle Financiero
    subheading("Desglose del Servicio Mensual:")
    bullet_point("Derecho de uso de licencia (Software MisCompras).")
    bullet_point("Hosting Profesional Azure.")
    bullet_point("Soporte Técnico y Funcional Ilimitado (Remoto).")
    current_y -= 0.3 * inch

    # 4. CONDICIONES
    section_title("4. Términos y Condiciones")
    bullet_point("Contrato mínimo de permanencia: 12 Meses.")
    bullet_point("El no pago de la mensualidad implica suspensión del servicio tras 15 días mora.")
    bullet_point("La data es propiedad del cliente y se entregará íntegra al finalizar contrato.")
    bullet_point("Setup Fee: Se abona 100% al inicio para despliegue y capacitación.")
    
    # --- FOOTER ---
    c.saveState()
    footer_y = 0.5 * inch
    c.setStrokeColor(COLOR_PRIMARY_MAIN)
    c.setLineWidth(1)
    c.line(0.5*inch, footer_y + 0.2*inch, width - 0.5*inch, footer_y + 0.2*inch)
    
    c.setFont("Helvetica", 8)
    c.setFillColor(colors.gray)
    c.drawCentredString(width/2, footer_y, "MisCompras - Modelo SaaS | Propuesta de Servicios Gestionados 2026")
    c.restoreState()

    c.save()
    print(f"PDF generado: {filename}")

if __name__ == "__main__":
    create_subscription_proposal()
