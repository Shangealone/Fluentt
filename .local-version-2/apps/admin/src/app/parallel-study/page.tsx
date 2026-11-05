import { Suspense } from "react";
import Link from "next/link";
import { requireAdmin, backend } from "@/services/admin-server";
import { ParallelTestManager } from "@/components/parallel-test-manager";

type Search = Promise<Record<string, string | string[] | undefined>>;

async function Preparation({ searchParams }: { searchParams: Search }) {
  const profile = await requireAdmin();
  if (!profile.permissions.includes("research.read")) return <main><h1>Parallel study preparation</h1><p role="alert">Explicit research access is required.</p></main>;
  const { id } = await searchParams;
  let result: { status: string; live_scheduling_enabled: boolean; blockers: string[]; assigned_counts: Record<string, number>; eligible_count: number; enrolled_count: number; prepared_local_dates: string[]; configuration: { start_date: string; end_date: string; posttest_date: string; delayed_date: string; required_consent_kinds: string[] } } | null = null;
  let test: { development_only: boolean; participants: { participant_code: string; status: string; tasks: { id: string; title: string; status: string }[] }[]; fifakt_path: string; configuration_status: string } | null = null;
  let testEnabled = false;
  let error = "";
  if (typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id)) {
    try {
      const response = await backend(`/parallel-studies/${encodeURIComponent(id)}`);
      if (!response.ok) error = "Preparation is disabled or this study is unavailable to your account.";
      else {
        const value = await response.json();
        if (value.status !== "inactive" || value.live_scheduling_enabled !== false || !Array.isArray(value.blockers)) throw new Error("contract");
        result = value;
        const development = await backend(`/parallel-studies/${encodeURIComponent(id)}/test-monitor`);
        if (development.ok) {
          const monitor = await development.json();
          if (monitor.development_only === true && Array.isArray(monitor.participants)) { test = monitor; testEnabled = true; }
        } else if (development.status === 409) {
          // An enabled disposable workflow may still need its frozen configuration.
          testEnabled = process.env.NODE_ENV === "development";
        }
      }
    } catch { error = "Study preparation could not be checked."; }
  }
  return <main className="shell"><h1>Parallel study preparation</h1><Link href="/research">Research administration</Link>
    <p>Preparation only. Participant activities and live hybrid scheduling are blocked.</p>
    <form><label htmlFor="study-id">Prepared study identifier</label><input id="study-id" name="id" maxLength={36} required /><button type="submit">Check preparation</button></form>
    {error && <p role="alert">{error}</p>}
    {result && <section><h2>Inactive configuration</h2><p>Intervention: {result.configuration.start_date} to {result.configuration.end_date} (exclusive).</p>
      <p>Posttest: {result.configuration.posttest_date}; delayed assessment: {result.configuration.delayed_date}.</p>
      <p>FSRS-6 assigned: {result.assigned_counts.FSRS6_CONTROL ?? 0}; hybrid assigned: {result.assigned_counts.FSRS6_FIFAKT_EXPERIMENTAL ?? 0}. Target: 15 per condition.</p>
      <p>Stored eligible participants: {result.eligible_count}; stored enrolled participants: {result.enrolled_count}. These counts do not grant approval.</p>
      <p>Prepared weekdays: {result.prepared_local_dates.join(", ")}. Activity completion is unavailable while participation is blocked.</p>
      <h3>Remaining requirements</h3><ul>{result.blockers.map(reason => <li key={reason}>{reason.replaceAll("_", " ")}</li>)}</ul>
      <p>No results or effectiveness comparison is available.</p></section>}
    {test && <section><h2>Development participation</h2><p>{test.configuration_status}; experimental practice: {test.fifakt_path}.</p>
      {test.participants.map(p => <details key={p.participant_code}><summary>{p.participant_code}: {p.status}</summary><ul>{p.tasks.map(t => <li key={t.id}>{t.title}: {t.status.replaceAll("_", " ")}</li>)}</ul></details>)}
    </section>}
    {testEnabled && typeof id === "string" && result && profile.permissions.includes("research.manage") && <ParallelTestManager id={id} csrf={profile.csrf_token} consentKinds={result.configuration.required_consent_kinds} />}
  </main>;
}

export default function Page(props: { searchParams: Search }) {
  return <Suspense fallback={<p role="status">Verifying research access…</p>}><Preparation {...props} /></Suspense>;
}
