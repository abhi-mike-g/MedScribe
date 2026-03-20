"""
MedScribe Backend API Tests
Tests: Auth, Patients, Consultations, Prescriptions, AI endpoints, Medications, Dashboard
"""
import pytest
import requests
import os
import uuid
from pathlib import Path
from dotenv import load_dotenv

# Load frontend .env to get EXPO_PUBLIC_BACKEND_URL
frontend_env = Path(__file__).parent.parent.parent / 'frontend' / '.env'
if frontend_env.exists():
    load_dotenv(frontend_env)

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    raise ValueError("EXPO_PUBLIC_BACKEND_URL not set. Cannot run tests.")

# Test data
TEST_USER_EMAIL = f"test_{uuid.uuid4().hex[:8]}@medscribe.test"
TEST_USER_PASSWORD = "testpass123"
TEST_USER_NAME = "Dr. Test User"

@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session

@pytest.fixture(scope="module")
def auth_token(api_client):
    """Register a test user and return auth token"""
    # Register new user
    register_payload = {
        "name": TEST_USER_NAME,
        "email": TEST_USER_EMAIL,
        "password": TEST_USER_PASSWORD,
        "specialty": "General Medicine",
        "license_number": "TEST123"
    }
    response = api_client.post(f"{BASE_URL}/api/auth/register", json=register_payload)
    assert response.status_code == 200, f"Registration failed: {response.text}"
    data = response.json()
    assert "token" in data
    assert "user" in data
    return data["token"]

