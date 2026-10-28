"""Local stdio worker, no network listener. Audio is temporary and never logged."""

import contextlib
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import wave


def decode(path, directory):
    import imageio_ffmpeg
    import numpy as np

    result = subprocess.run(
        [
            imageio_ffmpeg.get_ffmpeg_exe(),
            "-nostdin",
            "-hide_banner",
            "-loglevel",
            "error",
            "-protocol_whitelist",
            "file,pipe",
            "-i",
            str(path),
            "-t",
            "31",
            "-vn",
            "-ac",
            "1",
            "-ar",
            "16000",
            "-c:a",
            "pcm_s16le",
            "-f",
            "wav",
            "pipe:1",
        ],
        capture_output=True,
        timeout=20,
        check=True,
        creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
    )
    if len(result.stdout) > 1_010_000:
        raise ValueError("invalid_audio")
    # FFmpeg pipe WAV headers can use unknown lengths: count the actual decoded frames.
    with wave.open(io.BytesIO(result.stdout), "rb") as source:
        pcm = source.readframes(496001)
    samples = np.frombuffer(pcm, dtype="<i2").astype(np.float32) / 32768
    if not 8000 <= len(samples) <= 480000:
        raise ValueError("invalid_audio")
    if float(np.std(samples)) < 0.0005:
        raise ValueError("silent_audio")
    output = Path(directory) / "normalized.wav"
    with wave.open(str(output), "wb") as target:
        target.setparams((1, 2, 16000, 0, "NONE", "not compressed"))
        target.writeframes(pcm)
    return output, round(len(samples) / 16)


def main():
    cache, device = sys.argv[1:3]
    assessor = None
    # No request can trigger HF/NLTK downloads. Setup is an explicit separate command.
    os.environ["HF_HUB_OFFLINE"] = "1"
    os.environ["TRANSFORMERS_OFFLINE"] = "1"
    for line in sys.stdin:
        if len(line) > 10000:
            break
        try:
            request = json.loads(line)
            initialization_ms = 0
            with contextlib.redirect_stdout(sys.stderr):
                if assessor is None:
                    start = time.perf_counter()
                    import torch
                    from pipeline import PronunciationAssessorV2

                    torch.set_num_threads(2)
                    assessor = PronunciationAssessorV2(cache, device=device)
                    assessor._load_models()
                    initialization_ms = round((time.perf_counter() - start) * 1000)
                start = time.perf_counter()
                with tempfile.TemporaryDirectory(prefix="wavlm-decoded-") as directory:
                    normalized, duration = decode(request["audio_path"], directory)
                    raw = assessor.assess(str(normalized), request["expected_text"])
                if raw.get("error") or not raw.get("words"):
                    raise ValueError("alignment_failed")
                words = [
                    {
                        "word": w["word"],
                        "score": float(w["score"]),
                        "phonemes": [
                            {
                                "phone": p["phone"],
                                "score": float(p["score"]),
                                "pherr_prob": float(p["pherr_prob"]),
                                "error": bool(p["error"]),
                            }
                            for p in w["phonemes"]
                        ],
                    }
                    for w in raw["words"]
                ]
                output = {
                    "overall_score": float(raw["overall_score"]),
                    "n_errors": int(raw["n_errors"]),
                    "words": words,
                    "duration_ms": duration,
                    "processing_duration_ms": round((time.perf_counter() - start) * 1000),
                    "initialization_ms": initialization_ms,
                }
            reply = {"ok": True, "result": output}
        except Exception as error:
            code = (
                str(error)
                if isinstance(error, ValueError) and str(error) in {"silent_audio", "invalid_audio", "alignment_failed"}
                else "model_unavailable"
            )
            reply = {"ok": False, "error": code}
        print(json.dumps(reply, allow_nan=False, separators=(",", ":")), flush=True)


if __name__ == "__main__":
    main()
