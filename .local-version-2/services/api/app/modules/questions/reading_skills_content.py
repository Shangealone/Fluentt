"""Original Grade 3 reading lessons informed by SRC-04's registered use.

The linked reader has no readable machine text. Passages and activities here
are newly written for Fluentt; they do not reproduce any source pages.
"""
from uuid import NAMESPACE_URL, uuid5
from app.modules.questions.schemas import AUTHOR_MODELS
from app.modules.questions.pilot_content import choice, sentence, card

PACK = "fluentt-reading-skills-v1"
SOURCE = "https://online.flipbuilder.com/yhrca/ycxz/"
EDITION_NAME = "English: Reading Skills"
EDITION_DESCRIPTION = "Original Grade 3 lessons for main ideas, details, context clues and retelling in order."
SOURCE_ID = "SRC-04"
SOURCE_BASIS = "SRC-04 reader identification and registered reading-skills use; reader text not machine-readable; original Fluentt passages"
PERMISSION_STATEMENT = "User-supplied source; permission confirmed 2026-10-29"
QUARTER_NAME = "Reading together"


def content_id(key):
    return uuid5(NAMESPACE_URL, f"fluentt://content/{PACK}/{key}")


def lesson(slug, title, topic, intro, reading, competency, questions, sentences, cards):
    items = [choice(prompt, options, answer, why, "easy") for prompt, options, answer, why in questions]
    items += [sentence(words, "easy") for words in sentences]
    items += [card(front, back, "easy") for front, back in cards]
    return dict(slug=slug, title=title, topic=topic, grade=3, source_id=SOURCE_ID, source_url=SOURCE,
                introduction=intro, reading=reading, competency=competency, items=items)


