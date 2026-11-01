"""Small Phase 4 reference checks; no speech model imports or inference."""
import copy
import json
from pathlib import Path

import pytest

from .phase4_references import cmudict_entries, cohort_plan, inventory, pattern


API = Path(__file__).resolve().parents[2]
ROOT = API.parents[1]
PHASE1 = API / "private-data/english-validation-phase1"
PHASE2 = API / "private-data/english-validation-phase2"
CMU = ROOT / "models-cache/wavlm/nltk_data/corpora/cmudict/cmudict"


def test_observed_patterns_are_not_acceptance_decisions():
    assert pattern(["f", "ao"], ["f", "ao", "r"]) == "rhotic_segment_difference"
    assert pattern(["w", "ah", "z"], ["w", "aa", "z"]) == "single_vowel_symbol_difference"
    assert pattern(["s", "eh", "v", "n"], ["s", "eh", "v", "ah", "n"]) == "one_segment_insertion_or_deletion"


def test_frozen_inventory_and_provenance():
    manifest = json.loads((PHASE2 / "manifest.json").read_text())
    evaluation = json.loads((PHASE2 / "evaluation.json").read_text())
    original = json.loads((PHASE1 / "source/resource/scores.json").read_text())
    words, rows = inventory(manifest, evaluation, original, cmudict_entries(CMU))
    assert (words, len(rows)) == (179, 37)
    assert len({(r["sample_id"], r["word_index"]) for r in rows}) == 37
    assert all(r["pronunciation_acceptance"].startswith("UNRESOLVED") for r in rows)
    assert sum(r["dataset_matches_cmudict_variant"] for r in rows) == 11
    assert sum(r["model_matches_cmudict_variant"] for r in rows) == 36
    tampered = copy.deepcopy(evaluation)
    tampered[0]["reference_sha256"] = "x"
    with pytest.raises(ValueError, match="join"):
        inventory(manifest, tampered, original, cmudict_entries(CMU))


def test_future_speaker_cohorts_are_deterministic_and_disjoint():
    manifest = json.loads((PHASE2 / "manifest.json").read_text())
    old = {r["speaker_id"] for r in manifest["rows"]}
    args = (PHASE1 / "source/test/utt2spk", PHASE1 / "source/train/utt2spk", old)
    a = cohort_plan(*args)
    assert a == cohort_plan(*args)
    dev, test = set(a["development"]), set(a["untouched_evaluation"])
    assert len(dev) == len(test) == 30
    assert not (dev & test or dev & old or test & old)
    assert sum(map(len, a["development"].values())) == 90
    assert sum(map(len, a["untouched_evaluation"].values())) == 90
