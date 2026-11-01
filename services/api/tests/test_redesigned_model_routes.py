"""Redesigned upload dispatch; no model weights or database writes."""
from io import BytesIO
from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from fastapi import UploadFile

from app.modules.identity.errors import IdentityError
from app.modules.pronunciation import router


@pytest.mark.parametrize("engine,service_name", [("wavlm", "wavlm_service"), ("mms", "mms_service")])
def test_model_route_uses_only_selected_real_service(monkeypatch, engine, service_name):
    selected = getattr(router, service_name)
    other = router.mms_service if engine == "wavlm" else router.wavlm_service
    expected = object()
    selected_assess = MagicMock(return_value=expected)
    monkeypatch.setattr(selected, "assess", selected_assess)
    monkeypatch.setattr(other, "assess", MagicMock(side_effect=AssertionError("wrong model")))
    activity_id, request_id = uuid4(), uuid4()
    upload = UploadFile(file=BytesIO(b"RIFF" + b"x" * 100), filename="recording.wav")
    request = SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(settings=object())))
    repo = MagicMock()
    result = router.submit_attempt(request, "credential", repo, activity_id, upload, 1500,
                                   assessment_engine=engine, activity_version=2, request_id=request_id,
                                   consent_version="explicit-local-consent")
    assert result is expected
    assert selected_assess.call_count == 1
    kwargs = selected_assess.call_args.kwargs
    assert kwargs["activity_id"] == activity_id and kwargs["activity_version"] == 2
    assert kwargs["key"] == request_id and kwargs["consent_version"] == "explicit-local-consent"
    assert kwargs["audio"].startswith(b"RIFF")
    assert upload.file.closed


def test_model_route_requires_version_and_request_id_before_inference(monkeypatch):
    assessor = MagicMock(side_effect=AssertionError("model must not run"))
    monkeypatch.setattr(router.wavlm_service, "assess", assessor)
    upload = UploadFile(file=BytesIO(b"RIFF" + b"x" * 100), filename="recording.wav")
    request = SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(settings=object())))
    with pytest.raises(IdentityError) as error:
        router.submit_attempt(request, "credential", MagicMock(), uuid4(), upload, 1500,
                              assessment_engine="wavlm")
    assert error.value.status == 422
    assessor.assert_not_called()
    assert upload.file.closed
