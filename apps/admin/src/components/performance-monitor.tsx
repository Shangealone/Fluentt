"use client";
import { useEffect, useState } from "react";
import { AdminIcon, type IconName } from "./admin-icon";
import { isPerformanceReport, type PerformanceReport } from "@/services/performance-contract";
import styles from "./performance.module.css";

const number = (v: number | undefined) => v === undefined ? "—" : v.toLocaleString();
const when = (v: string | null) => v ? new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(v)) : "No saved activity";
export function PerformanceMonitor({ permitted, preview }: { permitted: boolean; preview: boolean }) {
  const [days, setDays] = useState(30), [draft, setDraft] = useState(""), [q, setQ] = useState(""), [offset, setOffset] = useState(0);
  const [reload, setReload] = useState(0), [focused, setFocused] = useState(true);
  const [result, setResult] = useState<{ key: string; value: PerformanceReport } | null>(null);
  const [problem, setProblem] = useState<{ key: string; text: string } | null>(null);
  const key = `${days}:${offset}:${q}:${reload}`;
  const data = focused && result?.key === key ? result.value : null;
  const error = problem?.key === key ? problem.text : "";
  useEffect(() => {
    const hide = () => { setFocused(false); setResult(null); setProblem(null); };
    const focus = () => { if (!document.hidden) setFocused(true); };
    const visibility = () => document.hidden ? hide() : focus();
    window.addEventListener("blur", hide); window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", visibility); visibility();
    return () => { window.removeEventListener("blur", hide); window.removeEventListener("focus", focus); document.removeEventListener("visibilitychange", visibility); };
  }, []);
  useEffect(() => {
    if (!permitted || preview || !focused) return;
    const controller = new AbortController(); let active = true;
    void (async () => {
      try {
        const response = await fetch(`/api/admin/performance?${new URLSearchParams({ days: String(days), q, offset: String(offset) })}`,
          { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(40000)]) });
        if (!active) return;
        if (response.status === 401) { window.location.replace("/login?expired=1"); return; }
        if (response.status === 403) throw new Error("An operator must grant performance.read to this account.");
        if (!response.ok) throw new Error("We couldn’t load learner activity. Refresh to try again.");
        const value: unknown = await response.json();
        if (!isPerformanceReport(value)) throw new Error("Monitoring returned an unexpected response. Please retry.");
        if (active) { setResult({ key, value }); setProblem(null); }
      } catch (cause) { if (active) { setResult(null); setProblem({ key, text: cause instanceof Error ? cause.message : "Monitoring is unavailable." }); } }
    })();
    return () => { active = false; controller.abort(); };
  }, [days, q, offset, reload, key, permitted, preview, focused]);
  const unavailable = preview ? "Preview mode · live learner data is not connected" : !permitted ? "Performance access required · ask your operator for read access" : error;
  const busy = permitted && !preview && focused && !data && !error;
  const metrics: { label: string; value?: number; caption: string; icon: IconName; tone: string }[] = [
    { label: "Personal learners", value: data?.learners, caption: "Current active profiles", icon: "users", tone: "navy" },
    { label: "Learn answers checked", value: data?.counts.learn_question, caption: "Recorded answer checks", icon: "book", tone: "teal" },
    { label: "Voice phrases completed", value: data?.counts.voice_phrase, caption: "Recognized or assessed phrases", icon: "mic", tone: "rose" },
    { label: "Tutor exchanges", value: data?.counts.tutor_reply, caption: "Accepted learner replies", icon: "chat", tone: "navy" },
  ];
  const max = Math.max(1, ...(data?.timeline.map(day => day.count) ?? []));
  return <>
    <div className={styles.toolbar}>
      <div className={styles.period} aria-label="Activity period">{[7, 30, 90].map(d => <button key={d} aria-pressed={d === days} onClick={() => { setDays(d); setOffset(0); }}>{d} days</button>)}</div>
      <button className={styles.refresh} onClick={() => setReload(v => v + 1)} disabled={preview || !permitted || busy}><AdminIcon name="clock" size={16} />{busy ? "Loading…" : "Refresh activity"}</button>
    </div>
    {!!unavailable && <div className={styles.notice} role={error ? "alert" : "status"}><AdminIcon name="shield" />{unavailable}{!!error && <button onClick={() => setReload(v => v + 1)}>Retry</button>}</div>}
    {!focused && permitted && !preview && <p role="status">Return to this window to refresh protected learner records.</p>}
    <div className={styles.metrics} aria-busy={busy}>{metrics.map(m => <article className={styles.metric} key={m.label}>
      <span className={`${styles.icon} ${styles[m.tone]}`}><AdminIcon name={m.icon} /></span><p>{m.label}</p><strong>{number(m.value)}</strong><small>{m.caption}</small>
    </article>)}</div>
    <section className={styles.card} aria-labelledby="activity-heading" id="activity">
      <div className={styles.cardHeading}><div><p className={styles.eyebrow}>Practice activity</p><h2 id="activity-heading">A clearer view of participation.</h2><p>Saved events across Learn, Voice, and Tutor · UTC</p></div><span className={styles.pill}>{number(data?.learners_with_activity)} learners with activity</span></div>
      {data && data.timeline.some(day => day.count > 0) ? <div className={styles.chart} role="img" aria-label="Daily saved activity. Exact dates and counts follow.">
        {data.timeline.map(day => <div className={styles.barColumn} key={day.date}><span>{day.count}</span><div className={styles.bar} style={{ height: `${day.count / max * 100}%` }} /><small>{when(day.date)}</small></div>)}
      </div> : <div className={styles.chartEmpty}><AdminIcon name="book" size={30} /><strong>{busy ? "Loading activity…" : "Activity will appear here"}</strong><p>{data ? "No practice events were saved in this period." : "Connect authorized learner records to see the activity timeline."}</p></div>}
      {data && <details className={styles.explanation}><summary>View exact activity counts</summary><ul>{data.timeline.map(day => <li key={day.date}>{day.date}: {day.count} saved events</li>)}</ul></details>}
      <p className={styles.caption}>Activity records show participation. They do not measure accuracy, mastery, or a verified pronunciation score.</p>
    </section>
    <section className={styles.card} aria-labelledby="learners-heading" id="learners">
      <div className={styles.cardHeading}><div><p className={styles.eyebrow}>Learner directory</p><h2 id="learners-heading">See each learner’s activity.</h2><p>Current personal learners · selected {days}-day period</p></div>
        <form className={styles.search} onSubmit={e => { e.preventDefault(); setQ(draft.trim()); setOffset(0); setReload(v => v + 1); }}><label className={styles.srOnly} htmlFor="learner-search">Search learner username</label><input id="learner-search" value={draft} onChange={e => setDraft(e.target.value)} maxLength={100} placeholder="Search learners…" /><button type="submit">Search</button></form>
      </div>
      <p className={styles.caption}>Search filters this directory. Overview totals include all current active personal learners in the selected period.</p>
      <div className={styles.tableWrap}><table><thead><tr><th scope="col">Learner</th><th scope="col">Learn checks</th><th scope="col">Voice phrases</th><th scope="col">Tutor replies</th><th scope="col">Last saved activity</th></tr></thead><tbody>
        {data?.items.map(row => <tr key={row.id}><th scope="row"><details><summary className={styles.learner}><span className={styles.avatar}>{row.username.slice(0, 1).toUpperCase()}</span>{row.username}</summary><p className={styles.caption}>Lessons recorded: {row.learn_lesson}<br />Tutor sessions ended: {row.tutor_session}<br />Counts are client-reported activity.</p></details></th><td>{row.learn_question}</td><td>{row.voice_phrase}</td><td>{row.tutor_reply}</td><td>{when(row.last_activity)}</td></tr>)}
        {!data?.items.length && <tr><td colSpan={5} className={styles.emptyRow}>{busy ? "Loading learners…" : data ? q ? "No matching learners. Try another username." : "No active personal learners yet." : "Learner records are unavailable."}</td></tr>}
      </tbody></table></div>
      <div className={styles.pagination}><span>{data ? data.items.length ? `Showing ${offset + 1}–${offset + data.items.length}` : "No matching records" : "No records loaded"}</span><div><button disabled={!data || offset === 0} onClick={() => setOffset(v => Math.max(0, v - 20))}>Previous</button><button disabled={!data?.has_more} onClick={() => setOffset(v => v + 20)}>Next</button></div></div>
    </section>
    <div className={styles.coverage}><AdminIcon name="shield" /><div><strong>Clear evidence. Appropriate access.</strong><p>Only recorded personal activity is shown. Pronunciation scores and learning accuracy are unavailable because they are not retained in this history. Classroom results stay in the instructor’s class monitoring; consent-gated study records stay in Research.</p>{data && <small>Snapshot: {new Date(data.as_of).toLocaleString("en", { timeZone: "UTC" })} UTC · {data.metric_version}</small>}</div></div>
  </>;
}
