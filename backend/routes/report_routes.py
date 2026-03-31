"""Medical report routes: generate, update, send, PDF, list."""
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from datetime import datetime, timezone
import uuid, io
from db import db
from auth import get_current_user, require_role
from models.schemas import ReportGenerateRequest, ReportUpdateRequest
from report_generator import generate_medical_report_pdf

router = APIRouter()

@router.post("/reports/generate")
async def generate_report(data: ReportGenerateRequest, user=Depends(require_role("doctor"))):
    report_id = f"MS-{datetime.now(timezone.utc).strftime('%Y')}-{str(uuid.uuid4())[:5].upper()}"
    now_str = datetime.now(timezone.utc).isoformat()
    patient_user_id = None
    if data.patient_id_display:
        pat = await db.users.find_one({"patient_id": data.patient_id_display, "role": "patient"}, {"_id": 0, "id": 1})
        if pat:
            patient_user_id = pat["id"]
    report_doc = {
        "id": report_id,
        "source_type": data.source_type, "source_id": data.source_id,
        "doctor_id": user["id"], "doctor_name": user["name"],
        "doctor_specialty": user.get("specialty", ""),
        "doctor_license": user.get("license_number", ""),
        "patient_user_id": patient_user_id,
        "patient_name": data.patient_name,
        "patient_age": data.patient_age,
        "patient_gender": data.patient_gender,
        "patient_id_display": data.patient_id_display,
        "encounter_date": data.encounter_date or datetime.now(timezone.utc).strftime("%d %B %Y"),
        "encounter_type": data.encounter_type,
        "encounter_duration": data.encounter_duration,
        "subjective": {
            "chief_complaint": data.chief_complaint, "hpi": data.hpi,
            "review_of_systems": data.review_of_systems,
            "past_medical_history": data.past_medical_history,
            "current_medications": data.current_medications,
            "allergies": data.allergies, "social_history": data.social_history,
        },
        "objective": {
            "vital_signs": data.vital_signs,
            "physical_examination": data.physical_examination,
            "lab_results": data.lab_results,
        },
        "assessment": {
            "primary_diagnosis": data.primary_diagnosis,
            "icd_code": data.icd_code,
            "differential_diagnoses": data.differential_diagnoses,
            "clinical_reasoning": data.clinical_reasoning,
        },
        "plan": {
            "medications": data.medications,
            "simple_instructions": data.simple_instructions,
            "general_advice": data.general_advice,
            "warning_signs": data.warning_signs,
            "diagnostic_tests": data.diagnostic_tests,
            "referrals": data.referrals, "follow_up": data.follow_up,
        },
        "patient_education": data.patient_education,
        "status": "draft", "sent_at": None,
        "created_at": now_str, "updated_at": now_str,
        "encrypted": True, "encryption_status": "AES-256-GCM",
    }
    await db.reports.insert_one(report_doc)
    return {k: v for k, v in report_doc.items() if k != "_id"}

