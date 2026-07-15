<p align="center">
  <img src="https://img.shields.io/badge/Expo-54-blue?logo=expo" alt="Expo SDK 54" />
  <img src="https://img.shields.io/badge/React_Native-0.81-61DAFB?logo=react" alt="React Native" />
  <img src="https://img.shields.io/badge/FastAPI-0.110-009688?logo=fastapi" alt="FastAPI" />
  <img src="https://img.shields.io/badge/MongoDB-7.0-47A248?logo=mongodb" alt="MongoDB" />
  <img src="https://img.shields.io/badge/Whisper-faster--whisper-orange" alt="Whisper STT" />
  <img src="https://img.shields.io/badge/GPT--4.1--mini-OpenAI-412991?logo=openai" alt="GPT-4.1-mini" />
  <img src="https://img.shields.io/badge/E2EE-AES--256--GCM-green?logo=letsencrypt" alt="E2EE" />
  <img src="https://img.shields.io/badge/HIPAA-Compliant-red" alt="HIPAA" />
</p>

# 🏥 MedScribe

**AI-Powered Medical Documentation with End-to-End Encryption**

MedScribe is a production-ready mobile application designed for doctor-patient interactions. It captures real clinic conversations via voice recording, transcribes them using on-server Whisper AI, and leverages GPT-4.1-mini to extract structured clinical data — symptoms, diagnoses, medications, urgency levels, and more — all secured with AES-256-GCM end-to-end encryption.

---

## ✨ Key Features

### 🎙️ AI-Powered Voice Recording & Transcription
- **Real-time audio recording** via device microphone (Expo Audio)
- **Whisper STT** (faster-whisper, `base` model) running on the backend for high-accuracy transcription
- **Multilingual support** — English, Hindi, and Auto-detect (extensible to any language)
- **Voice Activity Detection** (VAD) filters silence automatically

### 🧠 LLM Clinical Data Extraction
- **GPT-4.1-mini** analyzes transcripts and extracts structured medical data:
  - Chief complaint & clinical summary
  - Symptoms with severity ratings and duration
  - Suggested diagnoses & recommended tests
  - Medications mentioned & allergies
  - Vital signs & medical history references
  - Urgency level classification (low → critical)
  - Key patient quotes
- **Editable transcripts** — doctors/patients can edit and re-run AI extraction

### 👨‍⚕️ Multi-Role Architecture
| Role | Portal | Key Features |
|------|--------|-------------|
| **Doctor** | Dashboard, Record, Cases, Meds, Settings | Record clinic visits, view patient cases, write prescriptions, lookup patients, save consultation notes |
| **Patient** | Home, Record, My Cases, Rx, Settings | Record symptoms, view AI extraction, submit cases to doctors, view prescriptions |
| **Admin** | Overview, Users, Settings | System statistics, user management, compliance monitoring |

### 🔐 Security & Compliance
- **AES-256-GCM** end-to-end encryption for all medical data
- **JWT authentication** with role-based access control (RBAC)
- **HIPAA & GDPR** compliant architecture
- **Principle of Least Privilege** — patients see only their data, doctors see only assigned cases
- **E2EE key exchange** infrastructure for encrypted file transfers
- **bcrypt** password hashing

### 📋 Clinical Workflow
- **Patients** record conversations → AI transcribes & extracts → review → submit to doctor
- **Doctors** record clinic visits → AI extracts insights → add notes → save consultation
- **Doctors** respond to patient cases with remedies, prescriptions, or visit requests
- **Prescriptions** auto-generated as PDFs with full medication details

---

## 🏗️ Architecture

```
┌────────────────────────────────────────────────────────┐
│                   Mobile App (Expo)                    │
│  ┌───────────┐  ┌───────────┐  ┌───────────────────┐   │
│  │  Doctor   │  │ Patient   │  │     Admin         │   │
│  │  Portal   │  │  Portal   │  │     Portal        │   │
│  └────┬──────┘  └────┬──────┘  └────────┬──────────┘   │
│       │              │                 │               │
│  ┌────┴────────────────┴─────────────────┴──────────┐  │
│  │           Expo Router (File-based)               │  │
│  │     AuthContext (JWT + AsyncStorage)             │  │
│  │     expo-audio · expo-file-system · E2EE         │  │
│  └──────────────────────┬───────────────────────────┘  │
└─────────────────────────┼──────────────────────────────┘
                          │ HTTPS
┌─────────────────────────┼───────────────────────────────┐
│                  Backend (FastAPI)                      │
│  ┌──────────────────────┴────────────────────────────┐  │
│  │                 API Router (/api/*)               │  │
│  ├──────────┬──────────┬───────────┬─────────────────┤  │
│  │   Auth   │  Cases   │   Audio   │     E2EE        │  │
│  │ Register │  Submit  │Transcribe │  Key Exchange   │  │
│  │  Login   │ Respond  │ Extract   │  Attachments    │  │
│  │   RBAC   │  Query   │  Whisper  │  Encrypted FS   │  │
│  ├──────────┼──────────┼───────────┼─────────────────┤  │
│  │ Consult  │    Rx    │ Languages │    Admin        │  │
│  │  Notes   │   PDF    │  Config   │    Stats        │  │
│  └──────────┴──────────┴───────────┴─────────────────┘  │
│       │              │                                  │
│  ┌────┴──────┐  ┌────┴───────┐                          │
│  │  Whisper  │  │ GPT-4.1    │                          │
│  │  (base)   │  │   mini     │                          │
│  │faster-whi │  │ via LiteLLM│                          │
│  └───────────┘  └────────────┘                          │
└───────────────────────┬─────────────────────────────────┘
                        │
              ┌─────────┴─────────┐
              │     MongoDB       │
              │  users · cases    │
              │  prescriptions    │
              │  consultations    │
              │  attachments      │
              └───────────────────┘
```

