"""Bounded M4A/AAC to canonical 16-kHz mono PCM conversion (ffmpeg-pcm16k-mono-v1).

Fixed argument arrays, no shell, no client-controlled flags. Wall-clock deadlines.
The 11-second decode output is a rejection sentinel, never an accepted length.
"""

import json
import os
import shutil
import subprocess
import threading
import time
import uuid
import wave
from dataclasses import dataclass
from pathlib import Path

PROBE_TIMEOUT_SECONDS = 2.0
CONVERT_TIMEOUT_SECONDS = 5.0
MAX_SOURCE_DURATION_SECONDS = 10.0
DECODE_SENTINEL_SECONDS = 11.0
MAX_PCM_FRAMES = 160_000  # 10 s at 16 kHz
TEMP_OUTPUT_CAP_BYTES = 356_096
ALLOWED_MIME_TYPES = {"audio/mp4", "audio/m4a", "audio/x-m4a"}


class ConverterUnavailable(Exception):
    """Missing/broken converter executable or canonical verification failure."""


class UnsupportedAudio(Exception):
    """The uploaded bytes are not a supported self-contained M4A/AAC recording."""


class DurationLimitExceeded(Exception):
    """Decoded or probed duration exceeds the ten-second P0 limit."""


@dataclass
class ConversionResult:
    wav_bytes: bytes
    frame_count: int
    source_duration_seconds: float
    sample_rate: int
    channels: int
    sample_width_bytes: int
    converter_version: str


def _run_bounded(
    argv: list[str], *, timeout: float, output_cap: int | None = None
) -> subprocess.CompletedProcess:
    try:
        process = subprocess.Popen(
            argv,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            shell=False,
            stdin=subprocess.DEVNULL,
        )
    except OSError as exc:
        raise ConverterUnavailable(f"executable not found: {argv[0]}") from exc
    exceeded = threading.Event()
    buffers = [bytearray(), bytearray()]

    def drain(stream, buffer, limit):
        while chunk := stream.read(4096):
            if len(buffer) + len(chunk) > limit:
                exceeded.set()
                return
            buffer.extend(chunk)

    readers = [
        threading.Thread(target=drain, args=(stream, buffer, limit), daemon=True)
        for stream, buffer, limit in zip(
            (process.stdout, process.stderr),
            buffers,
            (output_cap or 262_144, 4096),
            strict=True,
        )
    ]
    for reader in readers:
        reader.start()
    deadline = time.monotonic() + timeout
    try:
        while process.poll() is None:
            if exceeded.wait(0.01):
                raise ConverterUnavailable("converter output exceeded bound")
            if time.monotonic() >= deadline:
                raise ConverterUnavailable(f"converter timed out after {timeout}s")
    finally:
        if process.poll() is None:
            process.kill()
        process.wait()
        for reader in readers:
            reader.join()
        process.stdout.close()
        process.stderr.close()
    if exceeded.is_set():
        raise ConverterUnavailable("converter output exceeded bound")
    return subprocess.CompletedProcess(
        argv, process.returncode, bytes(buffers[0]), bytes(buffers[1])
    )


def probe_source(ffprobe_path: str, source_path: Path) -> dict:
    argv = [
        ffprobe_path,
        "-v",
        "error",
        "-print_format",
        "json",
        "-show_format",
        "-show_streams",
        "-protocol_whitelist",
        "file",
        "-enable_drefs",
        "0",
        "-use_absolute_path",
        "0",
        str(source_path),
    ]
    process = _run_bounded(argv, timeout=PROBE_TIMEOUT_SECONDS, output_cap=262_144)
    if process.returncode != 0:
        raise UnsupportedAudio("ffprobe rejected input")
    try:
        data = json.loads(process.stdout)
    except ValueError as exc:
        raise UnsupportedAudio("ffprobe returned non-JSON") from exc
    streams = data.get("streams")
    if not isinstance(streams, list):
        raise UnsupportedAudio("ffprobe returned no streams")
    audio_streams = [s for s in streams if s.get("codec_type") == "audio"]
    other_streams = [s for s in streams if s.get("codec_type") != "audio"]
    if len(audio_streams) != 1 or other_streams:
        raise UnsupportedAudio("input must contain exactly one audio stream")
    audio = audio_streams[0]
    if audio.get("codec_name") != "aac":
        raise UnsupportedAudio("audio stream is not AAC")
    if audio.get("disposition", {}).get("attached_pic"):
        raise UnsupportedAudio("attached picture stream present")
    try:
        duration = float(data.get("format", {}).get("duration"))
    except (TypeError, ValueError) as exc:
        raise UnsupportedAudio("missing or invalid source duration") from exc
    if not duration > 0 or duration > MAX_SOURCE_DURATION_SECONDS:
        raise DurationLimitExceeded("source duration outside (0,10] seconds")
    return {
        "duration_seconds": duration,
        "sample_rate": int(audio.get("sample_rate") or 0),
        "channels": int(audio.get("channels") or 0),
    }


