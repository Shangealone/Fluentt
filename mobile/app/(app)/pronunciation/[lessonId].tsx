import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Linking, Platform, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import appConfig from '../../../app.json';
import { AppText } from '../../../src/components/AppText';
import { useAuth } from '../../../src/auth/AuthProvider';
import { fetchLessonDetail } from '../../../src/content/api';
import { VocabularyItem } from '../../../src/content/types';
import { CaptureController, CaptureSnapshot, CAPTURE_PROFILE } from '../../../src/pronunciation/capture';
import { nativeCapture } from '../../../src/pronunciation/nativeCapture';
import { checkPronunciation, submitPronunciation, TargetKind } from '../../../src/pronunciation/api';
import { SubmissionController, SubmissionSnapshot } from '../../../src/pronunciation/submission';

export default function PronunciationScreen() {
  const { lessonId, contentReleaseId, vocabularyItemId } = useLocalSearchParams<{ lessonId: string; contentReleaseId: string; vocabularyItemId: string }>();
  const { user, status } = useAuth();
  return <Practice key={`${status}:${user?.id}:${lessonId}:${contentReleaseId}:${vocabularyItemId}`} lessonId={lessonId} releaseId={contentReleaseId} itemId={vocabularyItemId} ownerId={status === 'signedIn' ? user?.id : undefined} />;
}

