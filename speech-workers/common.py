"""Private worker transport. Imports no ML stack until an artifact is configured."""

import base64
import hashlib
import hmac
import json
import os
from dataclasses import dataclass
from pathlib import Path
from threading import Lock

from app.speech.audio import MAX_BYTES, parse_pcm16
from app.speech.schemas import (
    AssessmentPrediction,
    RecognitionPrediction,
    WorkerCapability,
)
from fastapi import FastAPI, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from pydantic import ValidationError

os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["TRANSFORMERS_OFFLINE"] = "1"
os.environ["HF_HUB_DISABLE_TELEMETRY"] = "1"


@dataclass(frozen=True)
class ArtifactManifest:
    root: Path
    model_id: str
    model_revision: str

    @classmethod
    def load(cls, root: Path):
        root = root.resolve()
        try:
            raw = json.loads((root / "manifest.json").read_text(encoding="utf-8"))
            files = raw["files"]
            if not isinstance(files, dict) or not files:
                raise ValueError("empty_manifest")
            actual = {
                str(p.relative_to(root)).replace("\\", "/")
                for p in root.rglob("*")
                if p.is_file() and p.name != "manifest.json"
            }
            if actual != set(files):
                raise ValueError("incomplete_manifest")
            for name, digest in files.items():
                path = root / name
                if path.is_symlink() or root not in path.resolve().parents:
                    raise ValueError("unsafe_artifact_path")
                with path.open("rb") as source:
                    actual_digest = hashlib.file_digest(source, "sha256").hexdigest()
                if not isinstance(digest, str) or not hmac.compare_digest(
                    actual_digest, digest
                ):
                    raise ValueError("artifact_checksum_mismatch")
            if not all(
                isinstance(raw.get(k), str) and raw[k].strip()
                for k in ("model_id", "model_revision")
            ):
                raise ValueError("invalid_identity")
            return cls(root, raw["model_id"], raw["model_revision"])
        except (OSError, KeyError, TypeError, json.JSONDecodeError) as exc:
            raise ValueError("artifacts_unavailable") from exc


async def read_audio(request: Request) -> bytes:
    if (
        request.headers.get("content-type", "").split(";")[0]
        != "application/octet-stream"
    ):
        raise HTTPException(415, "Use PCM audio.")
    size = 0
    chunks = []
    async for chunk in request.stream():
        size += len(chunk)
        if size > MAX_BYTES:
            raise HTTPException(413, "Recording is too large.")
        chunks.append(chunk)
    return b"".join(chunks)


class ArtifactRuntime:
    def __init__(self, kind: str):
        self.kind = kind
        self.manifest = None
        self.model = None
        self.lock = Lock()

    def capability(self):
        if not self.lock.acquire(blocking=False):
            raise ValueError("model_preparing")
        try:
            if self.manifest is None:
                directory = os.environ.get("SPEECH_MODEL_DIR")
                if not directory:
                    raise ValueError("artifacts_unavailable")
                manifest = ArtifactManifest.load(Path(directory))
                root = manifest.root
                if self.kind == "recognition":
                    required = ["config.json", "preprocessor_config.json", "vocab.json"]
                    weights = root
                else:
                    required = [
                        "scorer/wavlm_finetuned.pt",
                        "backbone/config.json",
                        "backbone/preprocessor_config.json",
                        "alignment/config.json",
                        "alignment/preprocessor_config.json",
                        "alignment/vocab.json",
                        "nltk_data/corpora/cmudict.zip",
                        "nltk_data/taggers/averaged_perceptron_tagger.zip",
                        "nltk_data/taggers/averaged_perceptron_tagger_eng",
                    ]
                    weights = root / "alignment"
                if not all((root / name).exists() for name in required) or not any(
                    (weights / name).is_file()
                    for name in [
                        "model.safetensors",
                        "model.safetensors.index.json",
                        "pytorch_model.bin",
                        "pytorch_model.bin.index.json",
                    ]
                ):
                    raise ValueError("model_resources_unavailable")
                self.manifest = manifest
            return {
                "ready": True,
                "language_code": "en",
                "model_id": self.manifest.model_id,
                "model_revision": self.manifest.model_revision,
                "validation_status": "unvalidated_model_prediction",
            }
        finally:
            self.lock.release()

    def identity(self):
        cap = self.capability()
        return {k: cap[k] for k in ("model_id", "model_revision", "validation_status")}


def create_worker_app(kind: str, runtime, token: str | None = None) -> FastAPI:
    app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
    gate = (
        Lock()
    )  # Serialized inference, zero waiting queue; held until inference ends.

    def authorize(request):
        secret = (
            token if token is not None else os.environ.get("SPEECH_SERVICE_TOKEN", "")
        )
        if not secret or not hmac.compare_digest(
            request.headers.get("authorization", "").encode(),
            f"Bearer {secret}".encode(),
        ):
            raise HTTPException(401, "Worker authentication required.")

    @app.middleware("http")
    async def no_store(request, call_next):
        response = await call_next(request)
        response.headers["Cache-Control"] = "no-store"
        return response

    @app.get("/health/capabilities")
    async def health(request: Request):
        authorize(request)
        try:
            return WorkerCapability.model_validate(
                await run_in_threadpool(runtime.capability)
            )
        except Exception:  # noqa: BLE001 -- Isolate optional runtime/library failures without echoing model input.
            raise HTTPException(503, "Model is unavailable.") from None

    def infer(recording, reference):
        if not gate.acquire(blocking=False):
            raise HTTPException(503, "Model is busy.", headers={"Retry-After": "2"})
        try:
            runtime.capability()
            raw = runtime.infer(recording, reference)
            schema = (
                RecognitionPrediction if kind == "recognition" else AssessmentPrediction
            )
            result = schema.model_validate(raw)
            if result.validation_status != "unvalidated_model_prediction":
                raise ValueError("Candidate cannot assert validation")
            return result
        except HTTPException:
            raise
        except Exception:  # noqa: BLE001 -- Native model libraries have heterogeneous errors; fail closed at this boundary.
            raise HTTPException(
                503, "Model could not process this recording."
            ) from None
        finally:
            gate.release()

    @app.post("/v1/recognize" if kind == "recognition" else "/v1/assess")
    async def process(request: Request):
        authorize(request)
        if request.headers.get("x-language") != "en":
            raise HTTPException(422, "Language is unavailable.")
        body = await read_audio(request)
        try:
            recording = parse_pcm16(
                body,
                int(request.headers.get("x-audio-sample-rate", "0")),
                int(request.headers.get("x-audio-channels", "0")),
            )
            reference = ""
            if kind == "assessment":
                reference = base64.b64decode(
                    request.headers.get("x-reference-text", ""), validate=True
                ).decode("utf-8")
                if not reference or len(reference) > 500:
                    raise ValueError("Invalid reference")
        except (ValueError, UnicodeError, ValidationError):
            raise HTTPException(422, "Recording or reference is invalid.") from None
        return await run_in_threadpool(infer, recording, reference)

    return app
