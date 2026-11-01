"""GPL-3.0. Offline paired-decoder benchmark. No scoring or network downloads."""
import argparse
import hashlib
import json
from pathlib import Path
import sys
import time


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--pilot", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    import psutil
    if psutil.virtual_memory().available < 4 * 1024**3:
        raise RuntimeError("insufficient_memory_before_import")
    started = time.perf_counter()
    import torch
    import numpy as np
    torch.set_num_threads(2)
    torch.set_num_interop_threads(1)
    torch.manual_seed(20261030)
    np.random.seed(20261030)
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from allosaurus_stage2.audio import validate_audio
    from allosaurus_stage2.decoder import PhoneDecoder
    from allosaurus.app import read_recognizer
    from allosaurus.am.utils import move_to_tensor
    from allosaurus.audio import read_audio
    import allosaurus.app
    import allosaurus.lm.decoder
    if sha(allosaurus.lm.decoder.__file__) != "5f690d4d699bb2bbe9b04012ea65878299d413ea7574e3a870b94518e4722e82":
        raise ValueError("Unexpected upstream decoder version")
    # Fail offline rather than fetching weights with unresolved redistribution terms.
    def forbidden(*_args, **_kwargs):
        raise RuntimeError("Model download forbidden")
    allosaurus.app.download_model = forbidden
    model_root = Path(allosaurus.app.__file__).parent / "pretrained/uni2005"
    manifest = json.loads((args.pilot / "model-files.json").read_text())
    for name, record in manifest.items():
        file = (model_root / name).resolve()
        if not file.is_relative_to(model_root.resolve()) or sha(file) != record["sha256"]:
            raise ValueError("Local checkpoint integrity failure")
    load_start = time.perf_counter()
    model = read_recognizer("uni2005")
    model.am.eval()
    loaded = time.perf_counter()
    original = model.lm
    fixed = PhoneDecoder(model_root, original.config)
    rows = json.loads((args.pilot / "samples.json").read_text(encoding="utf-8"))
    args.output.mkdir(parents=True, exist_ok=True)
    if (args.output / "predictions.json").exists() or list(args.output.glob("*.npy")):
        raise ValueError("Use fresh evidence storage; previous raw predictions must not be overwritten")
    # A real, short excerpt tests execution only, not a complete word or sentence.
    import wave
    short = args.output / "real-short-excerpt.wav"
    with wave.open(rows[1]["wav"], "rb") as source:
        source.setpos(16000)
        samples = source.readframes(4800)
    with wave.open(str(short), "wb") as target:
        target.setparams((1, 2, 8000, 0, "NONE", "not compressed"))
        target.writeframes(samples)
    rows.append({"id": "1930-excerpt-2.0-to-2.6s", "wav": str(short), "wav_sha256": sha(short),
                 "text": None})
    results = []
    with torch.inference_mode():
        for row in rows:
            assert sha(row["wav"]) == row["wav_sha256"]
            metadata = validate_audio(row["wav"])
            begin = time.perf_counter()
            features = model.pm.compute(read_audio(str(row["wav"])))
            batch, lengths = move_to_tensor([np.expand_dims(features, 0), np.array([len(features)], dtype=np.int32)], -1)
            logits = model.am(batch, lengths)[0].detach().cpu().numpy().copy()
            acoustic_ms = round((time.perf_counter() - begin) * 1000, 3)
            logit_file = args.output / (row["id"] + ".logits.npy")
            np.save(logit_file, logits, allow_pickle=False)
            begin = time.perf_counter()
            raw = original.compute(logits.copy(), lang_id="tgl")
            raw_ms = (time.perf_counter() - begin) * 1000
            begin = time.perf_counter()
            corrected = fixed.compute(logits.copy(), lang_id="tgl")
            fixed_ms = (time.perf_counter() - begin) * 1000
            mask = original.inventory.get_mask("tgl", approximation=False)
            frame_labels = np.argmax(mask.mask_logits(logits.copy()), axis=-1).tolist()
            # Independent oracle: group all frame labels, then drop blanks.
            from itertools import groupby
            oracle_ids = [label for label, _ in groupby(frame_labels) if label != 0]
            oracle = " ".join(mask.get_units(oracle_ids))
            if corrected != oracle:
                raise AssertionError("Corrected decoder disagrees with CTC frame oracle")
            np.save(args.output / (row["id"] + ".frame-labels.npy"), frame_labels, allow_pickle=False)
            results.append({"id": row["id"], "reference_text_for_display_only": row.get("text"),
                            **metadata, "audio_sha256": row["wav_sha256"],
                            "raw_upstream_phones": raw, "corrected_ctc_phones": corrected,
                            "postprocessed_phones": None, "oracle_matches": True,
                            "acoustic_ms": acoustic_ms, "raw_decode_ms": round(raw_ms, 3),
                            "corrected_decode_ms": round(fixed_ms, 3),
                            "logits_sha256": sha(logit_file)})
    result = {"model": "uni2005", "checkpoint_sha256": sha(model_root / "model.pt"),
              "decoder_sha256": sha(Path(__file__).with_name("decoder.py")),
              "decoder_policy": "ctc-blank-reset-v1", "postprocessing": "none",
              "load_ms": round((loaded - load_start) * 1000, 3),
              "startup_through_load_ms": round((loaded - started) * 1000), "results": results,
              "gold_phone_evaluation": {"status": "blocked", "reason": "no_verified_independent_matching_labels"}}
    (args.output / "predictions.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"load_ms": result["load_ms"], "actual_clips": len(results), "output_saved": True}))


if __name__ == "__main__":
    main()
