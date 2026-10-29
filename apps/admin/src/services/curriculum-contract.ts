export const kinds = ["versions", "grades", "subjects", "quarters", "topics", "lessons", "competencies"] as const;
export type Kind = typeof kinds[number] | "global-subjects";
export type CurriculumNode = {
  id: string; kind: Kind; parent_id: string | null; version_id: string | null;
  revision: string; frozen: boolean; values: Record<string, string | number | null>;
};
export type CurriculumPage = { items: CurriculumNode[]; has_more: boolean; limit: number; offset: number };
export type Field = { key: string; label: string; type?: "number" | "textarea"; required?: boolean; max?: number };
const title: Field = { key: "name", label: "Name", required: true, max: 200 };
const description: Field = { key: "description", label: "Description", type: "textarea", max: 5000 };
const order: Field = { key: "position", label: "Sibling position", type: "number", required: true, max: 1000000 };
export const fields: Record<Kind, Field[]> = {
  versions: [{ key: "code", label: "Edition code", required: true, max: 80 }, title, description],
  grades: [{ key: "number", label: "Grade (1–12)", type: "number", required: true, max: 12 }],
  subjects: [{ key: "subject_id", label: "Subject definition", required: true }],
  quarters: [{ key: "number", label: "Quarter (1–4)", type: "number", required: true, max: 4 }, title],
  topics: [title, description, order], lessons: [title, description, order],
  competencies: [{ key: "code", label: "Competency code (optional)", max: 100 },
    { ...description, label: "Competency description", required: true }, order],
  "global-subjects": [{ key: "code", label: "Subject code", required: true, max: 50 }, title, description],
};
export const labels: Record<Kind, string> = { versions: "Editions", grades: "Grades", subjects: "Subject links",
  quarters: "Quarters", topics: "Topics", lessons: "Lessons", competencies: "Competencies", "global-subjects": "Subject definitions" };
export function nodeName(node: CurriculumNode) {
  return String(node.values.name ?? node.values.description ?? node.values.code ?? node.id);
}
export function childKind(kind: Kind): Kind | undefined {
  const index = kinds.indexOf(kind as typeof kinds[number]);
  return index >= 0 ? kinds[index + 1] : undefined;
}
export function isNode(value: unknown): value is CurriculumNode {
  if (!value || typeof value !== "object") return false;
  const node = value as CurriculumNode;
  return typeof node.id === "string" && [...kinds, "global-subjects"].includes(node.kind)
    && typeof node.revision === "string" && /^[0-9a-f]{64}$/.test(node.revision)
    && typeof node.frozen === "boolean" && !!node.values && typeof node.values === "object";
}
