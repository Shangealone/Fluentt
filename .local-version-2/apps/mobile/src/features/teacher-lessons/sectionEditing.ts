import type { LessonSection } from "../../services/api/teacherLessons";

export function sectionIssue(section: LessonSection): string | null {
  if (!section.heading.trim() || !section.body.trim()) return "Add a heading and lesson text, or remove this unfinished section before saving.";
  if (Array.from(section.heading).length > 200) return "Keep the heading to 200 characters or fewer.";
  if (Array.from(section.body).length > 20000) return "Keep the lesson text to 20,000 characters or fewer.";
  return null;
}

export type SectionAction = "add" | "starter" | "duplicate" | "remove" | "up" | "down";
export function updateSections(sections: LessonSection[], active: number | null, action: SectionAction): { sections: LessonSection[]; active: number | null } {
  const unchanged = { sections, active };
  if (action === "add" || action === "starter") {
    const added = action === "starter"
      ? ["Introduction", "Explanation", "Examples", "Practice"].map(heading => ({ heading, body: "" }))
      : [{ heading: "", body: "" }];
    return sections.length + added.length > 50 ? unchanged : { sections: [...sections, ...added], active: sections.length };
  }
  if (active === null || !sections[active]) return unchanged;
  const next = [...sections];
  if (action === "duplicate") {
    if (sections.length >= 50) return unchanged;
    next.splice(active + 1, 0, { ...sections[active] });
    return { sections: next, active: active + 1 };
  }
  if (action === "remove") {
    next.splice(active, 1);
    return { sections: next, active: next.length ? Math.min(active, next.length - 1) : null };
  }
  const destination = active + (action === "up" ? -1 : 1);
  if (destination < 0 || destination >= sections.length) return unchanged;
  [next[active], next[destination]] = [next[destination], next[active]];
  return { sections: next, active: destination };
}
