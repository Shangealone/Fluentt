"""Explicit local corpus evaluation. JSON contains no audio paths or transcript text.

Manifest: dataset, revision, split, training_overlap, items[{id,audio,text,...}].
English items optionally contain human_overall_100 and words[{text,accuracy,
phones,phones-accuracy}] using SpeechOcean's 0–10 word and 0–2 phone scales.
Only exact phone/token matches are compared; coverage and failures are reported.
"""
import argparse
import contextlib
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import sys
import tempfile
import threading
import time


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--language", choices=["english", "tagalog"], required=True)
    parser.add_argument("--cache", type=Path, required=True)
    parser.add_argument("--dataset", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    import psutil
    available = psutil.virtual_memory().available
    minimum = (5 if args.language == "english" else 8) * 1024**3
    if available < minimum:
        result = {"status": "blocked", "reason": "insufficient_free_memory", "model_loaded": False,
                  "free_memory_bytes": available, "minimum_free_memory_bytes": minimum}
        args.output.write_text(json.dumps(result, indent=2), encoding="utf-8")
        print(json.dumps(result))
        return 2
    dataset = json.loads(args.dataset.read_text(encoding="utf-8-sig"))
    if not dataset["items"] or len(dataset["items"]) > 10000:
        raise ValueError("Invalid bounded evaluation manifest")
    os.environ.update(HF_HUB_OFFLINE="1", TRANSFORMERS_OFFLINE="1", HF_HUB_DISABLE_TELEMETRY="1", OMP_NUM_THREADS="2")
    api = Path(__file__).resolve().parents[1]
    sys.path.insert(0, str(api))
    sys.path.insert(0, str(api / "ml" / ("wavlm" if args.language == "english" else "mms")))
    decoder_spec = importlib.util.spec_from_file_location("evaluation_audio_decoder", api / "ml/wavlm/worker.py")
    decoder = importlib.util.module_from_spec(decoder_spec)
    decoder_spec.loader.exec_module(decoder)
    process = psutil.Process()
    peak, low = process.memory_info().rss, available
    stop = threading.Event()

    def sample():
        nonlocal peak, low
        while not stop.wait(.1):
            peak = max(peak, process.memory_info().rss)
            low = min(low, psutil.virtual_memory().available)
            if low < 512 * 1024**2:
                os._exit(3)  # Stop only this checker under critical host memory pressure.

    monitor = threading.Thread(target=sample, daemon=True)
    monitor.start()
    rows, pairs, absolute_errors = [], [], {"overall": [], "word": [], "phoneme": []}
    try:
        with contextlib.redirect_stdout(sys.stderr):
            started = time.perf_counter()
            if args.language == "english":
                from ml.mms.artifacts import sha256
                from prepare import REVISIONS
                from pipeline import PronunciationAssessorV2
                manifest = json.loads((args.cache / "manifest.json").read_text(encoding="utf-8"))
                if manifest["revisions"] != REVISIONS:
                    raise ValueError("Unpinned English artifacts")
                for name, digest in manifest["files"].items():
                    artifact = (args.cache / name).resolve()
                    if not artifact.is_relative_to(args.cache.resolve()) or sha256(artifact) != digest:
                        raise ValueError("English artifact integrity failure")
                model = PronunciationAssessorV2(args.cache, "cpu")
                model._load_models()
            else:
                from pipeline import Transcriber
                model = Transcriber(args.cache)
                model.load()
            initialization = round((time.perf_counter() - started) * 1000)
            for item in dataset["items"]:
                path = (args.dataset.parent / item["audio"]).resolve()
                if not path.is_relative_to(args.dataset.parent.resolve()):
                    raise ValueError("Evaluation audio must be inside the manifest directory")
                row = {"id": str(item["id"]), "audio_sha256": hashlib.sha256(path.read_bytes()).hexdigest()}
                try:
                    started = time.perf_counter()
                    with tempfile.TemporaryDirectory(prefix="fluentt-evaluation-") as directory:
                        normalized, duration = decoder.decode(path, directory)
                        if args.language == "english":
                            raw = model.assess(str(normalized), item["text"])
                            from types import SimpleNamespace
                            expected_words = re.findall(r"[A-Za-z]+(?:'[A-Za-z]+)?", item["text"])
                            if raw.get("error") or not raw.get("words") or [word["word"].casefold() for word in raw["words"]] != [word.casefold() for word in expected_words]:
                                raise ValueError("Incomplete reference alignment")
                            value = SimpleNamespace(overall_score=raw["overall_score"], words=[SimpleNamespace(
                                **(word | {"phonemes": [SimpleNamespace(**phone) for phone in word["phonemes"]]})) for word in raw["words"]])
                            row.update(overall_prediction=value.overall_score, words=len(value.words),
                                       phonemes=sum(len(word.phonemes) for word in value.words))
                            if "human_overall_100" in item:
                                absolute_errors["overall"].append(abs(value.overall_score - item["human_overall_100"]))
                            annotations = item.get("words", [])
                            if [word.word.casefold() for word in value.words] == [word["text"].casefold() for word in annotations]:
                                for word, annotation in zip(value.words, annotations):
                                    absolute_errors["word"].append(abs(word.score - annotation["accuracy"] * 10))
                                    expected = [re.sub(r"\d", "", phone).lower() for phone in annotation["phones"]]
                                    if [phone.phone for phone in word.phonemes] == expected:
                                        absolute_errors["phoneme"].extend(abs(phone.score - label * 50) for phone, label in zip(word.phonemes, annotation["phones-accuracy"]))
                        else:
                            import wave
                            import numpy as np
                            with wave.open(str(normalized), "rb") as source:
                                samples = np.frombuffer(source.readframes(480001), dtype="<i2").astype(np.float32) / 32768
                            value = model.transcribe(samples)
                            pairs.append((item["text"], value["transcript"]))
                    row.update(status="executed", inference_ms=round((time.perf_counter() - started) * 1000))
                except Exception as error:
                    row.update(status="failed", error_type=type(error).__name__)
                rows.append(row)
    finally:
        stop.set()
        monitor.join(timeout=1)
    result = {
        "status": "executed_unvalidated_model", "language": args.language,
        "dataset": dataset["dataset"], "dataset_revision": dataset["revision"], "split": dataset["split"],
        "training_overlap": dataset.get("training_overlap", "unknown"),
        "initialization_ms": initialization, "peak_sampled_rss_bytes": peak, "minimum_available_bytes": low,
        "sample_interval_ms": 100, "rows": rows,
        "successful": sum(row["status"] == "executed" for row in rows), "attempted": len(rows),
    }
    if args.language == "tagalog" and pairs:
        from app.modules.pronunciation.validation_metrics import asr_metrics
        result["asr"] = asr_metrics(pairs)
    elif args.language == "english":
        result["diagnostic_mae_100"] = {key: {"n": len(values), "mae": sum(values)/len(values) if values else None}
                                       for key, values in absolute_errors.items()}
    args.output.write_text(json.dumps(result, indent=2, allow_nan=False), encoding="utf-8")
    print(json.dumps(result, allow_nan=False))
    return 0 if result["successful"] == len(rows) else 1


if __name__ == "__main__":
    raise SystemExit(main())
