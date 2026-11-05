"""Verify hashes and recompute saved evaluation arithmetic without loading a model."""
import argparse
import csv
import json
import math
from pathlib import Path

from development_data import sha256
from development_metrics import metrics, paired_cluster_interval


def verify(folder, sources):
    folder = folder.resolve(strict=True)
    manifest = json.loads((folder / "manifest.json").read_text(encoding="utf-8"))
    report = json.loads((folder / "report.json").read_text(encoding="utf-8"))
    if (manifest.get("research_ready") is not False or report.get("research_ready") is not False
            or manifest.get("prediction_contract") != "observed-session-recall-proportion-v2"
            or report.get("deployment") != "BLOCKED"):
        raise ValueError("Development/deployment boundary was altered")
    files = manifest["files"]
    required = {"report.json", "cohort.json", "selection-frozen.json", "private-test-predictions.csv",
                "private-learner-metrics.json", "fifakt-derived-development-not-study-ready.pt"}
    if not isinstance(files, dict) or len(files) > 100 or not required <= set(files):
        raise ValueError("Incomplete or excessive artifact manifest")
    for name, expected in files.items():
        path = (folder / name).resolve()
        if Path(name).is_absolute() or not path.is_relative_to(folder) or sha256(path) != expected:
            raise ValueError("Artifact hash/path mismatch")
    for name, expected in report["source_sha256"].items():
        path = (sources / name).resolve()
        if Path(name).is_absolute() or not path.is_relative_to(sources.resolve()) or sha256(path) != expected:
            raise ValueError("Executed source snapshot differs")
    with (folder / "private-test-predictions.csv").open(encoding="utf-8", newline="") as source:
        rows = list(csv.DictReader(source))
    if len(rows) != report["dataset"]["examples"]["test"]:
        raise ValueError("Test predictions/count mismatch")
    if len({row["sample_key"] for row in rows}) != len(rows):
        raise ValueError("Duplicate test example identity")
    for row in rows:
        for key in ("model", "uncalibrated", "constant", "item_mean", "target"):
            row[key] = float(row[key])
    for key, result in report["metrics"].items():
        actual = metrics([row[key] for row in rows], [row["target"] for row in rows])
        if any(not math.isclose(value, result[name], abs_tol=1e-12, rel_tol=1e-12)
               for name, value in actual.items()):
            raise ValueError("Saved metric arithmetic differs")
    intervals = {key: paired_cluster_interval(rows, "model", key) for key in ("constant", "item_mean")}
    if intervals != report["paired_learner_intervals"]:
        raise ValueError("Cluster uncertainty arithmetic differs")
    status = "PASS" if all(row["percentile_95"][1] < 0 for row in intervals.values()) else "PARTIAL"
    if report["status"] != status:
        raise ValueError("Prespecified decision differs")
    return dict(integrity="PASS", saved_metric_recomputation="PASS", development_result=status,
                deployment="BLOCKED", checked_files=len(files), source_snapshots=len(report["source_sha256"]))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("directory", type=Path)
    parser.add_argument("--sources", type=Path, required=True)
    args = parser.parse_args()
    print(json.dumps(verify(args.directory, args.sources)))
