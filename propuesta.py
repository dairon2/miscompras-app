from reportlab.lib.pagesizes import LETTER
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.lib.units import inch, cm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import Paragraph, Frame, Table, TableStyle

# --- COLORES CORPORATIVOS ---
COLOR_PRIMARY_DARK = colors.Color(54/255, 79/255, 199/255) # Indigo 900
COLOR_PRIMARY_MAIN = colors.Color(76/255, 110/255, 245/255) # Indigo 500
COLOR_ACCENT_GOLD = colors.Color(212/255, 175/255, 55/255)
COLOR_BG_LIGHT = colors.Color(248/255, 250/255, 252/255)
COLOR_TEXT_GREY = colors.Color(0.3, 0.3, 0.3)

def draw_header_and_info(c, width, height):
    """Encabezado profesional con información de Desarrollador y Cliente"""
    # 1. Top Banner Background
    c.setFillColor(COLOR_BG_LIGHT)
    c.rect(0, height - 2.8*inch, width, 2.8*inch, fill=1, stroke=0)
    
    # 2. Main Header Branding
    path = c.beginPath()
    path.moveTo(0, height)
    path.lineTo(width, height)
    path.lineTo(width, height - 1.0*inch)
    path.lineTo(0, height - 1.0*inch)
    path.close()
    c.setFillColor(COLOR_PRIMARY_DARK)
    c.drawPath(path, fill=1, stroke=0)

    # Logo & Title
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 28)
    c.drawString(0.8*inch, height - 0.65*inch, "MisCompras")
    
    c.setFillColor(COLOR_ACCENT_GOLD)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(0.8*inch, height - 0.85*inch, "SISTEMA DE GESTIÓN DE COMPRAS")

    # Fecha
    c.setFillColor(colors.white)
    c.setFont("Helvetica", 10)
    c.drawRightString(width - 0.8*inch, height - 0.7*inch, "Medellín, 16 de Enero de 2026")

    # 3. Info Block (Developer vs Client)
    y_info_start = height - 1.4 * inch
    
    # Left: Developer Info
    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(0.8*inch, y_info_start, "DESARROLLADOR / PROVEEDOR")
    c.setStrokeColor(COLOR_PRIMARY_MAIN)
    c.line(0.8*inch, y_info_start - 3, 3.5*inch, y_info_start - 3)
    
    c.setFont("Helvetica", 10)
    c.setFillColor(COLOR_TEXT_GREY)
    y_dev = y_info_start - 0.25*inch
    dev_info = [
        "Dairo Moreno Rentería",
        "Nit: 1010094522",
        "Cel: 319 534 2608",
        "Email: daironmoreno24@gmail.com",
        "Medellín - Colombia"
    ]
    for line in dev_info:
        c.drawString(0.8*inch, y_dev, line)
        y_dev -= 0.18*inch

    # Right: Client Info
    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(4.5*inch, y_info_start, "CLIENTE / EMPRESA")
    c.setStrokeColor(COLOR_PRIMARY_MAIN)
    c.line(4.5*inch, y_info_start - 3, 7.2*inch, y_info_start - 3)

    c.setFont("Helvetica", 10)
    c.setFillColor(COLOR_TEXT_GREY)
    y_client = y_info_start - 0.25*inch
    client_info = [
        "Museo de Antioquia",
        "Nit: 890980080-2",
        "Contacto: Mary Luz Agudelo"
    ]
    for line in client_info:
        c.drawString(4.5*inch, y_client, line)
        y_client -= 0.18*inch

def draw_simple_header(c, width, height):
    """Encabezado simplificado para páginas secundarias"""
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
    
    # Date
    c.setFillColor(colors.white)
    c.setFont("Helvetica", 9)
    c.drawRightString(width - 0.8*inch, height - 0.55*inch, "16 de Enero de 2026")

