import type { Language } from "../../services/api/identity";

/** Public starter practice, independent of classroom assignments and private bank keys. */
export type StarterWord = { id: string; kind: "word"; spoken: string; options: { id: string; text: string }[]; target: string };
export type StarterSentence = { id: string; kind: "sentence"; spoken: string; tokens: { id: string; text: string }[]; orderedIds: string[] };
export type StarterExercise = StarterWord | StarterSentence;
export type StarterKind = StarterExercise["kind"];
function word(id: string, spoken: string, options: string[]): StarterWord {
  return { id, kind: "word", spoken, options: options.map((text, index) => ({ id: `option-${index}`, text })), target: `option-${options.indexOf(spoken)}` };
}
function sentence(id: string, words: string[], presentation: number[], extras: string[] = []): StarterSentence {
  const cards = [...words, ...extras];
  return { id, kind: "sentence", spoken: words.join(" "), tokens: presentation.map(index => ({ id: `word-${index}`, text: cards[index] })), orderedIds: words.map((_, index) => `word-${index}`) };
}
export const starterLessons: Record<Language, StarterExercise[]> = {
  english: [
    word("en-hello", "hello", ["water", "hello", "book"]),
    word("en-water", "water", ["water", "bread", "house"]),
    word("en-book", "book", ["bread", "house", "book"]),
    word("en-bread", "bread", ["bread", "water", "hello"]),
    word("en-good-morning", "good morning", ["good evening", "good morning", "good night"]),
    word("en-my-book", "my book", ["your book", "my bag", "my book"]),
    word("en-cold-water", "cold water", ["cold water", "hot water", "cold milk"]),
    word("en-i-drink-water", "I drink water", ["I drink milk", "I drink water", "You drink water"]),
    word("en-this-is-mine", "This is mine", ["This is yours", "That is mine", "This is mine"]),
    word("en-please-come-in", "Please come in", ["Please come in", "Please sit down", "Please go out"]),
    sentence("en-drink", ["I", "drink", "water."], [2, 0, 1]),
    sentence("en-book-sentence", ["This", "is", "my", "book."], [2, 3, 0, 1]),
    sentence("en-english", ["I", "am", "learning", "English."], [2, 0, 3, 1]),
    sentence("en-hunting", ["I", "will", "go", "hunting"], [3, 1, 4, 0, 2], ["swimming"]),
    sentence("en-like-book", ["I", "like", "this", "book"], [2, 4, 1, 3, 0], ["that"]),
    sentence("en-cold-drink", ["I", "want", "some", "cold", "water"], [4, 2, 5, 0, 3, 1], ["hot"]),
    sentence("en-school", ["We", "walk", "to", "school", "together"], [2, 4, 1, 5, 0, 3], ["home"]),
    sentence("en-read", ["She", "reads", "a", "book", "daily"], [3, 5, 1, 4, 0, 2], ["writes"]),
    sentence("en-open-door", ["Please", "open", "the", "door", "slowly"], [4, 2, 0, 5, 3, 1], ["close"]),
    sentence("en-park", ["We", "will", "visit", "the", "park", "tomorrow"], [4, 1, 6, 3, 0, 5, 2], ["yesterday"]),
    sentence("en-sister", ["My", "sister", "likes", "to", "eat", "apples"], [5, 2, 6, 1, 4, 0, 3], ["drink"]),
    sentence("en-table", ["The", "book", "is", "on", "the", "table"], [4, 1, 6, 5, 2, 0, 3], ["under"]),
    sentence("en-breakfast", ["I", "will", "make", "some", "breakfast", "for", "you"], [5, 2, 7, 4, 0, 6, 1, 3], ["dinner"]),
  ],
  tagalog: [
    word("tl-kumusta", "kumusta", ["aklat", "kumusta", "tubig"]),
    word("tl-tubig", "tubig", ["tubig", "tinapay", "bahay"]),
    word("tl-aklat", "aklat", ["tinapay", "bahay", "aklat"]),
    word("tl-tinapay", "tinapay", ["tinapay", "tubig", "kumusta"]),
    word("tl-magandang-umaga", "magandang umaga", ["magandang gabi", "magandang umaga", "magandang hapon"]),
    word("tl-aking-aklat", "aking aklat", ["iyong aklat", "aking bag", "aking aklat"]),
    word("tl-malamig-ito", "malamig ito", ["malamig ito", "mainit ito", "malamig iyan"]),
    word("tl-ako-si-ana", "Ako si Ana", ["Ako si Lina", "Ako si Ana", "Ikaw si Ana"]),
    word("tl-gusto-ko-ito", "Gusto ko ito", ["Gusto mo ito", "Gusto ko iyan", "Gusto ko ito"]),
    word("tl-salamat-sa-iyo", "Salamat sa iyo", ["Salamat sa iyo", "Salamat sa inyo", "Paalam sa iyo"]),
    sentence("tl-inom", ["Umiinom", "ako", "ng", "tubig."], [2, 3, 0, 1]),
    sentence("tl-aklat-sentence", ["Ito", "ang", "aking", "aklat."], [2, 3, 0, 1]),
    sentence("tl-tagalog", ["Nag-aaral", "ako", "ng", "Tagalog."], [2, 0, 3, 1]),
    sentence("tl-hunting", ["Ako", "ay", "mangangaso", "bukas"], [3, 1, 4, 0, 2], ["mamamasyal"]),
    sentence("tl-like-book", ["Gusto", "ko", "ang", "aklat"], [2, 4, 1, 3, 0], ["lapis"]),
    sentence("tl-cold-drink", ["Gusto", "ko", "ng", "malamig", "na", "tubig"], [5, 2, 6, 0, 4, 1, 3], ["mainit"]),
    sentence("tl-school", ["Sabay", "kaming", "naglalakad", "papunta", "sa", "paaralan"], [2, 4, 1, 6, 0, 5, 3], ["palengke"]),
    sentence("tl-read", ["Nagbabasa", "siya", "ng", "aklat", "tuwing", "umaga"], [3, 6, 1, 4, 0, 5, 2], ["gabi"]),
    sentence("tl-open-door", ["Dahan-dahan", "mong", "buksan", "ang", "pinto"], [4, 2, 0, 5, 3, 1], ["isara"]),
    sentence("tl-park", ["Pupunta", "kami", "sa", "parke", "bukas"], [3, 1, 5, 0, 4, 2], ["ngayon"]),
    sentence("tl-sister", ["Gustong", "kumain", "ng", "mansanas", "ang", "kapatid", "ko"], [5, 2, 7, 1, 4, 0, 6, 3], ["uminom"]),
    sentence("tl-table", ["Ang", "aklat", "ay", "nasa", "ibabaw", "ng", "mesa"], [4, 1, 7, 5, 2, 0, 6, 3], ["ilalim"]),
    sentence("tl-breakfast", ["Maghahanda", "ako", "ng", "almusal", "para", "sa", "iyo"], [5, 2, 7, 4, 0, 6, 1, 3], ["hapunan"]),
  ],
};
export function exercisesFor(language: Language, kind: StarterKind): StarterExercise[] {
  return starterLessons[language].filter(item => item.kind === kind);
}
export function starterReady(item: StarterExercise, answer: string[]): boolean {
  if (item.kind === "word") return answer.length === 1 && item.options.some(option => option.id === answer[0]);
  return answer.length === item.orderedIds.length && new Set(answer).size === answer.length && answer.every(id => item.tokens.some(token => token.id === id));
}
export function starterMatches(item: StarterExercise, answer: string[]): boolean {
  if (!starterReady(item, answer)) return false;
  return item.kind === "word" ? answer[0] === item.target : answer.every((id, index) => id === item.orderedIds[index]);
}
