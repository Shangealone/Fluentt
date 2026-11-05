import type { Profile } from "../services/api/identity";
export function destination(
  profile: Profile,
):
  | "/set-password"
  | "/learning-focus"
  | "/language"
  | "/experience"
  | "/student"
  | "/class-code"
  | "/first-class"
  | "/instructor" {
  if (profile.has_password === false) return "/set-password";
  if (profile.role === "personal_student") {
    if (!profile.language) return "/language";
    if (!profile.experience) return "/experience";
    return "/student";
  }
  if (profile.role === "school_student")
    return profile.profile_status === "active" ? "/student" : "/class-code";
  return profile.profile_status === "active" ? "/instructor" : "/first-class";
}
export function usernameError(value: string): string | null {
  if (value.length < 3 || value.length > 24 || !/^[A-Za-z0-9_][A-Za-z0-9_ ]*[A-Za-z0-9_]$/.test(value))
    return "Use 3–24 letters, numbers, underscores or spaces between words. No spaces at the beginning or end.";
  if (
    ["admin", "administrator", "system", "support"].includes(
      value.toLowerCase(),
    )
  )
    return "Please choose a different username.";
  return null;
}
export const validClassCode = (value: string) => /^[0-9]{6}$/.test(value);

export function routeAllowed(profile: Profile | null, route: string, pending = false): boolean {
  if (route === "privacy-policy" || route === "terms") return true;
  if (!profile) return ["auth", "username", "login"].includes(route) || (!pending && ["index", "school-role"].includes(route));
  if (route === "set-password") return profile.has_password === false;
  if (profile.has_password === false) return false;
  if (["learning-focus", "grade", "language", "experience"].includes(route)) return profile.role === "personal_student";
  if (route === "question-practice" || route === "personal-stats") return profile.role === "personal_student" && destination(profile) === "/student";
  if (["conversation", "pronunciation"].includes(route)) return profile.role !== "instructor" && destination(profile) === "/student";
  if (route === "research") return profile.role === "school_student" && destination(profile) === "/student";
  if (route === "vocabulary-review") return profile.role === "school_student" && destination(profile) === "/student";
  if (route === "my-classes") return profile.role === "school_student" && destination(profile) === "/student";
  if (route === "class-lessons") return profile.role === "school_student" && destination(profile) === "/student";
  if (route === "instructor-lessons" || route === "instructor-lesson") return profile.role === "instructor";
  if (route === "communication") return profile.role === "instructor" || (profile.role === "school_student" && destination(profile) === "/student");
  if (route === "account" || route === "notifications") return true;
  if (route === "learning-materials") return destination(profile) === "/student" || profile.role === "instructor";
  if (route === "learning-history") return profile.role !== "instructor" && destination(profile) === "/student";
  if (route === "preferences") return profile.role === "personal_student" && destination(profile) === "/student";
  if (["instructor", "first-class", "class-details", "class-edit", "assignments", "class-assessments", "assignment-builder", "assignment-results", "instructor-monitoring"].includes(route)) return profile.role === "instructor";
  if (route === "class-code") return profile.role === "school_student";
  if (route === "published-assignments" || route === "assignment-attempt" || route === "assessment-results") return profile.role === "school_student" && destination(profile) === "/student";
  return route === "student" && destination(profile) === "/student";
}
