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
