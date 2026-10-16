import { request, ApiError } from "./client.ts";
import type { Language } from "./identity";
export type ClassDraft = {
  class_name: string;
  grade_level: number;
  language: Language;
  description: string | null;
};
export type ClassDetails = ClassDraft & {
  id: string;
  join_code: string | null;
  status: "active" | "archived";
  created_at: string;
  updated_at: string;
};
export type ClassUpdate = Partial<ClassDraft>;
function validate(value: ClassDetails): ClassDetails {
  if (
    !value ||
    typeof value.id !== "string" ||
    typeof value.class_name !== "string" ||
    !Number.isInteger(value.grade_level) ||
    value.grade_level < 1 ||
    value.grade_level > 12 ||
    !["english", "tagalog"].includes(value.language) ||
    !["active", "archived"].includes(value.status) ||
    !(
      value.join_code === null ||
      (typeof value.join_code === "string" &&
        /^[0-9]{6}$/.test(value.join_code))
    ) ||
    !Number.isFinite(Date.parse(value.created_at)) ||
    !Number.isFinite(Date.parse(value.updated_at))
  )
    throw new ApiError(
      0,
      "Unexpected class response. Refresh My Classes before retrying creation.",
    );
  return value;
}
export const classApi = {
  create: async (credential: string, draft: ClassDraft, requestId: string) =>
    validate(
      await request<ClassDetails>("/classes", "POST", draft, credential, {
        "Idempotency-Key": requestId,
      }),
    ),
  mine: async (credential: string, offset = 0) => {
    const rows = await request<ClassDetails[]>(
      `/classes/mine?limit=50&offset=${offset}`,
      "GET",
      undefined,
      credential,
    );
    if (!Array.isArray(rows))
      throw new ApiError(0, "Unexpected class list response.");
    return rows.map(validate);
  },
  get: async (credential: string, id: string) =>
    validate(
      await request<ClassDetails>(
        `/classes/${encodeURIComponent(id)}`,
        "GET",
        undefined,
        credential,
      ),
    ),
  update: async (credential: string, id: string, draft: ClassUpdate) =>
    validate(
      await request<ClassDetails>(
        `/classes/${encodeURIComponent(id)}`,
        "PATCH",
        draft,
        credential,
      ),
    ),
};
export type ClassAccess = {
  create(draft: ClassDraft, key: string): Promise<ClassDetails>;
  mine(offset?: number): Promise<ClassDetails[]>;
  get(id: string): Promise<ClassDetails>;
  update(id: string, draft: ClassUpdate): Promise<ClassDetails>;
};
