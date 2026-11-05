"use client";
import { useState } from "react";

export function ParallelTestManager({ id, csrf, consentKinds }: { id: string; csrf: string; consentKinds: string[] }) {
  const [pending, setPending] = useState<{ action: string; body: unknown } | null>(null);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const [version, setVersion] = useState(""), [pretest, setPretest] = useState("");
  const [format, setFormat] = useState("multiple_choice"), [user, setUser] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const execute = async (action: string, body: unknown) => {
    if (busy) return;
    const next = pending ?? { action, body };
    setPending(next); setBusy(true); setMessage("");
    try {
      const result = await fetch(`/api/admin/parallel-test/${encodeURIComponent(id)}/${next.action}`, {
        method: "POST", headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf }, body: JSON.stringify(next.body),
        signal: AbortSignal.timeout(35000), cache: "no-store" });
      if (!result.ok) throw new Error("unavailable");
      setMessage("Development operation confirmed. Refresh the preparation page to inspect retained state.");
      setPending(null);
    } catch { setMessage("Operation was not confirmed. Retry the retained details; no approval or success is assumed."); }
    finally { setBusy(false); }
  };
  return <section><h2>Disposable-development workflow setup</h2><p>Only synthetic approvals and test accounts in a disposable local database. This does not approve or activate a real experiment.</p>
    <fieldset disabled={busy || !!pending}><legend>Frozen development assessment policy</legend>
      <label>Pretest local date<input type="date" value={pretest} onChange={e => setPretest(e.target.value)} /></label>
      <label>Test instrument version<input maxLength={80} value={version} onChange={e => setVersion(e.target.value)} /></label>
      <label>Question format<select value={format} onChange={e => setFormat(e.target.value)}><option value="multiple_choice">Multiple choice</option><option value="typed_recall">Typed recall</option></select></label>
      <button disabled={!pretest || !version.trim()} onClick={() => void execute("configure", { pretest_date: pretest, assessment_version: version,
        assessment_format: format, policy: "development-objective-complete-v1", approvals: { protocol: "SYNTHETIC: development fixture", ethics: "SYNTHETIC: development fixture", site: "SYNTHETIC: development fixture" } })}>Configure synthetic test policy</button>
    </fieldset>
    <fieldset disabled={busy || !!pending}><legend>Enroll a test account</legend><label>Existing synthetic school account UUID<input value={user} maxLength={36} onChange={e => setUser(e.target.value)} /></label>
      <label><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />This is an eligible test account with synthetic {consentKinds.join(", ")} evidence.</label>
      <button disabled={!confirmed || !/^[0-9a-f-]{36}$/i.test(user)} onClick={() => void execute("enroll", { user_id: user, eligibility_confirmed: true,
        consent_evidence: Object.fromEntries(consentKinds.map(kind => [kind, "SYNTHETIC: development fixture"])) })}>Enroll and allocate test account</button>
    </fieldset>
    {pending && <button disabled={busy} onClick={() => void execute(pending.action, pending.body)}>Retry retained operation</button>}
    {message && <p role="status">{message}</p>}
  </section>;
}
