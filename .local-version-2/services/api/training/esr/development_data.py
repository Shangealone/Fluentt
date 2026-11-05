"""Bounded source validation and learner-disjoint splits; no application imports."""
import csv
import gzip
import hashlib
import json
import math
from pathlib import Path

MAX_ROWS, MAX_USERS, MAX_EVENTS, HISTORY = 2_000_000, 6000, 96, 24
EXPECTED_SHA256 = "26cf9b33f2e9b2e8aa9a8f262a017b30699ca2f625c56a12ce699d4ea7076873"


def sha256(path):
    value = hashlib.sha256()
    with Path(path).open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            value.update(block)
    return value.hexdigest()


def split_for(user):
    bucket = int(hashlib.sha256(("fluentt-public-pilot-v1:" + user).encode()).hexdigest()[:8], 16) % 10
    return "train" if bucket < 7 else "calibration" if bucket == 7 else "validation" if bucket == 8 else "test"


def examples_for(events):
    past, eligible = [], []
    for event in sorted(events, key=lambda row: (row["at"], row["order"])):
        previous = [old for old in past if old["at"] < event["at"]]
        same = [old for old in previous if old["word"] == event["word"]]
        event = dict(event)
        event["features"] = [len(event["word"]), math.log1p(event["correct"]), math.log1p(event["seen"]),
                             (event["at"] - same[-1]["at"]) / 86400 if same else 0,
                             event["delta"], (event["at"] - previous[-1]["at"]) / 86400 if previous else 0]
        if not all(math.isfinite(x) and x >= 0 for x in event["features"]):
            raise ValueError("Invalid causal features")
        if previous:
            eligible.append((previous[-HISTORY:], event))
        past.append(event)
    return eligible[-8:]


def prepare(folder):
    provenance = json.loads((folder / "verified-source.json").read_text(encoding="utf-8"))
    corpus = (folder / provenance["file"]).resolve()
    if not corpus.is_relative_to(folder.resolve()):
        raise ValueError("Source path leaves the data directory")
    if (provenance.get("verified") is not True or provenance.get("license") != "CC BY-NC 4.0"
            or provenance.get("sha256") != EXPECTED_SHA256 or sha256(corpus) != EXPECTED_SHA256):
        raise ValueError("Dataset integrity or provenance check failed")
    users, english, skipped = {}, 0, 0
    with gzip.open(corpus, "rt", encoding="utf-8", newline="") as source:
        reader = csv.DictReader(source)
        required = {"p_recall", "timestamp", "delta", "user_id", "learning_language", "lexeme_id",
                    "lexeme_string", "history_seen", "history_correct", "session_seen", "session_correct"}
        if not required <= set(reader.fieldnames or []):
            raise ValueError("Unexpected source schema")
        for scanned, row in enumerate(reader, 1):
            if row["learning_language"] == "en":
                english += 1
                user = row["user_id"]
                if (not user or (user not in users and len(users) >= MAX_USERS)
                        or len(users.get(user, [])) >= MAX_EVENTS):
                    skipped += 1
                else:
                    target, at, delta = (float(row[name]) for name in ("p_recall", "timestamp", "delta"))
                    seen, correct = int(row["history_seen"]), int(row["history_correct"])
                    if (not all(math.isfinite(x) for x in (target, at, delta)) or not 0 <= target <= 1
                            or min(at, delta, seen, correct) < 0 or correct > seen):
                        raise ValueError("Invalid source outcome, time or history counts")
                    lexeme = row["lexeme_string"]
                    word = lexeme.split("/", 1)[0]
                    if word == "<*sf>":
                        word = lexeme.split("/", 1)[-1].split("<", 1)[0]
                    if not word or not row["lexeme_id"]:
                        raise ValueError("Missing item identity")
                    key = hashlib.sha256(f"{EXPECTED_SHA256}:{scanned}".encode()).hexdigest()
                    users.setdefault(user, []).append(dict(at=at, order=scanned, delta=delta / 86400,
                                                           seen=seen, correct=correct, target=target,
                                                           word=word, item=row["lexeme_id"], sample_key=key))
            if scanned >= MAX_ROWS:
                break
    data = {key: [] for key in ("train", "calibration", "validation", "test")}
    counts = dict.fromkeys(data, 0)
    cohort = {key: [] for key in data}
    for user, events in users.items():
        split = split_for(user)
        cluster = hashlib.sha256(("fluentt-development-v2:" + user).encode()).hexdigest()
        examples = examples_for(events)
        if examples:
            counts[split] += 1
            for history, candidate in examples:
                candidate["cluster"] = cluster
                data[split].append((history, candidate))
                cohort[split].append(candidate["sample_key"])
    if any(len(rows) < 32 for rows in data.values()):
        raise ValueError("Insufficient examples in a required independent split")
    hashes = {key: hashlib.sha256("\n".join(sorted(values)).encode()).hexdigest() for key, values in cohort.items()}
    return data, dict(scanned_rows=scanned, english_rows=english, bounded_rows_skipped=skipped,
                      learners=counts, examples={key: len(value) for key, value in data.items()},
                      cohort_sha256=hashes, corpus_sha256=EXPECTED_SHA256)
