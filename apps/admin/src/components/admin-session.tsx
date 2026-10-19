"use client";

import { useCallback, useEffect, useState } from "react";
import { isAdminProfile, type AdminProfile } from "@/services/admin-contract";
import { Button } from "./ui";

export function AdminSession({ initial, beforeLogout }: { initial: AdminProfile; beforeLogout?: () => Promise<boolean> }) {
  const [profile, setProfile] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    setBusy(true); setError("");
    try {
      const result = await fetch("/api/admin/me", { cache: "no-store", signal: AbortSignal.timeout(15000) });
      if (result.status === 401 || result.status === 403) { window.location.replace("/login?expired=1"); return; }
      const data: unknown = await result.json();
      if (!result.ok || !isAdminProfile(data)) throw new Error();
      setProfile(data);
    } catch { setError("Session verification is unavailable. Retry before continuing."); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => {
    // Verify after idle expiry rather than sending a heartbeat that prevents idle expiry.
    const timer = setTimeout(() => { void refresh(); }, Math.max(0, Date.parse(profile.expires_at) - Date.now() + 250));
    const restored = (event: PageTransitionEvent) => { if (event.persisted) void refresh(); };
    window.addEventListener("pageshow", restored);
    return () => { clearTimeout(timer); window.removeEventListener("pageshow", restored); };
  }, [profile.expires_at, refresh]);
  async function logout() {
    if (beforeLogout && !await beforeLogout()) return;
    setBusy(true); setError("");
    try {
      const result = await fetch("/api/admin/session", {
        method: "DELETE", headers: { "X-CSRF-Token": profile.csrf_token }, signal: AbortSignal.timeout(15000),
      });
      if (!result.ok && result.status !== 401) throw new Error();
      window.location.replace("/login");
    } catch { setError("Sign-out could not be confirmed. Retry sign-out."); setBusy(false); }
  }
  return <section aria-label="Administrator account" className="account-panel" aria-busy={busy}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
      <p style={{ margin: 0 }}>Signed in as <strong>{profile.username}</strong> · Administrator</p>
      {profile.username === "admin_demo" && <span className="badge" style={{ background: "#e4edb9", color: "#173d33" }}>⚡ DEMO ADMINISTRATOR</span>}
    </div>
    <p style={{ margin: "8px 0 0" }}>Granted Privileges: {profile.permissions.join(", ")}</p>
    <div className="account-actions"><Button onClick={() => void refresh()} disabled={busy}>Refresh session</Button>

      <Button onClick={() => void logout()} disabled={busy}>Sign out</Button></div>
    {error && <p role="alert" className="error">{error}</p>}
  </section>;
}
