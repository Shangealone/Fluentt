"use client";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { AdminProfile } from "@/services/admin-contract";
import { AdminSession } from "./admin-session";

type Card = { vocabulary_item_id: string; content_version: number; term: string; meaning: string; typed_prompt: string; accepted_forms: string[]; choice_prompt: string; options: { id: string; text: string }[]; correct_option_id: string };
type Pack = { id: string; title: string; language: string; card_count: number; published_at: string | null; cards: Card[] };
type Study = { id: string; title: string; status: string; revision: string; blockers: string[]; configuration_sha256: string };
type Choices = { classes: { id: string; title: string }[]; model_ready: boolean; artifact_sha256: string | null };
type Retry = { path: string; body?: unknown; key: string; revision?: string; clearCards?: boolean };
const names: Record<string, string> = { approval_protocol: "Approved protocol evidence", approval_ethics: "Ethics approval evidence", approval_site: "Site permission evidence", approval_instruments: "Approved instruments", approval_model: "Model-validation evidence", validated_model_unavailable: "Validated prediction model", published_pool_unavailable: "Published vocabulary pools", class_unavailable: "Active classroom", study_configuration_changed: "Study details must match the frozen configuration", study_workflow_unavailable: "Consent, withdrawal and study assessment integration" };
const field = { display: "grid", gap: 6, marginBottom: 14 } as const;
const section = { border: "1px solid #dce5de", borderRadius: 16, padding: 22, marginBottom: 22, background: "white" } as const;

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/admin/vocabulary/${path}`, { ...init, cache: "no-store", signal: AbortSignal.timeout(35000) });
  const value = await response.json();
  if (!response.ok) {
    const error = new Error(value.error?.message ?? "The request could not be confirmed.") as Error & { status: number };
    error.status = response.status; throw error;
  }
  return value;
}

export function VocabularyManager({ initial }: { initial: AdminProfile }) {
  const [packs, setPacks] = useState<Pack[]>([]), [studies, setStudies] = useState<Study[]>([]);
  const [lessons, setLessons] = useState<{ id: string; title: string; grade: number; subject: string }[]>([]);
  const [choices, setChoices] = useState<Choices>({ classes: [], model_ready: false, artifact_sha256: null });
  const [cards, setCards] = useState<Card[]>([]), [poolTitle, setPoolTitle] = useState(""), [lesson, setLesson] = useState("");
  const [language, setLanguage] = useState("english"), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true);
  const [error, setError] = useState(""), [notice, setNotice] = useState(""), [pending, setPending] = useState<Retry | null>(null), [lost, setLost] = useState(false);
  const alive = useRef(true), lock = useRef(false), epoch = useRef(0);
  const canWrite = initial.permissions.includes("curriculum.write"), canResearch = initial.permissions.includes("research.read");
  const frozen = busy || !!pending || lost;
  function failed(cause: unknown) {
    const status = (cause as { status?: number }).status;
    setError(cause instanceof Error ? cause.message : "Please try again.");
    if (status === 401 || status === 403) { setPacks([]); setStudies([]); setCards([]); setLost(true); if (status === 401) window.location.replace("/login?expired=1"); }
  }
  const load = useCallback(async () => {
    const generation = ++epoch.current;
    setLoading(true);
    try {
      const [p, l, s, c] = await Promise.all([
        api<{ items: Pack[] }>("packs"), api<{ items: typeof lessons }>("lessons"),
        canResearch ? api<{ items: Study[] }>("protocols") : Promise.resolve({ items: [] }),
        canResearch ? api<Choices>("choices") : Promise.resolve({ classes: [], model_ready: false, artifact_sha256: null }),
      ]);
      if (alive.current && generation === epoch.current) { setPacks(p.items); setLessons(l.items); setStudies(s.items); setChoices(c); }
    } catch (cause) { if (alive.current && generation === epoch.current) { setPacks([]); setStudies([]); failed(cause); } }
    finally { if (alive.current && generation === epoch.current) setLoading(false); }
  }, [canResearch]);
  useEffect(() => {
    alive.current = true;
    let cancelled = false;
    void Promise.resolve().then(() => { if (!cancelled) void load(); });
    return () => { cancelled = true; alive.current = false; };
  }, [load]);
  useEffect(() => {
    if (!cards.length && !pending) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, [cards.length, pending]);
  async function write(operation: Retry) {
    if (lock.current || lost) return;
    lock.current = true; setBusy(true); setPending(operation); setError(""); setNotice("");
    try {
      await api(operation.path, { method: "POST", headers: { "Content-Type": "application/json", "X-CSRF-Token": initial.csrf_token, "Idempotency-Key": operation.key, ...(operation.revision ? { "If-Match": operation.revision } : {}) }, body: operation.body === undefined ? undefined : JSON.stringify(operation.body) });
      if (alive.current) { setPending(null); if (operation.clearCards) { setCards([]); setPoolTitle(""); } setNotice("Saved. The current records are shown below."); await load(); }
    } catch (cause) { if (alive.current) { failed(cause); if ([400, 401, 403, 404, 409, 412, 422].includes((cause as { status?: number }).status ?? 0)) { setPending(null); setNotice("The request was not accepted. Refresh the current records before trying revised details."); } } }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  function addWord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (frozen) return;
    const form = event.currentTarget, data = new FormData(form), get = (name: string) => String(data.get(name) ?? "");
    const row: Card = { vocabulary_item_id: crypto.randomUUID(), content_version: 1, term: get("term"), meaning: get("meaning"), typed_prompt: get("typed"),
      accepted_forms: get("accepted").split(/\r?\n/).map(s => s.trim()).filter(Boolean), choice_prompt: get("choice"),
      options: [0, 1, 2, 3].map(i => ({ id: `option_${i}`, text: get(`option_${i}`) })).filter(o => o.text.trim()), correct_option_id: get("correct") };
    if (!row.accepted_forms.length || row.options.length < 2 || !row.options.some(o => o.id === row.correct_option_id) || cards.length >= 200) { setError("Add accepted answers and at least two choices, and select an available correct choice. A pool supports up to 200 words."); return; }
    setCards(old => [...old, row]); setError(""); form.reset();
  }
  function createStudy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (frozen) return;
    const data = new FormData(event.currentTarget), get = (name: string) => String(data.get(name) ?? ""), number = (name: string) => Number(get(name));
    const body = { title: get("title"), code: get("code"), protocol_version: get("version"), class_id: get("class"), pack_a_id: get("pool_a"), pack_b_id: get("pool_b"),
      target_participants: number("participants"), model_artifact_sha256: choices.artifact_sha256,
      required_consent_kinds: data.getAll("consent"), settings: { reference_probability: number("reference"), sensitivity: number("sensitivity"), minimum_factor: number("min_factor"), maximum_factor: number("max_factor"),
        desired_retention: number("retention"), maximum_interval_days: number("max_interval"), minimum_history: number("history"), timezone: get("timezone"), allowed_weekdays: data.getAll("weekday").map(Number), excluded_dates: [] } };
    void write({ path: "protocols", body, key: crypto.randomUUID() });
  }
  return <>
    <AdminSession initial={initial} beforeLogout={async () => !cards.length && !pending || window.confirm("Leave vocabulary setup? Unsaved draft words will be lost. Reconcile interrupted saves before recreating them.")} />
    <p>Prepare vocabulary pools for multiple choice and typed word recall. Study activation requires separate research access, documented approvals and a validated prediction model.</p>
    {!!error && <p role="alert" className="error">{error}</p>}{!!notice && <p role="status">{notice}</p>}
    {pending && !busy && <section style={section}><p>The saved outcome is unconfirmed. Form editing is paused.</p><button onClick={() => void write(pending)}>Retry the same request</button></section>}
    <button disabled={frozen || loading} onClick={() => { setError(""); void load(); }}>Refresh vocabulary</button>
    {loading && <p role="status">Loading vocabulary…</p>}
    {canWrite && <section style={section}><h2>Create a vocabulary pool</h2>
      <label style={field}>Pool title<input value={poolTitle} disabled={frozen} maxLength={200} onChange={e => setPoolTitle(e.target.value)} /></label>
      <label style={field}>Published lesson<select value={lesson} disabled={frozen} onChange={e => setLesson(e.target.value)}><option value="">Choose a lesson</option>{lessons.map(row => <option key={row.id} value={row.id}>{row.title} · Grade {row.grade} · {row.subject}</option>)}</select></label>
      <label style={field}>Learning language<select value={language} disabled={frozen} onChange={e => setLanguage(e.target.value)}><option value="english">English</option><option value="tagalog">Tagalog</option></select></label>
      <form onSubmit={addWord}><fieldset disabled={frozen}><legend>Add a word</legend>
        <label style={field}>Word or phrase<input name="term" required maxLength={200} /></label><label style={field}>Meaning<textarea name="meaning" required maxLength={2000} /></label>
        <label style={field}>Typed recall question<textarea name="typed" required maxLength={2000} /></label><label style={field}>Accepted answers, one per line<textarea name="accepted" required /></label>
        <label style={field}>Multiple-choice question<textarea name="choice" required maxLength={2000} /></label>
        {[0, 1, 2, 3].map(i => <label key={i} style={field}>Choice {i + 1}<input name={`option_${i}`} required={i < 2} maxLength={300} /><span><input type="radio" name="correct" value={`option_${i}`} required /> Correct answer</span></label>)}
        <button type="submit">Add word to draft</button></fieldset></form>
      <h3>Draft words ({cards.length})</h3>{cards.map((row, i) => <p key={row.vocabulary_item_id}>{row.term} <button disabled={frozen} onClick={() => setCards(rows => rows.filter((_, n) => n !== i))}>Remove {row.term}</button></p>)}
      <button disabled={frozen || !poolTitle.trim() || !lesson || !cards.length} onClick={() => void write({ path: "packs", key: crypto.randomUUID(), clearCards: true, body: { lesson_id: lesson, title: poolTitle, language, cards } })}>Save pool draft</button>
    </section>}
    <section style={section}><h2>Vocabulary pools</h2>{!loading && !packs.length && <p>No pools yet.</p>}{packs.map(row => <article key={row.id} style={section}><h3>{row.title}</h3><p>{row.language} · {row.card_count} words · {row.published_at ? "Published snapshot" : "Draft snapshot"}</p>
      <details><summary>Review words and answers</summary>{row.cards.map(card => <div key={card.vocabulary_item_id}><h4>{card.term}</h4><p>{card.meaning}</p><p>Typed question: {card.typed_prompt}</p><p>Accepted: {card.accepted_forms.join(", ")}</p><p>Choice question: {card.choice_prompt}</p>{card.options.map(o => <p key={o.id}>{o.text}{o.id === card.correct_option_id ? " (correct)" : ""}</p>)}</div>)}</details>
      {!row.published_at && initial.permissions.includes("curriculum.publish") && <button disabled={frozen} onClick={() => { if (window.confirm(`Publish ${row.title}? This freezes this pool snapshot. Corrections need a new snapshot.`)) void write({ path: `packs/${row.id}/publish`, key: crypto.randomUUID() }); }}>Publish pool</button>}
    </article>)}</section>
    {canResearch ? <section style={section}><h2>Counterbalanced study setup</h2><p>Mapping 1: set A uses the baseline and set B uses ESR. Mapping 2 reverses the assignments. Both sets run during the same period.</p>
      {!choices.model_ready && <p role="status">A validated prediction model is not configured. You can prepare vocabulary pools now. Study configuration and activation remain unavailable.</p>}
      {initial.permissions.includes("research.manage") && <form onSubmit={createStudy}><fieldset disabled={frozen || !choices.model_ready}><legend>New study configuration</legend>
        {[['title', 'Study title'], ['code', 'Study code'], ['version', 'Protocol version']].map(([name, label]) => <label key={name} style={field}>{label}<input name={name} required /></label>)}
        <label style={field}>Class<select name="class" required><option value="">Choose an authorized class</option>{choices.classes.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
        {['a', 'b'].map(pool => <label key={pool} style={field}>Vocabulary set {pool.toUpperCase()}<select name={`pool_${pool}`} required><option value="">Choose a published pool</option>{packs.filter(p => p.published_at).map(p => <option key={p.id} value={p.id}>{p.title}</option>)}</select></label>)}
        {[['participants', 'Planned participant capacity'], ['reference', 'Prediction reference (0–1)'], ['sensitivity', 'Interval adjustment strength'], ['min_factor', 'Minimum interval multiplier'], ['max_factor', 'Maximum interval multiplier'], ['retention', 'Baseline desired retention (0–1)'], ['max_interval', 'Maximum interval (days)'], ['history', 'Minimum usable history (reviews)']].map(([name, label]) => <label key={name} style={field}>{label}<input type="number" name={name} step="any" required /></label>)}
        <label style={field}>Study timezone<input name="timezone" defaultValue="Asia/Manila" required /></label>
        <fieldset><legend>Permitted weekdays</legend>{['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day, i) => <label key={day}><input type="checkbox" name="weekday" value={i} />{day} </label>)}</fieldset>
        <fieldset><legend>Required documented participation permissions</legend>{[['consent', 'Consent'], ['guardian_consent', 'Guardian consent'], ['assent', 'Learner assent']].map(([id, label]) => <label key={id}><input type="checkbox" name="consent" value={id} />{label} </label>)}<p>These settings describe required evidence. Selecting them does not record or establish anyone’s consent.</p></fieldset>
        <button type="submit">Save study configuration</button></fieldset></form>}
      {studies.map(row => <article key={row.id} style={section}><h3>{row.title}</h3><p>Status: {row.status}</p>{!!row.blockers.length && <><p>Still required:</p><ul>{row.blockers.map(b => <li key={b}>{names[b] ?? b}</li>)}</ul></>}
        {initial.permissions.includes("research.manage") && ['draft', 'paused', 'active'].includes(row.status) && <button disabled={frozen || (row.status !== 'active' && !!row.blockers.length)} onClick={() => { const status = row.status === 'active' ? 'paused' : 'active'; if (window.confirm(`${status === 'active' ? 'Activate' : 'Pause'} this study?`)) void write({ path: `protocols/${row.id}/state`, key: crypto.randomUUID(), revision: row.revision, body: { status, confirm: true } }); }}>{row.status === 'active' ? 'Pause study' : 'Activate study'}</button>}
      </article>)}
    </section> : <section style={section}><h2>Research setup access</h2><p>An operator must grant explicit research permissions and access to the designated class before this account can configure studies.</p></section>}
  </>;
}
