import { NextRequest } from "next/server";
import { backend, webOrigin } from "@/services/admin-server";
import { boundedText, uuid } from "@/services/research-routing";

async function proxy(request: NextRequest, context: { params: Promise<{ segments: string[] }> }) {
  const { segments } = await context.params;
  const [kind, id, action] = segments;
  const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };
  const fail = (status: number, message: string) => Response.json({ error: { message } }, { status, headers });
  const read = request.method === "GET" && segments.length === 1 && ["packs", "lessons", "protocols", "choices"].includes(kind);
  const write = request.method === "POST" && ((segments.length === 1 && ["packs", "protocols"].includes(kind))
    || (segments.length === 3 && uuid.test(id) && ((kind === "packs" && action === "publish") || (kind === "protocols" && ["state", "allocations"].includes(action)))));
  if ((!read && !write) || new URL(request.url).search) return fail(404, "Vocabulary route is unavailable.");
  if (request.cookies.get("fluentt_demo_admin")?.value === "1") return fail(403, "Use an authorized live administrator account.");
  try {
    const upstream = new Headers();
    let body: string | undefined;
    if (write) {
      const origin = webOrigin();
      if (request.headers.get("origin") !== origin || request.headers.get("sec-fetch-site") === "cross-site") return fail(403, "Reload this form before saving.");
      const key = request.headers.get("idempotency-key") ?? "", csrf = request.headers.get("x-csrf-token") ?? "";
      if (!uuid.test(key) || !/^[A-Za-z0-9_-]{43}$/.test(csrf)) return fail(422, "A current session and retry identity are required.");
      upstream.set("Origin", origin); upstream.set("Idempotency-Key", key); upstream.set("X-CSRF-Token", csrf);
      if (request.headers.has("if-match")) upstream.set("If-Match", request.headers.get("if-match")!);
      if (action !== "publish") {
        if (!request.headers.get("content-type")?.startsWith("application/json")) return fail(415, "Use a JSON form.");
        body = await boundedText(request.body, 1048576); JSON.parse(body); upstream.set("Content-Type", "application/json");
      }
    }
    const result = await backend(`/vocabulary/${segments.join("/")}`, { method: request.method, headers: upstream, body });
    const text = await boundedText(result.body, 4194304); JSON.parse(text);
    return new Response(text, { status: result.status, headers: { ...headers, "Content-Type": "application/json" } });
  } catch { return fail(503, "Vocabulary setup is unavailable. If saving was interrupted, retry the same request."); }
}
export const GET = proxy;
export const POST = proxy;
