"""Original Grade 3 everyday English lessons inspired by SRC-01 topic notes.

The digital reader exposes no machine-readable page text. All stories,
dialogues, examples and answer keys in this pack are original.
"""
from uuid import NAMESPACE_URL, uuid5
from app.modules.questions.schemas import AUTHOR_MODELS
from app.modules.questions.pilot_content import choice, sentence, card

PACK = "fluentt-everyday-english-v1"
SOURCE = "https://online.flipbuilder.com/xtrvf/udtr/"
EDITION_NAME = "English: Everyday Conversations"
EDITION_DESCRIPTION = "Original Grade 3 lessons for greetings, food, shopping, time, routines and places."
SOURCE_ID = "SRC-01"
SOURCE_BASIS = "SRC-01 registered topic guide; reader text not machine-readable; independently authored examples"
PERMISSION_STATEMENT = "User-supplied source; permission confirmed 2026-10-29"
QUARTER_NAME = "Everyday conversations"


def content_id(key):
    return uuid5(NAMESPACE_URL, f"fluentt://content/{PACK}/{key}")


def lesson(slug, title, topic, intro, reading, competency, questions, sentences, cards):
    items = [choice(prompt, options, answer, why, "easy") for prompt, options, answer, why in questions]
    items += [sentence(words, "easy") for words in sentences]
    items += [card(front, back, "easy") for front, back in cards]
    return dict(slug=slug, title=title, topic=topic, grade=3, source_id=SOURCE_ID, source_url=SOURCE,
                introduction=intro, reading=reading, competency=competency, items=items)


