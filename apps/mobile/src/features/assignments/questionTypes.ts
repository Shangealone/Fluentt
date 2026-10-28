import type { AssignmentMethod } from "../../services/api/assignments";

export const questionTypes: Record<AssignmentMethod, { label: string; description: string; icon: string }> = {
  multiple_choice: { label: "Multiple Choice", description: "Choose one answer from a list.", icon: "◉" },
  true_false: { label: "True or False", description: "Decide whether a statement is true.", icon: "✓" },
  identification: { label: "Identification", description: "Type the word or answer.", icon: "Aa" },
  fill_in_the_blank: { label: "Fill in the Blank", description: "Complete the missing parts.", icon: "＿" },
  multiple_select: { label: "Multiple Select", description: "Choose more than one answer.", icon: "☑" },
  flashcards: { label: "Flashcards", description: "Review a cue and recall its answer.", icon: "▣" },
  error_identification: { label: "Error Identification", description: "Find errors in a sentence.", icon: "!" },
  word_arrangement: { label: "Word Arrangement", description: "Put words in the correct order.", icon: "↔" },
  sentence_arrangement: { label: "Sentence Arrangement", description: "Arrange sentences in order.", icon: "≡" },
  matching_type: { label: "Matching Type", description: "Match items in two groups.", icon: "⇄" },
};
