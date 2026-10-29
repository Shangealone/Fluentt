"""Bounded little-endian PCM16 input; no file or model dependencies."""

import struct
from dataclasses import dataclass

MAX_BYTES = 1_000_000
MAX_SECONDS = 10


@dataclass(frozen=True)
class PCMRecording:
    pcm_le: bytes
    sample_rate_hz: int
    channels: int
    duration_ms: int


def parse_pcm16(body: bytes, sample_rate_hz: int, channels: int) -> PCMRecording:
    if channels != 1 or not 8000 <= sample_rate_hz <= 48000:
        raise ValueError("unsupported_audio_format")
    if not body or len(body) % 2 or len(body) > MAX_BYTES:
        raise ValueError("invalid_audio")
    samples = len(body) // 2
    if samples > sample_rate_hz * MAX_SECONDS:
        raise ValueError("audio_too_long")
    # Reject digital silence, not quiet learners. No amplitude-based grading.
    if not any(sample for (sample,) in struct.iter_unpack("<h", body)):
        raise ValueError("silent_audio")
    return PCMRecording(body, sample_rate_hz, 1, round(samples * 1000 / sample_rate_hz))
