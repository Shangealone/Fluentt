import { Pressable, View } from "react-native";
import { Text, TextInput } from "../../accessibility/Primitives";
import type { AvailableStudiesResponse, BlindedExperimentStatus, ConsentDocument, EnrollmentReceipt, ParticipantEligibility, ParticipantStatus, ResearchAssessmentDetail, ResearchAssessmentListItem, ResearchStudy, SubmitAssessmentReceipt, WithdrawalReceipt } from "../../services/api/research";
import { r, ResearchBadge, ResearchButton, ResearchCode, ResearchDisclosure, ResearchNotice, ResearchRefresh, researchDate, researchLabel } from "./ResearchUI";

export type ResearchTab = "studies" | "participation";
export type ResearchHubData = { studies: AvailableStudiesResponse | null; participants: ParticipantStatus[] | null; studiesError: string; participantsError: string };
export const withdrawalReasons = [
  { id: "voluntary_withdrawal", label: "Voluntary choice" }, { id: "scheduling_conflict", label: "Scheduling conflict" },
  { id: "privacy_concerns", label: "Privacy preference" }, { id: "other", label: "Other" },
];
const language = (value: string) => value === "english" ? "English" : value === "tagalog" ? "Tagalog" : value;

export function ResearchChoice({ label, selected, onPress, disabled = false, checkbox = false }: { label: string; selected: boolean; onPress: () => void; disabled?: boolean; checkbox?: boolean }) {
  return <Pressable accessibilityRole={checkbox ? "checkbox" : "radio"} accessibilityLabel={label} accessibilityState={{ checked: selected, disabled }} disabled={disabled} onPress={onPress} style={[r.choice, selected && r.selectedChoice, disabled && r.disabled]}><View accessible={false} style={[r.choiceMark, checkbox && r.checkBox]}>{selected && (checkbox ? <Text style={r.markText}>✓</Text> : <View style={r.selectedDot} />)}</View><Text style={[r.body, r.flex]}>{label}</Text></Pressable>;
}

function StudyDetails({ study }: { study: ResearchStudy }) {
  return <ResearchDisclosure title="Study details"><Text selectable style={r.small}>Study code: {study.code}</Text><Text style={r.small}>Protocol: {study.protocol_version}</Text>{!!study.starts_at && <Text style={r.small}>Starts: {researchDate(study.starts_at)}</Text>}{!!study.ends_at && <Text style={r.small}>Ends: {researchDate(study.ends_at)}</Text>}<Text style={r.small}>Recruitment target: {study.target_participants}</Text><Text style={r.small}>Enrolled: {study.enrolled_count}</Text></ResearchDisclosure>;
}

