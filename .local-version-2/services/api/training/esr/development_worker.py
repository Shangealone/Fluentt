"""Train/select/calibrate, then evaluate the frozen final cohort exactly once."""
# ruff: noqa: E402 -- include third-party import startup in wall-clock measurements.
import argparse
import copy
import csv
import json
import math
from pathlib import Path
import random
import sys
import time

BOOT = time.perf_counter()
import psutil
import torch
from development_data import prepare, sha256
from development_metrics import metrics, paired_cluster_interval
from public_pilot_model import PublicPilotModel
from public_pilot_worker import batch


def resource_guard():
    info = psutil.Process().memory_info()
    peak = getattr(info, "peak_wset", info.rss)
    if peak > 3 * 1024**3:
        raise RuntimeError("Training process exceeded its 3 GiB memory budget")
    return peak


def logits_for(model, examples, mappings, mean, scale):
    model.eval()
    outputs = []
    with torch.inference_mode():
        for start in range(0, len(examples), 64):
            x, _ = batch(examples[start:start+64], *mappings, mean, scale)
            logits = model(**x)
            if not torch.isfinite(logits).all():
                raise RuntimeError("Non-finite predictions")
            outputs.extend(logits.tolist())
    resource_guard()
    return torch.tensor(outputs)


def targets(examples):
    return [row["target"] for _, row in examples]


def fit(model, train, validation, mappings, mean, scale, seed):
    optimizer = torch.optim.Adam(model.parameters(), lr=.001)
    best = metrics(logits_for(model, validation, mappings, mean, scale).sigmoid().tolist(), targets(validation))
    initial, weights = dict(best), copy.deepcopy(model.state_dict())
    start, losses, gradient_norms, trace = time.perf_counter(), [], [], []
    for step in range(800):
        if time.perf_counter()-start > 180:
            break
        model.train()
        optimizer.zero_grad(set_to_none=True)
        x, y = batch(random.sample(train, min(32, len(train))), *mappings, mean, scale)
        loss = torch.nn.functional.binary_cross_entropy_with_logits(model(**x), y)
        if not torch.isfinite(loss):
            raise RuntimeError("Non-finite optimization loss")
        loss.backward()
        gradients = [p.grad for p in model.parameters() if p.grad is not None]
        if not gradients or any(not torch.isfinite(g).all() for g in gradients):
            raise RuntimeError("Non-finite or absent gradient")
        norm = float(torch.nn.utils.clip_grad_norm_(model.parameters(), 1))
        if not math.isfinite(norm) or norm <= 0:
            raise RuntimeError("No nonzero finite gradient update")
        optimizer.step()
        if any(not torch.isfinite(p).all() for p in model.parameters()):
            raise RuntimeError("Non-finite model weights")
        losses.append(float(loss.detach()))
        gradient_norms.append(norm)
        resource_guard()
        if (step+1) % 100 == 0:
            result = metrics(logits_for(model, validation, mappings, mean, scale).sigmoid().tolist(), targets(validation))
            trace.append(dict(step=step+1, validation=result))
            print(json.dumps(dict(seed=seed, step=step+1, validation_mae=result["mae"])), flush=True)
            if result["mae"] < best["mae"]:
                best, weights = result, copy.deepcopy(model.state_dict())
    if not losses:
        raise RuntimeError("No optimization executed")
    model.load_state_dict(weights)
    return dict(seed=seed, steps=len(losses), initial_validation=initial, selected_validation=best,
                elapsed_seconds=time.perf_counter()-start, first_loss=losses[0], final_loss=losses[-1],
                finite_nonzero_gradient_steps=len(gradient_norms), trace=trace), weights


