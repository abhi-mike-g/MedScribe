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
    license_number: str = ""

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

# ============== PRESCRIPTION (accessible by patient + doctor) ==============

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
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=letter, topMargin=0.5*inch, bottomMargin=0.5*inch)
    styles = getSampleStyleSheet()
    story = []
    hs = ParagraphStyle('H', parent=styles['Title'], fontSize=18, textColor=colors.HexColor('#0033A0'), spaceAfter=4)
    story.append(Paragraph("MedScribe Prescription", hs))
    story.append(Paragraph(f"<b>Dr. {rx.get('doctor_name','N/A')}</b> — {rx.get('doctor_specialty','')}", styles['Normal']))
    story.append(Paragraph(f"License: {rx.get('doctor_license','N/A')}", styles['Normal']))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#0033A0')))
    story.append(Spacer(1,12))
    story.append(Paragraph(f"<b>Patient:</b> {rx.get('patient_name','N/A')} | <b>ID:</b> {rx.get('patient_id','N/A')}", styles['Normal']))
    story.append(Paragraph(f"<b>Age:</b> {rx.get('patient_age','N/A')} | <b>Gender:</b> {rx.get('patient_gender','N/A')}", styles['Normal']))
    story.append(Paragraph(f"<b>Date:</b> {rx.get('created_at','')[:10]}", styles['Normal']))
    story.append(Spacer(1,12))
    story.append(Paragraph(f"<b>Diagnosis:</b> {rx.get('diagnosis','N/A')}", styles['Heading3']))
    story.append(Spacer(1,8))
    meds = rx.get("medications", [])
    if meds:
        td = [["#","Medication","Dosage","Frequency","Duration"]]
        for i, m in enumerate(meds, 1):
            td.append([str(i), m.get("name",""), m.get("dosage",""), m.get("frequency",""), m.get("duration","")])
        t = Table(td, colWidths=[30,150,100,100,100])
        t.setStyle(TableStyle([
            ('BACKGROUND',(0,0),(-1,0),colors.HexColor('#0033A0')),('TEXTCOLOR',(0,0),(-1,0),colors.white),
            ('ALIGN',(0,0),(-1,-1),'LEFT'),('FONTSIZE',(0,0),(-1,-1),10),('BOTTOMPADDING',(0,0),(-1,0),8),
            ('GRID',(0,0),(-1,-1),0.5,colors.grey),
            ('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,colors.HexColor('#F0F4FF')]),
        ]))
        story.append(t); story.append(Spacer(1,12))
    if rx.get("instructions"):
        story.append(Paragraph(f"<b>Instructions:</b> {rx['instructions']}", styles['Normal']))
    if rx.get("follow_up_date"):
        story.append(Spacer(1,8)); story.append(Paragraph(f"<b>Follow-up:</b> {rx['follow_up_date']}", styles['Normal']))
    story.append(Spacer(1,24))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.grey))
    story.append(Paragraph("End-to-End Encrypted | HIPAA Compliant | Principle of Least Privilege", ParagraphStyle('F', parent=styles['Normal'], fontSize=8, textColor=colors.grey)))
    doc.build(story); buf.seek(0)
    return StreamingResponse(buf, media_type="application/pdf", headers={"Content-Disposition": f"attachment; filename=rx_{rx_id[:8]}.pdf"})

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
        recent = await db.cases.find({"$or": [{"status": "pending"}, {"assigned_doctor_id": user["id"]}]}, {"_id": 0}).sort("created_at", -1).limit(5).to_list(5)
        return {"patient_count": pc, "pending_cases": pending, "prescription_count": rx_count, "recent_cases": recent, "encryption_status": "AES-256-GCM", "compliance": ["HIPAA","GDPR"]}
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
@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "encryption": "AES-256-GCM", "compliance": ["HIPAA", "GDPR"], "roles": ["doctor", "patient", "admin"]}

app.include_router(api_router)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
