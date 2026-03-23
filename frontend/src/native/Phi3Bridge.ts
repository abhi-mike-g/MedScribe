/**
 * MedScribe Native AI Bridge — Phi-3 / TinyLlama LLM Module
 * 
 * Architecture: This module provides the interface for on-device medical
 * data extraction using quantized LLM models. On web preview, it falls back
 * to server-side mock extraction. On physical Android devices, it runs
 * inference through ONNX Runtime or TensorFlow Lite.
 * 
 * Native Implementation Notes (for Kotlin/Android):
 * - Primary Model: phi-3-mini-4k-instruct (Q4_K_M quantization, ~2.3GB)
 * - Fallback Model: TinyLlama-1.1B-Chat (Q4_0, ~637MB)
 * - Runtime: ONNX Runtime Mobile or llama.cpp via JNI
 * - Acceleration: GPU Delegate (Adreno/Mali), NNAPI, XNNPACK
 * - Memory: Requires ~3GB RAM for Phi-3, ~1.5GB for TinyLlama
 * - Prompt template: Phi-3 chat format with medical extraction schema
 * 
 * Build steps for native module:
 * 1. Add ONNX Runtime Android dependency or compile llama.cpp
 * 2. Create JNI wrapper: MedicalLLMJNI.kt
 * 3. Expose via TurboModule: MedicalLLMModule.kt
 * 4. Store model in app's internal storage (downloaded on first launch)
 * 5. Implement model download manager with progress tracking
 */

import { Platform } from 'react-native';

export interface MedicalExtraction {
  symptoms: string[];
  vitals: Record<string, string>;
  current_medications: string[];
  assessment: string;
  plan: string[];
  icd_codes: string[];
}

export interface LLMExtractionResult {
  extractedData: MedicalExtraction;
  confidence: number;
  processingTimeMs: number;
  model: string;
  isOnDevice: boolean;
  hardwareAcceleration: string;
  tokensGenerated: number;
  tokensPerSecond: number;
}

export interface LLMConfig {
  modelPath?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  useGPU?: boolean;
  numThreads?: number;
}

const DEFAULT_CONFIG: LLMConfig = {
  maxTokens: 1024,
  temperature: 0.1,
  topP: 0.9,
  useGPU: true,
  numThreads: 4,
};

/**
 * The medical extraction prompt template for Phi-3.
 * This structured prompt ensures consistent JSON output.
 */
const EXTRACTION_PROMPT = `<|system|>
You are a medical data extraction assistant. Extract structured medical information from the consultation transcript. Output valid JSON only.
<|end|>
<|user|>
Extract the following from this medical consultation transcript:
- symptoms: list of reported symptoms
- vitals: dictionary of vital sign measurements
- current_medications: list of medications mentioned
- assessment: clinical assessment/diagnosis
- plan: list of treatment plan items
- icd_codes: relevant ICD-10 codes with descriptions

Transcript:
"{TRANSCRIPT}"

Output as JSON:
<|end|>
<|assistant|>`;

function isNativeModuleAvailable(): boolean {
  try {
    if (Platform.OS === 'web') return false;
    // In real build: NativeModules.MedicalLLMModule != null
    return false; // Stub — returns false until native module is built
  } catch {
    return false;
  }
}

/**
 * Intelligent mock extraction that actually parses the transcript text
 * to produce contextually relevant medical data.
 */
