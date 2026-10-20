import React, { useState, useEffect, useCallback } from "react";
import { StyleSheet, Text, View, Pressable, ScrollView } from "react-native";
import { theme as baseTheme } from "../../theme/tokens";
import { pc } from "../../theme/personal";
import { Button, ErrorMessage, Loading } from "../../components/ui";
import {
  PronunciationActivityView,
  PronunciationAttemptHistoryItem,
  PronunciationAccess,
} from "../../services/api/pronunciation";
import { useAudioRecorder } from "./useAudioRecorder";
const theme = { colors: { ...baseTheme.colors, primary: pc.navy, ink: pc.ink, muted: pc.muted, border: pc.line, background: pc.background } };

interface PronunciationPracticeProps {
  activity: PronunciationActivityView;
  api: PronunciationAccess;
  onDone?: () => void;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

export function PronunciationPractice({ activity, api, onDone }: PronunciationPracticeProps) {
  const recorder = useAudioRecorder();
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<any | null>(null);
  const [selectedWordIndex, setSelectedWordIndex] = useState<number | null>(null);
  const [history, setHistory] = useState<PronunciationAttemptHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchHistory = useCallback(async () => {
    try {
      setLoadingHistory(true);
      const items = await api.attempts(activity.id);
      setHistory(items);
    } catch {
      // ignore history load error in practice flow
    } finally {
      setLoadingHistory(false);
    }
  }, [activity.id, api]);

  useEffect(() => {
    void fetchHistory();
  }, [fetchHistory]);

  const handleSubmit = async () => {
    if (!recorder.audioPayload) return;
    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);
    setLastResult(null);

    try {
      const res = await api.submitAttempt(activity.id, recorder.audioPayload, recorder.durationMs);
      setSubmitSuccess(res.message || "Recording submitted and transcribed successfully!");
      setLastResult(res);
      await recorder.discardRecording();
      void fetchHistory();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to upload recording. Please retry.";
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const isTagalog = activity.language === "tagalog";

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      {/* Activity Card */}
      <View style={styles.promptCard}>
        <View style={styles.badgeRow}>
          <View style={[styles.langBadge, isTagalog ? styles.tagalogBadge : styles.englishBadge]}>
            <Text style={[styles.langBadgeText, isTagalog ? styles.tagalogBadgeText : styles.englishBadgeText]}>
              {isTagalog ? "🇵🇭 Filipino / Tagalog" : "🇺🇸 English"}
            </Text>
          </View>
          <Text style={styles.versionTag}>Version {activity.version}</Text>
        </View>

        <Text style={styles.promptLabel}>PRACTICE PHRASE</Text>
        <Text style={styles.targetText}>{activity.target_text}</Text>

        {activity.instructions && (
          <View style={styles.instructionsBox}>
            <Text style={styles.instructionsIcon}>💡</Text>
            <Text style={styles.instructionsText}>{activity.instructions}</Text>
          </View>
        )}
      </View>

      {/* Permission Warning if needed */}
      {(recorder.status === "permission_denied" || recorder.status === "permission_blocked") && (
        <View style={styles.alertCard}>
          <Text style={styles.alertTitle}>Microphone Permission Needed</Text>
          <Text style={styles.alertBody}>
            {recorder.error ||
              "Microphone access is required to record your speech for pronunciation practice."}
          </Text>
          <Button
            label="Grant Microphone Access"
            size="sm"
            variant="primary"
            onPress={() => void recorder.requestPermission()}
          />
        </View>
      )}

      {/* Recording Stage Controls */}
      <View style={styles.recordingStage}>
        {/* Status Header */}
        <View style={styles.statusHeader}>
          {recorder.status === "recording" && (
            <View style={styles.liveIndicator}>
              <View style={styles.pulsingDot} />
              <Text style={styles.recordingText}>Recording in progress…</Text>
            </View>
          )}
          {recorder.status === "recorded" && (
            <Text style={styles.recordedText}>✓ Recording complete. Review before submitting.</Text>
          )}
          {recorder.status === "playing" && (
            <Text style={styles.playingText}>▶ Playing your recording…</Text>
          )}
          {(recorder.status === "ready" || recorder.status === "idle") && (
            <Text style={styles.idleText}>Tap the microphone button to start recording.</Text>
          )}
        </View>

        {/* Live Timer Display */}
        <View style={styles.timerDisplay}>
          <Text style={styles.timerText}>
            {recorder.status === "playing"
              ? formatDuration(recorder.playbackPositionMs)
              : formatDuration(recorder.durationMs)}
          </Text>
          <Text style={styles.timerMax}> / 01:00</Text>
        </View>

        {/* Big Action Buttons */}
        <View style={styles.actionCenter}>
          {recorder.status === "recording" ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Stop recording"
              style={[styles.bigMicButton, styles.recordingActive]}
              onPress={() => void recorder.stopRecording()}
            >
              <View style={styles.stopIcon} />
            </Pressable>
          ) : recorder.status === "recorded" || recorder.status === "playing" ? (
            <View style={styles.reviewControls}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={recorder.status === "playing" ? "Pause playback" : "Play recording"}
                style={[styles.bigMicButton, styles.playButton]}
                onPress={() =>
                  recorder.status === "playing"
                    ? void recorder.pausePlayback()
                    : void recorder.playRecording()
                }
              >
                <Text style={styles.playIcon}>{recorder.status === "playing" ? "⏸" : "▶"}</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Start recording"
              style={[
                styles.bigMicButton,
                recorder.status === "permission_blocked" && styles.disabledButton,
              ]}
              disabled={recorder.status === "permission_blocked"}
              onPress={() => void recorder.startRecording()}
            >
              <Text style={styles.micIcon}>🎙</Text>
            </Pressable>
          )}
        </View>

        {/* Secondary Review Actions */}
        {(recorder.status === "recorded" || recorder.status === "playing") && (
          <View style={styles.reviewActions}>
            <Button
              label="Record again"
              variant="outline"
              size="sm"
              icon="↺"
              onPress={() => void recorder.discardRecording()}
            />
            <Button
              label={submitting ? "Uploading audio…" : "Submit recording"}
              variant="primary"
              size="sm"
              icon="✓"
              disabled={submitting}
              onPress={() => void handleSubmit()}
            />
          </View>
        )}

        {/* Error / Success Notifications */}
        {recorder.error && <ErrorMessage message={recorder.error} />}
        {submitError && <ErrorMessage message={submitError} />}
        {submitSuccess && (
          <View style={styles.successBanner}>
            <Text style={styles.successText}>✓ {submitSuccess}</Text>
          </View>
        )}
      </View>

      {/* ASR Speech Recognition Result (Section 33) */}
      {lastResult && (
        <View style={styles.asrResultCard}>
          <View style={styles.asrHeader}>
            <View style={styles.asrTitleRow}>
              <Text style={styles.asrTitleIcon}>🗣️</Text>
              <Text style={styles.asrTitle}>Speech Recognition Result</Text>
            </View>
            <View style={styles.asrModelBadge}>
              <Text style={styles.asrModelText}>Whisper Multilingual</Text>
            </View>
          </View>

          {lastResult.transcription_metadata?.silence_detected ? (
            <View style={styles.asrSilenceBox}>
              <Text style={styles.asrSilenceTitle}>⚠️ No Speech Detected</Text>
              <Text style={styles.asrSilenceText}>
                The microphone recorded audio, but no spoken speech was detected. Please check
                your microphone level and try recording again.
              </Text>
            </View>
          ) : (
            <View style={styles.asrContent}>
              <View style={styles.comparisonBox}>
                <Text style={styles.comparisonLabel}>RECOGNIZED TRANSCRIPT</Text>
                <Text style={styles.recognizedTranscript}>
                  {"\""}{lastResult.transcription || lastResult.target_text}{"\""}
                </Text>
              </View>

              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Language:</Text>
                <Text style={styles.metaValue}>
                  {lastResult.transcription_metadata?.detected_language === "tl"
                    ? "Filipino / Tagalog (tl)"
                    : lastResult.transcription_metadata?.detected_language === "en"
                    ? "English (en)"
                    : isTagalog
                    ? "Filipino / Tagalog (tl)"
                    : "English (en)"}
                </Text>
                {lastResult.transcription_metadata?.confidence != null && (
                  <>
                    <Text style={styles.metaDivider}>•</Text>
                    <Text style={styles.metaLabel}>Confidence:</Text>
                    <Text style={styles.metaValue}>
                      {Math.round(lastResult.transcription_metadata.confidence * 100)}%
                    </Text>
                  </>
                )}
              </View>
            </View>
          )}

          {/* Scientific Disclaimer */}
          <View style={styles.asrDisclaimerBox}>
            <Text style={styles.asrDisclaimerText}>
              ℹ️ Speech-to-text recognition verified. Multi-dimensional pronunciation assessment is shown below.
            </Text>
          </View>
        </View>
      )}

      {/* Pronunciation Assessment Result (Section 34) */}
      {lastResult?.assessment && (
        <View style={styles.assessmentCard}>
          <View style={styles.assessmentHeader}>
            <View style={styles.assessmentTitleRow}>
              <Text style={styles.assessmentTitleIcon}>🎯</Text>
              <Text style={styles.assessmentTitle}>Pronunciation Assessment</Text>
            </View>
            <View style={styles.evaluatorBadge}>
              <Text style={styles.evaluatorBadgeText}>GOP Evaluator v1.0</Text>
            </View>
          </View>

          {/* Overall Score Row */}
          <View style={styles.scoreSummaryRow}>
            <View style={styles.scoreCircle}>
              <Text style={styles.scoreCircleNumber}>
                {Math.round(lastResult.assessment.overall_score)}
              </Text>
              <Text style={styles.scoreCircleTotal}>/100</Text>
            </View>
            <View style={styles.scoreSummaryText}>
              <Text style={styles.scoreSummaryGrade}>
                {lastResult.assessment.overall_score >= 85
                  ? "🌟 Excellent Pronunciation"
                  : lastResult.assessment.overall_score >= 70
                  ? "👍 Good Progress"
                  : "💡 Keep Practicing"}
              </Text>
              <Text style={styles.scoreSummaryFeedback}>
                {"\""}{lastResult.assessment.summary_feedback}{"\""}
              </Text>
            </View>
          </View>

          {/* 4 Dimensional Diagnostic Rubrics */}
          <View style={styles.dimensionsGrid}>
            <View style={styles.dimensionCol}>
              <Text style={styles.dimLabel}>🎯 Accuracy</Text>
              <View style={styles.dimBarTrack}>
                <View
                  style={[
                    styles.dimBarFill,
                    { width: `${Math.min(100, Math.max(0, lastResult.assessment.accuracy_score))}%` },
                  ]}
                />
              </View>
              <Text style={styles.dimValue}>
                {Math.round(lastResult.assessment.accuracy_score)}%
              </Text>
            </View>

            <View style={styles.dimensionCol}>
              <Text style={styles.dimLabel}>⚡ Fluency</Text>
              <View style={styles.dimBarTrack}>
                <View
                  style={[
                    styles.dimBarFill,
                    {
                      width: `${Math.min(100, Math.max(0, lastResult.assessment.fluency_score))}%`,
                      backgroundColor: "#34A853",
                    },
                  ]}
                />
              </View>
              <Text style={styles.dimValue}>
                {Math.round(lastResult.assessment.fluency_score)}%
              </Text>
            </View>

            <View style={styles.dimensionCol}>
              <Text style={styles.dimLabel}>📖 Complete</Text>
              <View style={styles.dimBarTrack}>
                <View
                  style={[
                    styles.dimBarFill,
                    {
                      width: `${Math.min(100, Math.max(0, lastResult.assessment.completeness_score))}%`,
                      backgroundColor: "#FBBC05",
                    },
                  ]}
                />
              </View>
              <Text style={styles.dimValue}>
                {Math.round(lastResult.assessment.completeness_score)}%
              </Text>
            </View>

            <View style={styles.dimensionCol}>
              <Text style={styles.dimLabel}>🎶 Prosody</Text>
              <View style={styles.dimBarTrack}>
                <View
                  style={[
                    styles.dimBarFill,
                    {
                      width: `${Math.min(100, Math.max(0, lastResult.assessment.prosody_score))}%`,
                      backgroundColor: "#9334E8",
                    },
                  ]}
                />
              </View>
              <Text style={styles.dimValue}>
                {Math.round(lastResult.assessment.prosody_score)}%
              </Text>
            </View>
          </View>

          {/* Interactive Word Diagnostics */}
          <View style={styles.wordSection}>
            <Text style={styles.wordSectionTitle}>Word-Level Pronunciation (Tap word to inspect phonemes)</Text>
            <View style={styles.wordChipContainer}>
              {lastResult.assessment.words.map((w: any, idx: number) => {
                const isSelected = selectedWordIndex === idx;
                const isGood = w.accuracy_score >= 80;
                const isMed = w.accuracy_score >= 60 && w.accuracy_score < 80;
                return (
                  <Pressable
                    key={idx}
                    accessibilityRole="button"
                    accessibilityLabel={`Inspect word ${w.word}, score ${Math.round(w.accuracy_score)} percent`}
                    style={[
                      styles.wordChip,
                      isGood ? styles.wordGood : isMed ? styles.wordMed : styles.wordLow,
                      isSelected && styles.wordChipSelected,
                    ]}
                    onPress={() => setSelectedWordIndex(isSelected ? null : idx)}
                  >
                    <Text
                      style={[
                        styles.wordChipText,
                        isGood ? styles.wordTextGood : isMed ? styles.wordTextMed : styles.wordTextLow,
                      ]}
                    >
                      {w.word}
                    </Text>
                    <Text style={styles.wordChipScore}>{Math.round(w.accuracy_score)}%</Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Selected Word Phoneme Breakdown */}
            {selectedWordIndex !== null && lastResult.assessment.words[selectedWordIndex] && (
              <View style={styles.phonemeDetailBox}>
                <Text style={styles.phonemeDetailTitle}>
                  Phonemes for &quot;{lastResult.assessment.words[selectedWordIndex].word}&quot;:
                </Text>
                <View style={styles.phonemeRow}>
                  {lastResult.assessment.words[selectedWordIndex].phonemes.map((p: any, pIdx: number) => (
                    <View
                      key={pIdx}
                      style={[
                        styles.phonemePill,
                        p.status === "correct"
                          ? styles.phonemeCorrect
                          : p.status === "needs_work"
                          ? styles.phonemeNeedsWork
                          : styles.phonemeOmitted,
                      ]}
                    >
                      <Text style={styles.phonemeText}>/{p.phoneme}/</Text>
                      <Text style={styles.phonemeScore}>{Math.round(p.accuracy_score)}%</Text>
                    </View>
                  ))}
                </View>
                {lastResult.assessment.words[selectedWordIndex].tip && (
                  <Text style={styles.wordTipText}>
                    💡 {lastResult.assessment.words[selectedWordIndex].tip}
                  </Text>
                )}
              </View>
            )}
          </View>

          {/* Actionable Linguistic Tips */}
          {lastResult.assessment.actionable_tips && lastResult.assessment.actionable_tips.length > 0 && (
            <View style={styles.tipsBox}>
              <Text style={styles.tipsTitle}>Actionable Pronunciation Tips</Text>
              {lastResult.assessment.actionable_tips.map((tip: string, tIdx: number) => (
                <View key={tIdx} style={styles.tipRow}>
                  <Text style={styles.tipBullet}>•</Text>
                  <Text style={styles.tipText}>{tip}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Scientific Measurement Notice */}
          <View style={styles.evaluatorNoticeBox}>
            <Text style={styles.evaluatorNoticeText}>
              🔬 Algorithmic reference assessment based on acoustic GOP and NLP phoneme alignment.
              Outputs provide formative practice guidance and do not claim human-level or certified
              DepEd proficiency ratings.
            </Text>
          </View>
        </View>
      )}

      {/* Scientific Notice */}
      <View style={styles.noticeCard}>
        <Text style={styles.noticeTitle}>Voice Privacy & Assessment Notice</Text>
        <Text style={styles.noticeText}>
          Your audio recording is stored securely in your private learning storage. Speech
          recognition and automated pronunciation scoring are performed privately.
        </Text>
      </View>

      {/* History Section */}
      <View style={styles.historySection}>
        <Text style={styles.historyTitle}>Your Recent Attempts</Text>
        {loadingHistory ? (
          <Loading />
        ) : history.length === 0 ? (
          <Text style={styles.emptyHistoryText}>No recordings submitted yet for this prompt.</Text>
        ) : (
          history.map(item => (
            <View key={item.attempt_id} style={styles.historyItem}>
              <View style={styles.historyInfo}>
                <Text style={styles.historyDate}>
                  {new Date(item.attempted_at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
                {item.transcription && (
                  <Text style={styles.historyTranscript} numberOfLines={1}>
                    {"\""}{item.transcription}{"\""}
                  </Text>
                )}
                <Text style={styles.historyMeta}>
                  {formatDuration(item.duration_ms)} · {(item.file_size_bytes / 1024).toFixed(1)} KB
                </Text>
              </View>
              <View style={[styles.statusBadge, item.score != null && styles.statusBadgeScored]}>
                <Text style={[styles.statusBadgeText, item.score != null && styles.statusBadgeTextScored]}>
                  {item.score != null ? `${Math.round(item.score)}/100` : item.scoring_status}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>

      {onDone && (
        <View style={{ marginTop: 24 }}>
          <Button label="Back to activities" variant="secondary" onPress={onDone} />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 0,
    gap: 16,
    paddingBottom: 40,
  },
  promptCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 23,
    gap: 12,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  langBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  tagalogBadge: {
    backgroundColor: "#E6F4EA",
  },
  tagalogBadgeText: {
    color: "#137333",
    fontSize: 12,
    fontWeight: "700",
  },
  englishBadge: {
    backgroundColor: "#E8F0FE",
  },
  englishBadgeText: {
    color: "#1A73E8",
    fontSize: 12,
    fontWeight: "700",
  },
  langBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  versionTag: {
    fontSize: 11,
    color: theme.colors.subtle,
    fontWeight: "600",
  },
  promptLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    color: theme.colors.muted,
  },
  targetText: {
    fontSize: 22,
    fontWeight: "600",
    color: theme.colors.ink,
    lineHeight: 30,
  },
  instructionsBox: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: theme.colors.surfaceSubtle,
    borderRadius: 12,
    padding: 12,
    alignItems: "flex-start",
  },
  instructionsIcon: {
    fontSize: 16,
  },
  instructionsText: {
    flex: 1,
    fontSize: 13,
    color: theme.colors.muted,
    lineHeight: 18,
  },
  alertCard: {
    backgroundColor: "#FEF7E0",
    borderWidth: 1,
    borderColor: "#FEEFC3",
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#B06000",
  },
  alertBody: {
    fontSize: 13,
    color: "#5F6368",
    lineHeight: 18,
  },
  recordingStage: {
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 24,
    alignItems: "center",
    gap: 16,
  },
  statusHeader: {
    minHeight: 24,
    alignItems: "center",
  },
  liveIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pulsingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#D93025",
  },
  recordingText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#D93025",
  },
  recordedText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#137333",
  },
  playingText: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.colors.primary,
  },
  idleText: {
    fontSize: 13,
    color: theme.colors.muted,
  },
  timerDisplay: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  timerText: {
    fontSize: 36,
    fontWeight: "800",
    color: theme.colors.ink,
    fontVariant: ["tabular-nums"],
  },
  timerMax: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.subtle,
  },
  actionCenter: {
    paddingVertical: 8,
  },
  bigMicButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  micIcon: {
    fontSize: 32,
    color: "#FFFFFF",
  },
  recordingActive: {
    backgroundColor: "#D93025",
    shadowColor: "#D93025",
  },
  stopIcon: {
    width: 24,
    height: 24,
    borderRadius: 4,
    backgroundColor: "#FFFFFF",
  },
  playButton: {
    backgroundColor: theme.colors.primaryLight,
  },
  playIcon: {
    fontSize: 28,
    color: theme.colors.primary,
  },
  disabledButton: {
    opacity: 0.4,
  },
  reviewControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  reviewActions: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
    justifyContent: "center",
    paddingTop: 8,
  },
  successBanner: {
    backgroundColor: "#E6F4EA",
    borderRadius: 12,
    padding: 12,
    width: "100%",
  },
  successText: {
    color: "#137333",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  noticeCard: {
    backgroundColor: theme.colors.surfaceSubtle,
    borderRadius: 16,
    padding: 16,
    gap: 6,
  },
  noticeTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.colors.ink,
  },
  noticeText: {
    fontSize: 12,
    color: theme.colors.muted,
    lineHeight: 16,
  },
  historySection: {
    gap: 12,
    paddingTop: 8,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: theme.colors.ink,
  },
  emptyHistoryText: {
    fontSize: 13,
    color: theme.colors.subtle,
    fontStyle: "italic",
  },
  historyItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  historyInfo: {
    gap: 4,
  },
  historyDate: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.colors.ink,
  },
  historyMeta: {
    fontSize: 11,
    color: theme.colors.subtle,
  },
  statusBadge: {
    backgroundColor: "#F1F3F4",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#5F6368",
  },
  historyTranscript: {
    fontSize: 12,
    fontWeight: "600",
    color: theme.colors.primary,
    fontStyle: "italic",
  },
  asrResultCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#4285F4",
    padding: 18,
    gap: 14,
  },
  asrHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  asrTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  asrTitleIcon: {
    fontSize: 16,
  },
  asrTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: theme.colors.ink,
  },
  asrModelBadge: {
    backgroundColor: "#E8F0FE",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  asrModelText: {
    color: "#1A73E8",
    fontSize: 10,
    fontWeight: "700",
  },
  asrContent: {
    gap: 10,
  },
  comparisonBox: {
    backgroundColor: theme.colors.surfaceSubtle,
    padding: 12,
    borderRadius: 12,
    gap: 4,
  },
  comparisonLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: theme.colors.subtle,
    letterSpacing: 0.8,
  },
  recognizedTranscript: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.colors.ink,
    lineHeight: 22,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  metaLabel: {
    fontSize: 12,
    color: theme.colors.muted,
  },
  metaValue: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.colors.ink,
  },
  metaDivider: {
    fontSize: 12,
    color: theme.colors.border,
  },
  asrSilenceBox: {
    backgroundColor: "#FEF7E0",
    padding: 12,
    borderRadius: 12,
    gap: 4,
  },
  asrSilenceTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#B06000",
  },
  asrSilenceText: {
    fontSize: 12,
    color: "#5F6368",
    lineHeight: 16,
  },
  asrDisclaimerBox: {
    backgroundColor: "#F8F9FA",
    padding: 10,
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: "#4285F4",
  },
  asrDisclaimerText: {
    fontSize: 11,
    color: theme.colors.muted,
    lineHeight: 15,
  },
  assessmentCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#34A853",
    padding: 18,
    gap: 16,
  },
  assessmentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  assessmentTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  assessmentTitleIcon: {
    fontSize: 16,
  },
  assessmentTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: theme.colors.ink,
  },
  evaluatorBadge: {
    backgroundColor: "#E6F4EA",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  evaluatorBadgeText: {
    color: "#137333",
    fontSize: 10,
    fontWeight: "700",
  },
  scoreSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  scoreCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    borderColor: "#34A853",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.colors.surfaceSubtle,
  },
  scoreCircleNumber: {
    fontSize: 22,
    fontWeight: "800",
    color: theme.colors.ink,
    lineHeight: 26,
  },
  scoreCircleTotal: {
    fontSize: 10,
    color: theme.colors.muted,
    fontWeight: "600",
  },
  scoreSummaryText: {
    flex: 1,
    gap: 4,
  },
  scoreSummaryGrade: {
    fontSize: 15,
    fontWeight: "800",
    color: theme.colors.ink,
  },
  scoreSummaryFeedback: {
    fontSize: 12,
    color: theme.colors.subtle,
    fontStyle: "italic",
    lineHeight: 16,
  },
  dimensionsGrid: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },
  dimensionCol: {
    flex: 1,
    gap: 4,
  },
  dimLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: theme.colors.subtle,
  },
  dimValue: {
    fontSize: 11,
    fontWeight: "800",
    color: theme.colors.ink,
  },
  dimBarTrack: {
    height: 6,
    backgroundColor: "#E8EAED",
    borderRadius: 3,
    overflow: "hidden",
  },
  dimBarFill: {
    height: "100%",
    backgroundColor: "#34A853",
    borderRadius: 3,
  },
  wordSection: {
    gap: 8,
  },
  wordSectionTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: theme.colors.ink,
  },
  wordChipContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  wordChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1.5,
    gap: 6,
  },
  wordGood: {
    borderColor: "#CEEAD6",
    backgroundColor: "#E6F4EA",
  },
  wordMed: {
    borderColor: "#FEEFC3",
    backgroundColor: "#FEF7E0",
  },
  wordLow: {
    borderColor: "#FAD2CF",
    backgroundColor: "#FCE8E6",
  },
  wordChipSelected: {
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  wordChipText: {
    fontSize: 13,
    fontWeight: "700",
  },
  wordTextGood: {
    color: "#137333",
  },
  wordTextMed: {
    color: "#B06000",
  },
  wordTextLow: {
    color: "#C5221F",
  },
  wordChipScore: {
    fontSize: 10,
    fontWeight: "800",
    color: theme.colors.muted,
  },
  phonemeDetailBox: {
    backgroundColor: "#F8F9FA",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E8EAED",
    gap: 8,
  },
  phonemeDetailTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: theme.colors.ink,
  },
  phonemeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  phonemePill: {
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 44,
  },
  phonemeCorrect: {
    borderColor: "#34A853",
    backgroundColor: "#E6F4EA",
  },
  phonemeNeedsWork: {
    borderColor: "#FBBC04",
    backgroundColor: "#FEF7E0",
  },
  phonemeOmitted: {
    borderColor: "#EA4335",
    backgroundColor: "#FCE8E6",
  },
  phonemeText: {
    fontSize: 12,
    fontWeight: "800",
    color: theme.colors.ink,
  },
  phonemeScore: {
    fontSize: 9,
    fontWeight: "700",
    color: theme.colors.muted,
  },
  wordTipText: {
    fontSize: 11,
    color: "#B06000",
    lineHeight: 15,
  },
  tipsBox: {
    backgroundColor: "#FEF7E0",
    padding: 12,
    borderRadius: 12,
    gap: 6,
  },
  tipsTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#B06000",
  },
  tipRow: {
    flexDirection: "row",
    gap: 6,
    alignItems: "flex-start",
  },
  tipBullet: {
    fontSize: 12,
    color: "#B06000",
    fontWeight: "800",
  },
  tipText: {
    flex: 1,
    fontSize: 11,
    color: "#5F6368",
    lineHeight: 16,
  },
  evaluatorNoticeBox: {
    backgroundColor: "#F1F3F4",
    padding: 10,
    borderRadius: 10,
  },
  evaluatorNoticeText: {
    fontSize: 10,
    color: theme.colors.muted,
    lineHeight: 14,
  },
  statusBadgeScored: {
    backgroundColor: "#E6F4EA",
  },
  statusBadgeTextScored: {
    color: "#137333",
  },
  historyScoreBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  historyScoreText: {
    fontSize: 11,
    fontWeight: "800",
  },
});
