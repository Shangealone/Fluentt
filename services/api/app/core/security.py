"""Opaque mobile credentials, not passwords or username-based recovery."""

import hashlib
import re
import secrets
from dataclasses import dataclass, field

CREDENTIAL_FORMAT = re.compile(r"flt_[A-Za-z0-9_-]{43}", re.ASCII)


@dataclass(frozen=True)
class IssuedCredential:
    raw: str = field(repr=False)
    digest: str = field(repr=False)


def issue_credential() -> IssuedCredential:
    raw = "flt_" + secrets.token_urlsafe(32)
    return IssuedCredential(raw=raw, digest=credential_digest(raw))


def credential_digest(raw: str) -> str:
    return hashlib.sha256(raw.encode("ascii")).hexdigest()


def valid_credential_format(raw: str) -> bool:
    return CREDENTIAL_FORMAT.fullmatch(raw) is not None


def hash_password(password: str) -> str:
    """Hash password using scrypt with unique salt."""
    salt = secrets.token_hex(16)
    key = hashlib.scrypt(password.encode("utf-8"), salt=salt.encode("ascii"), n=16384, r=8, p=1).hex()
    return f"scrypt:{salt}:{key}"


def verify_password(password: str, hashed: str | None) -> bool:
    """Verify password against scrypt hash in constant time."""
    if not hashed:
        return False
    parts = hashed.split(":")
    if len(parts) != 3 or parts[0] != "scrypt":
        return False
    salt, expected_key = parts[1], parts[2]
    candidate_key = hashlib.scrypt(password.encode("utf-8"), salt=salt.encode("ascii"), n=16384, r=8, p=1).hex()
    return secrets.compare_digest(candidate_key, expected_key)