@router.put("/reports/{report_id}")
async def update_report(report_id: str, data: ReportUpdateRequest, user=Depends(require_role("doctor"))):
    report = await db.reports.find_one({"id": report_id}, {"_id": 0})
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    if report["doctor_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    if report["status"] == "sent":
        raise HTTPException(status_code=400, detail="Cannot edit a sent report")
    update_fields = {}
    subj = dict(report.get("subjective", {}))
    for field in ["chief_complaint", "hpi", "review_of_systems", "past_medical_history", "current_medications", "allergies", "social_history"]:
        val = getattr(data, field, None)
        if val is not None:
            subj[field] = val
    update_fields["subjective"] = subj
    obj = dict(report.get("objective", {}))
    if data.vital_signs is not None:
        obj["vital_signs"] = data.vital_signs
    if data.physical_examination is not None:
        obj["physical_examination"] = data.physical_examination
    if data.lab_results is not None:
        obj["lab_results"] = data.lab_results
    update_fields["objective"] = obj
    asmt = dict(report.get("assessment", {}))
    if data.primary_diagnosis is not None:
        asmt["primary_diagnosis"] = data.primary_diagnosis
    if data.icd_code is not None:
        asmt["icd_code"] = data.icd_code
    if data.differential_diagnoses is not None:
        asmt["differential_diagnoses"] = data.differential_diagnoses
    if data.clinical_reasoning is not None:
        asmt["clinical_reasoning"] = data.clinical_reasoning
    update_fields["assessment"] = asmt
    pln = dict(report.get("plan", {}))
    for field in ["medications", "simple_instructions", "general_advice", "warning_signs", "diagnostic_tests", "referrals", "follow_up"]:
        val = getattr(data, field, None)
        if val is not None:
            pln[field] = val
    update_fields["plan"] = pln
    if data.patient_education is not None:
        update_fields["patient_education"] = data.patient_education
    update_fields["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.reports.update_one({"id": report_id}, {"$set": update_fields})
    updated = await db.reports.find_one({"id": report_id}, {"_id": 0})
    return updated

@router.post("/reports/{report_id}/send")
async def send_report_to_patient(report_id: str, user=Depends(require_role("doctor"))):
    report = await db.reports.find_one({"id": report_id}, {"_id": 0})
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    if report["doctor_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    now_str = datetime.now(timezone.utc).isoformat()
    await db.reports.update_one({"id": report_id}, {"$set": {
        "status": "sent", "sent_at": now_str, "updated_at": now_str,
    }})
    return {"message": "Report sent to patient", "report_id": report_id, "sent_at": now_str}

@router.get("/reports/{report_id}/pdf")
async def download_report_pdf(report_id: str, user=Depends(get_current_user)):
    report = await db.reports.find_one({"id": report_id}, {"_id": 0})
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    if user["role"] == "doctor" and report["doctor_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    if user["role"] == "patient":
        if report.get("patient_user_id") != user["id"]:
            raise HTTPException(status_code=403, detail="Access denied")
        if report["status"] != "sent":
            raise HTTPException(status_code=403, detail="Report not yet available")
    pdf_data = {
        "report_id": report["id"],
        "generated_at": report.get("encounter_date", ""),
        "patient": {
            "name": report.get("patient_name", ""),
            "age": report.get("patient_age", ""),
            "gender": report.get("patient_gender", ""),
            "id": report.get("patient_id_display", ""),
        },
        "clinician": {
            "name": report.get("doctor_name", ""),
            "specialization": report.get("doctor_specialty", ""),
            "registration_no": report.get("doctor_license", ""),
        },
        "encounter": {
            "date": report.get("encounter_date", ""),
            "type": report.get("encounter_type", "Outpatient Consultation"),
            "duration": report.get("encounter_duration", "N/A"),
        },
        "subjective": report.get("subjective", {}),
        "objective": report.get("objective", {}),
        "assessment": report.get("assessment", {}),
        "plan": report.get("plan", {}),
        "patient_education": report.get("patient_education", ""),
    }
    pdf_bytes = generate_medical_report_pdf(pdf_data)
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="MedScribe_Report_{report_id}.pdf"',
            "X-Encryption-Status": "AES-256-GCM",
        },
    )

# IMPORTANT: /reports/my/list must be before /reports/{report_id}
@router.get("/reports/my/list")
async def get_my_reports(user=Depends(get_current_user)):
    if user["role"] == "doctor":
        reports = await db.reports.find({"doctor_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    elif user["role"] == "patient":
        reports = await db.reports.find({"patient_user_id": user["id"], "status": "sent"}, {"_id": 0}).sort("sent_at", -1).to_list(100)
    else:
        reports = await db.reports.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return reports

@router.get("/reports/{report_id}")
async def get_report_detail(report_id: str, user=Depends(get_current_user)):
    report = await db.reports.find_one({"id": report_id}, {"_id": 0})
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    if user["role"] == "doctor" and report["doctor_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    if user["role"] == "patient":
        if report.get("patient_user_id") != user["id"]:
            raise HTTPException(status_code=403, detail="Access denied")
        if report["status"] != "sent":
            raise HTTPException(status_code=403, detail="Report not yet available")
    return report
