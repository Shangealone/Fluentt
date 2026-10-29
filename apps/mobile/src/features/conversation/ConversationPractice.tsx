import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useSession } from "../../session/provider";
import {
  ConversationTopic,
  ConversationSession,
  ConversationMessage,
  ConversationSessionSummary,
} from "../../services/api/conversation";
import { useAudioRecorder } from "../pronunciation/useAudioRecorder";
import { theme as baseTheme } from "../../theme/tokens";
import { pc } from "../../theme/personal";
import { Button } from "../../components/ui";
import { conversationLevel } from "./levels";
import { useActivityHistory } from "../history/useActivityHistory";
import { HistorySaveNotice } from "../history/HistorySaveNotice";
const theme = { colors: { ...baseTheme.colors, primary: pc.navy, ink: pc.ink, muted: pc.muted, border: pc.line, background: pc.background } };

export function ConversationPractice({ onDone }: { onDone?: () => void }) {
  const { conversation, pronunciation, profile, activityHistory } = useSession();
  const journal = useActivityHistory(activityHistory, profile?.role === "personal_student" ? profile.id : undefined);
  const personalLanguage = profile?.role === "personal_student" ? profile.language : null;

  // Screen phases: "topics" | "chat" | "summary"
  const [phase, setPhase] = useState<"topics" | "chat" | "summary">("topics");

  // Topics state
  const [topics, setTopics] = useState<ConversationTopic[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState<"all" | "tagalog" | "english">("all");
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [topicsError, setTopicsError] = useState<string | null>(null);

  // Active session state
  const [activeSession, setActiveSession] = useState<ConversationSession | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [startingSession, setStartingSession] = useState(false);
  const [inputText, setInputText] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [inputMode, setInputMode] = useState<"text" | "voice">("text");

  // Summary state
  const [sessionSummary, setSessionSummary] = useState<ConversationSessionSummary | null>(null);

  // Voice recording hook
  const recorder = useAudioRecorder();
  const [voiceUploading, setVoiceUploading] = useState(false);

  const scrollRef = useRef<any>(null);

  // Load topics
  const loadTopics = useCallback(async () => {
    setLoadingTopics(true);
    setTopicsError(null);
    try {
      const langParam = personalLanguage ?? (selectedLanguage === "all" ? undefined : selectedLanguage);
      const res = await conversation.topics(langParam);
      setTopics(res.topics.filter(row => !personalLanguage || row.language === personalLanguage));
    } catch (err) {
      setTopicsError(err instanceof Error ? err.message : "Failed to load conversation scenarios.");
    } finally {
      setLoadingTopics(false);
    }
  }, [conversation, selectedLanguage, personalLanguage]);

  useEffect(() => {
    loadTopics();
  }, [loadTopics]);

  // Start scenario
  const handleStartTopic = async (topicId: string) => {
    setStartingSession(true);
    try {
      const sess = await conversation.startSession(topicId);
      setActiveSession(sess);
      // Keep render state independent from demo adapters' mutable session arrays.
      setMessages([...(sess.messages || [])]);
      setPhase("chat");
      setInputText("");
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200);
    } catch (err) {
      Alert.alert("Unable to Start Practice", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setStartingSession(false);
    }
  };

  // Send Text Message
  const handleSendText = async () => {
    if (!inputText.trim() || !activeSession || sendingMessage) return;
    const textToSend = inputText.trim();
    setInputText("");
    setSendingMessage(true);

    try {
      const res = await conversation.sendMessage(activeSession.session_id, textToSend, null);
      journal.recordOnce(res.user_message.id, { kind: "tutor_reply", source_id: activeSession.session_id, title: activeSession.topic_title, language: activeSession.language === "english" ? "english" : "tagalog" });
      setMessages((prev) => [...prev, res.user_message, res.assistant_message]);
      setActiveSession((prev) =>
        prev ? { ...prev, turns_count: res.turns_count, status: res.is_session_complete ? "ended" : prev.status } : null
      );
      if (res.is_session_complete) {
        handleEndSession();
      }
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
    } catch (err) {
      Alert.alert("Failed to Send Message", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setSendingMessage(false);
    }
  };

  // Send Spoken Message
  const handleSendVoice = async () => {
    if (!recorder.audioPayload || !activeSession || voiceUploading) return;
    setVoiceUploading(true);

    try {
      // 1. Submit audio attempt through pronunciation service (which triggers Section 33 ASR + Section 34 GOP evaluation)
      const attemptRes = await pronunciation.submitAttempt(
        activeSession.topic_id,
        recorder.audioPayload,
        recorder.durationMs
      );

      // 2. Discard local recorder buffer
      await recorder.discardRecording();

      // 3. Send message with linked attempt ID
      const res = await conversation.sendMessage(activeSession.session_id, null, attemptRes.attempt_id);
      journal.recordOnce(res.user_message.id, { kind: "tutor_reply", source_id: activeSession.session_id, title: activeSession.topic_title, language: activeSession.language === "english" ? "english" : "tagalog" });
      setMessages((prev) => [...prev, res.user_message, res.assistant_message]);
      setActiveSession((prev) =>
        prev ? { ...prev, turns_count: res.turns_count, status: res.is_session_complete ? "ended" : prev.status } : null
      );
      if (res.is_session_complete) {
        handleEndSession();
      }
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
    } catch (err) {
      Alert.alert("Voice Processing Failed", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setVoiceUploading(false);
    }
  };

  // End Session
  const handleEndSession = async () => {
    if (!activeSession) return;
    try {
      const summary = await conversation.endSession(activeSession.session_id);
      if (summary.turns_completed > 0) journal.recordOnce(`ended-${activeSession.session_id}`, { kind: "tutor_session", source_id: activeSession.session_id, title: activeSession.topic_title, language: activeSession.language === "english" ? "english" : "tagalog" });
      setSessionSummary(summary);
      setPhase("summary");
    } catch (err) {
      Alert.alert("Error Ending Session", err instanceof Error ? err.message : "Could not complete session.");
    }
  };

  // Return to topics
  const handleBackToTopics = () => {
    setPhase("topics");
    setActiveSession(null);
    setSessionSummary(null);
    setMessages([]);
    loadTopics();
  };

  // Render: Topics List
  if (phase === "topics") {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={styles.headerBox}>
          <Text style={styles.badgeText}>A little everyday immersion</Text>
          <Text style={styles.mainTitle}>Let’s start a conversation.</Text>
          <Text style={styles.subtitle}>
            Choose a setting. Meet your conversation partner. Practise English or Tagalog through guided role-play.
          </Text>
          <Text style={{ color: pc.rose, fontSize: 11, lineHeight: 17 }}>Local conversation simulator · Replies and coaching are simulated.</Text>
        </View>

        {/* Language Filter */}
        {!personalLanguage && <View style={styles.filterRow}>
          <Pressable
            style={[styles.filterTab, selectedLanguage === "all" && styles.filterTabActive]}
            onPress={() => setSelectedLanguage("all")}
          >
            <Text style={[styles.filterTabText, selectedLanguage === "all" && styles.filterTabTextActive]}>
              All Languages
            </Text>
          </Pressable>
          <Pressable
            style={[styles.filterTab, selectedLanguage === "tagalog" && styles.filterTabActive]}
            onPress={() => setSelectedLanguage("tagalog")}
          >
            <Text style={[styles.filterTabText, selectedLanguage === "tagalog" && styles.filterTabTextActive]}>
              🇵🇭 Tagalog
            </Text>
          </Pressable>
          <Pressable
            style={[styles.filterTab, selectedLanguage === "english" && styles.filterTabActive]}
            onPress={() => setSelectedLanguage("english")}
          >
            <Text style={[styles.filterTabText, selectedLanguage === "english" && styles.filterTabTextActive]}>
              🌐 English
            </Text>
          </Pressable>
        </View>}

        {/* Loading / Error States */}
        {loadingTopics ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.loadingText}>Loading practice scenarios...</Text>
          </View>
        ) : topicsError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{topicsError}</Text>
            <Button label="Retry" variant="secondary" onPress={loadTopics} />
          </View>
        ) : (
          <View style={styles.topicsGrid}>
            {topics.map((t) => (
              <View key={t.id} style={styles.topicCard}>
                <View style={styles.topicCardHeader}>
                  <View style={styles.langPill}>
                    <Text style={styles.langPillText}>
                      {t.language === "tagalog" ? "🇵🇭 Tagalog" : "🌐 English"}
                    </Text>
                  </View>
                  <Text style={styles.levelBadge}>{conversationLevel(t.target_level)}</Text>
                </View>

                <Text style={styles.topicTitle}>{t.title}</Text>
                <Text style={styles.personaText}>👤 Role-Play Partner: {t.persona}</Text>
                <Text style={styles.topicDesc}>{t.scenario_description}</Text>

                <View style={styles.goalBox}>
                  <Text style={styles.goalLabel}>🎯 Practice Goal:</Text>
                  <Text style={styles.goalText}>{t.goal}</Text>
                </View>

                {t.vocabulary_hints && t.vocabulary_hints.length > 0 && (
                  <View style={styles.hintsRow}>
                    {t.vocabulary_hints.map((hint, hIdx) => (
                      <View key={hIdx} style={styles.hintPill}>
                        <Text style={styles.hintText}>{hint}</Text>
                      </View>
                    ))}
                  </View>
                )}

                <Button
                  label={startingSession ? "Starting..." : "Start Scenario"}
                  variant="primary"
                  disabled={startingSession}
                  onPress={() => handleStartTopic(t.id)}
                />
              </View>
            ))}
          </View>
        )}

        {onDone && (
          <View style={{ marginTop: 24 }}>
            <Button label="Back to Dashboard" variant="secondary" onPress={onDone} />
          </View>
        )}
      </ScrollView>
    );
  }

  // Render: Active Chat
  if (phase === "chat" && activeSession) {
    return (
      <View style={styles.chatContainer}>
        {/* Chat Header */}
        <View style={styles.chatHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.chatTitle} numberOfLines={2}>
              {activeSession.topic_title}
            </Text>
            <Text style={styles.chatPersona}>
              👤 {activeSession.persona} · {activeSession.language === "tagalog" ? "Tagalog" : "English"}
            </Text>
          </View>

          <View style={styles.chatHeaderRight}>
            <View style={styles.turnBadge}>
              <Text style={styles.turnBadgeText}>
                Turn {activeSession.turns_count}/{activeSession.max_turns}
              </Text>
            </View>
            <Pressable style={styles.endBtn} onPress={handleEndSession}>
              <Text style={styles.endBtnText}>Finish</Text>
            </Pressable>
          </View>
        </View>
        <View style={{ paddingVertical: 10, paddingHorizontal: 14, backgroundColor: pc.soft, borderRadius: 10 }}><Text style={{ color: pc.rose, fontSize: 11 }}>Dialogue stream · Local simulation · Not a language assessment</Text></View>

        {/* Message Feed */}
        <ScrollView
          ref={scrollRef}
          style={styles.messageList}
          contentContainerStyle={styles.messageListContent}
        >
          {messages.map((m, idx) => {
            const isUser = m.role === "user";
            return (
              <View
                key={idx}
                style={[
                  styles.messageBubbleWrapper,
                  isUser ? styles.userBubbleWrapper : styles.assistantBubbleWrapper,
                ]}
              >
                {!isUser && (
                  <View style={styles.avatarMini}>
                    <Text style={styles.avatarMiniText}>AI</Text>
                  </View>
                )}

                <View
                  style={[
                    styles.messageBubble,
                    isUser ? styles.userBubble : styles.assistantBubble,
                  ]}
                >
                  {/* Spoken badge if user sent audio */}
                  {isUser && m.audio_attempt_id && (
                    <View style={styles.spokenBadgeRow}>
                      <Text style={styles.spokenBadge}>🎙 Spoken Response</Text>
                      {m.pronunciation_score != null && (
                        <Text style={styles.pronScoreChip}>
                          🎯 Score: {Math.round(m.pronunciation_score)}/100
                        </Text>
                      )}
                    </View>
                  )}

                  <Text
                    style={[
                      styles.messageText,
                      isUser ? styles.userMessageText : styles.assistantMessageText,
                    ]}
                  >
                    {m.content}
                  </Text>

                  {/* Formative Feedback for Assistant turns */}
                  {!isUser && m.feedback && (
                    <View style={styles.feedbackBox}>
                      <Text style={styles.feedbackHeader}>✧ Conversation coaching · Simulated</Text>
                      <Text style={styles.feedbackSummary}>{m.feedback.summary}</Text>
                      {m.feedback.politeness_marker_detected && (
                        <Text style={styles.feedbackPolite}>
                          ✓ Magalang na pananalita (polite markers) detected!
                        </Text>
                      )}
                      {m.feedback.suggestions && m.feedback.suggestions.length > 0 && (
                        <View style={{ gap: 2, marginTop: 4 }}>
                          {m.feedback.suggestions.map((sug, sIdx) => (
                            <Text key={sIdx} style={styles.feedbackSuggestion}>
                              • {sug}
                            </Text>
                          ))}
                        </View>
                      )}
                    </View>
                  )}
                </View>
              </View>
            );
          })}

          {sendingMessage && (
            <View style={styles.assistantBubbleWrapper}>
              <View style={styles.avatarMini}>
                <Text style={styles.avatarMiniText}>AI</Text>
              </View>
              <View style={[styles.messageBubble, styles.assistantBubble, { paddingVertical: 12 }]}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
                <Text style={styles.typingText}>Responding to your message...</Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Input Bar */}
        <View style={styles.inputBarContainer}>
          {/* Mode Switcher Tabs */}
          <View style={styles.inputModeRow}>
            <Pressable
              style={[styles.inputModeTab, inputMode === "text" && styles.inputModeTabActive]}
              onPress={() => setInputMode("text")}
            >
              <Text style={[styles.inputModeText, inputMode === "text" && styles.inputModeTextActive]}>
                ⌨ Type Message
              </Text>
            </Pressable>
            <Pressable
              style={[styles.inputModeTab, inputMode === "voice" && styles.inputModeTabActive]}
              onPress={() => setInputMode("voice")}
            >
              <Text style={[styles.inputModeText, inputMode === "voice" && styles.inputModeTextActive]}>
                🎙 Speak Response
              </Text>
            </Pressable>
          </View>

          {inputMode === "text" ? (
            <View style={styles.textInputRow}>
              <TextInput
                accessibilityLabel="Your conversation reply"
                style={styles.textInput}
                placeholder={
                  activeSession.language === "tagalog"
                    ? "I-type ang iyong tugon..."
                    : "Type your reply..."
                }
                value={inputText}
                onChangeText={setInputText}
                maxLength={1000}
                multiline
                editable={!sendingMessage}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Send reply"
                style={[
                  styles.sendButton,
                  (!inputText.trim() || sendingMessage) && styles.sendButtonDisabled,
                ]}
                disabled={!inputText.trim() || sendingMessage}
                onPress={handleSendText}
              >
                <Text style={styles.sendButtonText}>Send</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.voiceInputBox}>
              <View style={styles.voiceControlsRow}>
                {recorder.status === "recording" ? (
                  <Pressable style={styles.voiceStopBtn} onPress={() => recorder.stopRecording()}>
                    <Text style={styles.voiceBtnText}>⏹ Stop Recording</Text>
                  </Pressable>
                ) : recorder.status === "recorded" ? (
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <Pressable
                      style={styles.voiceSubmitBtn}
                      disabled={voiceUploading}
                      onPress={handleSendVoice}
                    >
                      {voiceUploading ? (
                        <ActivityIndicator color="#FFF" size="small" />
                      ) : (
                        <Text style={styles.voiceBtnText}>⬆ Transcribe & Send</Text>
                      )}
                    </Pressable>
                    <Pressable
                      style={styles.voiceDiscardBtn}
                      disabled={voiceUploading}
                      onPress={() => recorder.discardRecording()}
                    >
                      <Text style={styles.voiceDiscardText}>Discard</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    style={styles.voiceRecordBtn}
                    onPress={() => recorder.startRecording()}
                  >
                    <Text style={styles.voiceBtnText}>🎙 Tap to Speak</Text>
                  </Pressable>
                )}

                <Text style={styles.voiceTimerText}>
                  {(recorder.durationMs / 1000).toFixed(1)}s
                </Text>
              </View>

              <Text style={styles.voiceHintText}>
                Speech recognition and pronunciation feedback currently use local simulators.
              </Text>
            </View>
          )}

          <Text style={styles.safetyNoticeText}>
            🔒 Educational role-play conversation. All dialogues are bounded to curriculum guidelines.
          </Text>
          <HistorySaveNotice error={journal.error} retry={journal.retry} />
        </View>
      </View>
    );
  }

  // Render: Session Summary
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.summaryCard}>
        <HistorySaveNotice error={journal.error} retry={journal.retry} />
        <View style={styles.summaryHeader}>
          <Text style={styles.summaryIcon}>🌟</Text>
          <Text style={styles.summaryTitle}>Scenario Practice Complete!</Text>
          <Text style={styles.summarySubtitle}>
            Completed {sessionSummary?.turns_completed || 0} conversation turns.
          </Text>
        </View>

        <View style={styles.summarySection}>
          <Text style={styles.summarySectionTitle}>Overall Formative Assessment</Text>
          <Text style={styles.summaryFeedbackText}>{sessionSummary?.overall_feedback}</Text>
        </View>

        {sessionSummary?.strengths && sessionSummary.strengths.length > 0 && (
          <View style={styles.summarySection}>
            <Text style={styles.summarySectionTitle}>Key Strengths</Text>
            {sessionSummary.strengths.map((str, sIdx) => (
              <Text key={sIdx} style={styles.summaryBulletText}>
                ✓ {str}
              </Text>
            ))}
          </View>
        )}

        {sessionSummary?.recommendations && sessionSummary.recommendations.length > 0 && (
          <View style={styles.summarySection}>
            <Text style={styles.summarySectionTitle}>Recommended Practice Areas</Text>
            {sessionSummary.recommendations.map((rec, rIdx) => (
              <Text key={rIdx} style={styles.summaryBulletText}>
                💡 {rec}
              </Text>
            ))}
          </View>
        )}

        <View style={styles.disclaimerBox}>
          <Text style={styles.disclaimerText}>
            🔬 Practice conversations are formative exercises designed to support spontaneous language skills.
            They do not represent official certification, grades, or research evaluations.
          </Text>
        </View>

        <View style={{ gap: 10, marginTop: 16 }}>
          <Button label="Choose Another Scenario" variant="primary" onPress={handleBackToTopics} />
          {onDone && <Button label="Back to Dashboard" variant="secondary" onPress={onDone} />}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 0,
    gap: 16,
    paddingBottom: 20,
  },
  headerBox: {
    gap: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "800",
    color: theme.colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  mainTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: theme.colors.ink,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.muted,
    lineHeight: 20,
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  filterTabActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.colors.ink,
  },
  filterTabTextActive: {
    color: "#FFFFFF",
  },
  centerBox: {
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: theme.colors.muted,
  },
  errorBox: {
    padding: 20,
    borderRadius: 12,
    backgroundColor: "#FCE8E6",
    gap: 10,
    alignItems: "center",
  },
  errorText: {
    fontSize: 13,
    color: "#C5221F",
    textAlign: "center",
  },
  topicsGrid: {
    gap: 16,
  },
  topicCard: {
    backgroundColor: theme.colors.surface,
    padding: 18,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    gap: 12,
  },
  topicCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  langPill: {
    backgroundColor: "#EEF4FF",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  langPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: theme.colors.primary,
  },
  levelBadge: {
    fontSize: 11,
    fontWeight: "600",
    color: theme.colors.muted,
  },
  topicTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: theme.colors.ink,
  },
  personaText: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.colors.primary,
  },
  topicDesc: {
    fontSize: 13,
    color: theme.colors.muted,
    lineHeight: 18,
  },
  goalBox: {
    backgroundColor: theme.colors.surfaceSubtle,
    padding: 10,
    borderRadius: 10,
    gap: 4,
  },
  goalLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: theme.colors.subtle,
  },
  goalText: {
    fontSize: 12,
    color: theme.colors.ink,
    lineHeight: 16,
  },
  hintsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  hintPill: {
    backgroundColor: "#E8F0FE",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  hintText: {
    fontSize: 11,
    color: "#1A73E8",
    fontWeight: "600",
  },
  chatContainer: {
    flex: 1,
    backgroundColor: pc.background,
  },
  chatHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  chatTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: theme.colors.ink,
  },
  chatPersona: {
    fontSize: 12,
    color: theme.colors.muted,
  },
  chatHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  turnBadge: {
    backgroundColor: theme.colors.surfaceSubtle,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  turnBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: theme.colors.subtle,
  },
  endBtn: {
    backgroundColor: "#FCE8E6",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  endBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: pc.rose,
  },
  messageList: {
    flex: 1,
  },
  messageListContent: {
    paddingVertical: 16,
    paddingHorizontal: 0,
    gap: 14,
  },
  messageBubbleWrapper: {
    flexDirection: "row",
    gap: 8,
    maxWidth: "95%",
  },
  userBubbleWrapper: {
    alignSelf: "flex-end",
  },
  assistantBubbleWrapper: {
    alignSelf: "flex-start",
  },
  avatarMini: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  avatarMiniText: {
    color: "#FFF",
    fontSize: 10,
    fontWeight: "800",
  },
  messageBubble: {
    flexShrink: 1,
    minWidth: 0,
    padding: 14,
    borderRadius: 16,
    gap: 6,
  },
  userBubble: {
    backgroundColor: theme.colors.primary,
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderBottomLeftRadius: 4,
  },
  spokenBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 4,
  },
  spokenBadge: {
    fontSize: 10,
    fontWeight: "800",
    color: "#D2E3FC",
  },
  pronScoreChip: {
    fontSize: 10,
    fontWeight: "800",
    color: "#A8DAB5",
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  userMessageText: {
    color: "#FFFFFF",
    fontWeight: "500",
  },
  assistantMessageText: {
    color: theme.colors.ink,
  },
  typingText: {
    fontSize: 12,
    color: theme.colors.muted,
    fontStyle: "italic",
  },
  feedbackBox: {
    marginTop: 6,
    backgroundColor: pc.pink,
    padding: 10,
    borderRadius: 10,
    gap: 4,
  },
  feedbackHeader: {
    fontSize: 10,
    fontWeight: "800",
    color: pc.rose,
    textTransform: "uppercase",
  },
  feedbackSummary: {
    fontSize: 11,
    color: "#5F6368",
    lineHeight: 15,
  },
  feedbackPolite: {
    fontSize: 10,
    fontWeight: "700",
    color: "#137333",
  },
  feedbackSuggestion: {
    fontSize: 10,
    color: "#5F6368",
  },
  inputBarContainer: {
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    padding: 12,
    gap: 8,
  },
  inputModeRow: {
    flexDirection: "row",
    gap: 8,
  },
  inputModeTab: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: theme.colors.surfaceSubtle,
  },
  inputModeTabActive: {
    backgroundColor: theme.colors.primary,
  },
  inputModeText: {
    fontSize: 11,
    fontWeight: "700",
    color: theme.colors.subtle,
  },
  inputModeTextActive: {
    color: "#FFFFFF",
  },
  textInputRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  textInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: theme.colors.ink,
    backgroundColor: "#FAFAFA",
  },
  sendButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  sendButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 13,
  },
  voiceInputBox: {
    backgroundColor: theme.colors.surfaceSubtle,
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
  voiceControlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  voiceRecordBtn: {
    backgroundColor: pc.rose,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  voiceStopBtn: {
    backgroundColor: "#34A853",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  voiceSubmitBtn: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  voiceDiscardBtn: {
    backgroundColor: "#F1F3F4",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  voiceBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  voiceDiscardText: {
    color: theme.colors.ink,
    fontSize: 12,
    fontWeight: "600",
  },
  voiceTimerText: {
    fontSize: 13,
    fontWeight: "800",
    color: theme.colors.ink,
  },
  voiceHintText: {
    fontSize: 10,
    color: theme.colors.muted,
  },
  safetyNoticeText: {
    fontSize: 10,
    color: theme.colors.muted,
    textAlign: "center",
  },
  summaryCard: {
    backgroundColor: theme.colors.surface,
    padding: 24,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: "#34A853",
    gap: 16,
  },
  summaryHeader: {
    alignItems: "center",
    gap: 6,
  },
  summaryIcon: {
    fontSize: 36,
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: theme.colors.ink,
  },
  summarySubtitle: {
    fontSize: 13,
    color: theme.colors.muted,
  },
  summarySection: {
    gap: 6,
    backgroundColor: theme.colors.surfaceSubtle,
    padding: 14,
    borderRadius: 14,
  },
  summarySectionTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: theme.colors.subtle,
    textTransform: "uppercase",
  },
  summaryFeedbackText: {
    fontSize: 13,
    color: theme.colors.ink,
    lineHeight: 18,
  },
  summaryBulletText: {
    fontSize: 12,
    color: theme.colors.ink,
    lineHeight: 16,
  },
  disclaimerBox: {
    backgroundColor: "#F8F9FA",
    padding: 12,
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.primary,
  },
  disclaimerText: {
    fontSize: 11,
    color: theme.colors.muted,
    lineHeight: 15,
  },
});
