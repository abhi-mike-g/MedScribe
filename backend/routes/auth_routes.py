"""Auth routes: register, login, profile."""
from fastapi import APIRouter
from datetime import datetime, timezone
import uuid, hashlib
from db import db
from auth import hash_password, verify_password, create_token, generate_patient_id, user_response, get_current_user
from models.schemas import RegisterDoctor, RegisterPatient, RegisterAdmin, UserLogin
from fastapi import Depends

router = APIRouter()

@router.post("/auth/register/doctor")
async def register_doctor(data: RegisterDoctor):
    if await db.users.find_one({"email": data.email}):
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Email already registered")
    uid = str(uuid.uuid4())
    doc = {
        "id": uid, "role": "doctor", "name": data.name, "email": data.email,
        "password": hash_password(data.password), "specialty": data.specialty,
        "license_number": data.license_number, "hospital": "", "phone": "", "bio": "",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "encryption_key_hash": hashlib.sha256(uid.encode()).hexdigest()[:16]
    }
    await db.users.insert_one(doc)
    return {"token": create_token(uid, "doctor"), "user": user_response(doc)}

@router.post("/auth/register/patient")
async def register_patient(data: RegisterPatient):
    if await db.users.find_one({"email": data.email}):
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Email already registered")
    uid = str(uuid.uuid4())
    pid = generate_patient_id()
    while await db.users.find_one({"patient_id": pid}):
        pid = generate_patient_id()
    doc = {
        "id": uid, "role": "patient", "patient_id": pid, "name": data.name,
        "email": data.email, "password": hash_password(data.password),
        "age": data.age, "gender": data.gender, "phone": data.phone,
        "blood_group": data.blood_group, "allergies": [], "medical_history": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "encryption_key_hash": hashlib.sha256(uid.encode()).hexdigest()[:16]
    }
    await db.users.insert_one(doc)
    return {"token": create_token(uid, "patient"), "user": user_response(doc)}

@router.post("/auth/register/admin")
async def register_admin(data: RegisterAdmin):
    if await db.users.find_one({"email": data.email}):
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Email already registered")
    uid = str(uuid.uuid4())
    doc = {
        "id": uid, "role": "admin", "name": data.name, "email": data.email,
        "password": hash_password(data.password), "department": data.department,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(doc)
    return {"token": create_token(uid, "admin"), "user": user_response(doc)}

@router.post("/auth/login")
async def login(data: UserLogin):
    from fastapi import HTTPException
    user = await db.users.find_one({"email": data.email, "role": data.role}, {"_id": 0})
    if not user or not verify_password(data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return {"token": create_token(user["id"], user["role"]), "user": user_response(user)}

@router.get("/auth/me")
async def get_me(user=Depends(get_current_user)):
    return user_response(user)
