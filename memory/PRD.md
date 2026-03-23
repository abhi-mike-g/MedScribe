# MedScribe - Product Requirements Document

## Overview
MedScribe is an end-to-end encrypted, local-first mobile application for doctor-patient interactions. It features multi-role authentication (Doctor, Patient, Admin), voice-recorded case submissions, AI-powered transcription, and secure prescription management.

## Architecture
- **Frontend**: Expo React Native with expo-router (file-based routing)
- **Backend**: FastAPI with MongoDB
- **Auth**: Custom JWT (multi-role: doctor, patient, admin)
- **AI**: On-device bridges (Whisper-CPP for STT, Phi-3 for LLM) - mocked for web preview
- **Recording**: expo-audio (migrated from expo-av)

## Roles & Portals

### Patient Portal (`(patient-tabs)`)
- **Home**: Dashboard with patient ID, stats, recent cases
- **Record**: Voice record symptoms → editable transcript → submit case
- **Cases**: View all submitted cases and their status
- **Prescriptions**: View/download prescriptions as PDF
- **Settings**: Profile, security info, logout

### Doctor Portal (`(doctor-tabs)`)
- **Dashboard**: Stats, pending cases, recent activity
- **Lookup**: Search patient by PAT-XXXXXX ID (least privilege)
- **Cases**: View/respond to pending cases (remedy/prescription/visit)
- **Medications**: On-device medication database with search
- **Settings**: Profile, specialty, logout

### Admin Portal (`(admin-tabs)`)
- **Overview**: System stats (users, cases, prescriptions)
- **Users**: User management with role filters
- **Settings**: Admin profile, logout

## Key API Endpoints
- `POST /api/auth/register/{role}` - Register user by role
- `POST /api/auth/login` - Login with email/password/role
- `POST /api/cases/submit` - Patient submits case
- `GET /api/cases/my` - Patient's cases
- `GET /api/doctor/pending-cases` - Doctor's case queue
- `GET /api/doctor/lookup/{patient_id}` - Doctor lookups patient
- `PUT /api/cases/{case_id}/respond` - Doctor responds to case
- `GET /api/prescriptions` - List prescriptions
- `GET /api/prescriptions/{rx_id}/pdf` - Download PDF
- `GET /api/medications/search` - Search medication DB
- `GET /api/admin/users` - Admin user management
- `GET /api/admin/stats` - Admin statistics

## Validation Rules
- Patient Name: Alphabetic only (letters, spaces, dots, hyphens)
- Patient Age: Numeric, 0-150
- Patient ID: Auto-generated PAT-XXXXXX (alphanumeric)

## Security
- E2EE indicators throughout the app
- AES-256-GCM encryption status
- JWT tokens with 24h expiration
- Role-based access control on all endpoints
- HIPAA & GDPR compliance indicators

## Current Status
- ✅ Multi-role auth (register/login) - COMPLETE
- ✅ All 3 portals with full tab navigation - COMPLETE
- ✅ Backend API (20+ endpoints) - COMPLETE & TESTED
- ✅ Real audio recording with expo-audio - COMPLETE
- ✅ Real STT with Whisper (faster-whisper on server) - COMPLETE
- ✅ LLM medical extraction with GPT-4.1-mini - COMPLETE
- ✅ Patient case submission with AI data - COMPLETE
- ✅ Doctor case response flow - COMPLETE
- ✅ Prescription generation with PDF - COMPLETE
- ✅ Medication database - COMPLETE
- ✅ Admin dashboard & user management - COMPLETE
- ✅ E2EE infrastructure (RSA key pairs, AES-256-GCM) - COMPLETE
- ✅ Encrypted file attachment upload/download - COMPLETE
- ✅ E2EE key exchange endpoints - COMPLETE
- ✅ Client-side E2EE module (crypto/e2ee.ts) - COMPLETE

## Upcoming
- E2EE file transfer implementation
- Patient photo/document attachments
- Biometric lock
- Multi-device cloud sync
