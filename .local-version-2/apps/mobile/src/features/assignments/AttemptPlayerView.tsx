import { type ComponentRef, useEffect, useRef, type ReactNode } from "react";
import { ActivityIndicator, Pressable, ScrollView, View, type LayoutChangeEvent } from "react-native";
import { Text, useWindowDimensions } from "../../accessibility/Primitives";
import { PersonalIcon } from "../../components/PersonalIcon";
import type { Attempt } from "../../services/api/capture";
import { homeColors as c } from "../../theme/personal";
import { AssignmentPresentation } from "../../theme/assignment";
import { responseComplete, type Buffers } from "./captureState";
import { AttemptFrame, AttemptHero, AttemptButton, AttemptDisclosure, SubmissionReceiptArt, a } from "./AttemptUI";

export type AttemptConfirmation = { title: string; message: string; label: string; accept: () => void };
type Props = {
  row: Attempt; buffers: Buffers; position: number; dirty: boolean; busy: boolean; uncertain: boolean; blocked: boolean;
  pending: boolean; error: string; notice: string; menu: boolean; review: boolean; focusRevision: number; confirmation: AttemptConfirmation | null;
  operation: "save" | "submit" | "reload" | "reveal" | null; question: ReactNode;
  onBack: () => void; onAccount: () => void; onMenu: () => void; onMove: (position: number) => void;
  onReview: () => void; onKeepWorking: () => void; onSave: () => void; onClear: () => void;
  onReload: () => void; onRetrySubmit: () => void; onSubmit: () => void; onCancel: () => void; onConfirm: () => void;
};
const methods: Record<string, string> = { multiple_choice: "Multiple choice", true_false: "True or false", identification: "Identification", fill_in_the_blank: "Fill in the blanks", multiple_select: "Multiple select", error_identification: "Find the error", word_arrangement: "Arrange words", sentence_arrangement: "Arrange sentences", matching_type: "Matching", flashcards: "Flashcard" };

