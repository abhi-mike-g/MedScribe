"""Admin and dashboard stats routes."""
from fastapi import APIRouter, Depends
from typing import Optional
from db import db
from auth import get_current_user, require_role

router = APIRouter()

@router.get("/admin/users")
async def admin_list_users(role: Optional[str] = None, user=Depends(require_role("admin"))):
    q = {"role": role} if role else {}
    users = await db.users.find(q, {"_id": 0, "password": 0}).to_list(500)
    return users

@router.get("/admin/stats")
async def admin_stats(user=Depends(require_role("admin"))):
    return {
        "total_users": await db.users.count_documents({}),
        "doctors": await db.users.count_documents({"role": "doctor"}),
        "patients": await db.users.count_documents({"role": "patient"}),
        "admins": await db.users.count_documents({"role": "admin"}),
        "total_cases": await db.cases.count_documents({}),
        "pending_cases": await db.cases.count_documents({"status": "pending"}),
        "responded_cases": await db.cases.count_documents({"status": "responded"}),
        "total_prescriptions": await db.prescriptions.count_documents({}),
    }

@router.get("/dashboard/stats")
async def get_dashboard_stats(user=Depends(get_current_user)):
    if user["role"] == "doctor":
        pc = await db.cases.count_documents({"assigned_doctor_id": user["id"]})
        pending = await db.cases.count_documents({"$or": [{"status": "pending"}, {"assigned_doctor_id": user["id"], "status": {"$ne": "responded"}}]})
        rx_count = await db.prescriptions.count_documents({"doctor_id": user["id"]})
        consultation_count = await db.consultations.count_documents({"doctor_id": user["id"]})
        recent = await db.cases.find({"$or": [{"status": "pending"}, {"assigned_doctor_id": user["id"]}]}, {"_id": 0}).sort("created_at", -1).limit(5).to_list(5)
        recent_consultations = await db.consultations.find({"doctor_id": user["id"]}, {"_id": 0}).sort("created_at", -1).limit(5).to_list(5)
        return {"patient_count": pc, "pending_cases": pending, "prescription_count": rx_count, "consultation_count": consultation_count, "recent_cases": recent, "recent_consultations": recent_consultations, "encryption_status": "AES-256-GCM", "compliance": ["HIPAA","GDPR"]}
    elif user["role"] == "patient":
        cases = await db.cases.find({"patient_user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).limit(5).to_list(5)
        total = await db.cases.count_documents({"patient_user_id": user["id"]})
        pending = await db.cases.count_documents({"patient_user_id": user["id"], "status": "pending"})
        responded = await db.cases.count_documents({"patient_user_id": user["id"], "status": "responded"})
        rx_count = await db.prescriptions.count_documents({"patient_id": user.get("patient_id", "")})
        return {"total_cases": total, "pending_cases": pending, "responded_cases": responded, "prescription_count": rx_count, "recent_cases": cases, "patient_id": user.get("patient_id", ""), "encryption_status": "AES-256-GCM"}
    else:
        return await admin_stats(user)
