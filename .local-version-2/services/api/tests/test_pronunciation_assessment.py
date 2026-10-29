"""Section 34: NLP-Driven Pronunciation Assessment Unit & Integration Tests."""

from datetime import datetime, timezone
from decimal import Decimal
from unittest.mock import MagicMock
from uuid import UUID, uuid4
import pytest

from app.modules.identity.errors import IdentityError
from app.modules.speech.asr_engine import ASRResult, ASRWord
from app.modules.speech.evaluator import (
    graphemes_to_phonemes_tagalog,
    graphemes_to_phonemes_english,
    get_word_phonemes,
    MultilingualPronunciationEvaluator,
    PronunciationAssessmentResult,
)
from app.modules.speech.schemas import (
    PronunciationAssessmentDTO,
    PronunciationAssessmentResponseDTO,
)
from app.modules.speech.service import (
    get_or_create_evaluator_configuration,
    evaluate_pronunciation_attempt,
    get_attempt_assessment,
)
from app.models.ai import PronunciationActivity, PronunciationAttempt
from app.models.research import ModelVersion, ModelConfiguration


# ---------------------------------------------------------------------------
# 1. G2P & Phoneme Inventory Tests
# ---------------------------------------------------------------------------


def test_tagalog_g2p_digraph_and_vowels():
    # Test digraph 'ng' and vowel sequence
    phonemes = graphemes_to_phonemes_tagalog("ngayon")
    assert phonemes == ["NG", "AA", "Y", "OW", "N"]

    phonemes2 = graphemes_to_phonemes_tagalog("magandang")
    assert phonemes2 == ["M", "AA", "G", "AA", "N", "D", "AA", "NG"]

    phonemes3 = graphemes_to_phonemes_tagalog("wika")
    assert phonemes3 == ["W", "IY", "K", "AA"]


def test_english_g2p_lexicon():
    phonemes = graphemes_to_phonemes_english("practice")
    assert phonemes == ["P", "R", "AE", "K", "T", "AH", "S"]

    phonemes2 = graphemes_to_phonemes_english("lesson")
    assert phonemes2 == ["L", "EH", "S", "AH", "N"]


def test_get_word_phonemes_routing():
    tl_ph = get_word_phonemes("bansa", "tagalog")
    assert tl_ph == ["B", "AA", "N", "S", "AA"]

    en_ph = get_word_phonemes("good", "english")
    assert en_ph == ["G", "UH", "D"]


# ---------------------------------------------------------------------------
# 2. Multi-Dimensional Pronunciation Evaluator Tests
# ---------------------------------------------------------------------------


def test_evaluator_tagalog_high_fidelity():
    evaluator = MultilingualPronunciationEvaluator()

    prompt = "Magandang umaga sa inyong lahat."
    asr_words = [
        ASRWord(word="Magandang", start_time_ms=100, end_time_ms=600, confidence=0.96),
        ASRWord(word="umaga", start_time_ms=650, end_time_ms=1100, confidence=0.95),
        ASRWord(word="sa", start_time_ms=1150, end_time_ms=1300, confidence=0.94),
        ASRWord(word="inyong", start_time_ms=1350, end_time_ms=1800, confidence=0.93),
        ASRWord(word="lahat", start_time_ms=1850, end_time_ms=2300, confidence=0.95),
    ]

    asr_result = ASRResult(
        raw_transcript=prompt,
        normalized_transcript="magandang umaga sa inyong lahat",
        detected_language="tl",
        prompt_language="tl",
        confidence=0.95,
        duration_ms=2500,
        processing_time_ms=40,
        model_id="whisper-multilingual-v1",
        model_version="openai/whisper-base",
        simulated=True,
        silence_detected=False,
        words=asr_words,
        language_match=True,
    )

    res = evaluator.evaluate(
        prompt_text=prompt,
        target_language="tagalog",
        asr_result=asr_result,
        audio_duration_ms=2500,
    )

    assert isinstance(res, PronunciationAssessmentResult)
    assert res.target_language == "tl"
    assert res.completeness_score == 100.0
    assert 80.0 <= res.accuracy_score <= 100.0
    assert 70.0 <= res.fluency_score <= 100.0
    assert 70.0 <= res.prosody_score <= 100.0
    assert 80.0 <= res.overall_score <= 100.0
    assert len(res.words) == 5
    assert len(res.actionable_tips) > 0
    assert "Mahusay" in res.summary_feedback or "diin" in res.summary_feedback


