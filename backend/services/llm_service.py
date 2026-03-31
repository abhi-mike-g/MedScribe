"""LLM medical data extraction service."""
import json, uuid, logging
from config import EMERGENT_LLM_KEY, SUPPORTED_LANGUAGES

logger = logging.getLogger(__name__)


async def run_llm_extraction(transcript: str, detected_language: str = "en") -> dict:
    """Use LLM to extract structured medical data from a transcript (any language)."""
    from emergentintegrations.llm.chat import LlmChat, UserMessage

    lang_name = SUPPORTED_LANGUAGES.get(detected_language, {}).get("name", detected_language)

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"medscribe-extract-{uuid.uuid4().hex[:8]}",
        system_message=f"""You are MedScribe AI, a multilingual medical transcript analyzer.
The transcript may be in {lang_name} ({detected_language}) or a mix of languages (code-switching is common in medical consultations).
Extract structured medical information regardless of the transcript language.
ALWAYS return the extracted data in English for standardized medical records, but include the original language terms in parentheses where clinically relevant.

Return ONLY valid JSON with this exact schema (no markdown, no code fences):
{{
  "chief_complaint": "Brief primary complaint in English",
  "symptoms": [{{"name": "symptom in English", "severity": "mild/moderate/severe", "duration": "how long", "notes": "extra detail"}}],
  "medical_history_mentioned": ["any past conditions mentioned"],
  "medications_mentioned": ["any medications the patient says they take"],
  "allergies_mentioned": ["any allergies mentioned"],
  "vital_signs_mentioned": {{"temperature": "", "blood_pressure": "", "heart_rate": "", "other": ""}},
  "suggested_diagnosis": ["possible diagnoses based on symptoms"],
  "recommended_tests": ["suggested diagnostic tests"],
  "urgency_level": "low/medium/high/critical",
  "key_quotes": ["important verbatim quotes from the conversation in their ORIGINAL language"],
  "summary": "2-3 sentence clinical summary in English",
  "transcript_language": "{detected_language}",
  "language_name": "{lang_name}"
}}
If a field has no data, use empty string or empty array. Always return valid JSON."""
    ).with_model("openai", "gpt-4.1-mini")

    user_message = UserMessage(
        text=f"Extract structured medical information from this doctor-patient conversation transcript (language: {lang_name}):\n\n{transcript}"
    )
    response_text = await chat.send_message(user_message)

    # Parse LLM response
    cleaned = response_text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()
    if cleaned.startswith("json"):
        cleaned = cleaned[4:].strip()

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        logger.warning(f"LLM returned non-JSON: {response_text[:200]}")
        return {
            "chief_complaint": "Unable to parse - see raw transcript",
            "symptoms": [],
            "medical_history_mentioned": [],
            "medications_mentioned": [],
            "allergies_mentioned": [],
            "vital_signs_mentioned": {},
            "suggested_diagnosis": [],
            "recommended_tests": [],
            "urgency_level": "medium",
            "key_quotes": [],
            "summary": response_text[:500],
            "raw_llm_response": response_text,
        }
