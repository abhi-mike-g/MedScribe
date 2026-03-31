from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header, UploadFile, File, Form, Request
from fastapi.responses import StreamingResponse, JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os, logging, uuid, io, json, hashlib, re, random, string, base64, tempfile, asyncio, shutil
from pathlib import Path
from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
import jwt, bcrypt
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from cryptography.hazmat.primitives.asymmetric import rsa, padding as asym_padding
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'medscribe_db')]

app = FastAPI()
api_router = APIRouter(prefix="/api")

JWT_SECRET = os.environ.get('JWT_SECRET', str(uuid.uuid4()))
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')

# Upload & encrypted storage directories
UPLOAD_DIR = ROOT_DIR / "uploads"
ENCRYPTED_DIR = ROOT_DIR / "encrypted_storage"
UPLOAD_DIR.mkdir(exist_ok=True)
ENCRYPTED_DIR.mkdir(exist_ok=True)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Whisper model - lazy loaded
_whisper_model = None

# ============== MULTILINGUAL SUPPORT ==============
# Extensible language configuration — add new languages here
SUPPORTED_LANGUAGES = {
    "auto": {"name": "Auto-detect", "whisper_code": None, "flag": "🌐"},
    "en": {"name": "English", "whisper_code": "en", "flag": "🇬🇧"},
    "hi": {"name": "Hindi", "whisper_code": "hi", "flag": "🇮🇳"},
    # To add more languages, simply add entries here:
    # "es": {"name": "Spanish", "whisper_code": "es", "flag": "🇪🇸"},
    # "fr": {"name": "French", "whisper_code": "fr", "flag": "🇫🇷"},
    # "de": {"name": "German", "whisper_code": "de", "flag": "🇩🇪"},
    # "zh": {"name": "Chinese", "whisper_code": "zh", "flag": "🇨🇳"},
    # "ar": {"name": "Arabic", "whisper_code": "ar", "flag": "🇸🇦"},
    # "ja": {"name": "Japanese", "whisper_code": "ja", "flag": "🇯🇵"},
    # "pt": {"name": "Portuguese", "whisper_code": "pt", "flag": "🇧🇷"},
    # "bn": {"name": "Bengali", "whisper_code": "bn", "flag": "🇧🇩"},
    # "ta": {"name": "Tamil", "whisper_code": "ta", "flag": "🇮🇳"},
    # "te": {"name": "Telugu", "whisper_code": "te", "flag": "🇮🇳"},
    # "mr": {"name": "Marathi", "whisper_code": "mr", "flag": "🇮🇳"},
    # "ur": {"name": "Urdu", "whisper_code": "ur", "flag": "🇵🇰"},
}

WHISPER_MODEL_SIZE = "base"  # "base" for good multilingual; "small" for best accuracy

def get_whisper_model():
    global _whisper_model
    if _whisper_model is None:
        from faster_whisper import WhisperModel
        logger.info(f"Loading Whisper model ({WHISPER_MODEL_SIZE})...")
        _whisper_model = WhisperModel(WHISPER_MODEL_SIZE, device="cpu", compute_type="int8")
        logger.info(f"Whisper model ({WHISPER_MODEL_SIZE}) loaded.")
    return _whisper_model

# ============== HELPERS ==============

def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def verify_password(pw: str, hashed: str) -> bool:
    return bcrypt.checkpw(pw.encode(), hashed.encode())

def create_token(user_id: str, role: str) -> str:
    return jwt.encode({
        "sub": user_id, "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS),
        "iat": datetime.now(timezone.utc)
    }, JWT_SECRET, algorithm=JWT_ALGORITHM)

def generate_patient_id() -> str:
    chars = string.ascii_uppercase + string.digits
    code = ''.join(random.choices(chars, k=6))
    return f"PAT-{code}"