def test_evaluator_english_evaluation():
    evaluator = MultilingualPronunciationEvaluator()

    prompt = "Good morning welcome to our class"
    asr_words = [
        ASRWord(word="Good", start_time_ms=100, end_time_ms=500, confidence=0.95),
        ASRWord(word="morning", start_time_ms=550, end_time_ms=1000, confidence=0.96),
        ASRWord(word="welcome", start_time_ms=1050, end_time_ms=1600, confidence=0.94),
        ASRWord(word="to", start_time_ms=1650, end_time_ms=1850, confidence=0.92),
        ASRWord(word="our", start_time_ms=1900, end_time_ms=2100, confidence=0.90),
        ASRWord(word="class", start_time_ms=2150, end_time_ms=2600, confidence=0.95),
    ]

    asr_result = ASRResult(
        raw_transcript=prompt,
        normalized_transcript=prompt.lower(),
        detected_language="en",
        prompt_language="en",
        confidence=0.94,
        duration_ms=2800,
        processing_time_ms=45,
        model_id="whisper-multilingual-v1",
        model_version="openai/whisper-base",
        simulated=True,
        silence_detected=False,
        words=asr_words,
        language_match=True,
    )

    res = evaluator.evaluate(
        prompt_text=prompt,
        target_language="english",
        asr_result=asr_result,
        audio_duration_ms=2800,
    )

    assert res.target_language == "en"
    assert res.completeness_score == 100.0
    assert res.overall_score >= 80.0
    assert "consonant" in str(res.actionable_tips) or "rhythm" in str(res.actionable_tips)


def test_evaluator_silence_handling():
    evaluator = MultilingualPronunciationEvaluator()

    asr_result = ASRResult(
        raw_transcript="",
        normalized_transcript="",
        detected_language="tl",
        prompt_language="tl",
        confidence=0.0,
        duration_ms=2000,
        processing_time_ms=10,
        model_id="whisper-multilingual-v1",
        model_version="openai/whisper-base",
        simulated=True,
        silence_detected=True,
        words=[],
        language_match=True,
    )

    res = evaluator.evaluate(
        prompt_text="Salamat sa iyo.",
        target_language="tagalog",
        asr_result=asr_result,
        audio_duration_ms=2000,
    )

    assert res.overall_score == 0.0
    assert res.accuracy_score == 0.0
    assert res.completeness_score == 0.0
    assert "No speech was detected" in res.summary_feedback


# ---------------------------------------------------------------------------
# 3. Evaluator Configuration & Database Services
# ---------------------------------------------------------------------------


def test_get_or_create_evaluator_configuration():
    db = MagicMock()
    # First query for ModelVersion returns None, then creates it
    # Second query for ModelConfiguration returns None, then creates it
    mv_id = uuid4()
    mc_id = uuid4()

    def mock_scalar(query):
        sql = str(query)
        if "model_versions" in sql:
            return None
        if "model_configurations" in sql:
            return None
        return None

    db.scalar.side_effect = mock_scalar

    cfg_id = get_or_create_evaluator_configuration(db)
    assert db.add.call_count == 2
    assert db.flush.call_count == 2


def test_evaluate_pronunciation_attempt_success():
    db = MagicMock()
    user = MagicMock()
    user.id = uuid4()
    context_id = uuid4()
    attempt_id = uuid4()
    activity_id = uuid4()
    mc_id = uuid4()

    mock_context = MagicMock()
    mock_context.id = context_id

    mock_attempt = MagicMock()
    mock_attempt.id = attempt_id
    mock_attempt.context_id = context_id
    mock_attempt.activity_id = activity_id
    mock_attempt.transcription = "Magandang umaga sa inyong lahat."
    mock_attempt.simulated = True
    mock_attempt.score = None
    mock_attempt.scoring_status = "pending"
    mock_attempt.result = {
        "duration_ms": 2600,
        "transcription_metadata": {
            "raw_transcript": "Magandang umaga sa inyong lahat.",
            "normalized_transcript": "magandang umaga sa inyong lahat",
            "detected_language": "tl",
            "prompt_language": "tl",
            "confidence": 0.95,
            "silence_detected": False,
            "words": [
                {"word": "Magandang", "start_time_ms": 100, "end_time_ms": 600, "confidence": 0.95},
                {"word": "umaga", "start_time_ms": 650, "end_time_ms": 1100, "confidence": 0.95},
                {"word": "sa", "start_time_ms": 1150, "end_time_ms": 1300, "confidence": 0.94},
                {"word": "inyong", "start_time_ms": 1350, "end_time_ms": 1800, "confidence": 0.93},
                {"word": "lahat", "start_time_ms": 1850, "end_time_ms": 2300, "confidence": 0.95},
            ],
        },
    }

    mock_activity = MagicMock()
    mock_activity.id = activity_id
    mock_activity.target_text = "Magandang umaga sa inyong lahat."
    mock_activity.language = "tagalog"

    mock_mc = MagicMock()
    mock_mc.id = mc_id

    def mock_scalar(query):
        sql = str(query)
        if "learning_contexts" in sql:
            return mock_context
        if "pronunciation_attempts" in sql:
            return mock_attempt
        if "pronunciation_activities" in sql:
            return mock_activity
        if "model_versions" in sql:
            mock_mv = MagicMock()
            mock_mv.id = uuid4()
            return mock_mv
        if "model_configurations" in sql:
            return mock_mc
        return None

    db.scalar.side_effect = mock_scalar

    res = evaluate_pronunciation_attempt(db, user, attempt_id)

    assert isinstance(res, PronunciationAssessmentResponseDTO)
    assert res.attempt_id == attempt_id
    assert res.scoring_status == "scored"
    assert res.score is not None
    assert 80.0 <= res.score <= 100.0
    assert res.assessment is not None
    assert res.assessment.completeness_score == 100.0
    assert len(res.assessment.words) == 5
    assert mock_attempt.scoring_status == "scored"
    assert mock_attempt.score is not None
    assert mock_attempt.evaluator_configuration_id == mc_id


