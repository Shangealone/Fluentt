// Fixed BFF contract, shared by the route handler and isolated request tests.
export const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function researchRoute(segments: string[], method: string, search: URLSearchParams): string | null {
  const [collection, id, action] = segments;
  if (collection !== "studies" || segments.length > 3) return null;
  const list = segments.length === 1;
  const detail = segments.length === 2 && uuid.test(id);
  const child = segments.length === 3 && uuid.test(id) && ["protocols", "classrooms", "state", "choices", "exports"].includes(action);
  if (method === "GET" ? !(list || detail || (child && action !== "state"))
    : method === "POST" ? !(list || (child && action !== "choices" && action !== "exports")) : true) return null;
  for (const [key, value] of search) {
    if (method !== "GET" || detail) return null;
    if (action === "exports") {
      if (key === "dataset" && ["participants", "assessments", "reviews", "questionnaires"].includes(value)) continue;
      return null;
    }
    if (key === "kind" && action === "choices" && ["classrooms", "conditions", "instruments"].includes(value)) continue;
    if (key === "limit" && /^(?:[1-9]|[1-9][0-9]|100)$/.test(value)) continue;
    if (key === "offset" && /^\d{1,5}$/.test(value) && Number(value) <= 10000) continue;
    return null;
  }
  if (action === "choices" && !["classrooms", "conditions", "instruments"].includes(search.get("kind") ?? "")) return null;
  if (action === "exports" && !["participants", "assessments", "reviews", "questionnaires"].includes(search.get("dataset") ?? "")) return null;
  if ([...search.keys()].some(key => search.getAll(key).length !== 1)) return null;
  return `/research-classrooms/${segments.join("/")}${search.size ? `?${search}` : ""}`;
}

export async function boundedText(body: ReadableStream<Uint8Array> | null, maximum: number): Promise<string> {
  const reader = body?.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0, value = "";
  if (reader) while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    bytes += chunk.value.byteLength;
    if (bytes > maximum) { await reader.cancel(); throw new Error("size_limit"); }
    value += decoder.decode(chunk.value, { stream: true });
  }
  return value + decoder.decode();
}
