import { useCallback, useEffect, useRef, useState } from "react";
import { Text, TextInput, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Button, Loading, ErrorMessage, s as sharedStyles } from "../components/ui";
import { PersonalScreen } from "../components/PersonalScreen";
import { p, pc } from "../theme/personal";
import { CaptureQuestion } from "../features/assignments/CaptureQuestion";
import { useSession } from "../session/provider";
import { difficulties, type Difficulty, type PracticeBack, type PracticeLesson, type PracticePage, type PracticeQuestion } from "../services/api/practice";
import { startingDifficulty } from "../services/api/identity";
import { BeginnerPractice } from "../features/learning/BeginnerPractice";

const labels = { easy: "Easy", medium: "Medium", hard: "Hard" };
const s = { ...sharedStyles, card: p.card, heading: p.heading, body: p.body, eyebrow: p.eyebrow,
  input: { ...sharedStyles.input, backgroundColor: "white", borderColor: pc.line, borderRadius: 12, fontSize: 14 } };
export default function QuestionPractice() {
  const { profile, practice, isDemo } = useSession();
  const profileId = profile?.id, role = profile?.role;
  const [search, setSearch] = useState(""), [query, setQuery] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty | undefined>(() => startingDifficulty(profile?.experience));
  const [offset, setOffset] = useState(0), [reload, setReload] = useState(0);
  const [lesson, setLesson] = useState<PracticeLesson | null>(null);
  const [catalog, setCatalog] = useState<PracticePage<PracticeLesson> | null>(null);
  const [questions, setQuestions] = useState<PracticePage<PracticeQuestion> | null>(null);
  const [position, setPosition] = useState(0), [finished, setFinished] = useState(false);
  const [answers, setAnswers] = useState<Record<string, Record<string, unknown>>>({});
  const [backs, setBacks] = useState<Record<string, PracticeBack>>({});
  const [loading, setLoading] = useState(true), [revealing, setRevealing] = useState(false), [error, setError] = useState("");
  const generation = useRef(0), revealLock = useRef(false);
  useEffect(() => { setDifficulty(startingDifficulty(profile?.experience)); setLesson(null); setOffset(0); }, [profile?.experience, profile?.language]);
  useFocusEffect(useCallback(() => {
    const current = ++generation.current;
    let active = true;
    setLoading(true); setError(""); setCatalog(null); setQuestions(null);
    setAnswers({}); setBacks({}); setPosition(0); setFinished(false); setRevealing(false); revealLock.current = false;
    if (!profileId || role !== "personal_student" || (difficulty === "easy" && !lesson)) {
      setLoading(false);
      return () => { active = false; generation.current++; };
    }
    const load = async () => {
      try {
        if (lesson) {
          const page = await practice.questions(lesson.id, difficulty, offset);
          if (active && current === generation.current) setQuestions(page);
        } else {
          const page = await practice.lessons(query, difficulty, offset);
          if (active && current === generation.current) setCatalog(page);
        }
      } catch (cause) {
        if (active && current === generation.current) setError(cause instanceof Error ? cause.message : "Practice could not load. Please retry.");
      } finally { if (active && current === generation.current) setLoading(false); }
    };
    void load();
    return () => {
      active = false; generation.current++;
      setCatalog(null); setQuestions(null); setAnswers({}); setBacks({}); setError(""); setFinished(false);
    };
  // The reload counter deliberately restarts a focused request after Retry.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId, role, profile?.language, profile?.experience, practice, lesson, difficulty, query, offset, reload]));
  if (!profile || profile.role !== "personal_student") return null;
  const item = questions?.items[position];
  const leaveLesson = () => { setLesson(null); setOffset(0); };
  const difficultyPicker = <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>{([undefined, ...difficulties] as const).map(level => <Button key={level ?? "all"} label={level ? labels[level] : "All difficulties"} secondary={difficulty !== level}
    onPress={() => { setDifficulty(level); setOffset(0); }} />)}</View>;
  if (difficulty === "easy" && !lesson) return <PersonalScreen title="Listen. Recognise. Build." eyebrow="Learn · Easy starter practice" description={`Build your first ${profile.language === "english" ? "English" : "Tagalog"} words and sentences, one sound at a time.`}>
    {difficultyPicker}<BeginnerPractice key={`${profileId}-${profile.language}`} language={profile.language ?? "english"} />
  </PersonalScreen>;
  return <PersonalScreen title={lesson ? undefined : "Find your next discovery."} eyebrow="Learn · Lessons & topics" description={lesson ? undefined : "Build your vocabulary. Explore an idea. Choose a difficulty that feels right for you."}>
    {isDemo && <View style={[p.chip, { alignSelf: "flex-start" }]}><Text style={p.chipText}>Demo · Sample lessons and questions</Text></View>}
    {!lesson ? <>
      <Text accessibilityRole="header" style={s.eyebrow}>Search topics or lessons</Text>
      <TextInput accessibilityLabel="Search topics or lessons" placeholder="For example: vocabulary or sentences" value={search} onChangeText={setSearch} maxLength={200} style={s.input}
        returnKeyType="search" onSubmitEditing={() => { setQuery(search.trim()); setOffset(0); setReload(value => value + 1); }} />
      <Button label="Search lessons" onPress={() => { setQuery(search.trim()); setOffset(0); setReload(value => value + 1); }} />
      {difficultyPicker}
    </> : <><Button secondary label="Back to lessons" onPress={leaveLesson} /><Text style={s.body}>{lesson.topic}</Text>
      <Text accessibilityRole="header" style={s.heading}>{lesson.title}</Text></>}
    {loading ? <Loading /> : error ? <><ErrorMessage message={error} /><Button label="Retry loading" onPress={() => setReload(value => value + 1)} /></> : !lesson ? <>
      {!catalog?.items.length && <View style={s.card}><Text style={s.heading}>No lessons found</Text><Text style={s.body}>Try another topic or difficulty. Published lessons with questions in your learning language will appear here.</Text></View>}
      {catalog?.items.map(row => <View key={row.id} style={s.card}><Text style={s.eyebrow}>{row.topic}</Text><Text accessibilityRole="header" style={s.heading}>{row.title}</Text>
        <Text style={s.body}>{row.difficulties.map(level => labels[level]).join(" · ")}</Text><Button label={`Practise ${row.title}`} onPress={() => { setLesson(row); setOffset(0); }} /></View>)}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>{offset > 0 && <Button secondary label="Previous lessons" onPress={() => setOffset(value => Math.max(0, value - 20))} />}
        {catalog?.has_more && <Button label="More lessons" onPress={() => setOffset(value => value + 20)} />}</View>
    </> : finished ? <View style={s.card}><Text accessibilityRole="header" style={s.heading}>Practice finished</Text>
      <Text style={s.body}>You reached the end of this set. Your answers stay in this visit only; no grade is recorded.</Text>
      <Button label="Choose another lesson" onPress={leaveLesson} /><Button secondary label="Practise this set again" onPress={() => setReload(value => value + 1)} />
      {questions?.has_more && <Button secondary label="Next question set" onPress={() => setOffset(value => value + 20)} />}</View>
      : item ? <>
        <View style={p.row}><Text style={s.eyebrow}>Card {position + 1} of {questions!.items.length}</Text><View style={[p.chip, { backgroundColor: pc.pink }]}><Text style={[p.chipText, { color: pc.rose }]}>{labels[item.definition.difficulty]} · Personal practice</Text></View></View>
        <View accessibilityRole="progressbar" accessibilityLabel="Position in this practice set" accessibilityValue={{ min: 1, max: questions!.items.length, now: position + 1 }} style={{ height: 5, backgroundColor: pc.line, borderRadius: 6 }}><View style={{ height: 5, backgroundColor: pc.navy, borderRadius: 6, width: `${((position + 1) / questions!.items.length) * 100}%` }} /></View>
        <Text style={s.body}>Your answers stay only while this page is open. No grade is recorded.</Text>
        <CaptureQuestion key={item.id} practice item={item} answer={answers[item.id]} back={backs[item.id] ?? null} disabled={revealing}
          onChange={answer => setAnswers(previous => ({ ...previous, [item.id]: answer }))} onReveal={() => {
            if (revealLock.current) return;
            revealLock.current = true; setRevealing(true); setError(""); const current = generation.current;
            void practice.reveal(item.id).then(back => { if (current === generation.current) setBacks(previous => ({ ...previous, [item.id]: back })); })
              .catch(cause => { if (current === generation.current) { setAnswers({}); setBacks({}); setQuestions(null); setError(cause instanceof Error ? cause.message : "Could not reveal this card."); } })
              .finally(() => { if (current === generation.current) { revealLock.current = false; setRevealing(false); } });
          }} />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}><Button secondary label="Previous question" disabled={position === 0 || revealing} onPress={() => setPosition(value => value - 1)} />
          <Button label={position === questions!.items.length - 1 ? "Finish practice" : "Next question"} disabled={revealing} onPress={() => position === questions!.items.length - 1 ? setFinished(true) : setPosition(value => value + 1)} /></View>
      </> : <View style={s.card}><Text style={s.heading}>No questions available</Text><Text style={s.body}>Choose another lesson or difficulty.</Text><Button label="Choose a lesson" onPress={leaveLesson} /></View>}
  </PersonalScreen>;
}

