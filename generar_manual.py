from reportlab.lib.pagesizes import LETTER
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image, PageBreak
from reportlab.lib.enums import TA_JUSTIFY, TA_LEFT, TA_CENTER

# --- CONFIGURACIÓN ESTILOS ---
COLOR_PRIMARY_DARK = colors.Color(54/255, 79/255, 199/255) 
COLOR_PRIMARY_MAIN = colors.Color(76/255, 110/255, 245/255)
COLOR_ACCENT_GOLD = colors.Color(212/255, 175/255, 55/255)

def header_footer(canvas, doc):
    canvas.saveState()
    width, height = LETTER
    
    # --- HEADER ---
    # Background
    canvas.setFillColor(colors.Color(248/255, 250/255, 252/255))
    canvas.rect(0, height - 1.2*inch, width, 1.2*inch, fill=1, stroke=0)
    
    # Branding Line
    path = canvas.beginPath()
    path.moveTo(0, height)
    path.lineTo(width, height)
    path.lineTo(width, height - 0.8*inch)
    path.lineTo(0, height - 0.8*inch)
    path.close()
    canvas.setFillColor(COLOR_PRIMARY_DARK)
    canvas.drawPath(path, fill=1, stroke=0)

    # Logo Text
    canvas.setFillColor(colors.white)
    canvas.setFont("Helvetica-Bold", 18)
    canvas.drawString(0.8*inch, height - 0.55*inch, "MisCompras")
    
    canvas.setFillColor(COLOR_ACCENT_GOLD)
    canvas.setFont("Helvetica-Bold", 8)
    canvas.drawString(0.8*inch + 2, height - 0.7*inch, "MUSEO DE ANTIOQUIA")
    
    canvas.setFillColor(colors.white)
    canvas.setFont("Helvetica", 9)
    canvas.drawRightString(width - 0.8*inch, height - 0.55*inch, "MANUAL DE USUARIO")
    
    # --- FOOTER ---
    canvas.setStrokeColor(COLOR_PRIMARY_MAIN)
    canvas.setLineWidth(1)
    canvas.line(0.8*inch, 0.7*inch, width - 0.8*inch, 0.7*inch)
    
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.gray)
    canvas.drawCentredString(width/2, 0.5*inch, f"Sistema de Gestión - Página {doc.page}")
    
    canvas.restoreState()

def generate_manual_pdf():
    doc = SimpleDocTemplate("Manual_Usuario_MisCompras.pdf", pagesize=LETTER,
                            rightMargin=0.8*inch, leftMargin=0.8*inch,
                            topMargin=1.5*inch, bottomMargin=1*inch)
    
    styles = getSampleStyleSheet()
    
    # Custom Styles
    style_title = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=COLOR_PRIMARY_DARK,
        spaceAfter=20,
        alignment=TA_CENTER
    )
    
    style_h1 = ParagraphStyle(
        'CustomH1',
        parent=styles['Heading1'],
        fontSize=16,
        textColor=COLOR_PRIMARY_DARK,
        spaceBefore=20,
        spaceAfter=10,
        borderPadding=5,
        borderColor=COLOR_ACCENT_GOLD,
        borderWidth=0,
        borderBottomWidth=1
    )
    
    style_h2 = ParagraphStyle(
        'CustomH2',
        parent=styles['Heading2'],
        fontSize=13,
        textColor=colors.black,
        spaceBefore=15,
        spaceAfter=8
    )
    
    style_h3 = ParagraphStyle(
        'CustomH3',
        parent=styles['Heading3'],
        fontSize=11,
        textColor=COLOR_PRIMARY_MAIN,
        spaceBefore=10,
        spaceAfter=5
    )
    
    style_body = ParagraphStyle(
        'CustomBody',
        parent=styles['Normal'],
        fontSize=10,
        leading=14,
        spaceAfter=6,
        alignment=TA_JUSTIFY
    )
    
    style_bullet = ParagraphStyle(
        'CustomBullet',
        parent=styles['Normal'],
        fontSize=10,
        leading=14,
        leftIndent=20,
        spaceAfter=4,
        bulletIndent=10
    )

    story = []
    
    # Read Markdown
    with open('MANUAL_USUARIO.md', 'r', encoding='utf-8') as f:
        lines = f.readlines()
        
    def clean_text(text):
        # Escape XML chars first
        text = text.replace('&', '&amp;')
        text = text.replace('<', '&lt;')
        text = text.replace('>', '&gt;')
        # Restore our bold formatting (we will add bold markers AFTER escaping)
        return text

    for line in lines:
        line = line.strip()
        if not line:
            continue
            
        # Skip HTML block lines from the markdown header
        if line.startswith('<p') or line.startswith('<img') or line.startswith('</p') or line.startswith('<strong>'):
            continue
            
        # Parse logic
        if line.startswith('# '): # Title
            text = clean_text(line.replace('# ', ''))
            story.append(Paragraph(text, style_title))
            story.append(Spacer(1, 10))
            
        elif line.startswith('## '): # H1
            text = clean_text(line.replace('## ', ''))
            story.append(Spacer(1, 10))
            story.append(Paragraph(text, style_h1))
            
        elif line.startswith('### '): # H2
            text = clean_text(line.replace('### ', ''))
            story.append(Paragraph(text, style_h2))
            
        elif line.startswith('#### '): # H3
            text = clean_text(line.replace('#### ', ''))
            story.append(Paragraph(text, style_h3))
            
        elif line.startswith('- ') or line.startswith('* '): # Bullet
            text = line[2:] 
            text = clean_text(text)
            # Re-apply bolding logic safely
            if '**' in text:
                parts = text.split('**')
                # Reconstruct with <b> tags: pair 0-1 is bold, 2-3 bold...
                new_text = ""
                for i, part in enumerate(parts):
                    if i % 2 == 1:
                        new_text += f"<b>{part}</b>"
                    else:
                        new_text += part
                text = new_text
            story.append(Paragraph(f"• {text}", style_bullet))
            
        elif line.startswith('>'): # Quote/Note
            text = line.replace('>', '').strip()
            text = clean_text(text)
            if '**' in text:
                parts = text.split('**')
                new_text = ""
                for i, part in enumerate(parts):
                    if i % 2 == 1:
                        new_text += f"<b>{part}</b>"
                    else:
                        new_text += part
                text = new_text
            story.append(Spacer(1, 5))
            p = Paragraph(f"<b>NOTA:</b> {text}", style_body)
            p.backColor = colors.Color(0.95, 0.95, 0.95)
            story.append(p)
            story.append(Spacer(1, 5))
            
        elif line.startswith('|'): # Table (Simple render)
            if '---' in line: continue
            text = clean_text(line)
            story.append(Paragraph(text, style_body))
             
        else: # Normal text
            text = clean_text(line)
            if '**' in text:
                parts = text.split('**')
                new_text = ""
                for i, part in enumerate(parts):
                    if i % 2 == 1:
                        new_text += f"<b>{part}</b>"
                    else:
                        new_text += part
                text = new_text
            story.append(Paragraph(text, style_body))

    doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
    print("PDF del Manual generado exitosamente.")

if __name__ == "__main__":
    generate_manual_pdf()
