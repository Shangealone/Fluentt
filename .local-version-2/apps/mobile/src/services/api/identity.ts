import { request, ApiError, browserTransport, type AuthContext } from "./client.ts";
export { ApiError } from "./client.ts";
export type Role = "personal_student" | "school_student" | "instructor";
export type Language = "english" | "tagalog";
export const experienceOptions = ["starting_fresh", "some_words", "simple_conversations", "comfortable"] as const;
export type LearningExperience = typeof experienceOptions[number];
export const experienceLabels: Record<LearningExperience, string> = { starting_fresh: "I’m starting from scratch", some_words: "I know a few words", simple_conversations: "I can have simple conversations", comfortable: "I’ve used the language for some time" };
export function startingDifficulty(experience?: LearningExperience | null): "easy" | "medium" | "hard" {
  return experience === "comfortable" ? "hard" : experience === "simple_conversations" ? "medium" : "easy";
}
export type LearningFocus = { topics: string[]; lessons: string[] };
export type PreferenceSettings = { grade?: number; language?: Language; learning_focus?: LearningFocus; experience?: LearningExperience };
export function validLearningFocus(value: unknown): value is LearningFocus {
  if (!value || typeof value !== "object") return false;
  const focus = value as LearningFocus;
  return [focus.topics, focus.lessons].every(list => Array.isArray(list) && list.length <= 10 && new Set(list).size === list.length && list.every(label => typeof label === "string" && label.trim() === label && Array.from(label).length >= 1 && Array.from(label).length <= 120)) && focus.topics.length + focus.lessons.length > 0;
}
export type Profile = {
  id: string;
  username: string;
  canonical_username: string;
  has_password: boolean;
  role: Role;
  profile_status: "onboarding" | "active";
  onboarding_step: string | null;
  grade: number | null;
  language: Language | null;
  learning_focus?: LearningFocus | null;
  experience?: LearningExperience | null;
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
export type BrowserSession = { user: Profile; csrf_token: string };
export type RegistrationClass = { code: string; class_version: string };
function profile(value: Profile): Profile {
  if (
    !value ||
    typeof value.id !== "string" ||
    typeof value.username !== "string" ||
    typeof value.has_password !== "boolean" ||
    !["personal_student", "school_student", "instructor"].includes(
      value.role,
    ) ||
    !["active", "onboarding"].includes(value.profile_status) ||
    !(
      value.grade === null ||
      (Number.isInteger(value.grade) && value.grade >= 1 && value.grade <= 12)
    ) ||
    ![null, "english", "tagalog"].includes(value.language) ||
    (value.learning_focus != null && !validLearningFocus(value.learning_focus)) ||
    (value.experience != null && !experienceOptions.includes(value.experience))
  )
    throw new ApiError(
      0,
      "Unexpected profile response. Please retry session validation.",
    );
  return value;
}
async function browserSession(value: BrowserSession): Promise<BrowserSession> {
  profile(value.user);
  if (!/^[a-f0-9]{64}$/.test(value.csrf_token)) throw new ApiError(0, "Please refresh and try signing in again.");
  return value;
}
export const identity = {
  browserMe: async () => browserSession(await request<BrowserSession>("/browser/sessions/me", "GET", undefined, browserTransport)),
  browserCreate: async (username: string, role: Role, password: string, enrollment?: RegistrationClass) => {
    const issued = await browserSession(await request<BrowserSession>("/browser/users", "POST", {
      username, role, password,
      ...(enrollment ? { class_code: enrollment.code, class_version: enrollment.class_version } : {}),
    }, browserTransport));
    return identity.verifyBrowser(issued);
  },
  browserLogin: async (username: string, password: string) => {
    const issued = await browserSession(await request<BrowserSession>("/browser/sessions/login", "POST", {username, password}, browserTransport));
    return identity.verifyBrowser(issued);
  },
  verifyBrowser: async (issued: BrowserSession) => {
    try {
      const restored = await identity.browserMe();
      if (restored.user.id !== issued.user.id) throw new ApiError(0, "The browser session changed. Please sign in again.");
      return restored;
    } catch (error) {
      if ((error as {status?: number}).status === 401) throw new ApiError(0, "Your browser did not keep the sign-in cookie. Enable cookies for this site, then sign in. If you just created an account, it is saved.");
      throw error;
    }
  },
  exchange: async (legacy: string) => {
    const issued = await browserSession(await request<BrowserSession>("/browser/sessions/exchange", "POST", {}, browserTransport, {Authorization: `Bearer ${legacy}`}));
    return identity.verifyBrowser(issued);
  },
  setPassword: async (auth: AuthContext, password: string) => profile(await request<Profile>("/users/me/password", "POST", {password}, auth)),
  revoke: (credential: AuthContext) => request<void>(typeof credential === "string" ? "/sessions/revoke" : "/browser/sessions/revoke", "POST", undefined, credential),
  check: (username: string) =>
    request<{ username: string; available: boolean; message: string }>(
      `/usernames/check?username=${encodeURIComponent(username)}`,
    ),
  create: async (username: string, role: Role, password: string, enrollment?: RegistrationClass) => {
    const created = await request<Created>("/users", "POST", {
      username,
      role,
      password,
      ...(enrollment ? { class_code: enrollment.code, class_version: enrollment.class_version } : {}),
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
  login: async (username: string, password: string) => {
    const created = await request<Created>("/sessions/login", "POST", {
      username,
      password,
    });
    profile(created.user);
    if (!/^flt_[A-Za-z0-9_-]{43}$/.test(created.session?.credential))
      throw new ApiError(
        0,
        "Unexpected session response. Please contact support before logging in.",
      );
    return created;
  },
  me: async (credential: AuthContext) =>
    profile(
      await request<Profile>("/sessions/me", "GET", undefined, credential),
    ),
  preferences: async (
    credential: AuthContext,
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
