import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  TextInput,
} from "react-native";
import { useSession } from "../../session/provider";
import {
  ResearchStudy,
  ConsentDocument,
  ParticipantStatus,
  ParticipantEligibility,
  BlindedExperimentStatus,
  ResearchAssessmentListItem,
  ResearchAssessmentDetail,
  SubmitAssessmentReceipt,
} from "../../services/api/research";
import { theme } from "../../theme/tokens";
import { Button } from "../../components/ui";

export function ResearchParticipationView({ onDone }: { onDone?: () => void }) {
  const { research } = useSession();

  // Navigation tab: "studies" | "my_participation"
  const [tab, setTab] = useState<"studies" | "my_participation">("studies");

  // Studies state
  const [studies, setStudies] = useState<ResearchStudy[]>([]);
  const [loadingStudies, setLoadingStudies] = useState(false);
  const [studiesError, setStudiesError] = useState<string | null>(null);

  // Selected study for consent review
  const [selectedStudy, setSelectedStudy] = useState<ResearchStudy | null>(null);
  const [consentDoc, setConsentDoc] = useState<ConsentDocument | null>(null);
  const [eligibility, setEligibility] = useState<ParticipantEligibility | null>(null);
  const [loadingDoc, setLoadingDoc] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);

  // Consent affirmation
  const [affirmed, setAffirmed] = useState(false);
  const [enrolling, setEnrolling] = useState(false);

  // My participation state
  const [myStatuses, setMyStatuses] = useState<ParticipantStatus[]>([]);
  const [loadingStatus, setLoadingStatus] = useState(false);

  // Section 37: Controlled experiment & assessment states
  const [experimentStatuses, setExperimentStatuses] = useState<Record<string, BlindedExperimentStatus>>({});
  const [studyAssessments, setStudyAssessments] = useState<Record<string, ResearchAssessmentListItem[]>>({});
  const [activeStudyId, setActiveStudyId] = useState<string | null>(null);
  const [activeAssessment, setActiveAssessment] = useState<ResearchAssessmentDetail | null>(null);
  const [activeAttemptId, setActiveAttemptId] = useState<string | null>(null);
  const [assessmentResponses, setAssessmentResponses] = useState<Record<string, string>>({});
  const [assessmentSubmitting, setAssessmentSubmitting] = useState(false);
  const [assessmentResult, setAssessmentResult] = useState<SubmitAssessmentReceipt | null>(null);
  const [loadingAssessmentId, setLoadingAssessmentId] = useState<string | null>(null);

  // Withdrawal state
  const [withdrawingStudyId, setWithdrawingStudyId] = useState<string | null>(null);
  const [withdrawalReason, setWithdrawalReason] = useState<string>("voluntary_withdrawal");
  const [withdrawing, setWithdrawing] = useState(false);

  // Load experiment status and assessments for a study
  const loadStudyExperimentData = useCallback(async (studyId: string) => {
    try {
      const [status, asms] = await Promise.all([
        research.experimentStatus(studyId),
        research.assessments(studyId),
      ]);
      setExperimentStatuses((prev) => ({ ...prev, [studyId]: status }));
      setStudyAssessments((prev) => ({ ...prev, [studyId]: asms }));
    } catch {
      // Non-blocking
    }
  }, [research]);

  // Load available studies
  const loadStudies = useCallback(async () => {
    setLoadingStudies(true);
    setStudiesError(null);
    try {
      const res = await research.studies();
      setStudies(res.studies);
    } catch (err: any) {
      setStudiesError(err?.message || "Failed to load research studies.");
    } finally {
      setLoadingStudies(false);
    }
  }, [research]);

  // Load user participation status
  const loadStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const res = await research.myStatus();
      setMyStatuses(res);
      // If user has an active enrollment, default tab to my_participation and load experiment data
      const enrolled = res.filter((s) => s.enrollment_status === "enrolled");
      if (enrolled.length > 0) {
        setTab("my_participation");
        enrolled.forEach((s) => loadStudyExperimentData(s.study_id));
      }
    } catch {
      // Non-blocking in demo or fresh accounts
    } finally {
      setLoadingStatus(false);
    }
  }, [research, loadStudyExperimentData]);

  useEffect(() => {
    loadStudies();
    loadStatus();
  }, [loadStudies, loadStatus]);

  const handleStartAssessment = async (studyId: string, assessmentId: string) => {
    setLoadingAssessmentId(assessmentId);
    try {
      const [detail, startRcpt] = await Promise.all([
        research.assessmentDetail(studyId, assessmentId),
        research.startAssessment(studyId, assessmentId),
      ]);
      setActiveStudyId(studyId);
      setActiveAssessment(detail);
      setActiveAttemptId(startRcpt.attempt_id);
      setAssessmentResponses({});
      setAssessmentResult(null);
    } catch (err: any) {
      Alert.alert("Unable to Start Assessment", err?.message || "Could not begin assessment attempt.");
    } finally {
      setLoadingAssessmentId(null);
    }
  };

  const handleSubmitAssessment = async () => {
    if (!activeStudyId || !activeAssessment || !activeAttemptId) return;
    setAssessmentSubmitting(true);
    try {
      const receipt = await research.submitAssessment(
        activeStudyId,
        activeAssessment.assessment_id,
        {
          attempt_id: activeAttemptId,
          responses: assessmentResponses,
          response_duration_ms: 45000,
        }
      );
      setAssessmentResult(receipt);
      loadStudyExperimentData(activeStudyId);
    } catch (err: any) {
      Alert.alert("Submission Failed", err?.message || "Could not submit assessment attempt.");
    } finally {
      setAssessmentSubmitting(false);
    }
  };

  // Select study and load consent document & eligibility
  const handleSelectStudy = async (study: ResearchStudy) => {
    setSelectedStudy(study);
    setAffirmed(false);
    setLoadingDoc(true);
    setDocError(null);
    try {
      const [doc, elig] = await Promise.all([
        research.consentDocument(study.id),
        research.eligibility(study.id),
      ]);
      setConsentDoc(doc);
      setEligibility(elig);
    } catch (err: any) {
      setDocError(err?.message || "Failed to load consent document.");
    } finally {
      setLoadingDoc(false);
    }
  };

  // Submit informed consent & enroll
  const handleEnroll = async () => {
    if (!selectedStudy || !affirmed) return;

    setEnrolling(true);
    try {
      const receipt = await research.enroll(selectedStudy.id, {
        protocol_version: selectedStudy.protocol_version,
        consent_decision: "granted",
        affirmation_confirmed: true,
      });

      Alert.alert(
        "Enrollment Confirmed",
        `You have been enrolled in ${selectedStudy.code}.\n\nYour Pseudonymous Participant Code: ${receipt.participant_code}\n\nYour participation is strictly voluntary and private.`,
        [{ text: "OK", onPress: () => {
          setSelectedStudy(null);
          loadStatus();
          loadStudies();
          setTab("my_participation");
        }}]
      );
    } catch (err: any) {
      Alert.alert("Enrollment Failed", err?.message || "Could not complete enrollment.");
    } finally {
      setEnrolling(false);
    }
  };

  // Confirm voluntary withdrawal
  const handleWithdraw = async (studyId: string) => {
    setWithdrawing(true);
    try {
      const res = await research.withdraw(studyId, {
        reason_category: withdrawalReason,
      });

      Alert.alert(
        "Withdrawal Confirmed",
        `You have voluntarily withdrawn from the study.\n\nNotice: In accordance with research integrity standards, pre-withdrawal research records remain preserved in pseudonymized form and are not destroyed. No further research sessions will be collected.`,
        [{ text: "OK", onPress: () => {
          setWithdrawingStudyId(null);
          loadStatus();
          loadStudies();
        }}]
      );
    } catch (err: any) {
      Alert.alert("Withdrawal Failed", err?.message || "Could not process withdrawal.");
    } finally {
      setWithdrawing(false);
    }
  };

  // RENDER: Assessment Taking Screen or Completion Receipt
  if (activeAssessment) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => {
              setActiveAssessment(null);
              setAssessmentResult(null);
            }}
            style={styles.backButton}
          >
            <Text style={styles.backButtonText}>← Exit Assessment</Text>
          </Pressable>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{activeAssessment.kind.toUpperCase().replace("_", " ")}</Text>
          </View>
        </View>

        {assessmentResult ? (
          <View style={styles.resultContainer}>
            <View style={styles.resultCard}>
              <Text style={styles.resultIcon}>✅</Text>
              <Text style={styles.resultTitle}>Assessment Completed</Text>
              <Text style={styles.resultParticipant}>Participant: {assessmentResult.participant_code}</Text>

              <View style={styles.scoreRow}>
                <View style={styles.scoreBox}>
                  <Text style={styles.scoreNum}>{assessmentResult.score} / {assessmentResult.maximum_score}</Text>
                  <Text style={styles.scoreLabel}>Score</Text>
                </View>
                <View style={styles.scoreBox}>
                  <Text style={styles.scoreNum}>{assessmentResult.percentage.toFixed(0)}%</Text>
                  <Text style={styles.scoreLabel}>Accuracy</Text>
                </View>
              </View>

              <Text style={styles.resultFeedback}>{assessmentResult.feedback_message}</Text>
              <Text style={styles.resultDisclaimer}>{assessmentResult.ethics_disclaimer}</Text>

              <View style={{ marginTop: 20 }}>
                <Button
                  label="Return to Study Activities"
                  onPress={() => {
                    setActiveAssessment(null);
                    setAssessmentResult(null);
                  }}
                  variant="primary"
                />
              </View>
            </View>
          </View>
        ) : (
          <View>
            <Text style={styles.studyTitle}>{activeAssessment.title}</Text>
            <Text style={styles.instructionsText}>{activeAssessment.instructions}</Text>
            {activeAssessment.time_limit_seconds && (
              <View style={styles.timerBadge}>
                <Text style={styles.timerText}>
                  ⏱ Allocated Duration: {Math.round(activeAssessment.time_limit_seconds / 60)} minutes
                </Text>
              </View>
            )}

            <View style={styles.itemsContainer}>
              {activeAssessment.items.map((item, idx) => (
                <View key={item.item_id} style={styles.itemCard}>
                  <View style={styles.itemHeader}>
                    <Text style={styles.itemNumber}>Question {idx + 1}</Text>
                    <Text style={styles.itemPoints}>{item.points} pt{item.points > 1 ? "s" : ""}</Text>
                  </View>
                  <Text style={styles.itemPrompt}>{item.prompt}</Text>

                  {item.options && item.options.length > 0 ? (
                    <View style={styles.optionsList}>
                      {item.options.map((opt) => {
                        const isSelected = assessmentResponses[item.item_id] === opt;
                        return (
                          <Pressable
                            key={opt}
                            style={[styles.optionRow, isSelected && styles.optionRowSelected]}
                            onPress={() =>
                              setAssessmentResponses((prev) => ({
                                ...prev,
                                [item.item_id]: opt,
                              }))
                            }
                          >
                            <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
                              {isSelected && <View style={styles.radioInner} />}
                            </View>
                            <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                              {opt}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : (
                    <TextInput
                      style={styles.textInput}
                      placeholder="Type your answer here..."
                      placeholderTextColor="#94A3B8"
                      value={assessmentResponses[item.item_id] || ""}
                      onChangeText={(val) =>
                        setAssessmentResponses((prev) => ({
                          ...prev,
                          [item.item_id]: val,
                        }))
                      }
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  )}
                </View>
              ))}
            </View>

            <View style={{ marginTop: 24, marginBottom: 40 }}>
              <Button
                label={assessmentSubmitting ? "Submitting Attempt..." : "Submit Assessment"}
                onPress={handleSubmitAssessment}
                variant="primary"
                disabled={assessmentSubmitting}
              />
            </View>
          </View>
        )}
      </ScrollView>
    );
  }

  // RENDER: Consent Document Review Modal / View
  if (selectedStudy) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => setSelectedStudy(null)} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back to Studies</Text>
          </Pressable>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{selectedStudy.target_language.toUpperCase()}</Text>
          </View>
        </View>

        <Text style={styles.studyTitle}>{selectedStudy.title}</Text>
        <Text style={styles.studyCode}>Protocol: {selectedStudy.protocol_version}</Text>

        {loadingDoc ? (
          <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 40 }} />
        ) : docError ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{docError}</Text>
          </View>
        ) : consentDoc ? (
          <View style={styles.consentCard}>
            {/* Ethics Disclaimer Alert */}
            <View style={styles.ethicsAlert}>
              <Text style={styles.ethicsAlertTitle}>⚠️ Institutional Ethics Notice</Text>
              <Text style={styles.ethicsAlertText}>{consentDoc.ethics_statement}</Text>
            </View>

            {/* Retention Notice */}
            <View style={styles.retentionAlert}>
              <Text style={styles.retentionAlertTitle}>🔒 Data Retention & Scientific Integrity</Text>
              <Text style={styles.retentionAlertText}>{consentDoc.retention_notice}</Text>
            </View>

            {/* Eligibility Banner if not eligible */}
            {eligibility && !eligibility.eligible && (
              <View style={styles.ineligibleAlert}>
                <Text style={styles.ineligibleAlertTitle}>Ineligible to Enroll</Text>
                {eligibility.reasons.map((r, i) => (
                  <Text key={i} style={styles.ineligibleAlertText}>• {r}</Text>
                ))}
              </View>
            )}

            {/* Full Protocol Consent Text */}
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionHeader}>1. Research Purpose</Text>
              <Text style={styles.bodyText}>{consentDoc.purpose}</Text>
            </View>

            <View style={styles.sectionBlock}>
              <Text style={styles.sectionHeader}>2. Study Procedures</Text>
              <Text style={styles.bodyText}>{consentDoc.procedures}</Text>
            </View>

            <View style={styles.sectionBlock}>
              <Text style={styles.sectionHeader}>3. Voluntary Participation & Withdrawal</Text>
              <Text style={styles.bodyText}>{consentDoc.voluntary_nature}</Text>
              <Text style={[styles.bodyText, { marginTop: 6 }]}>{consentDoc.withdrawal_rights}</Text>
            </View>

            <View style={styles.sectionBlock}>
              <Text style={styles.sectionHeader}>4. Confidentiality & Pseudonymization</Text>
              <Text style={styles.bodyText}>{consentDoc.confidentiality_and_pseudonymization}</Text>
            </View>

            {/* Informed Consent Affirmation */}
            {(!eligibility || eligibility.eligible) && (
              <View style={styles.affirmationBlock}>
                <Pressable
                  style={styles.checkboxRow}
                  onPress={() => setAffirmed(!affirmed)}
                >
                  <View style={[styles.checkbox, affirmed && styles.checkboxActive]}>
                    {affirmed && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <Text style={styles.affirmationText}>
                    {consentDoc.required_affirmation}
                  </Text>
                </Pressable>

                <Button
                  label={enrolling ? "Submitting Consent..." : "Submit Informed Consent & Enroll"}
                  onPress={handleEnroll}
                  disabled={!affirmed || enrolling}
                  variant="primary"
                />
              </View>
            )}
          </View>
        ) : null}
      </ScrollView>
    );
  }

  // RENDER: Main Hub (Studies List & My Participation)
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={styles.titleContainer}>
        <Text style={styles.title}>Research Participation</Text>
        <Text style={styles.subtitle}>
          Controlled scientific studies investigating adaptive spaced repetition and pronunciation modeling.
        </Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        <Pressable
          style={[styles.tabButton, tab === "studies" && styles.tabButtonActive]}
          onPress={() => setTab("studies")}
        >
          <Text style={[styles.tabButtonText, tab === "studies" && styles.tabButtonTextActive]}>
            Available Studies
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tabButton, tab === "my_participation" && styles.tabButtonActive]}
          onPress={() => setTab("my_participation")}
        >
          <Text style={[styles.tabButtonText, tab === "my_participation" && styles.tabButtonTextActive]}>
            My Participation ({myStatuses.length})
          </Text>
        </Pressable>
      </View>

      {/* TAB 1: Available Studies */}
      {tab === "studies" && (
        <View>
          <View style={styles.disclaimerCard}>
            <Text style={styles.disclaimerCardTitle}>🔬 Research Ethics & Voluntary Enrollment</Text>
            <Text style={styles.disclaimerCardText}>
              Participation in FLUENTT research studies is strictly voluntary and independent from your classroom grades.
              You may review protocol consent documents, learn about the research procedures, and enroll or withdraw at any time.
            </Text>
          </View>

          {loadingStudies ? (
            <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 24 }} />
          ) : studiesError ? (
            <View style={styles.errorCard}>
              <Text style={styles.errorText}>{studiesError}</Text>
            </View>
          ) : studies.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No research studies currently recruiting.</Text>
            </View>
          ) : (
            studies.map((s) => (
              <View key={s.id} style={styles.studyCard}>
                <View style={styles.studyHeader}>
                  <Text style={styles.studyCardTitle}>{s.title}</Text>
                  <View style={[styles.statusPill, s.status === "active" ? styles.pillActive : styles.pillDraft]}>
                    <Text style={styles.pillText}>{s.status.toUpperCase()}</Text>
                  </View>
                </View>

                <Text style={styles.studyCardCode}>Code: {s.code}</Text>
                <Text style={styles.studyCardLanguage}>Language: {s.target_language === "tagalog" ? "Filipino / Tagalog" : "English"}</Text>
                <Text style={styles.studyCardQuota}>Recruitment Target: {s.enrolled_count} / {s.target_participants} enrolled</Text>

                <View style={{ marginTop: 12 }}>
                  <Button
                    label="Review Protocol & Consent Document"
                    onPress={() => handleSelectStudy(s)}
                    variant="primary"
                  />
                </View>
              </View>
            ))
          )}
        </View>
      )}

      {/* TAB 2: My Participation */}
      {tab === "my_participation" && (
        <View>
          {loadingStatus ? (
            <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 24 }} />
          ) : myStatuses.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No Active Research Enrollments</Text>
              <Text style={styles.emptyText}>
                You are currently not enrolled in any experimental studies. Browse available studies to learn more and participate.
              </Text>
              <View style={{ marginTop: 14 }}>
                <Button label="Browse Available Studies" onPress={() => setTab("studies")} variant="primary" />
              </View>
            </View>
          ) : (
            myStatuses.map((st) => (
              <View key={st.participant_id} style={styles.participantCard}>
                <View style={styles.studyHeader}>
                  <Text style={styles.studyCardTitle}>{st.study_title}</Text>
                  <View style={[styles.statusPill, st.enrollment_status === "enrolled" ? styles.pillActive : styles.pillWithdrawn]}>
                    <Text style={styles.pillText}>{st.enrollment_status.toUpperCase()}</Text>
                  </View>
                </View>

                {/* Pseudonymous Identifier Display */}
                <View style={styles.codeBox}>
                  <Text style={styles.codeLabel}>YOUR RESEARCH PSEUDONYM</Text>
                  <Text style={styles.codeValue}>{st.participant_code}</Text>
                  <Text style={styles.codeSubtext}>
                    This identifier decouples your learning activity from your name or student ID.
                  </Text>
                </View>

                <Text style={styles.metaRow}>Protocol: {st.protocol_version}</Text>
                {st.enrolled_at && (
                  <Text style={styles.metaRow}>Enrolled: {new Date(st.enrolled_at).toLocaleDateString()}</Text>
                )}
                {st.withdrawn_at && (
                  <Text style={[styles.metaRow, { color: theme.colors.error }]}>
                    Withdrawn: {new Date(st.withdrawn_at).toLocaleDateString()}
                  </Text>
                )}

                {/* Section 37: Blinded Track & Assessment Battery for Enrolled Participants */}
                {st.enrollment_status === "enrolled" && (
                  <View style={styles.experimentContainer}>
                    {/* Blinded Track Badge */}
                    <View style={styles.trackCard}>
                      <View style={styles.trackHeader}>
                        <Text style={styles.trackLabel}>EXPERIMENTAL CONDITION</Text>
                        <View style={styles.blindedPill}>
                          <Text style={styles.blindedPillText}>BLINDED</Text>
                        </View>
                      </View>
                      <Text style={styles.trackName}>
                        {experimentStatuses[st.study_id]?.condition_blinded === "standard_research_track"
                          ? "Standard Research Track"
                          : "Controlled Spaced Repetition Track"}
                      </Text>
                      <Text style={styles.trackHint}>
                        Treatment assignment is double-blinded to safeguard educational research validity.
                      </Text>
                    </View>

                    {/* Next Milestone Banner */}
                    {experimentStatuses[st.study_id]?.next_activity && (
                      <View style={styles.milestoneBanner}>
                        <Text style={styles.milestoneLabel}>CURRENT STUDY TARGET</Text>
                        <Text style={styles.milestoneText}>
                          {experimentStatuses[st.study_id]?.next_activity}
                        </Text>
                      </View>
                    )}

                    {/* Controlled Assessment Battery */}
                    <View style={styles.batterySection}>
                      <Text style={styles.batteryTitle}>Controlled Assessment Battery</Text>
                      <Text style={styles.batterySubtitle}>
                        Sequential single-attempt evaluation instruments. Answers are directly recorded into research audit log.
                      </Text>

                      {(studyAssessments[st.study_id] || []).map((asm) => {
                        const isCompleted = asm.attempt_status === "completed";
                        const isInProgress = asm.attempt_status === "in_progress";
                        const isLocked = !asm.is_unlocked && !isCompleted && !isInProgress;

                        return (
                          <View
                            key={asm.assessment_id}
                            style={[
                              styles.assessmentCard,
                              isCompleted && styles.assessmentCardCompleted,
                              isLocked && styles.assessmentCardLocked,
                            ]}
                          >
                            <View style={styles.assessmentHeader}>
                              <Text style={styles.assessmentTitle}>{asm.title}</Text>
                              <View
                                style={[
                                  styles.asmKindBadge,
                                  isCompleted ? styles.asmKindBadgeDone : isLocked ? styles.asmKindBadgeLocked : styles.asmKindBadgeActive,
                                ]}
                              >
                                <Text style={styles.asmKindBadgeText}>
                                  {isCompleted
                                    ? "COMPLETED"
                                    : isLocked
                                    ? "LOCKED"
                                    : asm.kind.toUpperCase().replace("_", " ")}
                                </Text>
                              </View>
                            </View>

                            <View style={styles.assessmentMeta}>
                              <Text style={styles.asmMetaText}>Points: {asm.total_points}</Text>
                              {asm.time_limit_seconds && (
                                <Text style={styles.asmMetaText}>Limit: {Math.round(asm.time_limit_seconds / 60)}m</Text>
                              )}
                            </View>

                            {isCompleted && asm.score !== null && asm.score !== undefined && (
                              <View style={styles.completedScoreBox}>
                                <Text style={styles.completedScoreText}>
                                  Score: {asm.score} / {asm.maximum_score} (
                                  {asm.maximum_score ? ((asm.score / asm.maximum_score) * 100).toFixed(0) : 0}%)
                                </Text>
                              </View>
                            )}

                            {isLocked && (
                              <Text style={styles.lockedHint}>
                                🔒 Complete preceding milestone assessment to unlock.
                              </Text>
                            )}

                            {!isCompleted && !isLocked && (
                              <View style={{ marginTop: 10 }}>
                                <Button
                                  label={
                                    loadingAssessmentId === asm.assessment_id
                                      ? "Starting..."
                                      : isInProgress
                                      ? "Resume Attempt"
                                      : "Take Assessment"
                                  }
                                  onPress={() => handleStartAssessment(st.study_id, asm.assessment_id)}
                                  variant={isInProgress ? "secondary" : "primary"}
                                  disabled={loadingAssessmentId === asm.assessment_id}
                                />
                              </View>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  </View>
                )}

                {/* Withdrawal Section */}
                {st.enrollment_status === "enrolled" && (
                  <View style={styles.withdrawalSection}>
                    {withdrawingStudyId === st.study_id ? (
                      <View style={styles.withdrawalForm}>
                        <Text style={styles.withdrawalWarningTitle}>Voluntary Withdrawal Notice</Text>
                        <Text style={styles.withdrawalWarningText}>
                          You may withdraw from this research study at any time. Withdrawal halts future experimental sessions immediately.
                          Pre-withdrawal records are permanently retained in pseudonymized form per data retention policy.
                        </Text>

                        <Text style={styles.reasonLabel}>Reason for Withdrawal:</Text>
                        <View style={styles.reasonChips}>
                          {[
                            { id: "voluntary_withdrawal", label: "Voluntary choice" },
                            { id: "scheduling_conflict", label: "Scheduling conflict" },
                            { id: "privacy_concerns", label: "Privacy preference" },
                            { id: "other", label: "Other" },
                          ].map((r) => (
                            <Pressable
                              key={r.id}
                              style={[styles.reasonChip, withdrawalReason === r.id && styles.reasonChipActive]}
                              onPress={() => setWithdrawalReason(r.id)}
                            >
                              <Text style={[styles.reasonChipText, withdrawalReason === r.id && styles.reasonChipTextActive]}>
                                {r.label}
                              </Text>
                            </Pressable>
                          ))}
                        </View>

                        <View style={styles.withdrawalActions}>
                          <Pressable
                            style={styles.cancelBtn}
                            onPress={() => setWithdrawingStudyId(null)}
                          >
                            <Text style={styles.cancelBtnText}>Cancel</Text>
                          </Pressable>
                          <Button
                            label={withdrawing ? "Processing..." : "Confirm Withdrawal"}
                            onPress={() => handleWithdraw(st.study_id)}
                            variant="danger"
                            disabled={withdrawing}
                          />
                        </View>
                      </View>
                    ) : (
                      <Pressable
                        style={styles.withdrawLink}
                        onPress={() => setWithdrawingStudyId(st.study_id)}
                      >
                        <Text style={styles.withdrawLinkText}>Voluntary Study Withdrawal →</Text>
                      </Pressable>
                    )}
                  </View>
                )}

                {st.enrollment_status === "withdrawn" && (
                  <View style={styles.withdrawnNoticeBox}>
                    <Text style={styles.withdrawnNoticeText}>
                      Participation has concluded. In accordance with the study retention protocol (research-retention-v1), historical research audit data remains preserved.
                    </Text>
                  </View>
                )}
              </View>
            ))
          )}
        </View>
      )}

      {onDone && (
        <View style={{ marginTop: 24, marginBottom: 30 }}>
          <Button label="Back to Dashboard" onPress={onDone} variant="secondary" />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  titleContainer: {
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: theme.colors.ink,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.muted,
    marginTop: 4,
    lineHeight: 20,
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: 8,
    padding: 4,
    marginBottom: 16,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 6,
  },
  tabButtonActive: {
    backgroundColor: "#FFFFFF",
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.muted,
  },
  tabButtonTextActive: {
    color: theme.colors.primary,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  backButtonText: {
    fontSize: 14,
    color: theme.colors.primary,
    fontWeight: "600",
  },
  badge: {
    backgroundColor: "#EEF2FF",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#C7D2FE",
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.colors.primary,
  },
  studyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: theme.colors.ink,
    lineHeight: 26,
  },
  studyCode: {
    fontSize: 13,
    color: theme.colors.muted,
    marginTop: 2,
    marginBottom: 14,
  },
  disclaimerCard: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
  },
  disclaimerCardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 6,
  },
  disclaimerCardText: {
    fontSize: 13,
    color: "#475569",
    lineHeight: 18,
  },
  studyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  studyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  studyCardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.colors.ink,
    flex: 1,
    marginRight: 8,
  },
  studyCardCode: {
    fontSize: 13,
    color: theme.colors.muted,
    marginBottom: 2,
  },
  studyCardLanguage: {
    fontSize: 13,
    color: "#1E293B",
    marginBottom: 2,
  },
  studyCardQuota: {
    fontSize: 13,
    color: theme.colors.muted,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  pillActive: {
    backgroundColor: "#DCFCE7",
  },
  pillDraft: {
    backgroundColor: "#FEF3C7",
  },
  pillWithdrawn: {
    backgroundColor: "#FEE2E2",
  },
  pillText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0F172A",
  },
  consentCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  ethicsAlert: {
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FCD34D",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  ethicsAlertTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#92400E",
    marginBottom: 4,
  },
  ethicsAlertText: {
    fontSize: 12,
    color: "#78350F",
    lineHeight: 17,
  },
  retentionAlert: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
  },
  retentionAlertTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1E40AF",
    marginBottom: 4,
  },
  retentionAlertText: {
    fontSize: 12,
    color: "#1E3A8A",
    lineHeight: 17,
  },
  ineligibleAlert: {
    backgroundColor: "#FEE2E2",
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
  },
  ineligibleAlertTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#991B1B",
    marginBottom: 4,
  },
  ineligibleAlertText: {
    fontSize: 12,
    color: "#7F1D1D",
    lineHeight: 16,
  },
  sectionBlock: {
    marginBottom: 14,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.colors.ink,
    marginBottom: 4,
  },
  bodyText: {
    fontSize: 13,
    color: "#334155",
    lineHeight: 19,
  },
  affirmationBlock: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#94A3B8",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
    marginTop: 2,
  },
  checkboxActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  checkmark: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "bold",
  },
  affirmationText: {
    fontSize: 13,
    color: "#0F172A",
    flex: 1,
    lineHeight: 18,
    fontWeight: "500",
  },
  participantCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  codeBox: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    padding: 14,
    marginVertical: 12,
    alignItems: "center",
  },
  codeLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748B",
    letterSpacing: 0.5,
  },
  codeValue: {
    fontSize: 22,
    fontWeight: "800",
    color: theme.colors.primary,
    fontFamily: "monospace",
    marginVertical: 4,
    letterSpacing: 1,
  },
  codeSubtext: {
    fontSize: 11,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 15,
  },
  metaRow: {
    fontSize: 13,
    color: "#475569",
    marginBottom: 4,
  },
  withdrawalSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  withdrawLink: {
    alignSelf: "flex-start",
    paddingVertical: 4,
  },
  withdrawLinkText: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.colors.error,
  },
  withdrawalForm: {
    backgroundColor: "#FEF2F2",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "#FCA5A5",
  },
  withdrawalWarningTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#991B1B",
    marginBottom: 4,
  },
  withdrawalWarningText: {
    fontSize: 12,
    color: "#7F1D1D",
    lineHeight: 16,
    marginBottom: 10,
  },
  reasonLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#991B1B",
    marginBottom: 6,
  },
  reasonChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 12,
  },
  reasonChip: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FCA5A5",
  },
  reasonChipActive: {
    backgroundColor: "#991B1B",
    borderColor: "#991B1B",
  },
  reasonChipText: {
    fontSize: 11,
    color: "#7F1D1D",
    fontWeight: "600",
  },
  reasonChipTextActive: {
    color: "#FFFFFF",
  },
  withdrawalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 10,
  },
  cancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  cancelBtnText: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "600",
  },
  withdrawnNoticeBox: {
    backgroundColor: "#F1F5F9",
    borderRadius: 6,
    padding: 10,
    marginTop: 10,
  },
  withdrawnNoticeText: {
    fontSize: 12,
    color: "#475569",
    lineHeight: 16,
  },
  errorCard: {
    backgroundColor: "#FEE2E2",
    padding: 14,
    borderRadius: 8,
    marginTop: 12,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: 13,
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    padding: 24,
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginTop: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.colors.ink,
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 13,
    color: theme.colors.muted,
    textAlign: "center",
    lineHeight: 18,
  },
  // Section 37 Styles
  experimentContainer: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  trackCard: {
    backgroundColor: "#F0FDF4",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "#BBF7D0",
    marginBottom: 12,
  },
  trackHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  trackLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#166534",
    letterSpacing: 0.5,
  },
  blindedPill: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#86EFAC",
  },
  blindedPillText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#15803D",
  },
  trackName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#14532D",
    marginBottom: 2,
  },
  trackHint: {
    fontSize: 11,
    color: "#166534",
    lineHeight: 15,
  },
  milestoneBanner: {
    backgroundColor: "#EFF6FF",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    marginBottom: 14,
  },
  milestoneLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#1D4ED8",
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  milestoneText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1E40AF",
  },
  batterySection: {
    marginTop: 6,
  },
  batteryTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: theme.colors.ink,
    marginBottom: 2,
  },
  batterySubtitle: {
    fontSize: 12,
    color: theme.colors.muted,
    marginBottom: 10,
    lineHeight: 16,
  },
  assessmentCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  assessmentCardCompleted: {
    backgroundColor: "#F8FAFC",
    borderColor: "#86EFAC",
  },
  assessmentCardLocked: {
    backgroundColor: "#F1F5F9",
    borderColor: "#E2E8F0",
    opacity: 0.8,
  },
  assessmentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  assessmentTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.colors.ink,
    flex: 1,
    marginRight: 8,
  },
  asmKindBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  asmKindBadgeActive: {
    backgroundColor: "#EEF2FF",
    borderWidth: 1,
    borderColor: "#C7D2FE",
  },
  asmKindBadgeDone: {
    backgroundColor: "#DCFCE7",
    borderWidth: 1,
    borderColor: "#86EFAC",
  },
  asmKindBadgeLocked: {
    backgroundColor: "#E2E8F0",
  },
  asmKindBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#334155",
  },
  assessmentMeta: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 4,
  },
  asmMetaText: {
    fontSize: 12,
    color: "#64748B",
  },
  completedScoreBox: {
    marginTop: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: "#F0FDF4",
    borderRadius: 4,
    alignSelf: "flex-start",
  },
  completedScoreText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#166534",
  },
  lockedHint: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 4,
    fontStyle: "italic",
  },
  instructionsText: {
    fontSize: 13,
    color: "#475569",
    marginBottom: 10,
    lineHeight: 18,
  },
  timerBadge: {
    backgroundColor: "#FFFBEB",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#FDE68A",
    marginBottom: 14,
    alignSelf: "flex-start",
  },
  timerText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#B45309",
  },
  itemsContainer: {
    marginTop: 8,
  },
  itemCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  itemNumber: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.colors.primary,
  },
  itemPoints: {
    fontSize: 12,
    color: "#64748B",
  },
  itemPrompt: {
    fontSize: 15,
    fontWeight: "600",
    color: theme.colors.ink,
    marginBottom: 12,
    lineHeight: 20,
  },
  optionsList: {
    gap: 8,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#F8FAFC",
  },
  optionRowSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: "#EEF2FF",
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: "#94A3B8",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  radioCircleSelected: {
    borderColor: theme.colors.primary,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.primary,
  },
  optionText: {
    fontSize: 14,
    color: "#334155",
  },
  optionTextSelected: {
    color: theme.colors.primary,
    fontWeight: "600",
  },
  textInput: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: theme.colors.ink,
  },
  resultContainer: {
    marginTop: 20,
    alignItems: "center",
  },
  resultCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 24,
    width: "100%",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#86EFAC",
  },
  resultIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  resultTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#166534",
    marginBottom: 4,
  },
  resultParticipant: {
    fontSize: 12,
    color: "#64748B",
    marginBottom: 16,
    fontFamily: "monospace",
  },
  scoreRow: {
    flexDirection: "row",
    gap: 20,
    marginBottom: 16,
  },
  scoreBox: {
    backgroundColor: "#F0FDF4",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  scoreNum: {
    fontSize: 22,
    fontWeight: "800",
    color: "#15803D",
  },
  scoreLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#166534",
    marginTop: 2,
  },
  resultFeedback: {
    fontSize: 13,
    color: "#334155",
    textAlign: "center",
    marginBottom: 12,
    lineHeight: 18,
  },
  resultDisclaimer: {
    fontSize: 10,
    color: "#94A3B8",
    textAlign: "center",
    lineHeight: 14,
  },
});