export function AttemptPlayerView(p: Props) {
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const { fontScale } = useWindowDimensions();
  const completed = p.row.questions.filter(item => responseComplete(item, p.buffers[item.assignment_question_id])).length;
  const frozen = p.busy || p.uncertain || p.pending || p.blocked;
  const focusKey = `${p.position}:${p.review}:${p.focusRevision}:${p.confirmation?.title ?? ""}:${p.row.status}:${p.blocked}`;
  const previousFocus = useRef(focusKey);
  useEffect(() => { if (p.error) scroll.current?.scrollTo({ y: 0, animated: false }); }, [p.error]);
  function focusLayout(event: LayoutChangeEvent) {
    if (previousFocus.current !== focusKey) {
      previousFocus.current = focusKey;
      scroll.current?.scrollTo({ y: event.nativeEvent.layout.y, animated: false });
    }
  }
  const focusProps = { onLayout: focusLayout };
  const item = p.row.questions[p.position - 1];
  return <AssignmentPresentation.Provider value={true}><AttemptFrame scrollRef={scroll} onBack={p.onBack} onAccount={p.onAccount} disabled={p.busy || !!p.confirmation}>
    <AttemptHero title={p.blocked ? undefined : p.row.title} />
    {!!p.error && <View style={[a.notice, a.warning]} accessibilityRole="alert"><Text style={a.error}>{p.error}</Text></View>}
    {!!p.notice && <View style={a.notice}><Text accessibilityLiveRegion="polite" style={a.body}>{p.notice}</Text></View>}
    {p.confirmation ? <View key={focusKey} {...focusProps} style={a.card}>
      <Text accessibilityRole="header" style={a.heading}>{p.confirmation.title}</Text><Text style={a.body}>{p.confirmation.message}</Text>
      <AttemptButton label={p.confirmation.label} onPress={p.onConfirm} disabled={p.busy} />
      <AttemptButton label={p.confirmation.title === "Submit this assignment?" ? "Keep reviewing" : "Stay here"} secondary onPress={p.onCancel} disabled={p.busy} />
    </View> : p.blocked ? <View key={focusKey} {...focusProps} style={a.card}>
      <Text accessibilityRole="header" style={a.heading}>We couldn’t open this assignment</Text><Text style={a.body}>Access could not be checked. Your questions and answers are hidden. Restore access and reload your saved progress.</Text>
      <AttemptButton label="Reload saved progress" onPress={p.onReload} disabled={p.busy} />
      <AttemptButton label="Back to assignment" secondary onPress={p.onBack} disabled={p.busy} />
    </View> : p.row.status === "submitted" ? <View key={focusKey} {...focusProps} style={[a.card, a.centered]}>
      <SubmissionReceiptArt /><Text accessibilityRole="header" style={[a.heading, a.centerText]}>Assignment submitted</Text>
      <Text style={[a.body, a.centerText]}>Your submission has been received.</Text>
      <Text style={[a.small, a.centerText]}>{p.row.submitted_at ? new Date(p.row.submitted_at).toLocaleString() : ""}{"\n"}{p.row.completed_count} of {p.row.question_count} questions answered</Text>
      <View style={a.notice}><Text style={a.body}>Your answers are now saved and can’t be changed. Results will appear when they’re available.</Text></View>
      <AttemptButton label="Back to assignment" onPress={p.onBack} />
    </View> : <>
      {!!p.row.instructions && <AttemptDisclosure label="Assignment instructions"><Text style={a.body}>{p.row.instructions}</Text></AttemptDisclosure>}
      {!p.review && <View style={a.meta}><View style={a.row}><Text accessibilityRole="header" style={a.itemTitle}>Question {p.position} of {p.row.question_count}</Text>
        <View style={a.stateLabel}><Text accessible={false} style={[a.label, p.dirty && a.dirty]}>{p.dirty ? "○" : "✓"}</Text><Text style={[a.label, p.dirty && a.dirty]}>{p.dirty ? "Unsaved changes" : "Saved"}</Text></View>
      </View><Text accessibilityLiveRegion="polite" style={a.small}>{completed} of {p.row.question_count} questions answered</Text></View>}
      {p.busy && <View style={[a.notice, a.row]}><ActivityIndicator size="small" color={c.teal} /><Text accessibilityLiveRegion="polite" style={a.body}>{p.operation === "save" ? "Saving your progress…" : p.operation === "submit" ? "Submitting your assignment…" : p.operation === "reload" ? "Loading saved progress…" : "Opening the card…"}</Text></View>}
      {!p.busy && p.pending ? <View style={[a.notice, a.warning]}><Text style={a.itemTitle}>We couldn’t confirm your submission</Text><Text style={a.body}>Your original submission is ready to retry. Your answers are kept unchanged.</Text><AttemptButton label="Retry original submission" onPress={p.onRetrySubmit} /><AttemptButton label="Check saved status" secondary onPress={p.onReload} /></View>
        : !p.busy && p.uncertain ? <View style={[a.notice, a.warning]}><Text style={a.itemTitle}>We couldn’t confirm the saved state</Text><Text style={a.body}>Reload saved progress to check what was saved. Reloading replaces your unsaved answers.</Text><AttemptButton label="Reload saved progress" secondary onPress={p.onReload} /></View> : null}
      {p.review ? <View key={focusKey} {...focusProps} style={a.card}>
        <Text accessibilityRole="header" style={a.heading}>Review your submission</Text><Text style={a.body}>Take a moment to check your answers.</Text>
        <View style={[a.reviewCounts, fontScale > 1.2 && a.stackedStepper]}>{[{ count: completed, label: "Answered" }, { count: p.row.question_count - completed, label: "Unanswered or incomplete" }].map(value => <View key={value.label} style={[a.reviewCount, fontScale > 1.2 && a.stackedStep]}><Text style={a.number}>{value.count}</Text><Text style={[a.small, a.centerText]}>{value.label}</Text></View>)}</View>
        <Text style={a.small}>These counts describe your responses. They don’t tell you whether an answer is correct.</Text>
        <View>{p.row.questions.map((q, index) => <View key={q.assignment_question_id} style={a.reviewRow}><View style={a.reviewCopy}><Text style={a.itemTitle}>Question {index + 1}</Text><Text style={a.small}>{responseComplete(q, p.buffers[q.assignment_question_id]) ? "✓ Answered" : "○ Unanswered or incomplete"}</Text></View><Pressable accessibilityRole="button" accessibilityLabel={`Review question ${index + 1}`} disabled={frozen} accessibilityState={{ disabled: frozen }} style={[a.reviewLink, frozen && a.dim]} onPress={() => p.onMove(index + 1)}><Text style={a.label}>Review</Text></Pressable></View>)}</View>
        <AttemptButton label="Submit assignment" onPress={p.onSubmit} disabled={frozen} />
        <AttemptButton label="Keep working" secondary onPress={p.onKeepWorking} disabled={p.busy} />
        <Text style={a.small}>Your current answers are saved when submission is confirmed. You won’t be able to edit them afterwards.</Text>
      </View> : <>
        <View style={a.section}><Pressable accessibilityRole="button" accessibilityState={{ expanded: p.menu }} onPress={p.onMenu} style={a.disclosure}><View style={!p.menu && a.closedChevron}><PersonalIcon name="chevron" size={14} color={c.teal} /></View><Text style={a.label}>Questions · {completed} answered</Text></Pressable>
          {p.menu && <><Text style={a.small}>Answered means an answer is entered, rather than checked for correctness.</Text><View style={a.menu}>{p.row.questions.map((q, index) => {
            const current = p.position === index + 1, answered = responseComplete(q, p.buffers[q.assignment_question_id]);
            return <Pressable key={q.assignment_question_id} accessibilityRole="button" accessibilityLabel={`Question ${index + 1}${current ? ", current" : ""}, ${answered ? "answered" : "unanswered or incomplete"}`} accessibilityState={{ selected: current, disabled: frozen }} disabled={frozen} onPress={() => p.onMove(index + 1)} style={[a.jump, fontScale > 1.2 && a.fullJump, current && a.currentJump, frozen && a.dim]}><Text style={[a.label, current && a.white]}>Question {index + 1}</Text><Text style={[a.small, current && a.white]}>{current ? "Current · " : ""}{answered ? "✓ Answered" : "○ Unanswered"}</Text></Pressable>;
          })}</View></>}
        </View>
        {item ? <View key={focusKey} {...focusProps} style={a.card}><Text style={a.label}>{methods[item.definition.method] ?? "Question"}</Text>{p.question}</View> : <Text accessibilityRole="alert" style={a.error}>This question is unavailable. Reload your saved progress.</Text>}
        <View style={a.section}>
          <AttemptButton label={p.operation === "save" ? "Saving…" : "Save progress"} onPress={p.onSave} disabled={frozen || !p.dirty} busy={p.operation === "save"} />
          <Text style={a.small}>Changing questions keeps your answers on this page. Choose Save progress before leaving.</Text>
          <View style={[a.stepper, fontScale > 1.2 && a.stackedStepper]}><View style={[a.step, fontScale > 1.2 && a.stackedStep]}><AttemptButton label="Previous" secondary disabled={frozen || p.position === 1} onPress={() => p.onMove(p.position - 1)} /></View><View style={[a.step, fontScale > 1.2 && a.stackedStep]}>{p.position < p.row.question_count ? <AttemptButton label="Next" secondary disabled={frozen} onPress={() => p.onMove(p.position + 1)} /> : <AttemptButton label="Review submission" secondary disabled={frozen} onPress={p.onReview} />}</View></View>
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: frozen }} disabled={frozen} style={[a.quiet, frozen && a.dim]} onPress={p.onClear}><Text style={a.label}>Clear this answer</Text></Pressable>
        </View>
      </>}
      <View style={a.bottom}><AttemptButton label="Reload saved progress" secondary onPress={p.onReload} disabled={p.busy} /></View>
      <AttemptDisclosure label="About this assignment"><Text style={a.small}>You have one resumable attempt and no timer. Answers are saved only when you choose Save progress or confirm submission. Closing the app loses answers that haven’t been saved.</Text><Text style={a.small}>Answered labels show whether a response is entered. Scores and results aren’t shown during the assignment.</Text></AttemptDisclosure>
    </>}
  </AttemptFrame></AssignmentPresentation.Provider>;
}
