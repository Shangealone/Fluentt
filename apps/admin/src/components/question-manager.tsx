"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AdminSession } from "./admin-session";
import { Button } from "./ui";
import { QuestionPreview, QuestionEditor } from "./question-editor";
import { isAdminProfile, type AdminProfile } from "@/services/admin-contract";
import { definitionFromDraft, draftFromDefinition, isItem, isRevision, methodName, methods, newDraft,
  publicDefinition, validateDraft, saveNeedsReconciliation, type AuthorMethod, type Definition, type Draft, type Item, type Page,
  type PublicDefinition, type Revision } from "@/services/questions-contract";

const base = "/api/admin/questions";
type Editor = { mode: "Create" | "Edit draft" | "New revision of"; row: Revision | null; draft: Draft };
type History = { id: string; version: number; locked_at: string | null; definition: { method: string; prompt: string } };
class RequestError extends Error {
  constructor(message: string, public status: number, public fields: Record<string, string> = {}) { super(message); }
}
function revisionPath(row: Revision) { return `${base}/${row.question_id}/revisions/${row.id}`; }

export function QuestionManager({ initial }: { initial: AdminProfile }) {
  const [profile, setProfile] = useState(initial), [method, setMethod] = useState<AuthorMethod>("multiple_choice");
  const [search, setSearch] = useState(""), [status, setStatus] = useState("");
  const [items, setItems] = useState<Item[]>([]), [offset, setOffset] = useState(0), [more, setMore] = useState(false);
  const [history, setHistory] = useState<History[]>([]), [historyPage, setHistoryPage] = useState(0), [historyMore, setHistoryMore] = useState(false);
  const [current, setCurrent] = useState<Revision | null>(null), [selected, setSelected] = useState<string | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null), [dirty, setDirty] = useState(false);
  const [preview, setPreview] = useState<PublicDefinition | null>(null), [previewKey, setPreviewKey] = useState(0);
  const [flashcardBack, setFlashcardBack] = useState<string | undefined>();
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [gate, setGate] = useState(false);
  const [error, setError] = useState(""), [notice, setNotice] = useState(""), [fields, setFields] = useState<Record<string, string>>({});
  const [uncertain, setUncertain] = useState(false), [confirmation, setConfirmation] = useState("");
  const resolver = useRef<((answer: boolean) => void) | null>(null), cancel = useRef<HTMLButtonElement>(null);
  const pending = useRef(false), generation = useRef(0), mounted = useRef(true), controller = useRef<AbortController | null>(null);
  const canWrite = profile.permissions.includes("questions.write"), canPublish = canWrite && profile.permissions.includes("questions.publish");
  const clear = useCallback(() => { generation.current++; controller.current?.abort(); setItems([]); setHistory([]); setCurrent(null); setSelected(null); setLoading(false);
    setEditor(null); setPreview(null); setFlashcardBack(undefined); setDirty(false); setFields({}); }, []);
  const ask = useCallback((message: string) => new Promise<boolean>(resolve => { resolver.current?.(false); resolver.current = resolve; setConfirmation(message); }), []);
  function answer(value: boolean) { const resolve = resolver.current; resolver.current = null; setConfirmation(""); resolve?.(value); }
  const leave = useCallback(async () => !pending.current && (!dirty || await ask("Discard unsaved question changes?")), [dirty, ask]);
  useEffect(() => { if (confirmation) { const before = document.activeElement as HTMLElement; cancel.current?.focus(); return () => { if (before?.isConnected) before.focus(); }; } }, [confirmation]);

  const api = useCallback(async (path: string, init: RequestInit = {}, signal?: AbortSignal): Promise<unknown> => {
    const response = await fetch(path, { ...init, cache: "no-store", signal: signal ?? AbortSignal.timeout(25000) });
    if (response.status === 401 || response.status === 403) {
      clear(); setGate(true); resolver.current?.(false); resolver.current = null; setConfirmation("");
      if (response.status === 401) window.location.replace("/login?expired=1");
      throw new RequestError(response.status === 401 ? "Session ended. Sign in again." : "Access denied. Ask your operator to review question permissions or refresh the session.", response.status);
    }
    const data = await response.json();
    if (!response.ok) {
      const errors: Record<string, string> = {};
      for (const detail of data?.error?.details ?? []) {
        const loc: (string | number)[] = detail.location ?? [];
        const option = loc.includes("items") ? loc.indexOf("items") : loc.includes("tokens") ? loc.indexOf("tokens") : loc.indexOf("options");
        const side = loc.includes("left") ? "left" : loc.includes("right") ? "right" : null;
        const key = side ? typeof loc[loc.indexOf(side) + 1] === "number" ? `${side}_${loc[loc.indexOf(side) + 1]}` : side
          : loc.includes("cue") ? "cue" : loc.includes("back") ? "back" : loc.includes("pairs") ? "pairs" : option >= 0 && typeof loc[option + 1] === "number" ? `option_${loc[option + 1]}`
          : loc.includes("input_max_length") ? "inputLimit" : loc.includes("template_syntax") || loc.includes("blank_ids") ? "blanks"
          : loc.includes("ordered_ids") ? "order" : loc.includes("accepted_corrections") ? "corrections" : loc.includes("accepted_answers") ? "acceptedAnswers" : loc.includes("answer_key") ? "correct" : loc.includes("competency_ids") ? "competencies" : String(loc.at(-1));
        errors[key] = "Check this field against the question contract.";
      }
      if (data?.error?.code === "invalid_question_relationship") {
        errors.lesson_id = data.error.message; errors.competencies = data.error.message;
      }
      throw new RequestError(data?.error?.message ?? "Request failed. Reload before retrying.", response.status, errors);
    }
    return data;
  }, [clear]);

  const verify = useCallback(async () => {
    const data = await api("/api/admin/me");
    if (!isAdminProfile(data) || !data.permissions.includes("questions.read")) {
      clear(); setGate(true); throw new Error("Question Bank access is unavailable.");
    }
    setProfile(data);
    if (!data.permissions.includes("questions.write")) { setEditor(null); setDirty(false); setPreview(null); setFlashcardBack(undefined); }
    setGate(false); return data;
  }, [api, clear]);

  const load = useCallback(async (itemId: string | null = null, revisionId?: string, page = 0) => {
    controller.current?.abort(); const abort = new AbortController(); controller.current = abort;
    const ticket = ++generation.current;
    setLoading(true); setError(""); setCurrent(null); setHistory([]); setPreview(null); setFlashcardBack(undefined); setEditor(null); setDirty(false); setUncertain(false);
    setSelected(itemId); if (!itemId) setItems([]);
    try {
      await verify();
      if (itemId) {
        const data = await api(`${base}/${itemId}/revisions?limit=20&offset=${page}`, {}, abort.signal) as Page<History>;
        if (!Array.isArray(data.items) || data.items.some(row => typeof row.id !== "string" || !row.definition || typeof row.definition.method !== "string")) throw new Error("Invalid history response.");
        const chosen = revisionId ?? data.items.find(row => methods.includes(row.definition.method as AuthorMethod))?.id;
        const row = chosen ? await api(`${base}/${itemId}/revisions/${chosen}`, {}, abort.signal) : null;
        if (row && !isRevision(row)) throw new Error("This revision cannot be presented by the ten-method editor.");
        if (!mounted.current || ticket !== generation.current) return;
        setSelected(itemId); setHistory(data.items); setHistoryMore(data.has_more); setHistoryPage(page); setCurrent(row as Revision | null);
      } else {
        setItems([]);
        const params = new URLSearchParams({ method, q: search, offset: String(page), limit: "20" });
        if (status) params.set("status", status);
        const data = await api(`${base}?${params}`, {}, abort.signal) as Page<Item>;
        if (!Array.isArray(data.items) || !data.items.every(isItem)) throw new Error("Invalid question collection.");
        if (!mounted.current || ticket !== generation.current) return;
        setSelected(null); setItems(data.items); setOffset(page); setMore(data.has_more);
      }
    } catch (cause) { if (mounted.current && !abort.signal.aborted) setError(cause instanceof Error ? cause.message : "Unable to load questions."); }
    finally { if (mounted.current && ticket === generation.current) setLoading(false); }
  }, [api, method, search, status, verify]);

  // Only the initial read is automatic; changing filters never silently discards a form.
  const initialLoad = useRef(load);
  useEffect(() => { mounted.current = true; let cancelled = false;
    queueMicrotask(() => { if (!cancelled) void initialLoad.current(); });
    return () => { cancelled = true; mounted.current = false; controller.current?.abort(); resolver.current?.(false); };
  }, []);
  useEffect(() => {
    const back = (event: Event) => {
      if (!dirty && !pending.current) return;
      event.preventDefault();
      void leave().then(ok => { if (ok) (event as CustomEvent<{ proceed: () => void }>).detail.proceed(); });
    };
    document.addEventListener("fluentt:before-back", back);
    return () => document.removeEventListener("fluentt:before-back", back);
  }, [dirty, leave]);

  useEffect(() => {
    const before = (event: BeforeUnloadEvent) => { if (dirty || pending.current) event.preventDefault(); };
    const navigation = (event: MouseEvent) => {
      const link = (event.target as HTMLElement).closest("a");
      if (!link || event.ctrlKey || event.metaKey || event.shiftKey || link.target === "_blank" || !dirty) return;
      event.preventDefault(); void leave().then(ok => { if (ok) window.location.assign(link.href); });
    };
    window.addEventListener("beforeunload", before); document.addEventListener("click", navigation, true);
    return () => { window.removeEventListener("beforeunload", before); document.removeEventListener("click", navigation, true); };
  }, [dirty, leave]);
  useEffect(() => {
    async function check() { if (document.visibilityState !== "visible") { setGate(true); return; }
      setGate(true); try { await verify(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Session verification unavailable."); } }
    const timer = setTimeout(() => { void check(); }, Math.max(0, Date.parse(profile.expires_at) - Date.now() + 250));
    const restored = (event: PageTransitionEvent) => { if (event.persisted) void check(); };
    document.addEventListener("visibilitychange", check); window.addEventListener("pageshow", restored);
    return () => { clearTimeout(timer); document.removeEventListener("visibilitychange", check); window.removeEventListener("pageshow", restored); };
  }, [profile.expires_at, verify]);

  async function edit(row: Revision | null, newVersion = false) {
    if (!await leave() || !canWrite) return;
    setError(""); setPreview(null); setFlashcardBack(undefined); setFields({}); setBusy(true); pending.current = true;
    const ticket = generation.current;
    try {
      const live = await verify();
      if (!live.permissions.includes("questions.write")) throw new Error("Editor permission is required.");
      let draft = newDraft(method);
      if (row) {
        const data = await api(revisionPath(row) + "/key") as { revision: string; definition: Definition };
        if (!data.definition || !isRevision({ ...row, revision: data.revision, definition: data.definition })) throw new Error("Invalid private definition.");
        draft = draftFromDefinition(data.definition);
        if (Object.keys(validateDraft(draft)).length) throw new Error("Stored definition needs operator review before editing.");
        row = { ...row, revision: data.revision };
      }
      if (!mounted.current || ticket !== generation.current) return;
      setEditor({ mode: row ? newVersion ? "New revision of" : "Edit draft" : "Create", row, draft }); setDirty(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to open editor."); }
    finally { pending.current = false; if (mounted.current) setBusy(false); }
  }
  function draftPreview() {
    if (!editor) return;
    const errors = validateDraft(editor.draft); setFields(errors);
    if (Object.keys(errors).length) { setError("Complete the marked fields before previewing."); return; }
    const definition = definitionFromDraft(editor.draft);
    setPreview(publicDefinition(definition)); setFlashcardBack(definition.method === "flashcards" ? definition.answer_key.back : undefined);
    setPreviewKey(key => key + 1); setError("");
  }
  async function savedPreview() {
    if (!current || pending.current || !await leave()) return;
    const row = current, ticket = generation.current;
    pending.current = true; setBusy(true); setError(""); setPreview(null); setFlashcardBack(undefined); setEditor(null); setDirty(false);
    try {
      const live = await verify();
      let back: string | undefined;
      if (row.definition.method === "flashcards" && live.permissions.includes("questions.write")) {
        const data = await api(revisionPath(row) + "/key") as { id: string; revision: string; definition: Definition };
        if (data.id !== row.id || data.revision !== row.revision || data.definition?.method !== "flashcards"
          || typeof data.definition.answer_key?.back !== "string" || !data.definition.answer_key.back.trim())
          throw new Error("The version changed or its private back is invalid. Reload before previewing.");
        back = data.definition.answer_key.back;
      }
      if (!mounted.current || ticket !== generation.current) return;
      setPreview(publicDefinition(row.definition)); setFlashcardBack(back); setPreviewKey(key => key + 1);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to verify preview access."); }
    finally { pending.current = false; if (mounted.current) setBusy(false); }
  }
  async function save() {
    if (!editor || pending.current || uncertain) return;
    const errors = validateDraft(editor.draft); setFields(errors);
    if (Object.keys(errors).length) { setError("Complete the marked fields before saving."); return; }
    pending.current = true; setBusy(true); setError(""); const ticket = generation.current;
    try {
      const body = JSON.stringify(definitionFromDraft(editor.draft));
      const target = !editor.row ? base : editor.mode === "Edit draft" ? revisionPath(editor.row) : `${base}/${editor.row.question_id}/revisions`;
      const result = await api(target, { method: editor.mode === "Edit draft" ? "PUT" : "POST", body,
        headers: { "Content-Type": "application/json", "X-CSRF-Token": profile.csrf_token, ...(editor.row ? { "If-Match": editor.row.revision } : {}) } });
      if (!isRevision(result)) throw new Error("Save response was invalid; reconcile the stored version before retrying.");
      if (!mounted.current || ticket !== generation.current) return;
      setDirty(false); setEditor(null); setNotice("Draft saved in the question bank.");
      await load(result.question_id, result.id);
    } catch (cause) {
      if (saveNeedsReconciliation(cause instanceof RequestError ? cause.status : undefined)) {
        setError("Save could not be confirmed. Reload and check the bank/history before another save."); setUncertain(true);
      } else if (cause instanceof RequestError) { setError(cause.message); setFields(cause.fields); }
    } finally { pending.current = false; if (mounted.current) setBusy(false); }
  }
  async function transition(action: "publish" | "retire") {
    if (!current || pending.current || dirty || !await ask(action === "publish" ? "Publish and freeze this question revision? Confirm you reviewed the correct answer." : "Retire the whole item and preserve its history?")) return;
    pending.current = true; setBusy(true); setError("");
    const row = current;
    try {
      const ticket = generation.current;
      await api(action === "publish" ? revisionPath(row) + "/publish" : `${base}/${row.question_id}/retire`,
        { method: "POST", headers: { "X-CSRF-Token": profile.csrf_token, "If-Match": row.revision } });
      if (!mounted.current || ticket !== generation.current) return;
      setNotice(action === "publish" ? "Revision published and frozen. It is not available to learners through this preview." : "Item retired. History is retained.");
      await load(row.question_id, row.id, historyPage);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Action unavailable. Reload to reconcile."); }
    finally { pending.current = false; if (mounted.current) setBusy(false); }
  }
  return <>
    <AdminSession initial={profile} beforeLogout={async () => { const allowed = await leave(); if (allowed) { clear(); setGate(true); } return allowed; }} />
    <p>Administrator authoring and unscored preview only. All ten methods are supported. No learner delivery, saved practice history or grading.</p>
    {confirmation && <div className="confirmation-overlay"><section role="alertdialog" aria-modal="true" aria-labelledby="question-confirm-title" className="card confirmation-dialog"
      onKeyDown={event => { if (event.key === "Escape") answer(false); if (event.key === "Tab") { event.preventDefault(); const buttons = event.currentTarget.querySelectorAll("button"); const index = Array.from(buttons).indexOf(document.activeElement as HTMLButtonElement); buttons[(index + (event.shiftKey ? buttons.length - 1 : 1)) % buttons.length]?.focus(); } }}>
      <h2 id="question-confirm-title">Confirm question action</h2><p>{confirmation}</p><div className="account-actions"><button className="button" ref={cancel} onClick={() => answer(false)}>Keep current state</button><Button onClick={() => answer(true)}>Confirm</Button></div></section></div>}
    {notice && <p role="status">{notice}</p>}{error && <p role="alert" className="error">{error}</p>}
    {gate ? <section><p>Question data is hidden until access is verified.</p><Button disabled={busy} onClick={() => void verify().catch(cause => setError(cause.message))}>Verify question access</Button></section>
      : <>
        <div className="account-actions"><Button disabled={busy || loading} onClick={async () => { if (await leave()) void load(); }}>Reload question bank</Button>
          {canWrite && <Button disabled={busy || loading} onClick={() => void edit(null)}>Create {methodName(method)}</Button>}</div>
        {!selected && <form className="collection-filter" onSubmit={async event => { event.preventDefault(); if (await leave()) void load(); }}>
          <label>Answer method<select className="input" value={method} onChange={event => setMethod(event.target.value as AuthorMethod)}>{methods.map(value => <option key={value} value={value}>{methodName(value)}</option>)}</select></label>
          <label>Find prompt<input className="input" maxLength={200} value={search} onChange={event => setSearch(event.target.value)} /></label>
          <label>Item lifecycle<select className="input" value={status} onChange={event => setStatus(event.target.value)}><option value="">All states</option><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Retired</option></select></label>
          <Button disabled={busy || loading}>Apply filters</Button></form>}
        {loading ? <p role="status">Loading authorized question data…</p> : <>
          {!selected ? <section aria-label="Question bank items"><ul className="curriculum-list">{items.map(item => <li key={item.id}><button disabled={busy} onClick={async () => { if (await leave()) void load(item.id); }}>{item.prompt ?? "No revision"}</button><span>{item.status} · Latest revision {item.latest_version ?? "none"}</span></li>)}</ul>
            {!items.length && <p>No questions match this collection. No sample records have been added.</p>}
            <div className="account-actions"><Button disabled={busy || !offset} onClick={async () => { if (await leave()) void load(null, undefined, offset - 20); }}>Previous page</Button><span>Page {Math.floor(offset / 20) + 1}</span>
              <Button disabled={busy || !more} onClick={async () => { if (await leave()) void load(null, undefined, offset + 20); }}>Next page</Button></div></section>
            : <section aria-label="Question revision history"><h2>Revision history</h2><ul className="curriculum-list">{history.map(row => <li key={row.id}><button disabled={busy || !methods.includes(row.definition.method as AuthorMethod)}
              onClick={async () => { if (await leave()) void load(selected, row.id, historyPage); }}>Version {row.version}: {methodName(row.definition.method)}</button><span>{row.locked_at ? "Published, frozen" : "Draft"}</span></li>)}</ul>
              {!history.length && <p>No revisions exist.</p>}<div className="account-actions"><Button disabled={busy || !historyPage} onClick={async () => { if (await leave()) void load(selected, undefined, historyPage - 20); }}>Previous revisions</Button>
                <Button disabled={busy || !historyMore} onClick={async () => { if (await leave()) void load(selected, undefined, historyPage + 20); }}>Next revisions</Button></div></section>}
          {current && <section className="card"><h2>Version {current.version} · {current.locked_at ? "Published, frozen" : "Draft"}</h2><p>Item state: {current.status}</p><p className="resource-id">Revision ID: {current.id}</p><p className="resource-id">Lesson ID: {current.definition.lesson_id}</p>
            <div className="account-actions"><Button disabled={busy} onClick={() => void savedPreview()}>Preview saved version</Button>
              {canWrite && current.status !== "archived" && <><Button disabled={busy || !!current.locked_at} onClick={() => void edit(current)}>Edit draft</Button><Button disabled={busy} onClick={() => void edit(current, true)}>Create new revision</Button></>}
              {canPublish && current.status !== "archived" && <><Button disabled={busy || dirty || !!current.locked_at} onClick={() => void transition("publish")}>Publish revision</Button><Button disabled={busy || dirty} onClick={() => void transition("retire")}>Retire whole item</Button></>}</div></section>}
        </>}
        {editor && canWrite && <QuestionEditor draft={editor.draft} errors={fields} mode={editor.mode} busy={busy || uncertain} onChange={draft => { setEditor({ ...editor, draft }); setDirty(true); setPreview(null); setFlashcardBack(undefined); }}
          onSave={() => void save()} onPreview={draftPreview} onCancel={async () => { if (await leave()) { setEditor(null); setDirty(false); setPreview(null); setFlashcardBack(undefined); setUncertain(false); } }} />}
        {preview && <QuestionPreview key={previewKey} definition={preview} flashcardBack={flashcardBack} />}
      </>}
  </>;
}
