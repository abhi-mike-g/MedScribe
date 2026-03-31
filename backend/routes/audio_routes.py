"""Audio transcription and AI extraction routes."""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from pathlib import Path
import uuid, logging
from db import UPLOAD_DIR
from auth import get_current_user
from config import SUPPORTED_LANGUAGES, WHISPER_MODEL_SIZE
from services.whisper_service import run_whisper_transcription
from services.llm_service import run_llm_extraction

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post("/audio/transcribe")
async def transcribe_audio(
    audio: UploadFile = File(...),
    language: str = Form("auto"),
    user=Depends(get_current_user)
):
    if not audio.filename:
        raise HTTPException(status_code=400, detail="No audio file provided")
    if language not in SUPPORTED_LANGUAGES:
        raise HTTPException(status_code=400, detail=f"Unsupported language: {language}. Use /api/languages to see supported list.")

    suffix = Path(audio.filename).suffix or ".webm"
    tmp_path = UPLOAD_DIR / f"audio_{uuid.uuid4().hex}{suffix}"
    try:
        content = await audio.read()
        if len(content) < 100:
            raise HTTPException(status_code=400, detail="Audio file too small — recording may have failed")
        with open(tmp_path, "wb") as f:
            f.write(content)

        logger.info(f"Transcribing audio: {tmp_path.name} ({len(content)} bytes, lang={language})")
        stt_result = await run_whisper_transcription(str(tmp_path), language=language)

        if not stt_result["transcript"].strip():
            return {
                "transcript": "",
                "stt": stt_result,
                "extraction": None,
                "message": "No speech detected in the audio. Please try recording again.",
                "processing_method": f"whisper-{WHISPER_MODEL_SIZE}-server"
            }

        detected_lang = stt_result.get("language", language if language != "auto" else "en")
        logger.info(f"Running LLM extraction (detected_lang={detected_lang}, {len(stt_result['transcript'])} chars)")
        extraction = await run_llm_extraction(stt_result["transcript"], detected_language=detected_lang)

        return {
            "transcript": stt_result["transcript"],
            "stt": {
                "segments": stt_result["segments"],
                "language": stt_result["language"],
                "language_name": stt_result.get("language_name", stt_result["language"]),
                "confidence": stt_result["language_probability"],
                "duration_seconds": stt_result["duration"],
                "requested_language": stt_result.get("requested_language", language),
                "model": f"whisper-{WHISPER_MODEL_SIZE}",
                "processing_method": "faster-whisper-server"
            },
            "extraction": extraction,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Transcription failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")
    finally:
        if tmp_path.exists():
            tmp_path.unlink()

@router.get("/languages")
async def get_supported_languages():
    return {
        "languages": [{"code": code, **info} for code, info in SUPPORTED_LANGUAGES.items()],
        "default": "auto",
        "whisper_model": WHISPER_MODEL_SIZE,
    }

@router.post("/audio/extract-from-text")
async def extract_from_text(data: dict, user=Depends(get_current_user)):
    transcript = data.get("transcript", "")
    language = data.get("language", "en")
    if not transcript.strip():
        raise HTTPException(status_code=400, detail="Transcript text is required")
    extraction = await run_llm_extraction(transcript, detected_language=language)
    return {"extraction": extraction}
