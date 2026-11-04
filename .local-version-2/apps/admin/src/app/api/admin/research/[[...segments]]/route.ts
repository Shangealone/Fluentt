import { NextRequest } from "next/server";
import { adminCookieNames, backend, webOrigin } from "@/services/admin-server";
import { proxyResearchSetup } from "@/services/research-proxy";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };

function fail(status: number, message: string) {
  return Response.json({ error: { message } }, { status, headers });
}

export async function GET(request: NextRequest, context: { params: Promise<{ segments?: string[] }> }) {
  const { segments = [] } = await context.params;
  if (segments[0] === "classrooms")
    return proxyResearchSetup(request, segments.slice(1), { backend, webOrigin, adminCookieNames });
  const [root, studyId, action, dataset] = segments;
  if (root !== "studies") return fail(404, "Research endpoint not found.");
  let path: string;
  let csv = false;
  if (segments.length === 1) path = "/research/studies";
  else if (segments.length === 3 && uuid.test(studyId) && action === "analytics")
    path = `/research/studies/${studyId}/analytics`;
  else if (segments.length === 4 && uuid.test(studyId) && action === "exports"
    && ["data-dictionary", "participants.csv", "assessments.csv", "reviews.csv"].includes(dataset)) {
    path = `/research/studies/${studyId}/exports/${dataset}`;
    csv = dataset.endsWith(".csv");
  } else return fail(404, "Research endpoint not found.");
  try {
    const upstream = await backend(path);
    if (!upstream.ok) return fail(upstream.status, "Research data is unavailable.");
    if (csv) {
      const resultHeaders = new Headers(headers);
      resultHeaders.set("Content-Type", "text/csv; charset=utf-8");
      const disposition = upstream.headers.get("content-disposition");
      if (disposition) resultHeaders.set("Content-Disposition", disposition);
      return new Response(await upstream.text(), { status: 200, headers: resultHeaders });
    }
    return new Response(await upstream.text(), {
      status: 200, headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch {
    return fail(503, "Research data is unavailable.");
  }
}

async function mutation(request: NextRequest, context: { params: Promise<{ segments?: string[] }> }) {
  const { segments = [] } = await context.params;
  return proxyResearchSetup(request, segments[0] === "classrooms" ? segments.slice(1) : [],
    { backend, webOrigin, adminCookieNames });
}

export { mutation as POST, mutation as PUT, mutation as PATCH, mutation as DELETE };