LESSONS = [
 lesson("main-idea", "Find the Main Idea", "Main idea",
        "Look for what most of a short passage is mainly about.",
        "A class starts a small seed shelf. Learners place labeled seed packets in a box and write simple planting tips. Anyone may take a few seeds and leave some for another gardener. The class hopes more people will grow plants and share what they learn.\n\nThe passage mentions a box, labels, and planting tips. Those details support the main idea: the class created a seed shelf so people can share seeds and learn to garden. A main idea tells what the whole passage is mostly about.\n\nTry it: After reading a paragraph, ask, ‘What do most of these sentences tell me?’",
        "Identify the central idea and distinguish it from a supporting detail.",
        [("What is the passage mostly about?", ["A class making a seed shelf for sharing", "A learner buying a new box", "A list of school subjects"], 0, "The details all support the shared seed shelf and its purpose."),
         ("Which is one detail that supports the main idea?", ["Learners label seed packets", "The class visits the moon", "A dog paints a sign"], 0, "The passage says the learners place labeled packets in the box."),
         ("Which title best matches the whole passage?", ["A Shelf of Seeds to Share", "The Long Bus Ride", "A Rainy Soccer Game"], 0, "The whole passage describes a shelf for sharing seeds.")],
        [["The", "class", "shares", "seeds", "and", "planting", "tips."], ["A", "main", "idea", "tells", "what", "a", "passage", "is", "mostly", "about."]],
        [("main idea", "What a whole passage is mostly about."), ("detail", "A smaller piece of information that supports an idea."), ("support", "Help show why an idea fits the passage.")]),

 lesson("find-a-detail", "Look Back for a Detail", "Finding details",
        "Use information stated in the passage to answer who, what, when or where.",
        "On Wednesday, Mina's class visits the school garden. Mina writes three observations in her notebook. She notices a yellow flower beside the path and a small snail under a leaf. Before returning to class, the group waters the young plants.\n\nA question asks, ‘What color is the flower?’ To answer, look back at the sentence that names the flower. It is yellow. The passage does not say Mina's favorite color, so we should not guess it.\n\nTry it: Find a word in the question, then look for that word or idea in the passage.",
        "Find an explicitly stated detail without adding information that is not there.",
        [("When does Mina's class visit the garden?", ["Wednesday", "Saturday", "Monday"], 0, "The first sentence says the class visits on Wednesday."),
         ("Where is the snail?", ["Under a leaf", "In Mina's bag", "Beside the classroom door"], 0, "Mina sees the snail under a leaf."),
         ("What does the passage say about Mina's favorite color?", ["It does not say", "It is yellow", "It is green"], 0, "Yellow describes the flower; Mina's favorite color is not given.")],
        [["Mina", "writes", "three", "observations", "in", "her", "notebook."], ["The", "snail", "is", "under", "a", "leaf."]],
        [("observation", "Something noticed by looking or listening carefully."), ("explicit", "Stated clearly in the passage."), ("look back", "Read part of the text again to find an answer.")]),

 lesson("context-clues", "Use Clues Around a New Word", "Context clues",
        "Use nearby words and events to make a careful guess about a new word.",
        "After running around the field, Ivo felt parched. His mouth was dry, and he asked for a drink of water. He drank slowly and soon felt better.\n\nThe passage gives clues to the meaning of parched: Ivo ran, his mouth was dry, and he wanted water. These clues suggest that parched means very thirsty. Context clues help readers make a sensible guess, but a dictionary can give a fuller meaning.\n\nTry it: Read the whole sentence around an unfamiliar word. Which nearby details help you understand it?",
        "Use surrounding details to infer the likely meaning of an unfamiliar word.",
        [("What does parched most likely mean in this passage?", ["Very thirsty", "Very sleepy", "Very noisy"], 0, "Ivo's dry mouth and request for water show that he is thirsty."),
         ("Which clue helps explain parched?", ["He asks for water", "He reads a map", "He puts on a jacket"], 0, "Asking for water is a clue to being thirsty."),
         ("Where should a reader look for context clues?", ["Around the unfamiliar word", "Only at the page number", "In an unrelated story"], 0, "Nearby details can help show what the word means here.")],
        [["Ivo", "felt", "very", "thirsty", "after", "running."], ["Nearby", "details", "can", "give", "a", "clue."]],
        [("context", "The words and events around a word or idea."), ("clue", "A detail that helps someone figure something out."), ("infer", "Use clues to reach a careful idea that is not said directly.")]),

 lesson("retell-in-order", "Retell Events in Order", "Sequence and retelling",
        "Notice what happens first, next and last in a short story.",
        "Ari wants to fly a paper kite. First, Ari and an older cousin check that the open field is clear. Next, they attach a long string to the kite. Then Ari holds it up while the cousin walks into a gentle breeze. Finally, Ari lets out a little string as the kite rises.\n\nSequence words such as first, next, then and finally help a reader follow events. When you retell, include the important actions in the order they happen.\n\nTry it: Retell the kite story using first, next, then and finally.",
        "Retell the main events from a passage in their stated order.",
        [("What do Ari and the cousin do first?", ["Check that the field is clear", "Let out the string", "Put the kite away"], 0, "The story begins with checking that the field is clear."),
         ("What happens after they attach the string?", ["Ari holds up the kite", "They eat a cake", "The kite is already put away"], 0, "Next they attach the string; then Ari holds up the kite."),
         ("Which word signals the last event?", ["Finally", "Yesterday", "Before"], 0, "The final sentence starts with ‘Finally.’")],
        [["First,", "they", "check", "the", "field."], ["Finally,", "the", "kite", "rises."]],
        [("sequence", "The order in which things happen."), ("retell", "Tell the important events of a story again."), ("finally", "A word that can introduce the last step or event.")]),
]


def definitions(lesson):
    for item in lesson["items"]:
        yield AUTHOR_MODELS[item["method"]].model_validate(dict(
            lesson_id=content_id(lesson["slug"]), language="english", points="1.00", schema_version=1,
            competency_ids=[content_id(lesson["slug"] + "/competency")], grading_version="ungraded-v1", **item))
