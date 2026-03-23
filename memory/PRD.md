# MedScribe — Product Requirements Document

## Overview
MedScribe is an end-to-end encrypted, local-first mobile application for doctor-patient interactions. It provides secure medical documentation with simulated on-device AI for speech-to-text and medical data extraction.

## Architecture
- **Frontend**: Expo React Native (SDK 54) with Expo Router file-based navigation
- **Backend**: FastAPI (Python) with MongoDB
- **Auth**: JWT-based custom authentication with bcrypt password hashing
- **AI**: Simulated on-device inference (whisper-cpp-base.en for STT, phi-3-mini-4k-q4 for LLM)
- **Security**: E2EE indicators (AES-256-GCM), HIPAA/GDPR compliance markers

## Features Implemented (MVP)

### Core
1. **JWT Authentication** — Register/login for doctors with specialty and license number
2. **Patient Management** — CRUD operations with encryption status indicators
3. **Consultation Sessions** — Create consultations, simulate STT recording with animated mic, extract medical data
4. **Prescription Generator** — Create prescriptions with multiple medications, JSON/PDF output
5. **Medication Explainability** — 8 drug database with mechanism, uses, side effects, interactions, contraindications
6. **Dashboard** — Stats overview, recent consultations, quick actions, E2EE + compliance banners

### Security
- E2EE badges on all patient data screens
- AES-256-GCM encryption status indicators
- HIPAA/GDPR compliance badges in settings
- Android Keystore System reference
- Biometric lock UI placeholder

### Simulated On-Device AI
- Whisper-CPP STT simulation with typing animation
- Phi-3 LLM medical data extraction simulation
- Processing time, confidence scores, hardware acceleration info
- NNAPI + GPU Delegate status indicators

## API Endpoints
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth/register | Doctor registration |
| POST | /api/auth/login | Doctor login |
| GET | /api/auth/me | Get current user |
| GET/POST | /api/patients | List/create patients |
| GET/PUT/DELETE | /api/patients/:id | Patient CRUD |
| GET/POST | /api/consultations | List/create consultations |
| GET/PUT | /api/consultations/:id | Consultation detail/update |
| POST | /api/ai/transcribe | Simulated STT |
| POST | /api/ai/extract-medical-data | Simulated medical LLM |
| GET/POST | /api/prescriptions | List/create prescriptions |
| GET | /api/prescriptions/:id | Prescription detail |
| GET | /api/prescriptions/:id/pdf | PDF download |
| GET | /api/medications/search | Search medications |
| GET | /api/medications/:name/explain | Drug explainability |
| GET | /api/dashboard/stats | Dashboard statistics |

## Database Collections
- `users` — Doctor accounts
- `patients` — Patient records (with encryption_status)
- `consultations` — Consultation sessions with transcripts and extracted data
- `prescriptions` — Generated prescriptions

## Tech Stack
- React Native 0.81 / Expo SDK 54
- FastAPI / Motor (async MongoDB)
- lucide-react-native icons
- reportlab (PDF generation)
- bcrypt/PyJWT (auth)

## Note on AI
All AI features use the **Native AI Bridge Architecture** (`/src/native/`):
- **WhisperBridge.ts** — STT interface with mock fallback for web preview
- **Phi3Bridge.ts** — Medical LLM interface with intelligent transcript parsing mock
- **NativeAIProvider.ts** — Unified orchestrator with platform detection

On web preview: Uses intelligent mock that parses transcript text to extract symptoms, vitals, medications, and ICD codes. On physical Android device: Routes through native JNI bridge to actual Whisper-CPP and Phi-3 ONNX Runtime inference.

### Audio Recording
- Uses `expo-av` for real microphone recording with permission handling
- Falls back gracefully on web preview when actual mic access isn't available
- Transcripts are **editable** after STT processing — doctors can fix any errors before extraction
- `app.json` declares `RECORD_AUDIO` (Android) and `NSMicrophoneUsageDescription` (iOS) permissions

## Business Enhancement
Consider adding a **subscription tier** for multi-device sync with encrypted cloud backup — doctors get local-first by default (free), and can opt into HIPAA-compliant encrypted sync across devices for a monthly fee.
