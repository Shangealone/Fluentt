"""GPL-3.0. Phone-token errors, never learner pronunciation scores."""
import argparse
import json
from pathlib import Path
import unicodedata


def tokens(value):
    if not isinstance(value, list) or any(not isinstance(x, str) or not x or any(c.isspace() for c in x) for x in value):
        raise ValueError("Expected explicit nonempty IPA tokens, not a character string")
    return [unicodedata.normalize("NFC", x) for x in value]


def phone_errors(reference, hypothesis):
    a, b = tokens(reference), tokens(hypothesis)
    if not a:
        raise ValueError("Empty reference has no PER denominator")
    # Each cell retains cost, S, D, I; choice order resolves equal-cost alignments.
    previous = [(j, 0, 0, j) for j in range(len(b) + 1)]
    for i, left in enumerate(a, 1):
        current = [(i, 0, i, 0)]
        for j, right in enumerate(b, 1):
            cost, s, d, ins = previous[j - 1]
            diagonal = (cost + (left != right), s + (left != right), d, ins)
            cost, s, d, ins = previous[j]
            deletion = (cost + 1, s, d + 1, ins)
            cost, s, d, ins = current[j - 1]
            insertion = (cost + 1, s, d, ins + 1)
            current.append(min((diagonal, deletion, insertion), key=lambda x: x[0]))
        previous = current
    errors, s, d, ins = previous[-1]
    return {"substitutions": s, "deletions": d, "insertions": ins, "errors": errors,
            "reference_phones": len(a), "per": errors / len(a)}


def evaluate(rows):
    if not rows:
        raise ValueError("No independent annotated evaluation rows")
    total = dict(substitutions=0, deletions=0, insertions=0, errors=0, reference_phones=0)
    seen = set()
    results = []
    for row in rows:
        if row["id"] in seen:
            raise ValueError("Duplicate evaluation ID")
        seen.add(row["id"])
        evidence = row["annotation"]
        # Attestations are required but are not themselves independent verification.
        if evidence.get("kind") != "human_audio_transcription" or evidence.get("model_blind") is not True:
            raise ValueError("Independent human audio transcription required")
        for field in ["source_url", "license", "annotator_protocol", "audio_sha256", "speaker_id"]:
            if not evidence.get(field):
                raise ValueError("Missing annotation provenance: " + field)
        result = phone_errors(row["reference_phones"], row["hypothesis_phones"])
        results.append({"id": row["id"], **result})
        for key in total:
            total[key] += result[key]
    return {"metric": "phone-recognizer-error-not-pronunciation-quality", "policy": "nfc-token-unit-edit-v1",
            "tie_priority": ["match_or_substitution", "deletion", "insertion"], "items": results,
            **total, "micro_per": total["errors"] / total["reference_phones"],
            "independence_status": "caller_attestation_requires_external_review"}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("references_jsonl", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    rows = [json.loads(x) for x in args.references_jsonl.read_text(encoding="utf-8").splitlines() if x.strip()]
    result = evaluate(rows)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