function Practice({ lessonId, releaseId, itemId, ownerId }: { lessonId: string; releaseId: string; itemId: string; ownerId?: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [target, setTarget] = useState<VocabularyItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [kind, setKind] = useState<TargetKind>('term');
  const [snapshot, setSnapshot] = useState<CaptureSnapshot>({ state: 'ready', durationMs: 0 });
  const [submission, setSubmission] = useState<SubmissionSnapshot>({ state: 'idle' });
  const captureRef = useRef<CaptureController | null>(null);
  const submissionRef = useRef<SubmissionController | null>(null);
  const pollUntil = useRef(0);

  useEffect(() => {
    let active = true;
    const capture = new CaptureController(nativeCapture, setSnapshot);
    const assessment = new SubmissionController(ownerId ?? '', { submit: submitPronunciation, check: checkPronunciation }, setSubmission);
    captureRef.current = capture;
    submissionRef.current = assessment;
    async function loadTarget() {
      try {
        if (Platform.OS !== 'android' || !ownerId || !lessonId || !releaseId || !itemId) return;
        const { lesson } = await fetchLessonDetail(lessonId, releaseId);
        const item = lesson.vocabularyItems.find((entry) => entry.id === itemId);
        if (active && lesson.languageCode === 'en' && lesson.contentReleaseId === releaseId && item?.contentReleaseId === releaseId && item.contentRevisionId && item.term.trim()) setTarget(item);
      } catch { /* Render the localized unavailable state. */ }
      finally { if (active) setLoading(false); }
    }
    void loadTarget();
    return () => { active = false; assessment.dispose(); void capture.dispose(); captureRef.current = null; submissionRef.current = null; };
  }, [lessonId, releaseId, itemId, ownerId]);

  useFocusEffect(React.useCallback(() => {
    const cancel = () => { submissionRef.current?.cancel(); void captureRef.current?.cancel(); };
    const subscription = AppState.addEventListener('change', (state) => { if (state !== 'active') cancel(); });
    return () => { subscription.remove(); cancel(); };
  }, []));

  useEffect(() => {
    if (snapshot.state !== 'recording') return;
    const timer = setInterval(() => captureRef.current?.tick(), 100);
    return () => clearInterval(timer);
  }, [snapshot.state]);

  useEffect(() => {
    if (submission.state !== 'processing' || Date.now() >= pollUntil.current) return;
    const timer = setTimeout(() => { void submissionRef.current?.check(); }, 2000);
    return () => clearTimeout(timer);
  }, [submission]);

  useEffect(() => {
    if (['scored', 'unscorable', 'failed'].includes(submission.state)) void captureRef.current?.cancel();
  }, [submission.state]);

  function reset() { submissionRef.current?.cancel(); void captureRef.current?.cancel(); }
  function start() { void captureRef.current?.start(); }
  function submit() {
    if (!target?.contentRevisionId || !snapshot.recording || !ownerId) return;
    pollUntil.current = Date.now() + 20_000;
    void submissionRef.current?.submit({
      client_pronunciation_attempt_id: snapshot.recording.clientAttemptId, vocabulary_item_id: target.id,
      content_revision_id: target.contentRevisionId, content_release_id: releaseId,
      target_kind: kind, original_interaction_at: snapshot.recording.completedAt,
      capture_profile_version: CAPTURE_PROFILE, device_platform: 'android', application_version: appConfig.expo.version,
    }, snapshot.recording.uri);
  }

  const busy = snapshot.state === 'preparing' || snapshot.state === 'stopping' || submission.state === 'submitting';
  const recording = snapshot.state === 'recording';
  const result = submission.result;


  return <SafeAreaView style={styles.container}><ScrollView contentContainerStyle={styles.content}>
    <ActionButton label={t('common.back')} onPress={() => { reset(); router.back(); }} />
    <AppText style={styles.title}>{t('pronunciation.title')}</AppText>
    <AppText style={styles.notice}>{t('pronunciation.notice')}</AppText>
    {loading ? <ActivityIndicator accessibilityLabel={t('common.loading')} /> : !target ? <AppText accessibilityRole="alert">{t('pronunciation.unavailable')}</AppText> : <>
      <AppText style={styles.term}>{kind === 'term' ? target.term : target.exampleSentence}</AppText>
      <AppText style={styles.description}>{target.translation || target.definition}</AppText>
      <ActionButton label={t(kind === 'term' ? 'pronunciation.useSentence' : 'pronunciation.useTerm')} onPress={() => { reset(); setKind(kind === 'term' ? 'sentence' : 'term'); }} disabled={busy || recording || !target.exampleSentence.trim()} />
      <AppText>{t('pronunciation.instructions')}</AppText>
      <AppText accessibilityLiveRegion="polite" style={styles.status}>{t(`pronunciation.${submission.state === 'idle' ? `states.${snapshot.state}` : `submission.${submission.state}`}`)}</AppText>
      {submission.state === 'idle' ? <AppText style={styles.timer}>{(Math.min(10_000, Math.max(0, snapshot.durationMs)) / 1000).toFixed(1)} / 10 s</AppText> : null}
      {snapshot.error ? <AppText accessibilityRole="alert">{t(`pronunciation.errors.${snapshot.error}`)}</AppText> : null}
      {submission.error ? <AppText accessibilityRole="alert">{t(`pronunciation.errors.${submission.error}`)}</AppText> : null}
      {result?.status === 'scored' ? <>
        <AppText style={styles.timer}>{t('pronunciation.score', { score: result.assessment.accuracy_score_display })}</AppText>
        <AppText>{t('pronunciation.category', { category: result.assessment.category })}</AppText>
      </> : null}
      {result?.feedbackKey ? <AppText>{t(result.feedbackKey)}</AppText> : null}
      {result?.issues.map((issue) => <AppText key={issue.id}>{t(`pronunciation.issue.${issue.level === 'phoneme' ? 'phoneme' : issue.provider_error_type ?? 'None'}`, { unit: issue.target_unit })}</AppText>)}
      {result?.recovery === 'operator_action' ? <AppText>{t('pronunciation.operatorAction')}</AppText> : null}
      {snapshot.state === 'permission_denied' ? <ActionButton label={t('pronunciation.settings')} onPress={() => { void Linking.openSettings().catch(() => undefined); }} /> : null}
      {submission.state === 'idle' ? <>
        {recording ? <ActionButton label={t('pronunciation.stop')} onPress={() => { void captureRef.current?.stop(); }} /> : <ActionButton label={t('pronunciation.record')} onPress={start} disabled={busy} />}
        {snapshot.recording ? <ActionButton label={t('pronunciation.submit')} onPress={submit} disabled={busy} /> : null}
      </> : null}
      {submission.state === 'uncertain' || submission.state === 'processing' ? <ActionButton label={t('pronunciation.checkStatus')} onPress={() => { void submissionRef.current?.check(); }} /> : null}
      {submission.state !== 'idle' && submission.state !== 'submitting' ? <ActionButton label={t('pronunciation.tryAgain')} onPress={reset} /> : null}
      <ActionButton label={t('pronunciation.cancel')} onPress={reset} />
    </>}
  </ScrollView></SafeAreaView>;
}

function ActionButton({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[styles.button, disabled && styles.disabled]}><AppText style={styles.buttonText}>{label}</AppText></Pressable>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 24, gap: 18 },
  title: { fontSize: 24, fontWeight: '700', color: '#0f172a' },
  term: { fontSize: 36, fontWeight: '700', color: '#0f172a', textAlign: 'center' },
  description: { color: '#475569', textAlign: 'center', fontSize: 17 },
  notice: { backgroundColor: '#fef3c7', color: '#78350f', padding: 16, borderRadius: 12 },
  status: { fontSize: 17, fontWeight: '600' },
  timer: { fontSize: 28, color: '#334155', fontVariant: ['tabular-nums'] },
  button: { backgroundColor: '#2563eb', padding: 16, borderRadius: 10, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  disabled: { opacity: 0.45 },
});
