"""Shared FIXTURE stand-ins for the provider/converter used across test modules.

These replace live Azure/ffmpeg execution so unit and error tests stay hermetic.
No test using these performs a network or subprocess call.
"""

from app.pronunciation import azure_adapter, converter
from tests.pronunciation_helpers import scorable_payload


class FakeProvider:
    """FIXTURE standing in for azure_adapter.assess_utterance (no network)."""

    def __init__(self) -> None:
        self.calls = 0
        self.references: list[str] = []
        self.body = lambda reference_text: scorable_payload(reference_text)
        self.error: Exception | None = None

    def __call__(
        self,
        wav_bytes: bytes,
        *,
        reference_text: str,
        endpoint: str,
        key: str,
        region: str,
        timeout_seconds: float = 20.0,
        client=None,
    ):
        self.calls += 1
        self.references.append(reference_text)
        if self.error is not None:
            raise self.error
        body = self.body(reference_text)
        return azure_adapter.parse_provider_payload(body)


class FakeConverter:
    """FIXTURE standing in for converter.convert_to_wav (no ffmpeg)."""

    def __init__(self) -> None:
        self.calls = 0
        self.error: Exception | None = None

    def __call__(
        self,
        source_bytes: bytes,
        *,
        ffmpeg_path: str,
        ffprobe_path: str,
        workspace_root: str | None = None,
    ) -> converter.ConversionResult:
        self.calls += 1
        if self.error is not None:
            raise self.error
        return converter.ConversionResult(
            wav_bytes=b"RIFF" + bytes(64),
            frame_count=16_000,
            source_duration_seconds=1.5,
            sample_rate=16_000,
            channels=1,
            sample_width_bytes=2,
            converter_version="fixture-ffmpeg-version",
        )
