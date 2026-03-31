"""
MedScribe Medical Report PDF Generator
Generates SOAP-format clinical documentation matching the MedScribe template.
Uses ReportLab for pixel-perfect PDF output.
"""

import io
from datetime import datetime, timezone
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch, mm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, KeepTogether, PageBreak
)
from reportlab.platypus.flowables import Flowable


# ============== CUSTOM COLORS ==============
BLUE_PRIMARY = colors.HexColor("#0033A0")
BLUE_LIGHT = colors.HexColor("#E8EEFF")
BLUE_DARK = colors.HexColor("#001A5C")
GREEN_E2EE = colors.HexColor("#10B981")
GREEN_BG = colors.HexColor("#ECFDF5")
GRAY_TEXT = colors.HexColor("#52525B")
GRAY_LIGHT = colors.HexColor("#F4F4F5")
GRAY_BORDER = colors.HexColor("#E4E4E7")
RED_ALERT = colors.HexColor("#DC2626")
RED_BG = colors.HexColor("#FEF2F2")
AMBER_BG = colors.HexColor("#FEF3C7")
WHITE = colors.white
BLACK = colors.HexColor("#0A0A0A")


# ============== CUSTOM FLOWABLES ==============
class SectionDivider(Flowable):
    """Colored section header bar."""
    def __init__(self, text, width=None, color=BLUE_PRIMARY):
        Flowable.__init__(self)
        self.text = text
        self._width = width or 7.3 * inch
        self.color = color
        self.height = 28

    def wrap(self, aW, aH):
        return self._width, self.height

    def draw(self):
        self.canv.setFillColor(self.color)
        self.canv.roundRect(0, 0, self._width, self.height, 4, fill=1, stroke=0)
        self.canv.setFillColor(WHITE)
        self.canv.setFont("Helvetica-Bold", 12)
        self.canv.drawString(12, 8, self.text)


class BadgeRow(Flowable):
    """Footer badges: E2E ENCRYPTED, HIPAA ALIGNED, PRIVACY BY DESIGN."""
    def __init__(self, width=None):
        Flowable.__init__(self)
        self._width = width or 7.3 * inch
        self.height = 24

    def wrap(self, aW, aH):
        return self._width, self.height

    def draw(self):
        badges = [
            ("E2E ENCRYPTED", GREEN_E2EE),
            ("HIPAA ALIGNED", BLUE_PRIMARY),
            ("PRIVACY BY DESIGN", GRAY_TEXT),
        ]
        x = 0
        for text, color in badges:
            self.canv.setFillColor(colors.HexColor("#F0F0F0"))
            w = len(text) * 6.5 + 20
            self.canv.roundRect(x, 2, w, 20, 3, fill=1, stroke=0)
            self.canv.setFillColor(color)
            self.canv.setFont("Helvetica-Bold", 8)
            self.canv.drawString(x + 10, 8, text)
            x += w + 10


