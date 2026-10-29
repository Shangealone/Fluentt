import { researchRoute, boundedText, uuid } from "./research-routing";
import { isAdminProfile } from "./admin-contract";

type RequestWithCookies = Request & { cookies: { get(name: string): { value: string } | undefined } };
type Dependencies = { backend(path: string, init?: RequestInit): Promise<Response>; webOrigin(): string; adminCookieNames(): string[] };

export async function proxyResearchSetup(request: RequestWithCookies, segments: string[], deps: Dependencies) {
  const headers = new Headers({ "Cache-Control": "no-store", "Pragma": "no-cache", "Referrer-Policy": "no-referrer" });
  const fail = (status: number, message: string) => Response.json({ error: { message } }, { status, headers });
  const path = researchRoute(segments, request.method, new URL(request.url).searchParams);
  if (!path) return fail(404, "Research setup route or query is unavailable.");
  if (request.cookies.get("fluentt_demo_admin")?.value === "1") return fail(403, "Demo access cannot read or configure research classrooms. Use an authorized live administrator session.");
  const expire = () => headers.append("Set-Cookie", `${deps.adminCookieNames()[0]}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
  try {
    const upstream = new Headers();
    let body: string | undefined;
    if (request.method === "POST") {
      const origin = deps.webOrigin();
      if (request.headers.get("origin") !== origin || request.headers.get("sec-fetch-site") === "cross-site") return fail(403, "Reload this page before saving.");
      const csrf = request.headers.get("x-csrf-token") ?? "", key = request.headers.get("idempotency-key") ?? "";
      if (!/^[A-Za-z0-9_-]{43}$/.test(csrf)) return fail(403, "A current CSRF token is required.");
      if (!uuid.test(key)) return fail(422, "A UUID request identity is required.");
      upstream.set("Origin", origin); upstream.set("X-CSRF-Token", csrf); upstream.set("Idempotency-Key", key);
      if (segments.length > 1) {
        const revision = request.headers.get("if-match") ?? "";
        if (!/^"[0-9a-f-]{36}:[1-9][0-9]*"$/i.test(revision)) return fail(428, "Refresh the study and provide its exact revision.");
        upstream.set("If-Match", revision);
      }
      if (request.headers.get("content-type")?.split(";")[0] !== "application/json") return fail(415, "Send a JSON form.");
      try { body = await boundedText(request.body, 131072); JSON.parse(body); }
      catch (cause) { return fail(cause instanceof Error && cause.message === "size_limit" ? 413 : 422, "Send valid JSON within the 128 KiB request limit."); }
      upstream.set("Content-Type", "application/json");
    }
    const auth = await deps.backend("/me");
    if (auth.status === 401) { expire(); return fail(401, "Your administrator session ended."); }
    if (!auth.ok) return fail(auth.status === 403 ? 403 : 503, "Administrator access verification is unavailable.");
    const profile: unknown = await auth.json();
    if (!isAdminProfile(profile) || !profile.permissions.includes("research.read") || (request.method === "POST" && !profile.permissions.includes("research.manage"))) return fail(403, "Explicit research read/manage permission is required.");
    if (segments[2] === "exports" && !profile.permissions.includes("research.export")) return fail(403, "Explicit research export permission is required.");
    const result = await deps.backend(path, { method: request.method, headers: upstream, body });
    if (result.status === 401) expire();
    const value = await boundedText(result.body, 2097152);
    JSON.parse(value);
    headers.set("Content-Type", "application/json");
    return new Response(value, { status: result.status, headers });
  } catch { return fail(503, "Research setup is unavailable. A save may have committed; retry the same request identity to reconcile."); }
}