export function ResearchHub({ data, tab, busy, onTab, onStudy, onActivities, onWithdraw, onRefresh }: {
  data: ResearchHubData; tab: ResearchTab; busy: boolean; onTab: (value: ResearchTab) => void;
  onStudy: (study: ResearchStudy) => void; onActivities: (participant: ParticipantStatus) => void;
  onWithdraw: (participant: ParticipantStatus) => void; onRefresh: () => void;
}) {
  const error = tab === "studies" ? data.studiesError : data.participantsError;
  return <>
    <View accessibilityRole="tablist" style={r.tabs}>{([['studies', 'Explore studies'], ['participation', 'My participation']] as const).map(([value, label]) => <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: tab === value, disabled: busy }} disabled={busy} onPress={() => onTab(value)} style={[r.tab, tab === value && r.selectedTab]}><Text style={r.tabText}>{label}</Text></Pressable>)}</View>
    {tab === "studies" && <ResearchNotice>Taking part is optional and separate from your classroom grades. Read the study information before deciding.</ResearchNotice>}
    <View style={r.row}><Text accessibilityRole="header" style={r.heading}>{tab === "studies" ? "Available studies" : "Your studies"}</Text><ResearchRefresh disabled={busy} onPress={onRefresh} /></View>
    {!!error && <><ResearchNotice error>{error}</ResearchNotice><ResearchButton label="Try again" primary disabled={busy} onPress={onRefresh} /></>}
    {tab === "studies" && data.studies && <>
      {!!data.studies.ethics_disclaimer && <Text style={r.small}>{data.studies.ethics_disclaimer}</Text>}
      {data.studies.studies.length === 0 ? <View style={r.card}><Text accessibilityRole="header" style={r.heading}>No studies available right now</Text><Text style={r.body}>There are no studies to explore here right now.</Text></View> : data.studies.studies.map(study => <View key={study.id} style={r.card}><View style={r.row}><ResearchBadge label={language(study.target_language)} /><ResearchBadge quiet label={researchLabel(study.status)} /></View><Text accessibilityRole="header" style={r.heading}>{study.title}</Text><ResearchButton primary label="Learn about this study" disabled={busy} onPress={() => onStudy(study)} /><StudyDetails study={study} /></View>)}
    </>}
    {tab === "participation" && data.participants && (data.participants.length === 0 ? <View style={r.card}><Text accessibilityRole="header" style={r.heading}>No study participation yet</Text><Text style={r.body}>You can explore available studies and read about them before deciding.</Text><ResearchButton label="Explore studies" disabled={busy} onPress={() => onTab("studies")} /></View> : data.participants.map(st => <View key={st.participant_id} style={r.card}>
      <ResearchBadge quiet={st.enrollment_status === "withdrawn"} label={researchLabel(st.enrollment_status)} /><Text accessibilityRole="header" style={r.heading}>{st.study_title}</Text><Text style={r.small}>{language(st.target_language)}</Text><ResearchCode code={st.participant_code} />
      {!!st.enrolled_at && <Text style={r.small}>Joined {researchDate(st.enrolled_at)}</Text>}{!!st.withdrawn_at && <Text style={r.small}>Left {researchDate(st.withdrawn_at)}</Text>}
      {st.enrollment_status === "enrolled" ? <ResearchButton primary label="View study activities" disabled={busy} onPress={() => onActivities(st)} /> : <ResearchNotice>{st.enrollment_status === "withdrawn" ? "You have left this study." : st.enrollment_status === "completed" ? "Your study participation is marked complete." : "Participation is pending. Study activities aren’t available yet."}</ResearchNotice>}
      <Text style={r.small}>{st.ethics_disclaimer}</Text><Text style={r.small}>{st.retention_notice}</Text>
      <ResearchDisclosure title="Study details"><Text selectable style={r.small}>Study code: {st.study_code}</Text><Text style={r.small}>Protocol: {st.protocol_version}</Text></ResearchDisclosure>
      {st.enrollment_status === "enrolled" && <ResearchButton quiet danger label="Leave this study" disabled={busy} onPress={() => onWithdraw(st)} />}
    </View>))}
  </>;
}

