#!/usr/bin/env python3
"""
MedScribe Backend API Testing Suite
Tests all backend endpoints for multi-role medical application
"""

import requests
import json
import sys
import time
from datetime import datetime

# Backend URL from environment configuration
BASE_URL = "https://medscribe-multi-role.preview.emergentagent.com/api"

class MedScribeAPITester:
    def __init__(self):
        self.base_url = BASE_URL
        self.patient_token = None
        self.doctor_token = None
        self.admin_token = None
        self.patient_id = None
        self.case_id = None
        self.prescription_id = None
        self.test_results = []
        self.timestamp = str(int(time.time()))
        
    def log_test(self, test_name, success, details="", response_data=None):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
        if details:
            print(f"   Details: {details}")
        if response_data and not success:
            print(f"   Response: {response_data}")
        print()
        
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details,
            "response": response_data if not success else None
        })
    
    def make_request(self, method, endpoint, data=None, headers=None, expected_status=200):
        """Make HTTP request with error handling"""
        url = f"{self.base_url}{endpoint}"
        try:
            if method.upper() == "GET":
                response = requests.get(url, headers=headers, timeout=30)
            elif method.upper() == "POST":
                response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method.upper() == "PUT":
                response = requests.put(url, json=data, headers=headers, timeout=30)
            else:
                return None, f"Unsupported method: {method}"
            
            if response.status_code == expected_status:
                try:
                    return response.json(), None
                except:
                    return response.text, None
            else:
                try:
                    error_data = response.json()
                except:
                    error_data = response.text
                return None, f"Status {response.status_code}: {error_data}"
                
        except requests.exceptions.RequestException as e:
            return None, f"Request failed: {str(e)}"
    
    def test_health_check(self):
        """Test health check endpoint"""
        data, error = self.make_request("GET", "/health")
        if error:
            self.log_test("Health Check", False, error)
            return False
        
        success = data.get("status") == "healthy"
        self.log_test("Health Check", success, f"Status: {data.get('status')}")
        return success
    
    def test_register_patient(self):
        """Test patient registration"""
        patient_data = {
            "name": "Sarah Johnson",
            "email": f"sarah.johnson.{self.timestamp}@medtest.com",
            "password": "securepass123",
            "age": 28,
            "gender": "Female",
            "phone": "555-0123",
            "blood_group": "A+"
        }
        
        data, error = self.make_request("POST", "/auth/register/patient", patient_data)
        if error:
            self.log_test("Register Patient", False, error)
            return False
        
        if data.get("token") and data.get("user", {}).get("patient_id"):
            self.patient_token = data["token"]
            self.patient_id = data["user"]["patient_id"]
            self.log_test("Register Patient", True, f"Patient ID: {self.patient_id}")
            return True
        else:
            self.log_test("Register Patient", False, "Missing token or patient_id", data)
            return False
    
    def test_register_doctor(self):
        """Test doctor registration"""
        doctor_data = {
            "name": "Dr. Michael Chen",
            "email": f"dr.chen.{self.timestamp}@medtest.com",
            "password": "docpass123",
            "specialty": "Internal Medicine",
            "license_number": "MED-12345"
        }
        
        data, error = self.make_request("POST", "/auth/register/doctor", doctor_data)
        if error:
            self.log_test("Register Doctor", False, error)
            return False
        
        if data.get("token") and data.get("user", {}).get("role") == "doctor":
            self.doctor_token = data["token"]
            self.log_test("Register Doctor", True, f"Doctor: {data['user']['name']}")
            return True
        else:
            self.log_test("Register Doctor", False, "Missing token or incorrect role", data)
            return False
    
    def test_register_admin(self):
        """Test admin registration"""
        admin_data = {
            "name": "Admin User",
            "email": f"admin.{self.timestamp}@medtest.com",
            "password": "adminpass123",
            "department": "IT Administration"
        }
        
        data, error = self.make_request("POST", "/auth/register/admin", admin_data)
        if error:
            self.log_test("Register Admin", False, error)
            return False
        
        if data.get("token") and data.get("user", {}).get("role") == "admin":
            self.admin_token = data["token"]
            self.log_test("Register Admin", True, f"Admin: {data['user']['name']}")
            return True
        else:
            self.log_test("Register Admin", False, "Missing token or incorrect role", data)
            return False
    
    def test_login_patient(self):
        """Test patient login"""
        login_data = {
            "email": f"sarah.johnson.{self.timestamp}@medtest.com",
            "password": "securepass123",
            "role": "patient"
        }
        
        data, error = self.make_request("POST", "/auth/login", login_data)
        if error:
            self.log_test("Login Patient", False, error)
            return False
        
        success = data.get("token") and data.get("user", {}).get("role") == "patient"
        self.log_test("Login Patient", success, f"User: {data.get('user', {}).get('name', 'Unknown')}")
        return success
    
    def test_patient_submit_case(self):
        """Test patient case submission"""
        if not self.patient_token:
            self.log_test("Patient Submit Case", False, "No patient token available")
            return False
        
        headers = {"Authorization": f"Bearer {self.patient_token}"}
        case_data = {
            "transcript": "I have been experiencing severe headaches for the past 3 days, especially in the morning. The pain is throbbing and located at the front of my head. I also feel nauseous and have sensitivity to light.",
            "chief_complaint": "Persistent headaches with nausea and photophobia"
        }
        
        data, error = self.make_request("POST", "/cases/submit", case_data, headers)
        if error:
            self.log_test("Patient Submit Case", False, error)
            return False
        
        if data.get("id") and data.get("status") == "pending":
            self.case_id = data["id"]
            self.log_test("Patient Submit Case", True, f"Case ID: {self.case_id}")
            return True
        else:
            self.log_test("Patient Submit Case", False, "Missing case ID or incorrect status", data)
            return False
    
    def test_patient_get_my_cases(self):
        """Test patient getting their cases"""
        if not self.patient_token:
            self.log_test("Patient Get My Cases", False, "No patient token available")
            return False
        
        headers = {"Authorization": f"Bearer {self.patient_token}"}
        data, error = self.make_request("GET", "/cases/my", headers=headers)
        if error:
            self.log_test("Patient Get My Cases", False, error)
            return False
        
        success = isinstance(data, list) and len(data) > 0
        self.log_test("Patient Get My Cases", success, f"Found {len(data)} cases")
        return success
    
    def test_doctor_get_pending_cases(self):
        """Test doctor getting pending cases"""
        if not self.doctor_token:
            self.log_test("Doctor Get Pending Cases", False, "No doctor token available")
            return False
        
        headers = {"Authorization": f"Bearer {self.doctor_token}"}
        data, error = self.make_request("GET", "/doctor/pending-cases", headers=headers)
        if error:
            self.log_test("Doctor Get Pending Cases", False, error)
            return False
        
        success = isinstance(data, list)
        case_count = len(data) if success else 0
        self.log_test("Doctor Get Pending Cases", success, f"Found {case_count} cases")
        return success
    
    def test_doctor_lookup_patient(self):
        """Test doctor looking up patient by ID"""
        if not self.doctor_token or not self.patient_id:
            self.log_test("Doctor Lookup Patient", False, "Missing doctor token or patient ID")
            return False
        
        headers = {"Authorization": f"Bearer {self.doctor_token}"}
        data, error = self.make_request("GET", f"/doctor/lookup/{self.patient_id}", headers=headers)
        if error:
            self.log_test("Doctor Lookup Patient", False, error)
            return False
        
        success = data.get("patient") and data.get("cases") is not None
        patient_name = data.get("patient", {}).get("name", "Unknown") if success else "N/A"
        self.log_test("Doctor Lookup Patient", success, f"Patient: {patient_name}")
        return success
    
    def test_doctor_respond_to_case(self):
        """Test doctor responding to a case"""
        if not self.doctor_token or not self.case_id:
            self.log_test("Doctor Respond to Case", False, "Missing doctor token or case ID")
            return False
        
        headers = {"Authorization": f"Bearer {self.doctor_token}"}
        response_data = {
            "response_type": "prescription",
            "message": "Based on your symptoms, this appears to be tension headache possibly triggered by stress or lack of sleep.",
            "diagnosis": "Tension Headache",
            "medications": [
                {
                    "name": "Ibuprofen",
                    "dosage": "400mg",
                    "frequency": "Twice daily with food",
                    "duration": "5 days"
                },
                {
                    "name": "Acetaminophen",
                    "dosage": "500mg",
                    "frequency": "As needed for pain",
                    "duration": "7 days"
                }
            ],
            "instructions": "Rest in a dark, quiet room. Stay hydrated. Avoid screens before bedtime. Apply cold compress to forehead.",
            "follow_up_date": "2 weeks"
        }
        
        data, error = self.make_request("PUT", f"/cases/{self.case_id}/respond", response_data, headers)
        if error:
            self.log_test("Doctor Respond to Case", False, error)
            return False
        
        success = data.get("status") == "responded" and data.get("prescription_id")
        if success:
            self.prescription_id = data.get("prescription_id")
        self.log_test("Doctor Respond to Case", success, f"Status: {data.get('status')}")
        return success
    
    def test_get_prescriptions_patient(self):
        """Test patient getting prescriptions"""
        if not self.patient_token:
            self.log_test("Get Prescriptions (Patient)", False, "No patient token available")
            return False
        
        headers = {"Authorization": f"Bearer {self.patient_token}"}
        data, error = self.make_request("GET", "/prescriptions", headers=headers)
        if error:
            self.log_test("Get Prescriptions (Patient)", False, error)
            return False
        
        success = isinstance(data, list)
        rx_count = len(data) if success else 0
        self.log_test("Get Prescriptions (Patient)", success, f"Found {rx_count} prescriptions")
        return success
    
    def test_medication_search(self):
        """Test medication search"""
        if not self.doctor_token:
            self.log_test("Medication Search", False, "No doctor token available")
            return False
        
        headers = {"Authorization": f"Bearer {self.doctor_token}"}
        data, error = self.make_request("GET", "/medications/search?q=ibu", headers=headers)
        if error:
            self.log_test("Medication Search", False, error)
            return False
        
        success = isinstance(data, list) and len(data) > 0
        found_ibuprofen = any("ibuprofen" in med.get("name", "").lower() for med in data) if success else False
        self.log_test("Medication Search", success and found_ibuprofen, f"Found {len(data)} medications, Ibuprofen: {found_ibuprofen}")
        return success and found_ibuprofen
    
    def test_admin_get_users(self):
        """Test admin getting users list"""
        if not self.admin_token:
            self.log_test("Admin Get Users", False, "No admin token available")
            return False
        
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        data, error = self.make_request("GET", "/admin/users", headers=headers)
        if error:
            self.log_test("Admin Get Users", False, error)
            return False
        
        success = isinstance(data, list) and len(data) >= 3  # At least patient, doctor, admin
        user_count = len(data) if success else 0
        self.log_test("Admin Get Users", success, f"Found {user_count} users")
        return success
    
    def test_admin_get_stats(self):
        """Test admin getting statistics"""
        if not self.admin_token:
            self.log_test("Admin Get Stats", False, "No admin token available")
            return False
        
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        data, error = self.make_request("GET", "/admin/stats", headers=headers)
        if error:
            self.log_test("Admin Get Stats", False, error)
            return False
        
        required_fields = ["total_users", "doctors", "patients", "admins", "total_cases"]
        success = all(field in data for field in required_fields)
        self.log_test("Admin Get Stats", success, f"Users: {data.get('total_users', 0)}, Cases: {data.get('total_cases', 0)}")
        return success
    
    def test_patient_validation(self):
        """Test patient registration validation"""
        invalid_data = {
            "name": "John123",  # Invalid: contains numbers
            "email": "invalid@test.com",
            "password": "test123",
            "age": 30
        }
        
        data, error = self.make_request("POST", "/auth/register/patient", invalid_data, expected_status=422)
        if error and "422" in error:
            self.log_test("Patient Validation", True, "Correctly rejected invalid name with numbers")
            return True
        elif data and "detail" in data and any("Name must contain only letters" in str(detail) for detail in data["detail"]):
            self.log_test("Patient Validation", True, "Correctly rejected invalid name with validation error")
            return True
        else:
            self.log_test("Patient Validation", False, "Should have rejected invalid name", data)
            return False
    
    def test_dashboard_stats_all_roles(self):
        """Test dashboard stats for all roles"""
        results = []
        
        # Test patient dashboard
        if self.patient_token:
            headers = {"Authorization": f"Bearer {self.patient_token}"}
            data, error = self.make_request("GET", "/dashboard/stats", headers=headers)
            patient_success = not error and "total_cases" in data
            results.append(("Patient", patient_success, error or f"Cases: {data.get('total_cases', 0)}"))
        
        # Test doctor dashboard
        if self.doctor_token:
            headers = {"Authorization": f"Bearer {self.doctor_token}"}
            data, error = self.make_request("GET", "/dashboard/stats", headers=headers)
            doctor_success = not error and "pending_cases" in data
            results.append(("Doctor", doctor_success, error or f"Pending: {data.get('pending_cases', 0)}"))
        
        # Test admin dashboard
        if self.admin_token:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            data, error = self.make_request("GET", "/dashboard/stats", headers=headers)
            admin_success = not error and "total_users" in data
            results.append(("Admin", admin_success, error or f"Users: {data.get('total_users', 0)}"))
        
        overall_success = all(success for _, success, _ in results)
        details = " | ".join([f"{role}: {'✓' if success else '✗'}" for role, success, _ in results])
        self.log_test("Dashboard Stats (All Roles)", overall_success, details)
        return overall_success
    
    def run_all_tests(self):
        """Run all tests in sequence"""
        print("=" * 60)
        print("MedScribe Backend API Testing Suite")
        print(f"Testing against: {self.base_url}")
        print("=" * 60)
        print()
        
        # Test sequence following the review request order
        tests = [
            ("Health Check", self.test_health_check),
            ("Register Patient", self.test_register_patient),
            ("Register Doctor", self.test_register_doctor),
            ("Register Admin", self.test_register_admin),
            ("Login Patient", self.test_login_patient),
            ("Patient Submit Case", self.test_patient_submit_case),
            ("Patient Get My Cases", self.test_patient_get_my_cases),
            ("Doctor Get Pending Cases", self.test_doctor_get_pending_cases),
            ("Doctor Lookup Patient", self.test_doctor_lookup_patient),
            ("Doctor Respond to Case", self.test_doctor_respond_to_case),
            ("Get Prescriptions (Patient)", self.test_get_prescriptions_patient),
            ("Medication Search", self.test_medication_search),
            ("Admin Get Users", self.test_admin_get_users),
            ("Admin Get Stats", self.test_admin_get_stats),
            ("Patient Validation", self.test_patient_validation),
            ("Dashboard Stats (All Roles)", self.test_dashboard_stats_all_roles),
        ]
        
        passed = 0
        total = len(tests)
        
        for test_name, test_func in tests:
            try:
                if test_func():
                    passed += 1
            except Exception as e:
                self.log_test(test_name, False, f"Exception: {str(e)}")
        
        print("=" * 60)
        print(f"TEST SUMMARY: {passed}/{total} tests passed")
        print("=" * 60)
        
        # Print failed tests
        failed_tests = [result for result in self.test_results if not result["success"]]
        if failed_tests:
            print("\nFAILED TESTS:")
            for test in failed_tests:
                print(f"❌ {test['test']}: {test['details']}")
        
        return passed, total, failed_tests

if __name__ == "__main__":
    tester = MedScribeAPITester()
    passed, total, failed = tester.run_all_tests()
    
    # Exit with error code if tests failed
    sys.exit(0 if passed == total else 1)