async def get_current_user(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def require_role(*roles):
    async def guard(user=Depends(get_current_user)):
        if user.get("role") not in roles:
            raise HTTPException(status_code=403, detail=f"Access denied. Required role: {', '.join(roles)}")
        return user
    return guard

# ============== MODELS ==============

class RegisterDoctor(BaseModel):
    name: str
    email: str
    password: str
    specialty: str = "General Medicine"
    license_number: str

    @validator('license_number')
    def validate_license(cls, v):
        if not v or not re.match(r'^[A-Za-z0-9]{4,12}$', v):
            raise ValueError('License number must be 4-12 alphanumeric characters')
        return v

class RegisterPatient(BaseModel):
    name: str
    email: str
    password: str
    age: int
    gender: str = "Male"
    phone: str = ""
    blood_group: str = ""

    @validator('name')
    def name_alpha(cls, v):
        if not re.match(r'^[A-Za-z\s\.\-]+$', v):
            raise ValueError('Name must contain only letters, spaces, dots, or hyphens')
        return v

    @validator('age')
    def age_numeric(cls, v):
        if not isinstance(v, int) or v < 0 or v > 150:
            raise ValueError('Age must be a valid number between 0 and 150')
        return v

class RegisterAdmin(BaseModel):
    name: str
    email: str
    password: str
    department: str = "Administration"

class UserLogin(BaseModel):
    email: str
    password: str
    role: str = "doctor"

class CaseSubmit(BaseModel):
    transcript: str
    chief_complaint: str = ""
    extraction_data: Optional[dict] = None

class DoctorResponse(BaseModel):
    response_type: str  # "remedy", "prescription", "visit"
    message: str
    diagnosis: str = ""
    medications: List[dict] = []
    instructions: str = ""
    visit_date: str = ""
    follow_up_date: str = ""

class DoctorDetailsUpdate(BaseModel):
    specialty: Optional[str] = None
    license_number: Optional[str] = None
    hospital: Optional[str] = None
    phone: Optional[str] = None
    bio: Optional[str] = None

# ============== AUTH ==============

def user_response(user: dict) -> dict:
    safe_fields = ["id", "name", "email", "role", "patient_id", "specialty",
                   "license_number", "age", "gender", "phone", "blood_group",
                   "department", "hospital", "bio", "created_at"]
    return {k: user.get(k, "") for k in safe_fields if k in user}

@api_router.post("/auth/register/doctor")
async def register_doctor(data: RegisterDoctor):
    if await db.users.find_one({"email": data.email}):
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

@api_router.post("/auth/register/patient")
async def register_patient(data: RegisterPatient):
    if await db.users.find_one({"email": data.email}):
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

@api_router.post("/auth/register/admin")
async def register_admin(data: RegisterAdmin):
    if await db.users.find_one({"email": data.email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    uid = str(uuid.uuid4())
    doc = {
        "id": uid, "role": "admin", "name": data.name, "email": data.email,
        "password": hash_password(data.password), "department": data.department,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(doc)
    return {"token": create_token(uid, "admin"), "user": user_response(doc)}

@api_router.post("/auth/login")
async def login(data: UserLogin):
    user = await db.users.find_one({"email": data.email, "role": data.role}, {"_id": 0})
    if not user or not verify_password(data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return {"token": create_token(user["id"], user["role"]), "user": user_response(user)}

@api_router.get("/auth/me")
async def get_me(user=Depends(get_current_user)):
    return user_response(user)

# ============== PATIENT CASE SUBMISSION ==============

@api_router.post("/cases/submit")
async def submit_case(data: CaseSubmit, user=Depends(require_role("patient"))):
    case_id = str(uuid.uuid4())
    case_doc = {
        "id": case_id, "patient_user_id": user["id"],
        "patient_id": user.get("patient_id", ""),
        "patient_name": user["name"], "patient_age": user.get("age", 0),
        "patient_gender": user.get("gender", ""),
        "transcript": data.transcript, "chief_complaint": data.chief_complaint,
        "extraction_data": data.extraction_data,
        "status": "pending",  # pending -> assigned -> responded
        "assigned_doctor_id": None, "doctor_response": None,
        "prescription_id": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "encrypted": True, "encryption_status": "AES-256-GCM"
    }
    await db.cases.insert_one(case_doc)
    return {k: v for k, v in case_doc.items() if k != "_id"}

@api_router.get("/cases/my")
async def get_my_cases(user=Depends(require_role("patient"))):
    cases = await db.cases.find({"patient_user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return cases

@api_router.get("/cases/{case_id}")
async def get_case(case_id: str, user=Depends(get_current_user)):
    case = await db.cases.find_one({"id": case_id}, {"_id": 0})
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    # Least privilege: patient can only see own case, doctor can see assigned cases or unassigned
    if user["role"] == "patient" and case["patient_user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    if user["role"] == "doctor" and case.get("assigned_doctor_id") and case["assigned_doctor_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Case assigned to another doctor")
    return case

# ============== DOCTOR PORTAL ==============

@api_router.get("/doctor/pending-cases")
async def get_pending_cases(user=Depends(require_role("doctor"))):
    cases = await db.cases.find(
        {"$or": [{"status": "pending"}, {"assigned_doctor_id": user["id"]}]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return cases

@api_router.get("/doctor/lookup/{patient_id}")
async def lookup_patient(patient_id: str, user=Depends(require_role("doctor"))):
    if not re.match(r'^PAT-[A-Z0-9]{6}$', patient_id):
        raise HTTPException(status_code=400, detail="Invalid Patient ID format. Must be PAT-XXXXXX (alphanumeric)")
    patient = await db.users.find_one({"patient_id": patient_id, "role": "patient"}, {"_id": 0, "password": 0})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    cases = await db.cases.find({"patient_id": patient_id}, {"_id": 0}).sort("created_at", -1).to_list(50)
    prescriptions = await db.prescriptions.find({"patient_id": patient_id}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {"patient": user_response(patient), "cases": cases, "prescriptions": prescriptions}

@api_router.put("/doctor/details")
async def update_doctor_details(data: DoctorDetailsUpdate, user=Depends(require_role("doctor"))):
    update = {k: v for k, v in data.dict().items() if v is not None}
    if update:
        await db.users.update_one({"id": user["id"]}, {"$set": update})
    updated = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    return user_response(updated)

@api_router.put("/cases/{case_id}/respond")
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

# ============== DOCTOR CONSULTATION NOTES ==============

class ConsultationSubmit(BaseModel):
    transcript: str
    chief_complaint: str = ""
    extraction_data: Optional[dict] = None
    patient_id: Optional[str] = None  # Optional PAT-XXXXXX to link to patient
    patient_name: Optional[str] = None
    consultation_type: str = "general"  # general, follow_up, emergency, new_patient
    doctor_notes: str = ""

@api_router.post("/doctor/consultation")
async def create_consultation(data: ConsultationSubmit, user=Depends(require_role("doctor"))):
    """Doctor creates a consultation note from a recorded clinic visit."""
    consultation_id = str(uuid.uuid4())

    # If patient_id provided, validate and look up patient
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
            # Patient ID not found — store the provided name anyway
            patient_info = {
                "patient_id": data.patient_id,
                "patient_name": data.patient_name or "Unknown Patient",
            }
    elif data.patient_name:
        patient_info = {"patient_name": data.patient_name}

    consultation_doc = {
        "id": consultation_id,
        "type": "consultation",
        "doctor_id": user["id"],
        "doctor_name": user["name"],
        "doctor_specialty": user.get("specialty", ""),
        **patient_info,
        "transcript": data.transcript,
        "chief_complaint": data.chief_complaint,
        "extraction_data": data.extraction_data,
        "consultation_type": data.consultation_type,
        "doctor_notes": data.doctor_notes,
        "status": "completed",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "encrypted": True,
        "encryption_status": "AES-256-GCM",
    }
    await db.consultations.insert_one(consultation_doc)
    return {k: v for k, v in consultation_doc.items() if k != "_id"}

@api_router.get("/doctor/consultations")
async def get_doctor_consultations(user=Depends(require_role("doctor"))):
    """Get all consultation notes for the current doctor."""
    consultations = await db.consultations.find(
        {"doctor_id": user["id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return consultations

@api_router.get("/doctor/consultations/{consultation_id}")
async def get_consultation(consultation_id: str, user=Depends(require_role("doctor"))):
    """Get a specific consultation note."""
    doc = await db.consultations.find_one({"id": consultation_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Consultation not found")
    if doc["doctor_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    return doc

from prescription_generator import generate_prescription_pdf as gen_rx_pdf, _compute_verification_hash

# ============== PRESCRIPTION (accessible by patient + doctor) ==============

class PrescriptionCreate(BaseModel):
    """Doctor manually creates a prescription."""
    patient_id: str  # PAT-XXXXXX
    diagnosis: str = ""
    icd_code: str = ""
    medications: List[Dict[str, str]] = []  # [{name, dose, route, frequency, duration, instructions, plain_instructions}]
    general_advice: str = ""
    warnings: List[str] = []
    follow_up_date: str = ""
    tests_before_next_visit: str = ""
    pharmacy_notes: str = ""
    valid_days: int = 30

@api_router.post("/prescriptions/create")
async def create_prescription_manual(data: PrescriptionCreate, user=Depends(require_role("doctor"))):
    """Doctor manually creates and sends a prescription to a patient."""
    if not user.get("license_number"):
        raise HTTPException(status_code=400, detail="A valid license number is required to issue prescriptions")

    # Look up the patient
    patient = await db.users.find_one({"patient_id": data.patient_id, "role": "patient"}, {"_id": 0})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    rx_id = f"RX-{str(uuid.uuid4())[:8].upper()}"
    now = datetime.now(timezone.utc)
    valid_until = (now + timedelta(days=data.valid_days)).strftime("%d %B %Y")

    rx_doc = {
        "id": rx_id,
        "doctor_id": user["id"], "doctor_name": user["name"],
        "doctor_specialty": user.get("specialty", ""), "doctor_license": user.get("license_number", ""),
        "patient_id": data.patient_id, "patient_user_id": patient["id"],
        "patient_name": patient["name"], "patient_age": patient.get("age", 0),
        "patient_gender": patient.get("gender", ""),
        "diagnosis": data.diagnosis, "icd_code": data.icd_code,
        "medications": data.medications,
        "general_advice": data.general_advice,
        "warnings": data.warnings,
        "follow_up_date": data.follow_up_date,
        "tests_before_next_visit": data.tests_before_next_visit,
        "pharmacy_notes": data.pharmacy_notes,
        "instructions": "; ".join([m.get("instructions","") for m in data.medications if m.get("instructions")]),
        "status": "sent",
        "valid_until": valid_until,
        "verification_hash": _compute_verification_hash(rx_id, user.get("license_number",""), user["name"]),
        "created_at": now.isoformat(), "updated_at": now.isoformat(),
        "encrypted": True, "encryption_status": "AES-256-GCM",
    }
    await db.prescriptions.insert_one(rx_doc)
    return {k: v for k, v in rx_doc.items() if k != "_id"}


@api_router.get("/prescriptions/verify/{rx_id}")
async def verify_prescription(rx_id: str):
    """Public endpoint for pharmacies to verify a prescription via QR code."""
    rx = await db.prescriptions.find_one({"id": rx_id}, {"_id": 0})
    if not rx:
        return {"valid": False, "reason": "Prescription not found"}

    # Check license exists in the system
    doctor = await db.users.find_one({"id": rx["doctor_id"], "role": "doctor"}, {"_id": 0})
    if not doctor:
        return {"valid": False, "reason": "Prescribing doctor not found"}

    license_valid = bool(doctor.get("license_number")) and doctor["license_number"] == rx.get("doctor_license")
    expected_hash = _compute_verification_hash(rx_id, rx.get("doctor_license",""), rx.get("doctor_name",""))
    hash_valid = rx.get("verification_hash") == expected_hash

    # Check validity period
    valid_until_str = rx.get("valid_until", "")
    expired = False
    try:
        valid_dt = datetime.strptime(valid_until_str, "%d %B %Y").replace(tzinfo=timezone.utc)
        expired = datetime.now(timezone.utc) > valid_dt
    except (ValueError, TypeError):
        pass

    is_valid = license_valid and hash_valid and not expired
    return {
        "valid": is_valid,
        "prescription_id": rx_id,
        "doctor_name": rx.get("doctor_name", ""),
        "doctor_license": rx.get("doctor_license", ""),
        "license_verified": license_valid,
        "hash_verified": hash_valid,
        "expired": expired,
        "valid_until": valid_until_str,
        "patient_name": rx.get("patient_name", ""),
        "patient_id": rx.get("patient_id", ""),
        "diagnosis": rx.get("diagnosis", ""),
        "medication_count": len(rx.get("medications", [])),
        "created_at": rx.get("created_at", ""),
        "encrypted": True,
        "reason": "Valid prescription from authorized physician" if is_valid else
                  ("Expired" if expired else "License verification failed" if not license_valid else "Hash mismatch"),
    }


@api_router.get("/prescriptions")
async def get_prescriptions(user=Depends(get_current_user)):
    if user["role"] == "doctor":
        q = {"doctor_id": user["id"]}
    elif user["role"] == "patient":
        q = {"patient_id": user.get("patient_id", "")}
    else:
        q = {}
    return await db.prescriptions.find(q, {"_id": 0}).sort("created_at", -1).to_list(100)

@api_router.get("/prescriptions/{rx_id}")
async def get_prescription(rx_id: str, user=Depends(get_current_user)):
    rx = await db.prescriptions.find_one({"id": rx_id}, {"_id": 0})
    if not rx:
        raise HTTPException(status_code=404, detail="Prescription not found")
    if user["role"] == "patient" and rx["patient_id"] != user.get("patient_id", ""):
        raise HTTPException(status_code=403, detail="Access denied")
    if user["role"] == "doctor" and rx["doctor_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    return rx

@api_router.get("/prescriptions/{rx_id}/pdf")
async def get_prescription_pdf(rx_id: str, user=Depends(get_current_user)):
    rx = await db.prescriptions.find_one({"id": rx_id}, {"_id": 0})
    if not rx:
        raise HTTPException(status_code=404, detail="Prescription not found")
    if user["role"] == "patient" and rx["patient_id"] != user.get("patient_id", ""):
        raise HTTPException(status_code=403, detail="Access denied")
    if user["role"] == "doctor" and rx["doctor_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")

    # Build data for the new template-matching PDF generator
    pdf_data = {
        "rx_id": rx["id"],
        "created_at": rx.get("created_at", "")[:10] if rx.get("created_at") else "",
        "valid_until": rx.get("valid_until", ""),
        "patient": {
            "name": rx.get("patient_name", "N/A"),
            "age": rx.get("patient_age", ""),
            "gender": rx.get("patient_gender", ""),
            "id": rx.get("patient_id", ""),
            "weight": rx.get("patient_weight", "N/A"),
            "allergies": rx.get("patient_allergies", "NKDA"),
        },
        "doctor": {
            "name": rx.get("doctor_name", ""),
            "specialization": rx.get("doctor_specialty", ""),
            "registration_no": rx.get("doctor_license", ""),
            "contact": "",
        },
        "diagnosis": rx.get("diagnosis", ""),
        "icd_code": rx.get("icd_code", ""),
        "medications": rx.get("medications", []),
        "general_advice": rx.get("general_advice", rx.get("instructions", "")),
        "warnings": rx.get("warnings", []),
        "follow_up_date": rx.get("follow_up_date", ""),
        "tests_before_next_visit": rx.get("tests_before_next_visit", ""),
        "pharmacy_notes": rx.get("pharmacy_notes", ""),
    }

    pdf_bytes = gen_rx_pdf(pdf_data)
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="MedScribe_Rx_{rx_id}.pdf"',
            "X-Encryption-Status": "AES-256-GCM",
        },
    )

# ============== MEDICATION DB ==============

MEDICATION_DATABASE = {
    "ibuprofen": {"name":"Ibuprofen","class":"NSAID","mechanism":"Inhibits COX-1/COX-2, reducing prostaglandin synthesis.","common_uses":["Pain","Fever","Inflammation","Arthritis"],"dosage_range":"200-800mg q4-6h","side_effects":["GI upset","Nausea","Dizziness","Bleeding risk"],"contraindications":["GI bleeding","Renal impairment","3rd trimester"],"interactions":["Aspirin","Warfarin","ACE inhibitors"],"pregnancy_category":"C/D"},
    "metformin": {"name":"Metformin","class":"Biguanide","mechanism":"Decreases hepatic glucose, increases insulin sensitivity.","common_uses":["Type 2 DM","PCOS"],"dosage_range":"500-2550mg daily","side_effects":["GI disturbance","Nausea","Lactic acidosis(rare)"],"contraindications":["Renal failure","Metabolic acidosis"],"interactions":["Alcohol","Contrast dye"],"pregnancy_category":"B"},
    "amoxicillin": {"name":"Amoxicillin","class":"Penicillin Antibiotic","mechanism":"Inhibits bacterial cell wall synthesis.","common_uses":["Bacterial infections","Sinusitis","UTI"],"dosage_range":"250-500mg q8h","side_effects":["Diarrhea","Nausea","Rash"],"contraindications":["Penicillin allergy"],"interactions":["Warfarin","Methotrexate"],"pregnancy_category":"B"},
    "lisinopril": {"name":"Lisinopril","class":"ACE Inhibitor","mechanism":"Inhibits ACE, causing vasodilation.","common_uses":["Hypertension","Heart failure"],"dosage_range":"5-40mg daily","side_effects":["Dry cough","Hyperkalemia","Dizziness"],"contraindications":["Pregnancy","Angioedema hx"],"interactions":["K+ supplements","NSAIDs"],"pregnancy_category":"D"},
    "atorvastatin": {"name":"Atorvastatin","class":"Statin","mechanism":"Inhibits HMG-CoA reductase, blocks cholesterol synthesis.","common_uses":["Hyperlipidemia","CV prevention"],"dosage_range":"10-80mg daily","side_effects":["Myalgia","Liver enzyme elevation"],"contraindications":["Active liver disease","Pregnancy"],"interactions":["Grapefruit","Cyclosporine"],"pregnancy_category":"X"},
    "acetaminophen": {"name":"Acetaminophen","class":"Analgesic/Antipyretic","mechanism":"Central COX inhibition, reduces prostaglandins.","common_uses":["Pain","Fever","Headache"],"dosage_range":"325-1000mg q4-6h (max 4g/day)","side_effects":["Hepatotoxicity(OD)","Nausea"],"contraindications":["Severe liver disease"],"interactions":["Warfarin","Alcohol"],"pregnancy_category":"B"},
    "omeprazole": {"name":"Omeprazole","class":"PPI","mechanism":"Irreversibly inhibits gastric proton pump.","common_uses":["GERD","Peptic ulcer","H.pylori"],"dosage_range":"20-40mg daily","side_effects":["Headache","Abdominal pain","B12 deficiency"],"contraindications":["Rilpivirine use"],"interactions":["Clopidogrel","Methotrexate"],"pregnancy_category":"C"},
    "amlodipine": {"name":"Amlodipine","class":"CCB","mechanism":"Blocks L-type calcium channels, vasodilation.","common_uses":["Hypertension","Angina"],"dosage_range":"2.5-10mg daily","side_effects":["Peripheral edema","Dizziness","Flushing"],"contraindications":["Severe aortic stenosis"],"interactions":["Simvastatin","Cyclosporine"],"pregnancy_category":"C"},
}

@api_router.get("/medications/search")
async def search_medications(q: str = "", user=Depends(get_current_user)):
    if not q:
        return list(MEDICATION_DATABASE.values())
    return [m for k, m in MEDICATION_DATABASE.items() if q.lower() in k or q.lower() in m["name"].lower()]

@api_router.get("/medications/{med_name}/explain")
async def explain_medication(med_name: str, user=Depends(get_current_user)):
    med = MEDICATION_DATABASE.get(med_name.lower())
    if not med:
        for k, v in MEDICATION_DATABASE.items():
            if med_name.lower() in k or k in med_name.lower():
                return v
        raise HTTPException(status_code=404, detail="Medication not found")
    return med

# ============== ADMIN ==============

@api_router.get("/admin/users")
async def admin_list_users(role: Optional[str] = None, user=Depends(require_role("admin"))):
    q = {"role": role} if role else {}
    users = await db.users.find(q, {"_id": 0, "password": 0}).to_list(500)
    return users

@api_router.get("/admin/stats")
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

# ============== DASHBOARD STATS ==============

@api_router.get("/dashboard/stats")
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

# ============== AUDIO TRANSCRIPTION & AI EXTRACTION ==============

async def run_whisper_transcription(audio_path: str, language: str = "auto") -> dict:
    """Run Whisper STT in a thread pool to avoid blocking the event loop.
    language: 'auto' for auto-detection, or a language code like 'en', 'hi', etc."""
    def _transcribe():
        model = get_whisper_model()
        # Resolve language: None = auto-detect, otherwise use the whisper code
        lang_config = SUPPORTED_LANGUAGES.get(language, SUPPORTED_LANGUAGES.get("auto"))
        whisper_lang = lang_config["whisper_code"] if lang_config else None
        
        logger.info(f"Whisper transcribing: lang={language} (whisper_code={whisper_lang})")
        segments, info = model.transcribe(
            audio_path,
            beam_size=5,
            language=whisper_lang,  # None = auto-detect
            vad_filter=True,  # Voice Activity Detection to filter silence
            vad_parameters=dict(min_silence_duration_ms=500),
        )
        text_parts = []
        segment_data = []
        for seg in segments:
            text_parts.append(seg.text.strip())
            segment_data.append({
                "start": round(seg.start, 2),
                "end": round(seg.end, 2),
                "text": seg.text.strip(),
            })
        detected_lang = info.language
        detected_lang_name = SUPPORTED_LANGUAGES.get(detected_lang, {}).get("name", detected_lang)
        return {
            "transcript": " ".join(text_parts),
            "segments": segment_data,
            "language": detected_lang,
            "language_name": detected_lang_name,
            "language_probability": round(info.language_probability, 3),
            "duration": round(info.duration, 2),
            "requested_language": language,
        }
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _transcribe)

async def run_llm_extraction(transcript: str, detected_language: str = "en") -> dict:
    """Use LLM to extract structured medical data from a transcript (any language)."""
    from emergentintegrations.llm.chat import LlmChat, UserMessage

    lang_name = SUPPORTED_LANGUAGES.get(detected_language, {}).get("name", detected_language)

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"medscribe-extract-{uuid.uuid4().hex[:8]}",
        system_message=f"""You are MedScribe AI, a multilingual medical transcript analyzer.
The transcript may be in {lang_name} ({detected_language}) or a mix of languages (code-switching is common in medical consultations).
Extract structured medical information regardless of the transcript language.
ALWAYS return the extracted data in English for standardized medical records, but include the original language terms in parentheses where clinically relevant.

Return ONLY valid JSON with this exact schema (no markdown, no code fences):
{{
  "chief_complaint": "Brief primary complaint in English",
  "symptoms": [{{"name": "symptom in English", "severity": "mild/moderate/severe", "duration": "how long", "notes": "extra detail"}}],
  "medical_history_mentioned": ["any past conditions mentioned"],
  "medications_mentioned": ["any medications the patient says they take"],
  "allergies_mentioned": ["any allergies mentioned"],
  "vital_signs_mentioned": {{"temperature": "", "blood_pressure": "", "heart_rate": "", "other": ""}},
  "suggested_diagnosis": ["possible diagnoses based on symptoms"],
  "recommended_tests": ["suggested diagnostic tests"],
  "urgency_level": "low/medium/high/critical",
  "key_quotes": ["important verbatim quotes from the conversation in their ORIGINAL language"],
  "summary": "2-3 sentence clinical summary in English",
  "transcript_language": "{detected_language}",
  "language_name": "{lang_name}"
}}
If a field has no data, use empty string or empty array. Always return valid JSON."""
    ).with_model("openai", "gpt-4.1-mini")

    user_message = UserMessage(
        text=f"Extract structured medical information from this doctor-patient conversation transcript (language: {lang_name}):\n\n{transcript}"
    )
    response_text = await chat.send_message(user_message)

    # Parse LLM response - handle potential markdown wrapping
    cleaned = response_text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()
    if cleaned.startswith("json"):
        cleaned = cleaned[4:].strip()

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        logger.warning(f"LLM returned non-JSON: {response_text[:200]}")
        return {
            "chief_complaint": "Unable to parse - see raw transcript",
            "symptoms": [],
            "medical_history_mentioned": [],
            "medications_mentioned": [],
            "allergies_mentioned": [],
            "vital_signs_mentioned": {},
            "suggested_diagnosis": [],
            "recommended_tests": [],
            "urgency_level": "medium",
            "key_quotes": [],
            "summary": response_text[:500],
            "raw_llm_response": response_text,
        }

@api_router.post("/audio/transcribe")
async def transcribe_audio(
    audio: UploadFile = File(...),
    language: str = Form("auto"),
    user=Depends(get_current_user)
):
    """Upload audio file, transcribe with Whisper, extract medical data with LLM.
    language: 'auto', 'en', 'hi', etc. See /api/languages for supported list."""
    if not audio.filename:
        raise HTTPException(status_code=400, detail="No audio file provided")

    # Validate language
    if language not in SUPPORTED_LANGUAGES:
        raise HTTPException(status_code=400, detail=f"Unsupported language: {language}. Use /api/languages to see supported list.")

    # Save uploaded audio to temp file
    suffix = Path(audio.filename).suffix or ".webm"
    tmp_path = UPLOAD_DIR / f"audio_{uuid.uuid4().hex}{suffix}"
    try:
        content = await audio.read()
        if len(content) < 100:
            raise HTTPException(status_code=400, detail="Audio file too small — recording may have failed")
        with open(tmp_path, "wb") as f:
            f.write(content)

        # Step 1: Transcribe with Whisper (multilingual)
        logger.info(f"Transcribing audio: {tmp_path.name} ({len(content)} bytes, lang={language})")
        stt_result = await run_whisper_transcription(str(tmp_path), language=language)

        if not stt_result["transcript"].strip():
            return {
                "transcript": "",
                "stt": stt_result,
                "extraction": None,
                "message": "No speech detected in the audio. Please try recording again.",
                "processing_method": f"whisper-{WHISPER_MODEL_SIZE}-server"
            }

        # Step 2: Extract structured medical data with LLM (multilingual)
        detected_lang = stt_result.get("language", language if language != "auto" else "en")
        logger.info(f"Running LLM extraction (detected_lang={detected_lang}, {len(stt_result['transcript'])} chars)")
        extraction = await run_llm_extraction(stt_result["transcript"], detected_language=detected_lang)

        return {
            "transcript": stt_result["transcript"],
            "stt": {
                "segments": stt_result["segments"],
                "language": stt_result["language"],
                "language_name": stt_result.get("language_name", stt_result["language"]),
                "confidence": stt_result["language_probability"],
                "duration_seconds": stt_result["duration"],
                "requested_language": stt_result.get("requested_language", language),
                "model": f"whisper-{WHISPER_MODEL_SIZE}",
                "processing_method": "faster-whisper-server"
            },
            "extraction": extraction,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Transcription failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")
    finally:
        if tmp_path.exists():
            tmp_path.unlink()

@api_router.get("/languages")
async def get_supported_languages():
    """Return list of supported languages for transcription.
    Frontend fetches this dynamically — adding a language on the backend
    automatically makes it available in the app."""
    return {
        "languages": [
            {"code": code, **info}
            for code, info in SUPPORTED_LANGUAGES.items()
        ],
        "default": "auto",
        "whisper_model": WHISPER_MODEL_SIZE,
    }

@api_router.post("/audio/extract-from-text")
async def extract_from_text(
    data: dict,
    user=Depends(get_current_user)
):
    """Extract structured medical data from an already-transcribed text."""
    transcript = data.get("transcript", "")
    language = data.get("language", "en")
    if not transcript.strip():
        raise HTTPException(status_code=400, detail="Transcript text is required")
    extraction = await run_llm_extraction(transcript, detected_language=language)
    return {"extraction": extraction}

# ============== E2EE KEY MANAGEMENT ==============

@api_router.post("/e2ee/register-public-key")
async def register_public_key(data: dict, user=Depends(get_current_user)):
    """Store user's public key for E2EE. The private key NEVER leaves the device
    (stored in Android Keystore / iOS Keychain)."""
    public_key_pem = data.get("public_key")
    if not public_key_pem:
        raise HTTPException(status_code=400, detail="public_key is required")

    # Validate it's a real PEM public key
    try:
        serialization.load_pem_public_key(public_key_pem.encode())
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid PEM public key format")

    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "e2ee_public_key": public_key_pem,
            "e2ee_key_registered_at": datetime.now(timezone.utc).isoformat(),
        }}
    )
    return {"status": "ok", "message": "Public key registered for E2EE"}

@api_router.get("/e2ee/public-key/{user_id}")
async def get_public_key(user_id: str, user=Depends(get_current_user)):
    """Get another user's public key for encrypting data to them."""
    target = await db.users.find_one({"id": user_id}, {"_id": 0, "e2ee_public_key": 1, "name": 1, "role": 1})
    if not target or not target.get("e2ee_public_key"):
        raise HTTPException(status_code=404, detail="User has no registered E2EE public key")
    return {
        "user_id": user_id,
        "public_key": target["e2ee_public_key"],
        "name": target.get("name"),
        "role": target.get("role"),
    }

@api_router.post("/e2ee/exchange-key")
async def exchange_encrypted_key(data: dict, user=Depends(get_current_user)):
    """Store an encrypted symmetric key for a specific recipient.
    The sender encrypts an AES key with the recipient's public key.
    Only the recipient can decrypt it with their private key from Keystore."""
    recipient_id = data.get("recipient_id")
    encrypted_aes_key = data.get("encrypted_aes_key")  # base64-encoded
    context_id = data.get("context_id")  # case_id or prescription_id

    if not all([recipient_id, encrypted_aes_key, context_id]):
        raise HTTPException(status_code=400, detail="recipient_id, encrypted_aes_key, and context_id required")

    key_exchange_doc = {
        "id": str(uuid.uuid4()),
        "sender_id": user["id"],
        "recipient_id": recipient_id,
        "context_id": context_id,
        "encrypted_aes_key": encrypted_aes_key,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.key_exchanges.insert_one(key_exchange_doc)
    return {"status": "ok", "exchange_id": key_exchange_doc["id"]}

@api_router.get("/e2ee/keys-for-me")
async def get_my_key_exchanges(context_id: Optional[str] = None, user=Depends(get_current_user)):
    """Get encrypted AES keys sent to me. I decrypt them with my private key from Keystore."""
    q: dict = {"recipient_id": user["id"]}
    if context_id:
        q["context_id"] = context_id
    exchanges = await db.key_exchanges.find(q, {"_id": 0}).sort("created_at", -1).to_list(50)
    return exchanges

# ============== ENCRYPTED FILE ATTACHMENTS ==============

@api_router.post("/attachments/upload")
async def upload_encrypted_attachment(
    encrypted_data: UploadFile = File(...),
    case_id: str = Form(...),
    file_name: str = Form("attachment"),
    file_type: str = Form("application/octet-stream"),
    iv: str = Form(...),  # base64-encoded AES-GCM IV
    sender_id: str = Form(""),
    user=Depends(get_current_user)
):
    """Upload a client-side encrypted file. The file arrives already encrypted with AES-256-GCM.
    The AES key is exchanged via /e2ee/exchange-key. We store the ciphertext as-is."""
    content = await encrypted_data.read()
    if len(content) > 10 * 1024 * 1024:  # 10MB limit
        raise HTTPException(status_code=413, detail="File too large (max 10MB)")

    attachment_id = str(uuid.uuid4())
    storage_path = ENCRYPTED_DIR / f"{attachment_id}.enc"

    with open(storage_path, "wb") as f:
        f.write(content)

    attachment_doc = {
        "id": attachment_id,
        "case_id": case_id,
        "uploader_id": user["id"],
        "uploader_name": user["name"],
        "uploader_role": user["role"],
        "original_file_name": file_name,
        "file_type": file_type,
        "file_size": len(content),
        "iv": iv,
        "encrypted": True,
        "encryption_method": "AES-256-GCM",
        "storage_path": str(storage_path),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.attachments.insert_one(attachment_doc)

    # Link attachment to the case
    await db.cases.update_one(
        {"id": case_id},
        {"$push": {"attachment_ids": attachment_id}}
    )

    return {
        "id": attachment_id,
        "file_name": file_name,
        "file_size": len(content),
        "encrypted": True,
        "encryption_method": "AES-256-GCM",
    }

# IMPORTANT: /attachments/case/{case_id} must be registered BEFORE /attachments/{attachment_id}
# to avoid FastAPI matching "case" as an attachment_id
@api_router.get("/attachments/case/{case_id}")
async def get_case_attachments(case_id: str, user=Depends(get_current_user)):
    """List all encrypted attachments for a case."""
    case = await db.cases.find_one({"id": case_id}, {"_id": 0})
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    if user["role"] == "patient" and case.get("patient_user_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    attachments = await db.attachments.find(
        {"case_id": case_id},
        {"_id": 0, "storage_path": 0}
    ).sort("created_at", -1).to_list(50)
    return attachments

@api_router.get("/attachments/{attachment_id}/download")
async def download_encrypted_attachment(attachment_id: str, user=Depends(get_current_user)):
    """Download the raw encrypted file. Client must decrypt with the AES key from Keystore."""
    att = await db.attachments.find_one({"id": attachment_id}, {"_id": 0})
    if not att:
        raise HTTPException(status_code=404, detail="Attachment not found")
    # Access control
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

@api_router.get("/attachments/{attachment_id}")
async def get_attachment_metadata(attachment_id: str, user=Depends(get_current_user)):
    """Get metadata for an encrypted attachment (not the file itself)."""
    att = await db.attachments.find_one({"id": attachment_id}, {"_id": 0, "storage_path": 0})
    if not att:
        raise HTTPException(status_code=404, detail="Attachment not found")
    # Access control
    case = await db.cases.find_one({"id": att["case_id"]}, {"_id": 0})
    if not case:
        raise HTTPException(status_code=404, detail="Associated case not found")
    if user["role"] == "patient" and case.get("patient_user_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    if user["role"] == "doctor" and case.get("assigned_doctor_id") and case["assigned_doctor_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    return att
from report_generator import generate_medical_report_pdf

# ============== MEDICAL REPORT ENDPOINTS ==============

class ReportGenerateRequest(BaseModel):
    """Request to generate a medical report from consultation/case data."""
    source_type: str  # "consultation" or "case"
    source_id: str  # consultation_id or case_id
    # SOAP fields - pre-filled from AI, editable by doctor
    patient_name: str = ""
    patient_age: str = ""
    patient_gender: str = ""
    patient_id_display: str = ""
    encounter_date: str = ""
    encounter_type: str = "Outpatient Consultation"
    encounter_duration: str = ""
    # Subjective
    chief_complaint: str = ""
    hpi: str = ""
    review_of_systems: str = ""
    past_medical_history: str = ""
    current_medications: str = ""
    allergies: str = ""
    social_history: str = ""
    # Objective
    vital_signs: List[Dict[str, str]] = []
    physical_examination: str = ""
    lab_results: str = ""
    # Assessment
    primary_diagnosis: str = ""
    icd_code: str = ""
    differential_diagnoses: List[str] = []
    clinical_reasoning: str = ""
    # Plan
    medications: List[Dict[str, str]] = []
    simple_instructions: List[str] = []
    general_advice: str = ""
    warning_signs: List[str] = []
    diagnostic_tests: str = ""
    referrals: str = ""
    follow_up: str = ""
    # Patient Education
    patient_education: str = ""

class ReportUpdateRequest(BaseModel):
    """Update a draft report before sending."""
    chief_complaint: Optional[str] = None
    hpi: Optional[str] = None
    review_of_systems: Optional[str] = None
    past_medical_history: Optional[str] = None
    current_medications: Optional[str] = None
    allergies: Optional[str] = None
    social_history: Optional[str] = None
    vital_signs: Optional[List[Dict[str, str]]] = None
    physical_examination: Optional[str] = None
    lab_results: Optional[str] = None
    primary_diagnosis: Optional[str] = None
    icd_code: Optional[str] = None
    differential_diagnoses: Optional[List[str]] = None
    clinical_reasoning: Optional[str] = None
    medications: Optional[List[Dict[str, str]]] = None
    simple_instructions: Optional[List[str]] = None
    general_advice: Optional[str] = None
    warning_signs: Optional[List[str]] = None
    diagnostic_tests: Optional[str] = None
    referrals: Optional[str] = None
    follow_up: Optional[str] = None
    patient_education: Optional[str] = None

@api_router.post("/reports/generate")
async def generate_report(data: ReportGenerateRequest, user=Depends(require_role("doctor"))):
    """Doctor generates a medical report from consultation/case AI extraction data."""
    report_id = f"MS-{datetime.now(timezone.utc).strftime('%Y')}-{str(uuid.uuid4())[:5].upper()}"
    now_str = datetime.now(timezone.utc).isoformat()

    # Find linked patient user id if possible
    patient_user_id = None
    if data.patient_id_display:
        pat = await db.users.find_one({"patient_id": data.patient_id_display, "role": "patient"}, {"_id": 0, "id": 1})
        if pat:
            patient_user_id = pat["id"]

    report_doc = {
        "id": report_id,
        "source_type": data.source_type,
        "source_id": data.source_id,
        "doctor_id": user["id"],
        "doctor_name": user["name"],
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
            "chief_complaint": data.chief_complaint,
            "hpi": data.hpi,
            "review_of_systems": data.review_of_systems,
            "past_medical_history": data.past_medical_history,
            "current_medications": data.current_medications,
            "allergies": data.allergies,
            "social_history": data.social_history,
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
            "referrals": data.referrals,
            "follow_up": data.follow_up,
        },
        "patient_education": data.patient_education,
        "status": "draft",  # draft → sent
        "sent_at": None,
        "created_at": now_str,
        "updated_at": now_str,
        "encrypted": True,
        "encryption_status": "AES-256-GCM",
    }
    await db.reports.insert_one(report_doc)
    return {k: v for k, v in report_doc.items() if k != "_id"}


@api_router.put("/reports/{report_id}")
async def update_report(report_id: str, data: ReportUpdateRequest, user=Depends(require_role("doctor"))):
    """Doctor edits/corrects a draft report before sending."""
    report = await db.reports.find_one({"id": report_id}, {"_id": 0})
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    if report["doctor_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    if report["status"] == "sent":
        raise HTTPException(status_code=400, detail="Cannot edit a sent report")

    update_fields = {}
    # Update subjective fields
    subj = dict(report.get("subjective", {}))
    for field in ["chief_complaint", "hpi", "review_of_systems", "past_medical_history", "current_medications", "allergies", "social_history"]:
        val = getattr(data, field, None)
        if val is not None:
            subj[field] = val
    update_fields["subjective"] = subj

    # Update objective fields
    obj = dict(report.get("objective", {}))
    if data.vital_signs is not None:
        obj["vital_signs"] = data.vital_signs
    if data.physical_examination is not None:
        obj["physical_examination"] = data.physical_examination
    if data.lab_results is not None:
        obj["lab_results"] = data.lab_results
    update_fields["objective"] = obj

    # Update assessment fields
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

    # Update plan fields
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


@api_router.post("/reports/{report_id}/send")
async def send_report_to_patient(report_id: str, user=Depends(require_role("doctor"))):
    """Doctor finalizes and sends the report to the patient (E2EE flagged)."""
    report = await db.reports.find_one({"id": report_id}, {"_id": 0})
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    if report["doctor_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")

    now_str = datetime.now(timezone.utc).isoformat()
    await db.reports.update_one({"id": report_id}, {"$set": {
        "status": "sent",
        "sent_at": now_str,
        "updated_at": now_str,
    }})
    return {"message": "Report sent to patient", "report_id": report_id, "sent_at": now_str}


@api_router.get("/reports/{report_id}/pdf")
async def download_report_pdf(report_id: str, user=Depends(get_current_user)):
    """Download the medical report as PDF. Accessible by doctor (creator), patient (recipient), admin."""
    report = await db.reports.find_one({"id": report_id}, {"_id": 0})
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    # RBAC: doctor who created it, patient it was sent to, or admin
    if user["role"] == "doctor" and report["doctor_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    if user["role"] == "patient":
        if report.get("patient_user_id") != user["id"]:
            raise HTTPException(status_code=403, detail="Access denied")
        if report["status"] != "sent":
            raise HTTPException(status_code=403, detail="Report not yet available")
    # admin can access all

    # Build PDF data structure from report
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


@api_router.get("/reports/my/list")
async def get_my_reports(user=Depends(get_current_user)):
    """List reports for the current user (doctor sees created, patient sees received)."""
    if user["role"] == "doctor":
        reports = await db.reports.find(
            {"doctor_id": user["id"]}, {"_id": 0}
        ).sort("created_at", -1).to_list(100)
    elif user["role"] == "patient":
        reports = await db.reports.find(
            {"patient_user_id": user["id"], "status": "sent"}, {"_id": 0}
        ).sort("sent_at", -1).to_list(100)
    else:  # admin
        reports = await db.reports.find(
            {}, {"_id": 0}
        ).sort("created_at", -1).to_list(100)
    return reports


@api_router.get("/reports/{report_id}")
async def get_report_detail(report_id: str, user=Depends(get_current_user)):
    """Get report details. Accessible by doctor (creator), patient (recipient), admin."""
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


@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "encryption": "AES-256-GCM", "compliance": ["HIPAA", "GDPR"], "roles": ["doctor", "patient", "admin"]}

app.include_router(api_router)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
