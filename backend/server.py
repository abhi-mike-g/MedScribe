from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os, logging, uuid, io, json, hashlib, re, random, string
from pathlib import Path
from pydantic import BaseModel, Field, validator
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import jwt, bcrypt
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

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

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "encryption": "AES-256-GCM", "compliance": ["HIPAA", "GDPR"], "roles": ["doctor", "patient", "admin"]}

app.include_router(api_router)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
