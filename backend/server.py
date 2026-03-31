"""MedScribe Backend — Modular Entry Point.

All business logic has been moved to:
  - routes/     — API endpoint handlers
  - models/     — Pydantic schemas
  - services/   — Whisper STT, LLM extraction
  - config.py   — Constants, language config, medication DB
  - auth.py     — JWT auth helpers
  - db.py       — MongoDB connection
"""
from fastapi import FastAPI, APIRouter
from starlette.middleware.cors import CORSMiddleware
from db import client
import logging

logging.basicConfig(level=logging.INFO)

app = FastAPI(title="MedScribe API", description="E2EE Medical Documentation Platform")
api_router = APIRouter(prefix="/api")

# ============== IMPORT ROUTE MODULES ==============
from routes.auth_routes import router as auth_router
from routes.case_routes import router as case_router
from routes.doctor_routes import router as doctor_router
from routes.prescription_routes import router as prescription_router
from routes.medication_routes import router as medication_router
from routes.audio_routes import router as audio_router
from routes.e2ee_routes import router as e2ee_router
from routes.attachment_routes import router as attachment_router
from routes.report_routes import router as report_router
from routes.admin_routes import router as admin_router

# ============== INCLUDE ALL ROUTERS ==============
# Order matters for path matching: specific paths before wildcards
api_router.include_router(auth_router)
api_router.include_router(case_router)
api_router.include_router(doctor_router)
api_router.include_router(prescription_router)
api_router.include_router(medication_router)
api_router.include_router(audio_router)
api_router.include_router(e2ee_router)
api_router.include_router(attachment_router)
api_router.include_router(report_router)
api_router.include_router(admin_router)

# ============== HEALTH CHECK ==============
@api_router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "encryption": "AES-256-GCM",
        "compliance": ["HIPAA", "GDPR"],
        "roles": ["doctor", "patient", "admin"],
        "architecture": "modular",
    }

app.include_router(api_router)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
