"""Reusable local stdio worker. Never logs/retains audio or performs network inference."""
import contextlib
import importlib.util
import json
import os
from pathlib import Path
import sys
import tempfile
import time
import wave

# Reuse the existing FFmpeg container/duration/silence validation.
decoder_spec = importlib.util.spec_from_file_location("fluentt_audio_decoder", Path(__file__).resolve().parents[1] / "wavlm/worker.py")
decoder_module = importlib.util.module_from_spec(decoder_spec)
decoder_spec.loader.exec_module(decoder_module)
decode = decoder_module.decode


def main():
    cache, device = sys.argv[1:3]
    os.environ.update(HF_HUB_OFFLINE="1", TRANSFORMERS_OFFLINE="1", HF_HUB_DISABLE_TELEMETRY="1")
    transcriber = None
    for line in sys.stdin:
        if len(line) > 10000:
            break
        try:
            request = json.loads(line)
            with contextlib.redirect_stdout(sys.stderr):
                import numpy as np
                with tempfile.TemporaryDirectory(prefix="mms-decoded-") as directory:
                    normalized, _ = decode(request["audio_path"], directory)
                    with wave.open(str(normalized), "rb") as source:
                        samples = np.frombuffer(source.readframes(480001), dtype="<i2").astype(np.float32) / 32768
                    initialization_ms = 0
                    if transcriber is None:
                        from pipeline import Transcriber
                        started = time.perf_counter()
                        candidate = Transcriber(cache, device)
                        candidate.load()
                        transcriber = candidate
                        initialization_ms = round((time.perf_counter() - started) * 1000)
                    output = transcriber.transcribe(samples)
                    output["initialization_ms"] = initialization_ms
            reply = {"ok": True, "result": output}
        except Exception as error:
            allowed = {"silent_audio", "invalid_audio", "no_speech", "too_short", "insufficient_memory"}
            code = str(error) if isinstance(error, ValueError) and str(error) in allowed else "model_unavailable"
            reply = {"ok": False, "error": code}
        print(json.dumps(reply, allow_nan=False, separators=(",", ":")), flush=True)


if __name__ == "__main__":
    main()
