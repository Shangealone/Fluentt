export type Health = { status: "ok"; service: "fluentt-api" };
export async function checkHealth(): Promise<Health> {
  const base = process.env.NEXT_PUBLIC_API_URL;
  if (!base)
    throw new Error("Set NEXT_PUBLIC_API_URL to connect to the backend.");
  if (!/^https?:\/\//.test(base))
    throw new Error("The backend URL must use HTTP or HTTPS.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${base.replace(/\/$/, "")}/api/v1/health`, {
      signal: controller.signal,
    });
    if (!response.ok)
      throw new Error(`Backend returned HTTP ${response.status}.`);
    const data: unknown = await response.json();
    if (
      !data ||
      typeof data !== "object" ||
      !("status" in data) ||
      data.status !== "ok" ||
      !("service" in data) ||
      data.service !== "fluentt-api"
    )
      throw new Error("Unexpected backend response.");
    return data as Health;
  } catch (error) {
    if (controller.signal.aborted)
      throw new Error("Connection timed out. Please try again.");
    throw error instanceof Error
      ? error
      : new Error("Unable to connect. Please try again.");
  } finally {
    clearTimeout(timer);
  }
}
