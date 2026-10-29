import pytest
from pydantic import ValidationError

from app.speech.schemas import AssessmentPrediction, RecognitionPrediction


def prediction(score=80.0):
    return {
        "overall_score": score,
        "n_errors": 0,
        "words": [
            {
                "word": "hello",
                "score": 80.0,
                "phonemes": [
                    {
                        "phone": "hh",
                        "score": 80.0,
                        "pherr_prob": 0.1,
                        "error": False,
                    }
                ],
            }
        ],
        "model_id": "test-model",
        "model_revision": "abc123",
        "validation_status": "unvalidated_model_prediction",
    }


@pytest.mark.parametrize("score", [float("nan"), float("inf"), -1.0, 101.0, None, "80"])
def test_invalid_scores_are_never_repaired(score):
    with pytest.raises(ValidationError):
        AssessmentPrediction.model_validate(prediction(score))


def test_preserves_real_finite_model_score_and_rejects_missing_words():
    assert AssessmentPrediction.model_validate(prediction()).overall_score == 80.0
    with pytest.raises(ValidationError):
        AssessmentPrediction.model_validate({**prediction(), "words": []})


def test_recognition_cannot_contain_a_score():
    data = {
        "transcript": "hello",
        "model_id": "test",
        "model_revision": "abc",
        "decoder_version": "test-v1",
        "validation_status": "unvalidated_model_prediction",
    }
    assert RecognitionPrediction.model_validate(data).transcript == "hello"
    with pytest.raises(ValidationError):
        RecognitionPrediction.model_validate({**data, "score": 99})


def test_assessment_rejects_inconsistent_error_count():
    with pytest.raises(ValidationError):
        AssessmentPrediction.model_validate({**prediction(), "n_errors": 1})
