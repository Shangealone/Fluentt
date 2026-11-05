import { NextRequest } from "next/server";
import { backend, webOrigin } from "@/services/admin-server";
import { boundedText, uuid } from "@/services/research-routing";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string; action: string }> }) {
  const { id, action } = await context.params;
  const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };
  const fail = (status: number, message: string) => Response.json({ error: { message } }, { status, headers });
  if (!uuid.test(id) || !["configure", "enroll"].includes(action) || new URL(request.url).search) return fail(404, "Test workflow route unavailable.");
  const origin = webOrigin();
  if (request.headers.get("origin") !== origin || request.headers.get("sec-fetch-site") === "cross-site") return fail(403, "Reload this form before continuing.");
  const csrf = request.headers.get("x-csrf-token") ?? "";
  if (!/^[A-Za-z0-9_-]{43}$/.test(csrf)) return fail(403, "A current administrator session is required.");
  if (!request.headers.get("content-type")?.startsWith("application/json")) return fail(415, "Use a JSON form.");
  try {
    const body = await boundedText(request.body, 1048576);
    JSON.parse(body);
    const suffix = action === "configure" ? "test-workflow" : "test-enrollments";
    const result = await backend(`/parallel-studies/${id}/${suffix}`, { method: "POST", body,
      headers: { "Content-Type": "application/json", "Origin": origin, "X-CSRF-Token": csrf } });
    const text = await boundedText(result.body, 4194304);
    JSON.parse(text);
    return new Response(text, { status: result.status, headers: { ...headers, "Content-Type": "application/json" } });
  } catch { return fail(503, "Test setup could not be confirmed. Retain the same details for retry."); }
}
