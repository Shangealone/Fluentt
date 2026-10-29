export type AdminProfile = {
  username: string;
  role: "administrator";
  permissions: string[];
  csrf_token: string;
  expires_at: string;
  absolute_expires_at: string;
};

export function isAdminProfile(value: unknown): value is AdminProfile {
  if (!value || typeof value !== "object") return false;
  const profile = value as Partial<AdminProfile>;
  return typeof profile.username === "string" && profile.role === "administrator"
    && Array.isArray(profile.permissions) && profile.permissions.every(p => typeof p === "string")
    && profile.permissions.includes("dashboard.view")
    && typeof profile.csrf_token === "string" && /^[A-Za-z0-9_-]{43}$/.test(profile.csrf_token)
    && typeof profile.expires_at === "string" && Number.isFinite(Date.parse(profile.expires_at))
    && typeof profile.absolute_expires_at === "string" && Number.isFinite(Date.parse(profile.absolute_expires_at));
}
