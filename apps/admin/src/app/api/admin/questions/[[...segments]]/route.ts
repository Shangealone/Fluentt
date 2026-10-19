import { NextRequest } from "next/server";
import { adminCookieNames, backend, webOrigin } from "@/services/admin-server";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function handle(request: NextRequest, context: { params: Promise<{ segments?: string[] }> }) {
  const { segments = [] } = await context.params;
  const [item, revisions, revision, action] = segments;
  const collection = !segments.length;
  const detail = segments.length === 1 && uuid.test(item);
  const history = segments.length === 2 && uuid.test(item) && revisions === "revisions";
  const version = segments.length === 3 && uuid.test(item) && revisions === "revisions" && uuid.test(revision);
  const key = segments.length === 4 && uuid.test(item) && revisions === "revisions" && uuid.test(revision) && action === "key";
  const publish = segments.length === 4 && uuid.test(item) && revisions === "revisions" && uuid.test(revision) && action === "publish";
  const retire = segments.length === 2 && uuid.test(item) && revisions === "retire";
  const headers = new Headers({ "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });
  const fail = (status: number, message: string) => Response.json({ error: { message } }, { status, headers });
  if (!(collection || detail || history || version || key || publish || retire)) return fail(404, "Question route is unavailable.");
  if (!(request.method === "GET" ? collection || detail || history || version || key
    : request.method === "POST" ? collection || history || publish || retire : request.method === "PUT" && version))
    return fail(405, "Method unavailable.");

  if (request.cookies.get("fluentt_demo_admin")?.value === "1") {
    const { DEMO_QUESTIONS } = await import("@/services/admin-demo");
    if (request.method === "GET") {
      if (collection) {
        return Response.json({ items: DEMO_QUESTIONS, limit: 50, offset: 0, has_more: false }, { headers });
      }
      if (detail) {
        const found = DEMO_QUESTIONS.find((q) => q.id === item) ?? DEMO_QUESTIONS[0];
        return Response.json(found, { headers });
      }
      if (history) {
        const found = DEMO_QUESTIONS.find((q) => q.id === item) ?? DEMO_QUESTIONS[0];
        return Response.json({ items: [found.latest_revision], limit: 20, offset: 0, has_more: false }, { headers });
      }
      if (key) {
        return Response.json({ key: { correct_option_id: "opt-2" } }, { headers });
      }
      return Response.json(DEMO_QUESTIONS[0], { headers });
    }
    if (["POST", "PUT"].includes(request.method)) {
      return Response.json({
        id: `demo-q-${Date.now()}`,
        status: "draft",
        verification_status: "verified",
      }, { headers });
    }
  }

  try {

    const upstream = new Headers(); let body: string | undefined;
    if (request.method !== "GET") {
      const origin = webOrigin();
      if (request.headers.get("origin") !== origin || request.headers.get("sec-fetch-site") === "cross-site")
        return fail(403, "Reload this page before saving.");
      upstream.set("Origin", origin);
      const csrf = request.headers.get("x-csrf-token"), expected = request.headers.get("if-match");
      if (csrf && /^[A-Za-z0-9_-]{43}$/.test(csrf)) upstream.set("X-CSRF-Token", csrf);
      if (expected && /^(?:[0-9a-f]{64}|"[0-9a-f]{64}")$/.test(expected)) upstream.set("If-Match", expected);
      if (collection || history || request.method === "PUT") {
        if (!request.headers.get("content-type")?.startsWith("application/json")) return fail(415, "Send a JSON form.");
        const reader = request.body?.getReader(), decoder = new TextDecoder(); let bytes = 0; body = "";
        if (reader) while (true) {
          const chunk = await reader.read(); if (chunk.done) break;
          bytes += chunk.value.byteLength;
          if (bytes > 65536) { await reader.cancel(); return fail(413, "Definition exceeds 64 KiB."); }
          body += decoder.decode(chunk.value, { stream: true });
        }
        body += decoder.decode();
        let parsed: unknown;
        try { parsed = JSON.parse(body); } catch { return fail(422, "Send a valid question definition."); }
        if (!parsed || typeof parsed !== "object" || !("method" in parsed)
          || !["multiple_choice", "true_false", "identification", "fill_in_the_blank", "multiple_select", "flashcards", "error_identification", "word_arrangement", "sentence_arrangement", "matching_type"].includes(String(parsed.method))) return fail(422, "This answer method is unavailable in the editor.");
        upstream.set("Content-Type", "application/json");
      }
    }
    const response = await backend(`/questions${segments.length ? "/" + segments.join("/") : ""}${request.nextUrl.search}`,
      { method: request.method, headers: upstream, body });
    if (response.status === 401) {
      const [name] = adminCookieNames();
      headers.append("Set-Cookie", `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
    }
    headers.set("Content-Type", "application/json");
    return new Response(await response.text(), { status: response.status, headers });
  } catch { return fail(503, "Question verification is unavailable. Please retry."); }
}
export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE };
