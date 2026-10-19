import { request, ApiError } from "./client.ts";
import type { Language } from "./identity";

export type StudentClass = {
  class_name: string;
  grade_level: number;
  language: Language;
  instructor_display_name: string | null;
};
export type ClassPreview = StudentClass & { class_version: string };
export type Confirmation = { code: string; class_version: string };
export type Membership = StudentClass & {
  id: string;
  class_id: string;
  joined_at: string;
  status: "active";
};
export type EnrollmentAccess = {
  preview(code: string): Promise<ClassPreview>;
  confirm(body: Confirmation): Promise<Membership>;
  mine(offset?: number): Promise<Membership[]>;
};
function studentClass(value: StudentClass): boolean {
  return !!value && typeof value.class_name === "string" &&
    Number.isInteger(value.grade_level) && value.grade_level >= 1 && value.grade_level <= 12 &&
    ["english", "tagalog"].includes(value.language) &&
    (value.instructor_display_name === null || typeof value.instructor_display_name === "string");
}
function membership(value: Membership): Membership {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!studentClass(value) || !uuid.test(value.id) || !uuid.test(value.class_id) ||
    value.status !== "active" || typeof value.joined_at !== "string" || !Number.isFinite(Date.parse(value.joined_at)))
    throw new ApiError(0, "Unexpected enrollment response. Check saved classes before retrying.");
  return value;
}
export const enrollmentApi = {
  preview: async (credential: string, code: string): Promise<ClassPreview> => {
    const value = await request<ClassPreview>("/class-enrollment-previews", "POST", { code }, credential);
    if (!studentClass(value) || !/^[0-9a-f]{64}$/.test(value.class_version))
      throw new ApiError(0, "Unexpected class preview. Please verify the code again.");
    return value;
  },
  confirm: async (credential: string, body: Confirmation) =>
    membership(await request<Membership>("/class-memberships", "POST", body, credential)),
  mine: async (credential: string, offset = 0) => {
    const rows = await request<Membership[]>(`/class-memberships/mine?limit=50&offset=${offset}`, "GET", undefined, credential);
    if (!Array.isArray(rows)) throw new ApiError(0, "Unexpected class list. Please retry.");
    return rows.map(membership);
  },
};
