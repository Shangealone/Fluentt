import type { ReactNode } from "react";
import { ActivityIndicator, View } from "react-native";
import { Text } from "../../accessibility/Primitives";
import type { AssessmentResult } from "../../services/api/results";
import { b, BuilderButton, BuilderNotice } from "./BuilderUI";
import { r, ResultsDisclosure, ResultsPerson } from "./ResultsUI";
import { CaptureQuestion } from "./CaptureQuestion";

type Props = { row: AssessmentResult; position: number; busy: boolean; error: string; uncertain: boolean; blocked: boolean; confirm: boolean; pending: boolean; leaving: boolean; evaluationHistory?: ReactNode; onShare: () => void; onConfirm: () => void; onCancel: () => void; onRetry: () => void; onStay: () => void; onLeave: () => void; onPosition: (value: number) => void };
export function InstructorResultView(p: Props) {
  const { row, busy, uncertain } = p, item = row.items[p.position];
  if (p.blocked) return <BuilderNotice error>Access is no longer available. Refresh to check your class and sign-in.</BuilderNotice>;
  const status = uncertain ? "Sharing status uncertain" : busy ? "Saving visibility…" : ({ not_submitted: row.submission_status === "in_progress" ? "Work in progress" : "Not submitted", submitted: "Waiting for evaluation", awaiting_manual_review: "Needs review", withheld: "Not shared yet", released: "Shared with student", not_applicable: "No score available" })[row.state];
  const explanation = ({ not_submitted: "A student needs to submit their work before it can be evaluated.", submitted: "This submission does not have a score yet. Ask your administrator to check the evaluation.", awaiting_manual_review: "This submission needs further review before a final score can be shared.", withheld: "Only you can see this result until you share it with the student.", released: "This student can see their points and answer review.", not_applicable: "Objective scoring does not apply to this work. No points are available." })[row.state];
  return <View style={b.stack}>
    <Text accessibilityRole="header" style={b.heading}>{row.title}</Text><ResultsPerson username={row.student_username ?? "Student"} submitted={row.submitted_at} />
    {!!p.error && <BuilderNotice error>{p.error}</BuilderNotice>}
    {p.leaving ? <View style={b.card}><Text accessibilityRole="header" style={b.heading}>Leave this review?</Text><Text style={b.body}>If sharing was interrupted, refresh this submission before making another change.</Text><BuilderButton label="Stay here" primary onPress={p.onStay} /><BuilderButton label="Leave and check later" onPress={p.onLeave} /></View>
      : p.confirm ? <View style={b.card}><Text accessibilityRole="header" style={b.heading}>{row.released ? "Stop sharing this result?" : "Share this result?"}</Text><Text style={b.body}>{row.released ? "The student will lose access to their points and answer review. Their submitted work and result history will stay saved." : "This student can view their points, question outcomes, and original answers. Expected answers and private feedback stay hidden. This evaluation will stay selected for their result."}</Text><BuilderButton label={row.released ? "Stop sharing" : "Share result"} primary disabled={busy} onPress={p.onConfirm} /><BuilderButton label="Keep reviewing" disabled={busy} onPress={p.onCancel} /></View> : <View style={b.card}>
        <View style={[r.badge, row.released && r.shared, row.state === "awaiting_manual_review" && r.review]}><Text accessibilityLiveRegion="polite" style={[r.badgeText, row.released && r.sharedText, row.state === "awaiting_manual_review" && r.reviewText]}>{status}</Text></View>
        {!uncertain && row.earned_points !== null && row.possible_points !== null && <View><Text style={b.muted}>Objective points</Text><Text style={r.score}>{row.earned_points}<Text style={r.scoreTotal}> / {row.possible_points} points</Text></Text></View>}
        <Text style={b.body}>{uncertain ? "We couldn’t confirm whether sharing changed. Retry the same request or refresh before making another change." : busy ? "Updating who can see this result. Please wait." : explanation}</Text>
        {busy && <ActivityIndicator color="#176556" accessibilityLabel="Saving result visibility" />}
        {!uncertain && !busy && row.evaluation?.status === "COMPLETE" && <BuilderButton label={row.released ? "Stop sharing" : "Share result"} primary={!row.released} onPress={p.onShare} />}
        {p.pending && uncertain && <BuilderButton label="Retry sharing request" primary busy={busy} onPress={p.onRetry} />}
      </View>}
    {!uncertain && !p.confirm && !p.leaving && item && <View style={b.card}>
      <View style={b.row}><Text accessibilityRole="header" style={b.heading}>Answer review</Text><Text style={b.muted}>{p.position + 1} of {row.items.length}</Text></View>
      <View style={[r.badge, item.state === "AUTO_GRADABLE" && item.correct ? r.shared : r.review]}><Text style={[r.badgeText, item.state === "AUTO_GRADABLE" && item.correct ? r.sharedText : r.reviewText]}>{item.state === "AUTO_GRADABLE" ? `${item.correct ? "✓ Correct" : "Incorrect"}${item.awarded_points !== null && item.max_points !== null ? ` · ${item.awarded_points} / ${item.max_points} points` : ""}` : item.state === "NOT_APPLICABLE" ? "No objective score" : "Needs review"}</Text></View>
      {!item.answer && <Text style={b.muted}>{item.response_id ? "This stored answer cannot be displayed safely. Further review is needed; the original work is retained." : "No answer was submitted for this question."}</Text>}
      <CaptureQuestion key={item.result_id} item={{ ...item.question, assignment_question_id: item.assignment_question_id }} answer={item.answer ?? undefined} back={null} disabled review onChange={() => {}} onReveal={() => {}} />
      <View style={b.actions}><View style={b.action}><BuilderButton label="Previous" disabled={busy || p.position === 0} onPress={() => p.onPosition(p.position - 1)} /></View><View style={b.action}><BuilderButton label="Next" disabled={busy || p.position === row.items.length - 1} onPress={() => p.onPosition(p.position + 1)} /></View></View><Text style={b.muted}>Original response · read only</Text>
    </View>}
    <ResultsDisclosure title="Evaluation history">{row.pinned_run_id ? <Text style={b.muted}>The shared evaluation stays selected.</Text> : p.evaluationHistory}{row.evaluation && <Text style={b.muted}>Evaluated {new Date(row.evaluation.evaluated_at).toLocaleString()}{"\n"}Policy: {row.evaluation.policy_version}{"\n"}Engine: {row.evaluation.engine_version}</Text>}</ResultsDisclosure>
  </View>;
}
