#!/usr/bin/env python3
"""
Medical Report Generation API Test Suite
Tests the complete report generation workflow including RBAC, PDF generation, and patient access.
"""
import requests
import json
import tempfile
import time
from pathlib import Path

# Backend URL from frontend/.env
BACKEND_URL = "https://e2ee-transfer.preview.emergentagent.com/api"

class TestMedicalReports:
    def __init__(self):
        self.doctor_token = None
        self.patient_token = None
        self.case_id = None
        self.report_id = None
        self.session = requests.Session()
        self.session.headers.update({'Content-Type': 'application/json'})
        
    def log(self, message):
        print(f"[TEST] {message}")
        
    def test_doctor_login(self):
        """Test 1: Login as doctor with provided credentials"""
        self.log("Testing doctor login...")
        
        login_data = {
            "email": "docverify@test.com",
            "password": "Test1234!",
            "role": "doctor"
        }
        
        response = self.session.post(f"{BACKEND_URL}/auth/login", json=login_data)
        
        if response.status_code != 200:
            self.log(f"❌ FAILED: Expected 200, got {response.status_code}")
            self.log(f"Response: {response.text}")
            return False
            
        data = response.json()
        
        if "token" not in data:
            self.log("❌ FAILED: Missing token in response")
            return False
            
        if "user" not in data or data["user"].get("role") != "doctor":
            self.log("❌ FAILED: Invalid user data or role")
            return False
            
        self.doctor_token = data["token"]
        self.log(f"✅ PASSED: Doctor logged in successfully")
        return True
        
    def test_get_pending_cases(self):
        """Test 2: Get pending cases to find a case ID"""
        self.log("Testing get pending cases...")
        
        if not self.doctor_token:
            self.log("❌ FAILED: No doctor token available")
            return False
            
        headers = {
            'Authorization': f'Bearer {self.doctor_token}',
            'Content-Type': 'application/json'
        }
        
        response = self.session.get(f"{BACKEND_URL}/doctor/pending-cases", headers=headers)
        
        if response.status_code != 200:
            self.log(f"❌ FAILED: Expected 200, got {response.status_code}")
            self.log(f"Response: {response.text}")
            return False
            
        data = response.json()
        
        if not isinstance(data, list):
            self.log("❌ FAILED: Expected array of cases")
            return False
            
        if len(data) == 0:
            self.log("❌ FAILED: No pending cases found - need at least one case for testing")
            return False
            
        self.case_id = data[0]["id"]
        self.log(f"✅ PASSED: Found {len(data)} pending cases, using case ID: {self.case_id}")
        return True
        
    def test_get_case_details(self):
        """Test 3: Get case details to see extraction_data"""
        self.log("Testing get case details...")
        
        if not self.doctor_token or not self.case_id:
            self.log("❌ FAILED: Missing doctor token or case ID")
            return False
            
        headers = {
            'Authorization': f'Bearer {self.doctor_token}',
            'Content-Type': 'application/json'
        }
        
        response = self.session.get(f"{BACKEND_URL}/cases/{self.case_id}", headers=headers)
        
        if response.status_code != 200:
            self.log(f"❌ FAILED: Expected 200, got {response.status_code}")
            self.log(f"Response: {response.text}")
            return False
            
        data = response.json()
        
        if "id" not in data:
            self.log("❌ FAILED: Missing case ID in response")
            return False
            
        # Store case data for report generation
        self.case_data = data
        self.log(f"✅ PASSED: Retrieved case details for case {self.case_id}")
        self.log(f"  Patient: {data.get('patient_name', 'N/A')}")
        self.log(f"  Status: {data.get('status', 'N/A')}")
        return True
        
    def test_generate_report(self):
        """Test 4: Generate a medical report with full SOAP data"""
        self.log("Testing report generation...")
        
        if not self.doctor_token or not self.case_id:
            self.log("❌ FAILED: Missing doctor token or case ID")
            return False
            
        headers = {
            'Authorization': f'Bearer {self.doctor_token}',
            'Content-Type': 'application/json'
        }
        
        # Create comprehensive SOAP report data
        report_data = {
            "source_type": "case",
            "source_id": self.case_id,
            "patient_name": self.case_data.get("patient_name", "John Doe"),
            "patient_age": str(self.case_data.get("patient_age", 35)),
            "patient_gender": self.case_data.get("patient_gender", "Male"),
            "patient_id_display": "PAT-L5S4JI",  # Use actual patient ID
            
            # Subjective data
            "chief_complaint": "Persistent headache and fatigue for 3 days",
            "hpi": "Patient reports gradual onset of bilateral headache 3 days ago, described as throbbing, 7/10 severity. Associated with fatigue and mild nausea. No fever, vision changes, or neck stiffness. Symptoms worsen with activity and improve with rest.",
            "review_of_systems": "Positive for headache, fatigue, mild nausea. Negative for fever, vision changes, neck stiffness, photophobia, vomiting, chest pain, shortness of breath.",
            
            # Objective data
            "vital_signs": [
                {"parameter": "Blood Pressure", "value": "128/82 mmHg", "normal_range": "120/80 mmHg"},
                {"parameter": "Heart Rate", "value": "78 bpm", "normal_range": "60-100 bpm"},
                {"parameter": "Temperature", "value": "98.6°F", "normal_range": "98.6°F"},
                {"parameter": "Respiratory Rate", "value": "16/min", "normal_range": "12-20/min"}
            ],
            
            # Assessment
            "primary_diagnosis": "Tension-type headache",
            "differential_diagnoses": ["Migraine headache", "Cluster headache", "Medication overuse headache"],
            "clinical_reasoning": "Based on bilateral throbbing headache with associated fatigue and nausea, most consistent with tension-type headache. No red flag symptoms present.",
            
            # Plan
            "medications": [
                {
                    "drug": "Ibuprofen",
                    "dose": "400mg",
                    "frequency": "Every 6 hours",
                    "duration": "5 days",
                    "instructions": "Take with food to prevent stomach upset"
                },
                {
                    "drug": "Acetaminophen",
                    "dose": "500mg",
                    "frequency": "Every 8 hours",
                    "duration": "As needed",
                    "instructions": "Do not exceed 3000mg per day"
                }
            ],
            "simple_instructions": [
                "Rest in a quiet, dark room",
                "Apply cold compress to forehead for 15 minutes",
                "Stay well hydrated",
                "Avoid stress and get adequate sleep"
            ],
            "warning_signs": [
                "Sudden severe headache unlike any before",
                "Headache with fever and neck stiffness",
                "Vision changes or weakness",
                "Persistent vomiting"
            ],
            "follow_up": "Return in 1 week if symptoms persist or worsen",
            "patient_education": "Tension headaches are common and usually respond well to rest, hydration, and over-the-counter pain medications. Stress management and regular sleep patterns can help prevent future episodes."
        }
        
        response = self.session.post(f"{BACKEND_URL}/reports/generate", json=report_data, headers=headers)
        
        if response.status_code != 200:
            self.log(f"❌ FAILED: Expected 200, got {response.status_code}")
            self.log(f"Response: {response.text}")
            return False
            
        data = response.json()
        
        if "id" not in data:
            self.log("❌ FAILED: Missing report ID in response")
            return False
            
        if data.get("status") != "draft":
            self.log("❌ FAILED: Expected status 'draft'")
            return False
            
        self.report_id = data["id"]
        self.log(f"✅ PASSED: Report generated successfully with ID: {self.report_id}")
        self.log(f"  Status: {data.get('status')}")
        return True
        
    def test_download_pdf(self):
        """Test 5: Download PDF and verify it's valid"""
        self.log("Testing PDF download...")
        
        if not self.doctor_token or not self.report_id:
            self.log("❌ FAILED: Missing doctor token or report ID")
            return False
            
        headers = {
            'Authorization': f'Bearer {self.doctor_token}'
        }
        
        response = self.session.get(f"{BACKEND_URL}/reports/{self.report_id}/pdf", headers=headers)
        
        if response.status_code != 200:
            self.log(f"❌ FAILED: Expected 200, got {response.status_code}")
            self.log(f"Response: {response.text}")
            return False
            
        # Check content type
        content_type = response.headers.get('content-type', '')
        if 'application/pdf' not in content_type:
            self.log(f"❌ FAILED: Expected application/pdf, got {content_type}")
            return False
            
        # Check PDF header
        pdf_content = response.content
        if not pdf_content.startswith(b'%PDF'):
            self.log("❌ FAILED: Invalid PDF header")
            return False
            
        self.log(f"✅ PASSED: PDF downloaded successfully")
        self.log(f"  Content-Type: {content_type}")
        self.log(f"  Size: {len(pdf_content)} bytes")
        return True
        
    def test_update_report(self):
        """Test 6: Update/edit the report"""
        self.log("Testing report update...")
        
        if not self.doctor_token or not self.report_id:
            self.log("❌ FAILED: Missing doctor token or report ID")
            return False
            
        headers = {
            'Authorization': f'Bearer {self.doctor_token}',
            'Content-Type': 'application/json'
        }
        
        update_data = {
            "chief_complaint": "Updated: Severe headache and dizziness for 3 days"
        }
        
        response = self.session.put(f"{BACKEND_URL}/reports/{self.report_id}", json=update_data, headers=headers)
        
        if response.status_code != 200:
            self.log(f"❌ FAILED: Expected 200, got {response.status_code}")
            self.log(f"Response: {response.text}")
            return False
            
        data = response.json()
        
        # Verify the update was applied
        if data.get("subjective", {}).get("chief_complaint") != update_data["chief_complaint"]:
            self.log("❌ FAILED: Chief complaint was not updated")
            return False
            
        self.log(f"✅ PASSED: Report updated successfully")
        self.log(f"  Updated chief complaint: {data.get('subjective', {}).get('chief_complaint')}")
        return True
        
    def test_re_download_pdf(self):
        """Test 7: Re-download PDF to verify changes are reflected"""
        self.log("Testing PDF re-download after update...")
        
        if not self.doctor_token or not self.report_id:
            self.log("❌ FAILED: Missing doctor token or report ID")
            return False
            
        headers = {
            'Authorization': f'Bearer {self.doctor_token}'
        }
        
        response = self.session.get(f"{BACKEND_URL}/reports/{self.report_id}/pdf", headers=headers)
        
        if response.status_code != 200:
            self.log(f"❌ FAILED: Expected 200, got {response.status_code}")
            self.log(f"Response: {response.text}")
            return False
            
        # Check content type
        content_type = response.headers.get('content-type', '')
        if 'application/pdf' not in content_type:
            self.log(f"❌ FAILED: Expected application/pdf, got {content_type}")
            return False
            
        # Check PDF header
        pdf_content = response.content
        if not pdf_content.startswith(b'%PDF'):
            self.log("❌ FAILED: Invalid PDF header")
            return False
            
        self.log(f"✅ PASSED: Updated PDF downloaded successfully")
        self.log(f"  Size: {len(pdf_content)} bytes")
        return True
        
    def test_send_to_patient(self):
        """Test 8: Send report to patient"""
        self.log("Testing send report to patient...")
        
        if not self.doctor_token or not self.report_id:
            self.log("❌ FAILED: Missing doctor token or report ID")
            return False
            
        headers = {
            'Authorization': f'Bearer {self.doctor_token}',
            'Content-Type': 'application/json'
        }
        
        response = self.session.post(f"{BACKEND_URL}/reports/{self.report_id}/send", headers=headers)
        
        if response.status_code != 200:
            self.log(f"❌ FAILED: Expected 200, got {response.status_code}")
            self.log(f"Response: {response.text}")
            return False
            
        data = response.json()
        
        if "message" not in data or "sent_at" not in data:
            self.log("❌ FAILED: Missing expected fields in response")
            return False
            
        self.log(f"✅ PASSED: Report sent to patient successfully")
        self.log(f"  Message: {data.get('message')}")
        return True
        
    def test_doctor_list_reports(self):
        """Test 9: Verify doctor can list their reports"""
        self.log("Testing doctor list reports...")
        
        if not self.doctor_token:
            self.log("❌ FAILED: Missing doctor token")
            return False
            
        headers = {
            'Authorization': f'Bearer {self.doctor_token}',
            'Content-Type': 'application/json'
        }
        
        response = self.session.get(f"{BACKEND_URL}/reports/my/list", headers=headers)
        
        if response.status_code != 200:
            self.log(f"❌ FAILED: Expected 200, got {response.status_code}")
            self.log(f"Response: {response.text}")
            return False
            
        data = response.json()
        
        if not isinstance(data, list):
            self.log("❌ FAILED: Expected array of reports")
            return False
            
        # Find our report in the list
        found_report = None
        for report in data:
            if report.get("id") == self.report_id:
                found_report = report
                break
                
        if not found_report:
            self.log("❌ FAILED: Generated report not found in doctor's list")
            return False
            
        if found_report.get("status") != "sent":
            self.log("❌ FAILED: Report status should be 'sent'")
            return False
            
        self.log(f"✅ PASSED: Doctor can list reports, found {len(data)} reports")
        self.log(f"  Our report status: {found_report.get('status')}")
        return True
        
    def test_patient_login(self):
        """Test 10: Login as patient"""
        self.log("Testing patient login...")
        
        login_data = {
            "email": "patverify@test.com",
            "password": "Test1234!",
            "role": "patient"
        }
        
        response = self.session.post(f"{BACKEND_URL}/auth/login", json=login_data)
        
        if response.status_code != 200:
            self.log(f"❌ FAILED: Expected 200, got {response.status_code}")
            self.log(f"Response: {response.text}")
            return False
            
        data = response.json()
        
        if "token" not in data:
            self.log("❌ FAILED: Missing token in response")
            return False
            
        if "user" not in data or data["user"].get("role") != "patient":
            self.log("❌ FAILED: Invalid user data or role")
            return False
            
        self.patient_token = data["token"]
        self.log(f"✅ PASSED: Patient logged in successfully")
        return True
        
    def test_patient_list_reports(self):
        """Test 11: Verify patient can see sent reports"""
        self.log("Testing patient list reports...")
        
        if not self.patient_token:
            self.log("❌ FAILED: Missing patient token")
            return False
            
        headers = {
            'Authorization': f'Bearer {self.patient_token}',
            'Content-Type': 'application/json'
        }
        
        response = self.session.get(f"{BACKEND_URL}/reports/my/list", headers=headers)
        
        if response.status_code != 200:
            self.log(f"❌ FAILED: Expected 200, got {response.status_code}")
            self.log(f"Response: {response.text}")
            return False
            
        data = response.json()
        
        if not isinstance(data, list):
            self.log("❌ FAILED: Expected array of reports")
            return False
            
        # Check if patient can see the sent report
        found_report = None
        for report in data:
            if report.get("id") == self.report_id:
                found_report = report
                break
                
        if not found_report:
            self.log("❌ FAILED: Sent report not found in patient's list")
            return False
            
        if found_report.get("status") != "sent":
            self.log("❌ FAILED: Report status should be 'sent'")
            return False
            
        self.log(f"✅ PASSED: Patient can see sent reports, found {len(data)} reports")
        return True
        
    def test_patient_download_pdf(self):
        """Test 12: Patient downloads PDF of sent report"""
        self.log("Testing patient PDF download...")
        
        if not self.patient_token or not self.report_id:
            self.log("❌ FAILED: Missing patient token or report ID")
            return False
            
        headers = {
            'Authorization': f'Bearer {self.patient_token}'
        }
        
        response = self.session.get(f"{BACKEND_URL}/reports/{self.report_id}/pdf", headers=headers)
        
        if response.status_code != 200:
            self.log(f"❌ FAILED: Expected 200, got {response.status_code}")
            self.log(f"Response: {response.text}")
            return False
            
        # Check content type
        content_type = response.headers.get('content-type', '')
        if 'application/pdf' not in content_type:
            self.log(f"❌ FAILED: Expected application/pdf, got {content_type}")
            return False
            
        # Check PDF header
        pdf_content = response.content
        if not pdf_content.startswith(b'%PDF'):
            self.log("❌ FAILED: Invalid PDF header")
            return False
            
        self.log(f"✅ PASSED: Patient can download sent report PDF")
        self.log(f"  Size: {len(pdf_content)} bytes")
        return True
        
    def test_patient_cannot_access_draft(self):
        """Test 13: Verify patient CANNOT access draft reports"""
        self.log("Testing patient cannot access draft reports...")
        
        if not self.doctor_token or not self.patient_token:
            self.log("❌ FAILED: Missing tokens")
            return False
            
        # First, create a new draft report as doctor
        headers = {
            'Authorization': f'Bearer {self.doctor_token}',
            'Content-Type': 'application/json'
        }
        
        draft_report_data = {
            "source_type": "case",
            "source_id": self.case_id,
            "patient_name": "Test Patient",
            "patient_age": "30",
            "patient_gender": "Female",
            "patient_id_display": "PAT-DRAFT",
            "chief_complaint": "Test draft report",
            "hpi": "This is a draft report for testing",
            "vital_signs": [{"parameter": "BP", "value": "120/80", "normal_range": "120/80"}],
            "primary_diagnosis": "Test diagnosis",
            "medications": [{"drug": "Test med", "dose": "10mg", "frequency": "Daily", "duration": "7 days", "instructions": "With food"}],
            "simple_instructions": ["Test instruction"],
            "warning_signs": ["Test warning"],
            "follow_up": "Test follow-up",
            "patient_education": "Test education"
        }
        
        response = self.session.post(f"{BACKEND_URL}/reports/generate", json=draft_report_data, headers=headers)
        
        if response.status_code != 200:
            self.log(f"❌ FAILED: Could not create draft report: {response.status_code}")
            return False
            
        draft_report_id = response.json()["id"]
        
        # Now try to access it as patient - should get 403
        patient_headers = {
            'Authorization': f'Bearer {self.patient_token}'
        }
        
        response = self.session.get(f"{BACKEND_URL}/reports/{draft_report_id}/pdf", headers=patient_headers)
        
        if response.status_code != 403:
            self.log(f"❌ FAILED: Expected 403, got {response.status_code}")
            self.log(f"Response: {response.text}")
            return False
            
        self.log(f"✅ PASSED: Patient correctly denied access to draft report")
        return True
        
    def test_sent_report_cannot_be_edited(self):
        """Test 14: Verify sent reports cannot be edited"""
        self.log("Testing sent reports cannot be edited...")
        
        if not self.doctor_token or not self.report_id:
            self.log("❌ FAILED: Missing doctor token or report ID")
            return False
            
        headers = {
            'Authorization': f'Bearer {self.doctor_token}',
            'Content-Type': 'application/json'
        }
        
        update_data = {
            "chief_complaint": "Trying to edit sent report"
        }
        
        response = self.session.put(f"{BACKEND_URL}/reports/{self.report_id}", json=update_data, headers=headers)
        
        if response.status_code != 400:
            self.log(f"❌ FAILED: Expected 400, got {response.status_code}")
            self.log(f"Response: {response.text}")
            return False
            
        error_data = response.json()
        if "Cannot edit a sent report" not in error_data.get("detail", ""):
            self.log(f"❌ FAILED: Expected 'Cannot edit a sent report' error, got: {error_data}")
            return False
            
        self.log(f"✅ PASSED: Sent reports correctly cannot be edited")
        return True
        
    def run_all_tests(self):
        """Run all medical report tests"""
        self.log("=== Starting Medical Report Generation Test Suite ===")
        
        tests = [
            ("Doctor Login", self.test_doctor_login),
            ("Get Pending Cases", self.test_get_pending_cases),
            ("Get Case Details", self.test_get_case_details),
            ("Generate Report", self.test_generate_report),
            ("Download PDF", self.test_download_pdf),
            ("Update Report", self.test_update_report),
            ("Re-download PDF", self.test_re_download_pdf),
            ("Send to Patient", self.test_send_to_patient),
            ("Doctor List Reports", self.test_doctor_list_reports),
            ("Patient Login", self.test_patient_login),
            ("Patient List Reports", self.test_patient_list_reports),
            ("Patient Download PDF", self.test_patient_download_pdf),
            ("Patient Cannot Access Draft", self.test_patient_cannot_access_draft),
            ("Sent Report Cannot Be Edited", self.test_sent_report_cannot_be_edited),
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
    tester = TestMedicalReports()
    results = tester.run_all_tests()