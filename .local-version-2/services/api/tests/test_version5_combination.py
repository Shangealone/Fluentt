"""Contracts at the version-5/WavLM merge boundary; no checkpoints are loaded."""
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.db.session import get_session
from app.main import create_app


def test_school_registration_default_and_speech_configuration_coexist(tmp_path):
    settings = Settings(_env_file=None, database_url=None, serve_web=True,
                        pronunciation_wavlm_enabled=True,
                        pronunciation_wavlm_python="not-installed/python.exe",
                        pronunciation_wavlm_cache="not-installed/cache")
    assert settings.serve_web is True
    assert settings.personal_learner_registration_enabled is False
    assert settings.pronunciation_wavlm_enabled is True
    assert settings.pronunciation_mms_enabled is False
    (tmp_path / "index.html").write_text("<html></html>", encoding="utf-8")
    with TestClient(create_app(settings, web_dist=tmp_path)) as client:
        response = client.get("/api/v1/registration/options")
        assert response.status_code == 200
        assert "personal_student" not in response.json()["roles"]


def test_review_and_model_routes_remain_authenticated_without_a_database():
    settings = Settings(_env_file=None, database_url=None)
    application = create_app(settings)
    # A sentinel session makes unexpected database access fail rather than masking it
    # behind the unconfigured-database dependency's 503 response.
    application.app.dependency_overrides[get_session] = lambda: object()
    with TestClient(application) as client:
        for path in ("/api/v1/me/pronunciation/capabilities",
                     "/api/v1/me/vocabulary/studies",
                     "/api/v1/admin/vocabulary/packs"):
            response = client.get(path)
            assert response.status_code == 401, (path, response.status_code)


def test_combined_app_has_no_default_research_prediction_provider():
    application = create_app(Settings(_env_file=None, database_url=None))
    # CORS wraps FastAPI; the absence of an injected provider must remain explicit.
    assert getattr(application.app.state, "esr_prediction_provider", None) is None
