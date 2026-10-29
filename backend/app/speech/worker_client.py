import base64
import json
from threading import BoundedSemaphore

import httpx

from app.speech.schemas import WorkerCapability


class WorkerUnavailable(Exception):
    pass


class SpeechWorkerClient:
    def __init__(self, url: str, token: str, kind: str, maximum=2, timeout=30.0):
        self.url, self.token, self.kind = url.rstrip("/"), token, kind
        self.timeout = httpx.Timeout(timeout, connect=min(5.0, timeout))
        self.gate = BoundedSemaphore(maximum)

    def _request(self, method, path, *, body=None, headers=None):
        if not self.url or not self.token or not self.gate.acquire(blocking=False):
            raise WorkerUnavailable("worker_unavailable_or_busy")
        try:
            with (
                httpx.Client(
                    timeout=self.timeout, follow_redirects=False, trust_env=False
                ) as client,
                client.stream(
                    method,
                    self.url + path,
                    content=body,
                    headers={
                        "Authorization": f"Bearer {self.token}",
                        **(headers or {}),
                    },
                ) as response,
            ):
                if response.status_code != 200:
                    raise WorkerUnavailable("worker_unavailable_or_busy")
                data = bytearray()
                for chunk in response.iter_bytes():
                    if len(data) + len(chunk) > 256_000:
                        raise WorkerUnavailable("invalid_worker_response")
                    data.extend(chunk)
                return json.loads(data)
        except (httpx.HTTPError, ValueError) as exc:
            raise WorkerUnavailable("worker_unavailable") from exc
        finally:
            self.gate.release()

    def capability(self):
        return WorkerCapability.model_validate(
            self._request("GET", "/health/capabilities")
        ).model_dump()

    def infer(self, recording, language, reference=""):
        headers = {
            "Content-Type": "application/octet-stream",
            "X-Language": language,
            "X-Audio-Sample-Rate": str(recording.sample_rate_hz),
            "X-Audio-Channels": "1",
        }
        if reference:
            headers["X-Reference-Text"] = base64.b64encode(reference.encode()).decode(
                "ascii"
            )
        path = "/v1/recognize" if self.kind == "recognition" else "/v1/assess"
        return self._request("POST", path, body=recording.pcm_le, headers=headers)
