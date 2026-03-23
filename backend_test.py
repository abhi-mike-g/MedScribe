#!/usr/bin/env python3
"""
MedScribe Backend API Testing - New Audio & E2EE Endpoints
Tests the new audio transcription and E2EE endpoints added to MedScribe.
"""

import requests
import json
import io
import wave
import struct
import base64
import time
from pathlib import Path

# Configuration
BASE_URL = "https://medscribe-multi-role.preview.emergentagent.com/api"
TIMEOUT = 120  # Generous timeout for Whisper model download

def create_test_wav_file():
    """Create a small test WAV file with sine wave audio."""
    sample_rate = 44100
    duration = 2  # 2 seconds
    frequency = 440  # A4 note
    
    # Generate sine wave
    samples = []
    for i in range(int(sample_rate * duration)):
        t = float(i) / sample_rate
        sample = int(32767 * 0.3 * (
            0.5 * (1 + 0.8 * (t % 1.0)) * 
            (1 if (t * frequency) % 1.0 < 0.5 else -1)
        ))
        samples.append(sample)
    
    # Create WAV file in memory
    wav_buffer = io.BytesIO()
    with wave.open(wav_buffer, 'wb') as wav_file:
        wav_file.setnchannels(1)  # Mono
        wav_file.setsampwidth(2)  # 16-bit
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(struct.pack('<' + 'h' * len(samples), *samples))
    
    wav_buffer.seek(0)
    return wav_buffer

def test_patient_registration():
    """Register a test patient and return the token."""
    print("🔐 Testing Patient Registration...")
    
    data = {
        "name": "Audio Test Patient",
        "email": "audiotest@medscribe.com",
        "password": "test123",
        "age": 25,
        "gender": "Female"
    }
    
    response = requests.post(f"{BASE_URL}/auth/register/patient", json=data, timeout=30)
    
    if response.status_code == 200:
        result = response.json()
        print(f"✅ Patient registered successfully: {result['user']['patient_id']}")
        return result['token']
    elif response.status_code == 400 and "already registered" in response.text:
        # Try to login instead
        print("📝 Patient already exists, attempting login...")
        login_data = {
            "email": data["email"],
            "password": data["password"],
            "role": "patient"
        }
        login_response = requests.post(f"{BASE_URL}/auth/login", json=login_data, timeout=30)
        if login_response.status_code == 200:
            result = login_response.json()
            print(f"✅ Patient login successful: {result['user']['patient_id']}")
            return result['token']
        else:
            print(f"❌ Login failed: {login_response.status_code} - {login_response.text}")
            return None
    else:
        print(f"❌ Registration failed: {response.status_code} - {response.text}")
        return None

def test_audio_transcribe(token):
    """Test the audio transcription endpoint."""
    print("\n🎤 Testing Audio Transcription...")
    
    # Create test audio file
    wav_file = create_test_wav_file()
    
    headers = {"Authorization": f"Bearer {token}"}
    files = {"audio": ("test_audio.wav", wav_file, "audio/wav")}
    
    print("📤 Uploading audio file for transcription (this may take time for Whisper model download)...")
    
    try:
        response = requests.post(
            f"{BASE_URL}/audio/transcribe", 
            headers=headers, 
            files=files, 
            timeout=TIMEOUT
        )
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Audio transcription successful!")
            print(f"   📝 Transcript: {result.get('transcript', 'N/A')[:100]}...")
            print(f"   🤖 STT Model: {result.get('stt', {}).get('model', 'N/A')}")
            print(f"   🧠 Extraction: {'✅ Present' if result.get('extraction') else '❌ Missing'}")
            
            if result.get('extraction'):
                extraction = result['extraction']
                print(f"   🏥 Chief Complaint: {extraction.get('chief_complaint', 'N/A')}")
                print(f"   🚨 Urgency: {extraction.get('urgency_level', 'N/A')}")
            
            return True
        else:
            print(f"❌ Audio transcription failed: {response.status_code}")
            print(f"   Error: {response.text}")
            return False
            
    except requests.exceptions.Timeout:
        print("⏰ Audio transcription timed out (Whisper model download may be in progress)")
        return False
    except Exception as e:
        print(f"❌ Audio transcription error: {str(e)}")
        return False

