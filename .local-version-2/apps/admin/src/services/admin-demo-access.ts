// Server-side only: sample data must never establish administrator access in production.
export function adminDemoEnabled(): boolean {
  return process.env.NODE_ENV === "development" && process.env.FLUENTT_ENABLE_ADMIN_DEMO === "1";
}
