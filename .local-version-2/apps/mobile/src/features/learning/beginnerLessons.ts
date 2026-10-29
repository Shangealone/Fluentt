import type { Language } from "../../services/api/identity";

/** Public starter practice, independent of classroom assignments and private bank keys. */
export type StarterWord = { id: string; kind: "word"; spoken: string; options: { id: string; text: string }[]; target: string };
export type StarterSentence = { id: string; kind: "sentence"; spoken: string; tokens: { id: string; text: string }[]; orderedIds: string[]; distractorIds: string[] };
export type StarterExercise = StarterWord | StarterSentence;
export type StarterKind = StarterExercise["kind"];
function word(id: string, spoken: string, options: string[]): StarterWord {
  return { id, kind: "word", spoken, options: options.map((text, index) => ({ id: `option-${index}`, text })), target: `option-${options.indexOf(spoken)}` };
}
function sentence(id: string, words: string[], presentation: number[], extras: string[] = []): StarterSentence {
  const cards = [...words, ...extras];
  const order = [...presentation];
  // Mix additional authored distractors into stable positions, never reshuffle during a retry.
  cards.forEach((_, index) => { if (!order.includes(index)) order.splice((index * 2 + 1) % (order.length + 1), 0, index); });
  return { id, kind: "sentence", spoken: words.join(" "), tokens: order.map(index => ({ id: `word-${index}`, text: cards[index] })), orderedIds: words.map((_, index) => `word-${index}`), distractorIds: extras.map((_, index) => `word-${words.length + index}`) };
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
    sentence("en-want-water", ["I", "want", "water"], [3, 2, 0, 1], ["like", "milk", "chair"]),
    sentence("en-need-food", ["You", "need", "food"], [2, 3, 1, 0], ["want", "water", "window"]),
    sentence("en-like-music", ["We", "like", "music"], [1, 3, 2, 0], ["read", "coffee", "garden"]),
    sentence("en-drinks-milk", ["She", "drinks", "milk"], [2, 0, 3, 1], ["eats", "juice", "pencil"]),
    sentence("en-eats-bread", ["He", "eats", "bread"], [3, 1, 0, 2], ["drinks", "rice", "cloud"]),
    sentence("en-play-outside", ["They", "play", "outside"], [2, 1, 3, 0], ["sleep", "inside", "spoon"]),
    sentence("en-bring-bag", ["Please", "bring", "my", "bag"], [2, 4, 0, 3, 1], ["take", "your", "flower"]),
    sentence("en-mother-cooks", ["My", "mother", "cooks", "rice"], [3, 1, 4, 0, 2], ["father", "eats", "bicycle"]),
    sentence("en-read-together", ["We", "can", "read", "together"], [2, 0, 4, 3, 1], ["will", "write", "potato"]),
    sentence("en-learn-today", ["I", "want", "to", "learn", "today"], [3, 5, 1, 4, 0, 2], ["need", "sleep", "banana"]),
    sentence("en-hunting", ["I", "will", "go", "hunting"], [3, 1, 4, 0, 2], ["swimming", "window", "apple"]),
    sentence("en-like-book", ["I", "like", "this", "book"], [2, 4, 1, 3, 0], ["that", "chair", "green"]),
    sentence("en-cold-drink", ["I", "want", "some", "cold", "water"], [4, 2, 5, 0, 3, 1], ["hot", "milk", "pencil"]),
    sentence("en-school", ["We", "walk", "to", "school", "together"], [2, 4, 1, 5, 0, 3], ["home", "fly", "spoon"]),
    sentence("en-read", ["She", "reads", "a", "book", "daily"], [3, 5, 1, 4, 0, 2], ["writes", "banana", "outside"]),
    sentence("en-open-door", ["Please", "open", "the", "door", "slowly"], [4, 2, 0, 5, 3, 1], ["close", "window", "coffee"]),
    sentence("en-park", ["We", "will", "visit", "the", "park", "tomorrow"], [4, 1, 6, 3, 0, 5, 2], ["yesterday", "school", "carrot"]),
    sentence("en-sister", ["My", "sister", "likes", "to", "eat", "apples"], [5, 2, 6, 1, 4, 0, 3], ["drink", "brother", "table"]),
    sentence("en-table", ["The", "book", "is", "on", "the", "table"], [4, 1, 6, 5, 2, 0, 3], ["under", "chair", "orange"]),
    sentence("en-breakfast", ["I", "will", "make", "some", "breakfast", "for", "you"], [5, 2, 7, 4, 0, 6, 1, 3], ["dinner", "buy", "cloud"]),
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
    sentence("tl-want-water", ["Gusto", "ko", "ng", "tubig"], [3, 1, 4, 0, 2], ["Ayaw", "gatas", "upuan"]),
    sentence("tl-need-food", ["Kailangan", "mo", "ng", "pagkain"], [2, 4, 0, 3, 1], ["Gusto", "tubig", "bintana"]),
    sentence("tl-like-music", ["Mahilig", "kami", "sa", "musika"], [3, 4, 1, 0, 2], ["aklat", "kape", "halaman"]),
    sentence("tl-drinks-milk", ["Umiinom", "siya", "ng", "gatas"], [2, 0, 4, 3, 1], ["Kumakain", "kape", "lapis"]),
    sentence("tl-eats-bread", ["Kumakain", "siya", "ng", "tinapay"], [3, 4, 1, 0, 2], ["Umiinom", "kanin", "ulap"]),
    sentence("tl-play-outside", ["Naglalaro", "sila", "sa", "labas"], [2, 1, 4, 3, 0], ["Natutulog", "loob", "kutsara"]),
    sentence("tl-bring-bag", ["Pakidala", "ang", "aking", "bag"], [2, 4, 0, 3, 1], ["Pakikuha", "iyong", "bulaklak"]),
    sentence("tl-mother-cooks", ["Nagluluto", "ng", "kanin", "ang", "nanay"], [3, 1, 5, 4, 0, 2], ["tatay", "Kumakain", "bisikleta"]),
    sentence("tl-read-together", ["Puwede", "tayong", "magbasa", "nang", "sabay"], [2, 0, 5, 4, 1, 3], ["magsulat", "bukas", "patatas"]),
    sentence("tl-learn-today", ["Gusto", "kong", "matuto", "ngayong", "araw"], [3, 5, 1, 4, 0, 2], ["matulog", "bukas", "saging"]),
    sentence("tl-hunting", ["Ako", "ay", "mangangaso", "bukas"], [3, 1, 4, 0, 2], ["mamamasyal", "gatas", "mesa"]),
    sentence("tl-like-book", ["Gusto", "ko", "ang", "aklat"], [2, 4, 1, 3, 0], ["lapis", "bahay", "malamig"]),
    sentence("tl-cold-drink", ["Gusto", "ko", "ng", "malamig", "na", "tubig"], [5, 2, 6, 0, 4, 1, 3], ["mainit", "gatas", "lapis"]),
    sentence("tl-school", ["Sabay", "kaming", "naglalakad", "papunta", "sa", "paaralan"], [2, 4, 1, 6, 0, 5, 3], ["palengke", "lumilipad", "kutsara"]),
    sentence("tl-read", ["Nagbabasa", "siya", "ng", "aklat", "tuwing", "umaga"], [3, 6, 1, 4, 0, 5, 2], ["gabi", "sumusulat", "saging"]),
    sentence("tl-open-door", ["Dahan-dahan", "mong", "buksan", "ang", "pinto"], [4, 2, 0, 5, 3, 1], ["isara", "bintana", "kape"]),
    sentence("tl-park", ["Pupunta", "kami", "sa", "parke", "bukas"], [3, 1, 5, 0, 4, 2], ["ngayon", "paaralan", "karot"]),
    sentence("tl-sister", ["Gustong", "kumain", "ng", "mansanas", "ang", "kapatid", "ko"], [5, 2, 7, 1, 4, 0, 6, 3], ["uminom", "nanay", "mesa"]),
    sentence("tl-table", ["Ang", "aklat", "ay", "nasa", "ibabaw", "ng", "mesa"], [4, 1, 7, 5, 2, 0, 6, 3], ["ilalim", "puno", "gatas"]),
    sentence("tl-breakfast", ["Maghahanda", "ako", "ng", "almusal", "para", "sa", "iyo"], [5, 2, 7, 4, 0, 6, 1, 3], ["hapunan", "bibili", "ulap"]),
  ],
};
export function exercisesFor(language: Language, kind: StarterKind): StarterExercise[] {
  return starterLessons[language].filter(item => item.kind === kind);
}
/** Each next sentence follows a correct answer; difficulty is local to this visit. */
export function sentenceChallenge(item: StarterExercise, solved: number): StarterExercise {
  if (item.kind !== "sentence") return item;
  const limit = solved < 3 ? 0 : solved < 7 ? 1 : solved < 12 ? 2 : 3;
  const distractorIds = item.distractorIds.slice(0, limit);
  const visible = new Set([...item.orderedIds, ...distractorIds]);
  return { ...item, distractorIds, tokens: item.tokens.filter(token => visible.has(token.id)) };
}
export function starterReady(item: StarterExercise, answer: string[]): boolean {
  if (item.kind === "word") return answer.length === 1 && item.options.some(option => option.id === answer[0]);
  return answer.length === item.orderedIds.length && new Set(answer).size === answer.length && answer.every(id => item.tokens.some(token => token.id === id));
}
export function starterMatches(item: StarterExercise, answer: string[]): boolean {
  if (!starterReady(item, answer)) return false;
  return item.kind === "word" ? answer[0] === item.target : answer.every((id, index) => id === item.orderedIds[index]);
}
