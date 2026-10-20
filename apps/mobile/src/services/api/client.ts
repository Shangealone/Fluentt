export type Health = { status: "ok"; service: "fluentt-api" };
export async function checkHealth(): Promise<Health> {
  const base = process.env.EXPO_PUBLIC_API_URL;
  if (!base)
    throw new Error("Set EXPO_PUBLIC_API_URL to connect to the backend.");
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

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
export async function request<T>(
  path: string,
  method = "GET",
  body?: unknown,
  credential?: string,
  extraHeaders: Record<string, string> = {},
): Promise<T> {
  const base = process.env.EXPO_PUBLIC_API_URL;
  if (!base || !/^https?:\/\//.test(base))
    throw new ApiError(0, "Configure the backend address before continuing.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${base.replace(/\/$/, "")}/api/v1${path}`, {
      method,
      signal: controller.signal,
      headers: {
        ...(typeof FormData !== "undefined" && body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
        ...extraHeaders,
        ...(credential ? { Authorization: `Bearer ${credential}` } : {}),
      },
      ...(body === undefined
        ? {}
        : typeof FormData !== "undefined" && body instanceof FormData
        ? { body }
        : { body: JSON.stringify(body) }),
    });
    if (!response.ok) {
      const messages: Record<number, string> = {
        401: "Your device session has expired. Please start again.",
        409: "This change conflicts with the saved class. Refresh and try again.",
        422: "Please check your entries.",
        429: "Too many requests. Please wait a minute.",
        503: "The backend is unavailable. Please try again later.",
      };
      let message =
        messages[response.status] ??
        "The request could not be completed. Please retry.";
      const safeMessages: Record<string, string> = {
        invitation_unavailable: "Class code is invalid or unavailable. Check with your instructor.",
        preview_changed: "Class details changed. Verify the code and review again.",
        school_student_required: "Only school students can join classes.",
        class_context_locked:
          "Grade and language cannot change after a subject, membership or learning activity is attached.",
        idempotency_conflict:
          "This request was already used. Refresh My Classes before creating another.",
        code_capacity:
          "A class code could not be reserved. Please retry later.",
        class_archived: "Archived classes cannot be edited.",
        class_not_found: "Class not found or unavailable to this instructor.",
        instructor_required: "Only instructors can manage classes.",
      };
      try {
        const envelope = await response.json();
        if (safeMessages[envelope?.error?.code])
          message = safeMessages[envelope.error.code];
      } catch {
        /* HTTP status remains authoritative. */
      }
      throw new ApiError(response.status, message);
    }
    return response.status === 204
      ? (undefined as T)
      : ((await response.json()) as T);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      0,
      controller.signal.aborted
        ? "Connection timed out. Please retry."
        : "Unable to reach FLUENTT. Check your connection and retry.",
    );
  } finally {
    clearTimeout(timer);
  }
}
