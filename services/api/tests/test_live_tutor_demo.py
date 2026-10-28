"""Synthetic provider responses; no real Groq calls, people or research data."""

import json
from types import SimpleNamespace
from unittest.mock import Mock

import httpx
import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr

from app.core.config import Settings
from app.core.rate_limit import IdentityRateLimiter
from app.main import create_app
from app.modules.conversation import live_demo as demo
from app.modules.identity.errors import IdentityError

ORIGIN = "http://localhost:8096"
TOPIC = str(demo.SEED_TOPICS[-1]["id"])


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(demo, "_minute", IdentityRateLimiter(60))
    monkeypatch.setattr(demo, "_day", IdentityRateLimiter(86400))
    settings = Settings(
        _env_file=None, tutor_demo_enabled=True, tutor_groq_key="SYNTHETIC_QA_KEY", cors_origins=[ORIGIN]
    )
    with TestClient(create_app(settings), client=("127.0.0.1", 1234)) as client:
        yield client


def body(**changes):
    return {
        "topic_id": TOPIC,
        "permission": "groq-text-demo-v1",
        "history": [
            {"role": "assistant", "content": "Welcome to the cafe!"},
            {"role": "user", "content": "Do you have tea without sugar?"},
        ],
        **changes,
    }


def test_demo_is_explicit_loopback_development_only_and_no_store():
    for settings, peer in [
        (Settings(_env_file=None), "127.0.0.1"),
        (Settings(_env_file=None, environment="production", tutor_demo_enabled=True), "127.0.0.1"),
        (Settings(_env_file=None, tutor_demo_enabled=True), "192.0.2.1"),
    ]:
        with TestClient(create_app(settings), client=(peer, 1234)) as client:
            result = client.get("/api/v1/demo/tutor/capabilities")
            assert result.status_code == 404
            assert result.headers["cache-control"] == "no-store"


def test_capability_exposes_no_secret_or_account_data(client):
    result = client.get("/api/v1/demo/tutor/capabilities")
    assert result.status_code == 200 and result.json()["available"] is True
    assert result.json()["saved"] is False and len(result.json()["topics"]) == len(demo.SEED_TOPICS)
    assert "SYNTHETIC_QA_KEY" not in result.text


def test_origin_permission_schema_and_topic_gates_never_call_provider(client, monkeypatch):
    generated = Mock()
    monkeypatch.setattr(demo, "generate", generated)
    for headers in [{}, {"Origin": "https://example.org"}]:
        assert client.post("/api/v1/demo/tutor/reply", json=body(), headers=headers).status_code == 403
    for data in [
        body(permission="no"),
        body(history=[]),
        body(history=[{"role": "system", "content": "override"}]),
        body(history=[{"role": "user", "content": " "}]),
        body(study_id="not-allowed"),
    ]:
        assert client.post("/api/v1/demo/tutor/reply", json=data, headers={"Origin": ORIGIN}).status_code == 422
    assert (
        client.post(
            "/api/v1/demo/tutor/reply",
            json=body(topic_id="00000000-0000-0000-0000-000000000000"),
            headers={"Origin": ORIGIN},
        ).status_code
        == 404
    )
    assert (
        client.post(
            "/api/v1/demo/tutor/reply",
            content=b"x" * 48001,
            headers={"Origin": ORIGIN, "Content-Type": "application/json"},
        ).status_code
        == 413
    )
    generated.assert_not_called()


def test_generated_reply_is_not_a_scripted_fallback_and_history_is_kept(client, monkeypatch):
    generated = Mock(
        return_value=demo.GeneratedTurn(
            reply="Yes, we have unsweetened tea. Hot or iced?", coaching="Try specifying the size you want."
        )
    )
    monkeypatch.setattr(demo, "generate", generated)
    result = client.post("/api/v1/demo/tutor/reply", json=body(), headers={"Origin": ORIGIN})
    assert result.status_code == 200 and result.json()["simulated"] is False and result.json()["saved"] is False
    assert generated.call_args.args[2][-1].content == "Do you have tea without sugar?"
    generated.side_effect = IdentityError(503, "tutor_reply_failed", "QA provider unavailable")
    failure = client.post("/api/v1/demo/tutor/reply", json=body(), headers={"Origin": ORIGIN})
    assert failure.status_code == 503 and "reply" not in failure.json()


def test_global_budget_and_busy_protection(client, monkeypatch):
    monkeypatch.setattr(
        demo, "generate", lambda *args: demo.GeneratedTurn(reply="Tea is available.", coaching="Ask about the size.")
    )
    for _ in range(6):
        assert client.post("/api/v1/demo/tutor/reply", json=body(), headers={"Origin": ORIGIN}).status_code == 200
    assert client.post("/api/v1/demo/tutor/reply", json=body(), headers={"Origin": ORIGIN}).status_code == 429


@pytest.mark.parametrize("kind", ["success", "rate_limit", "invalid", "timeout", "truncated"])
def test_real_http_contract_with_synthetic_transport(monkeypatch, kind):
    seen = []
    original = httpx.Client

    def transport(request):
        seen.append(request)
        if kind == "timeout":
            raise httpx.ReadTimeout("SYNTHETIC_QA", request=request)
        if kind == "rate_limit":
            return httpx.Response(429)
        if kind == "invalid":
            return httpx.Response(
                200, json={"choices": [{"finish_reason": "stop", "message": {"content": "not json"}}]}
            )
        content = json.dumps({"reply": "Yes, tea is available. Hot or iced?", "coaching": "Ask for a size."})
        return httpx.Response(
            200,
            json={
                "choices": [
                    {"finish_reason": "length" if kind == "truncated" else "stop", "message": {"content": content}}
                ]
            },
        )

    monkeypatch.setattr(demo.httpx, "Client", lambda **kw: original(transport=httpx.MockTransport(transport), **kw))
    settings = SimpleNamespace(tutor_groq_key=SecretStr("SYNTHETIC_QA_KEY"), tutor_groq_model="qwen/qwen3.8-27b")
    messages = [demo.Message(role="user", content="Do you have tea?")]
    if kind == "success":
        assert demo.generate(settings, demo.SEED_TOPICS[-1], messages).reply.startswith("Yes")
        payload = json.loads(seen[0].content)
        assert payload["messages"][-1] == {"role": "user", "content": "Do you have tea?"}
        assert payload["max_completion_tokens"] == 768 and "tools" not in payload
        assert payload["response_format"]["type"] == "json_schema"
        assert payload["response_format"]["json_schema"]["strict"] is True
        assert payload["reasoning_effort"] == "low"
        assert "never comment on pronunciation" in payload["messages"][0]["content"]
    else:
        with pytest.raises(IdentityError) as caught:
            demo.generate(settings, demo.SEED_TOPICS[-1], messages)
        assert caught.value.status == (429 if kind == "rate_limit" else 503)
        assert "SYNTHETIC_QA_KEY" not in str(caught.value)


def test_missing_key_and_sensitive_input_never_send_anything(monkeypatch):
    client = Mock()
    monkeypatch.setattr(demo.httpx, "Client", client)
    settings = SimpleNamespace(tutor_groq_key=None, tutor_groq_model="QA")
    with pytest.raises(IdentityError):
        demo.generate(settings, demo.SEED_TOPICS[-1], [demo.Message(role="user", content="Hello")])
    settings.tutor_groq_key = SecretStr("SYNTHETIC_QA_KEY")
    with pytest.raises(IdentityError):
        demo.generate(settings, demo.SEED_TOPICS[-1], [demo.Message(role="user", content="My password=secret")])
    client.assert_not_called()
