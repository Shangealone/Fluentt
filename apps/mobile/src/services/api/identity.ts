import { request, ApiError } from "./client.ts";
export { ApiError } from "./client.ts";
export type Role = "personal_student" | "school_student" | "instructor";
export type Language = "english" | "tagalog";
export type LearningFocus = { topics: string[]; lessons: string[] };
export type PreferenceSettings = { grade?: number; language?: Language; learning_focus?: LearningFocus };
export function validLearningFocus(value: unknown): value is LearningFocus {
  if (!value || typeof value !== "object") return false;
  const focus = value as LearningFocus;
  return [focus.topics, focus.lessons].every(list => Array.isArray(list) && list.length <= 10 && new Set(list).size === list.length && list.every(label => typeof label === "string" && label.trim() === label && Array.from(label).length >= 1 && Array.from(label).length <= 120)) && focus.topics.length + focus.lessons.length > 0;
}
export type Profile = {
  id: string;
  username: string;
  canonical_username: string;
  role: Role;
  profile_status: "onboarding" | "active";
  onboarding_step: string | null;
  grade: number | null;
  language: Language | null;
  learning_focus?: LearningFocus | null;
};
export type Created = {
  user: Profile;
  session: {
    credential: string;
    token_type: "Bearer";
    expires_at: string;
    absolute_expires_at: string;
  };
};
function profile(value: Profile): Profile {
  if (
    !value ||
    typeof value.id !== "string" ||
    typeof value.username !== "string" ||
    !["personal_student", "school_student", "instructor"].includes(
      value.role,
    ) ||
    !["active", "onboarding"].includes(value.profile_status) ||
    !(
      value.grade === null ||
      (Number.isInteger(value.grade) && value.grade >= 1 && value.grade <= 12)
    ) ||
    ![null, "english", "tagalog"].includes(value.language) ||
    (value.learning_focus != null && !validLearningFocus(value.learning_focus))
  )
    throw new ApiError(
      0,
      "Unexpected profile response. Please retry session validation.",
    );
  return value;
}
export const identity = {
  revoke: (credential: string) => request<void>("/sessions/revoke", "POST", undefined, credential),
  check: (username: string) =>
    request<{ username: string; available: boolean; message: string }>(
      `/usernames/check?username=${encodeURIComponent(username)}`,
    ),
  create: async (username: string, role: Role) => {
    const created = await request<Created>("/users", "POST", {
      username,
      role,
    });
    profile(created.user);
    if (
      created.user.role !== role ||
      !/^flt_[A-Za-z0-9_-]{43}$/.test(created.session?.credential)
    )
      throw new ApiError(
        0,
        "Unexpected session response. Please contact support before creating another profile.",
      );
    return created;
  },
  me: async (credential: string) =>
    profile(
      await request<Profile>("/sessions/me", "GET", undefined, credential),
    ),
  preferences: async (
    credential: string,
    settings: PreferenceSettings,
  ) =>
    profile(
      await request<Profile>(
        "/users/me/preferences",
        "PATCH",
        settings,
        credential,
      ),
    ),
};
