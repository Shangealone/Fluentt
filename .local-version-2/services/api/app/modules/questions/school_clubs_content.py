"""Original Grade 4 English lessons informed by user-supplied SRC-02 screenshots.

No book passages, images, characters, or audio are copied into this pack.
"""
from uuid import NAMESPACE_URL, uuid5
from app.modules.questions.schemas import AUTHOR_MODELS
from app.modules.questions.pilot_content import choice, sentence, card

PACK = "fluentt-school-clubs-dreams-v1"
SOURCE = "https://www.scribd.com/document/774984093/Come-On-Everyone-4-Student-book"


def content_id(key):
    return uuid5(NAMESPACE_URL, f"fluentt://content/{PACK}/{key}")


LESSONS = [
    dict(slug="clubs-and-preferences", title="Finding a Club You Enjoy", grade=4, topic="School clubs",
         introduction="Clubs are groups where people learn or enjoy an activity together. You can share a favorite and ask someone else what they enjoy.",
         reading="A school club is a group of people who meet to do something together. A music club might sing or play instruments. A robotics club might design and build small machines. An art club can draw, paint, or make things. Different clubs welcome different interests.\n\nTo ask about a preference, say, ‘Which club is your favorite?’ You can answer, ‘My favorite is the art club.’ To talk about one other person, say, ‘Nora likes the music club.’ The verb likes has an s after he, she, or one person’s name.\n\nTry it: Name a club you would enjoy. Tell a partner one activity you could do there. There are many good answers because people enjoy different things.",
         competency="Name familiar clubs and express a personal or another person's preference.", items=[
             choice("Which club could you join to paint pictures?", ["An art club", "A swimming pool", "A bus stop"], 0, "An art club is a group for making art.", "easy"),
             choice("Complete the sentence: My friend ___ the music club.", ["like", "likes", "liking"], 1, "Use likes with one person, such as my friend.", "easy"),
             choice("Which question asks about a favorite club?", ["Which club is your favorite?", "What time is lunch?", "Where is your pencil?"], 0, "The first question asks which club someone prefers.", "easy"),
             sentence(["My", "favorite", "club", "is", "art."] , "easy"),
             sentence(["Lina", "likes", "the", "music", "club."] , "easy"),
             card("club", "A group that meets to share an activity: Our reading club meets after school.", "easy"),
             card("favorite", "The one you like most: My favorite club is the art club.", "easy"),
             card("likes", "Use likes with he, she, or one person: Omar likes music.", "easy")]),
    dict(slug="club-activities", title="What Do You Like to Do?", grade=4, topic="Activities and interests",
         introduction="Ask and answer questions about activities. Use do with you and they, and does with he and she.",
         reading="People enjoy different activities. A learner might play a guitar, make paper shapes, act in a play, or build a small robot. Use like to followed by an action: ‘I like to draw.’ With one other person, use likes to: ‘Rina likes to dance.’\n\nAsk, ‘Do you like to draw?’ Answer, ‘Yes, I do,’ or ‘No, I don’t.’ When asking about one person, say, ‘Does Rina like to dance?’ Answer, ‘Yes, she does,’ or ‘No, she doesn’t.’ After does or doesn’t, use like without an s.\n\nTry it: Ask someone about two activities. Listen to their answers and tell another person one thing they enjoy. You do not have to like the same activities to be friendly.",
         competency="Ask and answer about interests using do/does and like/likes accurately.", items=[
             choice("Complete the question: ___ you like to draw?", ["Do", "Does", "Is"], 0, "Use do with you.", "easy"),
             choice("Complete the question: Does Kai ___ to dance?", ["likes", "like", "liked"], 1, "After does, use the base form like.", "easy"),
             choice("Choose the short answer: Does she like to sing?", ["Yes, she does.", "Yes, she do.", "Yes, she likes to does."], 0, "Use does in a short answer to a does question.", "easy"),
             sentence(["They", "like", "to", "build", "robots."] , "easy"),
             sentence(["Does", "she", "like", "to", "dance?"] , "easy"),
             card("do you like", "A way to ask someone about an interest: Do you like to sing?", "easy"),
             card("does she like", "A way to ask about one person: Does she like to draw?", "easy"),
             card("doesn't like", "Use the base form after doesn't: He doesn't like to swim.", "easy")]),
    dict(slug="club-invitations", title="Reading a Club Invitation", grade=4, topic="Reading about clubs",
         introduction="An invitation tells readers what an activity is, where it happens, and when to arrive.",
         reading="Read this original invitation:\n\n‘Come to the Garden Club! We meet on Tuesday at three o’clock beside the school garden. We plant seeds, water vegetables, and learn how plants grow. Bring a small water bottle. Everyone is welcome.’\n\nA useful invitation answers questions such as: What is the group? When does it meet? Where does it meet? What will people do? Read the whole notice first, then look back for the detail you need.\n\nFor example, the day is Tuesday and the place is beside the school garden. The notice does not tell us the club leader’s name, so we should not guess it.\n\nTry it: Make a short invitation for a club you invent. Include its name, day, place, and one activity.",
         competency="Find explicit time, place and activity details in a short original invitation.", items=[
             choice("In the Garden Club invitation, which day does the group meet?", ["Tuesday", "Friday", "Sunday"], 0, "The invitation says Tuesday.", "easy"),
             choice("Where does the Garden Club meet?", ["Beside the school garden", "At the bus station", "Inside a bakery"], 0, "The place is beside the school garden.", "easy"),
             choice("Which detail is not given in the invitation?", ["The club leader's name", "The day", "The activity"], 0, "The invitation does not name a leader.", "easy"),
             sentence(["We", "plant", "seeds", "together."] , "easy"),
             sentence(["The", "club", "meets", "on", "Tuesday."] , "easy"),
             card("invitation", "A message asking someone to come to an activity or event.", "easy"),
             card("meet", "Come together at a place or time: We meet on Tuesday.", "easy"),
             card("detail", "A piece of information, such as the place or time of an event.", "easy")]),
    dict(slug="jobs-and-articles", title="Exploring Different Jobs", grade=4, topic="Jobs and interests",
         introduction="People do many kinds of work. Use a or an before a singular job name when explaining what someone wants to be.",
         reading="A reporter asks questions and shares information. A designer plans how something will look or work. A cartoonist creates drawings that tell ideas or stories. A scientist studies questions about the world. People can have many different interests, and anyone can explore a job that interests them.\n\nUse a before a word that starts with a consonant sound: ‘a reporter’ and ‘a designer.’ Use an before a vowel sound: ‘an artist’ and ‘an astronaut.’ The sound at the beginning of the next word matters.\n\nYou can say, ‘I want to be an artist,’ or ‘She wants to be a reporter.’ These are ways to talk about a hope; it is fine for hopes to change.\n\nTry it: Choose a job that interests you. Say one thing a person in that job might do.",
         competency="Name jobs and use a/an and want/wants in simple statements of interest.", items=[
             choice("Choose the phrase that completes the sentence: I want to be ___ artist.", ["a", "an", "two"], 1, "Artist begins with a vowel sound, so use an.", "easy"),
             choice("Who might ask people questions and share a news story?", ["A reporter", "A table", "A paintbrush"], 0, "A reporter gathers and shares information.", "easy"),
             choice("Complete the sentence: She ___ to be a scientist.", ["want", "wants", "wanting"], 1, "Use wants with she.", "easy"),
             sentence(["I", "want", "to", "be", "an", "artist."] , "easy"),
             sentence(["He", "wants", "to", "be", "a", "reporter."] , "easy"),
             card("reporter", "A person who gathers and shares information or news.", "easy"),
             card("designer", "A person who plans how something may look or work.", "easy"),
             card("an artist", "Use an before artist because artist begins with a vowel sound.", "easy")]),
    dict(slug="future-plans", title="Talking About Future Plans", grade=4, topic="Hopes and plans",
         introduction="Use want to and wants to to describe activities you hope to do. A plan can grow and change as you learn.",
         reading="You can talk about an activity you hope to do: ‘I want to draw a comic,’ or ‘We want to help animals.’ Use want to with I, you, we, and they. Use wants to with he, she, or one person’s name: ‘Ari wants to explore the sea.’\n\nAsk, ‘What do you want to do?’ A possible answer is, ‘I want to make a short film.’ To ask about one other person, say, ‘What does she want to do?’ After does, use want without an s. Answer, ‘She wants to make a short film.’\n\nTry it: Think of something you would like to learn or do. Finish the sentence, ‘I want to…’ Then ask someone else about their idea. There is no single correct dream.",
         competency="Ask and answer questions about hoped-for activities using want/wants and do/does.", items=[
             choice("Complete the sentence: They ___ to make a garden.", ["want", "wants", "wanting"], 0, "Use want with they.", "easy"),
             choice("Complete the question: What does he ___ to do?", ["wants", "want", "wanted"], 1, "After does, use the base form want.", "easy"),
             choice("Complete the answer: She ___ to paint a mural.", ["want", "wants", "wanting"], 1, "Use wants with she.", "easy"),
             sentence(["We", "want", "to", "learn", "together."] , "easy"),
             sentence(["What", "does", "he", "want", "to", "do?"] , "easy"),
             card("I want to", "Use this to say what you hope to do: I want to learn to swim.", "easy"),
             card("she wants to", "Use wants to for one person: She wants to make music.", "easy"),
             card("does she want", "After does, the verb is want: What does she want to do?", "easy")]),
    dict(slug="reading-future-ideas", title="A Story About Future Ideas", grade=4, topic="Reading about interests",
         introduction="Read a short original story about two learners and find the ideas stated in the text.",
         reading="Read this original story:\n\nDuring library time, Bea finds a book about sea animals. ‘I want to learn how we can protect the ocean,’ she tells her friend Eli. Bea enjoys observing fish and drawing pictures of them.\n\nEli has a different idea. He likes making small machines from reused boxes. ‘I want to build a helpful robot,’ he says. Together, they decide to make a display for their class: Bea will draw sea animals, and Eli will build a model boat.\n\nWhat does Bea want to learn about? The story tells us she wants to learn about protecting the ocean. What does Eli want to build? The story says a helpful robot. Their interests are different, but they can still work together.\n\nTry it: Imagine one more idea for their class display. Explain why it fits the story. Your idea can be different from a classmate’s idea.",
         competency="Find stated details and distinguish a stated answer from a learner's own idea.", items=[
             choice("What does Bea want to learn about?", ["Protecting the ocean", "Baking bread", "Climbing a mountain"], 0, "The story says Bea wants to learn how to protect the ocean.", "easy"),
             choice("What does Eli want to build?", ["A helpful robot", "A tree house", "A bicycle"], 0, "Eli says he wants to build a helpful robot.", "easy"),
             choice("What will Eli make for the class display?", ["A model boat", "A paper crown", "A flower cake"], 0, "The story says Eli will build a model boat.", "easy"),
             sentence(["Bea", "likes", "to", "draw", "fish."] , "easy"),
             sentence(["Eli", "wants", "to", "build", "a", "robot."] , "easy"),
             card("observe", "Look at something carefully to notice details.", "easy"),
             card("protect", "Help keep someone or something safe.", "easy"),
             card("model", "A representation of something: Eli makes a model boat.", "easy")]),
]


def definitions(lesson):
    for item in lesson["items"]:
        yield AUTHOR_MODELS[item["method"]].model_validate(dict(
            lesson_id=content_id(lesson["slug"]), language="english", points="1.00", schema_version=1,
            competency_ids=[content_id(lesson["slug"] + "/competency")], grading_version="ungraded-v1", **item))
