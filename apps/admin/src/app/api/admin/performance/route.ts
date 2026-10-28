import { cookies } from "next/headers";
import { backend } from "@/services/admin-server";
import { DEMO_ADMIN_COOKIE } from "@/services/admin-demo";
import { isPerformanceReport } from "@/services/performance-contract";

export async function GET(request: Request) {
  const headers = { "Cache-Control": "no-store, private", "Vary": "Cookie" };
  if ((await cookies()).get(DEMO_ADMIN_COOKIE)?.value === "1") {
    return Response.json({ message: "Preview mode has no live learner records." }, { status: 503, headers });
  }
  const query = new URL(request.url).searchParams;
  if ([...query.keys()].some(k => !["days", "q", "offset"].includes(k) || query.getAll(k).length !== 1)) {
    return Response.json({ message: "Invalid monitoring filters." }, { status: 400, headers });
  }
  const days = query.get("days") ?? "30", offset = query.get("offset") ?? "0", q = query.get("q") ?? "";
  if (!["7", "30", "90"].includes(days) || !/^\d{1,6}$/.test(offset) || Number(offset) > 100000 || q.length > 100) {
    return Response.json({ message: "Invalid monitoring filters." }, { status: 400, headers });
  }
  try {
    const response = await backend(`/performance?${new URLSearchParams({ days, offset, q })}`);
    if (!response.ok) return Response.json({ message: response.status === 403 ? "Performance access is required." : "Monitoring is unavailable. Please retry." },
      { status: [401, 403].includes(response.status) ? response.status : 503, headers });
    const text = await response.text();
    if (text.length > 262144) throw new Error("Oversized response");
    const data: unknown = JSON.parse(text);
    if (!isPerformanceReport(data)) throw new Error("Invalid monitoring response");
    return Response.json(data, { headers });
  } catch { return Response.json({ message: "Monitoring is unavailable. Please retry." }, { status: 503, headers }); }
}
