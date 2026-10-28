"""Explicit real-model check; refuse unsafe low-memory loads. Never generate participant records."""

import argparse
import contextlib
import json
from pathlib import Path
import sys
import tempfile
import time


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--cache", type=Path, required=True)
    parser.add_argument("--audio", type=Path, required=True)
    parser.add_argument("--text", required=True)
    parser.add_argument("--device", choices=["cpu", "cuda:0"], default="cpu")
    args = parser.parse_args()
    import psutil

    available = psutil.virtual_memory().available
    if available < 4 * 1024**3:
        print(
            json.dumps(
                {
                    "status": "BLOCKED",
                    "reason": "insufficient_free_memory",
                    "free_memory_bytes": available,
                    "minimum_free_memory_bytes": 4 * 1024**3,
                    "model_loaded": False,
                    "inference_latency_ms": None,
                    "model_rss_bytes": None,
                }
            )
        )
        return 2
    with contextlib.redirect_stdout(sys.stderr):
        from pipeline import PronunciationAssessorV2
        from worker import decode

        start = time.perf_counter()
        assessor = PronunciationAssessorV2(args.cache, args.device)
        assessor._load_models()
        initialization_ms = round((time.perf_counter() - start) * 1000)
        with tempfile.TemporaryDirectory(prefix="wavlm-benchmark-") as directory:
            audio, duration = decode(args.audio, directory)
            timings = []
            for _ in range(2):
                start = time.perf_counter()
                result = assessor.assess(str(audio), args.text)
                timings.append(round((time.perf_counter() - start) * 1000))
        if result.get("error") or not result.get("words"):
            raise RuntimeError("No complete assessment")
    print(
        json.dumps(
            {
                "status": "executed_unvalidated_model",
                "initialization_ms": initialization_ms,
                "first_inference_ms": timings[0],
                "warm_inference_ms": timings[1],
                "duration_ms": duration,
                "resident_memory_bytes": psutil.Process().memory_info().rss,
                "prediction": result,
            },
            allow_nan=False,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
