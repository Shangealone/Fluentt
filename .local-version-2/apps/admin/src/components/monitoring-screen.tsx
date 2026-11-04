import Link from "next/link";
import { requireAdmin, backend, localMonitoringPreview } from "@/services/admin-server";
import type { AdminProfile } from "@/services/admin-contract";
import { MonitoringAccount } from "./monitoring-account";

type Section = "overview" | "classes" | "students" | "learn" | "fsrs" | "fifakt" | "pronunciation" | "tutor" | "users" | "status";
type Params = Record<string, string | string[] | undefined>;
type Page<T> = { items: T[]; limit: number; offset: number; has_more: boolean };
type Overview = { as_of: string; scope: string; students: number; instructors: number; classes: number; enrollments: number; submitted_captures: number; wavlm_attempts: number; tutor_sessions: number };
type ClassRow = { id: string; name: string; language: string; join_code: string | null; instructor: string; enrollments: number; created_at: string };
type UserRow = { id: string; username: string; role: string; status: string; created_at: string };
type ClassDetail = { id: string; name: string; language: string; join_code: string | null; instructor: string; created_at: string; submitted_captures: number; wavlm_attempts: number; tutor_sessions: number; students: Page<{ id: string; username: string; joined_at: string }> };
type StudentDetail = { id: string; username: string; role: string; status: string; classes: { id: string; name: string; instructor: string }[]; classes_truncated: boolean; submitted_captures: number; wavlm_attempts: number; tutor_sessions: number };
type Attempt = { id: string; attempted_at: string; score: string; student_id: string; class_name: string };
type AttemptDetail = { id: string; attempted_at: string; student_id: string; class_name: string; reference_text: string; overall_score: number; model_id: string | null; model_version: string | null; feedback: string | null; processing_duration_ms: number | null; words: { word: string; score: number; phonemes: { phone: string; score: number; error: boolean; tip: string | null }[] }[] };
type TutorSession = { id: string; started_at: string; status: string; student_id: string; class_name: string };
type Status = { backend: string; database: string; fsrs: string; wavlm: string; groq: string; note: string };

const nav: { id: Section; label: string; icon: string }[] = [
  { id: "overview", label: "Dashboard", icon: "⌂" },
  { id: "classes", label: "Classes & instructors", icon: "▦" },
  { id: "students", label: "Students", icon: "♙" },
  { id: "learn", label: "Learn activity", icon: "▤" },
  { id: "fsrs", label: "FSRS-6 only", icon: "◷" },
  { id: "fifakt", label: "FSRS-6 + FIFAKT", icon: "◈" },
  { id: "pronunciation", label: "WavLM pronunciation", icon: "◉" },
  { id: "tutor", label: "AI Tutor activity", icon: "◌" },
  { id: "users", label: "User management", icon: "♧" },
  { id: "status", label: "System status", icon: "✳" },
];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const pick = (value: string | string[] | undefined) => typeof value === "string" ? value : "";
const number = (value: string, fallback = 0) => /^\d+$/.test(value) ? Math.min(100000, Number(value)) : fallback;
const date = (value: string | null | undefined) => value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Unavailable";
const sectionPath = (section: Section) => section === "overview" ? "/dashboard" : `/monitoring/${section}`;

async function load<T>(path: string): Promise<T> {
  const result = await backend(path);
  if (result.status === 403) throw new Error("Monitoring permission was revoked. Contact your operator.");
  if (result.status === 404) throw new Error("This record is no longer available.");
  if (!result.ok) throw new Error("Monitoring data is unavailable. Retry later.");
  return await result.json() as T;
}

function Metric({ label, value, href, note }: { label: string; value: number | string; href?: string; note?: string }) {
  const content = <><span className="monitor-metric-label">{label}</span><strong>{value}</strong>{note && <small>{note}</small>}</>;
  return href ? <Link className="monitor-metric" href={href}>{content}<span className="monitor-arrow" aria-hidden="true">↗</span></Link>
    : <div className="monitor-metric">{content}</div>;
}

