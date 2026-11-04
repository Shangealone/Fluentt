"""Original Grade 2 English lessons inspired by user-supplied SRC-05 chapter notes.

The linked reader was unavailable; stories and examples below are original.
"""
from uuid import NAMESPACE_URL, uuid5
from app.modules.questions.schemas import AUTHOR_MODELS
from app.modules.questions.pilot_content import choice, sentence, card

PACK = "fluentt-school-food-homes-v1"
SOURCE = "https://online.anyflip.com/hzfnh/whds/mobile/index.html"


def content_id(key):
    return uuid5(NAMESPACE_URL, f"fluentt://content/{PACK}/{key}")


def lesson(slug, title, topic, intro, reading, competency, questions, sentences, cards):
    items = [choice(prompt, options, correct, explanation, "easy") for prompt, options, correct, explanation in questions]
    items += [sentence(words, "easy") for words in sentences]
    items += [card(cue, back, "easy") for cue, back in cards]
    return dict(slug=slug, title=title, topic=topic, grade=2, source_id="SRC-05", source_url=SOURCE,
                introduction=intro, reading=reading, competency=competency, items=items)


LESSONS = [
 lesson("school-supplies", "Things We Use at School", "School supplies", "Name familiar school supplies and say what they help us do.",
        "A pencil can help us write or draw. A ruler can help us draw a straight line. A notebook can hold our notes and pictures. An eraser can help us remove some pencil marks.\n\nMika packs a pencil and a notebook. Her classmate Jo brings a ruler. They share their supplies when someone needs help.\n\nTry it: Choose one thing you use at school. Say its name and tell someone what you can do with it.",
        "Name common supplies and connect them to a familiar use.",
        [("What can Mika use to write?", ["A pencil", "A pillow", "A spoon"], 0, "A pencil can help Mika write."),
         ("What can help draw a straight line?", ["A ruler", "A shoe", "A cup"], 0, "A ruler can guide a straight line."),
         ("What does Mika pack?", ["A pencil and a notebook", "A kite and a plate", "A ball and a hat"], 0, "The story names a pencil and notebook.")],
        [["I", "have", "a", "pencil."], ["We", "share", "our", "supplies."]],
        [("pencil", "A tool used for writing or drawing."), ("ruler", "A tool that can help draw a straight line."), ("notebook", "Pages held together for notes or pictures.")]),
 lesson("school-places", "Places at School", "School places", "Learn words for places where people read, play and learn.",
        "A classroom is a place to learn together. A library has books and other things to read. A playground is a place where children may play. Schools can look different, and not every school has every place.\n\nAri borrows a book from the library. Later, Ari and a friend play outside. They return to their classroom when the lesson begins.\n\nTry it: Name a place where you learn. What do you do there?",
        "Recognize familiar school places and connect them to activities.",
        [("Where can Ari borrow a book in the story?", ["The library", "A kitchen sink", "A bedroom"], 0, "Ari borrows the book from the library."),
         ("Where do Ari and a friend play?", ["Outside", "Inside the book", "On a cloud"], 0, "The story says they play outside."),
         ("Which place can be used for learning together?", ["A classroom", "A sandwich", "A pencil"], 0, "A classroom is a place where people can learn together.")],
        [["We", "read", "in", "the", "library."], ["Our", "classroom", "is", "a", "place", "to", "learn."]],
        [("classroom", "A place where a class can learn together."), ("library", "A place with books and other reading materials."), ("playground", "A place where children may play.")]),
 lesson("classroom-shapes", "Shapes Around Us", "Shapes at school", "Spot circles, rectangles and triangles in everyday objects.",
        "A circle is round. A triangle has three sides. A rectangle has four straight sides, with opposite sides the same length. A square is a special rectangle with four equal sides.\n\nLook at a clock face: it might be a circle. A book cover can be a rectangle. A triangular flag has three sides. Objects can look different and may contain more than one shape.\n\nTry it: Look around your room. Find one object with a round shape and one with a straight side.",
        "Identify circles, triangles and rectangles in familiar objects.",
        [("Which shape has three sides?", ["Triangle", "Circle", "Line"], 0, "A triangle has three sides."),
         ("Which shape is round?", ["Circle", "Triangle", "Rectangle"], 0, "A circle is round."),
         ("A book cover can look like which shape?", ["A rectangle", "A sound", "A smell"], 0, "A book cover can have a rectangular shape.")],
        [["A", "triangle", "has", "three", "sides."], ["The", "clock", "face", "is", "round."]],
        [("circle", "A round shape."), ("triangle", "A shape with three straight sides."), ("rectangle", "A four-sided shape with four right angles.")]),
 lesson("different-schools", "Learning in Different Places", "School communities", "People can learn in many kinds of places and help one another.",
        "Schools and learning spaces do not all look alike. Some learners study in large buildings. Others learn in smaller rooms, outdoors, or at home with a teacher or trusted adult. People can use books, stories, objects, and conversations to learn.\n\nIn one class, learners plant seeds outside. In another class, learners read about plants indoors. Both groups are learning about plants.\n\nTry it: Describe one place where you learn. Tell someone one way people help each other there.",
        "Recognize that learning spaces can differ and describe a learning activity.",
        [("Where does one group in the story plant seeds?", ["Outside", "Inside a shoe", "Under a bed"], 0, "The story says that group plants seeds outside."),
         ("What do both groups learn about?", ["Plants", "Cars", "Music only"], 0, "Both groups are learning about plants."),
         ("Can people learn in different kinds of places?", ["Yes", "No", "Only in one kind of room"], 0, "People can learn in different settings.")],
        [["We", "can", "learn", "together."], ["Some", "learners", "plant", "seeds."]],
        [("learn", "Find out or practice something new."), ("indoors", "Inside a building or room."), ("outdoors", "Outside a building.")]),
 lesson("counting-food", "Counting Snacks", "Counting and food", "Use number words to describe small groups of food.",
        "We can count objects one at a time. If a plate has one banana and two apples, there are three pieces of fruit on the plate. Touching or pointing to each item once can help you keep your place while counting.\n\nNico puts four crackers on a plate. He adds one more cracker. Now there are five crackers.\n\nTry it: Draw two circles for two pretend snacks. Add one more circle. How many do you see now?",
        "Count small groups and describe quantities with number words.",
        [("Nico has four crackers and adds one. How many crackers now?", ["Five", "Two", "Four"], 0, "Four and one more make five."),
         ("One banana and two apples make how many pieces of fruit?", ["Three", "One", "Four"], 0, "One plus two is three."),
         ("What can help while counting objects?", ["Point to each object once", "Skip every object", "Close the book before looking"], 0, "Pointing once at each object helps keep your place.")],
        [["I", "have", "two", "apples."], ["There", "are", "five", "crackers."]],
        [("one", "The number 1."), ("two", "The number 2."), ("five", "The number 5.")]),
 lesson("describing-treats", "Describe a Treat", "Food words", "Use simple describing words to talk about food.",
        "Describing words tell us more about something. A mango may be yellow and sweet. A cucumber may be green and crunchy. People can have different favorite foods, and foods can look or taste different.\n\nMina chooses a small bowl of fruit. It has red berries and a yellow banana. Mina says, ‘My fruit is colorful.’\n\nTry it: Pick a food you know. Say one color or another word that describes it. You do not need to eat the food to practice the words.",
        "Use a simple descriptive word for a familiar food.",
        [("Which word tells a color?", ["Yellow", "Eat", "Bowl"], 0, "Yellow is a color word."),
         ("What does Mina have?", ["A bowl of fruit", "A paper hat", "A toy bus"], 0, "Mina chooses a bowl of fruit."),
         ("Which word could describe a crunchy cucumber?", ["Crunchy", "Yesterday", "Between"], 0, "Crunchy describes how something feels when bitten.")],
        [["The", "banana", "is", "yellow."], ["My", "fruit", "is", "colorful."]],
        [("sweet", "A word for a taste like the taste of ripe fruit."), ("crunchy", "A word for a crisp texture."), ("colorful", "Having one or more noticeable colors.")]),
 lesson("whose-bowl", "Whose Bowl Is It?", "Ownership words", "Use my, your, and a name with an apostrophe to show who something belongs to.",
        "Words such as my and your help show who something belongs to. If a cup belongs to me, I can say, ‘This is my cup.’ If I speak to you about your cup, I can say, ‘That is your cup.’\n\nA bowl belongs to Lina. We can call it Lina’s bowl. The apostrophe and s after Lina’s name show that the bowl belongs to Lina.\n\nTry it: Point to a thing you may name. Say ‘my’ if it belongs to you. Ask a trusted person before using something that belongs to someone else.",
        "Use simple ownership expressions in clear contexts.",
        [("A bowl belongs to Lina. Which phrase names it?", ["Lina's bowl", "Lina is bowl", "Lina bowl are"], 0, "Lina's shows the bowl belongs to Lina."),
         ("A cup belongs to me. Which phrase can I say?", ["My cup", "Your cup", "Their cup only"], 0, "My refers to the speaker."),
         ("When using someone else's things, what should you do first?", ["Ask permission", "Hide them", "Assume they are yours"], 0, "Ask the person or a trusted adult before using them.")],
        [["This", "is", "my", "cup."], ["The", "bowl", "is", "Lina's."]],
        [("my", "Shows something belongs to the person speaking."), ("your", "Can show something belongs to the person being spoken to."), ("Lina's", "Shows something belongs to Lina.")]),
 lesson("food-steps", "Putting Food Steps in Order", "Simple instructions", "Find first, next and last in an easy sequence.",
        "Instructions tell us what to do. Words such as first, next, and last can make the order clear.\n\nFor a pretend fruit picture, first draw a bowl. Next draw two pieces of fruit inside it. Last color your picture. The steps use drawing; you do not need food or kitchen tools.\n\nTry it: Tell someone the three picture steps in order. Then invent one safe extra detail for your picture.",
        "Identify the order of simple instructions using sequence words.",
        [("What do you draw first?", ["A bowl", "A bus", "A tree house"], 0, "The first step is to draw a bowl."),
         ("What comes after drawing the bowl?", ["Draw fruit inside", "Throw away the paper", "Go to sleep"], 0, "Next, draw two pieces of fruit inside the bowl."),
         ("What is the last listed step?", ["Color the picture", "Draw the bowl", "Choose a school"], 0, "The last listed step is to color the picture.")],
        [["First,", "draw", "a", "bowl."], ["Next,", "draw", "two", "pieces", "of", "fruit."]],
        [("first", "Before the other steps."), ("next", "The step that follows."), ("last", "At the end of the listed steps.")]),
 lesson("rooms-and-objects", "Rooms and Everyday Things", "Home vocabulary", "Name some places and objects people may have at home.",
        "A home may have a place to sleep, a place to prepare food, and a place to spend time together. Some homes have separate rooms for these activities; in other homes, one room has several uses.\n\nIn a story, Tali keeps a blanket near her bed. Her family puts cups on a shelf. Their table is a place to draw and eat together.\n\nTry it: Name an object you use at home or in another safe place. Say what people can do with it.",
        "Name familiar home objects and relate them to an activity.",
        [("What does Tali keep near her bed?", ["A blanket", "A boat", "A tree"], 0, "The story says Tali keeps a blanket near her bed."),
         ("Where does Tali's family put cups?", ["On a shelf", "Inside a cloud", "Under the sea"], 0, "Their cups are on a shelf."),
         ("What can Tali's family do at the table?", ["Draw and eat", "Drive it to school", "Wear it"], 0, "The table is a place to draw and eat.")],
        [["The", "cups", "are", "on", "a", "shelf."], ["We", "draw", "at", "the", "table."]],
        [("blanket", "A covering that can help keep a person warm."), ("shelf", "A flat place where things can be kept."), ("table", "A piece of furniture with a surface for activities.")]),
 lesson("different-homes", "Homes Can Be Different", "Types of homes", "Explore how homes may look different and meet people's needs.",
        "Homes can come in many shapes and sizes. Some people live in an apartment in a building. Some live in a house. Some people move between places, and some share a home with relatives or friends.\n\nWhat makes a place feel welcoming can be different for each person. A safe place to rest and people who care for one another can be important in many homes. Avoid assuming that everyone has the same rooms, family, or belongings.\n\nTry it: Draw an imaginary place where someone could rest. You do not need to share private details about your own home.",
        "Recognize that homes and families vary without assuming one arrangement.",
        [("Can homes look different from one another?", ["Yes", "No", "Only one shape is possible"], 0, "Homes can have many shapes and sizes."),
         ("An apartment can be located where?", ["In a building", "Inside a pencil", "On a word"], 0, "An apartment may be in a building."),
         ("What is a kind thing to remember about homes?", ["People's homes and families can differ", "Every home must look the same", "Everyone must share private details"], 0, "People live in many different ways.")],
        [["Homes", "can", "look", "different."], ["People", "can", "care", "for", "one", "another."]],
        [("home", "A place where someone lives or stays."), ("apartment", "A home that can be part of a building."), ("welcome", "To make someone feel accepted and comfortable.")]),
 lesson("home-story", "A Story About a Cozy Place", "Story details", "Read an original short story and find details stated in it.",
        "Read this original story:\n\nAfter a rainy walk, Sam and Auntie rest in a small room. Sam puts a green cushion beside the window. Auntie brings a book with pictures of birds. They sit together and listen to the rain.\n\nSam says, ‘This is a cozy place to read.’ Auntie smiles and opens the book.\n\nThe story tells us the cushion is green and the book has bird pictures. It does not say what Sam ate for breakfast. When a detail is missing, we should not invent it as the story's answer.\n\nTry it: Imagine a different book Sam could read. Explain that it is your own idea, not a detail from the story.",
        "Find stated details and distinguish them from imagined additions.",
        [("What color is the cushion?", ["Green", "Purple", "Orange"], 0, "The story says the cushion is green."),
         ("What pictures are in the book?", ["Birds", "Boats", "Dinosaurs"], 0, "Auntie brings a book with bird pictures."),
         ("Does the story tell us Sam's breakfast?", ["No", "Yes, rice", "Yes, bread"], 0, "The story does not name a breakfast.")],
        [["Sam", "has", "a", "green", "cushion."], ["They", "read", "a", "book", "together."]],
        [("cozy", "Comfortable and pleasant."), ("cushion", "A soft object you can sit on or lean against."), ("detail", "A piece of information in a story.")]),
 lesson("animal-habitats", "Animal Homes", "Animal habitats", "Explore how animals live in different habitats.",
        "A habitat is the place where an animal lives and finds things it needs. Different animals live in different habitats. A fish may live in water. A bird may build a nest in a tree. A rabbit may rest in a burrow.\n\nAnimals of the same kind can live in different places, and not all birds build the same kind of nest. A habitat includes more than a shelter: animals also need food, water, and space.\n\nTry it: Choose an animal and name a place it can live. What might it need there? Observe animals respectfully and do not disturb their homes.",
        "Name examples of animal habitats and basic needs.",
        [("Where might a fish live?", ["In water", "In a notebook", "Inside a shoe"], 0, "Fish can live in water."),
         ("What might a bird build in a tree?", ["A nest", "A bus", "A pencil"], 0, "Some birds build nests in trees."),
         ("What is one thing animals need in a habitat?", ["Water", "A television", "A school uniform"], 0, "Animals need water along with food and space.")],
        [["A", "fish", "can", "live", "in", "water."], ["Some", "birds", "build", "a", "nest."]],
        [("habitat", "The place where an animal lives and finds things it needs."), ("nest", "A shelter that some birds build."), ("burrow", "A hole or tunnel where some animals rest or live.")]),
]


def definitions(lesson):
    for item in lesson["items"]:
        yield AUTHOR_MODELS[item["method"]].model_validate(dict(
            lesson_id=content_id(lesson["slug"]), language="english", points="1.00", schema_version=1,
            competency_ids=[content_id(lesson["slug"] + "/competency")], grading_version="ungraded-v1", **item))