def test_evaluate_pronunciation_attempt_silence_handling():
    db = MagicMock()
    user = MagicMock()
    context_id = uuid4()
    attempt_id = uuid4()
    activity_id = uuid4()

    mock_context = MagicMock()
    mock_context.id = context_id

    mock_attempt = MagicMock()
    mock_attempt.id = attempt_id
    mock_attempt.context_id = context_id
    mock_attempt.activity_id = activity_id
    mock_attempt.transcription = ""
    mock_attempt.simulated = True
    mock_attempt.score = None
    mock_attempt.scoring_status = "pending"
    mock_attempt.result = {
        "duration_ms": 2000,
        "transcription_metadata": {
            "silence_detected": True,
            "raw_transcript": "",
        },
    }

    mock_activity = MagicMock()
    mock_activity.id = activity_id
    mock_activity.target_text = "Magandang araw."
    mock_activity.language = "tagalog"

    db.scalar.side_effect = [mock_context, mock_attempt, mock_activity]

    res = evaluate_pronunciation_attempt(db, user, attempt_id)

    assert res.scoring_status == "unsupported"
    assert res.score is None
    assert mock_attempt.scoring_status == "unsupported"
    assert mock_attempt.score is None
    assert "No speech detected" in res.message


def test_get_attempt_assessment_retrieval():
    db = MagicMock()
    user = MagicMock()
    context_id = uuid4()
    attempt_id = uuid4()
    activity_id = uuid4()
    mc_id = uuid4()

    mock_context = MagicMock()
    mock_context.id = context_id

    mock_attempt = MagicMock()
    mock_attempt.id = attempt_id
    mock_attempt.context_id = context_id
    mock_attempt.activity_id = activity_id
    mock_attempt.scoring_status = "scored"
    mock_attempt.score = Decimal("91.50")
    mock_attempt.feedback = "Mahusay na pagbigkas."
    mock_attempt.evaluator_configuration_id = mc_id
    mock_attempt.simulated = True
    mock_attempt.transcription = "Magandang araw."
    mock_attempt.result = {
        "assessment": {
            "overall_score": 91.5,
            "accuracy_score": 92.0,
            "fluency_score": 90.0,
            "completeness_score": 100.0,
            "prosody_score": 90.0,
            "words": [
                {
                    "word": "Magandang",
                    "target_phonemes": ["M", "AA", "G", "AA", "N", "D", "AA", "NG"],
                    "accuracy_score": 92.0,
                    "error_type": "none",
                    "phonemes": [],
                }
            ],
            "target_language": "tagalog",
            "summary_feedback": "Mahusay na pagbigkas.",
            "actionable_tips": ["Magpatuloy sa pagsasanay."],
            "model_id": "fluentt-multilingual-gop-evaluator",
            "model_version": "1.0.0",
            "simulated": True,
            "speech_rate_wpm": 120.0,
            "confidence": 0.95,
        }
    }

    mock_activity = MagicMock()
    mock_activity.id = activity_id
    mock_activity.target_text = "Magandang araw."
    mock_activity.language = "tagalog"

    db.scalar.side_effect = [mock_context, mock_attempt, mock_activity]

    res = get_attempt_assessment(db, user, attempt_id)
    assert res.scoring_status == "scored"
    assert res.score == 91.5
    assert res.assessment is not None
    assert res.assessment.accuracy_score == 92.0
    assert res.assessment.words[0].word == "Magandang"
