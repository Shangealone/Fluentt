import type { Profile } from "../services/api/identity";
export function destination(
  profile: Profile,
):
  | "/grade"
  | "/language"
  | "/student"
  | "/class-code"
  | "/first-class"
  | "/instructor" {
  if (profile.role === "personal_student") {
    if (!profile.grade) return "/grade";
    if (!profile.language) return "/language";
    return "/student";
  }
  if (profile.role === "school_student")
    return profile.profile_status === "active" ? "/student" : "/class-code";
  return profile.profile_status === "active" ? "/instructor" : "/first-class";
}
export function usernameError(value: string): string | null {
  if (!/^[A-Za-z0-9_]{3,24}$/.test(value))
    return "Use 3–24 letters, numbers or underscores, without spaces.";
  if (
    ["admin", "administrator", "system", "support"].includes(
      value.toLowerCase(),
    )
  )
    return "Please choose a different username.";
  return null;
}
export const validClassCode = (value: string) => /^[0-9]{6}$/.test(value);