function PageLinks({ section, data, q = "", id = "" }: { section: Section; data: Page<unknown>; q?: string; id?: string }) {
  const base = sectionPath(section);
  const build = (offset: number) => `${base}?${new URLSearchParams({ ...(q ? { q } : {}), ...(id ? { id } : {}), offset: String(offset) })}`;
  return <nav className="monitor-pagination" aria-label="List pages">
    {data.offset > 0 ? <Link href={build(Math.max(0, data.offset - data.limit))}>← Previous</Link> : <span>← Previous</span>}
    <small>Showing {data.items.length ? data.offset + 1 : 0}–{data.offset + data.items.length}</small>
    {data.has_more ? <Link href={build(data.offset + data.limit)}>Next →</Link> : <span>Next →</span>}
  </nav>;
}

function Search({ section, q }: { section: Section; q: string }) {
  return <form action={sectionPath(section)} className="monitor-search" role="search">
    <label htmlFor="monitor-q">Search {section === "classes" ? "classes, codes or instructors" : "usernames"}</label>
    <div><input id="monitor-q" name="q" defaultValue={q} maxLength={80} placeholder="Type a name" /><button type="submit">Search</button></div>
  </form>;
}

function Empty({ text = "No records are available in this scope." }: { text?: string }) {
  return <div className="monitor-empty"><span aria-hidden="true">◌</span><p>{text}</p></div>;
}

