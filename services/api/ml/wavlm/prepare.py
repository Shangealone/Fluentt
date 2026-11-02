"""Explicit offline-artifact preparation. Never downloads/execututes remote Python."""

import argparse
import hashlib
import json
from pathlib import Path
import shutil

REVISIONS = {
    "scorer": "19f6b9675d02a61dcd5b2aec0fdcc4364c1fc9da",
    "backbone": "c1423ed94bb01d80a3f5ce5bc39f6026a0f4828c",
    "alignment": "2c733782da5604684829819a5eb744c193fe9398",
}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--cache", required=True, type=Path)
    args = parser.parse_args()
    from huggingface_hub import hf_hub_download
    import nltk

    sources = {
        "scorer": ("Jianshu001/wavlm-phoneme-scorer", ["wavlm_finetuned.pt"]),
        "backbone": ("microsoft/wavlm-large", ["config.json", "preprocessor_config.json"]),
        "alignment": (
            "facebook/wav2vec2-xlsr-53-espeak-cv-ft",
            ["config.json", "preprocessor_config.json", "vocab.json", "pytorch_model.bin"],
        ),
    }
    root = args.cache.resolve()
    root.mkdir(parents=True, exist_ok=True)
    for folder, (repo, files) in sources.items():
        target = root / folder
        target.mkdir(exist_ok=True)
        for name in files:
            path = hf_hub_download(repo_id=repo, filename=name, revision=REVISIONS[folder])
            shutil.copyfile(path, target / name)
    for resource in ("cmudict", "averaged_perceptron_tagger", "averaged_perceptron_tagger_eng"):
        if not nltk.download(resource, download_dir=str(root / "nltk_data"), quiet=True, raise_on_error=True):
            raise RuntimeError("NLTK resource unavailable")
    files = {}
    for path in sorted(root.rglob("*")):
        if not path.is_file() or path.name == "manifest.json":
            continue
        digest = hashlib.sha256()
        with path.open("rb") as source:
            for chunk in iter(lambda: source.read(1024 * 1024), b""):
                digest.update(chunk)
        files[path.relative_to(root).as_posix()] = digest.hexdigest()
    (root / "manifest.json").write_text(
        json.dumps({"revisions": REVISIONS, "files": files}, indent=2), encoding="utf-8"
    )
    print(
        "Pinned artifacts prepared. Model inference has NOT been verified; run the resource-gated benchmark separately."
    )


if __name__ == "__main__":
    main()
