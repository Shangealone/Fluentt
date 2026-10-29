import { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Button, ErrorMessage } from "../../components/ui";
import type { Language } from "../../services/api/identity";
import { p, pc } from "../../theme/personal";
import { exercisesFor, sentenceChallenge, starterMatches, starterReady, type StarterExercise, type StarterKind } from "./beginnerLessons";
import { useLessonSpeech } from "./useLessonSpeech";
import { SentenceCards } from "./SentenceCards";
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
  return <View style={{ gap: 20 }}>
    <View style={p.card}><View style={p.row}><Text style={p.eyebrow}>{item.kind === "word" ? "Listen & choose" : "Listen & build"}</Text><View style={p.chip}><Text style={p.chipText}>{language === "english" ? "English" : "Tagalog"} · Easy</Text></View></View>
      <Text accessibilityRole="header" style={p.heading}>{item.kind === "word" ? "What do you hear?" : "Build the sentence you hear."}</Text>
      <Text style={p.body}>{item.kind === "word" ? "Play the sound, then choose the matching word or phrase below." : "Listen, then drag the word cards into the sentence area in the correct order. Only use the words you hear. You can also tap cards and use the position controls."}</Text>
      {item.kind === "sentence" && item.distractorIds.length > 0 && <View style={p.note}><Text style={{ color: pc.teal, fontWeight: "600" }}>{item.distractorIds.length} extra {item.distractorIds.length === 1 ? "word" : "words"} · Leave {item.distractorIds.length === 1 ? "it" : "them"} in the word bank.</Text><Text style={p.caption}>Listen carefully: some cards could make a different sentence.</Text></View>}
        <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}><Button label={speech.speaking ? "Replay audio" : item.kind === "word" ? item.spoken.includes(" ") ? "Play phrase" : "Play word" : "Play sentence"} icon="♬" onPress={() => play(false)} />
        <Button secondary label="Play slowly" onPress={() => play(true)} /></View>
      <Text style={p.caption}>Device-generated voice · Turn up your volume. On iPhone, turn off silent mode.</Text>
      {!!speech.error && <ErrorMessage message={speech.error} />}
      <Button secondary size="sm" label={transcript ? "Hide transcript" : "Show transcript"} onPress={() => setTranscript(value => !value)} />
      {transcript && <View style={p.note}><Text style={{ color: pc.ink, fontSize: 20, lineHeight: 30 }}>{item.spoken}</Text><Text style={p.caption}>Reading support is on. Hide this to practise listening.</Text></View>}
    </View>
    {item.kind === "word" ? <View accessibilityRole="radiogroup" accessibilityLabel="Choose the word or phrase you heard" style={{ gap: 12 }}>{item.options.map(option => <Pressable key={option.id} accessibilityRole="radio" accessibilityLabel={option.text}
      accessibilityState={{ checked: answer[0] === option.id, disabled: locked }} aria-checked={answer[0] === option.id} disabled={locked}
      onPress={() => { setAnswer([option.id]); setFeedback(null); }} style={[p.card, { borderColor: answer[0] === option.id ? pc.rose : pc.line, backgroundColor: answer[0] === option.id ? pc.pink : "white" }]}>
      <Text style={{ color: pc.ink, fontSize: 21, fontWeight: "600" }}>{answer[0] === option.id ? "◉" : "○"} {option.text}</Text></Pressable>)}</View>
      : <SentenceCards item={item} answer={answer} locked={locked} onChange={value => { setAnswer(value); setFeedback(null); }} />}
    {!!feedback && <View accessibilityLiveRegion="polite" style={[p.note, { backgroundColor: feedback === "correct" ? pc.aqua : pc.pink }]}><Text style={{ color: feedback === "correct" ? pc.teal : pc.rose, fontWeight: "700" }}>{feedback === "correct" ? item.kind === "word" ? "That’s the word!" : "You built the sentence!" : "Not quite. Play it again and try another answer."}</Text><Text style={p.caption}>Practice feedback only · No grade is recorded.</Text></View>}
    <HistorySaveNotice error={activity.error} retry={activity.retry} />
    <Button label={locked ? last ? "Finish activity" : "Next exercise" : "Check answer"} disabled={!locked && (!ready || (!listened && !transcript))} onPress={() => {
      if (locked) { onNext(); return; }
      if (!ready || (!listened && !transcript)) return;
      activity.recordOnce(item.id, { kind: "learn_question", source_id: item.id, content_version: 2, title: item.kind === "word" ? "Listen & choose" : "Build a sentence", prompt: item.spoken, language });
      setFeedback(starterMatches(item, answer) ? "correct" : "retry");
    }} />
  </View>;
}

