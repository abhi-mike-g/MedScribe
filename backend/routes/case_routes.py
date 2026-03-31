"""Case routes: patient case submission and retrieval."""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
import uuid
from db import db
from auth import get_current_user, require_role
from models.schemas import CaseSubmit

router = APIRouter()

@router.post("/cases/submit")
async def submit_case(data: CaseSubmit, user=Depends(require_role("patient"))):
    case_id = str(uuid.uuid4())
    case_doc = {
        "id": case_id, "patient_user_id": user["id"],
        "patient_id": user.get("patient_id", ""),
        "patient_name": user["name"], "patient_age": user.get("age", 0),
        "patient_gender": user.get("gender", ""),
        "transcript": data.transcript, "chief_complaint": data.chief_complaint,
        "extraction_data": data.extraction_data,
        "status": "pending",
        "assigned_doctor_id": None, "doctor_response": None,
        "prescription_id": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "encrypted": True, "encryption_status": "AES-256-GCM"
    }
    await db.cases.insert_one(case_doc)
    return {k: v for k, v in case_doc.items() if k != "_id"}

@router.get("/cases/my")
async def get_my_cases(user=Depends(require_role("patient"))):
    cases = await db.cases.find({"patient_user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return cases

@router.get("/cases/{case_id}")
async def get_case(case_id: str, user=Depends(get_current_user)):
    case = await db.cases.find_one({"id": case_id}, {"_id": 0})
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    if user["role"] == "patient" and case["patient_user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    if user["role"] == "doctor" and case.get("assigned_doctor_id") and case["assigned_doctor_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Case assigned to another doctor")
    return case
