"""MMS uses the existing bounded, reusable offline subprocess transport."""
import atexit
from pathlib import Path
from types import SimpleNamespace
from app.modules.identity.errors import IdentityError

from ml.mms.artifacts import manifest, MIN_FREE_BYTES
from . import wavlm_runtime


def prepared(settings):
    if not settings.pronunciation_mms_enabled:
        return "disabled"
    if not settings.pronunciation_mms_noncommercial_acknowledged:
        return "license_review_required"
    if not settings.pronunciation_mms_python or not Path(settings.pronunciation_mms_python).is_file():
        return "runtime_missing"
    if wavlm_runtime.free_memory() < MIN_FREE_BYTES:
        return "insufficient_memory"
    try:
        manifest(settings.pronunciation_mms_cache or "")
    except (OSError, ValueError, KeyError, TypeError):
        return "artifacts_missing"
    return "ready"


class Runtime(wavlm_runtime.Runtime):
    worker = Path(__file__).resolve().parents[3] / "ml/mms/worker.py"
    error_prefix = "mms"

    def readiness(self, settings):
        return prepared(settings.mms_settings)

    def verify(self, cache):
        manifest(cache, verify=True)

    def assess(self, settings, audio, expected):
        if not settings.pronunciation_mms_enabled or not settings.pronunciation_mms_noncommercial_acknowledged:
            raise IdentityError(503, "mms_disabled", "Tagalog transcription is disabled or awaits noncommercial license review.")
        # Transport field names remain private; no WavLM contract is used for MMS predictions.
        proxy = SimpleNamespace(
            pronunciation_wavlm_python=settings.pronunciation_mms_python,
            pronunciation_wavlm_cache=settings.pronunciation_mms_cache,
            pronunciation_wavlm_device=settings.pronunciation_mms_device,
            pronunciation_wavlm_timeout_seconds=settings.pronunciation_mms_timeout_seconds,
            mms_settings=settings,
        )
        return super().assess(proxy, audio, expected)


runtime = Runtime()
atexit.register(runtime.close)
