"""Lazy, serialized local ML worker with a hard process deadline and memory preflight."""

import atexit
import ctypes
import hashlib
import json
import os
from pathlib import Path
from queue import Queue, Empty
import subprocess
import tempfile
from threading import Lock, Thread
from weakref import WeakSet

from app.modules.identity.errors import IdentityError
from .wavlm_contract import REVISION, BASE_REVISION, ALIGNMENT_REVISION

# Actual inference with API/Metro running exhausted the old 4 GiB budget.
# Keep ~1 GiB of host headroom above the measured ~4 GiB standalone peak.
MIN_FREE_BYTES = 5 * 1024**3
WORKER = Path(__file__).resolve().parents[3] / "ml/wavlm/worker.py"
MODEL_LOCK = Lock()
RUNTIMES = WeakSet()


def free_memory():
    if os.name == "nt":

        class Memory(ctypes.Structure):
            _fields_ = [("length", ctypes.c_ulong), ("load", ctypes.c_ulong)] + [
                (name, ctypes.c_ulonglong)
                for name in (
                    "total",
                    "available",
                    "total_page",
                    "available_page",
                    "total_virtual",
                    "available_virtual",
                    "extended",
                )
            ]

        value = Memory()
        value.length = ctypes.sizeof(value)
        if ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(value)):
            return value.available
    else:
        try:
            return os.sysconf("SC_AVPHYS_PAGES") * os.sysconf("SC_PAGE_SIZE")
        except (ValueError, OSError, AttributeError):
            pass
    return 0  # Unknown resources fail closed; no assumed capacity.


def prepared(settings):
    if not settings.pronunciation_wavlm_enabled:
        return "disabled"
    if not settings.pronunciation_wavlm_python or not Path(settings.pronunciation_wavlm_python).is_file():
        return "runtime_missing"
    cache = Path(settings.pronunciation_wavlm_cache or "")
    try:
        manifest = json.loads((cache / "manifest.json").read_text(encoding="utf-8"))
        if manifest["revisions"] != {"scorer": REVISION, "backbone": BASE_REVISION, "alignment": ALIGNMENT_REVISION}:
            return "artifacts_missing"
        if not manifest["files"] or any(not (cache / name).is_file() for name in manifest["files"]):
            return "artifacts_missing"
    except (OSError, ValueError, KeyError, TypeError):
        return "artifacts_missing"
    if free_memory() < MIN_FREE_BYTES:
        return "insufficient_memory"
    return "ready"


def verify_artifacts(cache):
    """Verify prepared bytes at worker start; never load arbitrary mutable Hub main weights."""
    root = Path(cache).resolve()
    manifest = json.loads((root / "manifest.json").read_text(encoding="utf-8"))
    for name, expected in manifest["files"].items():
        path = (root / name).resolve()
        if not path.is_relative_to(root) or not path.is_file():
            raise ValueError("Invalid artifact path")
        digest = hashlib.sha256()
        with path.open("rb") as source:
            for chunk in iter(lambda: source.read(1024 * 1024), b""):
                digest.update(chunk)
        if digest.hexdigest() != expected:
            raise ValueError("Artifact integrity check failed")


