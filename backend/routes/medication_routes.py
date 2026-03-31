"""Medication routes: search and explain."""
from fastapi import APIRouter, HTTPException, Depends
from auth import get_current_user
from config import MEDICATION_DATABASE

router = APIRouter()

@router.get("/medications/search")
async def search_medications(q: str = "", user=Depends(get_current_user)):
    if not q:
        return list(MEDICATION_DATABASE.values())
    return [m for k, m in MEDICATION_DATABASE.items() if q.lower() in k or q.lower() in m["name"].lower()]

@router.get("/medications/{med_name}/explain")
async def explain_medication(med_name: str, user=Depends(get_current_user)):
    med = MEDICATION_DATABASE.get(med_name.lower())
    if not med:
        for k, v in MEDICATION_DATABASE.items():
            if med_name.lower() in k or k in med_name.lower():
                return v
        raise HTTPException(status_code=404, detail="Medication not found")
    return med
