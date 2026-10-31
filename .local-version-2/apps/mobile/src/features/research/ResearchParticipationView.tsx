import { useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { usePreventRemove } from "expo-router";
import { Text } from "../../accessibility/Primitives";
import { useSession } from "../../session/provider";
import type { BlindedExperimentStatus, ConsentDocument, EnrollmentReceipt, ParticipantEligibility, ParticipantStatus, ResearchAssessmentDetail, ResearchAssessmentListItem, ResearchStudy, SubmitAssessmentReceipt, WithdrawalReceipt } from "../../services/api/research";
import { ResearchActivities, ResearchAssessment, ResearchCompletion, ResearchConsent, ResearchHub, ResearchParticipationReceipt, ResearchWithdrawal, type ResearchHubData, type ResearchTab } from "./ResearchScreens";
import { r, ResearchButton, ResearchFrame, ResearchLoading, ResearchNotice } from "./ResearchUI";

type Screen = "hub" | "consent" | "activities" | "assessment" | "review" | "submit" | "completion" | "withdraw" | "receipt";
type Operation = "read" | "start" | "enroll" | "submit" | "withdraw";
type Assessment = { studyId: string; detail: ResearchAssessmentDetail; attemptId: string };
type Problem = { message: string; uncertain: boolean; blocked: boolean; kind: Operation };
const message = (error: unknown) => error instanceof Error ? error.message : "Please try again.";

export function ResearchParticipationView({ onDone, onAccount }: { onDone: () => void; onAccount: () => void }) {
  const { research: api } = useSession();
  const [view, setView] = useState<Screen>("hub"), [tab, setTab] = useState<ResearchTab>("studies");
  const [hub, setHub] = useState<ResearchHubData | null>(null), [source, setSource] = useState(api);
  const [study, setStudy] = useState<ResearchStudy | null>(null), [document, setDocument] = useState<ConsentDocument | null>(null), [eligibility, setEligibility] = useState<ParticipantEligibility | null>(null);
  const [affirmed, setAffirmed] = useState(false), [participant, setParticipant] = useState<ParticipantStatus | null>(null);
  const [experiment, setExperiment] = useState<BlindedExperimentStatus | null>(null), [assessments, setAssessments] = useState<ResearchAssessmentListItem[] | null>(null);
  const [assessment, setAssessment] = useState<Assessment | null>(null), [responses, setResponses] = useState<Record<string, string>>({}), [position, setPosition] = useState(0);
  const [completion, setCompletion] = useState<SubmitAssessmentReceipt | null>(null), [receipt, setReceipt] = useState<EnrollmentReceipt | WithdrawalReceipt | null>(null), [receiptTitle, setReceiptTitle] = useState("");
  const [reason, setReason] = useState("voluntary_withdrawal"), [busy, setBusy] = useState<Operation | null>("read"), [problem, setProblem] = useState<Problem | null>(null);
  const [exit, setExit] = useState<(() => void) | null>(null), [scrollKey, setScrollKey] = useState(0);
  const alive = useRef(true), lock = useRef(false), sequence = useRef(0), firstHub = useRef(true);
  const move = (next: Screen) => { setView(next); setScrollKey(value => value + 1); };
  const clearAttempt = () => { setAssessment(null); setCompletion(null); setResponses({}); setPosition(0); };
  const hasWork = !!assessment && !completion;
  const frozen = !!busy || !!problem?.uncertain || !!problem?.blocked;

  const perform = useCallback(async <T,>(kind: Operation, operation: () => Promise<T>, success: (value: T) => void, studyId?: string) => {
    if (lock.current || !alive.current) return;
    lock.current = true; setBusy(kind); setProblem(null);
    const request = ++sequence.current;
    const current = () => alive.current && request === sequence.current;
    try { const result = await operation(); if (current()) success(result); }
    catch (error) {
      if (current()) {
        const status = (error as { status?: number } | null)?.status;
        let accessLost = [401, 403, 404].includes(status ?? 0), unverified = false;
        // Research access loss can also be returned as a 422. The client does not expose error codes.
        if (status === 422 && studyId && kind !== "read" && kind !== "enroll") {
          try {
            const statuses = await api.myStatus();
            if (!current()) return;
            accessLost = !statuses.some(value => value.study_id === studyId && value.enrollment_status === "enrolled");
          } catch { if (!current()) return; unverified = true; }
        }
        if (accessLost) {
          setHub(null); setStudy(null); setDocument(null); setEligibility(null); setAffirmed(false);
          setParticipant(null); setExperiment(null); setAssessments(null); setAssessment(null); setCompletion(null);
          setResponses({}); setPosition(0); setReceipt(null); setReceiptTitle(""); setExit(null);
        }
        setProblem({ message: message(error), kind, blocked: accessLost || unverified, uncertain: kind !== "read" && (status === undefined || status === 0 || status === 408 || status >= 500) });
        setScrollKey(value => value + 1);
      }
    } finally { if (current()) { lock.current = false; setBusy(null); } }
  }, [api]);

  const loadHub = useCallback(() => {
    if (lock.current) return;
    setHub(null);
    void perform("read", async () => {
      const [studies, statuses] = await Promise.allSettled([api.studies(), api.myStatus()]);
      return { studies: studies.status === "fulfilled" ? studies.value : null, participants: statuses.status === "fulfilled" ? statuses.value : null,
        studiesError: studies.status === "rejected" ? message(studies.reason) : "", participantsError: statuses.status === "rejected" ? message(statuses.reason) : "" };
    }, data => {
      setHub(data);
      if (firstHub.current) { if (data.participants?.some(value => value.enrollment_status === "enrolled")) setTab("participation"); firstHub.current = false; }
    });
  }, [api, perform]);

  useEffect(() => {
    alive.current = true; lock.current = false; firstHub.current = true;
    setSource(api); setView("hub"); setStudy(null); setDocument(null); setEligibility(null); setParticipant(null); setExperiment(null); setAssessments(null);
    setAssessment(null); setCompletion(null); setResponses({}); setReceipt(null); setExit(null); setAffirmed(false);
    loadHub();
    return () => { alive.current = false; sequence.current += 1; lock.current = false; };
  }, [api, loadHub]);

  function requestExit(action: () => void) {
    if (lock.current) return;
    if (hasWork) { setExit(() => action); setScrollKey(value => value + 1); }
    else action();
  }
  usePreventRemove(hasWork || (!!busy && busy !== "read"), ({ repeat }) => requestExit(repeat));

  function home() {
    clearAttempt(); setStudy(null); setDocument(null); setEligibility(null); setParticipant(null); setExperiment(null); setAssessments(null); setAffirmed(false); setReceipt(null);
    setTab("participation"); move("hub"); loadHub();
  }
  function loadConsent(selected: ResearchStudy) {
    if (lock.current) return;
    setStudy(selected); setDocument(null); setEligibility(null); setAffirmed(false); move("consent");
    void perform("read", () => Promise.all([api.study(selected.id), api.consentDocument(selected.id), api.eligibility(selected.id)]), ([fresh, doc, eligible]) => { setStudy(fresh); setDocument(doc); setEligibility(eligible); });
  }
  function loadActivities(selected: ParticipantStatus) {
    if (lock.current) return;
    setParticipant(selected); setExperiment(null); setAssessments(null); move("activities");
    if (selected.enrollment_status !== "enrolled") return;
    void perform("read", () => Promise.all([api.experimentStatus(selected.study_id), api.assessments(selected.study_id)]), ([status, items]) => { setExperiment(status); setAssessments(items); });
  }
  function begin(item: ResearchAssessmentListItem) {
    if (!participant || lock.current || frozen || participant.enrollment_status !== "enrolled" || item.attempt_status === "completed" || item.attempt_status === "invalidated" || (!item.is_unlocked && item.attempt_status !== "in_progress")) return;
    const selected = participant;
    void perform("start", async () => {
      const detail = await api.assessmentDetail(selected.study_id, item.assessment_id);
      const started = await api.startAssessment(selected.study_id, item.assessment_id);
      return { studyId: selected.study_id, detail, attemptId: started.attempt_id };
    }, value => { setAssessment(value); setResponses({}); setPosition(0); setCompletion(null); move("assessment"); }, selected.study_id);
  }
  function enroll() {
    if (lock.current || frozen || !study || !document || !eligibility?.eligible || !affirmed || document.study_id !== study.id || eligibility.study_id !== study.id || document.protocol_version !== study.protocol_version || eligibility.protocol_version !== document.protocol_version) return;
    const selected = study;
    void perform("enroll", () => api.enroll(selected.id, { protocol_version: document.protocol_version, consent_decision: "granted", affirmation_confirmed: true }), value => { setReceipt(value); setReceiptTitle(document.study_title); setAffirmed(false); move("receipt"); });
  }
  function withdraw() {
    if (lock.current || frozen || !participant || participant.enrollment_status !== "enrolled") return;
    const selected = participant;
    void perform("withdraw", () => api.withdraw(selected.study_id, { reason_category: reason }), value => { setReceipt(value); setReceiptTitle(selected.study_title); setParticipant({ ...selected, enrollment_status: "withdrawn", withdrawn_at: value.withdrawn_at, retention_notice: value.retention_notice }); move("receipt"); }, selected.study_id);
  }
  function submit() {
    if (lock.current || frozen || !assessment || view !== "submit" || assessment.detail.items.length === 0) return;
    const current = assessment;
    // Existing research timing payload is preserved by this UI-only change; it is not a measured duration.
    void perform("submit", () => api.submitAssessment(current.studyId, current.detail.assessment_id, { attempt_id: current.attemptId, responses: { ...responses }, response_duration_ms: 45000 }), value => { setCompletion(value); setResponses({}); move("completion"); }, current.studyId);
  }
  function goActivities() { clearAttempt(); if (participant) loadActivities(participant); else home(); }
  function back() {
    if (exit) { setExit(null); setScrollKey(value => value + 1); return; }
    if (hasWork) { requestExit(goActivities); return; }
    if (view === "hub") onDone();
    else if (view === "consent") { move("hub"); setStudy(null); setDocument(null); setEligibility(null); setAffirmed(false); setProblem(null); }
    else if (view === "receipt" || view === "withdraw" || view === "activities") home();
    else if (view === "completion") goActivities();
    else home();
  }
  function checkStatus() {
    const check = problem?.kind === "start" || problem?.kind === "submit" ? goActivities : home;
    requestExit(check);
  }
  function selectWithdraw(selected: ParticipantStatus) { if (lock.current || frozen) return; setParticipant(selected); setReason("voluntary_withdrawal"); setProblem(null); move("withdraw"); }
  function selectPosition(next: number) { if (frozen || lock.current || !assessment || next < 0 || next >= assessment.detail.items.length) return; setPosition(next); move("assessment"); }

  const titles: Record<Screen, [string, string, "study" | "activity" | "complete"]> = {
    hub: tab === "studies" ? ["Research studies", "Explore optional studies and choose what feels right for you.", "study"] : ["My participation", "Your study choices, all in one place.", "study"],
    consent: ["About this study", "Read the information before you decide.", "study"], activities: ["Study activities", "Follow the activities supplied for your study.", "activity"],
    assessment: ["Study assessment", "Read the instructions and take your time.", "activity"], review: ["Review your responses", assessment?.detail.title ?? "", "activity"], submit: ["Submit this activity?", "Check your responses before continuing.", "activity"],
    completion: [completion?.status === "completed" ? "Activity complete" : "Submission invalidated", "Review the study’s returned result below.", completion?.status === "completed" ? "complete" : "activity"], withdraw: ["Leave this study?", "Review what happens before confirming.", "study"],
    receipt: receipt?.enrollment_status === "enrolled" ? ["You’ve joined the study", "Your participation is confirmed.", "complete"] : ["You’ve left the study", "Your participation status has been updated.", "study"],
  };
  const heading: [string, string, "study" | "activity" | "complete"] = exit ? ["Leave this activity?", "Your responses haven’t been submitted.", "activity"] : titles[view];
  const [title, description, art] = heading;
  return <ResearchFrame title={title} description={description} art={art} busy={!!busy} scrollKey={scrollKey} onBack={back} onAccount={() => requestExit(onAccount)}>
    {source !== api || busy === "read" ? <ResearchLoading /> : exit ? <View style={r.card}><Text style={r.body}>{problem?.uncertain ? "The request wasn’t confirmed. Check your study status before trying again. Responses on this screen won’t be sent again automatically." : "If you leave now, the responses entered on this screen will be lost."}</Text><ResearchButton primary label="Stay here" onPress={() => { setExit(null); setScrollKey(value => value + 1); }} /><ResearchButton label="Leave activity" onPress={() => { const action = exit; setExit(null); clearAttempt(); action(); }} /></View> : <>
      {!!busy && <ResearchNotice>{busy === "start" ? "Opening study activity…" : busy === "enroll" ? "Submitting your choice…" : busy === "withdraw" ? "Leaving study…" : "Submitting responses…"}</ResearchNotice>}
      {problem && <><ResearchNotice error>{problem.message}{problem.uncertain ? " We couldn’t confirm the outcome. Check your current status before trying again." : ""}</ResearchNotice>{problem.uncertain && <ResearchButton primary label="Check current status" onPress={checkStatus} />}{problem.blocked && <ResearchButton label="Back to studies" onPress={() => requestExit(home)} />}</>}
      {!problem?.blocked && <>
      {view === "hub" && hub && <ResearchHub data={hub} tab={tab} busy={frozen} onTab={value => { if (!lock.current && !frozen) { setTab(value); setScrollKey(key => key + 1); } }} onStudy={loadConsent} onActivities={loadActivities} onWithdraw={selectWithdraw} onRefresh={loadHub} />}
      {view === "consent" && study && <ResearchConsent study={study} document={document} eligibility={eligibility} affirmed={affirmed} disabled={frozen} onAffirm={() => { if (!lock.current && !frozen) setAffirmed(value => !value); }} onEnroll={enroll} onRetry={() => loadConsent(study)} />}
      {view === "activities" && participant && <ResearchActivities participant={participant} experiment={experiment} assessments={assessments} disabled={frozen} onStart={begin} onRefresh={() => loadActivities(participant)} onWithdraw={() => selectWithdraw(participant)} />}
      {assessment && ["assessment", "review", "submit"].includes(view) && <ResearchAssessment assessment={assessment.detail} position={position} responses={responses} mode={view === "assessment" ? "question" : view === "review" ? "review" : "submit"} disabled={frozen} onPosition={selectPosition} onResponse={(id, text) => { if (!lock.current && !frozen) setResponses(value => ({ ...value, [id]: text })); }} onReview={() => { if (!lock.current && !frozen) move("review"); }} onConfirm={() => { if (!lock.current && !frozen) move("submit"); }} onSubmit={submit} onLeave={() => requestExit(goActivities)} />}
      {view === "completion" && completion && assessment && <ResearchCompletion receipt={completion} title={assessment.detail.title} disabled={frozen} onReturn={goActivities} />}
      {view === "withdraw" && participant && <ResearchWithdrawal participant={participant} reason={reason} disabled={frozen} onReason={value => { if (!lock.current && !frozen) setReason(value); }} onConfirm={withdraw} onCancel={home} />}
      {view === "receipt" && receipt && <ResearchParticipationReceipt receipt={receipt} title={receiptTitle} disabled={frozen} onReturn={home} />}
      </>}
    </>}
  </ResearchFrame>;
}
