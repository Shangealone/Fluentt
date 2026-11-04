"""Original English lessons inspired by the user's VID-04–VID-07 topic summaries.

Video transcripts and audio were not retrieved or copied.
"""
from uuid import NAMESPACE_URL, uuid5
from app.modules.questions.schemas import AUTHOR_MODELS
from app.modules.questions.pilot_content import choice, sentence, card

PACK = "fluentt-grammar-followup-v1"


def content_id(key):
    return uuid5(NAMESPACE_URL, f"fluentt://content/{PACK}/{key}")


LESSONS = [
    dict(slug="pairs-and-plurals", title="Talking About Pairs", grade=7, topic="Plural nouns and pairs",
         source_id="VID-04", source_url="https://www.youtube.com/watch?v=u27aOq_UWTA",
         introduction="Some everyday nouns are usually plural. Learn how to talk about one pair or several pairs clearly.",
         reading="Some objects have names that usually appear in the plural, even when we are talking about one item. Examples include scissors, trousers, and binoculars. We normally say, ‘These scissors are sharp,’ not ‘This scissors is sharp.’\n\nTo count such objects, use pair. Compare: ‘One pair of scissors is on the desk’ and ‘Two pairs of scissors are on the desk.’ In the first sentence, pair is singular, so the verb is is. In the second, pairs is plural, so the verb is are.\n\nTry it: Look for an object at home or school that has two matching parts. Describe one pair, and then imagine describing two pairs. Some words have other meanings, so choose the form that fits your meaning.",
         competency="Use plural forms and pair/pairs with matching verbs in familiar contexts.", items=[
             choice("Choose the standard sentence about the scissors.", ["These scissors are sharp.", "This scissors is sharp.", "These scissors is sharp."], 0, "Scissors is normally used as a plural noun."),
             choice("One pair of trousers ___ on the chair.", ["is", "are", "were being"], 0, "The subject one pair is singular."),
             choice("Two pairs of binoculars ___ on the shelf.", ["is", "are", "am"], 1, "The subject two pairs is plural."),
             sentence(["These", "scissors", "are", "sharp."]),
             sentence(["One", "pair", "of", "trousers", "is", "clean."]),
             card("scissors", "Usually plural: These scissors are on the desk."),
             card("one pair", "A singular count: One pair of binoculars is here."),
             card("two pairs", "A plural count: Two pairs of trousers are ready.")]),
    dict(slug="main-subject", title="Find the Main Subject", grade=7, topic="Subject–verb agreement",
         source_id="VID-05", source_url="https://www.youtube.com/watch?v=ZEeCpWnCHpw",
         introduction="A phrase giving extra information can sit between a subject and its verb. Find the main subject before choosing the verb.",
         reading="The main subject tells us who or what the sentence is mainly about. In ‘The coach, along with the players, is ready,’ the main subject is the coach. The phrase along with the players adds information but does not turn the main subject into the players. Because coach is singular, use is.\n\nCompare: ‘The players, along with the coach, are ready.’ Now players is the main subject, so use are. The expressions together with and as well as can also add information after the main subject.\n\nTry it: Find the main subject in ‘The librarian, together with two volunteers, opens the room.’ Cover the extra phrase for a moment: ‘The librarian opens the room.’ Then bring the phrase back and read the whole sentence.",
         competency="Identify the main subject and choose a matching verb when an additional phrase follows it.", items=[
             choice("The captain, together with the players, ___ ready.", ["is", "are", "am"], 0, "The main subject captain is singular."),
             choice("The players, along with the captain, ___ ready.", ["is", "are", "am"], 1, "The main subject players is plural."),
             choice("In ‘The teacher, as well as the learners, reads aloud,’ what is the main subject?", ["The teacher", "The learners", "Aloud"], 0, "The teacher is the main subject; the phrase adds information."),
             sentence(["The", "guide,", "along", "with", "the", "visitors,", "is", "here."]),
             sentence(["The", "children,", "together", "with", "their", "teacher,", "are", "ready."]),
             card("main subject", "The person or thing the sentence is mainly about: The coach is ready."),
             card("together with", "An additional phrase: The coach, together with the players, is ready."),
             card("subject and verb", "The main subject determines the verb: The players are ready.")]),
    dict(slug="or-and-nor", title="Choosing a Verb with Or and Nor", grade=7, topic="Agreement with choices",
         source_id="VID-06", source_url="https://www.youtube.com/watch?v=dYYI5FgbrPY",
         introduction="When subjects are joined by or or nor, look carefully at the subject nearest the verb.",
         reading="Or and nor can join alternative subjects. When both subjects are singular, use a singular verb: ‘Either Mara or Leo is bringing the map.’ The word either introduces the alternatives; is matches the singular subjects.\n\nWhen one subject is singular and the other is plural, the verb commonly agrees with the nearer subject in standard English. Compare ‘Either the teachers or the principal is speaking’ with ‘Either the principal or the teachers are speaking.’ The word closest to the verb changes from principal to teachers.\n\nTry it: Write a sentence with two people joined by or. Find the subject nearest the verb and read the sentence aloud. If a sentence sounds awkward, you can also rewrite it to make the meaning clearer.",
         competency="Choose appropriate agreement with subjects joined by or/nor in clear examples.", items=[
             choice("Either Ana or Luis ___ bringing the map.", ["is", "are", "am"], 0, "Both named subjects are singular, so is fits."),
             choice("Either the teachers or the principal ___ speaking.", ["is", "are", "am"], 0, "The nearer subject principal is singular."),
             choice("Neither the principal nor the teachers ___ late.", ["is", "are", "am"], 1, "The nearer subject teachers is plural."),
             sentence(["Either", "Mia", "or", "Ben", "is", "presenting."]),
             sentence(["Neither", "the", "guide", "nor", "the", "visitors", "are", "late."]),
             card("or", "Can join alternatives: Either Lea or Max is helping."),
             card("nor", "Can join alternatives after neither: Neither cup nor plate is broken."),
             card("nearer subject", "With mixed-number alternatives, agreement commonly follows the subject nearest the verb.")]),
    dict(slug="each-of", title="Using Each and Each Of", grade=7, topic="Talking about individuals",
         source_id="VID-07", source_url="https://www.youtube.com/watch?v=y-KcheEVN6Y",
         introduction="Each focuses on members one at a time. Practice choosing singular verbs in clear each and each of sentences.",
         reading="Each points to the members of a group one by one. In ‘Each learner has a notebook,’ each learner is singular, so has fits. In ‘Each of the learners has a notebook,’ the phrase of the learners names the group, while each remains singular in standard formal agreement.\n\nCompare each with all: ‘Each of the books is labeled’ focuses on the books individually; ‘All of the books are labeled’ uses the plural books as its subject. Both sentences can describe the same group from a different point of view.\n\nTry it: Finish ‘Each of my classmates has…’ with something that makes sense for your class. Then make a new sentence beginning ‘All of my classmates…’ and choose a verb that matches.",
         competency="Use singular verb agreement with each and each of in straightforward sentences.", items=[
             choice("Each of the folders ___ a label.", ["has", "have", "having"], 0, "Each is singular here, so use has."),
             choice("Each learner ___ ready.", ["is", "are", "am"], 0, "Each learner is singular."),
             choice("All of the folders ___ on the desk.", ["is", "are", "has"], 1, "All of the folders refers to plural folders, so are fits."),
             sentence(["Each", "of", "the", "books", "has", "a", "label."]),
             sentence(["Each", "learner", "is", "ready."]),
             card("each", "Focuses on members one at a time: Each learner has a page."),
             card("each of", "Use a plural group noun after of: Each of the books is labeled."),
             card("all of", "Can refer to the whole plural group: All of the books are labeled.")]),
]


def definitions(lesson):
    for item in lesson["items"]:
        yield AUTHOR_MODELS[item["method"]].model_validate(dict(
            lesson_id=content_id(lesson["slug"]), language="english", points="1.00", schema_version=1,
            competency_ids=[content_id(lesson["slug"] + "/competency")], grading_version="ungraded-v1", **item))
