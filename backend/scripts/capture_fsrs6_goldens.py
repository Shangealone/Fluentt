"""Capture pinned direct-library goldens without importing a FLUENTT adapter.

Run from backend: python scripts/capture_fsrs6_goldens.py --output PATH
Use --check PATH to reproduce/check existing fixtures without rewriting them.
"""

import argparse
import ast
import inspect
import json
import platform
from datetime import UTC, datetime, timedelta
from hashlib import sha256
from importlib.metadata import version
from pathlib import Path
from uuid import UUID

from fsrs import Card, Rating, Scheduler, State

PARAMETERS = (
    0.212,
    1.2931,
    2.3065,
    8.2956,
    6.4133,
    0.8334,
    3.0194,
    0.001,
    1.8722,
    0.1666,
    0.796,
    1.4835,
    0.0614,
    0.2629,
    1.6483,
    0.6014,
    1.8729,
    0.5425,
    0.0912,
    0.0658,
    0.1542,
)
CONFIG_DIGEST = "4e4c56a9f928cae5581e5d577de413b17c9d581185482db423a98551f6575e4f"
USER = UUID("ffffffff-ffff-ffff-ffff-ffffffffffff")
ITEM = UUID("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee")
CARD_ID = (USER.int << 128) | ITEM.int
BASE = datetime(2026, 1, 1, 10, 11, 12, 123456, tzinfo=UTC)
DAY_US = 86400 * 1000000


def capture():
    assert version("fsrs") == "6.3.2"
    source = ast.parse(
        Path("app/research_authority/config_v1.py").read_text(encoding="utf-8")
    )
    records = ast.literal_eval(
        next(n.value for n in source.body if isinstance(n, ast.Assign))
    )
    record = next(
        r for r in records if r["config_version"] == "fsrs6-binary-r90-config-v1"
    )
    assert (
        sha256(record["canonical_document"].encode()).hexdigest()
        == record["config_sha256"]
        == CONFIG_DIGEST
    )
    config = json.loads(record["canonical_document"])
    assert tuple(float(p) for p in config["parameters"]) == PARAMETERS
    assert float(config["desired_retention"]) == 0.9
    assert config["learning_steps_seconds"] == config["relearning_steps_seconds"] == []
    assert (
        config["maximum_interval_days"] == 36500 and config["enable_fuzzing"] is False
    )
    scheduler = Scheduler(
        parameters=PARAMETERS,
        desired_retention=0.9,
        learning_steps=(),
        relearning_steps=(),
        maximum_interval=36500,
        enable_fuzzing=False,
    )
    families = {
        "first_correct": [(0, True)],
        "first_incorrect": [(0, False)],
        "correct_correct": [(0, True), (2 * DAY_US, True)],
        "correct_incorrect": [(0, True), (2 * DAY_US, False)],
        "incorrect_correct": [(0, False), (DAY_US, True)],
        "multiple_correct": [
            (0, True),
            (2 * DAY_US, True),
            (10 * DAY_US, True),
            (41 * DAY_US, True),
        ],
        "repeated_incorrect": [(n * DAY_US, False) for n in range(4)],
        "mixed_elapsed": [
            (n * DAY_US, answer)
            for n, answer in (
                (0, True),
                (2, False),
                (3, True),
                (6, True),
                (7, False),
                (8, False),
                (11, True),
                (20, True),
            )
        ],
        "on_due": [(0, True), (2 * DAY_US, True)],
        "after_due": [(0, True), (9 * DAY_US, True)],
        "before_due": [(0, True), (DAY_US, True)],
        "same_day": [(0, True), (3600 * 1000000, False)],
        "elapsed_below_day": [(0, True), (DAY_US - 1, True)],
        "elapsed_exact_day": [(0, True), (DAY_US, True)],
        "elapsed_above_day": [(0, True), (DAY_US + 1, True)],
        "maximum_cap": [(0, True)],
    }
    cases = []
    for name, steps in families.items():
        initial = None
        card = Card(
            card_id=CARD_ID,
            state=State.Learning,
            step=0,
            stability=None,
            difficulty=None,
            due=BASE,
            last_review=None,
        )
        if name == "maximum_cap":
            initial = {
                "memory": {
                    "state": "Review",
                    "step": None,
                    "stability": 100000000.0,
                    "difficulty": 5.0,
                },
                "prior_interaction_at": (BASE - timedelta(days=30)).isoformat(),
                "prior_due_at": (BASE - timedelta(days=1)).isoformat(),
            }
            card = Card(
                card_id=CARD_ID,
                state=State.Review,
                step=None,
                stability=100000000.0,
                difficulty=5.0,
                due=BASE - timedelta(days=1),
                last_review=BASE - timedelta(days=30),
            )
        results = []
        for offset_us, correct in steps:
            at = BASE + timedelta(microseconds=offset_us)
            before = vars(card).copy()
            updated, log = scheduler.review_card(
                card,
                Rating.Good if correct else Rating.Again,
                review_datetime=at,
                review_duration=None,
            )
            assert vars(card) == before and updated is not card
            assert updated.card_id == CARD_ID and CARD_ID.bit_length() == 256
            assert updated.state is State.Review and updated.step is None
            assert updated.last_review == at
            delta = updated.due - at
            assert 1 <= delta.days <= 36500 and delta.seconds == delta.microseconds == 0
            assert log.review_duration is None and log.card_id == CARD_ID
            results.append(
                {
                    "interaction_at": at.isoformat(),
                    "correct": correct,
                    "expected": {
                        "rating": int(log.rating),
                        "state": updated.state.name,
                        "step": updated.step,
                        "stability": updated.stability,
                        "difficulty": updated.difficulty,
                        "interval_days": delta.days,
                        "interval_seconds": delta.days * 86400,
                        "due_at": updated.due.isoformat(),
                        "last_review": updated.last_review.isoformat(),
                    },
                }
            )
            card = updated
        cases.append({"name": name, "initial": initial, "steps": results})
    source_hashes = {
        Path(inspect.getsourcefile(obj)).name: sha256(
            Path(inspect.getsourcefile(obj)).read_bytes()
        ).hexdigest()
        for obj in (Card, Scheduler)
    }
    return {
        "provenance": {
            "distribution": "fsrs",
            "version": version("fsrs"),
            "python": platform.python_version(),
            "implementation": platform.python_implementation(),
            "machine": platform.machine(),
            "config_sha256": CONFIG_DIGEST,
            "direct_call_path": "fsrs.Card + fsrs.Scheduler.review_card; no application adapter import",
            "source_sha256": source_hashes,
            "parameters": list(PARAMETERS),
            "desired_retention": 0.9,
            "learning_steps": [],
            "relearning_steps": [],
            "maximum_interval": 36500,
            "enable_fuzzing": False,
            "user_id": str(USER),
            "vocabulary_item_id": str(ITEM),
            "card_id": CARD_ID,
        },
        "cases": cases,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--output", type=Path)
    group.add_argument("--check", type=Path)
    args = parser.parse_args()
    result = capture()
    if args.check:
        assert json.loads(args.check.read_text(encoding="utf-8")) == result
        print("Pinned direct-library golden reproduction: PASS")
    else:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
        print(
            f"Captured {len(result['cases'])} families / {sum(len(c['steps']) for c in result['cases'])} literal transitions"
        )


if __name__ == "__main__":
    main()
