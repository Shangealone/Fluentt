"""One canonical rule; the new-account policy is stricter than legacy storage."""

import re

RESERVED_USERNAMES = frozenset({"admin", "administrator", "system", "support"})
USERNAME_FORMAT = re.compile(r"[A-Za-z0-9_]+", re.ASCII)


class UsernameValidationError(ValueError):
    """Contains a fixed public message, never raw request data."""


def normalize_username(value: str) -> str:
    """Preserve Section 02's 3–32 character storage policy for existing records."""
    value = value.strip()
    if not 3 <= len(value) <= 32 or USERNAME_FORMAT.fullmatch(value) is None:
        raise UsernameValidationError("Username must contain 3–32 ASCII letters, digits or underscores.")
    return value.lower()


def validate_new_username(value: str) -> str:
    """Validate explicitly chosen public usernames; return their canonical value."""
    if value != value.strip():
        raise UsernameValidationError("Remove spaces before or after your username.")
    if len(value) < 3:
        raise UsernameValidationError("Use at least 3 characters for your username.")
    if len(value) > 24:
        raise UsernameValidationError("Use no more than 24 characters for your username.")
    if USERNAME_FORMAT.fullmatch(value) is None:
        raise UsernameValidationError("Use only letters A–Z, numbers and underscores.")
    canonical = normalize_username(value)
    if canonical in RESERVED_USERNAMES:
        raise UsernameValidationError("This username is reserved. Please choose another.")
    return canonical
