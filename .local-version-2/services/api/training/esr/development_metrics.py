"""Metrics on observed session-recall proportions, not academic accuracy."""
import math
import random


def metrics(predictions, targets):
    if not predictions or len(predictions) != len(targets):
        raise ValueError("Matched nonempty predictions and labels required")
    if any(not math.isfinite(v) or not 0 <= v <= 1 for v in [*predictions, *targets]):
        raise ValueError("Finite probabilities and labels in [0,1] required")
    n = len(targets)
    mae = sum(abs(p-y) for p, y in zip(predictions, targets)) / n
    mse = sum((p-y)**2 for p, y in zip(predictions, targets)) / n
    bce = -sum(y*math.log(max(p, 1e-7)) + (1-y)*math.log(max(1-p, 1e-7))
               for p, y in zip(predictions, targets)) / n
    bins = [[] for _ in range(10)]
    for p, y in zip(predictions, targets):
        bins[min(int(p*10), 9)].append((p, y))
    gap = sum(abs(sum(p-y for p, y in rows)) for rows in bins) / n
    return dict(examples=n, mae=mae, rmse=math.sqrt(mse), soft_target_bce=bce,
                descriptive_binned_reliability_gap=gap)


def paired_cluster_interval(rows, model, baseline):
    groups = {}
    for row in rows:
        delta = abs(row[model]-row["target"]) - abs(row[baseline]-row["target"])
        groups.setdefault(row["cluster"], []).append(delta)
    values = [(sum(group), len(group)) for group in groups.values()]
    if len(values) < 2:
        raise ValueError("At least two learner clusters required")
    rng, samples = random.Random(20261105), []
    for _ in range(500):
        drawn = rng.choices(values, k=len(values))
        samples.append(sum(value for value, _ in drawn)/sum(count for _, count in drawn))
    samples.sort()
    return dict(delta_mae=sum(x for x, _ in values)/sum(n for _, n in values),
                percentile_95=[samples[12], samples[487]], learners=len(values), bootstrap_replicates=500)
