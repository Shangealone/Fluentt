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

from app.modules.identity.errors import IdentityError
from .wavlm_contract import REVISION, BASE_REVISION, ALIGNMENT_REVISION

MIN_FREE_BYTES = 4 * 1024**3
WORKER = Path(__file__).resolve().parents[3] / "ml/wavlm/worker.py"


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
    def __init__(self):
        self.lock = Lock()
        self.process = None
        self.configuration = None
        self.loaded = False

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
        if not self.lock.acquire(blocking=False):
            raise IdentityError(429, "wavlm_busy", "Another recording is being assessed. Please try again shortly.")
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
                reason = prepared(settings)
                if reason != "ready":
                    raise IdentityError(
                        503, "wavlm_" + reason, "English acoustic scoring is unavailable. No score was generated."
                    )
                try:
                    verify_artifacts(settings.pronunciation_wavlm_cache)
                except (OSError, ValueError, KeyError, TypeError):
                    raise IdentityError(
                        503, "wavlm_artifacts_invalid", "Model files failed verification. No score was generated."
                    ) from None
                env = {
                    name: os.environ[name]
                    for name in ("PATH", "SYSTEMROOT", "WINDIR", "TEMP", "TMP", "USERPROFILE")
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
                    [configuration[0], str(WORKER), configuration[1], configuration[2]],
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
                        504, "wavlm_timeout", "Scoring exceeded the server deadline. No score was saved."
                    ) from None
                if len(line) > 262144:
                    raise ValueError("Oversized model reply")
                result = json.loads(line)
                if not result.get("ok"):
                    code = result.get("error")
                    if code in {"silent_audio", "invalid_audio", "alignment_failed"}:
                        raise IdentityError(
                            422,
                            "wavlm_" + code,
                            "This recording could not be aligned. Record the full English sentence again.",
                        )
                    self.close()
                    raise IdentityError(
                        503,
                        "wavlm_model_unavailable",
                        "The model could not load or assess the recording. No score was saved.",
                    )
                self.loaded = True
                return result["result"]
        except IdentityError:
            raise
        except (OSError, ValueError, KeyError, TypeError):
            self.close()
            raise IdentityError(
                503, "wavlm_model_unavailable", "English acoustic scoring did not finish. No score was saved."
            ) from None
        finally:
            self.lock.release()


runtime = Runtime()
atexit.register(runtime.close)
