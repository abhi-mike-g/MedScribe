"""Encrypted file attachment routes."""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from datetime import datetime, timezone
from pathlib import Path
import uuid
from db import db, ENCRYPTED_DIR
from auth import get_current_user

router = APIRouter()

@router.post("/attachments/upload")
async def upload_encrypted_attachment(
    encrypted_data: UploadFile = File(...),
    case_id: str = Form(...),
    file_name: str = Form("attachment"),
    file_type: str = Form("application/octet-stream"),
    iv: str = Form(...),
    sender_id: str = Form(""),
    user=Depends(get_current_user)
):
    content = await encrypted_data.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large (max 10MB)")
    attachment_id = str(uuid.uuid4())
    storage_path = ENCRYPTED_DIR / f"{attachment_id}.enc"
    with open(storage_path, "wb") as f:
        f.write(content)
    attachment_doc = {
        "id": attachment_id, "case_id": case_id,
        "uploader_id": user["id"], "uploader_name": user["name"],
        "uploader_role": user["role"], "original_file_name": file_name,
        "file_type": file_type, "file_size": len(content),
        "iv": iv, "encrypted": True, "encryption_method": "AES-256-GCM",
        "storage_path": str(storage_path),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.attachments.insert_one(attachment_doc)
    await db.cases.update_one({"id": case_id}, {"$push": {"attachment_ids": attachment_id}})
    return {
        "id": attachment_id, "file_name": file_name,
        "file_size": len(content), "encrypted": True,
        "encryption_method": "AES-256-GCM",
    }

# IMPORTANT: /case/{case_id} must be before /{attachment_id} to avoid route conflicts
@router.get("/attachments/case/{case_id}")
async def get_case_attachments(case_id: str, user=Depends(get_current_user)):
    case = await db.cases.find_one({"id": case_id}, {"_id": 0})
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    if user["role"] == "patient" and case.get("patient_user_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    attachments = await db.attachments.find(
        {"case_id": case_id}, {"_id": 0, "storage_path": 0}
    ).sort("created_at", -1).to_list(50)
    return attachments

@router.get("/attachments/{attachment_id}/download")
async def download_encrypted_attachment(attachment_id: str, user=Depends(get_current_user)):
    att = await db.attachments.find_one({"id": attachment_id}, {"_id": 0})
    if not att:
        raise HTTPException(status_code=404, detail="Attachment not found")
    case = await db.cases.find_one({"id": att["case_id"]}, {"_id": 0})
    if not case:
        raise HTTPException(status_code=404, detail="Associated case not found")
    if user["role"] == "patient" and case.get("patient_user_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    storage_path = Path(att["storage_path"])
    if not storage_path.exists():
        raise HTTPException(status_code=404, detail="File not found on server")
    return StreamingResponse(
        open(storage_path, "rb"),
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": f"attachment; filename={att['original_file_name']}.enc",
            "X-Encryption-Method": "AES-256-GCM",
            "X-Encryption-IV": att["iv"],
        }
    )

@router.get("/attachments/{attachment_id}")
async def get_attachment_metadata(attachment_id: str, user=Depends(get_current_user)):
    att = await db.attachments.find_one({"id": attachment_id}, {"_id": 0, "storage_path": 0})
    if not att:
        raise HTTPException(status_code=404, detail="Attachment not found")
    case = await db.cases.find_one({"id": att["case_id"]}, {"_id": 0})
    if not case:
        raise HTTPException(status_code=404, detail="Associated case not found")
    if user["role"] == "patient" and case.get("patient_user_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    if user["role"] == "doctor" and case.get("assigned_doctor_id") and case["assigned_doctor_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    return att