def create_proposal():
    filename = "Propuesta_MisCompras_Museo_V6.pdf"
    c = canvas.Canvas(filename, pagesize=LETTER)
    width, height = LETTER
    
    draw_header_and_info(c, width, height)

    # --- CONTENT SETUP ---
    # Start below the header info block
    current_y = height - 3.2 * inch
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

    def simple_text(text, indent=0):
        nonlocal current_y
        c.setFillColor(colors.black)
        c.setFont("Helvetica", 10)
        c.drawString(left_margin + (indent * inch), current_y, text)
        current_y -= 0.2 * inch

    # 1. ALCANCE
    section_title("1. Alcance de la Propuesta")
    subheading("Fases y Cronograma para MisCompras")
    
    # Fase Desarrollo
    c.setFont("Helvetica-Bold", 10)
    c.drawString(left_margin, current_y, "Desarrollo:")
    c.setFont("Helvetica", 10)
    c.drawString(left_margin + 1.2*inch, current_y, "Desarrollo de nuevos requerimientos funcionales solicitados durante los primeros 3 meses.")
    current_y -= 0.25 * inch

    # Fase 4
    c.setFont("Helvetica-Bold", 10)
    c.drawString(left_margin, current_y, "Pruebas y Ajustes:")
    current_y -= 0.2 * inch
    bullet_point("Validación de que todos los modulos funcionan correctamente y corrección de bugs reportados.")
    bullet_point("Ajustes de interfaz y experiencia de usuario (UX/UI).")
    current_y -= 0.1 * inch

    # Fase 5
    c.setFont("Helvetica-Bold", 10)
    c.drawString(left_margin, current_y, "Implementación y Capacitación:")
    current_y -= 0.2 * inch
    bullet_point("Capacitación a usuarios administradores y finales.")
    bullet_point("Entrega de documentación técnica y manual de usuario.")
    bullet_point("Acompañamiento en el lanzamiento oficial y paso a producción.")
    current_y -= 0.3 * inch

    # 2. SOPORTE DE INFRAESTRUCTURA
    section_title("2. Infraestructura y Soporte (2 Años)")
    
    # 2.1 Cloud
    subheading("2.1 Hospedaje en la Nube (Microsoft Azure)")
    bullet_point("Año 1: 100% GRATUITO (Bonificado por el desarrollador).")
    bullet_point("Año 2 en adelante: El costo dependerá del consumo real y de la gestión de recursos, y será asumido por el cliente.")
    
    current_y -= 0.2 * inch

    # 2.2 Soporte
    subheading("2.2 Mantenimiento y Actualizaciones")
    simple_text("Cobertura Total: 24 Meses (2 Años) desde el primer uso de la aplicación.", indent=0.2)
    current_y -= 0.1 * inch
    bullet_point("Incluye solución de fallos (bugs) y soporte a usuarios (Horario 7:30 - 9:50 a.m).")
    bullet_point("Canales: WhatsApp, Email, AnyDesk y Presencial.")
    bullet_point("Condición de Renovación: Tras finalizar el periodo de 2 años, se deberá")
    c.drawString(left_margin + 0.2*inch, current_y, "  cotizar un nuevo acuerdo de soporte y mantenimiento.")
    current_y -= 0.2 * inch

    current_y -= 0.2 * inch
    
    # 3. LICENCIAMIENTO
    section_title("3. Licenciamiento y Propiedad")
    subheading("Condiciones de Uso del Software")
    
    # Box for license warning
    c.setStrokeColor(COLOR_ACCENT_GOLD)
    c.setLineWidth(1)
    c.roundRect(left_margin, current_y - 0.7*inch, content_width, 0.8*inch, 4, fill=0, stroke=1)
    
    current_y -= 0.2 * inch
    bullet_point("Licencia Perpetua: El Museo de Antioquia adquiere el derecho de uso indefinido.")
    bullet_point("Restricción Comercial: El software es para uso interno exclusivo.")
    bullet_point("PROHIBICIÓN: No se permite la comercialización, reventa o distribución del código.")
    
    current_y -= 0.6 * inch

    # Validar espacio para sección 4 (Evitar corte de página)
    if current_y < 4.5 * inch:
        c.showPage()
        draw_simple_header(c, width, height) 
        current_y = height - 1.5 * inch

    # 4. COSTOS
    section_title("4. Inversión y Forma de Pago")
    
    # Highlight Box Cost
    c.setFillColor(COLOR_BG_LIGHT)
    c.roundRect(left_margin, current_y - 1.0*inch, content_width, 1.0*inch, 8, fill=1, stroke=1)
    
    text_y = current_y - 0.35 * inch
    c.setFillColor(COLOR_PRIMARY_DARK)
    c.setFont("Helvetica-Bold", 16)
    c.drawCentredString(width/2, text_y, "TOTAL INVERSIÓN: $9.000.000 COP")
    
    c.setFont("Helvetica", 10)
    c.setFillColor(colors.black)
    c.drawCentredString(width/2, text_y - 0.3*inch, "(Nueve Millones de Pesos Colombianos)")
    
    current_y -= 1.4 * inch
    subheading("Facilidades de Pago (Flexibilidad 12 Meses):")
    bullet_point("El cliente puede distribuir el pago hasta en 3 cuotas durante el primer año.")
    bullet_point("Ejemplo: 3 pagos trimestrales o cuatrimestrales de $3.000.000.")
    bullet_point("Los pagos deben completarse dentro de los primeros 12 meses de ejecución.")
    
    # Check if we need new page (unlikely but good practice)
    if current_y < 1*inch:
        c.showPage()
        
    # --- FOOTER ---
    c.saveState()
    footer_y = 0.5 * inch
    c.setStrokeColor(COLOR_PRIMARY_MAIN)
    c.setLineWidth(1)
    c.line(0.5*inch, footer_y + 0.2*inch, width - 0.5*inch, footer_y + 0.2*inch)
    
    c.setFont("Helvetica", 8)
    c.setFillColor(colors.gray)
    c.drawCentredString(width/2, footer_y, "MisCompras - Sistema de Gestión de Compras | Propuesta Confidencial 2026")
    c.restoreState()

    c.save()
    print(f"PDF generado: {filename}")

if __name__ == "__main__":
    create_proposal()