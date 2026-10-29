import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText } from '../components/AppText';
import { useAuth } from '../auth/AuthProvider';
import { getSessionEpoch } from '../auth/tokenStore';
import { fetchLessonDetail } from '../content/api';
import { VocabularyItem } from '../content/types';
import { assessRecording, getSpeechCapabilities, recognizeSnapshot } from './api';
import { discardClip } from './pcmBuffer';
import { useSpeechCapture } from './useSpeechCapture';
import { AssessmentResponse, Capability, ModelIdentity, PCMClip, RecognitionResponse, SpeechCapabilities, SpeechRequest } from './types';

interface Attempt {
  owner: string; sessionId: string; sequence: number; itemId: string; revisionId: string; releaseId: string;
  capabilities: SpeechCapabilities;
}
function newId(): string {
  // Load only when recording is requested, so older native clients can still open lessons.
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- Defer native crypto until an explicit recording action.
  return (require('expo-crypto') as typeof import('expo-crypto')).randomUUID();
}
function checkModel(result: ModelIdentity, cap: Capability) {
  if (cap.mode === 'unavailable' || result.model_id !== cap.model_id || result.model_revision !== cap.model_revision ||
      result.validation_status !== cap.validation_status || (cap.mode === 'learner' && result.validation_status !== 'validated')) throw new Error('Model changed.');
}
function input(context: Attempt, clip: PCMClip, final: boolean, assessment: boolean, signal?: AbortSignal): SpeechRequest {
  return { requestId: newId(), sessionId: context.sessionId, sequence: context.sequence++, isFinal: final,
    sampleRateHz: clip.sampleRateHz, channels: 1, itemId: context.itemId, revisionId: context.revisionId,
    releaseId: context.releaseId, expectedUserId: context.owner, signal,
    consentVersion: assessment ? context.capabilities.assessment_consent_version : context.capabilities.recognition_consent_version };
}

