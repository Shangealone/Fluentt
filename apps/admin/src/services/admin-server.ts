import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { isAdminProfile } from "./admin-contract";

export function webOrigin(): string {
  const value = process.env.FLUENTT_ADMIN_WEB_ORIGIN ?? "http://localhost:3000";
  const url = new URL(value);
  if (url.origin !== value || url.username || url.password || !["http:", "https:"].includes(url.protocol)
    || (process.env.NODE_ENV === "production" && url.protocol !== "https:")) {
    throw new Error("Configure the administrator website origin correctly.");
  }
  return value;
}

export function adminCookieNames(): string[] {
  const prefix = process.env.NODE_ENV === "production" ? "__Host-" : "";
  return [`${prefix}fluentt_admin`, `${prefix}fluentt_oidc`];
}

export async function backend(path: string, init: RequestInit = {}) {
  // Authentication must wait for a real request, including partial-prefetch renders.
  await connection();
  const jar = await cookies();
  const origin = process.env.FLUENTT_API_URL ?? "http://localhost:8000";
  const url = new URL(origin);
  if (url.origin !== origin || url.username || url.password
      || !["http:", "https:"].includes(url.protocol)
      || (process.env.NODE_ENV === "production" && url.protocol !== "https:")) throw new Error("Invalid API origin");
  const headers = new Headers(init.headers);
  headers.set("Cookie", adminCookieNames().map(name => {
    const value = jar.get(name)?.value;
    return value && /^[A-Za-z0-9_-]{43}$/.test(value) ? `${name}=${value}` : "";
  }).filter(Boolean).join("; "));
  return fetch(`${origin}/api/v1/admin${path}`, {
    ...init, headers, cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(35000),
  });
}

import { DEMO_ADMIN_COOKIE, DEMO_ADMIN_PROFILE } from "./admin-demo";

export async function requireAdmin() {
  const jar = await cookies();
  if (jar.get(DEMO_ADMIN_COOKIE)?.value === "1") {
    return DEMO_ADMIN_PROFILE;
  }
  const response = await backend("/me");
  if (response.status === 401 || response.status === 403) redirect("/login?expired=1");
  if (!response.ok) throw new Error("Account verification is unavailable. Please retry.");
  const profile: unknown = await response.json();
  if (!isAdminProfile(profile)) throw new Error("Account verification is unavailable. Please retry.");
  return profile;
}