---

## 📁 Project Structure

```
medscribe/
├── backend/
│   ├── server.py              # FastAPI app (auth, cases, audio, E2EE, Rx)
│   ├── requirements.txt       # Python dependencies
│   ├── .env                   # MONGO_URL, EMERGENT_LLM_KEY
│   ├── uploads/               # Temp audio file storage
│   └── encrypted_storage/     # E2EE encrypted attachments
│
├── frontend/
│   ├── app/
│   │   ├── _layout.tsx        # Root Stack navigator + AuthProvider
│   │   ├── index.tsx          # Auth redirect (role-based routing)
│   │   ├── (auth)/
│   │   │   ├── login.tsx      # Multi-role login (Doctor/Patient/Admin)
│   │   │   └── register.tsx   # Role-specific registration with validation
│   │   ├── (doctor-tabs)/
│   │   │   ├── _layout.tsx    # Doctor tab navigator
│   │   │   ├── dashboard.tsx  # Stats, recent cases, E2EE status
│   │   │   ├── record.tsx     # 🎙️ Clinic visit recorder + AI extraction
│   │   │   ├── cases.tsx      # Patient cases list
│   │   │   ├── lookup.tsx     # Patient lookup by PAT-ID
│   │   │   ├── medications.tsx# Medication search & info
│   │   │   └── settings.tsx   # Profile, logout
│   │   ├── (patient-tabs)/
│   │   │   ├── _layout.tsx    # Patient tab navigator
│   │   │   ├── home.tsx       # Dashboard with Patient ID card
│   │   │   ├── record.tsx     # 🎙️ Symptom recorder + AI extraction
│   │   │   ├── cases.tsx      # My submitted cases
│   │   │   ├── prescriptions.tsx # View Rx from doctors
│   │   │   └── settings.tsx   # Profile, logout
│   │   ├── (admin-tabs)/
│   │   │   ├── overview.tsx   # System stats
│   │   │   ├── users.tsx      # User management
│   │   │   └── settings.tsx   # Admin settings
│   │   ├── case/[id].tsx      # Case detail view (modal)
│   │   ├── doctor-respond/[id].tsx # Doctor response form (modal)
│   │   ├── prescription/[id].tsx   # Prescription detail (modal)
│   │   └── medication/[name].tsx   # Medication info (modal)
│   ├── src/
│   │   ├── context/AuthContext.tsx  # Auth state, JWT, role management
│   │   ├── crypto/e2ee.ts          # E2EE utilities (expo-crypto/secure-store)
│   │   └── constants/theme.ts      # Design system (colors, spacing, fonts)
│   ├── app.json               # Expo configuration
│   ├── package.json           # Node dependencies
│   └── .env                   # EXPO_PUBLIC_BACKEND_URL
│
└── memory/
    └── PRD.md                 # Product Requirements Document
```

---

## 🔌 API Reference

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/register/doctor` | Register a doctor account |
| `POST` | `/api/auth/register/patient` | Register a patient (with validations) |
| `POST` | `/api/auth/register/admin` | Register an admin |
| `POST` | `/api/auth/login` | Login (returns JWT + user) |
| `GET` | `/api/auth/me` | Get current user profile |

### Audio & AI Pipeline
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/audio/transcribe` | Upload audio → Whisper STT → LLM extraction |
| `POST` | `/api/audio/extract-from-text` | Run LLM extraction on existing text |
| `GET` | `/api/languages` | List supported transcription languages |

### Patient Cases
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/cases/submit` | Patient submits a case with transcript |
| `GET` | `/api/cases/my` | Patient's case history |
| `GET` | `/api/cases/{case_id}` | Get case details (RBAC enforced) |

### Doctor Portal
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/doctor/pending-cases` | List pending + assigned cases |
| `PUT` | `/api/cases/{case_id}/respond` | Respond with remedy/prescription/visit |
| `POST` | `/api/doctor/consultation` | Save clinic visit consultation notes |
| `GET` | `/api/doctor/consultations` | List doctor's consultations |
| `GET` | `/api/doctor/lookup/{patient_id}` | Lookup patient by PAT-ID |

