/** Use the authored level descriptor; a school's grade is not personal difficulty. */
export function conversationLevel(value: string): string {
  const descriptor = /^grade\s+\d+\s*\(([^)]+)\)\s*$/i.exec(value)?.[1];
  const label = descriptor ?? value;
  if (/grade\s*\d/i.test(label)) return "All levels";
  return ({ Panimula: "Beginner", Panggitna: "Intermediate", Conversational: "Conversational" } as Record<string, string>)[label] ?? label;
}
