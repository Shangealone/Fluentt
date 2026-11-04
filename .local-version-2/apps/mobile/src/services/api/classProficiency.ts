export const proficiencyLevels = ["beginner", "intermediate", "advanced"] as const;
export type ClassProficiency = typeof proficiencyLevels[number];
const labels: Record<ClassProficiency, string> = { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" };
export function classProficiencyLabel(level: ClassProficiency | null): string {
  return level === null ? "Level not set" : labels[level];
}
export function isClassProficiency(value: unknown): value is ClassProficiency | null {
  return value === null || proficiencyLevels.some(level => level === value);
}
export function isLegacyClassGrade(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 12);
}
