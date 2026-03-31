"""Whisper STT service for audio transcription."""
import asyncio, logging
from config import SUPPORTED_LANGUAGES, WHISPER_MODEL_SIZE

logger = logging.getLogger(__name__)

_whisper_model = None

def get_whisper_model():
    global _whisper_model
    if _whisper_model is None:
        from faster_whisper import WhisperModel
        logger.info(f"Loading Whisper model ({WHISPER_MODEL_SIZE})...")
        _whisper_model = WhisperModel(WHISPER_MODEL_SIZE, device="cpu", compute_type="int8")
        logger.info(f"Whisper model ({WHISPER_MODEL_SIZE}) loaded.")
    return _whisper_model


async def run_whisper_transcription(audio_path: str, language: str = "auto") -> dict:
    """Run Whisper STT in a thread pool to avoid blocking the event loop."""
    def _transcribe():
        model = get_whisper_model()
        lang_config = SUPPORTED_LANGUAGES.get(language, SUPPORTED_LANGUAGES.get("auto"))
        whisper_lang = lang_config["whisper_code"] if lang_config else None
        logger.info(f"Whisper transcribing: lang={language} (whisper_code={whisper_lang})")
        segments, info = model.transcribe(
            audio_path,
            beam_size=5,
            language=whisper_lang,
            vad_filter=True,
            vad_parameters=dict(min_silence_duration_ms=500),
        )
        text_parts = []
        segment_data = []
        for seg in segments:
            text_parts.append(seg.text.strip())
            segment_data.append({
                "start": round(seg.start, 2),
                "end": round(seg.end, 2),
                "text": seg.text.strip(),
            })
        detected_lang = info.language
        detected_lang_name = SUPPORTED_LANGUAGES.get(detected_lang, {}).get("name", detected_lang)
        return {
            "transcript": " ".join(text_parts),
            "segments": segment_data,
            "language": detected_lang,
            "language_name": detected_lang_name,
            "language_probability": round(info.language_probability, 3),
            "duration": round(info.duration, 2),
            "requested_language": language,
        }
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _transcribe)