export function BeginnerPractice({ language, history, owner }: { language: Language; history?: PersonalHistoryAccess; owner?: string }) {
  const activity = useActivityHistory(history, owner);
  const [run, setRun] = useState(0);
  const [kind, setKind] = useState<StarterKind | null>(null), [position, setPosition] = useState(0), [finished, setFinished] = useState(false);
  // Reset the activity when the selected learning language changes as well as on blur.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useFocusEffect(useCallback(() => () => { setKind(null); setPosition(0); setFinished(false); }, [language]));
  const items = kind ? exercisesFor(language, kind) : [];
  if (!kind) return <View style={{ gap: 18 }}><Text style={p.body}>Start with listening. Hear a word, recognise it, then put simple sentences together.</Text>
    {([{ kind: "word", title: "Listen & choose", description: "Start with single words, then listen for two-word and three-word phrases.", icon: "♬" }, { kind: "sentence", title: "Build a sentence", description: "Hear a sentence and arrange only the words you hear. After three warm-ups, more correct sentences bring more extra words to leave behind.", icon: "▤" }] as const).map(activity => <View key={activity.kind} style={p.card}><Text style={{ fontSize: 28, color: pc.rose }}>{activity.icon}</Text><Text accessibilityRole="header" style={p.heading}>{activity.title}</Text><Text style={p.body}>{activity.description}</Text>
      <Text style={p.caption}>Starter practice · {exercisesFor(language, activity.kind).length} exercises · {language === "english" ? "English" : "Tagalog"}</Text><Button label={activity.kind === "word" ? "Start listening practice" : "Start sentence practice"} onPress={() => { setKind(activity.kind); setPosition(0); setFinished(false); }} /></View>)}</View>;
  if (finished) return <View style={p.card}><Text accessibilityRole="header" style={p.heading}>Nice practice!</Text><Text style={p.body}>You reached the end of this starter activity. Listen again or try the other activity.</Text><HistorySaveNotice error={activity.error} retry={activity.retry} /><Button label="Choose another activity" onPress={() => { setKind(null); setPosition(0); setFinished(false); setRun(value => value + 1); }} /><Button secondary label="Practise again" onPress={() => { setPosition(0); setFinished(false); setRun(value => value + 1); }} /></View>;
  return <View style={{ gap: 18 }}><Button secondary label="Back to starter activities" onPress={() => { setKind(null); setPosition(0); }} /><Text style={p.caption}>Exercise {position + 1} of {items.length} · {kind === "word" ? `${items[position].spoken.split(" ").length} ${items[position].spoken.split(" ").length === 1 ? "word" : "words"}` : position < 3 ? "Sentence warm-up" : "Sentence challenge"}</Text>
    <StarterExerciseView key={`${language}-${items[position].id}`} history={history} owner={owner} item={sentenceChallenge(items[position], position)} language={language} last={position === items.length - 1} onNext={() => {
      if (position === items.length - 1) { activity.recordOnce(`${run}-${kind}`, { kind: "learn_lesson", source_id: `starter-${kind}`, content_version: 2, title: kind === "word" ? "Listen & choose" : "Build a sentence", language }); setFinished(true); }
      else setPosition(position + 1);
    }} /></View>;
}
