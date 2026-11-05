"""Synthetic provider tests; these never contact Groq."""

import json
from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

import httpx
import pytest
from pydantic import ValidationError

from app.core.config import Settings
from app.modules.conversation import groq_provider
from app.modules.identity.errors import IdentityError


@pytest.fixture(autouse=True)
def clear_limits():
    groq_provider._requests.clear()
    groq_provider._active = 0


def configured(user_id, **overrides):
    values = dict(
        _env_file=None, GROQ_TUTOR_ENABLED=True, GROQ_API_KEY="synthetic-test-key",
        GROQ_TUTOR_ALLOWED_USER_IDS=[user_id],
    )
    values.update(overrides)
    return Settings(**values)


def fake_client(monkeypatch, payload):
    client = MagicMock()
    client.chat.completions.create.return_value = SimpleNamespace(
        choices=[SimpleNamespace(message=SimpleNamespace(content=json.dumps(payload)))],
    )
    import groq
    factory = MagicMock(return_value=client)
    monkeypatch.setattr(groq, "Groq", factory)
    return client, factory


@pytest.mark.parametrize("language,feedback_language,text,dialogue,improvement", [
    ("english", "tagalog", "I want order a coffee.", "What size would you like?", {
        "revised_sentence": "I'd like to order a coffee, please.",
        "explanation": "Gamitin ang 'to order' pagkatapos ng 'I'd like' kapag umoorder.",
    }),
    ("tagalog", "english", "Magkano po ang mga mangga?", "Isang daang piso po ang isang kilo.", None),
])
def test_real_adapter_shapes_english_and_tagalog(monkeypatch, language, feedback_language, text, dialogue, improvement):
    user_id = uuid4()
    client, factory = fake_client(monkeypatch, {
        "dialogue": dialogue, "summary": "Malinaw ang sagot mo." if feedback_language == "tagalog" else "Your reply was clear.",
        "corrections": [], "suggestions": [],
        "sentence_improvement": improvement,
    })
    result = groq_provider.generate_turn(
        settings=configured(user_id), user_id=user_id,
        history=[{"role": "assistant", "content": "Hello"}, {"role": "user", "content": text}],
        topic_context={"persona": "Barista", "scenario_description": "Cafe"}, language=language,
        feedback_language=feedback_language,
    )
    assert result.simulated is False
    assert result.feedback.confidence is None
    assert result.feedback.topic_relevance_score is None
    assert result.feedback.model_dump()["sentence_improvement"] == improvement
    assert result.feedback.feedback_language == feedback_language
    assert result.assistant_text == dialogue
    request = client.chat.completions.create.call_args.kwargs
    assert request["model"] == "openai/gpt-oss-20b"
    assert request["messages"][-1] == {"role": "user", "content": text}
    prompt = request["messages"][0]["content"]
    assert f"Write dialogue and revised_sentence in {language}" in prompt
    assert f"Write summary, explanation, corrections, and suggestions in {feedback_language}" in prompt
    assert request["response_format"] == {"type": "json_object"}
    assert factory.call_args.kwargs["max_retries"] == 1


@pytest.mark.parametrize("candidate", [
    "Rewrite this",
    {"revised_sentence": "I'd like a coffee.", "explanation": " "},
    {"revised_sentence": " One  coffee, please. ", "explanation": "Use polite wording."},
])
def test_unusable_optional_improvement_preserves_valid_dialogue(candidate):
    reply = groq_provider._parse_reply(
        json.dumps({
            "dialogue": "What size would you like?",
            "summary": "Your order was clear.",
            "sentence_improvement": candidate,
        }),
        "openai/gpt-oss-20b",
        "One coffee, please.",
    )
    assert reply.assistant_text == "What size would you like?"
    assert reply.feedback.sentence_improvement is None


def test_prior_turns_preserved_and_bounded(monkeypatch):
    user_id = uuid4()
    client, _ = fake_client(monkeypatch, {"dialogue": "Continue?", "summary": "Practice.", "corrections": [], "suggestions": []})
    history = [{"role": "user" if i % 2 else "assistant", "content": str(i)} for i in range(10)]
    history[-1]["role"] = "user"
    groq_provider.generate_turn(settings=configured(user_id), user_id=user_id, history=history, topic_context={}, language="english")
    sent = client.chat.completions.create.call_args.kwargs["messages"]
    assert len(sent) == 9  # one system instruction plus eight recent turns
    assert sent[1]["content"] == "2"
    assert sent[-1]["content"] == "9"


def test_exact_repeated_reply_is_rejected(monkeypatch):
    user_id = uuid4()
    fake_client(monkeypatch, {"dialogue": "Anything else?", "summary": "Practice.", "corrections": [], "suggestions": []})
    with pytest.raises(IdentityError) as exc:
        groq_provider.generate_turn(
            settings=configured(user_id), user_id=user_id,
            history=[
                {"role": "user", "content": "One coffee, please."},
                {"role": "assistant", "content": "Anything else?"},
                {"role": "user", "content": "And a pastry, please."},
            ],
            topic_context={}, language="english",
        )
    assert exc.value.code == "tutor_repeated_reply"


def test_missing_key_and_unapproved_account_fail_closed():
    user_id = uuid4()
    with pytest.raises(IdentityError) as exc:
        groq_provider.ensure_available(Settings(_env_file=None, GROQ_TUTOR_ENABLED=True), user_id)
    assert exc.value.code == "tutor_not_configured"
    with pytest.raises(IdentityError) as exc:
        groq_provider.ensure_available(configured(user_id), uuid4())
    assert exc.value.status == 403


