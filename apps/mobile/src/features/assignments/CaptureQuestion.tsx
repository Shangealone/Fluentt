import { useState } from "react";
import { Text, View } from "react-native";
import { Button, ErrorMessage, s } from "../../components/ui";
import type { AssignmentItem } from "../../services/api/assignments";
import type { RevealedBack } from "../../services/api/capture";
import { ChoiceQuestion } from "../questions/ChoiceQuestion";
import { choiceItemFromRevision, type ChoiceResponse } from "../questions/choice";
import { TextQuestion } from "../questions/TextQuestion";
import { textItemFromRevision, type TextValues } from "../questions/text";
import { MultiSelectionQuestion } from "../questions/MultiSelectionQuestion";
import { multiItemFromRevision, type MultiResponse } from "../questions/multi";
import { ArrangementQuestion } from "../questions/ArrangementQuestion";
import { arrangementItemFromRevision } from "../questions/arrangement";
import { MatchingQuestion } from "../questions/MatchingQuestion";
import { matchingItemFromRevision, type MatchPair } from "../questions/matching";
import { FlashcardQuestion } from "../questions/FlashcardQuestion";
import { flashcardFrontFromRevision, type Recall } from "../questions/flashcards";
import { p, pc } from "../../theme/personal";

export function CaptureQuestion({ item, answer, back, disabled, onChange, onReveal, review = false, practice = false }: {
  item: AssignmentItem & { assignment_question_id?: string }; answer: Record<string, unknown> | undefined; back: Pick<RevealedBack, "revision_id" | "back"> | null; disabled: boolean;
  onChange: (answer: Record<string, unknown>) => void; onReveal: () => void;
  review?: boolean;
  practice?: boolean;
}) {
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const method = item.definition.method;
  if (method === "multiple_choice" || method === "true_false") {
    const value = choiceItemFromRevision(item);
    if (value) return <ChoiceQuestion item={value} value={answer ? { method, answer } as ChoiceResponse : null} disabled={disabled || review} review={review} onChange={next => onChange(next.answer)} />;
  } else if (method === "identification" || method === "fill_in_the_blank") {
    const value = textItemFromRevision(item);
    const fields: TextValues = method === "identification" ? { text: typeof answer?.text === "string" ? answer.text : "" }
      : Object.fromEntries(((answer?.blanks ?? []) as { blank_id: string; text: string }[]).map(entry => [entry.blank_id, entry.text]));
    if (value) return <TextQuestion item={value} value={fields} disabled={disabled || review} review={review} onChange={next => onChange(method === "identification" ? { text: next.text ?? "" }
      : { blanks: (value.content as { blank_ids: string[] }).blank_ids.map(id => ({ blank_id: id, text: next[id] ?? "" })) })} />;
  } else if (method === "multiple_select" || method === "error_identification") {
    const value = multiItemFromRevision(item);
    if (value) return <MultiSelectionQuestion item={value} value={answer ? { method, answer } as MultiResponse : null} disabled={disabled || review} review={review} onChange={next => onChange(next.answer)} />;
  } else if (method === "word_arrangement" || method === "sentence_arrangement") {
    const value = arrangementItemFromRevision(item), key = method === "word_arrangement" ? "ordered_token_ids" : "ordered_sentence_ids";
    if (value) return <ArrangementQuestion item={value} value={(answer?.[key] ?? []) as string[]} disabled={disabled || review} review={review} onChange={next => onChange({ [key]: next })} />;
  } else if (method === "matching_type") {
    const value = matchingItemFromRevision(item);
    if (value) return <MatchingQuestion item={value} value={(answer?.pairs ?? []) as MatchPair[]} selectedLeft={selectedLeft} onSelectLeft={setSelectedLeft} disabled={disabled || review} review={review} onChange={pairs => { setSelectedLeft(null); onChange({ pairs }); }} />;
  } else {
    const front = flashcardFrontFromRevision(item);
    if (front && review) return <View style={s.card}><Text style={s.heading} accessibilityRole="header">{front.prompt}</Text>
      {!!front.instructions && <Text style={s.body}>{front.instructions}</Text>}<Text style={s.body}>{front.cue}</Text>
      <Text style={s.body}>Submitted recall: {typeof answer?.recall === "string" ? answer.recall : "No self-report"}. Subjective recall is not objectively scored. Card back withheld.</Text></View>;
    if (front && !back) return <View style={practice ? p.card : s.card}>{practice && <Text style={p.eyebrow}>Active recall · Flashcard</Text>}<Text style={practice ? p.heading : s.heading} accessibilityRole="header">{front.prompt}</Text>
      {!!front.instructions && <Text style={s.body}>{front.instructions}</Text>}<Text style={practice ? { fontSize: 30, color: pc.ink, fontWeight: "600", paddingVertical: 12 } : s.body}>{front.cue}</Text>
      <Button label={practice ? "Reveal card back" : "Reveal assignment card back"} disabled={disabled} onPress={onReveal} />
      <Text style={s.body}>{practice ? "Think of your answer, reveal the card, then optionally report how it felt." : "Reveal deliberately, then optionally report recall. This is unscored classroom capture, without spaced-repetition scheduling."}</Text></View>;
    if (front && back) return <FlashcardQuestion front={front} back={back} value={{ revealed: true, recall: answer?.recall as Recall ?? null }}
      practice={practice} allowRecallRevision={!practice} disabled={disabled || review} onChange={next => { if (next.recall) onChange({ recall: next.recall }); }} />;
  }
  return <ErrorMessage message={practice ? "This question format could not be verified. Choose another lesson." : "This question format could not be verified. Reload the assignment before continuing."} />;
}
