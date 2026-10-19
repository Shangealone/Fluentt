import type { Profile } from "../services/api/identity";
export function destination(
  profile: Profile,
):
  | "/learning-focus"
  | "/language"
  | "/student"
  | "/class-code"
  | "/first-class"
  | "/instructor" {
  if (profile.role === "personal_student") {
    if (!profile.learning_focus && !profile.grade) return "/learning-focus";
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

export function routeAllowed(profile: Profile | null, route: string, pending = false, isDemo = false): boolean {
  if (isDemo) return true;
  if (!profile) return route === "username" || (!pending && ["index", "school-role"].includes(route));
  if (["learning-focus", "grade", "language"].includes(route)) return profile.role === "personal_student";
  if (route === "communication") return profile.role === "instructor" || (profile.role === "school_student" && destination(profile) === "/student");
  if (route === "account") return true;
  if (route === "learning-history") return profile.role !== "instructor" && destination(profile) === "/student";
  if (route === "preferences") return profile.role === "personal_student" && destination(profile) === "/student";
  if (["instructor", "first-class", "class-details", "class-edit", "assignments", "assignment-builder", "assignment-results", "instructor-monitoring"].includes(route)) return profile.role === "instructor";
  if (route === "class-code") return profile.role === "school_student";
  if (route === "published-assignments" || route === "assignment-attempt" || route === "assessment-results") return profile.role === "school_student" && destination(profile) === "/student";
  return route === "student" && destination(profile) === "/student";
}