export default function SpeechPracticeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const owner = user?.id ?? '';
  const { itemId, lessonId, revisionId, releaseId } = useLocalSearchParams<{
    itemId: string; lessonId: string; revisionId: string; releaseId: string;
  }>();
  const [target, setTarget] = useState<{ item: VocabularyItem; language: 'en' | 'fil' } | null>(null);
  const [capabilities, setCapabilities] = useState<SpeechCapabilities | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [recognitionConsent, setRecognitionConsent] = useState(false);
  const [assessmentConsent, setAssessmentConsent] = useState(false);
  const [recognition, setRecognition] = useState<RecognitionResponse | null>(null);
  const [score, setScore] = useState<AssessmentResponse | null>(null);
  const [hasClip, setHasClip] = useState(false);
  const [phase, setPhase] = useState<'ready' | 'starting' | 'recording' | 'recognizing' | 'assessing' | 'finished'>('ready');
  const mounted = useRef(true);
  const generation = useRef(0);
  const busy = useRef(false);
  const recording = useRef(false);
  const context = useRef<Attempt | null>(null);
  const recorded = useRef<PCMClip | null>(null);
  const partial = useRef<Promise<void> | null>(null);
  const abort = useRef<AbortController | null>(null);
  const cancelCapture = useRef<() => void>(() => {});

  const invalidate = useCallback((interrupted = false) => {
    const wasActive = busy.current || recording.current || recorded.current !== null;
    generation.current++;
    abort.current?.abort(); abort.current = null;
    discardClip(recorded.current); recorded.current = null;
    context.current = null; partial.current = null;
    busy.current = false; recording.current = false;
    if (mounted.current) {
      setRecognition(null); setScore(null); setHasClip(false); setPhase('ready');
      if (interrupted && wasActive) setError(t('speech.interrupted'));
    }
  }, [t]);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; invalidate(); cancelCapture.current(); };
  }, [invalidate]);

  const onSnapshot = useCallback((clip: PCMClip) => {
    const current = context.current;
    if (!current || partial.current || !recording.current) { discardClip(clip); return; }
    const version = generation.current;
    const job = recognizeSnapshot(input(current, clip, false, false, abort.current?.signal), clip.pcm)
      .then(result => {
        if (generation.current !== version || !mounted.current) return;
        checkModel(result, current.capabilities.recognition);
        setRecognition(result);
      }).catch(() => {
        if (generation.current !== version || !mounted.current) return;
        cancelCapture.current(); invalidate(); setError(t('speech.recordAgain'));
      }).finally(() => { discardClip(clip); if (partial.current === job) partial.current = null; });
    partial.current = job;
  }, [invalidate, t]);

  const onFinished = useCallback((clip: PCMClip) => {
    const current = context.current;
    if (!current || !recording.current) { discardClip(clip); return; }
    const version = generation.current;
    recording.current = false; busy.current = true; recorded.current = clip;
    setPhase('recognizing');
    void (async () => {
      try {
        await partial.current;
        if (version !== generation.current || !mounted.current) return;
        const result = await recognizeSnapshot(input(current, clip, true, false, abort.current?.signal), clip.pcm);
        if (version !== generation.current || !mounted.current) return;
        checkModel(result, current.capabilities.recognition);
        setRecognition(result); setHasClip(true); setPhase('finished'); busy.current = false;
      } catch {
        if (version === generation.current && mounted.current) { invalidate(); setError(t('speech.recordAgain')); }
      }
    })();
  }, [invalidate, t]);

  const capture = useSpeechCapture({ expectedUserId: owner, onSnapshot, onFinished,
    onInterrupted: () => invalidate(true) });
  useLayoutEffect(() => { cancelCapture.current = capture.cancel; }, [capture.cancel]);

  useEffect(() => {
    let cancelled = false;
    const epoch = getSessionEpoch();
    const controller = new AbortController();
    const current = () => !cancelled && mounted.current && epoch === getSessionEpoch();
    void (async () => {
      await Promise.resolve();
      if (!current()) return;
      invalidate(); cancelCapture.current();
      setLoading(true); setTarget(null); setCapabilities(null); setError('');
      setRecognitionConsent(false); setAssessmentConsent(false);
      try {
        if (!owner || ![itemId, lessonId, revisionId, releaseId].every(v => typeof v === 'string' && v)) throw new Error('Missing target.');
        const loaded = await fetchLessonDetail(lessonId, releaseId);
        if (!current()) return;
        const item = loaded.lesson.vocabularyItems.find(i => i.id === itemId && i.contentRevisionId === revisionId && i.contentReleaseId === releaseId);
        const language = loaded.lesson.languageCode;
        if (!item || loaded.lesson.contentReleaseId !== releaseId || (language !== 'en' && language !== 'fil')) throw new Error('Target changed.');
        setTarget({ item, language });
        if (loaded.isOffline) { setError(t('speech.connectionNeeded')); return; }
        const caps = await getSpeechCapabilities(language, owner, controller.signal);
        if (current()) setCapabilities(caps);
      } catch { if (current()) setError(t('speech.loadError')); }
      finally { if (current()) setLoading(false); }
    })();
    return () => { cancelled = true; controller.abort(); invalidate(); cancelCapture.current(); };
  }, [owner, itemId, lessonId, revisionId, releaseId, retry, invalidate, t]);

  const start = async () => {
    if (busy.current || recording.current || !recognitionConsent || !target || !capabilities || capabilities.recognition.mode === 'unavailable') return;
    invalidate(); busy.current = true; setPhase('starting'); setError('');
    const version = generation.current;
    abort.current = new AbortController();
    let microphoneRequested = false;
    try {
      // A fresh capability request may refresh expired credentials before audio starts.
      const caps = await getSpeechCapabilities(target.language, owner, abort.current.signal);
      if (generation.current !== version || !mounted.current) return;
      setCapabilities(caps);
      if (caps.recognition.mode === 'unavailable') { invalidate(); return; }
      if (caps.assessment_consent_version !== capabilities.assessment_consent_version) setAssessmentConsent(false);
      if (caps.recognition_consent_version !== capabilities.recognition_consent_version) {
        setRecognitionConsent(false); invalidate(); setError(t('speech.consentChanged')); return;
      }
      context.current = { owner, itemId, revisionId, releaseId, sequence: 0, sessionId: newId(), capabilities: caps };
      recording.current = true;
      microphoneRequested = true;
      await capture.start();
      if (generation.current !== version || !mounted.current) return;
      busy.current = false; setPhase('recording');
    } catch {
      if (generation.current === version && mounted.current) { cancelCapture.current(); invalidate(); setError(t(microphoneRequested ? 'speech.microphoneError' : 'speech.loadError')); }
    }
  };

  const assess = async () => {
    const clip = recorded.current;
    const current = context.current;
    if (busy.current || !clip || !current || !recognition?.is_final || !assessmentConsent || current.capabilities.assessment.mode === 'unavailable') return;
    busy.current = true; setPhase('assessing'); setError('');
    const version = generation.current;
    try {
      const result = await assessRecording(input(current, clip, true, true, abort.current?.signal), clip.pcm);
      if (version !== generation.current || !mounted.current) return;
      checkModel(result, current.capabilities.assessment); setScore(result);
    } catch {
      if (version === generation.current && mounted.current) setError(t('speech.recordAgain'));
    } finally {
      discardClip(clip);
      if (version === generation.current && mounted.current) {
        recorded.current = null; busy.current = false; setHasClip(false); setPhase('finished');
      }
    }
  };

  const disabled = ['starting', 'recognizing', 'assessing'].includes(phase);
  const canRecognize = capabilities && capabilities.recognition.mode !== 'unavailable';
  const canAssess = capabilities && capabilities.assessment.mode !== 'unavailable';
  const qa = capabilities?.recognition.mode === 'internal_qa' || capabilities?.assessment.mode === 'internal_qa';
  const words = recognition?.words ?? (target?.item.term.replace(/’/g, "'").match(/[A-Za-z]+(?:'[A-Za-z]+)?/g) ?? []).map((word, i) => ({ target_index: i, expected_word: word, recognized_word: null, state: 'pending' as const }));
  const goBack = () => {
    invalidate(); capture.cancel();
    if (router.canGoBack?.()) router.back();
    else router.replace('/(app)/lessons');
  };
  return (
    <SafeAreaView style={styles.page}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.content}>
          <Pressable onPress={goBack} accessibilityRole="button" style={styles.back}><AppText style={styles.link}>← {t('common.back')}</AppText></Pressable>
          <AppText accessibilityRole="header" style={styles.heading}>{t('speech.title')}</AppText>
          <AppText style={styles.help}>{t('speech.instructions')}</AppText>
          {loading ? <ActivityIndicator accessibilityLabel={t('common.loading')} style={styles.card} /> : null}
          {qa ? <AppText style={styles.qa}>{t('speech.internalQa')}</AppText> : null}
          {target ? <View style={styles.card}>
            <View style={styles.words}>{words.map(word => <View key={word.target_index} style={[styles.word, word.state === 'match' && styles.match, word.state === 'mismatch' && styles.mismatch]}>
              <AppText accessibilityLabel={`${word.expected_word}, ${t(`speech.${word.state}`)}`} style={styles.wordText}>{word.expected_word}</AppText>
            </View>)}</View>
            <AppText style={styles.help}>{t('speech.wordHint')}</AppText>
            {recognition ? <AppText testID="speech-transcript" accessibilityLiveRegion="polite" style={styles.transcript}>{t('speech.heard', { words: recognition.transcript || t('speech.noWords') })}</AppText> : null}
          </View> : null}
          {!loading && capabilities && !canRecognize ? <AppText style={styles.card}>{t('speech.unavailable')}</AppText> : null}
          {error ? <AppText accessibilityRole="alert" style={styles.error}>{error}</AppText> : null}
          {canRecognize && !capture.isSupported ? <AppText style={styles.card}>{t('speech.audioUnavailable')}</AppText> : null}
          {canRecognize && capture.isSupported ? <View style={styles.card}>
            <Pressable testID="speech-recognition-consent" accessibilityRole="checkbox" accessibilityState={{ checked: recognitionConsent, disabled: disabled || phase === 'recording' }} disabled={disabled || phase === 'recording'}
              onPress={() => setRecognitionConsent(!recognitionConsent)} style={styles.choice}>
              <AppText style={styles.checkbox}>{recognitionConsent ? '☑' : '☐'}</AppText><AppText style={styles.choiceText}>{t('speech.recognitionConsent')}</AppText>
            </Pressable>
            <AppText style={styles.help}>{t('speech.audioPrivacy')}</AppText>
            <Pressable testID="speech-record" accessibilityRole="button" accessibilityState={{ disabled: disabled || !recognitionConsent }} disabled={disabled || !recognitionConsent}
              onPress={phase === 'recording' ? capture.stop : start} style={[styles.button, (disabled || !recognitionConsent) && styles.disabled]}>
              <AppText style={styles.buttonText}>{t(phase === 'recording' ? 'speech.stop' : disabled ? 'speech.working' : 'speech.record')}</AppText>
            </Pressable>
            <AppText accessibilityLiveRegion="polite" style={styles.help}>{phase === 'recording' ? t('speech.recording', { seconds: Math.floor(capture.durationMs / 1000) }) : t('speech.shortRecording')}</AppText>
            {hasClip && canAssess ? <>
              <Pressable testID="speech-assessment-consent" accessibilityRole="checkbox" accessibilityState={{ checked: assessmentConsent, disabled }} disabled={disabled}
                onPress={() => setAssessmentConsent(!assessmentConsent)} style={styles.choice}>
                <AppText style={styles.checkbox}>{assessmentConsent ? '☑' : '☐'}</AppText><AppText style={styles.choiceText}>{t('speech.assessmentConsent')}</AppText>
              </Pressable>
              <Pressable testID="speech-assess" accessibilityRole="button" accessibilityState={{ disabled: disabled || !assessmentConsent }} disabled={disabled || !assessmentConsent}
                onPress={assess} style={[styles.button, (!assessmentConsent || disabled) && styles.disabled]}><AppText style={styles.buttonText}>{t('speech.assess')}</AppText></Pressable>
            </> : null}
            {score ? <View style={styles.result}><AppText>{t('speech.feedback')}</AppText><AppText testID="speech-score" style={styles.score}>{score.overall_score}/100</AppText></View> : null}
          </View> : null}
          {!loading && !canRecognize ? <Pressable accessibilityRole="button" style={styles.back} onPress={() => setRetry(v => v + 1)}><AppText style={styles.link}>{t('common.retry')}</AppText></Pressable> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f8fafc' }, scroll: { flexGrow: 1, padding: 16 },
  content: { width: '100%', maxWidth: 520, alignSelf: 'center', gap: 12 },
  back: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', paddingHorizontal: 8 }, link: { color: '#2563eb', fontWeight: '600' },
  heading: { fontSize: 28, fontWeight: '700', color: '#0f172a' }, help: { fontSize: 14, lineHeight: 22, color: '#475569', flexShrink: 1 },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 16, padding: 16, gap: 12 },
  words: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, word: { padding: 10, borderRadius: 10, backgroundColor: '#e2e8f0', borderWidth: 1, borderColor: '#cbd5e1' },
  match: { backgroundColor: '#dcfce7', borderColor: '#15803d' }, mismatch: { backgroundColor: '#fee2e2', borderColor: '#b91c1c' }, wordText: { fontSize: 21, fontWeight: '600', color: '#0f172a' },
  transcript: { color: '#334155', lineHeight: 24 }, qa: { color: '#854d0e', backgroundColor: '#fef9c3', borderRadius: 12, padding: 12, lineHeight: 22 },
  error: { color: '#991b1b', backgroundColor: '#fee2e2', borderRadius: 12, padding: 12, lineHeight: 24 },
  choice: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10 }, checkbox: { color: '#2563eb', fontSize: 28 }, choiceText: { flex: 1, color: '#0f172a', lineHeight: 24 },
  button: { minHeight: 52, backgroundColor: '#2563eb', borderRadius: 12, padding: 14, alignItems: 'center', justifyContent: 'center' }, disabled: { opacity: 0.45 }, buttonText: { color: '#fff', fontWeight: '700', fontSize: 17, textAlign: 'center' },
  result: { alignItems: 'center', padding: 16, gap: 8 }, score: { fontWeight: '700', fontSize: 36, color: '#0f172a' },
});