def verify_canonical_wav(wav_bytes: bytes) -> dict:
    """Independent standard-library verification of the converted PCM."""
    if len(wav_bytes) > TEMP_OUTPUT_CAP_BYTES:
        raise ConverterUnavailable("converted WAV exceeds temporary output cap")
    import io

    try:
        with wave.open(io.BytesIO(wav_bytes), "rb") as reader:
            channels = reader.getnchannels()
            sample_width = reader.getsampwidth()
            sample_rate = reader.getframerate()
            frames = reader.getnframes()
            comptype = reader.getcomptype()
    except (wave.Error, EOFError) as exc:
        raise ConverterUnavailable("converted output is not valid RIFF/WAVE") from exc
    if frames > MAX_PCM_FRAMES:
        raise DurationLimitExceeded("decoded frames exceed ten-second limit")
    if (
        comptype != "NONE"
        or sample_rate != 16_000
        or sample_width != 2
        or channels != 1
        or frames < 1
    ):
        raise ConverterUnavailable(
            "converted output is not bounded 16-kHz 16-bit mono PCM"
        )
    return {
        "frame_count": frames,
        "sample_rate": sample_rate,
        "channels": channels,
        "sample_width_bytes": sample_width,
    }


def convert_to_wav(
    source_bytes: bytes,
    *,
    ffmpeg_path: str,
    ffprobe_path: str,
    workspace_root: str | None = None,
) -> ConversionResult:
    if not source_bytes:
        raise UnsupportedAudio("empty upload")
    root = Path(workspace_root or tempfile_root())
    job_dir = root / f"job-{uuid.uuid4().hex}"
    job_dir.mkdir(parents=True, exist_ok=False)
    source_path = job_dir / "source.m4a"
    output_path = job_dir / "canonical.wav"
    try:
        source_path.write_bytes(source_bytes)
        probe = probe_source(ffprobe_path, source_path)
        argv = [
            ffmpeg_path,
            "-nostdin",
            "-hide_banner",
            "-loglevel",
            "error",
            "-protocol_whitelist",
            "file",
            "-f",
            "mov",
            "-enable_drefs",
            "0",
            "-use_absolute_path",
            "0",
            "-i",
            str(source_path),
            "-map",
            "0:a:0",
            "-vn",
            "-sn",
            "-dn",
            "-map_metadata",
            "-1",
            "-map_chapters",
            "-1",
            "-ac",
            "1",
            "-ar",
            "16000",
            "-c:a",
            "pcm_s16le",
            "-t",
            str(DECODE_SENTINEL_SECONDS),
            "-f",
            "wav",
            "-fs",
            str(TEMP_OUTPUT_CAP_BYTES),
            "-n",
            str(output_path),
        ]
        process = _run_bounded(
            argv, timeout=CONVERT_TIMEOUT_SECONDS, output_cap=TEMP_OUTPUT_CAP_BYTES
        )
        if process.returncode != 0:
            raise UnsupportedAudio("decoder rejected input")
        if not output_path.is_file() or output_path.stat().st_size < 1:
            raise UnsupportedAudio("decoder produced no output")
        if output_path.stat().st_size > TEMP_OUTPUT_CAP_BYTES:
            raise DurationLimitExceeded("decoded output exceeded sentinel bound")
        wav_bytes = output_path.read_bytes()
        verified = verify_canonical_wav(wav_bytes)
        if verified["frame_count"] > MAX_PCM_FRAMES:
            raise DurationLimitExceeded("decoded frames exceed ten-second limit")
        return ConversionResult(
            wav_bytes=wav_bytes,
            frame_count=verified["frame_count"],
            source_duration_seconds=probe["duration_seconds"],
            sample_rate=verified["sample_rate"],
            channels=verified["channels"],
            sample_width_bytes=verified["sample_width_bytes"],
            converter_version=converter_version(ffmpeg_path),
        )
    finally:
        shutil.rmtree(job_dir, ignore_errors=True)


def converter_version(ffmpeg_path: str) -> str:
    process = _run_bounded([ffmpeg_path, "-version"], timeout=PROBE_TIMEOUT_SECONDS)
    first_line = process.stdout.decode("utf-8", errors="replace").splitlines()
    return first_line[0][:128] if first_line else "unknown"


def tempfile_root() -> str:
    import tempfile

    return os.path.join(tempfile.gettempdir(), "fluentt-pronunciation")


def cleanup_orphan_jobs(
    workspace_root: str | None = None, *, max_age_seconds: int = 300
) -> int:
    """Expire stale per-job directories older than the five-minute bound."""
    root = Path(workspace_root or tempfile_root())
    if not root.is_dir():
        return 0
    removed = 0
    cutoff = time.time() - max_age_seconds
    for entry in root.iterdir():
        if not entry.is_dir() or not entry.name.startswith("job-"):
            continue
        try:
            if entry.stat().st_mtime < cutoff:
                shutil.rmtree(entry, ignore_errors=True)
                removed += 1
        except OSError:
            continue
    return removed
