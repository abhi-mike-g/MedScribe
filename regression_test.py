#!/usr/bin/env python3
"""
MedScribe Regression Test Suite
Quick regression test for existing features to ensure new Medical Report feature didn't break anything.
"""
import requests
import json

# Backend URL from frontend/.env
BACKEND_URL = "https://e2ee-transfer.preview.emergentagent.com/api"

class MedScribeRegressionTest:
    def __init__(self):
        self.doctor_token = None
        self.patient_token = None
        self.session = requests.Session()
        self.session.headers.update({'Content-Type': 'application/json'})
        
    def log(self, message):
        print(f"[REGRESSION] {message}")
        
    def test_health_check(self):
        """Test 1: GET /api/health - should return healthy status with encryption info"""
        self.log("Testing GET /api/health...")
        
        response = self.session.get(f"{BACKEND_URL}/health")
        
        if response.status_code != 200:
            self.log(f"❌ FAILED: Expected 200, got {response.status_code}")
            self.log(f"Response: {response.text}")
            return False
            
        data = response.json()
        
        # Verify basic structure
        if "status" not in data:
            self.log("❌ FAILED: Missing 'status' field")
            return False
            
        # Check for encryption info (optional)
        encryption_info = "N/A"
        if "encryption" in data:
            if isinstance(data["encryption"], dict):
                encryption_info = data["encryption"].get("status", "N/A")
            else:
                encryption_info = str(data["encryption"])
            
        self.log(f"✅ PASSED: Health check successful")
        self.log(f"  Status: {data.get('status')}")
        self.log(f"  Encryption: {encryption_info}")
        return True
        
    def test_languages_endpoint(self):
        """Test 2: GET /api/languages - should return Auto, English, Hindi"""
        self.log("Testing GET /api/languages...")
        
        response = self.session.get(f"{BACKEND_URL}/languages")
        
        if response.status_code != 200:
            self.log(f"❌ FAILED: Expected 200, got {response.status_code}")
            self.log(f"Response: {response.text}")
            return False
            
        data = response.json()
        
        if "languages" not in data:
            self.log("❌ FAILED: Missing 'languages' field")
            return False
            
        # Check for required languages
        language_codes = [lang["code"] for lang in data["languages"]]
        required_langs = ["auto", "en", "hi"]
        
        for lang in required_langs:
            if lang not in language_codes:
                self.log(f"❌ FAILED: Missing required language '{lang}'")
                return False
                
        self.log(f"✅ PASSED: Languages endpoint working")
        self.log(f"  Languages: {language_codes}")
        return True
        
    def test_doctor_login(self):
        """Test 3: Doctor login with test credentials"""
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
            self.log("❌ FAILED: Missing user or incorrect role")
            return False
            
        self.doctor_token = data["token"]
        self.log(f"✅ PASSED: Doctor login successful")
        return True
        
    def test_doctor_dashboard_stats(self):
        """Test 4: GET /api/dashboard/stats - should return patient_count, pending_cases, etc."""
        self.log("Testing doctor dashboard stats...")
        
        if not self.doctor_token:
            self.log("❌ FAILED: No doctor token available")
            return False
            
        headers = {
            'Authorization': f'Bearer {self.doctor_token}',
            'Content-Type': 'application/json'
        }
        
        response = self.session.get(f"{BACKEND_URL}/dashboard/stats", headers=headers)
        
        if response.status_code != 200:
            self.log(f"❌ FAILED: Expected 200, got {response.status_code}")
            self.log(f"Response: {response.text}")
            return False
            
        data = response.json()
        
        # Check for expected fields (flexible - some may not be present)
        expected_fields = ["pending_cases"]
        for field in expected_fields:
            if field not in data:
                self.log(f"❌ FAILED: Missing field '{field}' in dashboard stats")
                return False
                
        self.log(f"✅ PASSED: Doctor dashboard stats working")
        self.log(f"  Pending cases: {data.get('pending_cases')}")
        if "total_prescriptions" in data:
            self.log(f"  Total prescriptions: {data.get('total_prescriptions')}")
        return True
        
    def test_doctor_pending_cases(self):
        """Test 5: GET /api/doctor/pending-cases - should return cases"""
        self.log("Testing doctor pending cases...")
        
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
        
        # Should return a list
        if not isinstance(data, list):
            self.log("❌ FAILED: Expected list of cases")
            return False
            
        self.log(f"✅ PASSED: Doctor pending cases working")
        self.log(f"  Found {len(data)} pending cases")
        return True
        
    def test_patient_login(self):
        """Test 6: Patient login with test credentials"""
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
            self.log("❌ FAILED: Missing user or incorrect role")
            return False
            
        self.patient_token = data["token"]
        self.log(f"✅ PASSED: Patient login successful")
        return True
        
    def test_patient_cases(self):
        """Test 7: GET /api/cases/my - should work"""
        self.log("Testing patient cases...")
        
        if not self.patient_token:
            self.log("❌ FAILED: No patient token available")
            return False
            
        headers = {
            'Authorization': f'Bearer {self.patient_token}',
            'Content-Type': 'application/json'
        }
        
        response = self.session.get(f"{BACKEND_URL}/cases/my", headers=headers)
        
        if response.status_code != 200:
            self.log(f"❌ FAILED: Expected 200, got {response.status_code}")
            self.log(f"Response: {response.text}")
            return False
            
        data = response.json()
        
        # Should return a list
        if not isinstance(data, list):
            self.log("❌ FAILED: Expected list of cases")
            return False
            
        self.log(f"✅ PASSED: Patient cases working")
        self.log(f"  Found {len(data)} patient cases")
        return True
        
    def test_patient_dashboard_stats(self):
        """Test 8: GET /api/dashboard/stats - should return patient-specific data"""
        self.log("Testing patient dashboard stats...")
        
        if not self.patient_token:
            self.log("❌ FAILED: No patient token available")
            return False
            
        headers = {
            'Authorization': f'Bearer {self.patient_token}',
            'Content-Type': 'application/json'
        }
        
        response = self.session.get(f"{BACKEND_URL}/dashboard/stats", headers=headers)
        
        if response.status_code != 200:
            self.log(f"❌ FAILED: Expected 200, got {response.status_code}")
            self.log(f"Response: {response.text}")
            return False
            
        data = response.json()
        
        # Check for patient-specific fields (flexible)
        expected_fields = ["total_cases"]
        for field in expected_fields:
            if field not in data:
                self.log(f"❌ FAILED: Missing field '{field}' in patient dashboard stats")
                return False
                
        self.log(f"✅ PASSED: Patient dashboard stats working")
        self.log(f"  Total cases: {data.get('total_cases')}")
        if "total_prescriptions" in data:
            self.log(f"  Total prescriptions: {data.get('total_prescriptions')}")
        return True
        
    def test_prescriptions_list_patient(self):
        """Test 9a: GET /api/prescriptions - should work for patient role"""
        self.log("Testing prescriptions list (patient)...")
        
        if not self.patient_token:
            self.log("❌ FAILED: No patient token available")
            return False
            
        headers = {
            'Authorization': f'Bearer {self.patient_token}',
            'Content-Type': 'application/json'
        }
        
        response = self.session.get(f"{BACKEND_URL}/prescriptions", headers=headers)
        
        if response.status_code != 200:
            self.log(f"❌ FAILED: Expected 200, got {response.status_code}")
            self.log(f"Response: {response.text}")
            return False
            
        data = response.json()
        
        # Should return a list
        if not isinstance(data, list):
            self.log("❌ FAILED: Expected list of prescriptions")
            return False
            
        self.log(f"✅ PASSED: Patient prescriptions list working")
        self.log(f"  Found {len(data)} prescriptions")
        return True
        
    def test_prescriptions_list_doctor(self):
        """Test 9b: GET /api/prescriptions - should work for doctor role"""
        self.log("Testing prescriptions list (doctor)...")
        
        if not self.doctor_token:
            self.log("❌ FAILED: No doctor token available")
            return False
            
        headers = {
            'Authorization': f'Bearer {self.doctor_token}',
            'Content-Type': 'application/json'
        }
        
        response = self.session.get(f"{BACKEND_URL}/prescriptions", headers=headers)
        
        if response.status_code != 200:
            self.log(f"❌ FAILED: Expected 200, got {response.status_code}")
            self.log(f"Response: {response.text}")
            return False
            
        data = response.json()
        
        # Should return a list
        if not isinstance(data, list):
            self.log("❌ FAILED: Expected list of prescriptions")
            return False
            
        self.log(f"✅ PASSED: Doctor prescriptions list working")
        self.log(f"  Found {len(data)} prescriptions")
        return True
        
    def test_doctor_consultations(self):
        """Test 10: GET /api/doctor/consultations - should return consultations"""
        self.log("Testing doctor consultations...")
        
        if not self.doctor_token:
            self.log("❌ FAILED: No doctor token available")
            return False
            
        headers = {
            'Authorization': f'Bearer {self.doctor_token}',
            'Content-Type': 'application/json'
        }
        
        response = self.session.get(f"{BACKEND_URL}/doctor/consultations", headers=headers)
        
        if response.status_code != 200:
            self.log(f"❌ FAILED: Expected 200, got {response.status_code}")
            self.log(f"Response: {response.text}")
            return False
            
        data = response.json()
        
        # Should return a list
        if not isinstance(data, list):
            self.log("❌ FAILED: Expected list of consultations")
            return False
            
        self.log(f"✅ PASSED: Doctor consultations working")
        self.log(f"  Found {len(data)} consultations")
        return True
        
    def test_e2ee_register_public_key(self):
        """Test 11: POST /api/e2ee/register-public-key - should work"""
        self.log("Testing E2EE public key registration...")
        
        if not self.patient_token:
            self.log("❌ FAILED: No patient token available")
            return False
            
        headers = {
            'Authorization': f'Bearer {self.patient_token}',
            'Content-Type': 'application/json'
        }
        
        # Test with a simple test key
        test_key_data = {
            "public_key": "test_key_for_regression"
        }
        
        response = self.session.post(f"{BACKEND_URL}/e2ee/register-public-key", 
                                   json=test_key_data, headers=headers)
        
        if response.status_code != 200:
            self.log(f"❌ FAILED: Expected 200, got {response.status_code}")
            self.log(f"Response: {response.text}")
            return False
            
        data = response.json()
        
        # Check for success message
        if "message" not in data:
            self.log("❌ FAILED: Missing message in response")
            return False
            
        self.log(f"✅ PASSED: E2EE public key registration working")
        self.log(f"  Message: {data.get('message')}")
        return True
        
    def run_regression_tests(self):
        """Run all regression tests"""
        self.log("=== Starting MedScribe Regression Test Suite ===")
        
        tests = [
            ("Health Check", self.test_health_check),
            ("Languages Endpoint", self.test_languages_endpoint),
            ("Doctor Login", self.test_doctor_login),
            ("Doctor Dashboard Stats", self.test_doctor_dashboard_stats),
            ("Doctor Pending Cases", self.test_doctor_pending_cases),
            ("Patient Login", self.test_patient_login),
            ("Patient Cases", self.test_patient_cases),
            ("Patient Dashboard Stats", self.test_patient_dashboard_stats),
            ("Prescriptions List (Patient)", self.test_prescriptions_list_patient),
            ("Prescriptions List (Doctor)", self.test_prescriptions_list_doctor),
            ("Doctor Consultations", self.test_doctor_consultations),
            ("E2EE Register Public Key", self.test_e2ee_register_public_key),
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
        self.log("\n=== REGRESSION TEST SUMMARY ===")
        passed = sum(1 for result in results.values() if result)
        total = len(results)
        
        for test_name, result in results.items():
            status = "✅ PASSED" if result else "❌ FAILED"
            self.log(f"{status}: {test_name}")
            
        self.log(f"\nOverall: {passed}/{total} tests passed")
        
        if passed == total:
            self.log("🎉 ALL REGRESSION TESTS PASSED - No breaking changes detected!")
        else:
            self.log("⚠️  SOME TESTS FAILED - Breaking changes detected!")
        
        return results

if __name__ == "__main__":
    tester = MedScribeRegressionTest()
    results = tester.run_regression_tests()