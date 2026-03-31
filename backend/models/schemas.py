"""Pydantic schemas for request/response validation."""
from pydantic import BaseModel, validator
from typing import List, Optional, Dict
import re


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

class ConsultationSubmit(BaseModel):
    transcript: str
    chief_complaint: str = ""
    extraction_data: Optional[dict] = None
    patient_id: Optional[str] = None
    patient_name: Optional[str] = None
    consultation_type: str = "general"
    doctor_notes: str = ""

class PrescriptionCreate(BaseModel):
    patient_id: str
    diagnosis: str = ""
    icd_code: str = ""
    medications: List[Dict[str, str]] = []
    general_advice: str = ""
    warnings: List[str] = []
    follow_up_date: str = ""
    tests_before_next_visit: str = ""
    pharmacy_notes: str = ""
    valid_days: int = 30

class ReportGenerateRequest(BaseModel):
    source_type: str
    source_id: str
    patient_name: str = ""
    patient_age: str = ""
    patient_gender: str = ""
    patient_id_display: str = ""
    encounter_date: str = ""
    encounter_type: str = "Outpatient Consultation"
    encounter_duration: str = ""
    chief_complaint: str = ""
    hpi: str = ""
    review_of_systems: str = ""
    past_medical_history: str = ""
    current_medications: str = ""
    allergies: str = ""
    social_history: str = ""
    vital_signs: List[Dict[str, str]] = []
    physical_examination: str = ""
    lab_results: str = ""
    primary_diagnosis: str = ""
    icd_code: str = ""
    differential_diagnoses: List[str] = []
    clinical_reasoning: str = ""
    medications: List[Dict[str, str]] = []
    simple_instructions: List[str] = []
    general_advice: str = ""
    warning_signs: List[str] = []
    diagnostic_tests: str = ""
    referrals: str = ""
    follow_up: str = ""
    patient_education: str = ""

class ReportUpdateRequest(BaseModel):
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