def generate_medical_report_pdf(report_data: dict) -> bytes:
    """
    Generate a complete MedScribe Medical Report PDF.

    report_data should contain:
    - report_id, generated_at
    - patient: {name, age, gender, id}
    - clinician: {name, specialization, registration_no}
    - encounter: {date, type, duration}
    - subjective: {chief_complaint, hpi, review_of_systems, past_medical_history,
                    current_medications, allergies, social_history}
    - objective: {vital_signs: [{parameter, value, normal_range}],
                   physical_examination, lab_results}
    - assessment: {primary_diagnosis, icd_code, differential_diagnoses: [],
                    clinical_reasoning}
    - plan: {medications: [{drug, dose, frequency, duration, instructions}],
             simple_instructions: [], general_advice,
             warning_signs: [], diagnostic_tests, referrals, follow_up}
    - patient_education
    """
    buffer = io.BytesIO()

    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=0.6 * inch,
        rightMargin=0.6 * inch,
        topMargin=0.5 * inch,
        bottomMargin=0.5 * inch,
    )

    styles = getSampleStyleSheet()
    page_width = letter[0] - 1.2 * inch  # usable width

    # Custom styles
    styles.add(ParagraphStyle(
        'MedTitle', parent=styles['Normal'],
        fontSize=22, fontName='Helvetica-Bold', textColor=BLUE_PRIMARY,
        spaceAfter=2,
    ))
    styles.add(ParagraphStyle(
        'MedSubtitle', parent=styles['Normal'],
        fontSize=9, fontName='Helvetica', textColor=GRAY_TEXT,
        spaceAfter=0,
    ))
    styles.add(ParagraphStyle(
        'MedMeta', parent=styles['Normal'],
        fontSize=9, fontName='Helvetica', textColor=GRAY_TEXT,
        alignment=TA_RIGHT,
    ))
    styles.add(ParagraphStyle(
        'SectionLabel', parent=styles['Normal'],
        fontSize=9, fontName='Helvetica-Bold', textColor=BLUE_PRIMARY,
        spaceBefore=8, spaceAfter=4, leading=12,
        letterSpacing=1,
    ))
    styles.add(ParagraphStyle(
        'BodyText14', parent=styles['Normal'],
        fontSize=10, fontName='Helvetica', textColor=BLACK,
        leading=15, spaceAfter=4,
    ))
    styles.add(ParagraphStyle(
        'BodyBold', parent=styles['Normal'],
        fontSize=10, fontName='Helvetica-Bold', textColor=BLACK,
        leading=15, spaceAfter=4,
    ))
    styles.add(ParagraphStyle(
        'SmallGray', parent=styles['Normal'],
        fontSize=8, fontName='Helvetica', textColor=GRAY_TEXT,
        leading=11,
    ))
    styles.add(ParagraphStyle(
        'FooterText', parent=styles['Normal'],
        fontSize=8, fontName='Helvetica', textColor=GRAY_TEXT,
        alignment=TA_CENTER, leading=11,
    ))
    styles.add(ParagraphStyle(
        'WarningText', parent=styles['Normal'],
        fontSize=10, fontName='Helvetica-Bold', textColor=RED_ALERT,
        leading=15, spaceAfter=2,
    ))

    elements = []

    # ============== HEADER ==============
    patient = report_data.get("patient", {})
    clinician = report_data.get("clinician", {})
    encounter = report_data.get("encounter", {})

    # Title row
    header_left = [
        Paragraph("MedScribe", styles['MedTitle']),
        Paragraph("AI-Generated Clinical Documentation", styles['MedSubtitle']),
        Paragraph("On-Device Processing | HIPAA Aligned", styles['MedSubtitle']),
    ]
    report_id = report_data.get("report_id", "MS-0000-00000")
    generated_at = report_data.get("generated_at", datetime.now(timezone.utc).strftime("%d %B %Y, %H:%M UTC"))
    header_right = [
        Paragraph(f"Report ID: <b>{report_id}</b>", styles['MedMeta']),
        Paragraph(f"Generated: {generated_at}", styles['MedMeta']),
    ]

    header_table = Table(
        [[header_left, header_right]],
        colWidths=[page_width * 0.6, page_width * 0.4],
    )
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
    ]))
    elements.append(header_table)
    elements.append(Spacer(1, 8))
    elements.append(HRFlowable(width="100%", thickness=2, color=BLUE_PRIMARY))
    elements.append(Spacer(1, 10))

    # ============== PATIENT / CLINICIAN / ENCOUNTER BLOCK ==============
    def info_block(title, lines):
        content = [Paragraph(f"<b>{title}</b>", ParagraphStyle('BlockTitle', parent=styles['Normal'], fontSize=8, fontName='Helvetica-Bold', textColor=GRAY_TEXT, spaceAfter=4, letterSpacing=1))]
        for line in lines:
            content.append(Paragraph(line, ParagraphStyle('BlockLine', parent=styles['Normal'], fontSize=10, fontName='Helvetica', textColor=BLACK, leading=14)))
        return content

    patient_lines = [
        f"<b>{patient.get('name', 'N/A')}</b>",
        f"{patient.get('gender', 'N/A')}, {patient.get('age', 'N/A')} years",
        f"ID: {patient.get('id', 'N/A')}",
    ]
    clinician_lines = [
        f"<b>{clinician.get('name', 'N/A')}</b>",
        clinician.get('specialization', 'N/A'),
        f"Reg: {clinician.get('registration_no', 'N/A')}",
    ]
    encounter_lines = [
        f"<b>{encounter.get('date', 'N/A')}</b>",
        encounter.get('type', 'Outpatient Consultation'),
        f"Duration: {encounter.get('duration', 'N/A')}",
    ]

    pce_table = Table(
        [[info_block("PATIENT", patient_lines),
          info_block("CLINICIAN", clinician_lines),
          info_block("ENCOUNTER", encounter_lines)]],
        colWidths=[page_width / 3] * 3,
    )
    pce_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BACKGROUND', (0, 0), (-1, -1), GRAY_LIGHT),
        ('BOX', (0, 0), (-1, -1), 0.5, GRAY_BORDER),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, GRAY_BORDER),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
    ]))
    elements.append(pce_table)
    elements.append(Spacer(1, 14))

    # ============== SUBJECTIVE (S) ==============
    subjective = report_data.get("subjective", {})

    elements.append(SectionDivider("Subjective (S)", page_width))
    elements.append(Spacer(1, 10))

    subj_sections = [
        ("CHIEF COMPLAINT", subjective.get("chief_complaint", "")),
        ("HISTORY OF PRESENT ILLNESS", subjective.get("hpi", "")),
        ("REVIEW OF SYSTEMS", subjective.get("review_of_systems", "")),
        ("PAST MEDICAL HISTORY", subjective.get("past_medical_history", "")),
        ("CURRENT MEDICATIONS", subjective.get("current_medications", "")),
        ("ALLERGIES", subjective.get("allergies", "")),
        ("SOCIAL HISTORY", subjective.get("social_history", "")),
    ]

    for label, text in subj_sections:
        if text and text.strip():
            elements.append(Paragraph(label, styles['SectionLabel']))
            elements.append(Paragraph(text, styles['BodyText14']))
            elements.append(Spacer(1, 6))

    elements.append(Spacer(1, 8))

    # ============== OBJECTIVE (O) ==============
    objective = report_data.get("objective", {})

    elements.append(SectionDivider("Objective (O)", page_width))
    elements.append(Spacer(1, 10))

    # Vital Signs Table
    vital_signs = objective.get("vital_signs", [])
    if vital_signs:
        elements.append(Paragraph("VITAL SIGNS", styles['SectionLabel']))
        vs_data = [["Parameter", "Value", "Normal Range"]]
        for vs in vital_signs:
            vs_data.append([
                vs.get("parameter", ""),
                vs.get("value", ""),
                vs.get("normal_range", "--"),
            ])

        vs_table = Table(vs_data, colWidths=[page_width * 0.35, page_width * 0.30, page_width * 0.35])
        vs_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), BLUE_PRIMARY),
            ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 9),
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
            ('TEXTCOLOR', (0, 1), (-1, -1), BLACK),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, GRAY_LIGHT]),
            ('BOX', (0, 0), (-1, -1), 0.5, GRAY_BORDER),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, GRAY_BORDER),
        ]))
        elements.append(vs_table)
        elements.append(Spacer(1, 10))

    # Physical Examination
    phys_exam = objective.get("physical_examination", "")
    if phys_exam:
        elements.append(Paragraph("PHYSICAL EXAMINATION", styles['SectionLabel']))
        elements.append(Paragraph(phys_exam, styles['BodyText14']))
        elements.append(Spacer(1, 6))

    # Lab Results
    lab = objective.get("lab_results", "")
    if lab:
        elements.append(Paragraph("LAB / DIAGNOSTIC RESULTS", styles['SectionLabel']))
        elements.append(Paragraph(lab, styles['BodyText14']))
        elements.append(Spacer(1, 6))

    elements.append(Spacer(1, 8))

    # ============== ASSESSMENT (A) ==============
    assessment = report_data.get("assessment", {})

    elements.append(SectionDivider("Assessment (A)", page_width))
    elements.append(Spacer(1, 10))

    primary_dx = assessment.get("primary_diagnosis", "")
    icd_code = assessment.get("icd_code", "")
    if primary_dx:
        elements.append(Paragraph("PRIMARY DIAGNOSIS", styles['SectionLabel']))
        dx_text = f"<b>{primary_dx}</b>"
        if icd_code:
            dx_text += f"  (ICD-10: {icd_code})"
        elements.append(Paragraph(dx_text, styles['BodyText14']))
        elements.append(Spacer(1, 6))

    diff_dx = assessment.get("differential_diagnoses", [])
    if diff_dx:
        elements.append(Paragraph("DIFFERENTIAL DIAGNOSES", styles['SectionLabel']))
        for i, dx in enumerate(diff_dx, 1):
            elements.append(Paragraph(f"{i}. {dx}", styles['BodyText14']))
        elements.append(Spacer(1, 6))

    reasoning = assessment.get("clinical_reasoning", "")
    if reasoning:
        elements.append(Paragraph("CLINICAL REASONING", styles['SectionLabel']))
        elements.append(Paragraph(reasoning, styles['BodyText14']))
        elements.append(Spacer(1, 6))

    elements.append(Spacer(1, 8))

    # ============== PLAN (P) ==============
    plan = report_data.get("plan", {})

    elements.append(SectionDivider("Plan (P)", page_width))
    elements.append(Spacer(1, 10))

    # Medications Table
    medications = plan.get("medications", [])
    if medications:
        elements.append(Paragraph("MEDICATIONS", styles['SectionLabel']))
        med_data = [["Drug", "Dose", "Frequency", "Duration", "Instructions"]]
        for med in medications:
            med_data.append([
                med.get("drug", ""),
                med.get("dose", ""),
                med.get("frequency", ""),
                med.get("duration", ""),
                med.get("instructions", ""),
            ])

        med_table = Table(
            med_data,
            colWidths=[page_width * 0.18, page_width * 0.12, page_width * 0.20, page_width * 0.15, page_width * 0.35],
        )
        med_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), BLUE_PRIMARY),
            ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 8),
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 8),
            ('TEXTCOLOR', (0, 1), (-1, -1), BLACK),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('LEFTPADDING', (0, 0), (-1, -1), 6),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, GRAY_LIGHT]),
            ('BOX', (0, 0), (-1, -1), 0.5, GRAY_BORDER),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, GRAY_BORDER),
        ]))
        elements.append(med_table)
        elements.append(Spacer(1, 10))

    # Simple Language Instructions
    simple_instructions = plan.get("simple_instructions", [])
    if simple_instructions:
        elements.append(Paragraph("Instructions in simple language", styles['SectionLabel']))
        for i, inst in enumerate(simple_instructions, 1):
            elements.append(Paragraph(f"{i}. {inst}", styles['BodyText14']))
        elements.append(Spacer(1, 4))

    general_advice = plan.get("general_advice", "")
    if general_advice:
        elements.append(Paragraph(f"<b>General advice:</b> {general_advice}", styles['BodyText14']))
        elements.append(Spacer(1, 8))

    # Warning Signs
    warnings = plan.get("warning_signs", [])
    if warnings:
        elements.append(Paragraph("When to seek immediate help", styles['WarningText']))
        for w in warnings:
            elements.append(Paragraph(f"\u2022 {w}", ParagraphStyle(
                'WarningItem', parent=styles['Normal'],
                fontSize=10, fontName='Helvetica', textColor=RED_ALERT,
                leading=15, leftIndent=10, spaceAfter=2,
            )))
        elements.append(Spacer(1, 8))

    # Diagnostic Tests
    diag_tests = plan.get("diagnostic_tests", "")
    if diag_tests:
        elements.append(Paragraph("DIAGNOSTIC TESTS ORDERED", styles['SectionLabel']))
        elements.append(Paragraph(diag_tests, styles['BodyText14']))
        elements.append(Spacer(1, 6))

    # Referrals
    referrals = plan.get("referrals", "")
    if referrals:
        elements.append(Paragraph("REFERRALS", styles['SectionLabel']))
        elements.append(Paragraph(referrals, styles['BodyText14']))
        elements.append(Spacer(1, 6))

    # Follow-up
    follow_up = plan.get("follow_up", "")
    if follow_up:
        elements.append(Paragraph("FOLLOW-UP", styles['SectionLabel']))
        elements.append(Paragraph(follow_up, styles['BodyText14']))
        elements.append(Spacer(1, 6))

    elements.append(Spacer(1, 8))

    # ============== PATIENT EDUCATION ==============
    patient_education = report_data.get("patient_education", "")
    if patient_education:
        elements.append(SectionDivider("Patient Education", page_width, color=colors.HexColor("#059669")))
        elements.append(Spacer(1, 10))
        elements.append(Paragraph(patient_education, styles['BodyText14']))
        elements.append(Spacer(1, 14))

    # ============== FOOTER / SIGNATORY ==============
    elements.append(HRFlowable(width="100%", thickness=1, color=GRAY_BORDER))
    elements.append(Spacer(1, 10))

    # Clinician signature block
    sig_text = f"""<b>{clinician.get('name', 'N/A')}</b><br/>
{clinician.get('specialization', '')} | Reg: {clinician.get('registration_no', 'N/A')}<br/><br/>
Signature: ____________________________"""
    elements.append(Paragraph(sig_text, ParagraphStyle(
        'Signature', parent=styles['Normal'],
        fontSize=10, fontName='Helvetica', textColor=BLACK, leading=14,
    )))
    elements.append(Spacer(1, 14))

    # AI Generation footer
    elements.append(HRFlowable(width="100%", thickness=0.5, color=GRAY_BORDER))
    elements.append(Spacer(1, 8))
    elements.append(Paragraph("Generated by MedScribe v1.0", styles['FooterText']))
    elements.append(Paragraph("On-Device AI Clinical Documentation", styles['FooterText']))
    elements.append(Paragraph("This document was generated by AI and reviewed by the clinician.", styles['FooterText']))
    elements.append(Spacer(1, 8))
    elements.append(BadgeRow(page_width))

    # Build PDF
    doc.build(elements)
    buffer.seek(0)
    return buffer.read()
