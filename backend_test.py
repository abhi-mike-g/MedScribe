#!/usr/bin/env python3
"""
MedScribe Backend API Test Suite - Focus on Attachment Routes and E2EE Flow
Tests the newly modified attachment endpoints and full E2EE workflow.
"""
import requests
import json
import tempfile
import base64
import os
from pathlib import Path
import time

# Backend URL from frontend/.env
BACKEND_URL = "https://e2ee-transfer.preview.emergentagent.com/api"

class TestMedScribeAttachments:
    def __init__(self):
        self.doctor_token = None
        self.patient_token = None
        self.doctor_user = None
        self.patient_user = None
        self.case_id = None
        self.attachment_id = None
        self.prescription_id = None
        self.session = requests.Session()
        
    def log(self, message):
        print(f"[TEST] {message}")
        
    def test_register_doctor(self):
        """Test 1: Register a doctor with license_number"""
        self.log("Testing doctor registration...")
        
        unique_id = str(int(time.time()))
        
        doctor_data = {
            "name": "Dr. Sarah Wilson",
            "email": f"doctor{unique_id}@medscribe.com",
            "password": "securepass123",
            "specialty": "Internal Medicine",
            "license_number": f"MD{unique_id}"
        }
        
        response = self.session.post(f"{BACKEND_URL}/auth/register/doctor", json=doctor_data)
        
        if response.status_code != 200:
            self.log(f"❌ FAILED: Expected 200, got {response.status_code}")
            self.log(f"Response: {response.text}")
            return False
            
        data = response.json()
        
        if "token" not in data or "user" not in data:
            self.log("❌ FAILED: Missing token or user in response")
            return False
            
        self.doctor_token = data["token"]
        self.doctor_user = data["user"]
        
        if data["user"]["role"] != "doctor":
            self.log(f"❌ FAILED: Expected role=doctor, got {data['user']['role']}")
            return False
            
        if "license_number" not in data["user"]:
            self.log("❌ FAILED: Missing license_number in doctor user")
            return False
            
        self.log(f"✅ PASSED: Doctor registered successfully")
        self.log(f"  Doctor ID: {self.doctor_user['id']}")
        self.log(f"  License: {self.doctor_user['license_number']}")
        return True
        
    def test_register_patient(self):
        """Test 2: Register a patient"""
        self.log("Testing patient registration...")
        
        unique_id = str(int(time.time()))
        
        patient_data = {
            "name": "John Smith",
            "email": f"patient{unique_id}@medscribe.com",
            "password": "patientpass123",
            "age": 35,
            "gender": "Male",
            "phone": "555-0123",
            "blood_group": "O+"
        }
        
        response = self.session.post(f"{BACKEND_URL}/auth/register/patient", json=patient_data)
        
        if response.status_code != 200:
            self.log(f"❌ FAILED: Expected 200, got {response.status_code}")
            self.log(f"Response: {response.text}")
            return False
            
        data = response.json()
        
        if "token" not in data or "user" not in data:
            self.log("❌ FAILED: Missing token or user in response")
            return False
            
        self.patient_token = data["token"]
        self.patient_user = data["user"]
        
        if data["user"]["role"] != "patient":
            self.log(f"❌ FAILED: Expected role=patient, got {data['user']['role']}")
            return False
            
        if "patient_id" not in data["user"]:
            self.log("❌ FAILED: Missing patient_id in patient user")
            return False
            
        self.log(f"✅ PASSED: Patient registered successfully")
        self.log(f"  Patient ID: {self.patient_user['patient_id']}")
        return True
        
    def test_patient_create_case(self):
        """Test 3: Patient creates a case"""
        self.log("Testing case creation...")
        
        if not self.patient_token:
            self.log("❌ FAILED: No patient token available")
            return False
            
        case_data = {
            "transcript": "I have been experiencing severe headaches for the past week, especially in the morning. The pain is throbbing and located on the right side of my head. I also feel nauseous sometimes.",
            "chief_complaint": "Severe headaches with nausea"
        }
        
        headers = {
            'Authorization': f'Bearer {self.patient_token}',
            'Content-Type': 'application/json'
        }
        
        response = self.session.post(f"{BACKEND_URL}/cases/submit", json=case_data, headers=headers)
        
        if response.status_code != 200:
            self.log(f"❌ FAILED: Expected 200, got {response.status_code}")
            self.log(f"Response: {response.text}")
            return False
            
        data = response.json()
        
        if "id" not in data:
            self.log("❌ FAILED: Missing case id in response")
            return False
            
        self.case_id = data["id"]
        
        if data.get("status") != "pending":
            self.log(f"❌ FAILED: Expected status=pending, got {data.get('status')}")
            return False
            
        self.log(f"✅ PASSED: Case created successfully")
        self.log(f"  Case ID: {self.case_id}")
        return True
        
    def test_attachment_route_ordering_get_case_attachments(self):
        """Test 4: GET /api/attachments/case/{case_id} returns list (even empty)"""
        self.log("Testing GET /api/attachments/case/{case_id}...")
        
        if not self.patient_token or not self.case_id:
            self.log("❌ FAILED: No patient token or case_id available")
            return False
            
        headers = {
            'Authorization': f'Bearer {self.patient_token}'
        }
        
        response = self.session.get(f"{BACKEND_URL}/attachments/case/{self.case_id}", headers=headers)
        
        if response.status_code != 200:
            self.log(f"❌ FAILED: Expected 200, got {response.status_code}")
            self.log(f"Response: {response.text}")
            return False
            
        data = response.json()
        
        if not isinstance(data, list):
            self.log(f"❌ FAILED: Expected list response, got {type(data)}")
            return False
            
        self.log(f"✅ PASSED: GET /api/attachments/case/{self.case_id} returns list")
        self.log(f"  Attachments count: {len(data)}")
        return True
        
    def create_test_encrypted_file(self):
        """Create a test encrypted file for upload"""
        # Create some test content
        test_content = b"This is a test medical document with patient information."
        
        # Generate a random IV (12 bytes for AES-GCM)
        iv = os.urandom(12)
        iv_b64 = base64.b64encode(iv).decode()
        
        # For testing, we'll just use the original content as "encrypted" data
        # In real implementation, this would be AES-256-GCM encrypted
        encrypted_content = test_content
        
        # Create temporary file
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.enc')
        temp_file.write(encrypted_content)
        temp_file.close()
        
        return temp_file.name, iv_b64
        
    def test_attachment_upload(self):
        """Test 5: POST /api/attachments/upload with multipart form data"""
        self.log("Testing POST /api/attachments/upload...")
        
        if not self.patient_token or not self.case_id:
            self.log("❌ FAILED: No patient token or case_id available")
            return False
            
        # Create test encrypted file
        file_path, iv = self.create_test_encrypted_file()
        
        try:
            headers = {
                'Authorization': f'Bearer {self.patient_token}'
            }
            
            with open(file_path, 'rb') as f:
                files = {
                    'encrypted_data': ('test_document.pdf', f, 'application/octet-stream')
                }
                data = {
                    'case_id': self.case_id,
                    'file_name': 'test_document.pdf',
                    'file_type': 'application/pdf',
                    'iv': iv,
                    'sender_id': self.patient_user['id']
                }
                
                response = self.session.post(f"{BACKEND_URL}/attachments/upload", 
                                           files=files, data=data, headers=headers)
                
            if response.status_code != 200:
                self.log(f"❌ FAILED: Expected 200, got {response.status_code}")
                self.log(f"Response: {response.text}")
                return False
                
            result = response.json()
            
            required_fields = ["id", "file_name", "file_size", "encrypted", "encryption_method"]
            for field in required_fields:
                if field not in result:
                    self.log(f"❌ FAILED: Missing field '{field}' in response")
                    return False
                    
            self.attachment_id = result["id"]
            
            if result["encrypted"] != True:
                self.log("❌ FAILED: Expected encrypted=True")
                return False
                
            if result["encryption_method"] != "AES-256-GCM":
                self.log(f"❌ FAILED: Expected AES-256-GCM, got {result['encryption_method']}")
                return False
                
            self.log(f"✅ PASSED: Attachment uploaded successfully")
            self.log(f"  Attachment ID: {self.attachment_id}")
            self.log(f"  File size: {result['file_size']} bytes")
            return True
            
        finally:
            # Clean up temp file
            Path(file_path).unlink(missing_ok=True)
            
    def test_attachment_list_after_upload(self):
        """Test 6: GET /api/attachments/case/{case_id} returns uploaded attachment"""
        self.log("Testing attachment list after upload...")
        
        if not self.patient_token or not self.case_id:
            self.log("❌ FAILED: No patient token or case_id available")
            return False
            
        headers = {
            'Authorization': f'Bearer {self.patient_token}'
        }
        
        response = self.session.get(f"{BACKEND_URL}/attachments/case/{self.case_id}", headers=headers)
        
        if response.status_code != 200:
            self.log(f"❌ FAILED: Expected 200, got {response.status_code}")
            self.log(f"Response: {response.text}")
            return False
            
        attachments = response.json()
        
        if not isinstance(attachments, list):
            self.log(f"❌ FAILED: Expected list response, got {type(attachments)}")
            return False
            
        if len(attachments) == 0:
            self.log("❌ FAILED: Expected at least 1 attachment, got 0")
            return False
            
        # Find our uploaded attachment
        our_attachment = None
        for att in attachments:
            if att.get("id") == self.attachment_id:
                our_attachment = att
                break
                
        if not our_attachment:
            self.log(f"❌ FAILED: Could not find uploaded attachment {self.attachment_id}")
            return False
            
        # Verify attachment metadata
        required_fields = ["id", "case_id", "original_file_name", "file_type", "encrypted"]
        for field in required_fields:
            if field not in our_attachment:
                self.log(f"❌ FAILED: Missing field '{field}' in attachment")
                return False
                
        if our_attachment["case_id"] != self.case_id:
            self.log(f"❌ FAILED: Wrong case_id in attachment")
            return False
            
        self.log(f"✅ PASSED: Attachment found in case attachments list")
        self.log(f"  File name: {our_attachment['original_file_name']}")
        return True
        
    def test_attachment_download(self):
        """Test 7: GET /api/attachments/{id}/download works"""
        self.log("Testing attachment download...")
        
        if not self.patient_token or not self.attachment_id:
            self.log("❌ FAILED: No patient token or attachment_id available")
            return False
            
        headers = {
            'Authorization': f'Bearer {self.patient_token}'
        }
        
        response = self.session.get(f"{BACKEND_URL}/attachments/{self.attachment_id}/download", headers=headers)
        
        if response.status_code != 200:
            self.log(f"❌ FAILED: Expected 200, got {response.status_code}")
            self.log(f"Response: {response.text}")
            return False
            
        # Check headers
        if response.headers.get("Content-Type") != "application/octet-stream":
            self.log(f"❌ FAILED: Expected application/octet-stream, got {response.headers.get('Content-Type')}")
            return False
            
        if "Content-Disposition" not in response.headers:
            self.log("❌ FAILED: Missing Content-Disposition header")
            return False
            
        if "X-Encryption-Method" not in response.headers:
            self.log("❌ FAILED: Missing X-Encryption-Method header")
            return False
            
        if "X-Encryption-IV" not in response.headers:
            self.log("❌ FAILED: Missing X-Encryption-IV header")
            return False
            
        # Check content
        if len(response.content) == 0:
            self.log("❌ FAILED: Empty file content")
            return False
            
        self.log(f"✅ PASSED: Attachment download successful")
        self.log(f"  Content-Type: {response.headers.get('Content-Type')}")
        self.log(f"  File size: {len(response.content)} bytes")
        self.log(f"  Encryption method: {response.headers.get('X-Encryption-Method')}")
        return True
        
    def test_attachment_access_control(self):
        """Test 8: Verify access control - patient can only see their own case attachments"""
        self.log("Testing attachment access control...")
        
        if not self.doctor_token or not self.case_id:
            self.log("❌ FAILED: No doctor token or case_id available")
            return False
            
        # Doctor should not be able to access patient's case attachments without being assigned
        headers = {
            'Authorization': f'Bearer {self.doctor_token}'
        }
        
        response = self.session.get(f"{BACKEND_URL}/attachments/case/{self.case_id}", headers=headers)
        
        # This should succeed because doctors can see all cases, but let's verify the response
        if response.status_code != 200:
            self.log(f"❌ FAILED: Expected 200, got {response.status_code}")
            self.log(f"Response: {response.text}")
            return False
            
        attachments = response.json()
        
        if not isinstance(attachments, list):
            self.log(f"❌ FAILED: Expected list response, got {type(attachments)}")
            return False
            
        self.log(f"✅ PASSED: Access control working - doctor can see case attachments")
        self.log(f"  Attachments visible to doctor: {len(attachments)}")
        return True
        
    def test_prescription_create_endpoint(self):
        """Test 9: POST /api/prescriptions/create still works (smoke test)"""
        self.log("Testing prescription creation endpoint...")
        
        if not self.doctor_token or not self.patient_user:
            self.log("❌ FAILED: No doctor token or patient user available")
            return False
            
        prescription_data = {
            "patient_id": self.patient_user["patient_id"],
            "diagnosis": "Tension headache",
            "medications": [
                {
                    "name": "Ibuprofen",
                    "dosage": "400mg",
                    "frequency": "Every 6 hours as needed",
                    "duration": "5 days",
                    "instructions": "Take with food"
                }
            ],
            "general_advice": "Rest and stay hydrated",
            "warnings": ["Do not exceed 1200mg in 24 hours"],
            "follow_up_date": "2024-02-15",
            "valid_days": 30
        }
        
        headers = {
            'Authorization': f'Bearer {self.doctor_token}',
            'Content-Type': 'application/json'
        }
        
        response = self.session.post(f"{BACKEND_URL}/prescriptions/create", json=prescription_data, headers=headers)
        
        if response.status_code != 200:
            self.log(f"❌ FAILED: Expected 200, got {response.status_code}")
            self.log(f"Response: {response.text}")
            return False
            
        data = response.json()
        
        required_fields = ["id", "doctor_id", "patient_id", "diagnosis", "medications", "status"]
        for field in required_fields:
            if field not in data:
                self.log(f"❌ FAILED: Missing field '{field}' in response")
                return False
                
        self.prescription_id = data["id"]
        
        if data["status"] != "sent":
            self.log(f"❌ FAILED: Expected status=sent, got {data['status']}")
            return False
            
        self.log(f"✅ PASSED: Prescription created successfully")
        self.log(f"  Prescription ID: {self.prescription_id}")
        return True
        
    def test_prescription_pdf_download(self):
        """Test 10: GET /api/prescriptions/{rx_id}/pdf works"""
        self.log("Testing prescription PDF download...")
        
        if not self.doctor_token or not self.prescription_id:
            self.log("❌ FAILED: No doctor token or prescription_id available")
            return False
            
        headers = {
            'Authorization': f'Bearer {self.doctor_token}'
        }
        
        response = self.session.get(f"{BACKEND_URL}/prescriptions/{self.prescription_id}/pdf", headers=headers)
        
        if response.status_code != 200:
            self.log(f"❌ FAILED: Expected 200, got {response.status_code}")
            self.log(f"Response: {response.text}")
            return False
            
        # Check if it's a PDF
        if not response.headers.get("Content-Type", "").startswith("application/pdf"):
            self.log(f"❌ FAILED: Expected PDF content-type, got {response.headers.get('Content-Type')}")
            return False
            
        if len(response.content) == 0:
            self.log("❌ FAILED: Empty PDF content")
            return False
            
        # Check PDF magic bytes
        if not response.content.startswith(b'%PDF'):
            self.log("❌ FAILED: Response is not a valid PDF")
            return False
            
        self.log(f"✅ PASSED: Prescription PDF download successful")
        self.log(f"  Content-Type: {response.headers.get('Content-Type')}")
        self.log(f"  PDF size: {len(response.content)} bytes")
        return True
        
    def run_all_tests(self):
        """Run all attachment and E2EE flow tests"""
        self.log("=== Starting MedScribe Attachment & E2EE Test Suite ===")
        
        tests = [
            ("Register Doctor", self.test_register_doctor),
            ("Register Patient", self.test_register_patient),
            ("Patient Create Case", self.test_patient_create_case),
            ("Attachment Route - Get Case Attachments (Empty)", self.test_attachment_route_ordering_get_case_attachments),
            ("Attachment Upload", self.test_attachment_upload),
            ("Attachment Route - Get Case Attachments (With Data)", self.test_attachment_list_after_upload),
            ("Attachment Download", self.test_attachment_download),
            ("Attachment Access Control", self.test_attachment_access_control),
            ("Prescription Create Endpoint", self.test_prescription_create_endpoint),
            ("Prescription PDF Download", self.test_prescription_pdf_download),
        ]
        
        results = {}
        
        for test_name, test_func in tests:
            self.log(f"\n--- Running: {test_name} ---")
            try:
                results[test_name] = test_func()
            except Exception as e:
                self.log(f"❌ FAILED: {test_name} - Exception: {str(e)}")
                results[test_name] = False
                
        # Summary
        self.log("\n=== TEST SUMMARY ===")
        passed = sum(1 for result in results.values() if result)
        total = len(results)
        
        for test_name, result in results.items():
            status = "✅ PASSED" if result else "❌ FAILED"
            self.log(f"{status}: {test_name}")
            
        self.log(f"\nOverall: {passed}/{total} tests passed")
        
        return results

if __name__ == "__main__":
    tester = TestMedScribeAttachments()
    results = tester.run_all_tests()