async function Content({ section, params }: { section: Section; params: Params }) {
  const q = pick(params.q).trim().slice(0, 80);
  const id = pick(params.id);
  const offset = number(pick(params.offset));
  if (section === "overview") {
    const item = await load<Overview>("/monitoring/overview");
    return <><div className="monitor-metrics">
      <Metric label="Active students" value={item.students} href={sectionPath("students")} note="School and personal accounts" />
      <Metric label="Active instructors" value={item.instructors} href={sectionPath("users")} />
      <Metric label="Active classes" value={item.classes} href={sectionPath("classes")} note="Ordinary classes" />
      <Metric label="Current enrollments" value={item.enrollments} href={sectionPath("classes")} note="Memberships, not unique learners" />
    </div><div className="monitor-columns">
      <section className="monitor-panel"><p className="monitor-kicker">LEARNING ACTIVITY</p><h2>What is recorded</h2><div className="monitor-list">
        <Link href={sectionPath("learn")}><span>Submitted classroom captures</span><strong>{item.submitted_captures} ↗</strong></Link>
        <Link href={sectionPath("pronunciation")}><span>WavLM model assessments</span><strong>{item.wavlm_attempts} ↗</strong></Link>
        <Link href={sectionPath("tutor")}><span>Tutor sessions</span><strong>{item.tutor_sessions} ↗</strong></Link>
      </div><p className="monitor-footnote">Submissions include incomplete and review-required captures. They are not mastery or completion percentages.</p></section>
      <section className="monitor-panel monitor-soft"><p className="monitor-kicker">EVIDENCE BOUNDARY</p><h2>Read with care</h2><p>Personal progress and live FSRS-6 performance are unavailable until approved learning and review events are recorded.</p><p>WavLM values are unvalidated model predictions, not teacher ratings or academic grades.</p><p className="monitor-footnote">Checked {date(item.as_of)} · {item.scope}</p></section>
    </div></>;
  }
  if (section === "classes") {
    if (id && uuid.test(id)) {
      const item = await load<ClassDetail>(`/monitoring/classes/${id}?offset=${offset}`);
      return <><Link href={sectionPath("classes")} className="monitor-back">← All classes</Link><div className="monitor-detail-head"><div><p className="monitor-kicker">CLASS DETAILS</p><h2>{item.name}</h2><p>{item.instructor} · {item.language} · Join code {item.join_code ?? "unavailable"} · Created {date(item.created_at)}</p></div><span className="monitor-pill">Active</span></div>
        <div className="monitor-metrics compact"><Metric label="Current students" value={item.students.items.length} note="This page only" /><Metric label="Submitted captures" value={item.submitted_captures} /><Metric label="WavLM assessments" value={item.wavlm_attempts} /><Metric label="Tutor sessions" value={item.tutor_sessions} /></div>
        <section className="monitor-panel"><h3>Enrolled students</h3>{item.students.items.length ? <div className="monitor-table-wrap"><table><thead><tr><th>Student</th><th>Joined</th><th>Details</th></tr></thead><tbody>{item.students.items.map(student => <tr key={student.id}><td>{student.username}</td><td>{date(student.joined_at)}</td><td><Link href={`/monitoring/students?id=${student.id}`}>View student →</Link></td></tr>)}</tbody></table></div> : <Empty text="No current students in this class." />}<PageLinks section="classes" data={item.students} id={id} /></section></>;
    }
    const page = await load<Page<ClassRow>>(`/monitoring/classes?${new URLSearchParams({ ...(q ? { q } : {}), offset: String(offset) })}`);
    return <section className="monitor-panel"><Search section="classes" q={q} />{page.items.length ? <div className="monitor-table-wrap"><table><thead><tr><th>Class</th><th>Join code</th><th>Instructor</th><th>Students</th><th>Created</th></tr></thead><tbody>{page.items.map(item => <tr key={item.id}><td><Link href={`/monitoring/classes?id=${item.id}`}>{item.name}</Link><small>{item.language}</small></td><td>{item.join_code ?? "—"}</td><td>{item.instructor}</td><td>{item.enrollments}</td><td>{date(item.created_at)}</td></tr>)}</tbody></table></div> : <Empty text="No active ordinary classes match this search." />}<PageLinks section="classes" data={page} q={q} /></section>;
  }
  if (section === "students" || section === "users") {
    if (section === "students" && id && uuid.test(id)) {
      const item = await load<StudentDetail>(`/monitoring/students/${id}`);
      return <><Link href={sectionPath("students")} className="monitor-back">← All students</Link><div className="monitor-detail-head"><div><p className="monitor-kicker">STUDENT DETAILS</p><h2>{item.username}</h2><p>{item.role.replaceAll("_", " ")} · {item.status}</p></div></div>
        <div className="monitor-metrics compact"><Metric label="Submitted captures" value={item.submitted_captures} /><Metric label="WavLM assessments" value={item.wavlm_attempts} /><Metric label="Tutor sessions" value={item.tutor_sessions} /></div>
        <div className="monitor-columns"><section className="monitor-panel"><h3>Current classes</h3>{item.classes.length ? item.classes.map(c => <p key={c.id}><Link href={`/monitoring/classes?id=${c.id}`}>{c.name} →</Link><small> · {c.instructor}</small></p>) : <Empty text="No current ordinary class membership." />}{item.classes_truncated && <p>Showing the first 100 classes.</p>}</section>
        <section className="monitor-panel monitor-soft"><h3>Learning evidence</h3><p>Submission counts include incomplete or review-required captures. Personal tracking and live FSRS review analytics are unavailable.</p><p>WavLM results are model predictions. Open Pronunciation for recorded attempts.</p></section></div></>;
    }
    const role = section === "students" ? "school_student" : "";
    const page = await load<Page<UserRow>>(`/monitoring/users?${new URLSearchParams({ ...(q ? { q } : {}), ...(role ? { role } : {}), offset: String(offset) })}`);
    return <section className="monitor-panel"><Search section={section} q={q} />{section === "users" && <p className="monitor-footnote">Account creation, disabling and permission grants remain operator actions. This page is read-only.</p>}{page.items.length ? <div className="monitor-table-wrap"><table><thead><tr><th>Username</th><th>Role</th><th>Status</th><th>Created</th></tr></thead><tbody>{page.items.map(item => <tr key={item.id}><td>{item.role.includes("student") ? <Link href={`/monitoring/students?id=${item.id}`}>{item.username}</Link> : item.username}</td><td>{item.role.replaceAll("_", " ")}</td><td><span className="monitor-pill">{item.status}</span></td><td>{date(item.created_at)}</td></tr>)}</tbody></table></div> : <Empty text="No accounts match this search." />}<PageLinks section={section} data={page} q={q} /></section>;
  }
  if (section === "learn") {
    const item = await load<{ policy: string; submitted_captures: number; meaning: string; personal_tracking: string }>("/monitoring/learn");
    return <div className="monitor-columns"><Metric label="Submitted classroom captures" value={item.submitted_captures} note={item.policy} /><section className="monitor-panel monitor-soft"><h2>What this count means</h2><p>{item.meaning}</p><p>These submissions do not identify an FSRS-6 or FIFAKT scheduling condition. Their review results are shown separately when real eligible records exist.</p><p>Personal Learning tracking: <strong>{item.personal_tracking}</strong>.</p><p>Correctness, retention, response times and lesson coverage have no approved aggregate in this monitoring contract.</p></section></div>;
  }
  if (section === "fsrs") {
    const item = await load<{ algorithm: string; status: string; reason: string; review_count: number; prediction_quality: null }>("/monitoring/fsrs");
    return <><div className="monitor-metrics compact"><Metric label="Recorded FSRS-6 reviews" value={item.review_count} note="Eligible ordinary classrooms" /></div><section className="monitor-panel monitor-soft"><span className="monitor-pill">{item.status.replaceAll("_", " ")}</span><h2>{item.algorithm}</h2><p>{item.reason}</p><p>Difficulty, stability, retrievability, recall success and prediction quality are not shown without verified learner review evidence and a defined analysis.</p></section></>;
  }
  if (section === "fifakt") {
    const item = await load<{ algorithm: string; status: string; reason: string; simulation_trace_count: number; real_review_count: null }>("/monitoring/fifakt");
    return <><div className="monitor-metrics compact"><Metric label="Real FIFAKT review results" value="Unavailable" note="Model is simulated" /><Metric label="Stored simulation traces" value={item.simulation_trace_count} note="Not learner outcomes" /></div><section className="monitor-panel monitor-soft"><span className="monitor-pill">{item.status.replaceAll("_", " ")}</span><h2>FSRS-6 + FIFAKT prototype</h2><p>{item.reason}</p><p>No effectiveness or retention comparison can be made from these records.</p></section></>;
  }
  if (section === "pronunciation") {
    if (id && uuid.test(id)) {
      const item = await load<AttemptDetail>(`/monitoring/pronunciation/${id}`);
      return <>
        <Link href={sectionPath("pronunciation")} className="monitor-back">← All WavLM assessments</Link>
        <div className="monitor-detail-head"><div><p className="monitor-kicker">UNVALIDATED MODEL PREDICTION</p><h2>{item.overall_score} / 100</h2><p>{item.class_name} · {date(item.attempted_at)}</p></div></div>
        <section className="monitor-panel"><h3>Reference sentence</h3><p>{item.reference_text}</p><p>{item.feedback}</p><p className="monitor-footnote">{item.model_id ?? "WavLM"} · {item.model_version ?? "Version unavailable"} · Processing {item.processing_duration_ms ?? "unknown"} ms.</p></section>
        <section className="monitor-panel"><h3>Word and sound predictions</h3>{item.words.length ? item.words.map((word, index) => <div className="monitor-word" key={`${word.word}-${index}`}><strong>{word.word} · {word.score}/100</strong><div>{word.phonemes.map((phone, i) => <span title={phone.tip ?? undefined} className={phone.error ? "monitor-phone flagged" : "monitor-phone"} key={`${phone.phone}-${i}`}>{phone.phone} {phone.score}{phone.error && phone.tip ? ` · ${phone.tip}` : ""}</span>)}</div></div>) : <Empty text="No word-level results stored for this attempt." />}</section>
      </>;
    }
    const item = await load<{ count: number; attempts: Page<Attempt> }>(`/monitoring/pronunciation?offset=${offset}`);
    return <><div className="monitor-metrics compact"><Metric label="Recorded WavLM assessments" value={item.count} note="Ordinary classrooms only" /></div><section className="monitor-panel"><p className="monitor-footnote">Scores are unvalidated model predictions. Historical simulated results and Tagalog transcript comparisons are excluded.</p>{item.attempts.items.length ? <div className="monitor-table-wrap"><table><thead><tr><th>When</th><th>Class</th><th>Model prediction</th><th>Details</th></tr></thead><tbody>{item.attempts.items.map(a => <tr key={a.id}><td>{date(a.attempted_at)}</td><td>{a.class_name}</td><td>{a.score}/100</td><td><Link href={`/monitoring/pronunciation?id=${a.id}`}>View sounds →</Link></td></tr>)}</tbody></table></div> : <Empty text="No genuine WavLM classroom assessments are stored." />}<PageLinks section="pronunciation" data={item.attempts} /></section></>;
  }
  if (section === "tutor") {
    const item = await load<{ count: number; sessions: Page<TutorSession> }>(`/monitoring/tutor?offset=${offset}`);
    return <><div className="monitor-metrics compact"><Metric label="Tutor sessions" value={item.count} note="Ordinary classrooms only" /></div><section className="monitor-panel"><p className="monitor-footnote">Session metadata only. Conversation messages and inferred proficiency scores are not shown.</p>{item.sessions.items.length ? <div className="monitor-table-wrap"><table><thead><tr><th>Started</th><th>Class</th><th>Status</th></tr></thead><tbody>{item.sessions.items.map(s => <tr key={s.id}><td>{date(s.started_at)}</td><td>{s.class_name}</td><td>{s.status}</td></tr>)}</tbody></table></div> : <Empty text="No eligible Tutor sessions are stored." />}<PageLinks section="tutor" data={item.sessions} /></section></>;
  }
  const item = await load<Status>("/monitoring/status");
  const labels: [string, string][] = [["Backend", item.backend], ["Database", item.database], ["FSRS-6 live monitoring", item.fsrs], ["WavLM service", item.wavlm], ["Groq Tutor", item.groq]];
  return <section className="monitor-panel"><h2>Service readiness</h2><p className="monitor-footnote">{item.note}</p><div className="monitor-status-grid">{labels.map(([label, value]) => <div key={label}><strong>{label}</strong><span className="monitor-pill">{value.replaceAll("_", " ")}</span></div>)}</div></section>;
}