@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Return authorization headers"""
    return {"Authorization": f"Bearer {auth_token}"}

class TestHealthCheck:
    """Health check endpoint"""
    
    def test_health_endpoint(self, api_client):
        response = api_client.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "encryption" in data
        assert "compliance" in data

class TestAuthentication:
    """Authentication flow tests"""
    
    def test_register_new_user(self, api_client):
        unique_email = f"newuser_{uuid.uuid4().hex[:8]}@test.com"
        payload = {
            "name": "Dr. New User",
            "email": unique_email,
            "password": "password123",
            "specialty": "Cardiology",
            "license_number": "LIC456"
        }
        response = api_client.post(f"{BASE_URL}/api/auth/register", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["email"] == unique_email
        assert data["user"]["name"] == "Dr. New User"
    
    def test_register_duplicate_email(self, api_client, auth_token):
        # Try to register with same email
        payload = {
            "name": "Duplicate User",
            "email": TEST_USER_EMAIL,
            "password": "pass123"
        }
        response = api_client.post(f"{BASE_URL}/api/auth/register", json=payload)
        assert response.status_code == 400
        assert "already registered" in response.json()["detail"].lower()
    
    def test_login_success(self, api_client):
        payload = {
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        }
        response = api_client.post(f"{BASE_URL}/api/auth/login", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
    
    def test_login_invalid_credentials(self, api_client):
        payload = {
            "email": TEST_USER_EMAIL,
            "password": "wrongpassword"
        }
        response = api_client.post(f"{BASE_URL}/api/auth/login", json=payload)
        assert response.status_code == 401
    
    def test_get_current_user(self, api_client, auth_headers):
        response = api_client.get(f"{BASE_URL}/api/auth/me", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == TEST_USER_EMAIL
        assert data["name"] == TEST_USER_NAME

class TestPatients:
    """Patient CRUD operations"""
    
    def test_create_patient(self, api_client, auth_headers):
        payload = {
            "name": "TEST_John Doe",
            "age": 45,
            "gender": "Male",
            "phone": "555-1234",
            "blood_group": "O+",
            "allergies": ["Penicillin"],
            "medical_history": ["Hypertension"]
        }
        response = api_client.post(f"{BASE_URL}/api/patients", json=payload, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "TEST_John Doe"
        assert data["age"] == 45
        assert data["gender"] == "Male"
        assert "id" in data
        assert data["encrypted"] == True
        
        # Verify persistence with GET
        patient_id = data["id"]
        get_response = api_client.get(f"{BASE_URL}/api/patients/{patient_id}", headers=auth_headers)
        assert get_response.status_code == 200
        get_data = get_response.json()
        assert get_data["name"] == "TEST_John Doe"
    
    def test_get_all_patients(self, api_client, auth_headers):
        response = api_client.get(f"{BASE_URL}/api/patients", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
    
    def test_get_patient_by_id(self, api_client, auth_headers):
        # Create a patient first
        create_payload = {
            "name": "TEST_Jane Smith",
            "age": 32,
            "gender": "Female"
        }
        create_response = api_client.post(f"{BASE_URL}/api/patients", json=create_payload, headers=auth_headers)
        patient_id = create_response.json()["id"]
        
        # Get patient
        response = api_client.get(f"{BASE_URL}/api/patients/{patient_id}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == patient_id
        assert data["name"] == "TEST_Jane Smith"
    
    def test_update_patient(self, api_client, auth_headers):
        # Create patient
        create_payload = {"name": "TEST_Update Test", "age": 40, "gender": "Male"}
        create_response = api_client.post(f"{BASE_URL}/api/patients", json=create_payload, headers=auth_headers)
        patient_id = create_response.json()["id"]
        
        # Update patient
        update_payload = {"age": 41, "blood_group": "A+"}
        update_response = api_client.put(f"{BASE_URL}/api/patients/{patient_id}", json=update_payload, headers=auth_headers)
        assert update_response.status_code == 200
        
        # Verify update persisted
        get_response = api_client.get(f"{BASE_URL}/api/patients/{patient_id}", headers=auth_headers)
        data = get_response.json()
        assert data["age"] == 41
        assert data["blood_group"] == "A+"
    
    def test_delete_patient(self, api_client, auth_headers):
        # Create patient
        create_payload = {"name": "TEST_Delete Test", "age": 50, "gender": "Female"}
        create_response = api_client.post(f"{BASE_URL}/api/patients", json=create_payload, headers=auth_headers)
        patient_id = create_response.json()["id"]
        
        # Delete patient
        delete_response = api_client.delete(f"{BASE_URL}/api/patients/{patient_id}", headers=auth_headers)
        assert delete_response.status_code == 200
        
        # Verify deletion
        get_response = api_client.get(f"{BASE_URL}/api/patients/{patient_id}", headers=auth_headers)
        assert get_response.status_code == 404

class TestConsultations:
    """Consultation CRUD operations"""
    
    @pytest.fixture
    def test_patient_id(self, api_client, auth_headers):
        """Create a test patient for consultations"""
        payload = {"name": "TEST_Consult Patient", "age": 35, "gender": "Male"}
        response = api_client.post(f"{BASE_URL}/api/patients", json=payload, headers=auth_headers)
        return response.json()["id"]
    
    def test_create_consultation(self, api_client, auth_headers, test_patient_id):
        payload = {
            "patient_id": test_patient_id,
            "chief_complaint": "Headache",
            "notes": "Patient reports severe headache"
        }
        response = api_client.post(f"{BASE_URL}/api/consultations", json=payload, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["patient_id"] == test_patient_id
        assert data["chief_complaint"] == "Headache"
        assert "id" in data
        assert data["encrypted"] == True
        
        # Verify persistence
        consult_id = data["id"]
        get_response = api_client.get(f"{BASE_URL}/api/consultations/{consult_id}", headers=auth_headers)
        assert get_response.status_code == 200
    
    def test_get_all_consultations(self, api_client, auth_headers):
        response = api_client.get(f"{BASE_URL}/api/consultations", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_update_consultation(self, api_client, auth_headers, test_patient_id):
        # Create consultation
        create_payload = {"patient_id": test_patient_id, "chief_complaint": "Cough"}
        create_response = api_client.post(f"{BASE_URL}/api/consultations", json=create_payload, headers=auth_headers)
        consult_id = create_response.json()["id"]
        
        # Update consultation
        update_payload = {
            "transcript": "Patient has persistent cough",
            "status": "completed"
        }
        update_response = api_client.put(f"{BASE_URL}/api/consultations/{consult_id}", json=update_payload, headers=auth_headers)
        assert update_response.status_code == 200
        
        # Verify update
        get_response = api_client.get(f"{BASE_URL}/api/consultations/{consult_id}", headers=auth_headers)
        data = get_response.json()
        assert data["transcript"] == "Patient has persistent cough"
        assert data["status"] == "completed"

class TestSimulatedAI:
    """Simulated on-device AI endpoints (MOCKED)"""
    
    def test_transcribe_endpoint(self, api_client, auth_headers):
        response = api_client.post(f"{BASE_URL}/api/ai/transcribe", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "transcript" in data
        assert "model" in data
        assert "device_inference" in data
        assert data["device_inference"] == True
        assert "whisper" in data["model"].lower()
    
    def test_extract_medical_data(self, api_client, auth_headers):
        response = api_client.post(f"{BASE_URL}/api/ai/extract-medical-data", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "extracted_data" in data
        assert "model" in data
        assert "device_inference" in data
        assert data["device_inference"] == True
        
        # Verify extracted data structure
        extracted = data["extracted_data"]
        assert "symptoms" in extracted
        assert "assessment" in extracted
        assert isinstance(extracted["symptoms"], list)

class TestPrescriptions:
    """Prescription CRUD operations"""
    
    @pytest.fixture
    def test_consultation_data(self, api_client, auth_headers):
        """Create patient and consultation for prescription tests"""
        # Create patient
        patient_payload = {"name": "TEST_Rx Patient", "age": 40, "gender": "Female"}
        patient_response = api_client.post(f"{BASE_URL}/api/patients", json=patient_payload, headers=auth_headers)
        patient_id = patient_response.json()["id"]
        
        # Create consultation
        consult_payload = {"patient_id": patient_id, "chief_complaint": "Fever"}
        consult_response = api_client.post(f"{BASE_URL}/api/consultations", json=consult_payload, headers=auth_headers)
        consult_id = consult_response.json()["id"]
        
        return {"patient_id": patient_id, "consultation_id": consult_id}
    
    def test_create_prescription(self, api_client, auth_headers, test_consultation_data):
        payload = {
            "patient_id": test_consultation_data["patient_id"],
            "consultation_id": test_consultation_data["consultation_id"],
            "diagnosis": "Viral Fever",
            "medications": [
                {"name": "Paracetamol", "dosage": "500mg", "frequency": "TID", "duration": "5 days"}
            ],
            "instructions": "Take with food",
            "follow_up_date": "1 week"
        }
        response = api_client.post(f"{BASE_URL}/api/prescriptions", json=payload, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["diagnosis"] == "Viral Fever"
        assert len(data["medications"]) == 1
        assert "id" in data
        assert data["encrypted"] == True
        
        # Verify persistence
        rx_id = data["id"]
        get_response = api_client.get(f"{BASE_URL}/api/prescriptions/{rx_id}", headers=auth_headers)
        assert get_response.status_code == 200
    
    def test_get_all_prescriptions(self, api_client, auth_headers):
        response = api_client.get(f"{BASE_URL}/api/prescriptions", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_prescription_pdf(self, api_client, auth_headers, test_consultation_data):
        # Create prescription first
        create_payload = {
            "patient_id": test_consultation_data["patient_id"],
            "consultation_id": test_consultation_data["consultation_id"],
            "diagnosis": "Test Diagnosis",
            "medications": [{"name": "Test Med", "dosage": "100mg", "frequency": "BID", "duration": "7 days"}],
            "instructions": "Test instructions"
        }
        create_response = api_client.post(f"{BASE_URL}/api/prescriptions", json=create_payload, headers=auth_headers)
        rx_id = create_response.json()["id"]
        
        # Get PDF
        response = api_client.get(f"{BASE_URL}/api/prescriptions/{rx_id}/pdf", headers=auth_headers)
        assert response.status_code == 200
        assert response.headers["Content-Type"] == "application/pdf"

class TestMedications:
    """Medication explainability engine"""
    
    def test_search_medications_all(self, api_client, auth_headers):
        response = api_client.get(f"{BASE_URL}/api/medications/search", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
    
    def test_search_medications_query(self, api_client, auth_headers):
        response = api_client.get(f"{BASE_URL}/api/medications/search?q=ibu", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        assert any("ibuprofen" in med["name"].lower() for med in data)
    
    def test_explain_medication_ibuprofen(self, api_client, auth_headers):
        response = api_client.get(f"{BASE_URL}/api/medications/ibuprofen/explain", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Ibuprofen"
        assert "mechanism" in data
        assert "side_effects" in data
        assert "contraindications" in data
        assert "interactions" in data
        assert isinstance(data["side_effects"], list)
    
    def test_explain_medication_metformin(self, api_client, auth_headers):
        response = api_client.get(f"{BASE_URL}/api/medications/metformin/explain", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Metformin"
        assert "Biguanide" in data["class"]
    
    def test_explain_medication_not_found(self, api_client, auth_headers):
        response = api_client.get(f"{BASE_URL}/api/medications/nonexistentdrug/explain", headers=auth_headers)
        assert response.status_code == 404

class TestDashboard:
    """Dashboard stats endpoint"""
    
    def test_dashboard_stats(self, api_client, auth_headers):
        response = api_client.get(f"{BASE_URL}/api/dashboard/stats", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "patient_count" in data
        assert "consultation_count" in data
        assert "prescription_count" in data
        assert "recent_consultations" in data
        assert "encryption_status" in data
        assert "compliance" in data
        assert "device_models_loaded" in data
        assert isinstance(data["patient_count"], int)
        assert isinstance(data["recent_consultations"], list)
