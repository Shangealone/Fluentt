import type { ClassPreview, Confirmation, EnrollmentAccess, Membership } from "../../services/api/enrollment";

export class EnrollmentFlow {
  busy = false;
  preview: ClassPreview | null = null;
  pending: Confirmation | null = null;
  confirmed: Membership | null = null;
  private code = "";
  cancel() {
    if (this.busy) return false;
    this.preview = null;
    this.pending = null;
    this.code = "";
    return true;
  }
  async verify(code: string, verify: EnrollmentAccess["preview"]) {
    if (this.busy) throw new Error("Please wait for the current request.");
    if (!/^[0-9]{6}$/.test(code)) throw new Error("Enter exactly six digits (0–9).");
    if (this.pending) throw new Error("Retry joining or check your saved classes first.");
    this.busy = true;
    this.preview = null;
    try {
      const result = await verify(code);
      this.code = code;
      this.preview = result;
      return result;
    } finally { this.busy = false; }
  }
  async join(confirm: EnrollmentAccess["confirm"]) {
    if (this.busy) throw new Error("Please wait for the current request.");
    if (!this.preview) throw new Error("Verify the code and review the class first.");
    this.pending ??= { code: this.code, class_version: this.preview.class_version };
    this.busy = true;
    try {
      const result = await confirm({ ...this.pending });
      this.confirmed = result;
      this.pending = null;
      this.preview = null;
      return result;
    } catch (error) {
      const status = (error as { status?: number }).status;
      if (status && status >= 400 && status < 500 && status !== 429) {
        this.pending = null;
        this.preview = null;
      }
      throw error;
    } finally { this.busy = false; }
  }
}
