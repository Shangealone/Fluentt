import { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler, Platform, Pressable, View } from "react-native";
import { Text, TextInput } from "../accessibility/Primitives";

import { router, useFocusEffect } from "expo-router";
import { Loading, ErrorMessage } from "../components/ui";
import { l as s, LearnButton as Button, LearnHero, LearnLink, LearnProgress, LearnScreen } from "../features/learning/LearnUI";
import { CaptureQuestion } from "../features/assignments/CaptureQuestion";
import { useSession } from "../session/provider";
import { difficulties, type Difficulty, type PracticeBack, type PracticeFeedback, type PracticeLesson, type PracticePage, type PracticeQuestion } from "../services/api/practice";
import { startingDifficulty } from "../services/api/identity";
import { BeginnerPractice } from "../features/learning/BeginnerPractice";
import { hasPracticeAnswer, useActivityHistory } from "../features/history/useActivityHistory";
import { HistorySaveNotice } from "../features/history/HistorySaveNotice";

const labels = { easy: "Easy", medium: "Medium", hard: "Challenging" };
export default function QuestionPractice() {
  const { profile, practice, activityHistory } = useSession();
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
  const [started, setStarted] = useState(false), [checking, setChecking] = useState(false);
  const [tipOpen, setTipOpen] = useState(false);
  const [feedback, setFeedback] = useState<PracticeFeedback | null>(null), [checkError, setCheckError] = useState("");
  const checkLock = useRef(false), checkGeneration = useRef(0);
  useEffect(() => { checkGeneration.current++; checkLock.current = false; setChecking(false); setFeedback(null); setCheckError(""); setTipOpen(false); }, [position, lesson, reload, difficulty]);
  const [loading, setLoading] = useState(true), [revealing, setRevealing] = useState(false), [error, setError] = useState("");
  const generation = useRef(0), revealLock = useRef(false);
  const starterExit = useRef<(() => void) | null>(null);
  const [scrollRevision, setScrollRevision] = useState(0);
  const resetScroll = useCallback(() => { setScrollRevision(value => value + 1); }, []);
  const setStarterExit = useCallback((exit: (() => void) | null) => { starterExit.current = exit; resetScroll(); }, [resetScroll]);
  const goBack = useCallback(() => {
    if (starterExit.current) starterExit.current();
    else if (lesson) { setLesson(null); setOffset(0); }
    else router.replace("/student");
  }, [lesson]);
  useFocusEffect(useCallback(() => {
    if (Platform.OS !== "android") return;
    const back = BackHandler.addEventListener("hardwareBackPress", () => { goBack(); return true; });
    return () => back.remove();
  }, [goBack]));
  const activity = useActivityHistory(activityHistory, profile?.role === "personal_student" ? profile.id : undefined, `${lesson?.id ?? "catalog"}:${offset}:${reload}`);
  useEffect(() => { setDifficulty(startingDifficulty(profile?.experience)); setLesson(null); setOffset(0); }, [profile?.experience, profile?.language]);
  useFocusEffect(useCallback(() => {
    const current = ++generation.current;
    let active = true;
    setLoading(true); setError(""); setCatalog(null); setQuestions(null);
    setAnswers({}); setBacks({}); setPosition(0); setFinished(false); setRevealing(false); revealLock.current = false;
    setStarted(false);
    checkGeneration.current++; checkLock.current = false; setChecking(false); setFeedback(null); setCheckError("");
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
      checkGeneration.current++;
      setCatalog(null); setQuestions(null); setAnswers({}); setBacks({}); setError(""); setFinished(false);
    };
  // The reload counter deliberately restarts a focused request after Retry.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId, role, profile?.language, profile?.experience, practice, lesson, difficulty, query, offset, reload]));
  if (!profile || profile.role !== "personal_student") return null;
  const item = questions?.items[position];
  const checkReady = !!item && hasPracticeAnswer(item.definition.method, answers[item.id]) && (item.definition.method !== "word_arrangement"
    || (Array.isArray(answers[item.id]?.ordered_token_ids) && (answers[item.id].ordered_token_ids as string[]).length === (item.definition.content as { items: unknown[] }).items.length));
  const leaveLesson = () => { setLesson(null); setOffset(0); };
  const difficultyPicker = <View accessibilityRole="radiogroup" accessibilityLabel="Practice level" style={s.levels}>{difficulties.map(level => <Pressable key={level} accessibilityRole="radio" accessibilityLabel={labels[level]}
    accessibilityState={{ checked: difficulty === level }} aria-checked={difficulty === level}
    style={({ pressed }) => [s.level, difficulty === level && s.selectedLevel, pressed && s.pressed]}
    onPress={() => { setDifficulty(level); setOffset(0); }}><Text style={[s.levelText, difficulty === level && s.selectedLevelText]}>{labels[level]}</Text></Pressable>)}</View>;
  const scrollKey = `${scrollRevision}:${difficulty}:${lesson?.id}:${position}:${offset}:${finished}:${reload}`;
  if (difficulty === "easy" && !lesson) return <LearnScreen onBack={goBack} resetKey={scrollKey}>
    <BeginnerPractice key={`${profileId}-${profile.language}`} language={profile.language ?? "english"} history={activityHistory} owner={profileId} picker={difficultyPicker} onExitChange={setStarterExit} onNavigate={resetScroll} />
  </LearnScreen>;
  return <LearnScreen onBack={goBack} resetKey={scrollKey}>
    {!lesson ? <>
      <LearnHero />{difficultyPicker}
      <View style={s.card}><Text accessibilityRole="header" style={s.heading}>Find a lesson</Text>
      <TextInput accessibilityLabel="Search topics or lessons" placeholder="Search words, topics, or lessons" value={search} onChangeText={setSearch} maxLength={200} style={s.search}
        returnKeyType="search" onSubmitEditing={() => { setQuery(search.trim()); setOffset(0); setReload(value => value + 1); }} />
      <Button label="Search lessons" onPress={() => { setQuery(search.trim()); setOffset(0); setReload(value => value + 1); }} />
      <Button secondary label="All levels" onPress={() => { setDifficulty(undefined); setOffset(0); }} /></View>
    </> : <><LearnLink label="Back to lessons" onPress={leaveLesson} /><Text style={s.caption}>{lesson.topic}</Text>
      <Text accessibilityRole="header" style={s.heading}>{lesson.title}</Text></>}
    {loading ? <Loading /> : error ? <><ErrorMessage message={error} /><Button label="Retry loading" onPress={() => setReload(value => value + 1)} /></> : !lesson ? <>
      {!catalog?.items.length && <View style={s.card}><Text style={s.heading}>No lessons found</Text><Text style={s.body}>Try another topic or level.</Text></View>}
      {catalog?.items.map(row => <View key={row.id} style={s.card}><Text style={s.caption}>{row.topic}</Text><Text accessibilityRole="header" style={s.heading}>{row.title}</Text>
        <Text style={s.body}>{row.difficulties.map(level => labels[level]).join(" · ")}</Text><Button label={`Practice ${row.title}`} onPress={() => { setLesson(row); setOffset(0); }} /></View>)}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>{offset > 0 && <Button secondary label="Previous lessons" onPress={() => setOffset(value => Math.max(0, value - 20))} />}
        {catalog?.has_more && <Button label="More lessons" onPress={() => setOffset(value => value + 20)} />}</View>
    </> : finished ? <View style={s.card}><Text accessibilityRole="header" style={s.title}>Nice practice!</Text>
      <Text style={s.body}>You finished this set. Try it again or choose a new lesson.</Text><HistorySaveNotice error={activity.error} retry={activity.retry} />
      <Button label="Choose another lesson" onPress={leaveLesson} /><Button secondary label="Practice this set again" onPress={() => setReload(value => value + 1)} />
      {questions?.has_more && <Button secondary label="Next question set" onPress={() => setOffset(value => value + 20)} />}</View>
      : lesson.introduction && !started && offset === 0 ? <View style={s.card}>
        <Text accessibilityRole="header" style={s.heading}>Before you start</Text>
        <Text style={s.body}>{lesson.introduction}</Text>
        <Button label="Start lesson" disabled={!item} onPress={() => { setStarted(true); resetScroll(); }} />
      </View> : item ? <>
        <LearnProgress position={position + 1} total={questions!.items.length} />
        <Text style={s.caption}>{labels[item.definition.difficulty]} · Practice at your own pace</Text>
        {!!lesson.introduction && <View style={s.card}><Button secondary label={tipOpen ? "Hide lesson tip" : "Show lesson tip"} onPress={() => setTipOpen(value => !value)} />{tipOpen && <Text style={s.body}>{lesson.introduction}</Text>}</View>}
        <CaptureQuestion key={item.id} practice item={item} answer={answers[item.id]} back={backs[item.id] ?? null} disabled={revealing || checking}
          onChange={answer => { checkGeneration.current++; setFeedback(null); setCheckError(""); setAnswers(previous => ({ ...previous, [item.id]: answer })); }} onReveal={() => {
            if (revealLock.current) return;
            revealLock.current = true; setRevealing(true); setError(""); const current = generation.current;
            void practice.reveal(item.id).then(back => { if (current === generation.current) setBacks(previous => ({ ...previous, [item.id]: back })); })
              .catch(cause => { if (current === generation.current) { setAnswers({}); setBacks({}); setQuestions(null); setError(cause instanceof Error ? cause.message : "Could not reveal this card."); } })
              .finally(() => { if (current === generation.current) { revealLock.current = false; setRevealing(false); } });
          }} />
        {lesson.feedback_available && practice.check && (item.definition.method === "multiple_choice" || item.definition.method === "word_arrangement") && <View style={s.card}>
          <Button label={checking ? "Checking…" : "Check answer"} disabled={checking || !checkReady} onPress={() => {
            if (checkLock.current) return;
            const answer = answers[item.id]; if (!answer) return;
            checkLock.current = true; setChecking(true); setCheckError("");
            const current = generation.current, ticket = ++checkGeneration.current;
            void practice.check!(item.id, answer).then(result => { if (current === generation.current && ticket === checkGeneration.current) setFeedback(result); })
              .catch(cause => { if (current === generation.current && ticket === checkGeneration.current) setCheckError(cause instanceof Error ? cause.message : "Could not check your answer. Try again."); })
              .finally(() => { if (current === generation.current && ticket === checkGeneration.current) { checkLock.current = false; setChecking(false); } });
          }} />
          {feedback && <Text accessibilityLiveRegion="polite" style={s.body}>{feedback.correct ? "You got it! " : ""}{feedback.message}</Text>}
          {!!checkError && <ErrorMessage message={checkError} />}
        </View>}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}><Button secondary label="Previous question" disabled={position === 0 || revealing || checking} onPress={() => setPosition(value => value - 1)} />
          <Button label={position === questions!.items.length - 1 ? "Finish practice" : "Next question"} disabled={revealing || checking} onPress={() => {
            if (hasPracticeAnswer(item.definition.method, answers[item.id])) activity.recordOnce(item.id, { kind: "learn_question", source_id: item.id, content_version: item.version, title: lesson.title, prompt: item.definition.prompt, language: profile.language ?? "english" });
            if (position === questions!.items.length - 1) {
              if (questions!.items.some(row => hasPracticeAnswer(row.definition.method, answers[row.id]))) activity.recordOnce(`lesson-${lesson.id}-${offset}`, { kind: "learn_lesson", source_id: lesson.id, title: lesson.title, language: profile.language ?? "english" });
              setFinished(true);
            } else setPosition(position + 1);
          }} /></View><HistorySaveNotice error={activity.error} retry={activity.retry} />
      </> : <View style={s.card}><Text style={s.heading}>No questions available</Text><Text style={s.body}>Choose another lesson or difficulty.</Text><Button label="Choose a lesson" onPress={leaveLesson} /></View>}
  </LearnScreen>;
}

