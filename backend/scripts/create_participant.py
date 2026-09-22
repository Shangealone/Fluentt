import argparse
import os
import secrets
import string
import sys

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.auth.service import (
    DuplicateParticipantError,
    provision_participant,
)
from app.database.session import SessionLocal


def generate_temporary_password(length: int = 14) -> str:
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    while True:
        password = "".join(secrets.choice(alphabet) for _ in range(length))
        has_upper = any(c.isupper() for c in password)
        has_lower = any(c.islower() for c in password)
        has_digit = any(c.isdigit() for c in password)
        has_special = any(c in "!@#$%^&*" for c in password)
        if has_upper and has_lower and has_digit and has_special:
            return password


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Provision a new learner participant account."
    )
    parser.add_argument(
        "--email", required=True, help="Learner email address"
    )
    parser.add_argument(
        "--participant-code",
        required=True,
        help="Unique participant code (e.g. P001)",
    )
    parser.add_argument(
        "--password",
        required=False,
        help="Optional explicit temporary password",
    )
    args = parser.parse_args()

    temporary_password = args.password or generate_temporary_password()

    db = SessionLocal()
    try:
        user = provision_participant(
            db,
            email=args.email,
            participant_code=args.participant_code,
            temporary_password=temporary_password,
        )
        print("Participant provisioned successfully.")
        print(f"Participant Code: {user.participant_code}")
        print(f"Email: {user.email}")
        print(f"Temporary Password: {temporary_password}")
        print("NOTE: This temporary password is only displayed once.")
    except DuplicateParticipantError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    main()
