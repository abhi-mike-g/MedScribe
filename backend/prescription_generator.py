"""
MedScribe Prescription PDF Generator with QR Code Verification.
2-page prescription matching the MedScribe Prescription Template.
Embeds doctor license QR code for pharmacy verification.
"""
import io
import json
import hashlib
from datetime import datetime, timezone, timedelta
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, Image, PageBreak
)
from reportlab.platypus.flowables import Flowable
import qrcode

# Colors
BLUE = colors.HexColor("#0033A0")
BLUE_LIGHT = colors.HexColor("#E8EEFF")
GREEN = colors.HexColor("#059669")
GREEN_BG = colors.HexColor("#ECFDF5")
YELLOW_BG = colors.HexColor("#FEF3C7")
GRAY = colors.HexColor("#52525B")
GRAY_LIGHT = colors.HexColor("#F4F4F5")
GRAY_BORDER = colors.HexColor("#E4E4E7")
RED = colors.HexColor("#DC2626")
RED_BG = colors.HexColor("#FEF2F2")
WHITE = colors.white
BLACK = colors.HexColor("#0A0A0A")


def _generate_qr_image(data_str: str, size: float = 1.2 * inch) -> Image:
    """Generate a QR code ReportLab Image from a data string."""
    qr = qrcode.QRCode(version=1, error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=8, border=2)
    qr.add_data(data_str)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    buf.seek(0)
    return Image(buf, width=size, height=size)


def _compute_verification_hash(rx_id: str, license_number: str, doctor_name: str) -> str:
    """Compute a verification hash for the prescription."""
    raw = f"{rx_id}:{license_number}:{doctor_name}:MEDSCRIBE"
    return hashlib.sha256(raw.encode()).hexdigest()[:16].upper()


class SectionBar(Flowable):
    """Blue section header bar."""
    def __init__(self, text, width=None, bg_color=BLUE):
        Flowable.__init__(self)
        self.text = text
        self._width = width or 7.3 * inch
        self.bg_color = bg_color
        self.height = 22
    def wrap(self, aW, aH):
        return self._width, self.height
    def draw(self):
        self.canv.setFillColor(self.bg_color)
        self.canv.roundRect(0, 0, self._width, self.height, 3, fill=1, stroke=0)
        self.canv.setFillColor(WHITE)
        self.canv.setFont("Helvetica-Bold", 10)
        self.canv.drawString(10, 6, self.text)


class BadgeRow(Flowable):
    """Footer badges."""
    def __init__(self, width=None):
        Flowable.__init__(self)
        self._width = width or 7.3 * inch
        self.height = 22
    def wrap(self, aW, aH):
        return self._width, self.height
    def draw(self):
        badges = [("E2E ENCRYPTED", GREEN), ("HIPAA ALIGNED", BLUE), ("PRIVACY BY DESIGN", GRAY)]
        x = 0
        for text, color in badges:
            w = len(text) * 6.5 + 20
            self.canv.setFillColor(GRAY_LIGHT)
            self.canv.roundRect(x, 2, w, 18, 3, fill=1, stroke=0)
            self.canv.setFillColor(color)
            self.canv.setFont("Helvetica-Bold", 7)
            self.canv.drawString(x + 10, 7, text)
            x += w + 10


