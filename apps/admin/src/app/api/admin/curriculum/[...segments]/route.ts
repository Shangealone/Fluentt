import { NextRequest } from "next/server";
import { adminCookieNames, backend, webOrigin } from "@/services/admin-server";

const kinds = ["versions", "grades", "subjects", "quarters", "topics", "lessons", "competencies"];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function handle(request: NextRequest, context: { params: Promise<{ segments: string[] }> }) {
  const { segments } = await context.params;
  const [kind, id, child] = segments;
  const index = kinds.indexOf(kind);
  const management = kind === "manage";
  const [, entity, node, action] = segments;
  const managementKinds = [...kinds, "global-subjects"];
  const collection = management && segments.length === 2 && managementKinds.includes(entity);
  const detail = management && segments.length === 3 && managementKinds.includes(entity) && uuid.test(node ?? "");
  const transition = management && segments.length === 4 && entity === "versions" && uuid.test(node ?? "")
    && ["publish", "retire"].includes(action);
  const readAllowed = segments.length === 1 ? kind === "versions"
    : index >= 0 && uuid.test(id ?? "") && (segments.length === 2
      || (segments.length === 3 && child === kinds[index + 1]));
  const allowed = management ? collection || detail || transition : readAllowed;
  const headers = new Headers({ "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });
  if (!allowed) return Response.json({ error: { message: "Curriculum route is unavailable." } }, { status: 404, headers });
  const methodAllowed = request.method === "GET" ? !transition
    : request.method === "POST" ? collection || transition
    : ["PATCH", "DELETE"].includes(request.method) && detail;
  if (!methodAllowed || (!management && request.method !== "GET"))
    return Response.json({ error: { message: "Method unavailable." } }, { status: 405, headers });

  if (request.cookies.get("fluentt_demo_admin")?.value === "1") {
    const { DEMO_CURRICULUM_NODES } = await import("@/services/admin-demo");
    if (request.method === "GET") {
      const entity = management ? segments[1] : segments[0];
      const parentId = request.nextUrl.searchParams.get("parent_id");
      let items = DEMO_CURRICULUM_NODES.filter((n) => n.kind === entity);
      if (parentId) items = items.filter((n) => n.parent_id === parentId);
      return Response.json({ items, limit: 50, offset: 0, has_more: false, class_context: null }, { headers });
    }
    if (["POST", "PATCH"].includes(request.method)) {
      return Response.json({
        id: `demo-node-${Date.now()}`,
        code: `demo-code-${Date.now()}`,
        name: "Demo Node (Saved)",
        kind: segments[1] || "lessons",
        status: "draft",
        verification_status: "verified",
        parent_id: null,
        subject_id: null,
      }, { headers });
    }
    if (request.method === "DELETE") {
      return new Response(null, { status: 204, headers });
    }
  }

  try {

    const upstreamHeaders = new Headers();
    let body: string | undefined;
    if (request.method !== "GET") {
      const origin = webOrigin();
      if (request.headers.get("origin") !== origin || request.headers.get("sec-fetch-site") === "cross-site")
        return Response.json({ error: { message: "Reload this page before saving." } }, { status: 403, headers });
      upstreamHeaders.set("Origin", origin);
      const csrf = request.headers.get("x-csrf-token");
      if (csrf && /^[A-Za-z0-9_-]{43}$/.test(csrf)) upstreamHeaders.set("X-CSRF-Token", csrf);
      const revision = request.headers.get("if-match");
      if (revision && /^"?[0-9a-f]{64}"?$/.test(revision)) upstreamHeaders.set("If-Match", revision);
      if ((request.method === "POST" && action !== "retire") || request.method === "PATCH") {
        if (!request.headers.get("content-type")?.startsWith("application/json"))
          return Response.json({ error: { message: "Send a JSON form." } }, { status: 415, headers });
        const reader = request.body?.getReader();
        const decoder = new TextDecoder(); let bytes = 0; body = "";
        if (reader) while (true) {
          const chunk = await reader.read(); if (chunk.done) break;
          bytes += chunk.value.byteLength;
          if (bytes > 32768) { await reader.cancel(); return Response.json({ error: { message: "Form is too large." } }, { status: 413, headers }); }
          body += decoder.decode(chunk.value, { stream: true });
        }
        body += decoder.decode();
        upstreamHeaders.set("Content-Type", "application/json");
      }
    }
    // Fixed entity/method paths only; backend rechecks live permissions and all write protections.
    const response = await backend(`/curriculum/${segments.join("/")}${request.nextUrl.search}`, {
      method: request.method, headers: upstreamHeaders, body,
    });
    if (response.status === 401) {
      const [name] = adminCookieNames(); // Preserve any independent, in-flight OIDC binding.
      headers.append("Set-Cookie",
        `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
    }
    headers.set("Content-Type", "application/json");
    return new Response(await response.text(), { status: response.status, headers });
  } catch {
    return Response.json({ error: { message: "Curriculum verification is unavailable. Please retry." } }, { status: 503, headers });
  }
}

export { handle as GET, handle as POST, handle as PATCH, handle as DELETE };