export function ResearchConsent({ study, document, eligibility, affirmed, disabled, onAffirm, onEnroll, onRetry }: {
  study: ResearchStudy; document: ConsentDocument | null; eligibility: ParticipantEligibility | null; affirmed: boolean; disabled: boolean;
  onAffirm: () => void; onEnroll: () => void; onRetry: () => void;
}) {
  if (!document || !eligibility) return <ResearchButton label="Try loading study information again" disabled={disabled} onPress={onRetry} />;
  const sameVersion = document.study_id === study.id && eligibility.study_id === study.id && document.protocol_version === study.protocol_version && eligibility.protocol_version === document.protocol_version;
  const eligible = eligibility.eligible && sameVersion;
  const sections = [
    ["Why this study is happening", document.purpose], ["What you’ll do", document.procedures],
    ["Your choice", document.voluntary_nature], ["Leaving the study", document.withdrawal_rights],
    ["Privacy and participant codes", document.confidentiality_and_pseudonymization], ["Data retention", document.data_retention_policy],
  ];
  return <>
    <View style={r.section}><ResearchBadge label={language(document.target_language)} /><Text accessibilityRole="header" style={r.heading}>{document.study_title}</Text></View>
    <ResearchNotice>{document.ethics_statement}</ResearchNotice><ResearchNotice>{document.retention_notice}</ResearchNotice>
    <View style={r.card}>{sections.map(([heading, body]) => <View key={heading} style={r.section}><Text accessibilityRole="header" style={r.subheading}>{heading}</Text><Text style={r.body}>{body}</Text></View>)}<ResearchDisclosure title="Document details"><Text selectable style={r.small}>Study code: {document.study_code}</Text><Text style={r.small}>Protocol: {document.protocol_version}</Text><Text style={r.small}>Consent document: {document.consent_document_version}</Text></ResearchDisclosure></View>
    {!sameVersion && <><ResearchNotice error>The study information changed. Reload it before making a choice.</ResearchNotice><ResearchButton label="Reload study information" disabled={disabled} onPress={onRetry} /></>}
    {!eligibility.eligible && <View style={r.card}><Text accessibilityRole="header" style={r.heading}>You can’t join this study right now</Text>{eligibility.reasons.map((reason, index) => <Text key={index} style={r.body}>{reason}</Text>)}</View>}
    {eligible && <View style={r.card}><ResearchChoice checkbox label={document.required_affirmation} selected={affirmed} disabled={disabled} onPress={onAffirm} /><ResearchButton primary label="Confirm and join study" disabled={disabled || !affirmed} onPress={onEnroll} /></View>}
  </>;
}

export function ResearchActivities({ participant, experiment, assessments, disabled, onStart, onRefresh, onWithdraw }: {
  participant: ParticipantStatus; experiment: BlindedExperimentStatus | null; assessments: ResearchAssessmentListItem[] | null; disabled: boolean;
  onStart: (assessment: ResearchAssessmentListItem) => void; onRefresh: () => void; onWithdraw: () => void;
}) {
  return <>
    <View style={r.row}><Text accessibilityRole="header" style={[r.heading, r.flex]}>{participant.study_title}</Text><ResearchRefresh disabled={disabled} onPress={onRefresh} /></View>
    {participant.enrollment_status !== "enrolled" ? <ResearchNotice>Study activities aren’t available for your current participation status.</ResearchNotice> : <>
      {!!experiment?.next_activity && <ResearchNotice>Next study activity: {researchLabel(experiment.next_activity)}</ResearchNotice>}
      {assessments === null ? <ResearchButton label="Try loading study activities again" disabled={disabled} onPress={onRefresh} /> : assessments.length === 0 ? <View style={r.card}><Text accessibilityRole="header" style={r.heading}>No activities available</Text><Text style={r.body}>There are no study activities to show right now.</Text></View> : assessments.map(asm => {
        const completed = asm.attempt_status === "completed", inProgress = asm.attempt_status === "in_progress", invalidated = asm.attempt_status === "invalidated";
        const available = !completed && !invalidated && (asm.is_unlocked || inProgress);
        return <View key={asm.assessment_id} style={r.card}><ResearchBadge quiet={!available && !completed} label={completed ? "Completed" : invalidated ? "Unavailable" : inProgress ? "In progress" : available ? "Available" : "Not available yet"} /><Text accessibilityRole="header" style={r.heading}>{asm.title}</Text><Text style={r.small}>{researchLabel(asm.kind)}</Text>
          {typeof asm.time_limit_seconds === "number" && <Text style={r.small}>Duration supplied by the study: {asm.time_limit_seconds} seconds</Text>}
          {!!asm.completed_at && <Text style={r.small}>Completed {researchDate(asm.completed_at)}</Text>}
          {completed && typeof asm.score === "number" && Number.isFinite(asm.score) && typeof asm.maximum_score === "number" && Number.isFinite(asm.maximum_score) && asm.maximum_score > 0 && <Text style={r.body}>Study points: {asm.score} / {asm.maximum_score}</Text>}
          {available && <ResearchButton primary label={inProgress ? "Resume activity" : "Start activity"} disabled={disabled} onPress={() => onStart(asm)} />}
        </View>;
      })}
      {!!experiment?.ethics_disclaimer && <Text style={r.small}>{experiment.ethics_disclaimer}</Text>}
      <ResearchDisclosure title="About these activities"><Text style={r.small}>Study activities are separate from classroom assignments. Follow the instructions supplied for each activity.</Text>{!!experiment?.condition_blinded && <Text style={r.small}>Study track: {researchLabel(experiment.condition_blinded)}</Text>}</ResearchDisclosure>
      <ResearchButton quiet danger label="Leave this study" disabled={disabled} onPress={onWithdraw} />
    </>}
  </>;
}

export function ResearchAssessment({ assessment, position, responses, mode, disabled, onPosition, onResponse, onReview, onConfirm, onSubmit, onLeave }: {
  assessment: ResearchAssessmentDetail; position: number; responses: Record<string, string>; mode: "question" | "review" | "submit"; disabled: boolean;
  onPosition: (position: number) => void; onResponse: (id: string, text: string) => void; onReview: () => void; onConfirm: () => void; onSubmit: () => void; onLeave: () => void;
}) {
  const items = assessment.items, item = items[position], answered = items.filter(q => !!responses[q.item_id]?.trim()).length;
  if (mode === "submit") return <View style={r.card}><Text accessibilityRole="header" style={r.heading}>Ready to submit?</Text><Text style={r.body}>{answered} answered · {items.length - answered} unanswered</Text><Text style={r.body}>You won’t be able to change these responses after submission.</Text><ResearchButton primary label="Submit study responses" disabled={disabled} onPress={onSubmit} /><ResearchButton label="Keep reviewing" disabled={disabled} onPress={onReview} /></View>;
  if (mode === "review") return <View style={r.card}><Text accessibilityRole="header" style={r.heading}>Before you submit</Text><Text style={r.body}>{answered} answered · {items.length - answered} unanswered</Text>{items.map((q, index) => <View key={q.item_id} style={r.answerRow}><View style={[r.flex, r.section]}><Text style={r.subheading}>Question {index + 1}</Text><Text style={r.small}>{q.prompt}</Text><Text style={r.body}>{responses[q.item_id] || "No response yet"}</Text></View><ResearchButton quiet label={`Edit ${index + 1}`} disabled={disabled} onPress={() => onPosition(index)} /></View>)}<Text style={r.small}>Review your responses carefully. This step doesn’t submit them.</Text><ResearchButton primary label="Continue to submission" disabled={disabled || items.length === 0} onPress={onConfirm} /><ResearchButton label="Back to questions" disabled={disabled} onPress={() => onPosition(position)} /></View>;
  return <>
    <Text accessibilityRole="header" style={r.heading}>{assessment.title}</Text><ResearchDisclosure title="Activity instructions"><Text style={r.body}>{assessment.instructions}</Text>{typeof assessment.time_limit_seconds === "number" && <Text style={r.small}>Duration supplied by the study: {assessment.time_limit_seconds} seconds</Text>}</ResearchDisclosure>
    {item ? <><View style={r.row}><Text accessibilityRole="header" style={r.heading}>Question {position + 1} of {items.length}</Text><Text style={r.small}>{answered} answered</Text></View><View key={item.item_id} style={r.card}><Text style={r.question}>{item.prompt}</Text>{item.options?.length ? <View accessibilityRole="radiogroup" accessibilityLabel="Your response" style={r.section}>{item.options.map((option, index) => <ResearchChoice key={`${index}:${option}`} label={option} selected={responses[item.item_id] === option} disabled={disabled} onPress={() => onResponse(item.item_id, option)} />)}</View> : <TextInput accessibilityLabel="Your response" editable={!disabled} value={responses[item.item_id] ?? ""} onChangeText={value => onResponse(item.item_id, value)} placeholder="Type your response" placeholderTextColor="#7B8982" autoCapitalize="none" autoCorrect={false} style={r.input} />}</View><Text style={r.small}>Moving between questions keeps your responses on this screen. Responses aren’t submitted until you confirm.</Text><View style={r.actions}><View style={r.action}><ResearchButton label="Previous" disabled={disabled || position === 0} onPress={() => onPosition(position - 1)} /></View><View style={r.action}>{position === items.length - 1 ? <ResearchButton primary label="Review responses" disabled={disabled} onPress={onReview} /> : <ResearchButton primary label="Next" disabled={disabled} onPress={() => onPosition(position + 1)} />}</View></View></> : <ResearchNotice>No questions are available for this activity.</ResearchNotice>}
    <ResearchButton quiet label="Leave this activity" disabled={disabled} onPress={onLeave} />
  </>;
}

