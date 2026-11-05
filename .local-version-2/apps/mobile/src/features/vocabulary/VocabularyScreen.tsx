import { useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { router, usePreventRemove } from "expo-router";
import * as Crypto from "expo-crypto";
import { Text } from "../../accessibility/Primitives";
import { type RecallRating, type VocabularyAccess, type VocabularyReview } from "../../services/api/vocabulary";
import { LessonButton, LessonChoice, LessonField, LessonFrame, LessonHero, LessonLoading, LessonNote, l } from "../teacher-lessons/LessonUI";
import { useLessonData } from "../teacher-lessons/useLessonData";
import { ParallelPreparationNotice } from "../research/ParallelPreparationNotice";
import { ParallelWorkflowPanel } from "../research/ParallelWorkflowPanel";

type Props = { api: VocabularyAccess; studyId: string; onBack: () => void; onAccount: () => void };
type Pending = { key: string; kind: "start" | "answer" | "rate"; target: string; response?: string; rating?: RecallRating };
const ratings: { id: RecallRating; title: string; detail: string }[] = [
  { id: "again", title: "Again", detail: "I couldn’t remember." }, { id: "hard", title: "Hard", detail: "I remembered with difficulty." },
  { id: "good", title: "Good", detail: "I remembered with some effort." }, { id: "easy", title: "Easy", detail: "I remembered readily." },
];

export function VocabularyScreen(props: Props) {
  return props.studyId ? <ReviewStudy {...props} /> : <Directory {...props} />;
}

function Directory({ api, onBack, onAccount }: Props) {
  const fetch = useCallback(() => api.studies(), [api]);
  const state = useLessonData(fetch);
  return <LessonFrame onBack={onBack} onAccount={onAccount}><LessonHero title="Vocabulary review" description="A little practice to help words stay familiar." />
    <ParallelPreparationNotice />
    <ParallelWorkflowPanel />
    {state.phase === "loading" && <LessonLoading label="Loading your study activities…" />}
    {state.phase === "error" && <><LessonNote error>{state.error}</LessonNote><LessonButton label="Try again" onPress={state.reload} /></>}
    {state.phase === "ready" && <>{!state.value?.items.length && <View style={l.card}><Text style={l.heading}>No study reviews yet</Text><Text style={l.body}>Your review activities will appear here when your approved study participation is ready.</Text></View>}
      {state.value?.items.map(study => <View key={study.id} style={l.card}><Text style={l.heading}>{study.title}</Text><Text style={l.body}>{study.status === "active" ? "Your study practice" : "Activities are not open yet."}</Text><LessonButton label="Open reviews" disabled={study.status !== "active"} primary onPress={() => router.push({ pathname: "/vocabulary-review", params: { studyId: study.id } })} /></View>)}
      <LessonButton label="Refresh activities" onPress={state.reload} /></>}
    <LessonNote>Study practice is optional and follows your participation permissions. It stays separate from ordinary class assignments.</LessonNote>
  </LessonFrame>;
}

function ReviewStudy({ api, studyId, onBack, onAccount }: Props) {
  const fetch = useCallback(() => api.due(studyId), [api, studyId]);
  const queue = useLessonData(fetch);
  const [row, setRow] = useState<VocabularyReview | null>(null), [answer, setAnswer] = useState("");
  const [rating, setRating] = useState<RecallRating | null>(null), [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [blocked, setBlocked] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [exit, setExit] = useState<(() => void) | null>(null);
  const lock = useRef(false), alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const dirty = !!pending || (row?.phase === "answer" && !!answer) || row?.phase === "rating";
  usePreventRemove(!!dirty || busy, ({ repeat }) => { if (!lock.current) setExit(() => repeat); });
  useEffect(() => {
    if (!dirty || typeof window === "undefined") return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const leave = (action: () => void) => { if (lock.current) return; if (dirty) setExit(() => action); else action(); };

  async function perform(operation: Pending) {
    if (lock.current || !alive.current || blocked) return;
    lock.current = true; setBusy(true); setError(""); setPending(operation);
    try {
      const value = operation.kind === "start" ? await api.start(studyId, operation.target, operation.key)
        : operation.kind === "answer" ? await api.answer(studyId, operation.target, operation.response!, operation.key)
          : await api.rate(studyId, operation.target, operation.rating!, operation.key);
      if (alive.current) { setRow(value); setPending(null); setAnswer(""); setRating(null); }
    } catch (cause) {
      if (alive.current) {
        const status = (cause as { status?: number }).status;
        setError(cause instanceof Error ? cause.message : "We couldn’t confirm that request. Please retry.");
        if (status === 401 || status === 403 || status === 404) { setRow(null); setAnswer(""); setRating(null); setPending(null); setBlocked(true); }
        else if (status === 409 || status === 412) { setPending(null); setConflict(true); }
        else if (status === 422 || status === 400) setPending(null);
      }
    } finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  const frozen = busy || !!pending || blocked || conflict;
  return <LessonFrame busy={busy} scrollKey={`${row?.id}-${row?.phase}-${!!exit}`} onBack={() => leave(onBack)} onAccount={() => leave(onAccount)}>
    {exit ? <View style={l.card}><Text style={l.heading}>Leave this review?</Text><Text style={l.body}>Your committed answer stays saved. Text you haven’t checked will be lost. If a request was interrupted, check your saved review when you return.</Text><LessonButton label="Stay here" primary onPress={() => setExit(null)} /><LessonButton label="Leave review" onPress={() => { const action = exit; setExit(null); setPending(null); setAnswer(""); setRow(null); action(); }} /></View> : <>
      <LessonHero title="Practice your words" description={queue.value?.title ?? "One word at a time."} />
      {!!error && <LessonNote error>{error}</LessonNote>}
      {conflict && <><LessonNote>This request was not accepted. Reload your saved reviews to check for changes before continuing.</LessonNote><LessonButton label="Reload saved reviews" primary onPress={() => { setRow(null); setAnswer(""); setRating(null); setConflict(false); setError(""); queue.reload(); }} /></>}
      {busy && <LessonLoading label="Saving your review…" />}
      {!!pending && !busy && <><LessonNote>The saved outcome is unconfirmed. Retry the same request before continuing.</LessonNote><LessonButton label="Retry request" primary onPress={() => void perform(pending)} /></>}
      {blocked && <LessonButton label="Back to activities" onPress={onBack} />}
      {!row && !blocked && <>
        {queue.phase === "loading" && <LessonLoading label="Loading your reviews…" />}
        {queue.phase === "error" && <><LessonNote error>{queue.error}</LessonNote><LessonButton label="Try again" disabled={frozen} onPress={queue.reload} /></>}
        {queue.phase === "ready" && <View style={l.card}><Text style={l.heading}>{queue.value?.items.length ? "Your next review is ready" : "You’re up to date"}</Text><Text style={l.body}>{queue.value?.items.length ? "Answer the question, then tell us how difficult recall felt." : "Your next reviews will appear when they’re due."}</Text>{!!queue.value?.items.length && <LessonButton label="Start review" primary disabled={frozen} onPress={() => void perform({ key: Crypto.randomUUID(), kind: "start", target: queue.value!.items[0].id })} />}<LessonButton label="Refresh reviews" disabled={frozen} onPress={queue.reload} /></View>}
      </>}
      {row?.phase === "answer" && <View style={l.card}><Text style={l.small}>{row.question.format === "multiple_choice" ? "Choose one answer" : "Type the word"}</Text><Text accessibilityRole="header" style={l.heading}>{row.question.prompt}</Text>
        {row.question.format === "multiple_choice" ? row.question.options.map(option => <LessonChoice key={option.id} title={option.text} checked={answer === option.id} radio disabled={frozen} onPress={() => setAnswer(option.id)} />)
          : <LessonField label="Your answer" value={answer} onChange={setAnswer} disabled={frozen} maxLength={2000} />}
        <LessonButton label="Check answer" primary disabled={frozen || !answer.trim()} onPress={() => void perform({ key: Crypto.randomUUID(), kind: "answer", target: row.id, response: answer })} />
      </View>}
      {(row?.phase === "rating" || row?.phase === "finished") && <View style={l.card}><Text accessibilityRole="header" style={l.heading}>{row.feedback?.correct ? "Correct" : "Try to remember this word"}</Text><Text style={l.body}>Answer: {row.feedback?.answer}</Text>
        {row.phase === "rating" && <><Text style={l.heading}>How difficult was it to remember?</Text><Text style={l.body}>Think about how it felt before you saw the answer.</Text>{ratings.map(item => <LessonChoice key={item.id} title={item.title} detail={item.detail} checked={rating === item.id} radio disabled={frozen} onPress={() => setRating(item.id)} />)}<LessonButton label="Save review" primary disabled={frozen || !rating} onPress={() => void perform({ key: Crypto.randomUUID(), kind: "rate", target: row.id, rating: rating! })} /></>}
        {row.phase === "finished" && <><Text accessibilityLiveRegion="polite" style={l.body}>Review saved.</Text><LessonButton label="Continue" primary disabled={busy} onPress={() => { setRow(null); setError(""); queue.reload(); }} /></>}
      </View>}
    </>}
  </LessonFrame>;
}
