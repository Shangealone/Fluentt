"""Read-only, deterministic Phase 4 reference inventory. No speech inference."""
import argparse
from collections import Counter, defaultdict
import csv
import json
from pathlib import Path
import random
import re

from .diagnose_phase3 import clean_phone, match_phones
from .evaluate import REVISION, sha


VOWELS = {"aa", "ae", "ah", "ao", "aw", "ax", "ay", "eh", "er", "ey", "ih", "iy", "ir", "ow", "oy", "uh", "uw", "ur"}


def cmudict_entries(path):
    entries = defaultdict(list)
    for line in path.read_text(encoding="latin-1").splitlines():
        if line.startswith(";;;") or not line.strip():
            continue
        parts = line.split()
        if len(parts) >= 3 and parts[1].isdigit():
            entries[parts[0]].append(parts[2:])
    return entries


def subsequence(shorter, longer):
    it = iter(longer)
    return all(any(candidate == phone for candidate in it) for phone in shorter)


def pattern(dataset, model):
    """Observable string pattern only; never an accepted-variant decision."""
    if [p for p in dataset if p != "r"] == [p for p in model if p != "r"]:
        return "rhotic_segment_difference"
    if len(dataset) == len(model):
        changes = [(a, b) for a, b in zip(dataset, model) if a != b]
        if len(changes) == 1 and all(p in VOWELS for p in changes[0]):
            return "single_vowel_symbol_difference"
        if len(changes) > 1 and all(a in VOWELS and b in VOWELS for a, b in changes):
            return "multiple_vowel_symbol_differences"
        return "mixed_or_consonant_substitution"
    if abs(len(dataset) - len(model)) == 1 and subsequence(min((dataset, model), key=len), max((dataset, model), key=len)):
        return "one_segment_insertion_or_deletion"
    return "complex_sequence_difference"


def inventory(manifest, evaluation, original, cmudict):
    if len(manifest["rows"]) != len(evaluation) or len(evaluation) != 30:
        raise ValueError("Frozen pilot cardinality changed")
    rows = []
    total_words = 0
    for m, e in zip(manifest["rows"], evaluation):
        sid = m["sample_id"]
        if (sid != e["sample_id"] or m["speaker_id"] != e["speaker_id"]
                or m["reference_sha256"] != e["reference_sha256"]
                or m["dataset_revision"] != REVISION or e["status"] != "scored"
                or original[sid]["words"] != m["human_words"]
                or original[sid]["text"] != m["reference_text"]):
            raise ValueError("Frozen reference join mismatch")
        words = e["raw_prediction"]["words"]
        _, mismatches = match_phones(m, m["human_words"], words)
        total_words += len(words)
        for mismatch in mismatches:
            index = mismatch["word_index"]
            source = m["human_words"][index]
            if source["text"].casefold() != words[index]["word"].casefold():
                raise ValueError("Text mismatch needs a separate review")
            dataset = [clean_phone(p) for p in source["phones"]]
            model = [p["phone"] for p in words[index]["phonemes"]]
            variants = cmudict.get(source["text"].upper(), [])
            rows.append({
                "sample_id": sid, "speaker_id": m["speaker_id"], "word_index": index,
                "word": source["text"], "dataset_arpabet_with_stress": " ".join(source["phones"]),
                "dataset_stress_stripped": " ".join(dataset), "model_stress_stripped": " ".join(model),
                "observed_pattern": pattern(dataset, model),
                "cmudict_0_7a_variants": " | ".join(" ".join(v) for v in variants),
                "dataset_matches_cmudict_variant": any([clean_phone(p) for p in v] == dataset for v in variants),
                "model_matches_cmudict_variant": any([clean_phone(p) for p in v] == model for v in variants),
                "pronunciation_acceptance": "UNRESOLVED; qualified phonetics review and recording evidence required",
                "dataset_source": f"resource/scores.json:{sid}:words[{index}].phones",
                "model_source": f"evaluation.json:{sid}:raw_prediction.words[{index}].phonemes",
            })
    return total_words, rows


