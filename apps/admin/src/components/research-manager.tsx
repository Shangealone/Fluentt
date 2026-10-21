"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { AdminSession } from "./admin-session";
import { Button } from "./ui";
import { ResearchProtocolForm } from "./research-protocol-form";
import { ResearchAssessmentStatus } from "./research-assessment-status";
import { ResearchReportingPanel } from "./research-reporting-panel";
import { isAdminProfile, type AdminProfile } from "@/services/admin-contract";
import { allowedTransition, isStudy, transitions, type Binding, type Choice, type Configuration, type History, type Page, type Study, type StudyState } from "@/services/research-classroom-contract";
import styles from "./research-setup.module.css";

const base = "/api/admin/research/classrooms/studies";
type Pending = { path: string; body: string; key: string; revision?: string };
type Kind = "classrooms" | "conditions" | "instruments";
const emptyChoices: Record<Kind, Choice[]> = { classrooms: [], conditions: [], instruments: [] };

export function ResearchManager({ initial, previewOnly = false }: { initial: AdminProfile; previewOnly?: boolean }) {
  const [profile, setProfile] = useState(initial), [studies, setStudies] = useState<Study[]>([]);
  const [study, setStudy] = useState<Study | null>(null), [choices, setChoices] = useState(emptyChoices);
  const [bindings, setBindings] = useState<Binding[]>([]), [history, setHistory] = useState<History[]>([]);
  const [more, setMore] = useState(false), [offset, setOffset] = useState(0);
  const [extraMore, setExtraMore] = useState<Record<string, boolean>>({});
  const [tab, setTab] = useState<"overview" | "setup" | "monitoring" | "history">("overview");
  const [creating, setCreating] = useState(false), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true);
  const [gate, setGate] = useState(true), [dirty, setDirty] = useState(false), [stale, setStale] = useState(false);
  const [error, setError] = useState(""), [notice, setNotice] = useState(""), [pending, setPending] = useState<Pending | null>(null);
  const generation = useRef(0), controller = useRef<AbortController | null>(null), selected = useRef<string | undefined>(undefined);
  const inFlight = useRef(false), unsaved = useRef(false);
  const nextOffsets = useRef<Record<string, number>>({});
  const manage = profile.permissions.includes("research.manage");
  useEffect(() => { unsaved.current = dirty || pending !== null; }, [dirty, pending]);
  const cancelLoad = useCallback(() => { generation.current++; controller.current?.abort(); }, []);
  const clear = useCallback(() => { setStudies([]); setStudy(null); setChoices(emptyChoices); setBindings([]); setHistory([]); setCreating(false); setDirty(false); setGate(true); setPending(null); }, []);
  const api = useCallback(async (path: string, init: RequestInit = {}, signal?: AbortSignal) => {
    const result = await fetch(path, { ...init, cache: "no-store", signal: signal ?? AbortSignal.timeout(40000) });
    if (result.status === 401 || result.status === 403) {
      generation.current++; controller.current?.abort(); clear();
      if (result.status === 401) window.location.replace("/login?expired=1");
      throw new Error("Research access could not be verified. Request an operator review or sign in again.");
    }
    const value = await result.json();
    if (!result.ok) {
      if (result.status < 500) { setPending(null); }
      if (result.status === 412 || result.status === 428) setStale(true);
      const fields = Array.isArray(value?.error?.details) ? value.error.details.map((d: { location?: string[] }) => d.location?.slice(1).join(".")).filter(Boolean).join(", ") : "";
      throw new Error(`${value?.error?.message ?? "Research request failed."}${fields ? ` Check: ${fields}.` : ""}`);
    }
    return value;
  }, [clear]);
  const verify = useCallback(async () => {
    const value: unknown = await api("/api/admin/me");
    if (!isAdminProfile(value) || !value.permissions.includes("research.read")) { clear(); throw new Error("Explicit research read access is required."); }
    setProfile(value); return value;
  }, [api, clear]);
  const load = useCallback(async (id?: string, page = 0) => {
    if (previewOnly) { setLoading(false); return; }
    controller.current?.abort(); const abort = new AbortController(); controller.current = abort;
    const current = ++generation.current;
    setLoading(true); setGate(true); setError(""); setStudies([]); setStudy(null); setChoices(emptyChoices); setBindings([]); setHistory([]);
    try {
      await verify();
      const rows = await api(`${base}?limit=25&offset=${page}`, {}, abort.signal) as Page<Study>;
      if (!Array.isArray(rows.items) || !rows.items.every(isStudy)) throw new Error("Invalid study response. Retry verification.");
      const row = id ? await api(`${base}/${id}`, {}, abort.signal) as Study : null;
      if (row && !isStudy(row)) throw new Error("Invalid study overview.");
      const nextChoices = { ...emptyChoices }; let attached: Page<Binding> | null = null, versions: Page<History> | null = null;
      if (row) {
        const [classes, conditions, instruments, links, revisions] = await Promise.all([
          api(`${base}/${row.id}/choices?kind=classrooms&limit=25&offset=0`, {}, abort.signal),
          api(`${base}/${row.id}/choices?kind=conditions&limit=25&offset=0`, {}, abort.signal),
          api(`${base}/${row.id}/choices?kind=instruments&limit=25&offset=0`, {}, abort.signal),
          api(`${base}/${row.id}/classrooms?limit=25&offset=0`, {}, abort.signal), api(`${base}/${row.id}/protocols?limit=25&offset=0`, {}, abort.signal),
        ]);
        nextChoices.classrooms = classes.items; nextChoices.conditions = conditions.items; nextChoices.instruments = instruments.items;
        attached = links; versions = revisions;
        if (current !== generation.current || abort.signal.aborted) return;
        nextOffsets.current = { classrooms: classes.offset + classes.limit, conditions: conditions.offset + conditions.limit, instruments: instruments.offset + instruments.limit, bindings: links.offset + links.limit, history: revisions.offset + revisions.limit };
        setExtraMore({ classrooms: classes.has_more, conditions: conditions.has_more, instruments: instruments.has_more, bindings: links.has_more, history: revisions.has_more });
      }
      if (current !== generation.current || abort.signal.aborted) return;
      setStudies(rows.items); setMore(rows.has_more); setOffset(page); setStudy(row); setChoices(nextChoices);
      setBindings(attached?.items ?? []); setHistory(versions?.items ?? []); selected.current = row?.id;
      setGate(false); setStale(false); setDirty(false);
    } catch (cause) { if (current === generation.current && !abort.signal.aborted) setError(cause instanceof Error ? cause.message : "Verification unavailable."); }
    finally { if (current === generation.current) setLoading(false); }
  }, [api, verify, previewOnly]);
  useEffect(() => {
    const timer = setTimeout(() => { void load(); }, 0);
    const hidden = () => { if (document.hidden) { generation.current++; controller.current?.abort(); setGate(true); } else void load(selected.current); };
    const restored = (event: PageTransitionEvent) => { if (event.persisted) void load(selected.current); };
    document.addEventListener("visibilitychange", hidden); window.addEventListener("pageshow", restored);
    return () => { clearTimeout(timer); cancelLoad(); document.removeEventListener("visibilitychange", hidden); window.removeEventListener("pageshow", restored); };
  }, [load, cancelLoad]);
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => { if (unsaved.current) { event.preventDefault(); event.returnValue = ""; } };
    const navigate = (event: MouseEvent) => { if (unsaved.current && (event.target as Element).closest("a[href]") && !window.confirm("Leave these unsaved settings or an unresolved request? Check the server history when you return.")) event.preventDefault(); };
    window.addEventListener("beforeunload", unload); document.addEventListener("click", navigate, true);
    return () => { window.removeEventListener("beforeunload", unload); document.removeEventListener("click", navigate, true); };
  }, []);
  useEffect(() => {
    if (previewOnly) return;
    const timer = setTimeout(() => { void load(selected.current); }, Math.max(0, Date.parse(profile.expires_at) - Date.now() + 250));
    return () => clearTimeout(timer);
  }, [profile.expires_at, previewOnly, load]);
  function discard() { return !unsaved.current || window.confirm("Discard unsaved form changes? An unresolved save must be reconciled with the server."); }
  async function execute(request: Pending) {
    if (inFlight.current) return;
    const mutationGeneration = generation.current;
    inFlight.current = true; setBusy(true); setError(""); setNotice("");
    try {
      const current = await verify();
      if (!current.permissions.includes("research.manage")) { clear(); throw new Error("Research manage permission is required."); }
      if (mutationGeneration !== generation.current || document.hidden) return;
      setPending(request);
      const value = await api(request.path, { method: "POST", headers: { "Content-Type": "application/json", "X-CSRF-Token": current.csrf_token, "Idempotency-Key": request.key, ...(request.revision ? { "If-Match": request.revision } : {}) }, body: request.body });
      if (mutationGeneration !== generation.current || document.hidden) return;
      setPending(null); setDirty(false); setCreating(false);
      setNotice("Saved. The retained server revision and history have been refreshed.");
      await load(request.path === base ? value.id : selected.current);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Save outcome unknown. Retry the exact request."); }
    finally { inFlight.current = false; setBusy(false); }
  }
  async function save(path: string, body: unknown, revision?: string) { await execute({ path, body: JSON.stringify(body), key: crypto.randomUUID(), revision }); }
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    await save(base, { code: data.get("code"), title: data.get("title"), language: data.get("language"), protocol_version: data.get("protocol_version"), target_participants: Number(data.get("target_participants")) });
  }
  async function moreItems(kind: Kind | "bindings" | "history") {
    if (!study || busy) return;
    setBusy(true); const current = generation.current;
    try {
      const count = nextOffsets.current[kind] ?? 25;
      const url = kind === "bindings" ? "classrooms" : kind === "history" ? "protocols" : `choices?kind=${kind}`;
      const data = await api(`${base}/${study.id}/${url}${url.includes("?") ? "&" : "?"}limit=25&offset=${count}`);
      if (current !== generation.current) return;
      nextOffsets.current[kind] = data.offset + data.limit;
      if (kind === "bindings") setBindings(old => [...old, ...data.items]);
      else if (kind === "history") setHistory(old => [...old, ...data.items]);
      else setChoices(old => ({ ...old, [kind]: [...old[kind], ...data.items] }));
      setExtraMore(old => ({ ...old, [kind]: data.has_more }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load next page."); }
    finally { setBusy(false); }
  }
  const blocked = busy || loading || !!pending || stale || gate;
  if (previewOnly) return <section className={styles.panel}><h2>Research requires a live authorized session</h2><p>Demo mode provides no studies, participants, results or setup actions. Sign in with an explicitly authorized researcher account to continue.</p></section>;
  return <div className={styles.workspace} aria-busy={busy || loading}>
    <div className={styles.hero}><p className="eyebrow">RESEARCH CLASSROOMS</p><h2>Plan clearly. Keep every revision.</h2><p>Configure an explicitly designated classroom study, review its permission requirements, and follow its server-confirmed state. Participant activity and outcomes are N/A until an approved execution workflow exists.</p></div>
    <AdminSession initial={profile} beforeLogout={async () => discard()} />
    <div className={styles.toolbar}><nav className={styles.toolbar} aria-label="Research sections">{(["overview", "setup", "monitoring", "history"] as const).map(name => <Button type="button" key={name} aria-pressed={tab === name} disabled={busy} onClick={() => { if (name === tab || discard()) { setTab(name); setDirty(false); } }}>{name === "overview" ? "Overview" : name === "setup" ? "Classroom setup" : name === "monitoring" ? "Monitoring" : "Revision history"}</Button>)}</nav>
      <Button type="button" disabled={busy} onClick={() => { if (discard()) void load(selected.current, offset); }}>Refresh and verify access</Button>
      {manage && !gate && <Button type="button" disabled={blocked} onClick={() => { if (discard()) { setDirty(false); setCreating(true); setTab("setup"); } }}>Create study draft</Button>}
    </div>
    <div aria-live="polite">{loading && <p role="status">Verifying access and loading research configuration...</p>}{notice && <p role="status">{notice}</p>}{error && <p role="alert" className="error">{error}</p>}</div>
    {pending && <section className={styles.requirements} aria-label="Unresolved save"><h3>Confirm the save outcome</h3><p>The request may have committed. Editing is locked. Retry sends the exact original body, revision and request identity.</p><Button type="button" disabled={busy || gate} onClick={() => void execute(pending)}>Retry exact request</Button></section>}
    {!gate && <div className={styles.columns}>
      <aside className={styles.list} aria-label="Your managed studies"><h2>Your studies</h2>
        {!studies.length && <p className={styles.empty}>No managed studies on this page. Create a draft if you have research manage permission. No demonstration studies are generated.</p>}
        {studies.map(row => <button type="button" className={styles.study} aria-pressed={study?.id === row.id} key={row.id} disabled={blocked} onClick={() => { if (discard()) { setCreating(false); void load(row.id, offset); } }}><span className={styles.state}>{row.status}</span><strong>{row.title}</strong><small>{row.code} / {row.language}</small><small>{row.activation_blockers.length} unresolved requirements</small></button>)}
        <div className={styles.toolbar}><Button disabled={blocked || !offset} onClick={() => { if (discard()) void load(undefined, Math.max(0, offset - 25)); }}>Previous studies</Button><Button disabled={blocked || !more} onClick={() => { if (discard()) void load(undefined, offset + 25); }}>Next studies</Button></div>
      </aside>
      <section className={styles.panel} aria-label="Research workspace">
        {creating ? <form className={styles.form} onSubmit={create} onChange={() => setDirty(true)}><h2>Create an unresolved study draft</h2><fieldset disabled={blocked}><legend>Study identity</legend><div className={styles.fields}>
          <label>Study code<input name="code" required minLength={3} maxLength={80} pattern="[A-Za-z0-9][A-Za-z0-9_.\-]{2,79}" /></label><label>Study title<input name="title" required maxLength={200} /></label>
          <label>Learning language<select aria-label="Learning language" name="language" required defaultValue=""><option value="" disabled>Select a language</option><option value="english">English</option><option value="tagalog">Tagalog</option></select></label>
          <label>Protocol version<input name="protocol_version" required maxLength={80} /></label><label>Proposed participant target<input name="target_participants" type="number" required min="1" max="2147483647" /></label>
        </div><p>This proposed target is not an enrolled count or an approved sample size. No participant records will be created.</p><Button type="submit">Create draft</Button><Button type="button" onClick={() => { if (discard()) { setCreating(false); setDirty(false); } }}>Cancel</Button></fieldset></form>
          : !study ? <div><h2>Select a study to begin</h2><p>Only studies you manage and are authorized to read appear here.</p></div>
          : <>
            <div className={styles.toolbar}><span className={styles.state}>{study.status}</span><span>Configuration revision {study.configuration_version}</span></div><h2>{study.title}</h2><p>{study.code} / {study.language} / protocol {study.protocol_version}</p>
            {tab === "overview" && <><dl className={styles.summary}><div><dt>Proposed target</dt><dd>{study.target_participants}</dd></div><div><dt>Participant enrollment</dt><dd>N/A</dd></div><div><dt>Experiment outcomes</dt><dd>N/A</dd></div></dl>
              <ResearchAssessmentStatus publication={study.assessment_publication} />
              <section className={styles.requirements} aria-label="Activation requirements"><h3>{study.activation_blockers.length ? "Resolve requirements before activation" : "Configuration gates currently satisfied"}</h3><p>Evidence references are not approval. Readiness and activation are checked again by the server; execution is not implemented here.</p><ul>{study.activation_blockers.map(item => <li key={item}>{item.replaceAll("_", " ").replaceAll(":", ": ")}</li>)}</ul></section>
              <div className={styles.toolbar}>{transitions[study.status].map(next => <Button key={next} disabled={blocked || dirty || !allowedTransition(study, next, manage)} onClick={() => { if (window.confirm(`Change ${study.code} from ${study.status} to ${next}? This state change will be retained. No participant execution is enabled.`)) void save(`${base}/${study.id}/state`, { status: next as StudyState }, study.revision); }}>{next === "READY" ? "Mark ready" : next === "ACTIVE" ? "Activate configuration" : next === "PAUSED" ? "Pause study" : "Complete study"}</Button>)}</div>
              {!manage && <p>Read-only access. An operator must explicitly grant research manage permission for edits.</p>}
              <p className={styles.identifier}>Protocol record: {study.protocol_id}<br />Fingerprint: {study.configuration_fingerprint}</p>
            </>}
            {tab === "monitoring" && <ResearchReportingPanel study={study} />}
            {tab === "setup" && <><section><h3>Explicitly designated classrooms</h3><p>Designating a classroom does not enroll its students or grant consent.</p>{!bindings.length && <p>No visible designated classrooms.</p>}<ul>{bindings.map(b => <li key={b.id} className={styles.identifier}>{choices.classrooms.find(c => c.id === b.class_id)?.label ?? "Designated classroom"} / {b.class_id}</li>)}</ul>
              {extraMore.bindings && <Button disabled={blocked} onClick={() => void moreItems("bindings")}>More designations</Button>}
              <form className={styles.fields} onSubmit={event => { event.preventDefault(); const classId = new FormData(event.currentTarget).get("class_id"); if (window.confirm("Explicitly designate this classroom for this study? No students will be enrolled.")) void save(`${base}/${study.id}/classrooms`, { class_id: classId }, study.revision); }}>
                <label>Eligible classroom<select aria-label="Eligible classroom" name="class_id" defaultValue="" required disabled={blocked || !manage || study.status !== "DRAFT"}><option value="">Choose a specifically authorized classroom</option>{choices.classrooms.filter(c => !bindings.some(b => b.class_id === c.id)).map(c => <option key={c.id} value={c.id}>{c.label} / {c.language}</option>)}</select></label><Button type="submit" disabled={blocked || dirty || !manage || study.status !== "DRAFT"}>Attach classroom</Button>
              </form><p className={styles.hint}>Only active matching-language classrooms with live eligible owners and your exact classroom manage grant are listed. An empty list is not a reason to bypass ownership.</p>
            </section><ResearchProtocolForm key={`${study.id}:${study.configuration_version}:${choices.instruments.length}:${choices.conditions.length}`} study={study} conditions={choices.conditions} instruments={choices.instruments} disabled={blocked || !manage} onDirty={setDirty} onSave={async (config: Configuration) => { await save(`${base}/${study.id}/protocols`, config, study.revision); }} />
              <div className={styles.toolbar}>{(["classrooms", "conditions", "instruments"] as const).filter(kind => extraMore[kind]).map(kind => <Button key={kind} disabled={blocked || dirty} onClick={() => void moreItems(kind)}>More {kind} options</Button>)}</div>
            </>}
            {tab === "history" && <><h3>Retained configuration changes</h3><p>Each entry is a genuine server revision. Changes to class designations and lifecycle are retained by backend events; a dedicated event viewer is not available in this slice.</p><ol className={styles.history}>{history.map(row => <li key={row.id}><strong>Revision {row.version} / {row.protocol_version}</strong><small className={styles.identifier}>{row.fingerprint}</small><details><summary>Inspect saved configuration</summary><pre className={styles.identifier}>{JSON.stringify(row.configuration, null, 2)}</pre></details></li>)}</ol>{extraMore.history && <Button disabled={blocked} onClick={() => void moreItems("history")}>More revisions</Button>}</>}
          </>}
      </section>
    </div>}
  </div>;
}
