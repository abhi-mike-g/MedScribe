#!/usr/bin/env python3
"""
MedScribe Backend Regression Test Suite - Post Modular Refactoring
Tests ALL endpoints to ensure modular architecture works identically to monolithic version.
"""
import requests
import json
import tempfile
import base64
import os
from pathlib import Path
import time
import uuid

# Backend URL from frontend/.env
BACKEND_URL = "https://e2ee-transfer.preview.emergentagent.com/api"

class MedScribeRegressionTest:
    def __init__(self):
        self.doctor_token = None
        self.patient_token = None
        self.admin_token = None
        self.doctor_user = None
        self.patient_user = None
        self.admin_user = None
        self.case_id = None
        self.prescription_id = None
        self.attachment_id = None
        self.report_id = None
        self.session = requests.Session()
        self.test_results = {}
        
    def log(self, message):
        print(f"[REGRESSION] {message}")
        
    def run_test(self, test_name, test_func):
        """Run a single test and track results"""
        self.log(f"Testing: {test_name}")
        try:
            result = test_func()
            self.test_results[test_name] = result
            status = "✅ PASSED" if result else "❌ FAILED"
            self.log(f"{status}: {test_name}")
            return result
        except Exception as e:
            self.log(f"❌ FAILED: {test_name} - Exception: {str(e)}")
            self.test_results[test_name] = False
            return False

    # ============== HEALTH CHECK ==============
    def test_health_check_modular(self):
        """Test 1: Health check should return architecture: modular"""
        response = self.session.get(f"{BACKEND_URL}/health")
        
        if response.status_code != 200:
            self.log(f"Health check failed: {response.status_code}")
            return False
            
        data = response.json()
        
        if data.get("architecture") != "modular":
            self.log(f"Expected architecture=modular, got {data.get('architecture')}")
            return False
            
        required_fields = ["status", "encryption", "compliance", "roles"]
        for field in required_fields:
            if field not in data:
                self.log(f"Missing field '{field}' in health response")
                return False
                
        return True

    # ============== AUTH ROUTES ==============
    def test_auth_register_doctor(self):
        """Test 2: POST /api/auth/register/doctor"""
        unique_id = str(int(time.time()))
        
        doctor_data = {
            "name": "Dr. Emily Rodriguez",
            "email": f"doctor{unique_id}@medscribe.test",
            "password": "securepass123",
            "specialty": "Cardiology",
            "license_number": f"MED{unique_id[-6:]}"
        }
        
        response = self.session.post(f"{BACKEND_URL}/auth/register/doctor", json=doctor_data)
        
        if response.status_code != 200:
            self.log(f"Doctor registration failed: {response.status_code} - {response.text}")
            return False
            
        data = response.json()
        
        if "token" not in data or "user" not in data:
            self.log("Missing token or user in doctor registration response")
            return False
            
        self.doctor_token = data["token"]
        self.doctor_user = data["user"]
        
        if data["user"]["role"] != "doctor":
            self.log(f"Expected role=doctor, got {data['user']['role']}")
            return False
            
        if "license_number" not in data["user"]:
            self.log("Missing license_number in doctor user")
            return False
            
        return True

    def test_auth_register_patient(self):
        """Test 3: POST /api/auth/register/patient"""
        unique_id = str(int(time.time()))
        
        patient_data = {
            "name": "Maria Garcia",
            "email": f"patient{unique_id}@medscribe.test",
            "password": "patientpass123",
            "age": 28,
            "gender": "Female",
            "phone": "555-0198",
            "blood_group": "A+"
        }
        
        response = self.session.post(f"{BACKEND_URL}/auth/register/patient", json=patient_data)
        
        if response.status_code != 200:
            self.log(f"Patient registration failed: {response.status_code} - {response.text}")
            return False
            
        data = response.json()
        
        if "token" not in data or "user" not in data:
            self.log("Missing token or user in patient registration response")
            return False
            
        self.patient_token = data["token"]
        self.patient_user = data["user"]
        
        if data["user"]["role"] != "patient":
            self.log(f"Expected role=patient, got {data['user']['role']}")
            return False
            
        if "patient_id" not in data["user"]:
            self.log("Missing patient_id in patient user")
            return False
            
        return True

    def test_auth_register_admin(self):
        """Test 4: POST /api/auth/register/admin"""
        unique_id = str(int(time.time()))
        
        admin_data = {
            "name": "Admin Johnson",
            "email": f"admin{unique_id}@medscribe.test",
            "password": "adminpass123",
            "department": "IT Administration"
        }
        
        response = self.session.post(f"{BACKEND_URL}/auth/register/admin", json=admin_data)
        
        if response.status_code != 200:
            self.log(f"Admin registration failed: {response.status_code} - {response.text}")
            return False
            
        data = response.json()
        
        if "token" not in data or "user" not in data:
            self.log("Missing token or user in admin registration response")
            return False
            
        self.admin_token = data["token"]
        self.admin_user = data["user"]
        
        if data["user"]["role"] != "admin":
            self.log(f"Expected role=admin, got {data['user']['role']}")
            return False
            
        return True

    def test_auth_login_doctor(self):
        """Test 5: POST /api/auth/login (doctor)"""
        if not self.doctor_user:
            self.log("No doctor user available for login test")
            return False
            
        login_data = {
            "email": self.doctor_user["email"],
            "password": "securepass123",
            "role": "doctor"
        }
        
        response = self.session.post(f"{BACKEND_URL}/auth/login", json=login_data)
        
        if response.status_code != 200:
            self.log(f"Doctor login failed: {response.status_code} - {response.text}")
            return False
            
        data = response.json()
        
        if "token" not in data or "user" not in data:
            self.log("Missing token or user in doctor login response")
            return False
            
        if data["user"]["role"] != "doctor":
            self.log(f"Expected role=doctor, got {data['user']['role']}")
            return False
            
        return True

    def test_auth_login_patient(self):
        """Test 6: POST /api/auth/login (patient)"""
        if not self.patient_user:
            self.log("No patient user available for login test")
            return False
            
        login_data = {
            "email": self.patient_user["email"],
            "password": "patientpass123",
            "role": "patient"
        }
        
        response = self.session.post(f"{BACKEND_URL}/auth/login", json=login_data)
        
        if response.status_code != 200:
            self.log(f"Patient login failed: {response.status_code} - {response.text}")
            return False
            
        data = response.json()
        
        if "token" not in data or "user" not in data:
            self.log("Missing token or user in patient login response")
            return False
            
        if data["user"]["role"] != "patient":
            self.log(f"Expected role=patient, got {data['user']['role']}")
            return False
            
        return True

    def test_auth_me(self):
        """Test 7: GET /api/auth/me"""
        if not self.doctor_token:
            self.log("No doctor token available for auth/me test")
            return False
            
        headers = {'Authorization': f'Bearer {self.doctor_token}'}
        response = self.session.get(f"{BACKEND_URL}/auth/me", headers=headers)
        
        if response.status_code != 200:
            self.log(f"Auth/me failed: {response.status_code} - {response.text}")
            return False
            
        data = response.json()
        
        if data["email"] != self.doctor_user["email"]:
            self.log(f"Email mismatch in auth/me")
            return False
            
        return True

    # ============== CASE ROUTES ==============
    def test_cases_submit(self):
        """Test 8: POST /api/cases/submit"""
        if not self.patient_token:
            self.log("No patient token available for case submission")
            return False
            
        case_data = {
            "transcript": "I've been experiencing chest pain and shortness of breath for the past two days. The pain is sharp and occurs mainly when I take deep breaths. I also feel dizzy sometimes.",
            "chief_complaint": "Chest pain and shortness of breath"
        }
        
        headers = {
            'Authorization': f'Bearer {self.patient_token}',
            'Content-Type': 'application/json'
        }
        
        response = self.session.post(f"{BACKEND_URL}/cases/submit", json=case_data, headers=headers)
        
        if response.status_code != 200:
            self.log(f"Case submission failed: {response.status_code} - {response.text}")
            return False
            
        data = response.json()
        
        if "id" not in data:
            self.log("Missing case id in response")
            return False
            
        self.case_id = data["id"]
        
        if data.get("status") != "pending":
            self.log(f"Expected status=pending, got {data.get('status')}")
            return False
            
        return True

    def test_cases_my(self):
        """Test 9: GET /api/cases/my"""
        if not self.patient_token:
            self.log("No patient token available for my cases test")
            return False
            
        headers = {'Authorization': f'Bearer {self.patient_token}'}
        response = self.session.get(f"{BACKEND_URL}/cases/my", headers=headers)
        
        if response.status_code != 200:
            self.log(f"Get my cases failed: {response.status_code} - {response.text}")
            return False
            
        data = response.json()
        
        if not isinstance(data, list):
            self.log(f"Expected list response, got {type(data)}")
            return False
            
        if len(data) == 0:
            self.log("Expected at least 1 case, got 0")
            return False
            
        return True

    def test_cases_get_specific(self):
        """Test 10: GET /api/cases/{case_id}"""
        if not self.patient_token or not self.case_id:
            self.log("No patient token or case_id available")
            return False
            
        headers = {'Authorization': f'Bearer {self.patient_token}'}
        response = self.session.get(f"{BACKEND_URL}/cases/{self.case_id}", headers=headers)
        
        if response.status_code != 200:
            self.log(f"Get specific case failed: {response.status_code} - {response.text}")
            return False
            
        data = response.json()
        
        if data["id"] != self.case_id:
            self.log(f"Case ID mismatch")
            return False
            
        return True

    # ============== DOCTOR ROUTES ==============
    def test_doctor_pending_cases(self):
        """Test 11: GET /api/doctor/pending-cases"""
        if not self.doctor_token:
            self.log("No doctor token available")
            return False
            
        headers = {'Authorization': f'Bearer {self.doctor_token}'}
        response = self.session.get(f"{BACKEND_URL}/doctor/pending-cases", headers=headers)
        
        if response.status_code != 200:
            self.log(f"Get pending cases failed: {response.status_code} - {response.text}")
            return False
            
        data = response.json()
        
        if not isinstance(data, list):
            self.log(f"Expected list response, got {type(data)}")
            return False
            
        return True

    def test_doctor_lookup_patient(self):
        """Test 12: GET /api/doctor/lookup/{patient_id}"""
        if not self.doctor_token or not self.patient_user:
            self.log("No doctor token or patient user available")
            return False
            
        patient_id = self.patient_user["patient_id"]
        headers = {'Authorization': f'Bearer {self.doctor_token}'}
        response = self.session.get(f"{BACKEND_URL}/doctor/lookup/{patient_id}", headers=headers)
        
        if response.status_code != 200:
            self.log(f"Patient lookup failed: {response.status_code} - {response.text}")
            return False
            
        data = response.json()
        
        if "patient" not in data:
            self.log("Missing patient in lookup response")
            return False
            
        return True

    def test_doctor_respond_to_case(self):
        """Test 13: PUT /api/cases/{case_id}/respond"""
        if not self.doctor_token or not self.case_id:
            self.log("No doctor token or case_id available")
            return False
            
        response_data = {
            "response_type": "prescription",
            "message": "Based on your symptoms, I'm prescribing medication for chest pain relief.",
            "medications": [
                {
                    "name": "Ibuprofen",
                    "dosage": "400mg",
                    "frequency": "Every 8 hours",
                    "duration": "5 days",
                    "instructions": "Take with food"
                }
            ],
            "diagnosis": "Musculoskeletal chest pain",
            "follow_up_required": True
        }
        
        headers = {
            'Authorization': f'Bearer {self.doctor_token}',
            'Content-Type': 'application/json'
        }
        
        response = self.session.put(f"{BACKEND_URL}/cases/{self.case_id}/respond", 
                                  json=response_data, headers=headers)
        
        if response.status_code != 200:
            self.log(f"Case response failed: {response.status_code} - {response.text}")
            return False
            
        data = response.json()
        
        if data.get("status") != "responded":
            self.log(f"Expected status=responded, got {data.get('status')}")
            return False
            
        return True

    def test_doctor_consultation_create(self):
        """Test 14: POST /api/doctor/consultation"""
        if not self.doctor_token or not self.patient_user:
            self.log("No doctor token or patient user available")
            return False
            
        consultation_data = {
            "transcript": "Patient follow-up consultation transcript. Patient reports feeling better after treatment.",
            "patient_id": self.patient_user["patient_id"],
            "chief_complaint": "Follow-up consultation",
            "doctor_notes": "Patient responding well to treatment",
            "consultation_type": "follow-up"
        }
        
        headers = {
            'Authorization': f'Bearer {self.doctor_token}',
            'Content-Type': 'application/json'
        }
        
        response = self.session.post(f"{BACKEND_URL}/doctor/consultation", 
                                   json=consultation_data, headers=headers)
        
        if response.status_code != 200:
            self.log(f"Consultation creation failed: {response.status_code} - {response.text}")
            return False
            
        data = response.json()
        
        if "id" not in data:
            self.log("Missing consultation id in response")
            return False
            
        return True

    def test_doctor_consultations_list(self):
        """Test 15: GET /api/doctor/consultations"""
        if not self.doctor_token:
            self.log("No doctor token available")
            return False
            
        headers = {'Authorization': f'Bearer {self.doctor_token}'}
        response = self.session.get(f"{BACKEND_URL}/doctor/consultations", headers=headers)
        
        if response.status_code != 200:
            self.log(f"Get consultations failed: {response.status_code} - {response.text}")
            return False
            
        data = response.json()
        
        if not isinstance(data, list):
            self.log(f"Expected list response, got {type(data)}")
            return False
            
        return True

    # ============== PRESCRIPTION ROUTES ==============
    def test_prescriptions_create(self):
        """Test 16: POST /api/prescriptions/create"""
        if not self.doctor_token or not self.patient_user:
            self.log("No doctor token or patient user available")
            return False
            
        prescription_data = {
            "patient_id": self.patient_user["patient_id"],
            "diagnosis": "Acute bronchitis",
            "medications": [
                {
                    "name": "Amoxicillin",
                    "dosage": "500mg",
                    "frequency": "Every 8 hours",
                    "duration": "7 days",
                    "instructions": "Take with food"
                }
            ],
            "general_advice": "Rest and drink plenty of fluids",
            "warnings": ["Complete the full course of antibiotics"],
            "follow_up_date": "2024-02-20",
            "valid_days": 30
        }
        
        headers = {
            'Authorization': f'Bearer {self.doctor_token}',
            'Content-Type': 'application/json'
        }
        
        response = self.session.post(f"{BACKEND_URL}/prescriptions/create", 
                                   json=prescription_data, headers=headers)
        
        if response.status_code != 200:
            self.log(f"Prescription creation failed: {response.status_code} - {response.text}")
            return False
            
        data = response.json()
        
        if "id" not in data:
            self.log("Missing prescription id in response")
            return False
            
        self.prescription_id = data["id"]
        
        if data.get("status") != "sent":
            self.log(f"Expected status=sent, got {data.get('status')}")
            return False
            
        return True

    def test_prescriptions_verify(self):
        """Test 17: GET /api/prescriptions/verify/{rx_id}"""
        if not self.prescription_id:
            self.log("No prescription_id available")
            return False
            
        # This is a public endpoint, no auth required
        response = self.session.get(f"{BACKEND_URL}/prescriptions/verify/{self.prescription_id}")
        
        if response.status_code != 200:
            self.log(f"Prescription verification failed: {response.status_code} - {response.text}")
            return False
            
        data = response.json()
        
        if "valid" not in data:
            self.log("Missing valid field in verification response")
            return False
            
        if not data["valid"]:
            self.log("Prescription verification returned invalid")
            return False
            
        return True

    def test_prescriptions_list(self):
        """Test 18: GET /api/prescriptions"""
        if not self.patient_token:
            self.log("No patient token available")
            return False
            
        headers = {'Authorization': f'Bearer {self.patient_token}'}
        response = self.session.get(f"{BACKEND_URL}/prescriptions", headers=headers)
        
        if response.status_code != 200:
            self.log(f"Get prescriptions failed: {response.status_code} - {response.text}")
            return False
            
        data = response.json()
        
        if not isinstance(data, list):
            self.log(f"Expected list response, got {type(data)}")
            return False
            
        return True

    def test_prescriptions_get_specific(self):
        """Test 19: GET /api/prescriptions/{rx_id}"""
        if not self.patient_token or not self.prescription_id:
            self.log("No patient token or prescription_id available")
            return False
            
        headers = {'Authorization': f'Bearer {self.patient_token}'}
        response = self.session.get(f"{BACKEND_URL}/prescriptions/{self.prescription_id}", headers=headers)
        
        if response.status_code != 200:
            self.log(f"Get specific prescription failed: {response.status_code} - {response.text}")
            return False
            
        data = response.json()
        
        if data["id"] != self.prescription_id:
            self.log(f"Prescription ID mismatch")
            return False
            
        return True

    def test_prescriptions_pdf(self):
        """Test 20: GET /api/prescriptions/{rx_id}/pdf"""
        if not self.doctor_token or not self.prescription_id:
            self.log("No doctor token or prescription_id available")
            return False
            
        headers = {'Authorization': f'Bearer {self.doctor_token}'}
        response = self.session.get(f"{BACKEND_URL}/prescriptions/{self.prescription_id}/pdf", headers=headers)
        
        if response.status_code != 200:
            self.log(f"Prescription PDF failed: {response.status_code} - {response.text}")
            return False
            
        if not response.headers.get("Content-Type", "").startswith("application/pdf"):
            self.log(f"Expected PDF content-type, got {response.headers.get('Content-Type')}")
            return False
            
        if len(response.content) == 0:
            self.log("Empty PDF content")
            return False
            
        return True

    # ============== MEDICATION ROUTES ==============
    def test_medications_search(self):
        """Test 21: GET /api/medications/search?q= (requires auth)"""
        if not self.patient_token:
            self.log("No patient token available for medication search")
            return False
            
        headers = {'Authorization': f'Bearer {self.patient_token}'}
        response = self.session.get(f"{BACKEND_URL}/medications/search?q=ibuprofen", headers=headers)
        
        if response.status_code != 200:
            self.log(f"Medication search failed: {response.status_code} - {response.text}")
            return False
            
        data = response.json()
        
        if not isinstance(data, list):
            self.log(f"Expected list response, got {type(data)}")
            return False
            
        if len(data) == 0:
            self.log("Expected at least 1 medication, got 0")
            return False
            
        return True

    def test_medications_explain(self):
        """Test 22: GET /api/medications/{med_name}/explain (requires auth)"""
        if not self.patient_token:
            self.log("No patient token available for medication explain")
            return False
            
        headers = {'Authorization': f'Bearer {self.patient_token}'}
        response = self.session.get(f"{BACKEND_URL}/medications/ibuprofen/explain", headers=headers)
        
        if response.status_code != 200:
            self.log(f"Medication explain failed: {response.status_code} - {response.text}")
            return False
            
        data = response.json()
        
        required_fields = ["name", "mechanism", "side_effects", "contraindications"]
        for field in required_fields:
            if field not in data:
                self.log(f"Missing field '{field}' in medication explanation")
                return False
                
        return True

    # ============== AUDIO ROUTES ==============
    def test_audio_languages(self):
        """Test 23: GET /api/languages"""
        response = self.session.get(f"{BACKEND_URL}/languages")
        
        if response.status_code != 200:
            self.log(f"Languages endpoint failed: {response.status_code} - {response.text}")
            return False
            
        data = response.json()
        
        if not isinstance(data, dict):
            self.log(f"Expected dict response, got {type(data)}")
            return False
            
        if "languages" not in data:
            self.log("Missing 'languages' key in response")
            return False
            
        if not isinstance(data["languages"], list):
            self.log(f"Expected languages to be list, got {type(data['languages'])}")
            return False
            
        if len(data["languages"]) == 0:
            self.log("Expected at least 1 language, got 0")
            return False
            
        return True

    def test_audio_extract_from_text(self):
        """Test 24: POST /api/audio/extract-from-text (requires auth)"""
        if not self.patient_token:
            self.log("No patient token available for text extraction")
            return False
            
        extract_data = {
            "transcript": "Patient reports severe headache lasting 3 days, nausea, and sensitivity to light. No fever. Pain is throbbing and located on the right side.",
            "language": "en"
        }
        
        headers = {
            'Authorization': f'Bearer {self.patient_token}',
            'Content-Type': 'application/json'
        }
        response = self.session.post(f"{BACKEND_URL}/audio/extract-from-text", 
                                   json=extract_data, headers=headers)
        
        if response.status_code != 200:
            self.log(f"Text extraction failed: {response.status_code} - {response.text}")
            return False
            
        data = response.json()
        
        if "extraction" not in data:
            self.log("Missing 'extraction' key in response")
            return False
            
        return True

    # ============== E2EE ROUTES ==============
    def test_e2ee_register_public_key(self):
        """Test 25: POST /api/e2ee/register-public-key"""
        if not self.doctor_token:
            self.log("No doctor token available")
            return False
            
        # Generate a proper RSA public key (this is a real test key)
        test_public_key = """-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA4f5wg5l2hKsTeNem/V41
fGnJm6gOdrj8ym3rFkEjWT2btf02uBMq6yAn9MsO8tGy6ZdwZBnuVxVtVi5cjbqq
0xELjji5DQBJjIrMjMpb7TgxeNjIjBpFVCsjAK4QDRQicCawBBICDyjA2StNLxbI
AqkgB5qTnE2mqRdHyFqD5+adYmYeCycrczGlBHu2Je5cCZ6NlMhb+57mmtRr8FB6
wux4f8sVBPVajMnpj4ihiCYooG6gjUwQfWFitnXdx5lttiawjhQJjEe8nTCeHcHp
+gRzDxk1Ajl1dzBn7p34JRuEMHxhKrVesXFSAsP9yaJMuWz6aznvCjkxs4s8i7QI
DQIDAQAB
-----END PUBLIC KEY-----"""
        
        key_data = {
            "public_key": test_public_key
        }
        
        headers = {
            'Authorization': f'Bearer {self.doctor_token}',
            'Content-Type': 'application/json'
        }
        
        response = self.session.post(f"{BACKEND_URL}/e2ee/register-public-key", 
                                   json=key_data, headers=headers)
        
        if response.status_code != 200:
            self.log(f"E2EE key registration failed: {response.status_code} - {response.text}")
            return False
            
        data = response.json()
        
        if "message" not in data:
            self.log("Missing message in E2EE key registration response")
            return False
            
        return True

    def test_e2ee_exchange_key(self):
        """Test 26: POST /api/e2ee/exchange-key"""
        if not self.doctor_token or not self.patient_user:
            self.log("No doctor token or patient user available")
            return False
            
        # Test encrypted AES key exchange with context_id
        exchange_data = {
            "recipient_id": self.patient_user["id"],
            "encrypted_aes_key": "encrypted_test_aes_key_base64_encoded",
            "context_id": "test_context_123"
        }
        
        headers = {
            'Authorization': f'Bearer {self.doctor_token}',
            'Content-Type': 'application/json'
        }
        
        response = self.session.post(f"{BACKEND_URL}/e2ee/exchange-key", 
                                   json=exchange_data, headers=headers)
        
        if response.status_code != 200:
            self.log(f"E2EE key exchange failed: {response.status_code} - {response.text}")
            return False
            
        data = response.json()
        
        if "exchange_id" not in data:
            self.log("Missing exchange_id in E2EE key exchange response")
            return False
            
        return True

    def test_e2ee_keys_for_me(self):
        """Test 27: GET /api/e2ee/keys-for-me"""
        if not self.patient_token:
            self.log("No patient token available")
            return False
            
        headers = {'Authorization': f'Bearer {self.patient_token}'}
        response = self.session.get(f"{BACKEND_URL}/e2ee/keys-for-me", headers=headers)
        
        if response.status_code != 200:
            self.log(f"E2EE keys retrieval failed: {response.status_code} - {response.text}")
            return False
            
        data = response.json()
        
        if not isinstance(data, list):
            self.log(f"Expected list response, got {type(data)}")
            return False
            
        return True

    # ============== ATTACHMENT ROUTES ==============
    def create_test_encrypted_file(self):
        """Create a test encrypted file for upload"""
        test_content = b"Test medical document content for regression testing."
        iv = os.urandom(12)
        iv_b64 = base64.b64encode(iv).decode()
        
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.enc')
        temp_file.write(test_content)
        temp_file.close()
        
        return temp_file.name, iv_b64

    def test_attachments_upload(self):
        """Test 28: POST /api/attachments/upload"""
        if not self.patient_token or not self.case_id:
            self.log("No patient token or case_id available")
            return False
            
        file_path, iv = self.create_test_encrypted_file()
        
        try:
            headers = {'Authorization': f'Bearer {self.patient_token}'}
            
            with open(file_path, 'rb') as f:
                files = {
                    'encrypted_data': ('test_medical_report.pdf', f, 'application/octet-stream')
                }
                data = {
                    'case_id': self.case_id,
                    'file_name': 'test_medical_report.pdf',
                    'file_type': 'application/pdf',
                    'iv': iv,
                    'sender_id': self.patient_user['id']
                }
                
                response = self.session.post(f"{BACKEND_URL}/attachments/upload", 
                                           files=files, data=data, headers=headers)
                
            if response.status_code != 200:
                self.log(f"Attachment upload failed: {response.status_code} - {response.text}")
                return False
                
            result = response.json()
            
            if "id" not in result:
                self.log("Missing attachment id in response")
                return False
                
            self.attachment_id = result["id"]
            
            if result.get("encrypted") != True:
                self.log("Expected encrypted=True")
                return False
                
            return True
            
        finally:
            Path(file_path).unlink(missing_ok=True)

    def test_attachments_case_list(self):
        """Test 29: GET /api/attachments/case/{case_id}"""
        if not self.patient_token or not self.case_id:
            self.log("No patient token or case_id available")
            return False
            
        headers = {'Authorization': f'Bearer {self.patient_token}'}
        response = self.session.get(f"{BACKEND_URL}/attachments/case/{self.case_id}", headers=headers)
        
        if response.status_code != 200:
            self.log(f"Get case attachments failed: {response.status_code} - {response.text}")
            return False
            
        data = response.json()
        
        if not isinstance(data, list):
            self.log(f"Expected list response, got {type(data)}")
            return False
            
        return True

    def test_attachments_download(self):
        """Test 30: GET /api/attachments/{id}/download"""
        if not self.patient_token or not self.attachment_id:
            self.log("No patient token or attachment_id available")
            return False
            
        headers = {'Authorization': f'Bearer {self.patient_token}'}
        response = self.session.get(f"{BACKEND_URL}/attachments/{self.attachment_id}/download", headers=headers)
        
        if response.status_code != 200:
            self.log(f"Attachment download failed: {response.status_code} - {response.text}")
            return False
            
        if response.headers.get("Content-Type") != "application/octet-stream":
            self.log(f"Expected application/octet-stream, got {response.headers.get('Content-Type')}")
            return False
            
        return True

    def test_attachments_get_specific(self):
        """Test 31: GET /api/attachments/{id}"""
        if not self.patient_token or not self.attachment_id:
            self.log("No patient token or attachment_id available")
            return False
            
        headers = {'Authorization': f'Bearer {self.patient_token}'}
        response = self.session.get(f"{BACKEND_URL}/attachments/{self.attachment_id}", headers=headers)
        
        if response.status_code != 200:
            self.log(f"Get specific attachment failed: {response.status_code} - {response.text}")
            return False
            
        data = response.json()
        
        if data["id"] != self.attachment_id:
            self.log(f"Attachment ID mismatch")
            return False
            
        return True

    # ============== REPORT ROUTES ==============
    def test_reports_generate(self):
        """Test 32: POST /api/reports/generate"""
        if not self.doctor_token or not self.case_id:
            self.log("No doctor token or case_id available")
            return False
            
        report_data = {
            "source_type": "case",
            "source_id": self.case_id,
            "patient_name": self.patient_user["name"],
            "patient_age": str(self.patient_user["age"]),
            "patient_gender": self.patient_user["gender"],
            "patient_id_display": self.patient_user["patient_id"],
            "encounter_date": "2024-01-15",
            "encounter_type": "Outpatient Consultation",
            "chief_complaint": "Chest pain and shortness of breath",
            "hpi": "Patient reports chest pain and shortness of breath for the past two days",
            "physical_examination": "Vital signs stable, no acute distress",
            "primary_diagnosis": "Likely musculoskeletal chest pain",
            "general_advice": "Prescribed anti-inflammatory medication, follow-up in 1 week"
        }
        
        headers = {
            'Authorization': f'Bearer {self.doctor_token}',
            'Content-Type': 'application/json'
        }
        
        response = self.session.post(f"{BACKEND_URL}/reports/generate", 
                                   json=report_data, headers=headers)
        
        if response.status_code != 200:
            self.log(f"Report generation failed: {response.status_code} - {response.text}")
            return False
            
        data = response.json()
        
        if "id" not in data:
            self.log("Missing report id in response")
            return False
            
        self.report_id = data["id"]
        
        return True

    def test_reports_my_list(self):
        """Test 33: GET /api/reports/my/list"""
        if not self.doctor_token:
            self.log("No doctor token available")
            return False
            
        headers = {'Authorization': f'Bearer {self.doctor_token}'}
        response = self.session.get(f"{BACKEND_URL}/reports/my/list", headers=headers)
        
        if response.status_code != 200:
            self.log(f"Get my reports failed: {response.status_code} - {response.text}")
            return False
            
        data = response.json()
        
        if not isinstance(data, list):
            self.log(f"Expected list response, got {type(data)}")
            return False
            
        return True

    def test_reports_get_specific(self):
        """Test 34: GET /api/reports/{report_id}"""
        if not self.doctor_token or not self.report_id:
            self.log("No doctor token or report_id available")
            return False
            
        headers = {'Authorization': f'Bearer {self.doctor_token}'}
        response = self.session.get(f"{BACKEND_URL}/reports/{self.report_id}", headers=headers)
        
        if response.status_code != 200:
            self.log(f"Get specific report failed: {response.status_code} - {response.text}")
            return False
            
        data = response.json()
        
        if data["id"] != self.report_id:
            self.log(f"Report ID mismatch")
            return False
            
        return True

    def test_reports_pdf(self):
        """Test 35: GET /api/reports/{report_id}/pdf"""
        if not self.doctor_token or not self.report_id:
            self.log("No doctor token or report_id available")
            return False
            
        headers = {'Authorization': f'Bearer {self.doctor_token}'}
        response = self.session.get(f"{BACKEND_URL}/reports/{self.report_id}/pdf", headers=headers)
        
        if response.status_code != 200:
            self.log(f"Report PDF failed: {response.status_code} - {response.text}")
            return False
            
        if not response.headers.get("Content-Type", "").startswith("application/pdf"):
            self.log(f"Expected PDF content-type, got {response.headers.get('Content-Type')}")
            return False
            
        return True

    def test_reports_update(self):
        """Test 36: PUT /api/reports/{report_id}"""
        if not self.doctor_token or not self.report_id:
            self.log("No doctor token or report_id available")
            return False
            
        update_data = {
            "assessment": "Updated assessment: Musculoskeletal chest pain with good response to treatment"
        }
        
        headers = {
            'Authorization': f'Bearer {self.doctor_token}',
            'Content-Type': 'application/json'
        }
        
        response = self.session.put(f"{BACKEND_URL}/reports/{self.report_id}", 
                                  json=update_data, headers=headers)
        
        if response.status_code != 200:
            self.log(f"Report update failed: {response.status_code} - {response.text}")
            return False
            
        return True

    def test_reports_send(self):
        """Test 37: POST /api/reports/{report_id}/send"""
        if not self.doctor_token or not self.report_id:
            self.log("No doctor token or report_id available")
            return False
            
        send_data = {
            "recipient_type": "patient"
        }
        
        headers = {
            'Authorization': f'Bearer {self.doctor_token}',
            'Content-Type': 'application/json'
        }
        
        response = self.session.post(f"{BACKEND_URL}/reports/{self.report_id}/send", 
                                   json=send_data, headers=headers)
        
        if response.status_code != 200:
            self.log(f"Report send failed: {response.status_code} - {response.text}")
            return False
            
        return True

    # ============== ADMIN ROUTES ==============
    def test_admin_users(self):
        """Test 38: GET /api/admin/users"""
        if not self.admin_token:
            self.log("No admin token available")
            return False
            
        headers = {'Authorization': f'Bearer {self.admin_token}'}
        response = self.session.get(f"{BACKEND_URL}/admin/users", headers=headers)
        
        if response.status_code != 200:
            self.log(f"Admin users failed: {response.status_code} - {response.text}")
            return False
            
        data = response.json()
        
        if not isinstance(data, list):
            self.log(f"Expected list response, got {type(data)}")
            return False
            
        return True

    def test_admin_stats(self):
        """Test 39: GET /api/admin/stats"""
        if not self.admin_token:
            self.log("No admin token available")
            return False
            
        headers = {'Authorization': f'Bearer {self.admin_token}'}
        response = self.session.get(f"{BACKEND_URL}/admin/stats", headers=headers)
        
        if response.status_code != 200:
            self.log(f"Admin stats failed: {response.status_code} - {response.text}")
            return False
            
        data = response.json()
        
        required_fields = ["total_users", "total_cases", "total_prescriptions"]
        for field in required_fields:
            if field not in data:
                self.log(f"Missing field '{field}' in admin stats")
                return False
                
        return True

    def test_dashboard_stats(self):
        """Test 40: GET /api/dashboard/stats"""
        if not self.doctor_token:
            self.log("No doctor token available")
            return False
            
        headers = {'Authorization': f'Bearer {self.doctor_token}'}
        response = self.session.get(f"{BACKEND_URL}/dashboard/stats", headers=headers)
        
        if response.status_code != 200:
            self.log(f"Dashboard stats failed: {response.status_code} - {response.text}")
            return False
            
        data = response.json()
        
        # Stats should be role-specific
        if "pending_cases" not in data:
            self.log("Missing pending_cases in doctor dashboard stats")
            return False
            
        return True

    def run_all_tests(self):
        """Run all regression tests"""
        self.log("=== Starting MedScribe Backend Regression Test Suite ===")
        self.log("Testing modular architecture after refactoring...")
        
        tests = [
            # Health Check
            ("Health Check - Modular Architecture", self.test_health_check_modular),
            
            # Auth Routes
            ("Auth - Register Doctor", self.test_auth_register_doctor),
            ("Auth - Register Patient", self.test_auth_register_patient),
            ("Auth - Register Admin", self.test_auth_register_admin),
            ("Auth - Login Doctor", self.test_auth_login_doctor),
            ("Auth - Login Patient", self.test_auth_login_patient),
            ("Auth - Get Current User", self.test_auth_me),
            
            # Case Routes
            ("Cases - Submit Case", self.test_cases_submit),
            ("Cases - Get My Cases", self.test_cases_my),
            ("Cases - Get Specific Case", self.test_cases_get_specific),
            
            # Doctor Routes
            ("Doctor - Get Pending Cases", self.test_doctor_pending_cases),
            ("Doctor - Lookup Patient", self.test_doctor_lookup_patient),
            ("Doctor - Respond to Case", self.test_doctor_respond_to_case),
            ("Doctor - Create Consultation", self.test_doctor_consultation_create),
            ("Doctor - List Consultations", self.test_doctor_consultations_list),
            
            # Prescription Routes
            ("Prescriptions - Create", self.test_prescriptions_create),
            ("Prescriptions - Verify (Public)", self.test_prescriptions_verify),
            ("Prescriptions - List", self.test_prescriptions_list),
            ("Prescriptions - Get Specific", self.test_prescriptions_get_specific),
            ("Prescriptions - PDF Download", self.test_prescriptions_pdf),
            
            # Medication Routes
            ("Medications - Search", self.test_medications_search),
            ("Medications - Explain", self.test_medications_explain),
            
            # Audio Routes
            ("Audio - Languages List", self.test_audio_languages),
            ("Audio - Extract from Text", self.test_audio_extract_from_text),
            
            # E2EE Routes
            ("E2EE - Register Public Key", self.test_e2ee_register_public_key),
            ("E2EE - Exchange Key", self.test_e2ee_exchange_key),
            ("E2EE - Get Keys for Me", self.test_e2ee_keys_for_me),
            
            # Attachment Routes
            ("Attachments - Upload", self.test_attachments_upload),
            ("Attachments - List by Case", self.test_attachments_case_list),
            ("Attachments - Download", self.test_attachments_download),
            ("Attachments - Get Specific", self.test_attachments_get_specific),
            
            # Report Routes
            ("Reports - Generate", self.test_reports_generate),
            ("Reports - My List", self.test_reports_my_list),
            ("Reports - Get Specific", self.test_reports_get_specific),
            ("Reports - PDF Download", self.test_reports_pdf),
            ("Reports - Update", self.test_reports_update),
            ("Reports - Send", self.test_reports_send),
            
            # Admin Routes
            ("Admin - List Users", self.test_admin_users),
            ("Admin - Stats", self.test_admin_stats),
            ("Dashboard - Stats (All Roles)", self.test_dashboard_stats),
        ]
        
        for test_name, test_func in tests:
            self.log(f"\n--- Running: {test_name} ---")
            self.run_test(test_name, test_func)
                
        # Summary
        self.log("\n=== REGRESSION TEST SUMMARY ===")
        passed = sum(1 for result in self.test_results.values() if result)
        total = len(self.test_results)
        
        failed_tests = []
        for test_name, result in self.test_results.items():
            status = "✅ PASSED" if result else "❌ FAILED"
            self.log(f"{status}: {test_name}")
            if not result:
                failed_tests.append(test_name)
            
        self.log(f"\nOverall: {passed}/{total} tests passed")
        
        if failed_tests:
            self.log(f"\nFAILED TESTS:")
            for test in failed_tests:
                self.log(f"  - {test}")
        
        return self.test_results

if __name__ == "__main__":
    tester = MedScribeRegressionTest()
    results = tester.run_all_tests()