import { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Button, ErrorMessage } from "../../components/ui";
import type { Language } from "../../services/api/identity";
import { p, pc } from "../../theme/personal";
import { exercisesFor, starterMatches, starterReady, type StarterExercise, type StarterKind } from "./beginnerLessons";
import { useLessonSpeech } from "./useLessonSpeech";
import { SentenceCards } from "./SentenceCards";

export function StarterExerciseView({ item, language, onNext, last }: { item: StarterExercise; language: Language; onNext: () => void; last: boolean }) {
  const [answer, setAnswer] = useState<string[]>([]), [feedback, setFeedback] = useState<"correct" | "retry" | null>(null);
  const [transcript, setTranscript] = useState(false), [listened, setListened] = useState(false);
  const speech = useLessonSpeech(language, item.id);
  const ready = starterReady(item, answer), locked = feedback === "correct";
  const play = (slow: boolean) => { void speech.play(item.spoken, slow).then(started => { if (started) setListened(true); }); };
  return <View style={{ gap: 20 }}>
    <View style={p.card}><View style={p.row}><Text style={p.eyebrow}>{item.kind === "word" ? "Listen & choose" : "Listen & build"}</Text><View style={p.chip}><Text style={p.chipText}>{language === "english" ? "English" : "Tagalog"} · Easy</Text></View></View>
      <Text accessibilityRole="header" style={p.heading}>{item.kind === "word" ? "What do you hear?" : "Build the sentence you hear."}</Text>
      <Text style={p.body}>{item.kind === "word" ? "Play the sound, then choose the matching word or phrase below." : "Listen, then drag the word cards into the sentence area in the correct order. Leave any extra word below. You can also tap cards and use the position controls."}</Text>
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
    {!!feedback && <View accessibilityLiveRegion="polite" style={[p.note, { backgroundColor: feedback === "correct" ? pc.aqua : pc.pink }]}><Text style={{ color: feedback === "correct" ? pc.teal : pc.rose, fontWeight: "700" }}>{feedback === "correct" ? item.kind === "word" ? "That’s the word!" : "You built the sentence!" : "Not quite. Play it again and try another answer."}</Text><Text style={p.caption}>Practice feedback only · No grade or progress record is saved.</Text></View>}
    <Button label={locked ? last ? "Finish activity" : "Next exercise" : "Check answer"} disabled={!locked && (!ready || (!listened && !transcript))} onPress={() => locked ? onNext() : setFeedback(starterMatches(item, answer) ? "correct" : "retry")} />
  </View>;
}

export function BeginnerPractice({ language }: { language: Language }) {
  const [kind, setKind] = useState<StarterKind | null>(null), [position, setPosition] = useState(0), [finished, setFinished] = useState(false);
  // Reset the activity when the selected learning language changes as well as on blur.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useFocusEffect(useCallback(() => () => { setKind(null); setPosition(0); setFinished(false); }, [language]));
  const items = kind ? exercisesFor(language, kind) : [];
  if (!kind) return <View style={{ gap: 18 }}><Text style={p.body}>Start with listening. Hear a word, recognise it, then put simple sentences together.</Text>
    {([{ kind: "word", title: "Listen & choose", description: "Start with single words, then listen for two-word and three-word phrases.", icon: "♬" }, { kind: "sentence", title: "Build a sentence", description: "Hear a sentence, drag the matching word cards into order, and leave any extra words behind.", icon: "▤" }] as const).map(activity => <View key={activity.kind} style={p.card}><Text style={{ fontSize: 28, color: pc.rose }}>{activity.icon}</Text><Text accessibilityRole="header" style={p.heading}>{activity.title}</Text><Text style={p.body}>{activity.description}</Text>
      <Text style={p.caption}>Starter practice · {exercisesFor(language, activity.kind).length} exercises · {language === "english" ? "English" : "Tagalog"}</Text><Button label={activity.kind === "word" ? "Start listening practice" : "Start sentence practice"} onPress={() => { setKind(activity.kind); setPosition(0); setFinished(false); }} /></View>)}</View>;
  if (finished) return <View style={p.card}><Text accessibilityRole="header" style={p.heading}>Nice practice!</Text><Text style={p.body}>You reached the end of this starter activity. Listen again or try the other activity.</Text><Button label="Choose another activity" onPress={() => { setKind(null); setPosition(0); setFinished(false); }} /><Button secondary label="Practise again" onPress={() => { setPosition(0); setFinished(false); }} /></View>;
  return <View style={{ gap: 18 }}><Button secondary label="Back to starter activities" onPress={() => { setKind(null); setPosition(0); }} /><Text style={p.caption}>Exercise {position + 1} of {items.length} · {kind === "word" ? `${items[position].spoken.split(" ").length} ${items[position].spoken.split(" ").length === 1 ? "word" : "words"}` : "Sentence building"}</Text>
    <StarterExerciseView key={`${language}-${items[position].id}`} item={items[position]} language={language} last={position === items.length - 1} onNext={() => position === items.length - 1 ? setFinished(true) : setPosition(index => index + 1)} /></View>;
}