export function ResearchCompletion({ receipt, title, disabled, onReturn }: { receipt: SubmitAssessmentReceipt; title: string; disabled: boolean; onReturn: () => void }) {
  const completed = receipt.status === "completed";
  return <><View style={r.card}><ResearchBadge quiet={!completed} label={completed ? "Completed" : "Invalidated"} /><Text accessibilityRole="header" style={r.heading}>{title}</Text><Text style={r.small}>Submitted {researchDate(receipt.submitted_at)}</Text>{Number.isFinite(receipt.score) && Number.isFinite(receipt.maximum_score) && receipt.maximum_score > 0 && <View><Text style={r.small}>Study points</Text><Text style={r.points}>{receipt.score}<Text style={r.pointsTotal}> / {receipt.maximum_score} points</Text></Text></View>}<Text style={r.body}>{receipt.feedback_message}</Text><ResearchCode code={receipt.participant_code} /><Text style={r.small}>{receipt.ethics_disclaimer}</Text><ResearchButton primary label="Return to study activities" disabled={disabled} onPress={onReturn} /></View><ResearchNotice>These are study activity results. They aren’t a classroom grade.</ResearchNotice></>;
}

export function ResearchWithdrawal({ participant, reason, disabled, onReason, onConfirm, onCancel }: { participant: ParticipantStatus; reason: string; disabled: boolean; onReason: (value: string) => void; onConfirm: () => void; onCancel: () => void }) {
  return <View style={r.card}><Text accessibilityRole="header" style={r.heading}>{participant.study_title}</Text><Text style={r.body}>If you leave, you’ll stop taking part in this study’s activities.</Text><Text style={r.subheading}>About your earlier study data</Text><Text style={r.body}>{participant.retention_notice}</Text><Text style={r.subheading}>Reason for leaving</Text><View accessibilityRole="radiogroup" accessibilityLabel="Reason for leaving" style={r.section}>{withdrawalReasons.map(option => <ResearchChoice key={option.id} label={option.label} selected={reason === option.id} disabled={disabled} onPress={() => onReason(option.id)} />)}</View><ResearchButton primary label="Confirm withdrawal" disabled={disabled} onPress={onConfirm} /><ResearchButton label="Keep participating" disabled={disabled} onPress={onCancel} /></View>;
}

export function ResearchParticipationReceipt({ receipt, title, disabled, onReturn }: { receipt: EnrollmentReceipt | WithdrawalReceipt; title: string; disabled: boolean; onReturn: () => void }) {
  const enrolled = receipt.enrollment_status === "enrolled";
  return <View style={r.card}><ResearchBadge quiet={!enrolled} label={enrolled ? "Enrolled" : "Withdrawn"} /><Text accessibilityRole="header" style={r.heading}>{title}</Text>{enrolled && <ResearchCode code={receipt.participant_code} />}<Text style={r.small}>{enrolled ? `Joined ${researchDate(receipt.enrolled_at)}` : `Left ${researchDate(receipt.withdrawn_at)}`}</Text>{enrolled && <Text style={r.small}>{receipt.ethics_disclaimer}</Text>}<Text style={r.body}>{receipt.retention_notice}</Text><ResearchButton primary label="Back to My participation" disabled={disabled} onPress={onReturn} /></View>;
}