async function mockExtract(transcript: string): Promise<LLMExtractionResult> {
  const startTime = Date.now();
  
  // Simulate processing delay proportional to text length
  const delay = Math.min(1500 + transcript.length * 2, 5000);
  await new Promise(r => setTimeout(r, delay));

  const text = transcript.toLowerCase();
  
  // Parse symptoms from transcript
  const symptomKeywords: Record<string, string> = {
    'headache': 'Headache',
    'fever': 'Fever',
    'back pain': 'Lower back pain',
    'radiating': 'Radiculopathy',
    'cough': 'Cough',
    'sore throat': 'Sore throat',
    'congestion': 'Nasal congestion',
    'pain': 'Pain',
    'nausea': 'Nausea',
    'dizziness': 'Dizziness',
    'fatigue': 'Fatigue',
    'numbness': 'Numbness',
    'tingling': 'Tingling',
    'shortness of breath': 'Dyspnea',
    'chest pain': 'Chest pain',
    'swelling': 'Edema',
    'rash': 'Skin rash',
    'vomiting': 'Vomiting',
    'diarrhea': 'Diarrhea',
    'insomnia': 'Insomnia',
    'anxiety': 'Anxiety',
    'stiffness': 'Joint stiffness',
    'sensitivity to light': 'Photophobia',
  };

  const symptoms: string[] = [];
  for (const [keyword, symptom] of Object.entries(symptomKeywords)) {
    if (text.includes(keyword)) symptoms.push(symptom);
  }
  if (symptoms.length === 0) symptoms.push('General consultation');

  // Parse vitals from transcript
  const vitals: Record<string, string> = {};
  const bpMatch = text.match(/(\d{2,3})\s*(?:over|\/)\s*(\d{2,3})/);
  if (bpMatch) vitals['blood_pressure'] = `${bpMatch[1]}/${bpMatch[2]} mmHg`;
  
  const tempMatch = text.match(/(\d{2,3}\.?\d?)\s*(?:degrees?\s*fahrenheit|°f|f\b)/);
  if (tempMatch) vitals['temperature'] = `${tempMatch[1]}°F`;
  
  const hrMatch = text.match(/(?:heart rate|pulse|hr)\s*(?:of|is|:)?\s*(\d{2,3})/);
  if (hrMatch) vitals['heart_rate'] = `${hrMatch[1]} bpm`;
  
  const painMatch = text.match(/(\d{1,2})\s*(?:out of|\/)\s*10/);
  if (painMatch) vitals['pain_scale'] = `${painMatch[1]}/10`;
  
  const hba1cMatch = text.match(/(?:hba1c|a1c)\s*(?:is|at|of)?\s*(\d\.?\d?)\s*percent/);
  if (hba1cMatch) vitals['hba1c'] = `${hba1cMatch[1]}%`;
  
  const glucoseMatch = text.match(/(?:glucose|sugar)\s*(?:is|of|today is)?\s*(\d{2,3})\s*(?:mg|milligrams)/);
  if (glucoseMatch) vitals['fasting_glucose'] = `${glucoseMatch[1]} mg/dL`;
  
  const weightMatch = text.match(/(?:weight)\s*(?:is|of)?\s*(\d{2,3})\s*(?:lbs|pounds|kg)/);
  if (weightMatch) vitals['weight'] = `${weightMatch[1]} lbs`;
  
  const bmiMatch = text.match(/bmi\s*(?:is|of)?\s*(\d{2}\.?\d?)/);
  if (bmiMatch) vitals['bmi'] = bmiMatch[1];

  // Parse medications
  const medKeywords = [
    'ibuprofen', 'acetaminophen', 'metformin', 'amoxicillin', 'lisinopril',
    'atorvastatin', 'omeprazole', 'amlodipine', 'aspirin', 'prednisone',
    'insulin', 'warfarin', 'gabapentin', 'hydrocodone', 'naproxen',
  ];
  const medications: string[] = [];
  for (const med of medKeywords) {
    if (text.includes(med)) {
      const dosageMatch = text.match(new RegExp(`${med}\\s*(\\d+\\s*(?:mg|milligrams|mcg)\\s*(?:twice|once|three times|daily|bid|tid)?)?`));
      medications.push(dosageMatch?.[1] ? `${med.charAt(0).toUpperCase() + med.slice(1)} ${dosageMatch[1]}` : med.charAt(0).toUpperCase() + med.slice(1));
    }
  }

  // Generate assessment based on detected patterns
  let assessment = 'General medical consultation';
  if (text.includes('headache') && text.includes('fever')) {
    assessment = 'Tension-type headache with febrile illness; rule out sinusitis/meningitis';
  } else if (text.includes('back pain') && text.includes('radiating')) {
    assessment = 'Lumbar radiculopathy, likely disc herniation with nerve root compression';
  } else if (text.includes('diabetes') || text.includes('hba1c') || text.includes('glucose')) {
    assessment = 'Type 2 Diabetes Mellitus — glycemic control assessment';
  } else if (text.includes('sore throat') || text.includes('cough')) {
    assessment = 'Acute upper respiratory infection, likely viral etiology';
  } else if (text.includes('cholesterol') || text.includes('physical')) {
    assessment = 'Annual wellness examination with dyslipidemia screening';
  } else if (text.includes('blood pressure') || text.includes('hypertension')) {
    assessment = 'Essential hypertension — monitoring and management';
  } else if (symptoms.length > 0) {
    assessment = `Clinical evaluation for ${symptoms.slice(0, 2).join(' and ').toLowerCase()}`;
  }

  // Generate plan
  const plan: string[] = [];
  if (medications.length > 0) plan.push(`Continue current medications: ${medications.join(', ')}`);
  if (vitals['pain_scale']) plan.push('Pain management — consider NSAID course');
  if (text.includes('follow') || text.includes('return')) plan.push('Schedule follow-up visit in 2-4 weeks');
  if (text.includes('lab') || text.includes('blood') || text.includes('test')) plan.push('Order laboratory studies as discussed');
  if (text.includes('physical therapy') || text.includes('exercise')) plan.push('Physical therapy / exercise program referral');
  if (text.includes('diet') || text.includes('lifestyle')) plan.push('Lifestyle and dietary modifications counseling');
  plan.push('Return if symptoms worsen or new symptoms develop');
  if (plan.length < 3) plan.push('Patient education and reassurance');

  // Generate ICD codes
  const icdCodes: string[] = [];
  if (text.includes('headache')) icdCodes.push('R51.9 — Headache, unspecified');
  if (text.includes('fever')) icdCodes.push('R50.9 — Fever, unspecified');
  if (text.includes('back pain')) icdCodes.push('M54.5 — Low back pain');
  if (text.includes('radiating') || text.includes('sciatica')) icdCodes.push('M54.3 — Sciatica');
  if (text.includes('diabetes')) icdCodes.push('E11.9 — Type 2 DM without complications');
  if (text.includes('cough')) icdCodes.push('R05.9 — Cough, unspecified');
  if (text.includes('sore throat')) icdCodes.push('J02.9 — Acute pharyngitis, unspecified');
  if (text.includes('cholesterol')) icdCodes.push('E78.5 — Hyperlipidemia, unspecified');
  if (text.includes('hypertension') || (bpMatch && parseInt(bpMatch[1]) >= 130)) icdCodes.push('I10 — Essential hypertension');
  if (icdCodes.length === 0) icdCodes.push('Z00.00 — General adult medical examination');

  const processingTime = Date.now() - startTime;
  const outputTokens = JSON.stringify({ symptoms, vitals, medications, assessment, plan, icdCodes }).length / 4;

  return {
    extractedData: {
      symptoms,
      vitals,
      current_medications: medications,
      assessment,
      plan,
      icd_codes: icdCodes,
    },
    confidence: 0.82 + Math.random() * 0.12,
    processingTimeMs: processingTime,
    model: 'phi-3-mini-4k-q4 (mock — web preview)',
    isOnDevice: false,
    hardwareAcceleration: 'None (web fallback)',
    tokensGenerated: Math.floor(outputTokens),
    tokensPerSecond: Math.floor(outputTokens / (processingTime / 1000)),
  };
}

