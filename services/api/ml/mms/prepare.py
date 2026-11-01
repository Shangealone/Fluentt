"""Explicit, pinned, data-only download for local noncommercial MMS use."""
import argparse
import json
from pathlib import Path
import shutil

from artifacts import FILES, MODEL_ID, REVISION, sha256, manifest


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--cache", required=True, type=Path)
    parser.add_argument("--acknowledge-noncommercial-license", action="store_true", required=True)
    args = parser.parse_args()
    from huggingface_hub import hf_hub_download
    root = args.cache.resolve()
    root.mkdir(parents=True, exist_ok=True)
    hashes = {}
    for name in FILES:
        source = hf_hub_download(MODEL_ID, name, revision=REVISION)
        shutil.copyfile(source, root / name)
        hashes[name] = sha256(root / name)
    (root / "manifest.json").write_text(json.dumps({
        "model_id": MODEL_ID, "revision": REVISION, "adapter": "tgl", "files": hashes,
        "license": "CC-BY-NC-4.0",
    }, indent=2), encoding="utf-8")
    manifest(root, verify=True)
    print("Pinned MMS artifacts verified. No speech inference or accuracy validation has been performed.")


if __name__ == "__main__":
    main()