def test_extract_from_text(token):
    """Test the text extraction endpoint."""
    print("\n📄 Testing Text Extraction...")
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    data = {
        "transcript": "Doctor: What brings you in today? Patient: I have been having severe headaches for about a week now, mainly in the morning. Doctor: Any nausea or vomiting? Patient: Yes, I feel nauseous especially when I wake up. Doctor: Have you been taking any medication? Patient: Just some over-the-counter ibuprofen but it hasn't really helped. Doctor: Any history of migraines in your family? Patient: Yes, my mother had chronic migraines. Doctor: I see. Your blood pressure is slightly elevated at 140 over 90. Let me run some tests."
    }
    
    response = requests.post(f"{BASE_URL}/audio/extract-from-text", headers=headers, json=data, timeout=30)
    
    if response.status_code == 200:
        result = response.json()
        extraction = result.get('extraction', {})
        print("✅ Text extraction successful!")
        print(f"   🏥 Chief Complaint: {extraction.get('chief_complaint', 'N/A')}")
        print(f"   🤒 Symptoms: {len(extraction.get('symptoms', []))} found")
        print(f"   💊 Medications: {extraction.get('medications_mentioned', [])}")
        print(f"   🩺 Suggested Diagnosis: {extraction.get('suggested_diagnosis', [])}")
        print(f"   🚨 Urgency: {extraction.get('urgency_level', 'N/A')}")
        return True
    else:
        print(f"❌ Text extraction failed: {response.status_code}")
        print(f"   Error: {response.text}")
        return False

def test_e2ee_register_public_key(token):
    """Test E2EE public key registration."""
    print("\n🔑 Testing E2EE Public Key Registration...")
    
    # Sample RSA public key (for testing only) - properly formatted
    public_key = """-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA6TYbt5gRFaUKWpprB31L
kvC4iiVnkzkwOwt+LjSGBJSBiOig5p06UMzoo4BnhYQzwT2yUe8zZ6hPaMDANsru
gzSjcLa5LgrapCOgR+ds3E7xBOVUJoi9880fcV7gwSvJHEUYZkhtwwx55Mrhjf+Q
40csRrLI7hZBQ7+6n6OaoEtXQgrdfQGNaceFyVc/hBzPhbcU319MowhYSMgCps/Y
syWfeZ39bi97WZKRcaOw9uHKCwDWVztR5CaMT+AqW0vDmD7XPnfg55/epOxLzZd/
xbdsg53aIexCki8wf/eS+sgkSbTbHQNrfOq+BmaQULJNr++0+wmiJksoCV+8Fw7o
IQIDAQAB
-----END PUBLIC KEY-----"""
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    data = {"public_key": public_key}
    
    response = requests.post(f"{BASE_URL}/e2ee/register-public-key", headers=headers, json=data, timeout=30)
    
    if response.status_code == 200:
        result = response.json()
        print("✅ E2EE public key registration successful!")
        print(f"   📝 Status: {result.get('status', 'N/A')}")
        return True
    else:
        print(f"❌ E2EE public key registration failed: {response.status_code}")
        print(f"   Error: {response.text}")
        return False

def test_e2ee_exchange_key(token):
    """Test E2EE key exchange."""
    print("\n🔄 Testing E2EE Key Exchange...")
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    # Test data for key exchange
    data = {
        "recipient_id": "some-user-id",
        "encrypted_aes_key": "dGVzdGVuY3J5cHRlZGtleWRhdGE=",  # base64 encoded test data
        "context_id": "test-case-123"
    }
    
    response = requests.post(f"{BASE_URL}/e2ee/exchange-key", headers=headers, json=data, timeout=30)
    
    if response.status_code == 200:
        result = response.json()
        print("✅ E2EE key exchange successful!")
        print(f"   🆔 Exchange ID: {result.get('exchange_id', 'N/A')}")
        return result.get('exchange_id')
    else:
        print(f"❌ E2EE key exchange failed: {response.status_code}")
        print(f"   Error: {response.text}")
        return None