def calibrate(logits, labels):
    labels = torch.tensor(labels)
    log_temperature = torch.tensor(0., requires_grad=True)
    bias = torch.tensor(0., requires_grad=True)
    optimizer = torch.optim.Adam([log_temperature, bias], lr=.03)
    initial = float(torch.nn.functional.binary_cross_entropy_with_logits(logits, labels))
    best, parameters = initial, (1., 0.)
    for _ in range(200):
        optimizer.zero_grad(set_to_none=True)
        loss = torch.nn.functional.binary_cross_entropy_with_logits(logits/log_temperature.exp()+bias, labels)
        if not torch.isfinite(loss):
            raise RuntimeError("Non-finite calibration loss")
        loss.backward()
        optimizer.step()
        with torch.no_grad():
            log_temperature.clamp_(-3, 3)
            bias.clamp_(-5, 5)
            value = float(torch.nn.functional.binary_cross_entropy_with_logits(logits/log_temperature.exp()+bias, labels))
            if value < best:
                best, parameters = value, (float(log_temperature.exp()), float(bias))
    return dict(temperature=parameters[0], intercept=parameters[1], identity_bce=initial, selected_bce=best)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    out = args.output
    torch.set_num_threads(2)
    torch.use_deterministic_algorithms(True)
    data, metadata = prepare(args.data)
    (out / "cohort.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    clusters = {key: {row["cluster"] for _, row in rows} for key, rows in data.items()}
    for first, values in clusters.items():
        if any(values & other for key, other in clusters.items() if key != first):
            raise RuntimeError("Learner leakage across partitions")
    events = [event for history, candidate in data["train"] for event in [*history, candidate]]
    words = {value: i+2 for i, value in enumerate(sorted({row["word"] for row in events}))}
    items = {value: i+2 for i, value in enumerate(sorted({row["item"] for row in events}))}
    numeric = torch.tensor([row["features"] for row in events])
    mean, scale = numeric.mean(0), numeric.std(0).clamp(min=1e-6)
    del numeric, events
    mappings, candidates, selected_weights, selected = (words, items), [], None, None
    for seed in (20261105, 20261106, 20261107):
        torch.manual_seed(seed)
        random.seed(seed)
        model = PublicPilotModel(len(words)+2, len(items)+2)
        result, weights = fit(model, data["train"], data["validation"], mappings, mean, scale, seed)
        candidates.append(result)
        if selected is None or result["selected_validation"]["mae"] < selected["selected_validation"]["mae"]:
            selected, selected_weights = result, weights
    model.load_state_dict(selected_weights)
    model.eval()
    calibration_logits = logits_for(model, data["calibration"], mappings, mean, scale)
    calibration = calibrate(calibration_logits, targets(data["calibration"]))
    constant = sum(targets(data["train"]))/len(data["train"])
    item_values = {}
    for _, row in data["train"]:
        item_values.setdefault(row["item"], []).append(row["target"])
    item_means = {key: sum(values)/len(values) for key, values in item_values.items()}
    # Record all choices before running final-test inference.
    selection = dict(selected_seed=selected["seed"], candidates=candidates, calibration=calibration,
                     constant_training_mean=constant, test_evaluated=False)
    (out / "selection-frozen.json").write_text(json.dumps(selection, indent=2), encoding="utf-8")
    checkpoint = out / "fifakt-derived-development-not-study-ready.pt"
    contract = "observed-session-recall-proportion-v2"
    torch.save(dict(state_dict=selected_weights, architecture=dict(words=len(words)+2, lexemes=len(items)+2),
                    word_mapping=words, item_mapping=items, feature_mean=mean, feature_scale=scale,
                    calibration=calibration, prediction_contract=contract, research_ready=False), checkpoint)
    loaded = torch.load(checkpoint, map_location="cpu", weights_only=True)
    replica = PublicPilotModel(**loaded["architecture"])
    replica.load_state_dict(loaded["state_dict"], strict=True)
    first = logits_for(model, data["calibration"][:16], mappings, mean, scale)
    second = logits_for(replica, data["calibration"][:16], mappings, mean, scale)
    if not torch.equal(first, second):
        raise RuntimeError("Exact safe checkpoint round trip failed")
    # Test outcomes cannot influence model, normalization, maps or calibration.
    test_logits = logits_for(replica, data["test"], mappings, mean, scale)
    uncalibrated = test_logits.sigmoid().tolist()
    predictions = (test_logits/calibration["temperature"]+calibration["intercept"]).sigmoid().tolist()
    rows = [dict(sample_key=row["sample_key"], cluster=row["cluster"], target=row["target"], model=p,
                 uncalibrated=u, constant=constant, item_mean=item_means.get(row["item"], constant))
            for (_, row), p, u in zip(data["test"], predictions, uncalibrated)]
    with (out / "private-test-predictions.csv").open("w", encoding="utf-8", newline="") as output:
        writer = csv.DictWriter(output, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    labels = targets(data["test"])
    results = {key: metrics([row[key] for row in rows], labels)
               for key in ("model", "uncalibrated", "constant", "item_mean")}
    intervals = {key: paired_cluster_interval(rows, "model", key) for key in ("constant", "item_mean")}
    learners = {}
    for row in rows:
        learners.setdefault(row["cluster"], []).append(abs(row["model"]-row["target"]))
    with (out / "private-learner-metrics.json").open("w", encoding="utf-8") as output:
        json.dump({key: dict(n=len(values), mae=sum(values)/len(values)) for key, values in learners.items()}, output)
    report = dict(status="PASS" if all(value["percentile_95"][1] < 0 for value in intervals.values()) else "PARTIAL",
                  research_ready=False, deployment="BLOCKED", prediction_contract=contract,
                  dataset=metadata, selected_seed=selected["seed"], calibration=calibration,
                  metrics=results, paired_learner_intervals=intervals,
                  unknown_word_fraction=sum(row["word"] not in words for _, row in data["test"])/len(rows),
                  unknown_item_fraction=sum(row["item"] not in items for _, row in data["test"])/len(rows),
                  split_overlap=0, checkpoint_round_trip="EXACT", checkpoint_sha256=sha256(checkpoint),
                  checkpoint_bytes=checkpoint.stat().st_size, total_seconds=time.perf_counter()-BOOT,
                  peak_process_working_set_bytes=resource_guard(), cpu_seconds=sum(psutil.Process().cpu_times()[:2]),
                  runtime=dict(python=sys.version.split()[0], torch=str(torch.__version__), psutil=psutil.__version__, threads=2),
                  limitations=["Bounded English prefix cohort", "Reduced architecture without pretrained semantic vectors",
                               "Session recall proportions, not individual answer labels", "No FLUENTT format labels",
                               "No calibrated arbitrary future-horizon prediction", "Not an app provider or retention experiment"])
    sources = ["development_worker.py", "development_data.py", "development_metrics.py", "public_pilot_model.py",
               "public_pilot_worker.py", "run_development_validation.py", "DEVELOPMENT_VALIDATION.md"]
    report["source_sha256"] = {name: sha256(Path(__file__).with_name(name)) for name in sources}
    (out / "report.json").write_text(json.dumps(report, indent=2, allow_nan=False), encoding="utf-8")
    manifest = dict(prediction_contract=contract, research_ready=False, simulated=False,
                    purpose="noncommercial public-data development evaluation", files={})
    for path in out.iterdir():
        if path.is_file() and path.name not in ("run.log", "manifest.json"):
            manifest["files"][path.name] = sha256(path)
    (out / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(json.dumps({key: report[key] for key in ("status", "deployment", "metrics", "total_seconds", "peak_process_working_set_bytes")}), flush=True)


if __name__ == "__main__":
    main()
