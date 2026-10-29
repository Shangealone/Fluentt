import { startingDifficulty, type Language, type LearningExperience } from "../../services/api/identity";

export type StartingLevel = "easy" | "medium" | "hard";
export type SetupChoiceValue = Language | StartingLevel;

export function levelFromExperience(experience?: LearningExperience | null): StartingLevel | null {
  return experience ? startingDifficulty(experience) : null;
}

export function experienceForLevel(level: StartingLevel, previous?: LearningExperience | null): LearningExperience {
  if (level === "easy") return previous === "some_words" ? "some_words" : "starting_fresh";
  return level === "medium" ? "simple_conversations" : "comfortable";
}

export function languageBackTarget(language: Language | null, experience?: LearningExperience | null): "/student" | "/experience" | null {
  if (!language) return null;
  return experience ? "/student" : "/experience";
}

export const languageChoices = [
  { value: "english", label: "English", detail: "Hello!" },
  { value: "tagalog", label: "Tagalog", detail: "Kumusta!" },
] as const;
export const levelChoices = [
  { value: "easy", label: "Easy", detail: "Start with words and short phrases." },
  { value: "medium", label: "Medium", detail: "Practise everyday sentences." },
  { value: "hard", label: "Challenging", detail: "Try longer sentences and harder activities." },
] as const;
