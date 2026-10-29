class IdentityError(Exception):
    """Safe fixed messages for the API error envelope."""

    def __init__(self, status: int, code: str, message: str, headers: dict[str, str] | None = None):
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message
        self.headers = headers or {}


def invalid_session() -> IdentityError:
    return IdentityError(
        401, "invalid_session", "Your device session is invalid or has expired.", {"WWW-Authenticate": "Bearer"}
    )


def username_taken() -> IdentityError:
    return IdentityError(409, "username_taken", "This username is already taken.")
