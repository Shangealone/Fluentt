"""A genuine development checkpoint must not impersonate the live ESR provider."""
from types import SimpleNamespace

from app.modules.vocabulary_review.inference import provider_ready


def test_observed_session_model_is_not_a_future_recall_provider():
    candidate = SimpleNamespace(simulated=False, ready=True, artifact_sha256="a" * 64,
                                version="public-development-v2",
                                prediction_contract="observed-session-recall-proportion-v2")
    assert not provider_ready(candidate)
