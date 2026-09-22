import argparse
import json
import os
import sys
from pathlib import Path

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.content.service import import_content_data
from app.database.session import SessionLocal


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Import curated language learning content from a JSON file."
    )
    parser.add_argument(
        "file_path",
        help="Path to the content JSON file (e.g. ../scripts/seed_content/sample-en-v0.1.json)",
    )
    args = parser.parse_args()

    content_path = Path(args.file_path)
    if not content_path.exists():
        print(f"Error: file not found: {content_path}", file=sys.stderr)
        sys.exit(1)

    with open(content_path, encoding="utf-8") as f:
        data = json.load(f)

    db = SessionLocal()
    try:
        import_content_data(db, data)
        lang_code = data.get("language", {}).get("code", "unknown")
        version = data.get("content_version", "unknown")
        lessons_count = len(data.get("lessons", []))
        total_items = sum(
            len(lesson.get("vocabulary_items", []))
            for lesson in data.get("lessons", [])
        )
        print(f"Content imported successfully for language '{lang_code}'.")
        print(f"Content Version: {version}")
        print(f"Lessons imported: {lessons_count}")
        print(f"Vocabulary items imported: {total_items}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
