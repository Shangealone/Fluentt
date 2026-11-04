import { classProficiencyLabel, type ClassProficiency } from "./classProficiency";

export function lessonLevelLabel(context: { grade: number | null; proficiency_level?: ClassProficiency | null }): string {
  if (context.proficiency_level) return classProficiencyLabel(context.proficiency_level);
  return context.grade === null ? "Level not set" : `Grade ${context.grade}`;
}
