import { NextRequest } from "next/server";
import { adminCookieNames, backend, webOrigin } from "@/services/admin-server";
import { DEMO_ADMIN_COOKIE, DEMO_ADMIN_PROFILE } from "@/services/admin-demo";

const paths: Record<string, { method: string; path: string }> = {
  config: { method: "GET", path: "/auth/config" },
  start: { method: "POST", path: "/auth/start" },
  callback: { method: "GET", path: "/auth/callback" },
  me: { method: "GET", path: "/me" },
  session: { method: "DELETE", path: "/session" },
  "demo-login": { method: "POST", path: "/demo-login" },
};

function unavailable(status = 503) {
  return Response.json({ error: { message: "Administrator access is unavailable. Please retry." } },
    { status, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}

async function handle(request: NextRequest, context: { params: Promise<{ action: string }> }) {
  const { action } = await context.params;
  if (action === "demo-login" && request.method === "POST") {
    const origin = webOrigin();
    const forwarded = new Headers({
      "Location": `${origin}/dashboard`,
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    });
    forwarded.append("Set-Cookie", `${DEMO_ADMIN_COOKIE}=1; Path=/; SameSite=Lax; HttpOnly${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
    return new Response(null, { status: 303, headers: forwarded });
  }

  if (action === "me" && request.method === "GET" && request.cookies.get(DEMO_ADMIN_COOKIE)?.value === "1") {
    return Response.json(DEMO_ADMIN_PROFILE, {
      headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
    });
  }

  if (action === "session" && request.method === "DELETE" && request.cookies.get(DEMO_ADMIN_COOKIE)?.value === "1") {
    const forwarded = new Headers({ "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });
    forwarded.append("Set-Cookie", `${DEMO_ADMIN_COOKIE}=; Path=/; SameSite=Lax; Max-Age=0; HttpOnly${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
    return new Response(null, { status: 204, headers: forwarded });
  }

  const target = paths[action];
  if (!target || request.method !== target.method) return unavailable(404);
  try {
    const origin = webOrigin();
    if (request.method !== "GET" && (request.headers.get("origin") !== origin
        || request.headers.get("sec-fetch-site") === "cross-site")) return unavailable(403);

    let path = target.path;
    if (action === "callback") {
      const query = new URLSearchParams();
      for (const key of ["state", "code", "error", "iss"]) {
        const values = request.nextUrl.searchParams.getAll(key);
        if (values.length > 1 || values.some(v => v.length > 4096)) return unavailable(400);
        if (values[0]) query.set(key, values[0]);
      }
      path += `?${query}`;
    }
    const headers = new Headers();
    if (request.method !== "GET") headers.set("Origin", origin);
    const csrf = request.headers.get("x-csrf-token");
    if (csrf && /^[A-Za-z0-9_-]{43}$/.test(csrf)) headers.set("X-CSRF-Token", csrf);
    const upstream = await backend(path, { method: request.method, headers });
    const forwarded = new Headers({ "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });
    for (const cookie of upstream.headers.getSetCookie()) {
      if (adminCookieNames().some(name => cookie.startsWith(`${name}=`))) forwarded.append("Set-Cookie", cookie);
    }
    const location = upstream.headers.get("location");
    if (location) {
      const destination = new URL(location);
      if (action === "callback" && (destination.origin !== origin
          || !["/dashboard", "/login"].includes(destination.pathname))) return unavailable();
      if (action === "start" && destination.protocol !== "https:") return unavailable();
      forwarded.set("Location", destination.toString());
      return new Response(null, { status: 303, headers: forwarded });
    }
    if (upstream.status === 204) return new Response(null, { status: 204, headers: forwarded });
    if (action === "start" || action === "callback") {
      // Full-page forms/callbacks always recover to an accessible login page.
      forwarded.set("Location", `${origin}/login?error=sign_in_failed`);
      return new Response(null, { status: 303, headers: forwarded });
    }
    if (upstream.status === 401) {
      for (const name of adminCookieNames()) forwarded.append("Set-Cookie",
        `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
    }
    forwarded.set("Content-Type", "application/json");
    return new Response(await upstream.text(), { status: upstream.status, headers: forwarded });
  } catch {
    if (action === "start" || action === "callback") {
      return new Response(null, { status: 303, headers: {
        Location: "/login?error=sign_in_failed", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer",
      } });
    }
    return unavailable();
  }
}

export const GET = handle;
export const POST = handle;
export const DELETE = handle;
