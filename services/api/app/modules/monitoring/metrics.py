"""Only the explicitly approved within-assignment released-point mean."""

from decimal import Decimal, localcontext, ROUND_HALF_UP
from app.modules.monitoring.schemas import Mean


def released_mean(groups):
    total = sum(row["n"] for row in groups)
    if not total:
        return Mean(status="unavailable", eligible_results=0)
    if len(groups) != 1:
        return Mean(status="not_comparable", eligible_results=total)
    group = groups[0]
    with localcontext() as context:
        context.prec = 50
        mean = (group["points"] / Decimal(total)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return Mean(
        status="available",
        eligible_results=total,
        mean_points=mean,
        max_points=group["possible_points"],
        engine_version=group["engine_version"],
        policy_version=group["policy_version"],
    )
