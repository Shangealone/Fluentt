"""Pinned, data-only MMS artifacts. No upstream Python is downloaded/executed."""
import hashlib
import json
from pathlib import Path

MODEL_ID = "facebook/mms-1b-all"
REVISION = "3d33597edbdaaba14a8e858e2c8caa76e3cec0cd"
FILES = ("config.json", "preprocessor_config.json", "tokenizer_config.json", "special_tokens_map.json",
         "vocab.json", "model.safetensors", "adapter.tgl.safetensors")
MIN_FREE_BYTES = 8 * 1024**3


def manifest(cache, verify=False):
    root = Path(cache).resolve()
    value = json.loads((root / "manifest.json").read_text(encoding="utf-8"))
    if value.get("model_id") != MODEL_ID or value.get("revision") != REVISION or value.get("adapter") != "tgl":
        raise ValueError("Unpinned MMS artifacts")
    if set(value["files"]) != set(FILES):
        raise ValueError("Incomplete MMS artifacts")
    for name, digest in value["files"].items():
        path = (root / name).resolve()
        if not path.is_relative_to(root) or not path.is_file() or len(digest) != 64:
            raise ValueError("Invalid MMS artifact")
        if verify and sha256(path) != digest:
            raise ValueError("MMS artifact hash mismatch")
    return value


def sha256(path):
    digest = hashlib.sha256()
    with Path(path).open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()
