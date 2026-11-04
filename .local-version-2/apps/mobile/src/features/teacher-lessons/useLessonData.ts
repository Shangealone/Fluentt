import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import type { AssignmentPage } from "../../services/api/assignments";

export function useLessonData<T>(fetch: () => Promise<T>) {
  const [state, setState] = useState<{ phase: "loading" | "ready" | "error"; value: T | null; error: string }>({ phase: "loading", value: null, error: "" });
  const [revision, setRevision] = useState(0);
  useFocusEffect(useCallback(() => {
    let live = true;
    setState({ phase: "loading", value: null, error: "" });
    void fetch().then(value => { if (live) setState({ phase: "ready", value, error: "" }); }).catch(cause => { if (live) setState({ phase: "error", value: null, error: cause instanceof Error ? cause.message : "Please try again." }); });
    return () => { live = false; setState({ phase: "loading", value: null, error: "" }); };
  }, [fetch, revision]));
  return { ...state, reload: () => setRevision(n => n + 1) };
}

export function useLessonPage<T>(fetch: (offset: number) => Promise<AssignmentPage<T>>) {
  const [rows, setRows] = useState<T[]>([]), [phase, setPhase] = useState<"loading" | "ready" | "error">("loading"), [error, setError] = useState("");
  const [more, setMore] = useState(false), [refresh, setRefresh] = useState(0);
  const generation = useRef(0), active = useRef(false), lock = useRef(false), next = useRef(0);
  const load = useCallback(async (offset: number, epoch: number) => {
    if (lock.current || !active.current) return;
    lock.current = true; setPhase("loading"); setError("");
    if (!offset) setRows([]);
    try { const page = await fetch(offset); if (active.current && epoch === generation.current) { setRows(old => offset ? [...old, ...page.items] : page.items); next.current = offset + page.items.length; setMore(page.has_more); setPhase("ready"); } }
    catch (cause) { if (active.current && epoch === generation.current) { setRows([]); setMore(false); setPhase("error"); setError(cause instanceof Error ? cause.message : "Please try again."); } }
    finally { if (epoch === generation.current) lock.current = false; }
  }, [fetch]);
  useFocusEffect(useCallback(() => { active.current = true; lock.current = false; const epoch = ++generation.current; void load(0, epoch); return () => { active.current = false; generation.current++; lock.current = false; setRows([]); setMore(false); }; }, [load, refresh]));
  return { rows, phase, error, more, reload: () => { if (!lock.current) setRefresh(n => n + 1); }, loadMore: () => { if (more) void load(next.current, generation.current); } };
}