class Runtime:
    worker = WORKER
    error_prefix = "wavlm"

    def readiness(self, settings):
        return prepared(settings)

    def verify(self, cache):
        verify_artifacts(cache)

    def __init__(self):
        self.lock = Lock()
        self.process = None
        self.configuration = None
        self.loaded = False
        RUNTIMES.add(self)

    def _release_other_models(self):
        # Called only under MODEL_LOCK. Never interrupt an in-flight assessment.
        for other in list(RUNTIMES):
            if other is not self and other.process is not None:
                other.close()

    def select(self):
        """Release idle alternate language weights before the actual RAM preflight.

        Selection never loads a model or overrides either engine's memory gate.
        A busy model stays intact and callers report temporary unavailability.
        """
        if not MODEL_LOCK.acquire(blocking=False):
            return False
        try:
            self._release_other_models()
            return True
        finally:
            MODEL_LOCK.release()

    def close(self):
        if self.process:
            self.process.kill()
            try:
                self.process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                pass
            for pipe in (self.process.stdin, self.process.stdout):
                if pipe:
                    pipe.close()
        self.process = None
        self.loaded = False

    def assess(self, settings, audio, expected):
        if not getattr(settings, "pronunciation_wavlm_enabled", True):
            raise IdentityError(503, self.error_prefix + "_disabled", "Local speech processing is disabled.")
        if not MODEL_LOCK.acquire(blocking=False):
            raise IdentityError(429, self.error_prefix + "_busy", "Another recording is being processed. Try again shortly.")
        try:
            self._release_other_models()
            return self._assess(settings, audio, expected)
        finally:
            MODEL_LOCK.release()

    def _assess(self, settings, audio, expected):
        if not self.lock.acquire(blocking=False):
            raise IdentityError(429, self.error_prefix + "_busy", "Another recording is being assessed. Please try again shortly.")
        try:
            configuration = (
                settings.pronunciation_wavlm_python,
                settings.pronunciation_wavlm_cache,
                settings.pronunciation_wavlm_device,
            )
            if self.configuration != configuration:
                self.close()
                self.configuration = configuration
            if not self.process or self.process.poll() is not None:
                reason = self.readiness(settings)
                if reason != "ready":
                    raise IdentityError(
                        503, self.error_prefix + "_" + reason, "The local speech model is unavailable. No result was generated."
                    )
                try:
                    self.verify(settings.pronunciation_wavlm_cache)
                except (OSError, ValueError, KeyError, TypeError):
                    raise IdentityError(
                        503, self.error_prefix + "_artifacts_invalid", "Model files failed verification. No result was generated."
                    ) from None
                env = {
                    name: os.environ[name]
                    # PyTorch calls getpass.getuser(); Windows has no pwd fallback.
                    # Keep the OS username, never application credentials/configuration.
                    for name in ("PATH", "SYSTEMROOT", "WINDIR", "TEMP", "TMP", "USERPROFILE", "USERNAME", "USER")
                    if name in os.environ
                }
                env.update(
                    HF_HUB_OFFLINE="1",
                    TRANSFORMERS_OFFLINE="1",
                    HF_HUB_DISABLE_TELEMETRY="1",
                    PYTHONNOUSERSITE="1",
                    OMP_NUM_THREADS="2",
                )
                self.process = subprocess.Popen(
                    [configuration[0], str(self.worker), configuration[1], configuration[2]],
                    stdin=subprocess.PIPE,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.DEVNULL,
                    text=True,
                    encoding="utf-8",
                    env=env,
                    creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
                )
            with tempfile.TemporaryDirectory(prefix="fluentt-wavlm-") as directory:
                path = Path(directory) / "recording.bin"
                path.write_bytes(audio)
                self.process.stdin.write(json.dumps({"audio_path": str(path), "expected_text": expected}) + "\n")
                self.process.stdin.flush()
                queue = Queue(maxsize=1)

                def read():
                    try:
                        queue.put(self.process.stdout.readline(262145))
                    except (OSError, ValueError, AttributeError):
                        queue.put("")

                Thread(target=read, daemon=True).start()
                try:
                    line = queue.get(timeout=settings.pronunciation_wavlm_timeout_seconds)
                except Empty:
                    self.close()
                    raise IdentityError(
                        504, self.error_prefix + "_timeout", "Speech processing exceeded the server deadline. No result was saved."
                    ) from None
                if len(line) > 262144:
                    raise ValueError("Oversized model reply")
                result = json.loads(line)
                if not result.get("ok"):
                    code = result.get("error")
                    if code in {"silent_audio", "invalid_audio", "alignment_failed", "no_speech", "too_short"}:
                        raise IdentityError(
                            422,
                            self.error_prefix + "_" + code,
                            "No usable speech result. Record the full sentence audibly for 0.5–30 seconds and try again.",
                        )
                    self.close()
                    raise IdentityError(
                        503,
                        self.error_prefix + "_model_unavailable",
                        "The model could not load or assess the recording. No score was saved.",
                    )
                self.loaded = True
                return result["result"]
        except IdentityError:
            raise
        except (OSError, ValueError, KeyError, TypeError):
            self.close()
            raise IdentityError(
                503, self.error_prefix + "_model_unavailable", "Speech processing did not finish. No result was saved."
            ) from None
        finally:
            self.lock.release()


runtime = Runtime()
atexit.register(runtime.close)