LESSONS = [
 lesson("greetings-and-introductions", "Say Hello and Introduce Yourself", "Greetings and introductions",
        "Practice friendly greetings and simple introductions.",
        "Mara arrives early for the school art fair. She smiles at a classmate. ‘Good morning! I’m Mara. What’s your name?’ she asks. ‘I’m Ben,’ he says. ‘Nice to meet you, Ben.’ ‘Nice to meet you too,’ he replies.\n\nLater, Mara meets a teacher. She says, ‘Good morning, Ms. Lee.’ The teacher answers, ‘Good morning, Mara.’ A greeting can change with the time of day, and a kind smile helps a conversation feel welcoming.\n\nTry it: Say hello, share a name, and ask the other person’s name.",
        "Greet someone and exchange names politely.",
        [("What is the new classmate’s name?", ["Ben", "Mara", "Ms. Lee"], 0, "Mara asks the classmate his name, and he says he is Ben."),
         ("What does Mara say after Ben gives his name?", ["Nice to meet you", "Where is the bus?", "See you yesterday"], 0, "She uses the friendly phrase ‘Nice to meet you.’"),
         ("Which greeting does Mara use early in the day?", ["Good morning", "Good night", "Goodbye"], 0, "The story says she arrives early and says ‘Good morning.’")],
        [["Good", "morning,", "I’m", "Mara."], ["What’s", "your", "name?"]],
        [("greeting", "A friendly word or phrase used when meeting someone."), ("introduce", "Tell someone your name or help people meet."), ("Nice to meet you", "A polite phrase to say when you meet someone for the first time.")]),

 lesson("food-choices", "Talk About Food Choices", "Food and preferences",
        "Ask what someone would like and answer politely.",
        "At a class picnic, Jo brings a basket of fruit. ‘Would you like an apple or a banana?’ Jo asks. ‘I’d like an apple, please,’ says Kim. Jo passes her one. ‘Thank you!’ Kim says.\n\nThen Kim asks, ‘Would you like some water?’ Jo answers, ‘Yes, please.’ They sit with their friends and share the fruit. People may choose different foods, so it is helpful to ask and listen.\n\nTry it: Ask a partner, ‘Would you like ___ or ___?’ Then answer, ‘I’d like ___, please.’",
        "Ask and answer a simple question about a food choice.",
        [("Which fruit does Kim choose?", ["An apple", "A banana", "A mango"], 0, "Kim says, ‘I’d like an apple, please.’"),
         ("What does Jo offer after the fruit?", ["Some water", "A notebook", "A toy car"], 0, "Jo asks whether Kim would like some water."),
         ("Which answer is polite?", ["I’d like a banana, please.", "Give me banana now.", "Banana yesterday."], 0, "The first answer uses a polite request and please.")],
        [["Would", "you", "like", "an", "apple?"], ["I’d", "like", "some", "water,", "please."]],
        [("would you like", "A polite way to ask what someone wants."), ("I’d like", "A short way to say ‘I would like.’"), ("please", "A kind word often used when asking for something.")]),

 lesson("polite-shopping", "Shop with Helpful Words", "Shopping politely",
        "Read a short shop conversation and practice asking for an item.",
        "Nico visits a small school-supply shop with his aunt. ‘Good afternoon. How much is this blue notebook?’ he asks. ‘It is twenty-five pesos,’ says the shopkeeper. ‘May I have one, please?’ Nico asks. ‘Of course. Here you are.’\n\nNico gives the money to the shopkeeper. ‘Thank you,’ he says. ‘You’re welcome,’ she replies. The notebook costs twenty-five pesos. Nico checks that he has the notebook before they leave.\n\nTry it: Pretend to buy a pencil. Ask its price, then say, ‘May I have one, please?’",
        "Ask for an item's price and request it politely.",
        [("What does Nico want to buy?", ["A blue notebook", "A red ball", "A bowl of soup"], 0, "He asks how much the blue notebook costs."),
         ("How much does the notebook cost?", ["Twenty-five pesos", "Twelve pesos", "Five pesos"], 0, "The shopkeeper says it is twenty-five pesos."),
         ("Which phrase asks for the item politely?", ["May I have one, please?", "I had one tomorrow.", "Where is my homework?"], 0, "Nico uses ‘May I have one, please?’")],
        [["How", "much", "is", "this", "pencil?"], ["May", "I", "have", "one,", "please?"]],
        [("shopkeeper", "A person who helps customers in a shop."), ("cost", "The amount of money needed to buy something."), ("Here you are", "A phrase used when giving something to someone.")]),

 lesson("telling-the-time", "Ask and Tell the Time", "Time and plans",
        "Read a simple schedule and practice asking what time an activity begins.",
        "The school garden club meets after class. Its notice says: ‘Planting begins at three o’clock. Please arrive at half past two.’ Lani looks at the clock. It is two o’clock, so she has thirty minutes before she should arrive.\n\nHer friend asks, ‘What time does planting begin?’ Lani answers, ‘It begins at three o’clock.’ They pack their water bottles and walk to the garden together.\n\nTry it: Ask a partner what time a made-up activity begins. Answer with an hour or a half hour.",
        "Find times in a short schedule and say when an activity begins.",
        [("When should club members arrive?", ["Half past two", "Three o’clock", "Half past three"], 0, "The notice asks members to arrive at half past two."),
         ("What time does planting begin?", ["Three o’clock", "Two o’clock", "Half past two"], 0, "The notice says planting begins at three o’clock."),
         ("How long is it from two o’clock until half past two?", ["Thirty minutes", "Two hours", "Ten minutes"], 0, "Half past two is thirty minutes after two o’clock.")],
        [["What", "time", "does", "the", "club", "begin?"], ["It", "begins", "at", "three", "o’clock."]],
        [("schedule", "A list that shows when activities happen."), ("half past two", "Thirty minutes after two o’clock."), ("arrive", "Reach a place.")]),

 lesson("daily-routines", "Talk About a Daily Routine", "Daily routines",
        "Use simple present-tense sentences to describe familiar routines.",
        "Tala gets up at six thirty. She washes, gets dressed, and eats breakfast with her family. Before leaving, she checks that her school bag has a notebook and a pencil.\n\nTala walks to school with her cousin. Their first class begins at seven thirty. After class, Tala returns home, rests, and reads a story. Her routine helps her remember what to do, but another learner may have a different schedule.\n\nTry it: Choose two actions from your day and say when you do them.",
        "Understand the order and times of actions in a daily routine.",
        [("What time does Tala get up?", ["Six thirty", "Seven thirty", "Eight o’clock"], 0, "The first sentence says she gets up at six thirty."),
         ("What does Tala check before leaving?", ["Her school bag", "A cooking pot", "A football"], 0, "She checks that her school bag has supplies."),
         ("What does Tala do after returning home?", ["She rests and reads", "She goes to the moon", "She plants at school"], 0, "The story says she rests and reads a story.")],
        [["Tala", "gets", "up", "at", "six", "thirty."], ["She", "reads", "a", "story", "at", "home."]],
        [("routine", "Actions that someone often does in a usual order."), ("before", "Earlier than a time or action."), ("after", "Later than a time or action.")]),

 lesson("actions-happening-now", "Describe What Is Happening", "Actions and activities",
        "Use is or are with an action ending in -ing to describe a scene.",
        "At the school garden, several learners are working together. Ana is watering a plant. Ben and Rei are carrying a small pot. Their teacher is showing them how to add soil carefully.\n\nA sentence about something happening now can use is or are and an action ending in -ing: ‘Ana is watering.’ ‘They are carrying a pot.’ The action words tell what each person is doing.\n\nTry it: Look around the room and describe one action you can see, if you wish.",
        "Describe actions in progress using is or are with an -ing verb.",
        [("What is Ana doing?", ["Watering a plant", "Reading a map", "Playing a drum"], 0, "The passage says Ana is watering a plant."),
         ("Who is showing the learners how to add soil?", ["Their teacher", "A shopkeeper", "A bus driver"], 0, "Their teacher is showing them."),
         ("Which sentence describes two people?", ["They are carrying a pot.", "They carries a pot.", "They carrying yesterday."], 0, "Use are with they and the action carrying.")],
        [["Ana", "is", "watering", "a", "plant."], ["They", "are", "carrying", "a", "pot."]],
        [("is watering", "Describes one person watering something now."), ("are carrying", "Describes two or more people carrying something now."), ("action", "Something a person or animal does.")]),

 lesson("asking-about-places", "Ask Where a Place Is", "Places and directions",
        "Read simple location clues and practice asking where to go.",
        "Pia wants to return a library book. She asks a helper, ‘Excuse me, where is the library?’ The helper says, ‘Walk straight ahead. The library is next to the park and across from the bakery.’\n\nPia walks straight ahead. She sees the park on one side and the bakery across the road. The library is beside the park, just as the helper said. Pia thanks the helper and returns her book.\n\nTry it: Use next to, across from, or near to describe a place on a map.",
        "Ask for a place and understand basic location words.",
        [("Where is the library?", ["Next to the park", "Inside the bakery", "Behind the moon"], 0, "The helper says it is next to the park."),
         ("What is across from the library?", ["The bakery", "The playground", "Pia's home"], 0, "The bakery is across from the library."),
         ("Which question asks for a location?", ["Where is the library?", "Who ate lunch?", "When did you sleep?"], 0, "Where asks about a place or location.")],
        [["Excuse", "me,", "where", "is", "the", "library?"], ["The", "library", "is", "next", "to", "the", "park."]],
        [("where", "A question word used to ask about a place."), ("next to", "Beside something."), ("across from", "On the other side, facing a place.")]),
]


def definitions(lesson):
    for item in lesson["items"]:
        yield AUTHOR_MODELS[item["method"]].model_validate(dict(
            lesson_id=content_id(lesson["slug"]), language="english", points="1.00", schema_version=1,
            competency_ids=[content_id(lesson["slug"] + "/competency")], grading_version="ungraded-v1", **item))
