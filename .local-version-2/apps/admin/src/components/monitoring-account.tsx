"use client";

import { useState } from "react";

export function MonitoringAccount({ username, csrf }: { username: string; csrf: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function signOut() {
    setBusy(true);
    setError("");
    try {
      const result = await fetch("/api/admin/session", {
        method: "DELETE", headers: { "X-CSRF-Token": csrf }, cache: "no-store",
        signal: AbortSignal.timeout(15000),
      });
      if (!result.ok && result.status !== 401) throw new Error();
      window.location.replace("/login");
    } catch {
      setError("Sign-out could not be confirmed. Retry.");
      setBusy(false);
    }
  }
  return <div className="monitor-account-group"><span>{username}</span>
    <button type="button" disabled={busy} onClick={() => void signOut()}>Sign out</button>
    {error && <span role="alert">{error}</span>}
  </div>;
}
