"""Original Grade 1 letter-recognition lessons informed by SRC-03's topic outline.

Practice is text based: no source audio, pictures, stories, or source word lists are copied.
"""
from uuid import NAMESPACE_URL, uuid5
from app.modules.questions.schemas import AUTHOR_MODELS
from app.modules.questions.pilot_content import choice, sentence, card

PACK = "fluentt-first-letters-v1"
SOURCE = "https://www.scribd.com/document/560606335/Come-on-Phonics-1-SB"


def content_id(key):
    return uuid5(NAMESPACE_URL, f"fluentt://content/{PACK}/{key}")


# Curated short examples. X is deliberately taught as a final letter in fox:
# initial x is not reliably pronounced like the x sound at the end of fox.
GROUPS = [
    ("abc", [("A", "apple", "ant"), ("B", "ball", "bus"), ("C", "cat", "cup")]),
    ("def", [("D", "dog", "door"), ("E", "egg", "elbow"), ("F", "fish", "fan")]),
    ("ghi", [("G", "goat", "gift"), ("H", "hat", "hand"), ("I", "insect", "igloo")]),
    ("jkl", [("J", "jam", "jet"), ("K", "kite", "key"), ("L", "lamp", "leaf")]),
    ("mno", [("M", "moon", "map"), ("N", "nest", "nose"), ("O", "octopus", "ox")]),
    ("pqr", [("P", "pig", "pen"), ("Q", "queen", "quilt"), ("R", "rain", "red")]),
    ("stu", [("S", "sun", "sock"), ("T", "tent", "top"), ("U", "umbrella", "up")]),
    ("vwx", [("V", "van", "vet"), ("W", "web", "win"), ("X", "fox", "box")]),
    ("yz", [("Y", "yellow", "yarn"), ("Z", "zip", "zoo")]),
]


def make_lesson(slug, examples):
    letters = ", ".join(letter for letter, _, _ in examples)
    lines = []
    items = []
    for index, (letter, word, alternate) in enumerate(examples):
        final = letter == "X"
        relation = "ends with" if final else "starts with"
        lines.append(f"{letter} and {letter.lower()}: {word} {relation} {letter.lower()}. Another example is {alternate}.")
        other_words = [other[1] for j, other in enumerate(examples) if j != index]
        items.append(choice(f"Which word {relation} the letter {letter.lower()}?", [word, *other_words], 0,
                            f"{word.capitalize()} {relation} the letter {letter.lower()}.", "easy"))
        items.append(card(f"{letter} {letter.lower()}", f"{word.capitalize()} {relation} {letter.lower()}. Another example is {alternate}.", "easy"))
    first_letter, first_word, _ = examples[0]
    last_letter, last_word, _ = examples[-1]
    items.extend([
        sentence([first_word.capitalize(), "has", "the", "letter", f"{first_letter.lower()}."], "easy"),
        sentence([last_word.capitalize(), "has", "the", "letter", f"{last_letter.lower()}."], "easy"),
    ])
    extra = " In queen and quilt, q is followed by u." if slug == "pqr" else " In fox and box, x is the last letter." if slug == "vwx" else ""
    return dict(slug=f"letters-{slug}", title=f"Meet the Letters {letters}", grade=1,
                topic=f"Recognizing {letters}", source_id="SRC-03", source_url=SOURCE,
                introduction=f"Look for uppercase and lowercase {letters} in familiar words.",
                reading=f"Letters help us write words. An uppercase letter and its lowercase form name the same letter. Today, look at {letters}.\n\n" + "\n".join(lines) + extra +
                        "\n\nRead the examples with a teacher or trusted adult if you like. Look for the letter in each word, then find another example together. Letters can have different sounds in different words; these are just starting examples.",
                competency=f"Recognize uppercase and lowercase {letters} in familiar printed words.", items=items)


LESSONS = [make_lesson(slug, entries) for slug, entries in GROUPS]


def definitions(lesson):
    for item in lesson["items"]:
        yield AUTHOR_MODELS[item["method"]].model_validate(dict(
            lesson_id=content_id(lesson["slug"]), language="english", points="1.00", schema_version=1,
            competency_ids=[content_id(lesson["slug"] + "/competency")], grading_version="ungraded-v1", **item))
