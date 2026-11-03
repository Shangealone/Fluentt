"""Bundle integrity fixtures contain no actual trained weights or research evidence."""
import hashlib
import json
from pathlib import Path

from training.esr.check_bundle import check_bundle, REQUIRED_ROLES


def bundle(tmp_path):
    source = Path(__file__).resolve().parents[1] / "training/esr/manifest.example.json"
    value = json.loads(source.read_text())
    for key in ("model_version", "dataset_provenance", "dataset_license", "split_evidence", "calibration_evidence",
                "evaluation_evidence", "reproduction_command"):
        value[key] = "synthetic test metadata, not validated evidence"
    value["training_status"] = "trained"
    for role in sorted(REQUIRED_ROLES):
        data = b"synthetic bytes, deliberately not executable weights"
        name = role + ".bin"
        (tmp_path / name).write_bytes(data)
        value["files"].append({"role": role, "path": name, "sha256": hashlib.sha256(data).hexdigest()})
    (tmp_path / "manifest.json").write_text(json.dumps(value))
    return value


def test_integrity_checks_do_not_load_or_certify_weights(tmp_path):
    bundle(tmp_path)
    assert check_bundle(tmp_path) == []
    (tmp_path / "checkpoint.bin").write_bytes(b"changed")
    assert any("does not match" in value for value in check_bundle(tmp_path))


def test_bundle_rejects_outside_paths(tmp_path):
    value = bundle(tmp_path)
    value["files"][0]["path"] = "../outside.bin"
    (tmp_path / "manifest.json").write_text(json.dumps(value))
    assert any("out-of-bundle" in item for item in check_bundle(tmp_path))


def test_untrained_template_does_not_pass_preparation(tmp_path):
    source = Path(__file__).resolve().parents[1] / "training/esr/manifest.example.json"
    (tmp_path / "manifest.json").write_bytes(source.read_bytes())
    assert any("training_status" in item for item in check_bundle(tmp_path))
