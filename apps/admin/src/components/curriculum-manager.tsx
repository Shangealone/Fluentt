"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { AdminSession } from "./admin-session";
import { Button, Card } from "./ui";
import { isAdminProfile, type AdminProfile } from "@/services/admin-contract";
import { childKind, fields, isNode, kinds, labels, nodeName, type CurriculumNode, type CurriculumPage, type Kind } from "@/services/curriculum-contract";

const base = "/api/admin/curriculum/manage";
type Selection = { kind: Kind; id: string } | null;
type Editor = { kind: Kind; record: CurriculumNode | null; parent: CurriculumNode | null };
type Crumb = { kind: Kind; id: string; name: string };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function CurriculumManager({ initial }: { initial: AdminProfile }) {
  const [profile, setProfile] = useState(initial);
  const [rootKind, setRootKind] = useState<Kind>("versions");
  const [selection, setSelection] = useState<Selection>(null);
  const [selected, setSelected] = useState<CurriculumNode | null>(null);
  const [crumbs, setCrumbs] = useState<Crumb[]>([]);
  const [rows, setRows] = useState<CurriculumNode[]>([]);
  const [offset, setOffset] = useState(0);
  const [more, setMore] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [gate, setGate] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editor, setEditor] = useState<Editor | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [destination, setDestination] = useState("");
  const [target, setTarget] = useState<CurriculumNode | null>(null);
  const [subjects, setSubjects] = useState<CurriculumNode[]>([]);
  const [subjectSearch, setSubjectSearch] = useState("");
  const [subjectOffset, setSubjectOffset] = useState(0);
  const [subjectMore, setSubjectMore] = useState(false);
  const [review, setReview] = useState({ source_reference: "", licensing_reference: "", review_note: "", confirmed: false });
  const [confirmation, setConfirmation] = useState("");
  const confirmResolver = useRef<((accepted: boolean) => void) | null>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const pending = useRef(false);
  const generation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const collection = selected ? childKind(selected.kind) : rootKind;
  const canWrite = profile.permissions.includes("curriculum.write");
  const canPublish = canWrite && profile.permissions.includes("curriculum.publish");
  const ask = useCallback((message: string) => new Promise<boolean>(resolve => {
    confirmResolver.current?.(false); confirmResolver.current = resolve; setConfirmation(message);
  }), []);
  function answer(accepted: boolean) {
    const resolve = confirmResolver.current; confirmResolver.current = null; setConfirmation(""); resolve?.(accepted);
  }
  useEffect(() => {
    if (!confirmation) return;
    const previous = document.activeElement as HTMLElement | null;
    cancelButton.current?.focus();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, [confirmation]);

  const api = useCallback(async (path: string, init: RequestInit = {}, signal?: AbortSignal): Promise<unknown> => {
    const result = await fetch(path, { ...init, cache: "no-store", signal: signal ?? AbortSignal.timeout(20000) });
    if (result.status === 401 || result.status === 403) {
      generation.current++; controller.current?.abort();
      confirmResolver.current?.(false); confirmResolver.current = null; setConfirmation("");
      setRows([]); setSelected(null); setEditor(null); setValues({}); setSubjects([]); setCrumbs([]); setGate(true);
      if (result.status === 401) window.location.replace("/login?expired=1");
      throw new Error(result.status === 401 ? "Your session ended. Sign in again." : "Permission denied. Ask your operator to review your curriculum access.");
    }
    const data = await result.json();
    if (!result.ok) throw new Error(data?.error?.message ?? "The request failed. Reload before trying again.");
    return data;
  }, []);

  const verify = useCallback(async () => {
    const data = await api("/api/admin/me");
    if (!isAdminProfile(data) || !data.permissions.includes("curriculum.read")) {
      setGate(true); setRows([]); setSelected(null); setEditor(null); setValues({}); setSubjects([]);
      throw new Error("Curriculum access is unavailable.");
    }
    setProfile(data); return data;
  }, [api]);

  const load = useCallback(async (next: Selection, root: Kind, page = 0, q = "", lifecycle = "") => {
    controller.current?.abort(); const abort = new AbortController(); controller.current = abort;
    const current = ++generation.current;
    setLoading(true); setError(""); setRows([]); setSelected(null);
    try {
      await verify();
      const record = next ? await api(`${base}/${next.kind}/${next.id}`, {}, abort.signal) : null;
      if (record && !isNode(record)) throw new Error("Invalid record response. Retry loading.");
      const node = record as CurriculumNode | null;
      const kind = node ? childKind(node.kind) : root;
      let pageData: CurriculumPage = { items: [], has_more: false, limit: 25, offset: page };
      if (kind) {
        const query = new URLSearchParams({ limit: "25", offset: String(page), q });
        if (node) query.set("parent_id", node.id);
        if (lifecycle && ["versions", "topics", "lessons"].includes(kind)) query.set("status", lifecycle);
        pageData = await api(`${base}/${kind}?${query}`, {}, abort.signal) as CurriculumPage;
        if (!Array.isArray(pageData.items) || !pageData.items.every(isNode)) throw new Error("Invalid collection response.");
      }
      if (!mounted.current || current !== generation.current) return;
      setSelected(node); setRows(pageData.items); setMore(pageData.has_more); setOffset(page); setGate(false);
      if (node) setCrumbs(previous => previous.map(crumb => crumb.id === node.id ? { ...crumb, name: nodeName(node) } : crumb));
    } catch (cause) {
      if (mounted.current && !abort.signal.aborted) setError(cause instanceof Error ? cause.message : "Unable to load curriculum. Retry.");
    } finally { if (mounted.current && current === generation.current) setLoading(false); }
  }, [api, verify]);

  useEffect(() => {
    mounted.current = true; let cancelled = false;
    // Defer the initial network read; Strict Mode can cancel its abandoned mount.
    queueMicrotask(() => { if (!cancelled) void load(null, "versions"); });
    return () => { cancelled = true; mounted.current = false; controller.current?.abort(); };
  }, [load]);

  useEffect(() => {
    const back = (event: Event) => {
      if (!dirty && !busy) return;
      event.preventDefault();
      if (busy) return;
      void ask("Discard your unsaved curriculum changes?").then(accepted => {
        if (accepted) (event as CustomEvent<{ proceed: () => void }>).detail.proceed();
      });
    };
    document.addEventListener("fluentt:before-back", back);
    return () => document.removeEventListener("fluentt:before-back", back);
  }, [dirty, busy, ask]);

  useEffect(() => {
    if (!dirty) return;
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const navigate = (event: MouseEvent) => {
      const link = (event.target as Element).closest("a[href]");
      if (link && !event.ctrlKey && !event.metaKey && !event.shiftKey && event.button === 0) {
        event.preventDefault();
        void ask("Discard your unsaved curriculum changes?").then(accepted => {
          if (accepted) { window.removeEventListener("beforeunload", unload); window.location.assign((link as HTMLAnchorElement).href); }
        });
      }
    };
    window.addEventListener("beforeunload", unload); document.addEventListener("click", navigate, true);
    return () => { window.removeEventListener("beforeunload", unload); document.removeEventListener("click", navigate, true); };
  }, [dirty, ask]);

  useEffect(() => {
    let active = true;
    const check = async () => {
      setGate(true);
      try { await verify(); if (active) setGate(false); }
      catch (cause) { if (active) { setRows([]); setSelected(null); setEditor(null); setValues({}); setError(cause instanceof Error ? cause.message : "Session verification failed."); } }
    };
    const focus = () => { if (document.visibilityState === "visible") void check(); };
    const restored = (event: PageTransitionEvent) => { if (event.persisted) void check(); };
    const timer = setTimeout(() => void check(), Math.max(0, Date.parse(profile.expires_at)-Date.now()+250));
    document.addEventListener("visibilitychange", focus); window.addEventListener("pageshow", restored);
    return () => { active = false; clearTimeout(timer); document.removeEventListener("visibilitychange", focus); window.removeEventListener("pageshow", restored); };
  }, [verify, profile.expires_at]);

  async function leave() {
    if (dirty && !await ask("Discard your unsaved curriculum changes?")) return false;
    setEditor(null); setDirty(false); setReview({ source_reference: "", licensing_reference: "", review_note: "", confirmed: false });
    setNotice(""); setTarget(null); setDestination(""); return true;
  }
  async function navigate(next: Selection, root = rootKind, history = crumbs) {
    if (pending.current || !await leave()) return;
    setSelection(next); setRootKind(root); setCrumbs(history); setSearch(""); setStatus("");
    void load(next, root);
  }
  async function subjectOptions(q: string, page: number) {
    try {
      const data = await api(`${base}/global-subjects?${new URLSearchParams({ q, offset: String(page), limit: "25" })}`) as CurriculumPage;
      if (!data.items.every(isNode)) throw new Error("Invalid subject list.");
      setSubjects(data.items); setSubjectMore(data.has_more); setSubjectOffset(page);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load subjects."); }
  }
  async function startEdit(kind: Kind, record: CurriculumNode | null, parent: CurriculumNode | null) {
    if (!await leave()) return;
    setEditor({ kind, record, parent }); setError("");
    setValues(Object.fromEntries(fields[kind].map(field => [field.key, String(record?.values[field.key] ?? "")])));
    if (kind === "subjects") { setSubjectSearch(""); void subjectOptions("", 0); }
  }

  async function mutate(path: string, method: string, body?: unknown, revision?: string, next = selection) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(""); setNotice("");
    try {
      const headers: Record<string, string> = { "X-CSRF-Token": profile.csrf_token };
      if (revision) headers["If-Match"] = revision;
      if (body !== undefined) headers["Content-Type"] = "application/json";
      await api(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
      if (!mounted.current) return;
      setEditor(null); setDirty(false); setReview({ source_reference: "", licensing_reference: "", review_note: "", confirmed: false });
      setSelection(next); await load(next, rootKind); setNotice("Change saved. Structure refreshed from the server.");
    } catch (cause) {
      if (mounted.current) setError((cause instanceof Error ? cause.message : "Saving failed.") + " If the connection was interrupted, reload to verify the server result before retrying.");
    } finally { pending.current = false; if (mounted.current) setBusy(false); }
  }
  function save(event: FormEvent) {
    event.preventDefault(); if (!editor) return;
    const data = Object.fromEntries(fields[editor.kind].map(field => [field.key,
      field.type === "number" ? Number(values[field.key]) : values[field.key]?.trim() || null]));
    const body = { values: data, parent_id: target?.id ?? editor.parent?.id ?? editor.record?.parent_id ?? undefined,
      target_revision: target?.revision };
    const record = editor.record;
    void mutate(`${base}/${editor.kind}${record ? `/${record.id}` : ""}`, record ? "PATCH" : "POST", body,
      record?.revision ?? editor.parent?.revision);
  }
  async function validateDestination() {
    if (!editor || !uuid.test(destination)) { setError("Enter a valid destination parent UUID."); return; }
    const index = kinds.indexOf(editor.kind as typeof kinds[number]);
    if (index < 1) return;
    try {
      const data = await api(`${base}/${kinds[index-1]}/${destination}`);
      if (!isNode(data) || data.frozen) throw new Error("The destination must be an editable draft parent.");
      setTarget(data); setDirty(true); setError("");
    } catch (cause) { setTarget(null); setError(cause instanceof Error ? cause.message : "Unable to verify destination."); }
  }

  return <>
    {confirmation && <div className="confirmation-overlay"><section role="alertdialog" aria-modal="true" aria-label="Confirm curriculum action"
      className="card confirmation-dialog" onKeyDown={event => {
        if (event.key === "Escape") { event.preventDefault(); answer(false); }
        if (event.key === "Tab") {
          const buttons = event.currentTarget.querySelectorAll("button");
          if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons[1]?.focus(); }
          if (!event.shiftKey && document.activeElement === buttons[1]) { event.preventDefault(); buttons[0]?.focus(); }
        }
      }}><h2>Confirm curriculum action</h2><p>{confirmation}</p><div className="account-actions">
        <button className="button" ref={cancelButton} onClick={() => answer(false)}>Keep current state</button>
        <Button onClick={() => answer(true)}>Confirm action</Button></div></section></div>}
    <AdminSession initial={profile} beforeLogout={leave} />
    <p>Manage structural metadata only. Filipino is a subject; Tagalog is a learning language. Published editions are immutable.</p>
    {error && <div role="alert" className="error"><p>{error}</p><Button disabled={busy} onClick={async () => { if (await leave()) void load(selection, rootKind); }}>Reload and verify</Button></div>}
    {notice && <p role="status">{notice}</p>}
    {gate ? <p role="status">Curriculum is hidden until access is verified. Use Reload and verify if verification failed.</p> : <>
      <div className="account-actions"><Button disabled={busy} onClick={() => navigate(null, "versions", [])}>Editions</Button>
        <Button disabled={busy} onClick={() => navigate(null, "global-subjects", [])}>Subject definitions</Button>
        <Button disabled={busy || loading} onClick={async () => { if (await leave()) void load(selection, rootKind); }}>Refresh structure</Button></div>
      <nav aria-label="Curriculum breadcrumb" className="admin-nav"><button type="button" onClick={() => navigate(null, rootKind, [])}>{labels[rootKind]}</button>
        {crumbs.map((crumb, index) => <button type="button" key={crumb.id} onClick={() => navigate(crumb, rootKind, crumbs.slice(0, index+1))}>{crumb.name}</button>)}</nav>
      {loading ? <p role="status">Loading curriculum…</p> : <>
        {selected && <Card><h2>{nodeName(selected)}</h2><p>{selected.frozen ? "Frozen structure — create a new edition for corrections." : "Editable draft structure"}</p>
          <dl className="node-details">{Object.entries(selected.values).filter(([, value]) => value !== null).map(([key, value]) =>
            <div key={key}><dt>{key.replaceAll("_", " ")}</dt><dd>{value}</dd></div>)}</dl>
          <p className="resource-id">Record ID: {selected.id}</p>
          <div className="account-actions">{canWrite && !selected.frozen && <>
            <Button disabled={busy} onClick={() => startEdit(selected.kind, selected, null)}>Edit record</Button>
            <Button disabled={busy} onClick={async () => { if (await leave() && await ask("Remove this unreferenced draft record? Records with children or references cannot be removed.")) {
              const parent = crumbs.length > 1 ? crumbs[crumbs.length-2] : null;
              setCrumbs(crumbs.slice(0,-1)); void mutate(`${base}/${selected.kind}/${selected.id}`, "DELETE", undefined, selected.revision, parent);
            } }}>Remove draft record</Button></>}
            {canPublish && selected.kind === "versions" && selected.values.status !== "archived" &&
              <Button disabled={busy} onClick={async () => { if (await leave() && await ask("Retire this entire edition? It cannot be restored; historical references are preserved."))
                void mutate(`${base}/versions/${selected.id}/retire`, "POST", undefined, selected.revision); }}>Retire edition</Button>}
          </div>
          {canPublish && selected.kind === "versions" && !selected.frozen && selected.values.status === "draft" &&
            <form className="curriculum-form" onSubmit={event => { event.preventDefault(); if (editor) { setError("Save or cancel the open editor before publishing."); return; }
              void mutate(`${base}/versions/${selected.id}/publish`, "POST", review, selected.revision); }}>
              <h3>Review and publish entire edition</h3><p>Every included branch must reach a competency. Publishing does not certify academic verification.</p>
              {(["source_reference", "licensing_reference", "review_note"] as const).map(key => <label key={key}>{key.replaceAll("_", " ")}
                <textarea className="input" required maxLength={2000} value={review[key]} disabled={busy}
                  onChange={event => { setReview({ ...review, [key]: event.target.value }); setDirty(true); }} /></label>)}
              <label className="check-label"><input type="checkbox" required checked={review.confirmed} disabled={busy}
                onChange={event => { setReview({ ...review, confirmed: event.target.checked }); setDirty(true); }} />
                I reviewed this structure and its source/licensing references and approve publication of this edition.</label>
              <Button disabled={busy}>Publish edition</Button>
            </form>}
        </Card>}
        {editor && <Card><form className="curriculum-form" onSubmit={save} aria-busy={busy}>
          <h2>{editor.record ? "Edit" : "Create"} {labels[editor.kind].toLowerCase()}</h2>
          {fields[editor.kind].map(field => <label key={field.key}>{field.label}
            {field.key === "subject_id" ? <><select className="input" required value={values[field.key] ?? ""} disabled={busy}
              onChange={event => { setValues({ ...values, [field.key]: event.target.value }); setDirty(true); }}>
              <option value="">Choose a subject definition</option>
              {values.subject_id && !subjects.some(row => row.id === values.subject_id) && <option value={values.subject_id}>Current subject: {editor.record?.values.name ?? values.subject_id}</option>}
              {subjects.map(row => <option key={row.id} value={row.id}>{nodeName(row)} ({row.values.code})</option>)}</select>
              <span>Use subject definitions to create a missing subject first.</span></>
            : field.type === "textarea" ? <textarea className="input" required={field.required} maxLength={field.max} value={values[field.key] ?? ""} disabled={busy}
              onChange={event => { setValues({ ...values, [field.key]: event.target.value }); setDirty(true); }} />
            : <input className="input" type={field.type ?? "text"} required={field.required} maxLength={field.type === "number" ? undefined : field.max}
              min={field.type === "number" ? 1 : undefined} max={field.type === "number" ? field.max : undefined} step={field.type === "number" ? 1 : undefined}
              value={values[field.key] ?? ""} disabled={busy} onChange={event => { setValues({ ...values, [field.key]: event.target.value }); setDirty(true); }} />}</label>)}
          {editor.kind === "subjects" && <div className="account-actions"><label>Find subject<input className="input" value={subjectSearch} onChange={event => setSubjectSearch(event.target.value)} /></label>
            <Button type="button" onClick={() => void subjectOptions(subjectSearch, 0)}>Search subjects</Button>
            <Button type="button" disabled={!subjectOffset} onClick={() => void subjectOptions(subjectSearch, subjectOffset-25)}>Previous subjects</Button>
            <Button type="button" disabled={!subjectMore} onClick={() => void subjectOptions(subjectSearch, subjectOffset+25)}>Next subjects</Button></div>}
          {editor.record?.parent_id && <details><summary>Move to another draft parent</summary><p>Open the destination in another tab to copy its record ID. Verify it before saving.</p>
            <label>Destination parent ID<input className="input" value={destination} onChange={event => { setDestination(event.target.value); setTarget(null); }} /></label>
            <Button type="button" disabled={busy} onClick={() => void validateDestination()}>Verify destination</Button>
            {target && <p role="status">Destination: {nodeName(target)}</p>}</details>}
          <div className="account-actions"><Button disabled={busy || (!!destination && !target)}>Save changes</Button>
            <Button type="button" disabled={busy} onClick={() => leave()}>Cancel editing</Button></div>
        </form></Card>}
        {collection && <section aria-label={labels[collection]}><h2>{labels[collection]}</h2>
          <form className="collection-filter" onSubmit={async event => { event.preventDefault(); if (await leave()) void load(selection, rootKind, 0, search, status); }}>
            <label>Search by name or description<input className="input" value={search} maxLength={100} onChange={event => setSearch(event.target.value)} /></label>
            {["versions", "topics", "lessons"].includes(collection) && <label>Lifecycle<select className="input" value={status} onChange={event => setStatus(event.target.value)}>
              <option value="">All statuses</option><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Retired</option></select></label>}
            <Button disabled={busy}>Apply filters</Button></form>
          {canWrite && !selected?.frozen && <Button disabled={busy} onClick={() => startEdit(collection, null, selected)}>Add {labels[collection].toLowerCase()}</Button>}
          {!rows.length ? <p>No records match this collection. No sample content has been added.</p> : <ul className="curriculum-list">{rows.map(row => <li key={row.id}>
            <button type="button" disabled={busy} onClick={() => navigate(row, rootKind, [...crumbs, { kind: row.kind, id: row.id, name: nodeName(row) }])}>{nodeName(row)}</button>
            <span>{row.values.status ?? "Structure"}{row.values.position ? ` · Position ${row.values.position}` : ""}</span></li>)}</ul>}
          <div className="account-actions"><Button disabled={busy || !offset} onClick={async () => { if (await leave()) void load(selection, rootKind, offset-25, search, status); }}>Previous page</Button>
            <span>Page {Math.floor(offset/25)+1}</span><Button disabled={busy || !more} onClick={async () => { if (await leave()) void load(selection, rootKind, offset+25, search, status); }}>Next page</Button></div>
        </section>}
      </>}
    </>}
  </>;
}
