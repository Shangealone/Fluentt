import type { ClassDetails, ClassDraft } from "../../services/api/classes";
export function classFormError(
  name: string,
  grade: number | null,
  language: string | null,
  description: string,
): string | null {
  if (!name.trim() || name.trim().length > 150)
    return "Enter a class name with 1–150 characters.";
  if (grade === null || !Number.isInteger(grade) || grade < 1 || grade > 12)
    return "Choose Grade 1 through Grade 12.";
  if (!["english", "tagalog"].includes(language ?? ""))
    return "Choose English or Tagalog.";
  if (description.trim().length > 500)
    return "Keep the description within 500 characters.";
  return null;
}
export class ClassSubmission {
  busy = false;
  pending: { draft: ClassDraft; key: string } | null = null;
  async submit(
    draft: ClassDraft,
    issue: (draft: ClassDraft, key: string) => Promise<ClassDetails>,
    makeKey: () => string,
  ): Promise<ClassDetails> {
    if (this.busy) throw new Error("Please wait for the current request.");
    if (
      this.pending &&
      JSON.stringify(draft) !== JSON.stringify(this.pending.draft)
    )
      throw new Error(
        "Retry the original details or refresh My Classes before creating another class.",
      );
    this.pending ??= { draft: { ...draft }, key: makeKey() };
    this.busy = true;
    try {
      const result = await issue(this.pending.draft, this.pending.key);
      this.pending = null;
      return result;
    } catch (error) {
      const status = (error as { status?: number }).status;
      if (status && status >= 400 && status < 500) this.pending = null;
      throw error;
    } finally {
      this.busy = false;
    }
  }
}
export async function copyClassCode(
  code: string,
  write: (value: string) => Promise<boolean>,
): Promise<string> {
  if (!/^[0-9]{6}$/.test(code))
    throw new Error("No active six-digit code is available.");
  if (!(await write(code)))
    throw new Error(
      "Clipboard is unavailable. You can select and copy the code manually.",
    );
  return "Class code copied.";
}
export async function shareClassCode(
  code: string,
  name: string,
  share: (message: string) => Promise<boolean>,
): Promise<string> {
  if (!/^[0-9]{6}$/.test(code))
    throw new Error("No active six-digit code is available.");
  const opened = await share(
    `Join ${name} on FLUENTT. Create your username, then enter class code ${code}. Share only with intended students.`,
  );
  return opened ? "Share sheet opened." : "Sharing cancelled.";
}