def test_hosted_synthetic_access_requires_explicit_production_gate():
    user_id = uuid4()
    with pytest.raises(IdentityError) as exc:
        groq_provider.ensure_available(configured(user_id, environment="production"), user_id)
    assert exc.value.code == "tutor_unavailable"
    with pytest.raises(ValidationError):
        configured(user_id, environment="production", GROQ_TUTOR_SYNTHETIC_STAGING=True,
                   GROQ_TUTOR_ALLOWED_USER_IDS=[])
    settings = configured(user_id, environment="production", GROQ_TUTOR_SYNTHETIC_STAGING=True)
    assert groq_provider.ensure_available(settings, user_id) == "synthetic-test-key"
    with pytest.raises(IdentityError) as exc:
        groq_provider.ensure_available(settings, uuid4())
    assert exc.value.code == "tutor_test_account_required"


def test_hosted_team_demo_requires_project_and_account_allowlist():
    user_id = uuid4()
    with pytest.raises(ValidationError):
        configured(user_id, environment="production", GROQ_TUTOR_TEAM_DEMO=True)
    with pytest.raises(ValidationError):
        configured(user_id, environment="production", GROQ_TUTOR_TEAM_DEMO=True,
                   team_demo_supabase_project="sample", GROQ_TUTOR_ALLOWED_USER_IDS=[])
    settings = configured(user_id, environment="production", GROQ_TUTOR_TEAM_DEMO=True,
                          team_demo_supabase_project="sample")
    assert groq_provider.ensure_available(settings, user_id) == "synthetic-test-key"
    with pytest.raises(IdentityError) as exc:
        groq_provider.ensure_available(settings, uuid4())
    assert exc.value.code == "tutor_test_account_required"


def test_all_accounts_access_is_limited_to_configured_team_demo():
    user_id = uuid4()
    with pytest.raises(ValidationError):
        configured(user_id, GROQ_TUTOR_TEAM_DEMO_ALL_ACCOUNTS=True)
    settings = configured(
        user_id, environment="production", GROQ_TUTOR_TEAM_DEMO=True,
        GROQ_TUTOR_TEAM_DEMO_ALL_ACCOUNTS=True, GROQ_TUTOR_ALLOWED_USER_IDS=[],
        team_demo_supabase_project="sample",
    )
    assert groq_provider.ensure_available(settings, user_id) == "synthetic-test-key"
    settings.groq_tutor_enabled = False
    with pytest.raises(IdentityError) as exc:
        groq_provider.ensure_available(settings, user_id)
    assert exc.value.code == "tutor_unavailable"


def test_invalid_input_and_malformed_output_do_not_become_scripted_reply(monkeypatch):
    user_id = uuid4()
    client, _ = fake_client(monkeypatch, {"dialogue": "", "summary": "Practice"})
    with pytest.raises(IdentityError) as exc:
        groq_provider.generate_turn(settings=configured(user_id), user_id=user_id,
                                    history=[{"role": "user", "content": "Hello"}], topic_context={}, language="english")
    assert exc.value.code == "tutor_invalid_reply"
    with pytest.raises(IdentityError) as exc:
        groq_provider.generate_turn(settings=configured(user_id), user_id=user_id,
                                    history=[{"role": "user", "content": "My password = secret"}], topic_context={}, language="english")
    assert exc.value.code == "unsafe_message"
    assert client.chat.completions.create.call_count == 1


def test_provider_rate_limit_and_connection_errors(monkeypatch):
    import groq
    user_id = uuid4()
    client, _ = fake_client(monkeypatch, {"dialogue": "Hello", "summary": "Practice", "corrections": [], "suggestions": []})
    response = httpx.Response(429, headers={"Retry-After": "2"}, request=httpx.Request("POST", "https://api.groq.com"))
    client.chat.completions.create.side_effect = groq.APIStatusError("limited", response=response, body=None)
    with pytest.raises(IdentityError) as exc:
        groq_provider.generate_turn(settings=configured(user_id), user_id=user_id,
                                    history=[{"role": "user", "content": "Hello"}], topic_context={}, language="english")
    assert exc.value.status == 429
    assert exc.value.headers["Retry-After"] == "2"
    client.chat.completions.create.side_effect = groq.APIConnectionError(request=httpx.Request("POST", "https://api.groq.com"))
    with pytest.raises(IdentityError) as exc:
        groq_provider.generate_turn(settings=configured(user_id), user_id=user_id,
                                    history=[{"role": "user", "content": "Hello"}], topic_context={}, language="english")
    assert exc.value.code == "tutor_provider_unavailable"


def test_user_limit_and_global_concurrency(monkeypatch):
    user_id = uuid4()
    client, _ = fake_client(monkeypatch, {"dialogue": "Hi", "summary": "Practice", "corrections": [], "suggestions": []})
    settings = configured(user_id, GROQ_TUTOR_PER_USER_LIMIT=1)
    args = dict(settings=settings, user_id=user_id, history=[{"role": "user", "content": "Hi"}], topic_context={}, language="english")
    groq_provider.generate_turn(**args)
    with pytest.raises(IdentityError) as exc:
        groq_provider.generate_turn(**args)
    assert exc.value.code == "tutor_rate_limited"
    assert client.chat.completions.create.call_count == 1
    groq_provider._requests.clear()
    groq_provider._active = 1
    with pytest.raises(IdentityError) as exc:
        groq_provider.generate_turn(**{**args, "settings": configured(user_id, GROQ_TUTOR_MAX_CONCURRENCY=1)})
    assert exc.value.code == "tutor_busy"
    assert client.chat.completions.create.call_count == 1