def test_e2ee_get_my_keys(token):
    """Test getting E2EE keys for current user."""
    print("\n📥 Testing E2EE Get My Keys...")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    response = requests.get(f"{BASE_URL}/e2ee/keys-for-me", headers=headers, timeout=30)
    
    if response.status_code == 200:
        result = response.json()
        print("✅ E2EE get my keys successful!")
        print(f"   📊 Keys found: {len(result)}")
        return True
    else:
        print(f"❌ E2EE get my keys failed: {response.status_code}")
        print(f"   Error: {response.text}")
        return False

def test_encrypted_attachment_upload(token):
    """Test encrypted attachment upload."""
    print("\n📎 Testing Encrypted Attachment Upload...")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Create some test encrypted data
    test_data = b"This is test encrypted file data for MedScribe testing"
    
    files = {"encrypted_data": ("test-scan.jpg.enc", io.BytesIO(test_data), "application/octet-stream")}
    data = {
        "case_id": "test-case-123",
        "file_name": "test-scan.jpg",
        "file_type": "image/jpeg",
        "iv": "dGVzdGl2MTIzNDU2"  # base64 encoded IV
    }
    
    response = requests.post(f"{BASE_URL}/attachments/upload", headers=headers, files=files, data=data, timeout=30)
    
    if response.status_code == 200:
        result = response.json()
        print("✅ Encrypted attachment upload successful!")
        print(f"   🆔 Attachment ID: {result.get('id', 'N/A')}")
        print(f"   📁 File Name: {result.get('file_name', 'N/A')}")
        print(f"   📏 File Size: {result.get('file_size', 'N/A')} bytes")
        print(f"   🔒 Encrypted: {result.get('encrypted', 'N/A')}")
        return result.get('id')
    else:
        print(f"❌ Encrypted attachment upload failed: {response.status_code}")
        print(f"   Error: {response.text}")
        return None

def test_health_check():
    """Test the health check endpoint."""
    print("\n🏥 Testing Health Check...")
    
    response = requests.get(f"{BASE_URL}/health", timeout=30)
    
    if response.status_code == 200:
        result = response.json()
        print("✅ Health check successful!")
        print(f"   📊 Status: {result.get('status', 'N/A')}")
        print(f"   🔒 Encryption: {result.get('encryption', 'N/A')}")
        print(f"   📋 Compliance: {result.get('compliance', [])}")
        print(f"   👥 Roles: {result.get('roles', [])}")
        return True
    else:
        print(f"❌ Health check failed: {response.status_code}")
        print(f"   Error: {response.text}")
        return False

def main():
    """Run all tests for the new MedScribe endpoints."""
    print("🚀 Starting MedScribe New Endpoints Testing")
    print("=" * 60)
    
    results = {}
    
    # Step 1: Register patient and get token
    token = test_patient_registration()
    if not token:
        print("❌ Cannot proceed without patient token")
        return
    
    results['patient_registration'] = True
    
    # Step 2: Test audio transcription
    results['audio_transcribe'] = test_audio_transcribe(token)
    
    # Step 3: Test text extraction
    results['extract_from_text'] = test_extract_from_text(token)
    
    # Step 4: Test E2EE public key registration
    results['e2ee_register_key'] = test_e2ee_register_public_key(token)
    
    # Step 5: Test E2EE key exchange
    exchange_id = test_e2ee_exchange_key(token)
    results['e2ee_exchange_key'] = exchange_id is not None
    
    # Step 6: Test E2EE get my keys
    results['e2ee_get_my_keys'] = test_e2ee_get_my_keys(token)
    
    # Step 7: Test encrypted attachment upload
    attachment_id = test_encrypted_attachment_upload(token)
    results['encrypted_attachment_upload'] = attachment_id is not None
    
    # Step 8: Test health check
    results['health_check'] = test_health_check()
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 TEST RESULTS SUMMARY")
    print("=" * 60)
    
    passed = sum(1 for result in results.values() if result)
    total = len(results)
    
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{test_name.replace('_', ' ').title():<30} {status}")
    
    print("-" * 60)
    print(f"Total: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
    
    if passed == total:
        print("🎉 All tests passed! New endpoints are working correctly.")
    else:
        print("⚠️  Some tests failed. Check the details above.")
    
    return results

if __name__ == "__main__":
    main()