export async function MonitoringScreen({ section, searchParams }: { section: Section; searchParams?: Promise<Params> }) {
  const preview = await localMonitoringPreview();
  const profile: AdminProfile = await requireAdmin(true);
  const permitted = profile.permissions.includes("monitoring.read");
  const params = searchParams ? await searchParams : {};
  const active = nav.find(n => n.id === section) ?? nav[0];
  return <div className="monitor-shell">
    <aside className="monitor-sidebar"><Link href="/dashboard" className="monitor-brand"><span aria-hidden="true">📚</span><strong>fluentt</strong></Link><p className="monitor-side-label">ADMINISTRATION</p>
      <nav aria-label="Administrator monitoring">{nav.map(item => <Link href={sectionPath(item.id)} key={item.id} aria-current={section === item.id ? "page" : undefined}><span aria-hidden="true">{item.icon}</span>{item.label}</Link>)}</nav>
      {(profile.permissions.includes("curriculum.read") || profile.permissions.includes("questions.read")) && <><p className="monitor-side-label">CONTENT TOOLS</p><nav aria-label="Authorized content tools">{profile.permissions.includes("curriculum.read") && <Link href="/curriculum">Curriculum</Link>}{profile.permissions.includes("questions.read") && <Link href="/questions">Question bank</Link>}</nav></>}
      <div className="monitor-side-footer"><p>{preview ? "Viewing on this PC" : "Signed in as"} <strong>{profile.username}</strong></p><p>{preview ? "Read-only local preview" : "Monitoring requires an explicit operator grant."}</p></div>
    </aside><div className="monitor-main"><header className="monitor-topbar"><div><span className="monitor-kicker">FLUENTT / ADMINISTRATION</span><h1>{active.label}</h1></div>{preview ? <span className="monitor-pill">Local read-only preview</span> : <MonitoringAccount username={profile.username} csrf={profile.csrf_token} />}</header>
      <main className="monitor-content"><div className="monitor-intro"><p>{section === "overview" ? "A clear view of the records your classrooms actually produce." : "Read-only monitoring from the FLUENTT backend."}</p><span className="monitor-pill">Ordinary classroom scope</span></div>
        {permitted ? <Content section={section} params={params} /> : <section className="monitor-panel" role="alert"><h2>Monitoring access required</h2><p>An operator must grant <code>monitoring.read</code> to your separate administrator account. Dashboard access alone does not expose learner records.</p></section>}
      </main></div>
  </div>;
}

export type { Section, Params };
