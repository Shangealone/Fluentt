"""Original, unpublished English pilot. No YouTube audio or retrieved transcripts."""
from uuid import NAMESPACE_URL, uuid5

from app.modules.questions.schemas import AUTHOR_MODELS

PACK = "fluentt-english-grammar-pilot-v1"


def content_id(key):
    return uuid5(NAMESPACE_URL, f"fluentt://content/{PACK}/{key}")


def choice(prompt, options, correct, explanation, difficulty="medium"):
    return dict(method="multiple_choice", prompt=prompt, difficulty=difficulty,
                content={"options": [{"id": f"o{i}", "text": text} for i, text in enumerate(options)]},
                answer_key={"correct_option_id": f"o{correct}"}, explanation=explanation)


def sentence(words, difficulty="medium"):
    tokens = [{"id": f"t{i}", "text": word} for i, word in enumerate(words)]
    # Stable scrambled presentation; target IDs retain the authored sequence.
    order = list(range(1, len(tokens), 2)) + list(range(0, len(tokens), 2))
    return dict(method="word_arrangement", prompt="Build the sentence.", difficulty=difficulty,
                instructions="Use every word group. Begin with the capital letter and end with the full stop.",
                content={"items": [tokens[i] for i in order]},
                answer_key={"ordered_ids": [token["id"] for token in tokens]},
                explanation=" ".join(words))


def card(cue, back, difficulty="medium"):
    return dict(method="flashcards", prompt="Think about this expression, then reveal the card.",
                difficulty=difficulty, content={"cue": cue}, answer_key={"back": back}, explanation=None)


