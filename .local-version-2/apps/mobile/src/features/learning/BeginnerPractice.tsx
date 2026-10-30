import { useCallback, useState, type ReactNode } from "react";
import { Image, Pressable, View } from "react-native";
import { Text } from "../../accessibility/Primitives";

import { useFocusEffect } from "expo-router";
import { ErrorMessage } from "../../components/ui";
import type { Language } from "../../services/api/identity";
import { homeColors as c } from "../../theme/personal";
import { exercisesFor, sentenceChallenge, starterMatches, starterReady, type StarterExercise, type StarterKind } from "./beginnerLessons";
import { useLessonSpeech } from "./useLessonSpeech";
import { SentenceCards } from "./SentenceCards";
import { l, LearnButton, LearnHero, LearnLink, LearnProgress } from "./LearnUI";
import type { PersonalHistoryAccess } from "../../services/api/personalHistory";
import { useActivityHistory } from "../history/useActivityHistory";
import { HistorySaveNotice } from "../history/HistorySaveNotice";

export function StarterExerciseView({ item, language, onNext, last, history, owner }: { item: StarterExercise; language: Language; onNext: () => void; last: boolean; history?: PersonalHistoryAccess; owner?: string }) {
  const activity = useActivityHistory(history, owner);
  const [answer, setAnswer] = useState<string[]>([]), [feedback, setFeedback] = useState<"correct" | "retry" | null>(null);
  const [transcript, setTranscript] = useState(false), [listened, setListened] = useState(false);
  const speech = useLessonSpeech(language, item.id);
  const ready = starterReady(item, answer), locked = feedback === "correct";
  const play = (slow: boolean) => { void speech.play(item.spoken, slow).then(started => { if (started) setListened(true); }); };
  return <View style={{ gap: 14 }}>
    <View style={[l.card, l.taskCard]}>
      <Text accessibilityRole="header" style={l.taskTitle}>{item.kind === "word" ? "What do you hear?" : "Build the sentence"}</Text>
      <Text style={[l.body, { textAlign: "center" }]}>{item.kind === "word" ? "Listen, then choose an answer." : "Listen and put the words in order."}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Play audio" accessibilityState={{ busy: speech.speaking }} onPress={() => play(false)} style={({ pressed }) => [l.play, pressed && l.pressed]}>
        <Image accessible={false} source={require("../../../assets/icons/speaker.png")} style={l.speaker} />
      </Pressable>
      <Text accessibilityLiveRegion="polite" style={l.playLabel}>{speech.speaking ? "Playing… Tap to replay" : "Play audio"}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Play slowly" onPress={() => play(true)} style={({ pressed }) => [l.slow, pressed && l.pressed]}><Text style={l.body}>▷  Play slowly</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={transcript ? "Hide words" : "Show words"} accessibilityState={{ expanded: transcript }} onPress={() => setTranscript(value => !value)} style={l.wordsButton}>
        <Text style={l.wordsText}>{transcript ? "Hide words" : "Show words"}</Text>
      </Pressable>
      {transcript && <View style={[l.note, { alignSelf: "stretch" }]}><Text style={[l.heading, { textAlign: "center" }]}>{item.spoken}</Text></View>}
      {!!speech.error && <ErrorMessage message={speech.error} />}
    </View>
    {item.kind === "word" ? <View accessibilityRole="radiogroup" accessibilityLabel="Choose the word or phrase you heard" style={l.answerGroup}>{item.options.map(option => {
      const selected = answer[0] === option.id;
      return <Pressable key={option.id} accessibilityRole="radio" accessibilityLabel={option.text}
        accessibilityState={{ checked: selected, disabled: locked }} aria-checked={selected} disabled={locked}
        onPress={() => { setAnswer([option.id]); setFeedback(null); }} style={({ pressed }) => [l.answer, selected && l.selectedAnswer, pressed && !locked && l.pressed]}>
        <View accessible={false} style={[l.radio, selected && l.checkedRadio]}>{selected && <View style={l.radioDot} />}</View>
        <Text style={[l.answerText, selected && { fontWeight: "700" }]}>{option.text}</Text>
      </Pressable>;
    })}</View> : <SentenceCards item={item} answer={answer} locked={locked} onChange={value => { setAnswer(value); setFeedback(null); }} />}
    {!!feedback && <View accessibilityLiveRegion="polite" style={[l.feedback, feedback === "retry" && l.retryFeedback]}>
      <Text style={[l.heading, { color: c.teal }]}>{feedback === "correct" ? item.kind === "word" ? "You got it!" : "You built the sentence!" : "Not quite. Try again."}</Text>
      {feedback === "retry" && <Text style={l.body}>Play the audio again or choose another answer.</Text>}
    </View>}
    <HistorySaveNotice error={activity.error} retry={activity.retry} />
    <LearnButton label={locked ? last ? "Finish activity" : "Next exercise" : "Check answer"} disabled={!locked && (!ready || (!listened && !transcript))} onPress={() => {
      if (locked) { onNext(); return; }
      if (!ready || (!listened && !transcript)) return;
      activity.recordOnce(item.id, { kind: "learn_question", source_id: item.id, content_version: 2, title: item.kind === "word" ? "Listen & choose" : "Build a sentence", prompt: item.spoken, language });
      setFeedback(starterMatches(item, answer) ? "correct" : "retry");
    }} />
  </View>;
}

