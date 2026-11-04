"""Train a bounded, English-only public-data pilot; no real Fluentt identities or APIs."""
# ruff: noqa: E402 -- measure startup before importing the training runtime.

import copy
import csv
import gzip
import hashlib
import json
import math
from pathlib import Path
import random
import time

BOOT = time.perf_counter()
import torch
from public_pilot_model import PublicPilotModel
from run_cpu_smoke import peak_working_set

ROOT = Path(__file__).resolve().parents[4]
DATA = ROOT / "private-data/esr-training/public-data"
OUT = ROOT / "private-data/esr-training/public-pilot"
MAX_ROWS, MAX_USERS, MAX_EVENTS, HISTORY, MAX_STEPS = 500000, 1500, 64, 16, 100
SEED = 20261104


def digest(path):
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def memory_guard():
    memory = peak_working_set()
    if memory and memory > 3 * 1024**3:
        raise RuntimeError("Pilot exceeded its 3 GiB process memory budget.")
    return memory


def prepare():
    provenance = json.loads((DATA / "verified-source.json").read_text(encoding="utf-8"))
    corpus = DATA / provenance["file"]
    if not provenance["verified"] or digest(corpus) != provenance["sha256"]:
        raise RuntimeError("Verify the corpus before preprocessing.")
    users, languages, zeros, scanned, english, skipped, tied = {}, {}, 0, 0, 0, 0, 0
    with gzip.open(corpus, "rt", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        required = {
            "p_recall",
            "timestamp",
            "delta",
            "user_id",
            "learning_language",
            "lexeme_id",
            "lexeme_string",
            "history_seen",
            "history_correct",
            "session_seen",
            "session_correct",
        }
        if not required <= set(reader.fieldnames or []):
            raise RuntimeError("The public CSV schema differs from the publisher description.")
        for scanned, row in enumerate(reader, 1):
            language = row["learning_language"]
            languages[language] = languages.get(language, 0) + 1
            if language == "en":
                english += 1
                user = row["user_id"]
                if user not in users and len(users) >= MAX_USERS:
                    skipped += 1
                elif len(users.get(user, [])) >= MAX_EVENTS:
                    skipped += 1
                else:
                    label, at, delta = float(row["p_recall"]), float(row["timestamp"]), float(row["delta"])
                    seen, correct = int(row["history_seen"]), int(row["history_correct"])
                    if (
                        not all(math.isfinite(x) for x in (label, at, delta))
                        or not 0 <= label <= 1
                        or min(delta, seen, correct) < 0
                        or correct > seen
                    ):
                        raise RuntimeError("Invalid source label, count, or time; no silent repair.")
                    zeros += int(seen == 0) + int(correct == 0)
                    lexeme = row["lexeme_string"]
                    word = lexeme.split("/", 1)[0]
                    if word == "<*sf>":
                        word = lexeme.split("/", 1)[-1].split("<", 1)[0]
                    users.setdefault(user, []).append(
                        dict(
                            at=at,
                            delta=delta / 86400,
                            seen=seen,
                            correct=correct,
                            target=label,
                            word=word,
                            item=row["lexeme_id"],
                            order=scanned,
                        )
                    )
            if scanned >= MAX_ROWS:
                break
    examples = {"train": [], "validation": [], "test": []}
    participant_counts = {key: 0 for key in examples}
    for user, encounters in users.items():
        encounters.sort(key=lambda row: (row["at"], row["order"]))
        bucket = int(hashlib.sha256(("fluentt-public-pilot-v1:" + user).encode()).hexdigest()[:8], 16) % 10
        split = "train" if bucket < 8 else "validation" if bucket == 8 else "test"
        past = []
        eligible = []
        for event in encounters:
            previous = [old for old in past if old["at"] < event["at"]]
            tied += len(past) - len(previous)
            same = [old for old in previous if old["word"] == event["word"]]
            features = [
                len(event["word"]),
                math.log1p(event["correct"]),
                math.log1p(event["seen"]),
                (event["at"] - same[-1]["at"]) / 86400 if same else 0,
                event["delta"],
                (event["at"] - previous[-1]["at"]) / 86400 if previous else 0,
            ]
            if not all(math.isfinite(x) and x >= 0 for x in features):
                raise RuntimeError("Non-finite causal features.")
            event["features"] = features
            if previous:
                eligible.append((previous[-HISTORY:], event))
            past.append(event)
        if eligible:
            participant_counts[split] += 1
            # A small declared prefix pilot, not a representative corpus sample.
            examples[split].extend(eligible[-8:])
    if min(len(examples["train"]), len(examples["validation"]), len(examples["test"])) < 16:
        raise RuntimeError("Insufficient independent histories in the bounded sample; review sampling before training.")
    train_events = [event for history, candidate in examples["train"] for event in [*history, candidate]]
    words = {word: i + 2 for i, word in enumerate(sorted({event["word"] for event in train_events}))}
    items = {item: i + 2 for i, item in enumerate(sorted({event["item"] for event in train_events}))}
    numeric = torch.tensor([event["features"] for event in train_events], dtype=torch.float32)
    mean, scale = numeric.mean(0), numeric.std(0).clamp(min=1e-6)
    metadata = {
        "scanned_rows": scanned,
        "prefix_language_counts": languages,
        "english_rows": english,
        "retained_users": len(users),
        "participant_counts": participant_counts,
        "examples": {key: len(value) for key, value in examples.items()},
        "bounded_rows_skipped": skipped,
        "zero_counts_handled_with_log1p": zeros,
        "same_timestamp_rows_excluded_from_history": tied,
        "data_sha256": provenance["sha256"],
    }
    print(json.dumps(metadata), flush=True)
    return examples, words, items, mean, scale, metadata


def batch(examples, words, items, mean, scale):
    b, t = len(examples), max(len(history) for history, _ in examples)
    result = dict(
        hwords=torch.zeros(b, t, dtype=torch.long),
        hitems=torch.zeros(b, t, dtype=torch.long),
        features=torch.zeros(b, t, 6),
        responses=torch.zeros(b, t),
        lengths=torch.tensor([len(h) for h, _ in examples]),
        word=torch.zeros(b, dtype=torch.long),
        item=torch.zeros(b, dtype=torch.long),
        candidate_features=torch.zeros(b, 6),
    )
    labels = torch.tensor([candidate["target"] for _, candidate in examples], dtype=torch.float32)
    for i, (history, candidate) in enumerate(examples):
        if any(row["at"] >= candidate["at"] for row in history):
            raise RuntimeError("Current/future response leaked into history.")
        for j, row in enumerate(history):
            result["hwords"][i, j] = words.get(row["word"], 1)
            result["hitems"][i, j] = items.get(row["item"], 1)
            result["features"][i, j] = (torch.tensor(row["features"]) - mean) / scale
            result["responses"][i, j] = row["target"]
        result["word"][i] = words.get(candidate["word"], 1)
        result["item"][i] = items.get(candidate["item"], 1)
        result["candidate_features"][i] = (torch.tensor(candidate["features"]) - mean) / scale
    return result, labels


def evaluate(model, data, words, items, mean, scale):
    model.eval()
    mae, squared, count = 0.0, 0.0, 0
    with torch.no_grad():
        for offset in range(0, len(data), 16):
            x, y = batch(data[offset : offset + 16], words, items, mean, scale)
            prediction = model(**x).sigmoid()
            if not torch.isfinite(prediction).all():
                raise RuntimeError("Non-finite validation probabilities.")
            mae += float((prediction - y).abs().sum())
            squared += float((prediction - y).square().sum())
            count += len(y)
    return {"mae_to_recall_proportion": mae / count, "mse_to_recall_proportion": squared / count, "examples": count}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "report.json").unlink(missing_ok=True)
    torch.set_num_threads(2)
    torch.use_deterministic_algorithms(True)
    torch.manual_seed(SEED)
    random.seed(SEED)
    data, words, items, mean, scale, metadata = prepare()
    memory_guard()
    model = PublicPilotModel(len(words) + 2, len(items) + 2)
    optimizer = torch.optim.Adam(model.parameters(), lr=0.001)
    train, validation = data["train"], data["validation"][:512]
    constant = sum(candidate["target"] for _, candidate in train) / len(train)
    baseline_mae = sum(abs(candidate["target"] - constant) for _, candidate in validation) / len(validation)
    initial = evaluate(model, validation, words, items, mean, scale)
    # Causality contracts use real prepared records, never fabricated task formats.
    model.eval()
    x, y = batch(train[:4], words, items, mean, scale)
    with torch.no_grad():
        original = model(**x)
        reversed_batch = {key: value.flip(0) for key, value in x.items()}
        if not torch.allclose(original, model(**reversed_batch).flip(0), atol=1e-6):
            raise RuntimeError("Batch/learner independence check failed.")
    best, best_weights, losses, gradients = initial, copy.deepcopy(model.state_dict()), [], []
    start = time.perf_counter()
    for step in range(MAX_STEPS):
        if time.perf_counter() - start > 120:
            break
        model.train()
        optimizer.zero_grad(set_to_none=True)
        x, y = batch(random.sample(train, min(16, len(train))), words, items, mean, scale)
        loss = torch.nn.functional.binary_cross_entropy_with_logits(model(**x), y)
        if not torch.isfinite(loss):
            raise RuntimeError("Non-finite loss.")
        loss.backward()
        grads = [p.grad for p in model.parameters() if p.grad is not None]
        if not grads or any(not torch.isfinite(g).all() for g in grads):
            raise RuntimeError("Invalid gradient.")
        norm = float(torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0))
        if not math.isfinite(norm) or norm <= 0:
            raise RuntimeError("No finite nonzero gradient update.")
        optimizer.step()
        losses.append(float(loss.detach()))
        gradients.append(norm)
        memory_guard()
        if (step + 1) % 20 == 0:
            result = evaluate(model, validation, words, items, mean, scale)
            print(json.dumps({"step": step + 1, "loss": losses[-1], "validation": result}), flush=True)
            if result["mae_to_recall_proportion"] < best["mae_to_recall_proportion"]:
                best, best_weights = result, copy.deepcopy(model.state_dict())
    if not losses:
        raise RuntimeError("No optimization steps completed.")
    train_seconds = time.perf_counter() - start
    model.load_state_dict(best_weights)
    model.eval()
    x, _ = batch(validation[:4], words, items, mean, scale)
    with torch.no_grad():
        before = model(**x)
    checkpoint = OUT / "public-pilot-not-study-ready.pt"
    torch.save(
        {
            "state_dict": best_weights,
            "architecture": {"words": len(words) + 2, "lexemes": len(items) + 2},
            "word_mapping": words,
            "lexeme_mapping": items,
            "feature_mean": mean,
            "feature_scale": scale,
            "research_ready": False,
        },
        checkpoint,
    )
    loaded = torch.load(checkpoint, map_location="cpu", weights_only=True)
    replica = PublicPilotModel(**loaded["architecture"])
    replica.load_state_dict(loaded["state_dict"])
    replica.eval()
    with torch.no_grad():
        if not torch.equal(before, replica(**x)):
            raise RuntimeError("Checkpoint round-trip mismatch.")
    report = {
        "status": "bounded_pilot_completed",
        "version": "duolingo-fifakt-derived-cpu-pilot-v1",
        "real_data_training": True,
        "research_ready": False,
        "faithful_paper_reproduction": False,
        "format_aware": False,
        "pretrained_semantic_embeddings": False,
        "future_recall_calibrated": False,
        "device": "cpu",
        "torch": torch.__version__,
        "seed": SEED,
        "limits": {
            "source_rows": MAX_ROWS,
            "users": MAX_USERS,
            "events_per_user": MAX_EVENTS,
            "history": HISTORY,
            "steps": MAX_STEPS,
            "batch": 16,
            "threads": 2,
            "training_seconds": 120,
            "process_memory_gib": 3,
        },
        "dataset": metadata,
        "validation_examples_used": len(validation),
        "untouched_test_examples": len(data["test"]),
        "initial_validation": initial,
        "best_validation": best,
        "constant_training_mean_validation_mae": baseline_mae,
        "completed_steps": len(losses),
        "first_loss": losses[0],
        "last_loss": losses[-1],
        "nonzero_gradient_steps": len(gradients),
        "training_and_validation_seconds": train_seconds,
        "total_seconds": time.perf_counter() - BOOT,
        "peak_process_working_set_bytes": memory_guard(),
        "checkpoint_sha256": digest(checkpoint),
        "source_hashes": {
            name: digest(Path(__file__).with_name(name))
            for name in ("public_pilot_model.py", "public_pilot_worker.py", "run_public_pilot.py")
        },
        "limitations": [
            "Bounded prefix sample, not a representative corpus benchmark",
            "Session recall proportions, not individual correctness labels",
            "No question-format labels or Tagalog validation",
            "Random learned embeddings; no pretrained semantic vectors",
            "Not connected to the API or study activation",
        ],
    }
    (OUT / "report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(
        json.dumps(
            {
                key: report[key]
                for key in (
                    "status",
                    "completed_steps",
                    "best_validation",
                    "training_and_validation_seconds",
                    "total_seconds",
                    "peak_process_working_set_bytes",
                    "research_ready",
                )
            }
        ),
        flush=True,
    )


if __name__ == "__main__":
    main()