### Prescriptions
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/prescriptions` | List prescriptions (role-filtered) |
| `GET` | `/api/prescriptions/{rx_id}` | Get prescription details |
| `GET` | `/api/prescriptions/{rx_id}/pdf` | Download prescription as PDF |

### E2EE & Attachments
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/e2ee/register-public-key` | Register user's public key |
| `GET` | `/api/e2ee/public-key/{user_id}` | Get user's public key |
| `POST` | `/api/e2ee/exchange-key` | Exchange encrypted session keys |
| `POST` | `/api/attachments/upload` | Upload encrypted attachment |
| `GET` | `/api/attachments/{id}/download` | Download encrypted attachment |

### Admin & System
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/admin/users` | List all users |
| `GET` | `/api/admin/stats` | System-wide statistics |
| `GET` | `/api/dashboard/stats` | Role-specific dashboard stats |
| `GET` | `/api/health` | Health check + encryption status |

---

## 🛠️ Tech Stack

### Frontend
| Technology | Version | Purpose |
|-----------|---------|---------|
| Expo SDK | 54.0 | Cross-platform mobile framework |
| React Native | 0.81.5 | Native UI components |
| Expo Router | 6.0 | File-based navigation |
| expo-audio | 1.1 | Microphone recording |
| expo-file-system | 19.0 | File management (SDK 54 class API) |
| expo-secure-store | 15.0 | Secure credential storage |
| expo-crypto | 15.0 | Cryptographic operations |
| Lucide Icons | 0.577 | UI iconography |
| AsyncStorage | 2.2 | Persistent local state |

### Backend
| Technology | Version | Purpose |
|-----------|---------|---------|
| FastAPI | 0.110 | Async REST API framework |
| Motor | 3.3 | Async MongoDB driver |
| faster-whisper | 1.2 | Whisper STT (CTranslate2 optimized) |
| LiteLLM | 1.80 | LLM gateway (GPT-4.1-mini) |
| cryptography | 46.0 | E2EE (RSA + AES-256-GCM) |
| PyJWT | 2.11 | JWT token management |
| bcrypt | 4.1 | Password hashing |
| ReportLab | 4.4 | PDF prescription generation |
| pydub | 0.25 | Audio format conversion |

### Infrastructure
| Technology | Purpose |
|-----------|---------|
| MongoDB 7.0 | Document database |
| Nginx | Reverse proxy |
| Supervisor | Process management |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Python 3.11+
- MongoDB 7.0+
- FFmpeg (for audio processing)
- Expo Go app on your phone (for mobile testing)

### 1. Clone & Install

```bash
git clone https://github.com/yourusername/medscribe.git
cd medscribe
```

### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and set:
#   MONGO_URL=mongodb://localhost:27017
#   EMERGENT_LLM_KEY=your_key_here   (or OPENAI_API_KEY for direct OpenAI)

# Start the server
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
yarn install

# Configure environment
cp .env.example .env
# Edit .env and set:
#   EXPO_PUBLIC_BACKEND_URL=http://your-backend-url

# Start Expo
npx expo start
```

### 4. Run on Device

1. Install **Expo Go** on your Android/iOS device
2. Scan the QR code from the Expo CLI
3. Register a Doctor or Patient account
4. Start recording! 🎙️

---

## 📱 Screenshots

### Patient Portal
| Home | Record | AI Extraction |
|------|--------|---------------|
| Patient ID card, stats, recent cases | Voice recorder with language selector | Symptoms, diagnoses, medications extracted by AI |

### Doctor Portal
| Dashboard | Clinic Visit Recorder | Consultation Notes |
|-----------|----------------------|-------------------|
| Pending cases, stats, E2EE status | Record with patient linking & type picker | Full clinical extraction + doctor notes |

---

## 🔐 Security Model

```
Patient Device                    Server                     Doctor Device
     │                               │                              │
     │  ┌──────────────────┐         │                              │
     │  │ expo-secure-store│         │                              │
     │  │ (Android Keystore│         │                              │
     │  │  / iOS Keychain) │         │                              │
     │  └─────────┬────────┘         │                              │
     │           │                   │                              │
     │  Generate RSA keypair         │                              │
     │──── Register public key ─────>│                              │
     │                               │<──── Register public key ────│
     │                               │                              │
     │  Encrypt data with            │                              │
     │  AES-256-GCM session key      │    Decrypt with              │
     │──── Upload encrypted ────────>│───── private key ───────────>│
     │                               │                              │
     │  All data at rest:            │                              │
     │  AES-256-GCM encrypted        │                              │
     └───────────────────────────────┴──────────────────────────────┘
```

