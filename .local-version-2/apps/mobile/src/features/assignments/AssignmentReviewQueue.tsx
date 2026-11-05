import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import * as Crypto from "expo-crypto";
import { Text } from "../../accessibility/Primitives";
import type { AssignmentPractice, ResultsAccess } from "../../services/api/results";
import { LessonButton, LessonChoice, LessonLoading, LessonNote, l } from "../teacher-lessons/LessonUI";
import { CaptureQuestion } from "./CaptureQuestion";

const ratings = ["again", "hard", "good", "easy"] as const;
const date = new Intl.DateTimeFormat("en-PH", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Manila" });
type Pending = { key: string; answer: Record<string, unknown>; rating: typeof ratings[number]; revision: number };

export function AssignmentReviewQueue({ api, assignmentId }: { api: ResultsAccess; assignmentId: string }) {
  const [items, setItems] = useState<AssignmentPractice[]>([]);
  const [item, setItem] = useState<AssignmentPractice>();
  const [answer, setAnswer] = useState<Record<string, unknown>>();
  const [rating, setRating] = useState<typeof ratings[number]>("good");
  const [ratingStep, setRatingStep] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Pending>();
  const [shown, setShown] = useState(8);
  const lock = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    void api.practice(assignmentId).then(value => {
      if (alive.current) setItems(value.items);
    }).catch(cause => {
      if (alive.current) { setItems([]); setError(cause instanceof Error ? cause.message : "Couldn’t load review dates."); }
    }).finally(() => { if (alive.current) setLoading(false); });
    return () => { alive.current = false; };
  }, [api, assignmentId, reload]);

  const reset = () => { setItem(undefined); setAnswer(undefined); setRating("good"); setRatingStep(false); setError(""); };
  const refresh = () => { reset(); setLoading(true); setItems([]); setReload(value => value + 1); };
  const ordered = [...items].sort((a, b) => Date.parse(a.due_at) - Date.parse(b.due_at));

  async function save() {
    if (lock.current || !item || !answer) return;
    const operation = pending ?? { key: Crypto.randomUUID(), answer, rating, revision: item.revision };
    lock.current = true; setBusy(true); setError(""); setPending(operation);
    try {
      const { key, ...payload } = operation;
      const saved = await api.savePractice(assignmentId, item.result_id, payload, key);
      if (alive.current) {
        setItems(rows => rows.map(row => row.result_id === saved.result_id ? saved : row));
        setItem(saved);
        setPending(undefined);
      }
    } catch (cause) {
      if (!alive.current) return;
      const status = (cause as { status?: number })?.status;
      if (status && status >= 400 && status < 500) {
        setPending(undefined);
        if (status !== 422) refresh();
      }
      setError(cause instanceof Error ? cause.message : "Couldn’t confirm this review. Retry the same save.");
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }

  return <View style={l.card}>
    <Text accessibilityRole="header" style={l.heading}>Review due</Text>
    <Text style={l.body}>Practice eligible questions again on their review dates. Practice stays separate from your assignment result.</Text>
    {error && <LessonNote error>{error}</LessonNote>}
    {loading ? <LessonLoading label="Checking review dates…" /> : item ? <>
      {!item.is_due ? <>
        <Text style={l.heading}>{item.last_correct ? "Correct practice answer" : "Practice answer incorrect"}</Text>
        <Text style={l.body}>Review this question again on {date.format(new Date(item.due_at))}.</Text>
        <LessonButton label="Back to review queue" onPress={reset} />
      </> : <>
        <CaptureQuestion item={{ ...item.question, assignment_question_id: item.assignment_question_id }} answer={answer}
          back={null} disabled={ratingStep || busy} onChange={setAnswer} onReveal={() => {}} />
        {ratingStep ? <>
          <Text style={l.heading}>How difficult was recall?</Text>
          {ratings.map(value => <LessonChoice key={value} title={value[0].toUpperCase() + value.slice(1)}
            radio checked={rating === value} disabled={busy || !!pending} onPress={() => setRating(value)} />)}
          <LessonButton primary label={busy ? "Saving review…" : pending ? "Retry same save" : "Save review"}
            disabled={busy} onPress={() => void save()} />
          {!pending && <LessonButton label="Back to answer" onPress={() => setRatingStep(false)} />}
        </> : <LessonButton primary label="Continue to rating" disabled={!answer || answer.text === ""}
          onPress={() => setRatingStep(true)} />}
        {!pending && <LessonButton label="Back to review queue" onPress={reset} />}
      </>}
    </> : <>
      {ordered.length === 0 && !error && <Text style={l.body}>There are no eligible recall questions to review in this assignment.</Text>}
      {ordered.slice(0, shown).map(row => <View key={row.result_id} style={l.note}>
        <Text style={l.label}>{row.question.definition.prompt}</Text>
        <Text style={l.body}>{row.is_due ? "Ready to review" : `Next review · ${date.format(new Date(row.due_at))}`}</Text>
        {row.is_due && <LessonButton label="Practice question" onPress={() => { reset(); setItem(row); }} />}
      </View>)}
      {shown < ordered.length && <LessonButton label="Show more questions" onPress={() => setShown(value => value + 8)} />}
      <LessonButton label="Refresh review dates" onPress={refresh} />
    </>}
  </View>;
}