export function BeginnerPractice({ language, history, owner, picker, onExitChange, onNavigate }: { language: Language; history?: PersonalHistoryAccess; owner?: string; picker?: ReactNode; onExitChange?: (exit: (() => void) | null) => void; onNavigate?: () => void }) {
  const activity = useActivityHistory(history, owner);
  const [run, setRun] = useState(0);
  const [kind, setKind] = useState<StarterKind | null>(null), [position, setPosition] = useState(0), [finished, setFinished] = useState(false);
  const leave = useCallback(() => { setKind(null); setPosition(0); setFinished(false); onExitChange?.(null); }, [onExitChange]);
  // Navigation and language changes cancel playback and reset this visit's activity.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useFocusEffect(useCallback(() => () => { setKind(null); setPosition(0); setFinished(false); onExitChange?.(null); }, [language, onExitChange]));
  const items = kind ? exercisesFor(language, kind) : [];
  if (!kind) return <View style={{ gap: 17 }}>
    <LearnHero />{picker}<Text accessibilityRole="header" style={l.heading}>Pick an activity</Text>
    {([{ kind: "word", title: "Listen and choose", description: "Hear a word. Pick what you hear." }, { kind: "sentence", title: "Build a sentence", description: "Listen and put the words in order." }] as const).map(activity => <View key={activity.kind} style={l.card}>
      <View style={l.activityTop}>
        <View style={[l.activityArt, activity.kind === "sentence" && { backgroundColor: "#E8F2DC" }]}>
          <Image accessible={false} source={activity.kind === "word" ? require("../../../assets/illustrations/learn-listening.png") : require("../../../assets/illustrations/learn-sentence.png")} resizeMode="contain" style={l.activityImage} />
        </View>
        <View style={l.activityCopy}><Text accessibilityRole="header" style={l.heading}>{activity.title}</Text><Text style={l.body}>{activity.description}</Text></View>
      </View>
      <LearnButton label={activity.kind === "word" ? "Start listening" : "Start building"} secondary={activity.kind === "sentence"} onPress={() => { setKind(activity.kind); setPosition(0); setFinished(false); onExitChange?.(leave); }} />
    </View>)}
  </View>;
  if (finished) return <View style={{ gap: 16 }}><LearnLink label="Activities" onPress={leave} /><View style={[l.card, l.completion]}>
    <Image accessible={false} source={require("../../../assets/illustrations/activity-learn.png")} style={l.completionImage} />
    <Text accessibilityRole="header" style={l.title}>Nice practice!</Text><Text style={[l.body, { textAlign: "center" }]}>You finished this activity. Try it again or pick something new.</Text>
    <View style={{ width: "100%", gap: 10 }}><HistorySaveNotice error={activity.error} retry={activity.retry} />
      <LearnButton label="Choose another activity" onPress={() => { leave(); setRun(value => value + 1); }} />
      <LearnButton secondary label="Practice again" onPress={() => { setPosition(0); setFinished(false); setRun(value => value + 1); onNavigate?.(); }} />
    </View>
  </View></View>;
  return <View style={{ gap: 16 }}><LearnLink label="Activities" onPress={leave} /><LearnProgress position={position + 1} total={items.length} />
    <StarterExerciseView key={`${language}-${items[position].id}`} history={history} owner={owner} item={sentenceChallenge(items[position], position)} language={language} last={position === items.length - 1} onNext={() => {
      onNavigate?.();
      if (position === items.length - 1) { activity.recordOnce(`${run}-${kind}`, { kind: "learn_lesson", source_id: `starter-${kind}`, content_version: 2, title: kind === "word" ? "Listen & choose" : "Build a sentence", language }); setFinished(true); }
      else setPosition(position + 1);
    }} />
  </View>;
}