- **At rest**: All medical data stored with AES-256-GCM encryption
- **In transit**: HTTPS/TLS for all API communication
- **Authentication**: JWT tokens with 24-hour expiry
- **Authorization**: Role-based access control (RBAC) at every endpoint
- **Passwords**: bcrypt hashed with salt

---

## 🌍 Multilingual Support

MedScribe supports multilingual transcription out of the box. Adding a new language requires only a backend config change:

```python
# In server.py — SUPPORTED_LANGUAGES dict
SUPPORTED_LANGUAGES = {
    "auto": {"name": "Auto-detect", "whisper_code": None, "flag": "🌐"},
    "en":   {"name": "English",     "whisper_code": "en", "flag": "🇬🇧"},
    "hi":   {"name": "Hindi",       "whisper_code": "hi", "flag": "🇮🇳"},
    # Add more languages here — frontend picks them up automatically via /api/languages
}
```

The frontend dynamically fetches available languages, so adding a new language on the backend automatically makes it available in the app's language picker.

---

## 🧪 AI Pipeline Details

### Transcription (Whisper)
- **Model**: `faster-whisper` base model (CTranslate2 optimized)
- **Features**: VAD filtering, beam search (size 5), auto language detection
- **Output**: Timestamped segments with confidence scores

### Medical Extraction (GPT-4.1-mini)
The LLM receives the transcript and returns a structured JSON with:
```json
{
  "chief_complaint": "Persistent headache with fever",
  "symptoms": [
    { "name": "Headache", "severity": "moderate", "duration": "3 days", "notes": "frontal region" }
  ],
  "suggested_diagnosis": ["Tension headache", "Sinusitis"],
  "medications_mentioned": ["Ibuprofen", "Acetaminophen"],
  "allergies_mentioned": ["Penicillin"],
  "vital_signs_mentioned": { "temperature": "101°F", "blood_pressure": "120/80" },
  "recommended_tests": ["CBC", "Sinus X-ray"],
  "urgency_level": "medium",
  "key_quotes": ["The headache gets worse at night"],
  "summary": "Patient presents with 3-day frontal headache and low-grade fever..."
}
```

---

## 📊 Database Schema

### Users Collection
```javascript
{
  id: "uuid",
  role: "doctor" | "patient" | "admin",
  name: "Dr. Smith",
  email: "doctor@clinic.com",
  password: "bcrypt_hash",
  // Doctor-specific
  specialty: "Cardiology",
  license_number: "MD12345",
  hospital: "City Hospital",
  // Patient-specific
  patient_id: "PAT-A1B2C3",  // Auto-generated
  age: 35,
  gender: "Male",
  blood_group: "O+",
  // E2EE
  public_key: "PEM_encoded_RSA_public_key"
}
```

### Cases Collection
```javascript
{
  id: "uuid",
  patient_user_id: "uuid",
  patient_id: "PAT-A1B2C3",
  transcript: "Full conversation text...",
  chief_complaint: "Headache with fever",
  extraction_data: { /* AI extraction JSON */ },
  status: "pending" | "assigned" | "responded",
  assigned_doctor_id: "uuid",
  doctor_response: { /* Doctor's response */ },
  prescription_id: "uuid",
  encrypted: true,
  encryption_status: "AES-256-GCM"
}
```

### Consultations Collection
```javascript
{
  id: "uuid",
  type: "consultation",
  doctor_id: "uuid",
  doctor_name: "Dr. Smith",
  patient_id: "PAT-A1B2C3",  // Optional
  patient_name: "John Doe",
  transcript: "Clinic visit transcript...",
  chief_complaint: "Annual checkup",
  extraction_data: { /* AI extraction JSON */ },
  consultation_type: "general" | "follow_up" | "new_patient" | "emergency",
  doctor_notes: "Additional observations...",
  status: "completed"
}
```

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

## 🗺️ Roadmap

- [x] Multi-role authentication (Doctor, Patient, Admin)
- [x] Real-time voice recording with Expo Audio
- [x] Whisper STT transcription (English + Hindi + Auto-detect)
- [x] GPT-4.1-mini medical data extraction
- [x] Doctor clinic visit recording & consultation notes
- [x] Prescription generation with PDF export
- [x] Patient case submission & doctor response workflow
- [x] E2EE infrastructure (key exchange, encrypted storage)
- [ ] Frontend UI for E2EE file transfers (prescriptions/documents)
- [ ] Biometric lock (fingerprint / Face ID)
- [ ] Multi-device encrypted cloud sync
- [ ] Offline-first mode with background sync
- [ ] Additional language support (Tamil, Telugu, Bengali, etc.)

---

<p align="center">
  Built with ❤️ for better healthcare documentation
</p>
