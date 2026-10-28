import { cookies } from "next/headers";
import { backend, webOrigin } from "@/services/admin-server";
import { DEMO_ADMIN_COOKIE } from "@/services/admin-demo";
import { isOversightPage, oversightPath } from "@/services/oversight-contract";
import { boundedText } from "@/services/research-routing";

const headers = { "Cache-Control": "no-store, private", "Vary": "Cookie" };
async function handle(request: Request, context: { params: Promise<{ segments: string[] }> }) {
  const reply = (message: string, status: number) => Response.json({ message }, { status, headers });
  if ((await cookies()).get(DEMO_ADMIN_COOKIE)?.value === "1") return reply("Preview mode has no live school records or account changes.", 503);
  const path = oversightPath((await context.params).segments, request.method, new URL(request.url).searchParams);
  if (!path) return reply("Unsupported administrator request.", 400);
  const init: RequestInit = { method: request.method };
  if (request.method === "POST") {
    if (request.headers.get("origin") !== webOrigin() || request.headers.get("sec-fetch-site") === "cross-site") return reply("Reload the administrator site before changing an account.", 403);
    if (!request.headers.get("content-type")?.startsWith("application/json")) return reply("Use JSON.", 415);
    let body: string;
    try { body = await boundedText(request.body, 2048); JSON.parse(body); } catch { return reply("Invalid or oversized account change.", 400); }
    init.body = body;
    init.headers = { "Content-Type": "application/json", Origin: webOrigin(), "X-CSRF-Token": request.headers.get("x-csrf-token") ?? "",
      "If-Match": request.headers.get("if-match") ?? "", "Idempotency-Key": request.headers.get("idempotency-key") ?? "" };
  }
  try {
    const response = await backend(path, init);
    if (!response.ok) return reply(response.status === 403 ? "This action requires an explicit administrator permission." : response.status === 409 ? "The account changed or is busy. Refresh before starting a different action." : "The request could not be completed. Refresh or retry the original change.",
      [401,403,409,422,428].includes(response.status) ? response.status : 503);
    const body = await boundedText(response.body, 262144);
    if (path === "/oversight/summary.csv") {
      if (!response.headers.get("content-type")?.startsWith("text/csv")) throw new Error();
      return new Response(body, { headers: { ...headers, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="fluentt-school-summary.csv"' } });
    }
    const data: unknown = JSON.parse(body);
    if (request.method === "GET" && !isOversightPage(data)) throw new Error();
    if (request.method === "POST") {
      if (!data || typeof data !== "object") throw new Error();
      const value = data as Record<string, unknown>;
      if (typeof value.id !== "string" || typeof value.username !== "string" || !["school_student", "instructor"].includes(String(value.role))
        || !["active", "disabled"].includes(String(value.status)) || typeof value.revision !== "string" || !/^[a-f0-9]{64}$/.test(value.revision)) throw new Error();
      return Response.json({id:value.id,username:value.username,role:value.role,status:value.status,revision:value.revision}, {headers});
    }
    return Response.json(data, { headers });
  } catch { return reply("Administrator data is unavailable. Please retry.", 503); }
}
export const GET = handle;
export const POST = handle;