LESSONS = [
    dict(slug="ability", title="Can, Could, and Be Able To", grade=7,
         topic="Talking about ability", source_url="https://www.youtube.com/watch?v=hZx7JrIm9lg",
         source_title="Can, Could, Be able – English Grammar Lesson || Modal verbs",
         introduction="Use can for ability now: I can draw. Use could for a general ability in the past: At six, I could ride a bike. After will, use be able to: I will be able to swim. For one completed success in the past, use was or were able to: After several tries, we were able to finish. Could has other past uses too, including perception (I could hear music) and negative ability (I couldn't open the door).",
         competency="Choose expressions for present ability, general past ability, future ability, and a completed past success.",
         items=[
             choice("Present ability: Mia ___ speak two languages.", ["can", "could", "will can"], 0, "Can + base verb describes present ability."),
             choice("General past ability: When I was younger, I ___ run very far.", ["can", "could", "will can"], 1, "Could describes a general ability in the past."),
             choice("Next year, I will ___ join the school team.", ["can", "could", "be able to"], 2, "Use will be able to. Will can is not standard English."),
             choice("A completed success: After several tries, Leo finally ___ solve the puzzle yesterday.", ["can", "could", "was able to"], 2, "Was able to describes this specific completed success.", "hard"),
             sentence(["I", "can", "help", "you."]),
             sentence(["We", "could", "see", "the", "mountains."]),
             sentence(["She", "will", "be able to", "try again."]),
             card("can", "Present or general ability: I can draw a bird. Negative: I cannot draw a map."),
             card("could", "General past ability: At six, I could ride a bike. Use the base verb after could."),
             card("be able to", "Express ability when another form is needed: After more practice, I will be able to swim."),
             card("was/were able to", "Past ability, often for a completed success: We were able to finish the project yesterday.", "hard"),
         ]),
    dict(slug="possession", title="Has, Have, and Had", grade=5,
         topic="Talking about what we have", source_url="https://www.youtube.com/watch?v=38Rvwo8srFE",
         source_title="HAS, HAVE, HAD || Tamang paggamit ng Has, Have, Had",
         introduction="Use has with he, she, it, or a singular noun: My brother has a kite. Use have with I, you, we, they, or plural nouns: My friends have bags. Use had for possession in the past with any subject. To make a negative sentence, use doesn't have, don't have, or didn't have. After does or did, keep the base form have. This lesson practices possession; have can also be a helping verb in other lessons.",
         competency="Use has, have, had and their simple negative forms to describe possession.",
         items=[
             choice("Present possession: The teacher ___ a blue notebook.", ["has", "have", "having"], 0, "The teacher is singular, so use has.", "easy"),
             choice("Present possession: My friends ___ new bags.", ["has", "have", "having"], 1, "My friends is plural, so use have.", "easy"),
             choice("We ___ a small garden last year.", ["has", "have", "had"], 2, "Last year tells us to use the past form had."),
             choice("Make this negative: Nico ___ a pencil today.", ["doesn't have", "doesn't has", "don't have"], 0, "Nico takes doesn't, followed by have."),
             choice("Make this negative: They ___ a car when they were younger.", ["didn't had", "don't have", "didn't have"], 2, "Didn't marks the past. Use have after it."),
             sentence(["She", "has", "a", "red", "umbrella."], "easy"),
             sentence(["We", "have", "three", "science", "books."], "easy"),
             sentence(["I", "didn't have", "a", "bicycle", "then."]),
             card("has", "Present possession with he, she, it, or a singular noun: My brother has a kite.", "easy"),
             card("have", "Present possession with I, you, we, they, or plural nouns: You have a colorful bag.", "easy"),
             card("had", "Past possession with any subject: Our class had a pet fish last year."),
             card("doesn't have", "Present negative with he, she, it, or a singular noun: Sam doesn't have a ruler."),
             card("don't have", "Present negative with I, you, we, they, or plural nouns: We don't have any chalk."),
             card("didn't have", "Past negative with any subject: I didn't have my lunchbox yesterday."),
         ]),
    dict(slug="polite-requests", title="A Friendly Way to Ask", grade=7,
         topic="Everyday conversations", source_url="https://www.youtube.com/watch?v=iZYbil-RV9Q",
         source_title='"I just want to..." VS. "I just wanted to..."',
         introduction="I just want to introduces a direct present intention. I just wanted to can soften a request you are making now, even though wanted has a past form. It can also describe a past intention. Both forms can be friendly and appropriate with a friend or teacher. The surrounding conversation and your tone matter. In these activities, choose the wording for the tone named in the instruction.",
         competency="Distinguish direct present intentions from softened present requests using context.",
         items=[
             choice("Use a direct present intention: I just ___ to ask about the game.", ["want", "wanted"], 0, "Want matches the requested direct present wording. Wanted could fit a different tone or context."),
             choice("Use a softer introduction to a present request: I just ___ to check my schedule.", ["want", "wanted"], 1, "Wanted can soften a request being made now."),
             choice("Use a softer introduction in a message: I just ___ to ask if the meeting is still today.", ["want", "wanted"], 1, "Wanted matches the requested softer introduction."),
             choice("Use a direct present intention: I just ___ to borrow your ruler.", ["want", "wanted"], 0, "Want matches the requested tone. Neither expression is inherently rude."),
             sentence(["I", "just", "want", "to", "ask", "something."]),
             sentence(["I", "just", "wanted", "to", "check", "the time."]),
             sentence(["I", "just", "wanted", "to", "say", "thank you."]),
             card("direct", "States an intention clearly: I just want to ask a question. Direct wording can still be friendly."),
             card("polite", "Shows consideration through wording, tone, and context: Excuse me. I just wanted to ask a question."),
             card("intention", "Something you plan or wish to do: I want to learn a new song."),
             card("I just want to…", "Introduces a direct present intention: I just want to check our homework."),
             card("I just wanted to…", "Can introduce a softer present request or describe a past intention. Use the surrounding conversation to decide: I just wanted to ask about tomorrow's trip."),
         ]),
]


def definitions(lesson):
    """Validate every authored definition before a preview or database write."""
    for item in lesson["items"]:
        yield AUTHOR_MODELS[item["method"]].model_validate(dict(
            lesson_id=content_id(lesson["slug"]), language="english", points="1.00", schema_version=1,
            competency_ids=[content_id(lesson["slug"] + "/competency")], grading_version="ungraded-v1",
            **item))