def cohort_plan(test_path, train_path, original_speakers, seed=20261101):
    def read(path):
        return dict(line.split() for line in path.read_text().splitlines())
    test, train = read(test_path), read(train_path)
    if set(test) & set(train) or set(test.values()) & set(train.values()):
        raise ValueError("Dataset train/test identity overlap")
    groups = defaultdict(list)
    for utt, speaker in test.items():
        groups[speaker].append(utt)
    eligible = sorted(s for s, utts in groups.items() if s not in original_speakers and len(utts) >= 3)
    if len(eligible) < 60:
        raise ValueError("Insufficient new speakers")
    rng = random.Random(seed)
    selected = rng.sample(eligible, 60)
    dev, holdout = sorted(selected[:30]), sorted(selected[30:])
    def samples(speakers):
        return {speaker: sorted(rng.sample(sorted(groups[speaker]), 3)) for speaker in speakers}
    return {"status": "PLANNED; no audio acquisition, ratings access or model inference",
            "dataset_revision": REVISION, "seed": seed, "eligible_remaining_test_speakers": len(eligible),
            "original_pilot_speakers": sorted(original_speakers),
            "development": samples(dev), "untouched_evaluation": samples(holdout),
            "selection_source": "test/utt2spk identities only; no annotations or model outputs",
            "training_independence": "UNVERIFIED"}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--phase1", type=Path, required=True)
    parser.add_argument("--phase2", type=Path, required=True)
    parser.add_argument("--cmudict", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if args.output.exists():
        raise ValueError("Refusing overwrite")
    source = args.phase1 / "source"
    manifest = json.loads((args.phase2 / "manifest.json").read_text())
    evaluation = json.loads((args.phase2 / "evaluation.json").read_text())
    original = json.loads((source / "resource/scores.json").read_text())
    total_words, rows = inventory(manifest, evaluation, original, cmudict_entries(args.cmudict))
    if (total_words, len(rows)) != (179, 37):
        raise ValueError("Original 37/179 inventory not reproduced")
    earlier = list(csv.DictReader((args.phase1.parent / "english-validation-phase3" / "phone-sequence-differences.csv").open(newline="")))
    if [(r["sample_id"], str(r["word_index"]), r["dataset_stress_stripped"], r["model_stress_stripped"]) for r in rows] != [
        (r["sample_id"], r["word_index"], r["human_expected"], r["model_expected"]) for r in earlier]:
        raise ValueError("Phase 3 mismatch inventory changed")
    plan = cohort_plan(source / "test/utt2spk", source / "train/utt2spk", {r["speaker_id"] for r in manifest["rows"]})
    args.output.mkdir(parents=True)
    with (args.output / "pronunciation_reference_mismatches.csv").open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0])); writer.writeheader(); writer.writerows(rows)
    (args.output / "phase5_cohort_plan.json").write_text(json.dumps(plan, indent=2) + "\n", encoding="utf-8")
    summary = {"source_hashes": {str(p): sha(p) for p in [args.phase2 / "manifest.json", args.phase2 / "evaluation.json", source / "resource/scores.json", args.cmudict]},
               "words": total_words, "mismatches": len(rows), "patterns": dict(Counter(r["observed_pattern"] for r in rows)),
               "dataset_matches_cmudict_variant": sum(r["dataset_matches_cmudict_variant"] for r in rows),
               "model_matches_cmudict_variant": sum(r["model_matches_cmudict_variant"] for r in rows),
               "all_acceptance_unresolved": all(r["pronunciation_acceptance"].startswith("UNRESOLVED") for r in rows),
               "phase5_development_speakers": len(plan["development"]), "phase5_evaluation_speakers": len(plan["untouched_evaluation"])}
    (args.output / "summary.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
