"""Fetch only the author-linked public Duolingo research corpus onto the local F: workspace."""

import hashlib
import json
from pathlib import Path
import shutil
import time
import urllib.request

ROOT = Path(__file__).resolve().parents[4]
DATA = ROOT / "private-data/esr-training/public-data"
METADATA = "https://dataverse.harvard.edu/api/datasets/:persistentId/?persistentId=doi:10.7910/DVN/N8XJME"
URL = "https://dataverse.harvard.edu/api/access/datafile/3091087?format=original"
NAME = "settles.acl16.learning_traces.13m.csv.gz"
SIZE = 379004009
MD5 = "0a1cae5eb7ad4b0bd9c0de91d74fcced"


def hashes(path):
    md5, sha = hashlib.md5(), hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            md5.update(block)
            sha.update(block)
    return md5.hexdigest(), sha.hexdigest()


def main():
    DATA.mkdir(parents=True, exist_ok=True)
    if shutil.disk_usage(DATA).free < 2 * 1024**3:
        raise RuntimeError("Free at least 2 GiB on the training drive before downloading.")
    request = urllib.request.Request(METADATA, headers={"User-Agent": "Fluentt noncommercial research preparation"})
    with urllib.request.urlopen(request, timeout=30) as response:
        metadata = json.load(response)
    version = metadata["data"]["latestVersion"]
    file = next(row for row in version["files"] if row["dataFile"]["id"] == 3091087)
    details = file["dataFile"]
    if file.get("restricted") or details["filesize"] != SIZE or details["checksum"]["value"] != MD5:
        raise RuntimeError("Publisher metadata changed; review provenance before downloading.")
    if "creativecommons.org/licenses/by-nc/4.0" not in version.get("termsOfUse", ""):
        raise RuntimeError("Expected data license was not found; review the publisher's terms.")
    (DATA / "publisher-metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    target, partial = DATA / NAME, DATA / (NAME + ".part")
    start = time.perf_counter()
    if not target.exists():
        request = urllib.request.Request(
            URL,
            headers={
                "User-Agent": "Fluentt noncommercial research preparation",
                "Range": f"bytes=0-{SIZE - 1}",
                "Cache-Control": "no-cache",
            },
        )
        received, next_progress = 0, 32 * 1024**2
        with urllib.request.urlopen(request, timeout=45) as response, partial.open("wb") as output:
            if response.status not in (200, 206):
                raise RuntimeError("The publisher did not return a download.")
            for block in iter(lambda: response.read(1024 * 1024), b""):
                if received == 0 and not block.startswith(b"\x1f\x8b"):
                    raise RuntimeError("The response is not the expected gzip dataset.")
                received += len(block)
                if received > SIZE or time.perf_counter() - start > 1200:
                    raise RuntimeError("Download exceeded its size/time bound.")
                output.write(block)
                if received >= next_progress:
                    print(f"Downloaded {received // 1024**2} MiB of {SIZE // 1024**2} MiB", flush=True)
                    next_progress += 32 * 1024**2
        if received != SIZE:
            raise RuntimeError("Incomplete download; no training is permitted.")
        actual_md5, sha256 = hashes(partial)
        if actual_md5 != MD5:
            raise RuntimeError("Publisher checksum mismatch; no training is permitted.")
        partial.replace(target)
    else:
        actual_md5, sha256 = hashes(target)
        if target.stat().st_size != SIZE or actual_md5 != MD5:
            raise RuntimeError("Existing corpus failed publisher integrity checks.")
    report = {
        "source": URL,
        "dataset_doi": "10.7910/DVN/N8XJME",
        "license": "CC BY-NC 4.0",
        "citation": "Settles and Meeder (2016), A Trainable Spaced Repetition Model for Language Learning, ACL 1848-1858",
        "file": NAME,
        "bytes": SIZE,
        "publisher_md5": actual_md5,
        "sha256": sha256,
        "verified": True,
        "download_and_verify_seconds": round(time.perf_counter() - start, 3),
    }
    (DATA / "verified-source.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(
        json.dumps(
            {"verified": True, "bytes": SIZE, "sha256": sha256, "seconds": report["download_and_verify_seconds"]}
        ),
        flush=True,
    )


if __name__ == "__main__":
    main()
