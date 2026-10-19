from decimal import Decimal, localcontext
import pytest
from app.modules.monitoring.metrics import released_mean
from app.modules.progress.metrics import submission_counts


@pytest.mark.parametrize("points,n,expected", [("1", 8, "0.13"), ("0", 2, "0.00"), ("2", 3, "0.67"), ("18", 2, "9.00")])
def test_decimal_mean_rounds_once(points, n, expected):
    with localcontext() as context:
        context.prec = 2
        value = released_mean(
            [
                dict(
                    n=n,
                    points=Decimal(points),
                    possible_points=Decimal("9.00"),
                    engine_version="v1",
                    policy_version="p1",
                )
            ]
        )
    assert value.mean_points == Decimal(expected) and value.eligible_results == n


def test_unavailable_and_incomparable():
    assert released_mean([]).status == "unavailable"
    assert released_mean([dict(n=1), dict(n=1)]).status == "not_comparable"
    assert submission_counts(6, 2, 3).pending == 3
    with pytest.raises(ValueError):
        submission_counts(1, 1, 1)