/**
 * Native LLM extraction — calls the actual ONNX Runtime / llama.cpp bridge
 */
async function nativeExtract(transcript: string, config: LLMConfig): Promise<LLMExtractionResult> {
  // This would be the actual native module call:
  // const { MedicalLLMModule } = NativeModules;
  // const prompt = EXTRACTION_PROMPT.replace('{TRANSCRIPT}', transcript);
  // const result = await MedicalLLMModule.generate({
  //   prompt,
  //   modelPath: config.modelPath || 'models/phi-3-mini-4k-q4.onnx',
  //   maxTokens: config.maxTokens,
  //   temperature: config.temperature,
  //   topP: config.topP,
  //   useGPU: config.useGPU,
  //   numThreads: config.numThreads,
  // });
  // const extractedData = JSON.parse(result.text);
  // return { extractedData, confidence: result.confidence, ... };

  // Fallback to mock
  return mockExtract(transcript);
}

/**
 * Main extraction function — auto-selects native or mock
 */
export async function extractMedicalData(
  transcript: string,
  config: Partial<LLMConfig> = {}
): Promise<LLMExtractionResult> {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  
  if (isNativeModuleAvailable()) {
    try {
      return await nativeExtract(transcript, mergedConfig);
    } catch (error) {
      console.warn('[Phi3LLM] Native module failed, falling back to mock:', error);
      return mockExtract(transcript);
    }
  }
  
  return mockExtract(transcript);
}

export function getLLMStatus(): {
  isNativeAvailable: boolean;
  modelLoaded: boolean;
  backend: string;
  modelSize: string;
} {
  const native = isNativeModuleAvailable();
  return {
    isNativeAvailable: native,
    modelLoaded: native,
    backend: native ? 'ONNX Runtime / GPU Delegate' : 'Mock (Web Preview)',
    modelSize: native ? '~2.3GB (Q4_K_M)' : 'N/A',
  };
}

/**
 * Get the prompt that would be sent to the native model.
 * Useful for debugging and testing.
 */
export function getExtractionPrompt(transcript: string): string {
  return EXTRACTION_PROMPT.replace('{TRANSCRIPT}', transcript);
}
