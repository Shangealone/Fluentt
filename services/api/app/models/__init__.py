"""Import this registry before using Base.metadata or configuring migrations."""

from app.models import ai, assessments, curriculum, learning, operations, research, users  # noqa: F401
from app.models import validation  # noqa: F401, E402
