import { DEMO_ASSIGNMENT_ITEMS } from "./demoData";
import type { Difficulty, PracticeAccess, PracticeLesson, PracticeQuestion } from "../services/api/practice";
import type { Language } from "../services/api/identity";

// Synthetic preview only. Authored difficulty is explicit and unrelated to school grade.
const lessons: PracticeLesson[] = [
  { id: "demo-personal-easy", title: "Everyday words", topic: "Vocabulary", difficulties: ["easy"] },
  { id: "demo-personal-medium", title: "Building sentences", topic: "Grammar & expression", difficulties: ["medium"] },
  { id: "demo-personal-hard", title: "Reading and meaning", topic: "Language in context", difficulties: ["hard"] },
];
const levels: Difficulty[] = ["easy", "easy", "medium", "hard", "medium", "hard", "easy", "medium", "hard", "easy"];
const english = {
  multiple_choice: { prompt: "Which word is a greeting?", content: { options: [{ id: "a", text: "Hello" }, { id: "b", text: "Tomorrow" }] } },
  true_false: { prompt: "The word ‘hello’ is used as a greeting.", content: {} },
  multiple_select: { prompt: "Select words you can use to greet someone.", content: { options: [{ id: "a", text: "Hello" }, { id: "b", text: "Hi" }, { id: "c", text: "Table" }] } },
  error_identification: { prompt: "Select the part that needs correction.", content: { tokens: [{ id: "a", text: "She" }, { id: "b", text: "go" }, { id: "c", text: "home every afternoon." }] } },
  word_arrangement: { prompt: "Arrange the words into a sentence.", content: { items: [{ id: "a", text: "I" }, { id: "b", text: "am" }, { id: "c", text: "learning." }] } },
  sentence_arrangement: { prompt: "Arrange these events in a sensible order.", content: { items: [{ id: "a", text: "I wake up." }, { id: "b", text: "I have breakfast." }, { id: "c", text: "I leave for work." }] } },
  matching_type: { prompt: "Match each expression to its use.", content: { left: [{ id: "a", text: "Hello" }, { id: "b", text: "Goodbye" }], right: [{ id: "a", text: "Greeting" }, { id: "b", text: "Farewell" }] } },
  identification: { prompt: "Write a word you could use to greet a friend.", content: { input_max_length: 100 } },
  fill_in_the_blank: { prompt: "Good {{time}}! It is time for breakfast.", content: { blank_ids: ["time"], template_syntax: "double-brace-v1" } },
  flashcards: { prompt: "Everyday words: Hello", content: { cue: "Hello" } },
};
export function createDemoPracticeApi(language: Language = "tagalog"): PracticeAccess {
  return {
    async lessons(q = "", difficulty, offset = 0) {
      const matching = lessons.filter(row => (!difficulty || row.difficulties.includes(difficulty)) && `${row.title} ${row.topic}`.toLowerCase().includes(q.trim().toLowerCase()));
      return { items: matching.slice(offset, offset + 20), has_more: matching.length > offset + 20, offset };
    },
    async questions(id, difficulty, offset = 0) {
      const lesson = lessons.find(row => row.id === id);
      if (!lesson) throw new Error("Choose a sample lesson.");
      const items: PracticeQuestion[] = DEMO_ASSIGNMENT_ITEMS.map((item, index) => ({ ...item,
        definition: { ...item.definition, ...(language === "english" ? { ...english[item.definition.method], instructions: null } : {}), lesson_id: id, difficulty: levels[index],
          content: language === "english" ? english[item.definition.method].content : item.definition.method === "true_false" ? {} : item.definition.method === "fill_in_the_blank"
            ? { blank_ids: ["pasalitang_tradisyon"], template_syntax: "double-brace-v1" } : item.definition.content },
      })).filter(item => lesson.difficulties.includes(item.definition.difficulty) && (!difficulty || item.definition.difficulty === difficulty));
      return { items: items.slice(offset, offset + 20), has_more: items.length > offset + 20, offset };
    },
    async reveal(id) {
      const item = DEMO_ASSIGNMENT_ITEMS.find(row => row.id === id && row.definition.method === "flashcards");
      if (!item) throw new Error("This sample flashcard is unavailable.");
      return { revision_id: id, back: language === "english" ? "Hello: a greeting used when meeting someone. Example: Hello, it’s nice to meet you." : "Marikit: maganda o kaakit-akit. Halimbawa: Marikit ang mga bulaklak sa hardin." };
    },
  };
}
