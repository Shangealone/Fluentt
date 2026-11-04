"""Integrity preparation only: never load weights or certify scientific readiness."""
import argparse
import hashlib
import json
from pathlib import Path
import re


REQUIRED_ROLES = {"checkpoint", "architecture", "preprocessing", "vocabulary_mapping", "format_mapping", "evaluation", "calibration"}


def check_bundle(directory: Path) -> list[str]:
    root = directory.resolve(strict=True)
    manifest_path = root / "manifest.json"
    if manifest_path.resolve().parent != root or manifest_path.stat().st_size > 1048576:
        raise ValueError("Invalid manifest location or size.")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    problems = []
    if not isinstance(manifest, dict):
        raise ValueError("The manifest must be an object.")
    contracts = {"schema_version": "fluentt-esr-artifact-v1", "training_status": "trained",
                 "prediction_contract": "future-recall-probability-v1", "history_contract": "own-pool-before-presentation-v1"}
    for key, expected in contracts.items():
        if manifest.get(key) != expected:
            problems.append(f"Required contract is missing or mismatched: {key}")
    for key in ("model_version", "upstream_commit", "dataset_provenance", "dataset_license", "split_evidence",
                "calibration_evidence", "evaluation_evidence", "reproduction_command"):
        if not isinstance(manifest.get(key), str) or not manifest[key].strip():
            problems.append(f"Missing documented metadata: {key}")
    if manifest.get("formats") != ["multiple_choice", "typed_recall"]:
        problems.append("Both explicit format mappings must be declared in contract order.")
    entries = manifest.get("files")
    if not isinstance(entries, list) or len(entries) > 100:
        raise ValueError("Provide a bounded list of artifact files.")
    roles, paths = set(), set()
    for entry in entries:
        if not isinstance(entry, dict) or not all(isinstance(entry.get(k), str) for k in ("role", "path", "sha256")):
            problems.append("Malformed artifact entry.")
            continue
        relative = Path(entry["path"])
        target = (root / relative).resolve()
        if (relative.is_absolute() or not target.is_relative_to(root) or target == manifest_path
                or not target.is_file() or relative.as_posix() in paths):
            problems.append("Invalid, duplicate or out-of-bundle artifact path.")
            continue
        paths.add(relative.as_posix())
        if entry["role"] in roles:
            problems.append("Duplicate artifact role.")
        roles.add(entry["role"])
        if not re.fullmatch(r"[0-9a-f]{64}", entry["sha256"]):
            problems.append("Artifact hash must be a lowercase SHA-256 digest.")
            continue
        with target.open("rb") as stream:
            actual = hashlib.file_digest(stream, "sha256").hexdigest()
        if actual != entry["sha256"]:
            problems.append("Artifact content does not match its declared digest.")
    if REQUIRED_ROLES - roles:
        problems.append("Required checkpoint, preprocessing, mappings or evaluation files are missing.")
    return problems


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path)
    args = parser.parse_args()
    try:
        problems = check_bundle(args.directory)
    except (OSError, ValueError, TypeError):
        print("Bundle could not be inspected. Check local manifest and file access; no weights were loaded.")
        return 2
    if problems:
        for problem in problems:
            print(problem)
        return 1
    print("Declared files and metadata passed integrity checks. Scientific validation and study approval are still required.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
