import { useCallback, useEffect, useRef, useState } from "react";
import { Platform, View } from "react-native";
import { router, useFocusEffect, usePreventRemove } from "expo-router";
import * as Crypto from "expo-crypto";
import { Text } from "../../accessibility/Primitives";
import { useSession } from "../../session/provider";
import type { AssessedInput, AssessedView } from "../../services/api/assessedProficiency";
import { proficiencyLevels, classProficiencyLabel, type ClassProficiency } from "../../services/api/classProficiency";
import { LessonButton, LessonChoice, LessonField, LessonFrame, LessonLoading, LessonNote, l } from "../teacher-lessons/LessonUI";

const levelLabel = (level: ClassProficiency | null) => level === null ? "Not assessed yet" : classProficiencyLabel(level);
type Props = { classId?: string; studentId?: string; editable?: boolean };

export function ProficiencyScreen({ classId, studentId }: { classId: string; studentId: string }) {
  return <LessonFrame onBack={() => router.replace({ pathname: "/instructor-monitoring", params: { classId, studentId } })} onAccount={() => router.push("/account")}>
    <AssessedProficiency classId={classId} studentId={studentId} editable />
  </LessonFrame>;
}

export function AssessedProficiency({ classId, studentId, editable = false }: Props) {
  const { assessedProficiency: api } = useSession();
  const [language, setLanguage] = useState<"english" | "tagalog">("english"), [offset, setOffset] = useState(0), [revision, setRevision] = useState(0);
  const [value, setValue] = useState<AssessedView | null>(null), [phase, setPhase] = useState<"loading" | "ready" | "error">("loading"), [error, setError] = useState("");
  const [editing, setEditing] = useState(editable), [dirty, setDirty] = useState(false), [busy, setBusy] = useState(false), [history, setHistory] = useState(false), [notice, setNotice] = useState("");
  const [level, setLevel] = useState<ClassProficiency | null>(null), [date, setDate] = useState("");
  const [pending, setPending] = useState<{ body: AssessedInput; key: string } | null>(null);
  const [confirmation, setConfirmation] = useState<{ title: string; message: string; accept: () => void } | null>(null);
  const scope = useRef({ active: false, generation: 0 }), lock = useRef(false);
  useFocusEffect(useCallback(() => {
    const generation = ++scope.current.generation;
    scope.current.active = true; lock.current = false;
    setValue(null); setPhase("loading"); setError(""); setPending(null); setDirty(false); setBusy(false); setConfirmation(null);
    const request = classId && studentId ? api.read(classId, studentId, offset) : api.mine(language, offset);
    void request.then(data => {
      if (!scope.current.active || scope.current.generation !== generation) return;
      setValue(data); setLevel(data.current?.level ?? null); setDate(data.current?.assessed_on ?? ""); setPhase("ready"); setEditing(editable);
    }).catch(cause => {
      if (scope.current.active && scope.current.generation === generation) { setValue(null); setPhase("error"); setError(cause instanceof Error ? cause.message : "We couldn’t load the assessment record."); }
    });
    return () => { scope.current.active = false; scope.current.generation++; lock.current = false; setValue(null); setPending(null); setDate(""); setLevel(null); setDirty(false); };
  // revision intentionally repeats the focus-scoped read for explicit refresh.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, classId, studentId, language, offset, revision, editable]));
  usePreventRemove(editable && (dirty || !!pending || busy), ({ repeat }) => {
    if (lock.current) return;
    setConfirmation({ title: pending ? "Leave an uncertain assessment entry?" : "Leave with unsaved changes?", message: pending ? "The entry may have been saved. Leaving clears its retry details. Check the history before entering it again." : "Your unsaved assessment entry will be discarded.", accept: repeat });
  });
  useEffect(() => {
    if (Platform.OS !== "web" || (!dirty && !pending && !busy)) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, pending, busy]);
  const frozen = busy || !!pending;
  function reload() {
    if (lock.current) return;
    const perform = () => { setConfirmation(null); setNotice(""); setRevision(v => v + 1); };
    if (dirty || pending) setConfirmation({ title: "Reload the saved record?", message: "This discards your local entry and retry details, then reads the latest assessment record.", accept: perform });
    else perform();
  }
  async function save() {
    if (lock.current || !value || !classId || !studentId || !editable) return;
    if (!pending && level !== null && !/^\d{4}-\d{2}-\d{2}$/.test(date)) { setError("Enter the external assessment date as YYYY-MM-DD."); return; }
    const request = pending ?? { body: { level, assessed_on: level === null ? null : date, expected_event_id: value.current?.id ?? null }, key: Crypto.randomUUID() };
    const generation = scope.current.generation;
    lock.current = true; setBusy(true); setPending(request); setError(""); setNotice("");
    try {
      const saved = await api.record(classId, studentId, request.body, request.key);
      if (!scope.current.active || scope.current.generation !== generation) return;
      setValue(saved); setOffset(0); setLevel(saved.current?.level ?? null); setDate(saved.current?.assessed_on ?? "");
      setPending(null); setDirty(false); setEditing(false); setNotice("Assessment outcome recorded. Class placement is unchanged.");
    } catch (cause) {
      if (!scope.current.active || scope.current.generation !== generation) return;
      setError(cause instanceof Error ? cause.message : "We couldn’t confirm the save. Retry the original entry.");
      const status = (cause as { status?: number }).status;
      if (status && status !== 408 && status < 500) {
        setPending(null);
        if ([401, 403, 404, 409].includes(status)) { setValue(null); setPhase("error"); }
      }
    } finally { if (scope.current.generation === generation) { lock.current = false; if (scope.current.active) setBusy(false); } }
  }
  if (confirmation) return <View style={l.card}><Text accessibilityRole="header" style={l.heading}>{confirmation.title}</Text><Text style={l.body}>{confirmation.message}</Text><LessonButton label="Keep working" primary onPress={() => setConfirmation(null)} /><LessonButton label="Continue" onPress={() => { const accept = confirmation.accept; setConfirmation(null); accept(); }} /></View>;
  return <View style={l.card}>
    <Text accessibilityRole="header" style={l.heading}>Assessed proficiency</Text>
    <Text style={l.small}>Recorded from the client’s external assessment. Separate from class level and assignment results.</Text>
    {!classId && <View style={l.row}>{(["english", "tagalog"] as const).map(option => <View key={option} style={l.flex}><LessonButton label={option === "english" ? "English" : "Tagalog"} primary={language === option} onPress={() => { setOffset(0); setLanguage(option); }} /></View>)}</View>}
    {phase === "loading" && <LessonLoading label="Loading assessment record…" />}
    {!!error && <LessonNote error>{error}</LessonNote>}{!!notice && <LessonNote>{notice}</LessonNote>}
    {phase === "error" && <LessonButton label="Reload assessment record" onPress={reload} />}
    {value && phase === "ready" && <>
      <Text style={l.label}>{value.username} · {value.language === "english" ? "English" : "Tagalog"}</Text>
      <Text style={l.heading}>{levelLabel(value.current?.level ?? null)}</Text>
      {value.current && <><Text style={l.body}>{value.current.assessed_on ? `Assessment date: ${value.current.assessed_on}` : "No assessment date recorded"}</Text><Text style={l.small}>Recorded by {value.current.recorded_by} · {new Date(value.current.recorded_at).toLocaleString()}</Text></>}
      {!value.current && <Text style={l.body}>No external assessment outcome has been recorded for this language.</Text>}
      {editable && editing && <View style={l.stack}>
        <Text style={l.label}>External assessment outcome</Text>
        <View accessibilityRole="radiogroup" accessibilityLabel="Assessed proficiency">{[...proficiencyLevels, null].map(option => <LessonChoice key={option ?? "not-assessed"} title={levelLabel(option)} radio checked={level === option} disabled={frozen} onPress={() => { setLevel(option); setDirty(true); setError(""); }} />)}</View>
        {level !== null && <LessonField label="Assessment date" help="Enter the date of the client’s assessment (YYYY-MM-DD)." value={date} onChange={next => { setDate(next); setDirty(true); setError(""); }} disabled={frozen} maxLength={10} />}
        <Text style={l.small}>This entry becomes the current outcome for this student’s {value.language === "english" ? "English" : "Tagalog"} classes. Earlier entries stay in the history.</Text>
        {pending && !busy && <LessonNote>The save outcome is uncertain. Editing is paused; retry the same original entry to avoid duplicates.</LessonNote>}
        <LessonButton label={busy ? "Saving…" : pending ? "Retry original entry" : "Save assessment outcome"} primary disabled={busy || (!dirty && !pending)} onPress={() => void save()} />
      </View>}
      {editable && !editing && <LessonButton label="Record a new outcome" onPress={() => { setEditing(true); setNotice(""); }} />}
      {!editable && classId && studentId && <LessonButton label="Record assessment outcome" onPress={() => router.push({ pathname: "/instructor-monitoring", params: { classId, studentId, assessment: "1" } })} />}
      <LessonButton label="Refresh assessment record" quiet disabled={busy} onPress={reload} />
      <LessonButton label={history ? "Hide assessment history" : "View assessment history"} quiet disabled={busy} onPress={() => setHistory(v => !v)} />
      {history && <View style={l.stack}>
        {!value.history.length && <Text style={l.body}>No assessment entries yet.</Text>}
        {value.history.map(entry => <View key={entry.id} style={l.note}><Text style={l.label}>{levelLabel(entry.level)}</Text><Text style={l.body}>{entry.assessed_on ? `Assessment date: ${entry.assessed_on}` : "Recorded as not assessed"}</Text><Text style={l.small}>Recorded by {entry.recorded_by} · {new Date(entry.recorded_at).toLocaleString()}</Text></View>)}
        {(offset > 0 || value.has_more) && <View style={l.row}><LessonButton label="Newer entries" disabled={frozen || dirty || offset === 0} onPress={() => setOffset(v => Math.max(0, v - 20))} /><LessonButton label="Older entries" disabled={frozen || dirty || !value.has_more} onPress={() => setOffset(v => v + 20)} /></View>}
      </View>}
    </>}
  </View>;
}
