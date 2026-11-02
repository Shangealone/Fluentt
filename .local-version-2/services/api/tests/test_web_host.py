from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app


def test_web_bundle_and_api_share_one_origin(tmp_path: Path):
    (tmp_path / "index.html").write_text("<html>staging app</html>", encoding="utf-8")
    (tmp_path / "asset.js").write_text("console.log('asset')", encoding="utf-8")
    settings = Settings(_env_file=None, environment="test", serve_web=True, database_url=None)
    with TestClient(create_app(settings, web_dist=tmp_path)) as client:
        assert client.get("/").text == "<html>staging app</html>"
        assert client.get("/conversation").text == "<html>staging app</html>"
        assert client.get("/asset.js").text == "console.log('asset')"
        assert client.get("/api/v1/health").json()["status"] == "ok"
        assert client.get("/api/v1/absent").status_code == 404
        assert client.get("/absent.js").status_code == 404


def test_web_bundle_required_when_enabled(tmp_path: Path):
    settings = Settings(_env_file=None, environment="test", serve_web=True, database_url=None)
    with pytest.raises(RuntimeError, match="Web bundle is missing"):
        create_app(settings, web_dist=tmp_path)
