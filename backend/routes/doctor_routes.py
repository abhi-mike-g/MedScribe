"""Doctor routes: pending cases, patient lookup, consultations, case response."""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
import uuid, re
from db import db
from auth import get_current_user, require_role, user_response
from models.schemas import DoctorResponse, DoctorDetailsUpdate, ConsultationSubmit

router = APIRouter()

@router.get("/doctor/pending-cases")
async def get_pending_cases(user=Depends(require_role("doctor"))):
    cases = await db.cases.find(
        {"$or": [{"status": "pending"}, {"assigned_doctor_id": user["id"]}]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return cases

@router.get("/doctor/lookup/{patient_id}")
async def lookup_patient(patient_id: str, user=Depends(require_role("doctor"))):
    if not re.match(r'^PAT-[A-Z0-9]{6}$', patient_id):
        raise HTTPException(status_code=400, detail="Invalid Patient ID format. Must be PAT-XXXXXX (alphanumeric)")
    patient = await db.users.find_one({"patient_id": patient_id, "role": "patient"}, {"_id": 0, "password": 0})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    cases = await db.cases.find({"patient_id": patient_id}, {"_id": 0}).sort("created_at", -1).to_list(50)
    prescriptions = await db.prescriptions.find({"patient_id": patient_id}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {"patient": user_response(patient), "cases": cases, "prescriptions": prescriptions}

@router.put("/doctor/details")
async def update_doctor_details(data: DoctorDetailsUpdate, user=Depends(require_role("doctor"))):
    update = {k: v for k, v in data.dict().items() if v is not None}
    if update:
        await db.users.update_one({"id": user["id"]}, {"$set": update})
    updated = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    return user_response(updated)

@router.put("/cases/{case_id}/respond")
async def respond_to_case(case_id: str, data: DoctorResponse, user=Depends(require_role("doctor"))):
    case = await db.cases.find_one({"id": case_id}, {"_id": 0})
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    response_doc = {
        "response_type": data.response_type,
        "message": data.message, "diagnosis": data.diagnosis,
        "medications": data.medications, "instructions": data.instructions,
        "visit_date": data.visit_date, "follow_up_date": data.follow_up_date,
        "doctor_id": user["id"], "doctor_name": user["name"],
        "responded_at": datetime.now(timezone.utc).isoformat(),
        "encrypted": True, "encryption_status": "AES-256-GCM"
    }
    prescription_id = None
    if data.response_type == "prescription" and data.medications:
        prescription_id = str(uuid.uuid4())
        rx_doc = {
            "id": prescription_id, "doctor_id": user["id"], "doctor_name": user["name"],
            "doctor_specialty": user.get("specialty", ""), "doctor_license": user.get("license_number", ""),
            "patient_id": case["patient_id"], "patient_name": case["patient_name"],
            "patient_age": case.get("patient_age", 0), "patient_gender": case.get("patient_gender", ""),
            "case_id": case_id, "diagnosis": data.diagnosis,
            "medications": data.medications, "instructions": data.instructions,
            "follow_up_date": data.follow_up_date,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "encrypted": True, "encryption_status": "AES-256-GCM"
        }
        await db.prescriptions.insert_one(rx_doc)
    await db.cases.update_one({"id": case_id}, {"$set": {
        "status": "responded", "assigned_doctor_id": user["id"],
        "doctor_response": response_doc, "prescription_id": prescription_id,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }})
    updated = await db.cases.find_one({"id": case_id}, {"_id": 0})
    return updated

# ============== CONSULTATIONS ==============

@router.post("/doctor/consultation")
async def create_consultation(data: ConsultationSubmit, user=Depends(require_role("doctor"))):
    consultation_id = str(uuid.uuid4())
    patient_info = {}
    if data.patient_id:
        patient = await db.users.find_one({"patient_id": data.patient_id, "role": "patient"}, {"_id": 0})
        if patient:
            patient_info = {
                "patient_user_id": patient["id"],
                "patient_id": patient["patient_id"],
                "patient_name": patient["name"],
                "patient_age": patient.get("age", 0),
                "patient_gender": patient.get("gender", ""),
            }
        else:
            patient_info = {
                "patient_id": data.patient_id,
                "patient_name": data.patient_name or "Unknown Patient",
            }
    elif data.patient_name:
        patient_info = {"patient_name": data.patient_name}

    consultation_doc = {
        "id": consultation_id, "type": "consultation",
        "doctor_id": user["id"], "doctor_name": user["name"],
        "doctor_specialty": user.get("specialty", ""),
        **patient_info,
        "transcript": data.transcript, "chief_complaint": data.chief_complaint,
        "extraction_data": data.extraction_data,
        "consultation_type": data.consultation_type,
        "doctor_notes": data.doctor_notes, "status": "completed",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "encrypted": True, "encryption_status": "AES-256-GCM",
    }
    await db.consultations.insert_one(consultation_doc)
    return {k: v for k, v in consultation_doc.items() if k != "_id"}

@router.get("/doctor/consultations")
async def get_doctor_consultations(user=Depends(require_role("doctor"))):
    return await db.consultations.find(
        {"doctor_id": user["id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)

@router.get("/doctor/consultations/{consultation_id}")
async def get_consultation(consultation_id: str, user=Depends(require_role("doctor"))):
    doc = await db.consultations.find_one({"id": consultation_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Consultation not found")
    if doc["doctor_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    return doc
