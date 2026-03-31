"""Application configuration, constants, and shared data."""
import os, uuid
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

JWT_SECRET = os.environ.get('JWT_SECRET', str(uuid.uuid4()))
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')

# ============== MULTILINGUAL SUPPORT ==============
SUPPORTED_LANGUAGES = {
    "auto": {"name": "Auto-detect", "whisper_code": None, "flag": "\U0001f310"},
    "en": {"name": "English", "whisper_code": "en", "flag": "\U0001f1ec\U0001f1e7"},
    "hi": {"name": "Hindi", "whisper_code": "hi", "flag": "\U0001f1ee\U0001f1f3"},
}

WHISPER_MODEL_SIZE = "base"

# ============== MEDICATION DATABASE ==============
MEDICATION_DATABASE = {
    "ibuprofen": {"name":"Ibuprofen","class":"NSAID","mechanism":"Inhibits COX-1/COX-2, reducing prostaglandin synthesis.","common_uses":["Pain","Fever","Inflammation","Arthritis"],"dosage_range":"200-800mg q4-6h","side_effects":["GI upset","Nausea","Dizziness","Bleeding risk"],"contraindications":["GI bleeding","Renal impairment","3rd trimester"],"interactions":["Aspirin","Warfarin","ACE inhibitors"],"pregnancy_category":"C/D"},
    "metformin": {"name":"Metformin","class":"Biguanide","mechanism":"Decreases hepatic glucose, increases insulin sensitivity.","common_uses":["Type 2 DM","PCOS"],"dosage_range":"500-2550mg daily","side_effects":["GI disturbance","Nausea","Lactic acidosis(rare)"],"contraindications":["Renal failure","Metabolic acidosis"],"interactions":["Alcohol","Contrast dye"],"pregnancy_category":"B"},
    "amoxicillin": {"name":"Amoxicillin","class":"Penicillin Antibiotic","mechanism":"Inhibits bacterial cell wall synthesis.","common_uses":["Bacterial infections","Sinusitis","UTI"],"dosage_range":"250-500mg q8h","side_effects":["Diarrhea","Nausea","Rash"],"contraindications":["Penicillin allergy"],"interactions":["Warfarin","Methotrexate"],"pregnancy_category":"B"},
    "lisinopril": {"name":"Lisinopril","class":"ACE Inhibitor","mechanism":"Inhibits ACE, causing vasodilation.","common_uses":["Hypertension","Heart failure"],"dosage_range":"5-40mg daily","side_effects":["Dry cough","Hyperkalemia","Dizziness"],"contraindications":["Pregnancy","Angioedema hx"],"interactions":["K+ supplements","NSAIDs"],"pregnancy_category":"D"},
    "atorvastatin": {"name":"Atorvastatin","class":"Statin","mechanism":"Inhibits HMG-CoA reductase, blocks cholesterol synthesis.","common_uses":["Hyperlipidemia","CV prevention"],"dosage_range":"10-80mg daily","side_effects":["Myalgia","Liver enzyme elevation"],"contraindications":["Active liver disease","Pregnancy"],"interactions":["Grapefruit","Cyclosporine"],"pregnancy_category":"X"},
    "acetaminophen": {"name":"Acetaminophen","class":"Analgesic/Antipyretic","mechanism":"Central COX inhibition, reduces prostaglandins.","common_uses":["Pain","Fever","Headache"],"dosage_range":"325-1000mg q4-6h (max 4g/day)","side_effects":["Hepatotoxicity(OD)","Nausea"],"contraindications":["Severe liver disease"],"interactions":["Warfarin","Alcohol"],"pregnancy_category":"B"},
    "omeprazole": {"name":"Omeprazole","class":"PPI","mechanism":"Irreversibly inhibits gastric proton pump.","common_uses":["GERD","Peptic ulcer","H.pylori"],"dosage_range":"20-40mg daily","side_effects":["Headache","Abdominal pain","B12 deficiency"],"contraindications":["Rilpivirine use"],"interactions":["Clopidogrel","Methotrexate"],"pregnancy_category":"C"},
    "amlodipine": {"name":"Amlodipine","class":"CCB","mechanism":"Blocks L-type calcium channels, vasodilation.","common_uses":["Hypertension","Angina"],"dosage_range":"2.5-10mg daily","side_effects":["Peripheral edema","Dizziness","Flushing"],"contraindications":["Severe aortic stenosis"],"interactions":["Simvastatin","Cyclosporine"],"pregnancy_category":"C"},
}
