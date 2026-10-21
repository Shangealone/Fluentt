import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import type { ActivityInput, HistoryRequest, PersonalHistoryAccess } from "../../services/api/personalHistory";

type Receipt = { body?: HistoryRequest; input: ActivityInput; status: "saving" | "saved" | "failed" };
async function eventKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return (await import("expo-crypto")).randomUUID();
}

/** Best-effort activity receipts; never hold up learning or silently invent a saved entry. */
export function useActivityHistory(api?: PersonalHistoryAccess, owner?: string, scope?: string) {
  const entries = useRef(new Map<string, Receipt>()), active = useRef(false), generation = useRef(0);
  const [error, setError] = useState("");
  useFocusEffect(useCallback(() => {
    active.current = true; generation.current++; entries.current.clear(); setError("");
    return () => { active.current = false; generation.current++; entries.current.clear(); setError(""); };
  // A new account, API adapter or practice set must invalidate the prior receipt queue.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, owner, scope]));
  const save = useCallback(async (entry: Receipt) => {
    if (!api || !owner || !active.current) return;
    const current = generation.current;
    entry.status = "saving";
    try {
      entry.body ??= { ...entry.input, event_key: await eventKey() };
      if (!active.current || current !== generation.current) return;
      await api.record(entry.body);
      if (!active.current || current !== generation.current) return;
      entry.status = "saved";
      if (![...entries.current.values()].some(value => value.status === "failed")) setError("");
    } catch {
      if (!active.current || current !== generation.current) return;
      entry.status = "failed";
      setError("This activity could not be saved to History. You can keep practising, or retry before leaving this page.");
    }
  }, [api, owner]);
  const recordOnce = useCallback((key: string, input: ActivityInput) => {
    if (!api || !owner || !active.current || entries.current.has(key)) return;
    const entry: Receipt = { input: { ...input, title: Array.from(input.title).slice(0, 200).join(""), prompt: input.prompt == null ? null : Array.from(input.prompt).slice(0, 8000).join("") }, status: "saving" };
    entries.current.set(key, entry); void save(entry);
  }, [api, owner, save]);
  return { recordOnce, error, retry: () => { for (const entry of entries.current.values()) if (entry.status === "failed") void save(entry); } };
}

export function hasPracticeAnswer(method: string, value?: Record<string, unknown>): boolean {
  if (!value) return false;
  if (method === "flashcards") return ["again", "hard", "good", "easy"].includes(String(value.recall));
  if (method === "fill_in_the_blank") return Array.isArray(value.blanks) && value.blanks.some(row => row && typeof row.text === "string" && row.text.length > 0);
  const present = (item: unknown): boolean => typeof item === "boolean" || typeof item === "number" || (typeof item === "string" && item.length > 0)
    || (Array.isArray(item) && item.some(present)) || (!!item && typeof item === "object" && Object.values(item).some(present));
  return Object.values(value).some(present);
}