def generate_prescription_pdf(rx_data: dict) -> bytes:
    """
    Generate a 2-page MedScribe Prescription PDF with embedded QR code.

    rx_data should contain:
    - rx_id, created_at, valid_until
    - patient: {name, age, gender, id, weight, allergies}
    - doctor: {name, specialization, registration_no, contact}
    - facility: {name, address, contact}
    - diagnosis, icd_code
    - medications: [{name, dose, route, frequency, duration, instructions, plain_instructions}]
    - general_advice, warnings: [], follow_up_date, tests_before_next_visit
    - pharmacy_notes
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter,
                            leftMargin=0.6*inch, rightMargin=0.6*inch,
                            topMargin=0.5*inch, bottomMargin=0.5*inch)
    styles = getSampleStyleSheet()
    pw = letter[0] - 1.2 * inch  # page width usable

    # Custom styles
    styles.add(ParagraphStyle('RxTitle', parent=styles['Normal'], fontSize=22, fontName='Helvetica-Bold', textColor=BLUE, spaceAfter=2))
    styles.add(ParagraphStyle('RxMeta', parent=styles['Normal'], fontSize=9, fontName='Helvetica', textColor=GRAY, alignment=TA_RIGHT))
    styles.add(ParagraphStyle('FieldLabel', parent=styles['Normal'], fontSize=9, fontName='Helvetica-Bold', textColor=BLUE, spaceBefore=6, spaceAfter=3, letterSpacing=1))
    styles.add(ParagraphStyle('FieldValue', parent=styles['Normal'], fontSize=10, fontName='Helvetica', textColor=BLACK, leading=14, spaceAfter=2))
    styles.add(ParagraphStyle('FieldBold', parent=styles['Normal'], fontSize=10, fontName='Helvetica-Bold', textColor=BLACK, leading=14, spaceAfter=2))
    styles.add(ParagraphStyle('SmallGray', parent=styles['Normal'], fontSize=7, fontName='Helvetica', textColor=GRAY, leading=10))
    styles.add(ParagraphStyle('FooterCenter', parent=styles['Normal'], fontSize=8, fontName='Helvetica', textColor=GRAY, alignment=TA_CENTER))
    styles.add(ParagraphStyle('GreenTitle', parent=styles['Normal'], fontSize=14, fontName='Helvetica-Bold', textColor=colors.HexColor("#065F46"), spaceAfter=8))
    styles.add(ParagraphStyle('WarningTitle', parent=styles['Normal'], fontSize=11, fontName='Helvetica-Bold', textColor=RED, spaceAfter=6))
    styles.add(ParagraphStyle('WarningItem', parent=styles['Normal'], fontSize=10, fontName='Helvetica', textColor=colors.HexColor("#991B1B"), leading=15, leftIndent=10))

    elements = []
    patient = rx_data.get("patient", {})
    doctor = rx_data.get("doctor", {})
    facility = rx_data.get("facility", {"name": "MedScribe Clinic", "address": "", "contact": ""})
    rx_id = rx_data.get("rx_id", "RX-0000")
    created = rx_data.get("created_at", datetime.now(timezone.utc).strftime("%d %B %Y"))
    valid_until = rx_data.get("valid_until", (datetime.now(timezone.utc) + timedelta(days=30)).strftime("%d %B %Y"))
    license_no = doctor.get("registration_no", "")
    verification_hash = _compute_verification_hash(rx_id, license_no, doctor.get("name", ""))

    # ==================== PAGE 1 ====================

    # QR Code at top
    qr_data = json.dumps({
        "type": "medscribe_rx",
        "rx_id": rx_id,
        "license": license_no,
        "doctor": doctor.get("name", ""),
        "hash": verification_hash,
        "verify_url": f"/api/prescriptions/verify/{rx_id}",
    }, separators=(',', ':'))
    qr_img = _generate_qr_image(qr_data, size=1.1*inch)

    # Header with QR
    header_left = [
        Paragraph("Prescription", styles['RxTitle']),
        Paragraph(facility.get("name", "MedScribe Clinic"), ParagraphStyle('FacName', parent=styles['Normal'], fontSize=11, fontName='Helvetica-Bold', textColor=BLACK)),
        Paragraph(f"{facility.get('address', '')} | {facility.get('contact', '')}", styles['SmallGray']),
    ]
    header_right = [
        qr_img,
        Spacer(1, 4),
        Paragraph(f"Rx ID: <b>{rx_id}</b>", styles['RxMeta']),
        Paragraph(f"Date: {created}", styles['RxMeta']),
        Paragraph(f"Valid until: {valid_until}", styles['RxMeta']),
    ]
    ht = Table([[header_left, header_right]], colWidths=[pw*0.6, pw*0.4])
    ht.setStyle(TableStyle([('VALIGN', (0,0), (-1,-1), 'TOP'), ('ALIGN', (1,0), (1,0), 'RIGHT')]))
    elements.append(ht)
    elements.append(Spacer(1, 6))
    elements.append(HRFlowable(width="100%", thickness=2, color=BLUE))
    elements.append(Spacer(1, 10))

    # Patient & Physician blocks
    def info_cells(title, lines):
        cells = [SectionBar(title, pw/2 - 4)]
        for l in lines:
            cells.append(Paragraph(l, styles['FieldValue']))
        return cells

    pat_lines = [
        f"<b>{patient.get('name','N/A')}</b>",
        f"Age: <b>{patient.get('age','')}</b> | Gender: <b>{patient.get('gender','')}</b>",
        f"ID: <b>{patient.get('id','N/A')}</b> | Weight: <b>{patient.get('weight','N/A')}</b>",
        f"Known allergies: <b>{patient.get('allergies','NKDA')}</b>",
    ]
    doc_lines = [
        f"<b>{doctor.get('name','N/A')}</b>",
        f"{doctor.get('specialization','')}",
        f"Registration: <b>{license_no}</b>",
        f"Contact: {doctor.get('contact','N/A')}",
    ]
    pd_table = Table([[info_cells("PATIENT", pat_lines), info_cells("PRESCRIBING PHYSICIAN", doc_lines)]], colWidths=[pw/2, pw/2])
    pd_table.setStyle(TableStyle([('VALIGN', (0,0), (-1,-1), 'TOP'), ('TOPPADDING', (0,0), (-1,-1), 0)]))
    elements.append(pd_table)
    elements.append(Spacer(1, 10))

    # Diagnosis
    diag = rx_data.get("diagnosis", "")
    icd = rx_data.get("icd_code", "")
    diag_table = Table([
        [info_cells("DIAGNOSIS", [f"<b>{diag}</b>"]), info_cells("ICD-10", [f"<b>{icd}</b>"])]
    ], colWidths=[pw*0.65, pw*0.35])
    diag_table.setStyle(TableStyle([('VALIGN', (0,0), (-1,-1), 'TOP')]))
    elements.append(diag_table)
    elements.append(Spacer(1, 10))

    # Medications table
    meds = rx_data.get("medications", [])
    if meds:
        med_data = [["#", "Drug", "Dose", "Route", "Frequency", "Duration", "Instructions"]]
        for i, m in enumerate(meds, 1):
            med_data.append([
                str(i), m.get("name",""), m.get("dose",""), m.get("route","PO"),
                m.get("frequency",""), m.get("duration",""), m.get("instructions",""),
            ])
        mt = Table(med_data, colWidths=[pw*0.04, pw*0.18, pw*0.10, pw*0.08, pw*0.15, pw*0.13, pw*0.32])
        mt.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), BLUE), ('TEXTCOLOR', (0,0), (-1,0), WHITE),
            ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'), ('FONTSIZE', (0,0), (-1,0), 8),
            ('FONTNAME', (0,1), (-1,-1), 'Helvetica'), ('FONTSIZE', (0,1), (-1,-1), 8),
            ('ALIGN', (0,0), (0,-1), 'CENTER'),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('TOPPADDING', (0,0), (-1,-1), 5), ('BOTTOMPADDING', (0,0), (-1,-1), 5),
            ('LEFTPADDING', (0,0), (-1,-1), 4),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [WHITE, GRAY_LIGHT]),
            ('BOX', (0,0), (-1,-1), 0.5, GRAY_BORDER), ('INNERGRID', (0,0), (-1,-1), 0.5, GRAY_BORDER),
        ]))
        elements.append(mt)

    elements.append(Spacer(1, 8))
    elements.append(Paragraph(
        "Abbreviations: OD = Once daily | BD = Twice daily | TID = Three times daily | QID = Four times daily | "
        "HS = At bedtime | AC = Before food | PC = After food | SOS = When needed | PO = Oral | IV = Intravenous | "
        "IM = Intramuscular | TOP = Topical | INH = Inhalation | SL = Sublingual",
        styles['SmallGray']
    ))

    # ==================== PAGE 2 ====================
    elements.append(PageBreak())

    # Simple language section
    elements.append(Spacer(1, 4))
    # Green header box
    green_header = Table(
        [[Paragraph("Your medicines — in simple language", styles['GreenTitle'])]],
        colWidths=[pw]
    )
    green_header.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), GREEN_BG),
        ('TOPPADDING', (0,0), (-1,-1), 10), ('BOTTOMPADDING', (0,0), (-1,-1), 10),
        ('LEFTPADDING', (0,0), (-1,-1), 12), ('ROUNDEDCORNERS', [6,6,6,6]),
    ]))
    elements.append(green_header)
    elements.append(Spacer(1, 8))

    for i, m in enumerate(meds, 1):
        plain = m.get("plain_instructions", "")
        if not plain:
            plain = f"Take {m.get('name','')} ({m.get('dose','')}) {m.get('frequency','').lower()} for {m.get('duration','as prescribed')}. {m.get('instructions','')}"
        elements.append(Paragraph(f"<b>{i}. {m.get('name','')} ({m.get('dose','')})</b>", styles['FieldBold']))
        elements.append(Paragraph(plain, styles['FieldValue']))
        elements.append(Spacer(1, 4))

    # General Advice
    advice = rx_data.get("general_advice", "")
    if advice:
        elements.append(Spacer(1, 6))
        advice_box = Table(
            [[Paragraph("<b>General advice</b>", ParagraphStyle('AdvHead', parent=styles['Normal'], fontSize=11, fontName='Helvetica-Bold', textColor=BLACK)),
              Spacer(1,2)],
             [Paragraph(advice, styles['FieldValue']), None]],
            colWidths=[pw, 0]
        )
        advice_box.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), GRAY_LIGHT),
            ('TOPPADDING', (0,0), (-1,-1), 8), ('BOTTOMPADDING', (0,0), (-1,-1), 8),
            ('LEFTPADDING', (0,0), (-1,-1), 12), ('SPAN', (0,0), (-1,0)), ('SPAN', (0,1), (-1,1)),
        ]))
        elements.append(advice_box)

    # Warning Signs
    warnings = rx_data.get("warnings", [])
    if warnings:
        elements.append(Spacer(1, 10))
        warn_content = [[Paragraph("When to seek immediate medical help", styles['WarningTitle'])]]
        for w in warnings:
            warn_content.append([Paragraph(f"\u2022 {w}", styles['WarningItem'])])
        warn_table = Table(warn_content, colWidths=[pw])
        warn_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), YELLOW_BG),
            ('TOPPADDING', (0,0), (0,0), 10), ('BOTTOMPADDING', (0,-1), (-1,-1), 10),
            ('LEFTPADDING', (0,0), (-1,-1), 12),
        ]))
        elements.append(warn_table)

    # Follow-up & Tests
    follow_up = rx_data.get("follow_up_date", "")
    tests = rx_data.get("tests_before_next_visit", "")
    if follow_up or tests:
        elements.append(Spacer(1, 12))
        fu_table = Table([
            [info_cells("FOLLOW-UP DATE", [f"<b>{follow_up}</b>"]) if follow_up else [],
             info_cells("TESTS BEFORE NEXT VISIT", [f"<b>{tests}</b>"]) if tests else []]
        ], colWidths=[pw/2, pw/2])
        fu_table.setStyle(TableStyle([('VALIGN', (0,0), (-1,-1), 'TOP')]))
        elements.append(fu_table)

    # Physician signature block
    elements.append(Spacer(1, 16))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=GRAY_BORDER))
    elements.append(Spacer(1, 8))

    pharmacy_notes = rx_data.get("pharmacy_notes", "")
    sig_left = [
        Paragraph(f"<b>{doctor.get('name','')}</b>", styles['FieldBold']),
        Paragraph(doctor.get('specialization',''), styles['FieldValue']),
        Paragraph(f"Reg: {license_no}", styles['FieldValue']),
        Spacer(1, 16),
        Paragraph("Signature: ____________________________", styles['FieldValue']),
        Paragraph(f"Date: {created}", styles['FieldValue']),
    ]
    sig_right = []
    if pharmacy_notes:
        sig_right = [
            Paragraph("<b>Pharmacy Notes:</b>", styles['FieldLabel']),
            Paragraph(pharmacy_notes, styles['FieldValue']),
        ]

    sig_table = Table([[sig_left, sig_right]], colWidths=[pw*0.55, pw*0.45])
    sig_table.setStyle(TableStyle([('VALIGN', (0,0), (-1,-1), 'TOP')]))
    elements.append(sig_table)

    # Footer
    elements.append(Spacer(1, 16))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=GRAY_BORDER))
    elements.append(Spacer(1, 6))
    elements.append(Paragraph("Generated by MedScribe v1.0 | On-Device AI Processing", styles['FooterCenter']))
    elements.append(Spacer(1, 4))
    elements.append(BadgeRow(pw))
    elements.append(Spacer(1, 8))
    elements.append(Paragraph(
        "Data access (Principle of Least Privilege): Doctor \u2192 Full prescription + clinical notes | "
        "Patient \u2192 Medications + simple instructions + warnings | "
        "Pharmacist \u2192 Medications + allergies only",
        styles['SmallGray']
    ))
    elements.append(Spacer(1, 4))
    elements.append(Paragraph(f"QR Verification Hash: {verification_hash}", styles['SmallGray']))

    doc.build(elements)
    buffer.seek(0)
    return buffer.read()
