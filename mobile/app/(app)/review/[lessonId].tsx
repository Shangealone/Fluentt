import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText } from '../../../src/components/AppText';
import { fetchLessonDetail } from '../../../src/content/api';
import { VocabularyItem } from '../../../src/content/types';
import { createMonotonicClock, MonotonicClock } from '../../../src/reviews/clock';
import { createReviewSession, submitReviewAttempt } from '../../../src/reviews/api';
import { enqueuePendingReview } from '../../../src/offline/reviewQueue';
import { generateUUID } from '../../../src/utils/uuid';
import { ReviewAttemptCreate } from '../../../src/reviews/types';
import { useAuth } from '../../../src/auth/AuthProvider';
import { isAccountCurrent, loadAuthenticatedAccount } from '../../../src/auth/tokenStore';

interface ReviewScreenProps {
  customClock?: MonotonicClock;
}

export default function ReviewScreen({ customClock }: ReviewScreenProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const ownerUserId = user?.id;
  const router = useRouter();
  const { lessonId } = useLocalSearchParams<{ lessonId: string }>();

  const clock = useMemo(() => customClock ?? createMonotonicClock(), [customClock]);
  const [items, setItems] = useState<VocabularyItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isRevealed, setIsRevealed] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const sessionIdRef = useRef<string>('');
  const clientSessionIdRef = useRef<string>('');
  const startTickRef = useRef<number>(clock.now());
  const statsRef = useRef<{ synced: number; queued: number }>({ synced: 0, queued: 0 });

  // Initialize session & load vocabulary
  const initializeReview = useCallback(async () => {
    if (!lessonId || !ownerUserId) return;
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const clientSessionId = generateUUID();
      clientSessionIdRef.current = clientSessionId;
      sessionIdRef.current = clientSessionId;

      // Try creating backend session online
      try {
        const session = await createReviewSession(clientSessionId, lessonId, ownerUserId);
        sessionIdRef.current = session.id;
      } catch {
        // Fallback to clientSessionId if offline
        sessionIdRef.current = clientSessionId;
      }

      const result = await fetchLessonDetail(lessonId);
      const activeItems = (result.lesson?.vocabularyItems || []).filter((item) => item.isActive !== false);

      setItems(activeItems);
      setCurrentIndex(0);
      setIsRevealed(false);
      startTickRef.current = clock.now();
    } catch {
      setErrorMessage(t('content.error'));
    } finally {
      setIsLoading(false);
    }
  }, [lessonId, clock, t, ownerUserId]);

  useEffect(() => {
    if (!lessonId || !ownerUserId) return;
    let isMounted = true;

    async function loadData() {
      try {
        const clientSessionId = generateUUID();
        clientSessionIdRef.current = clientSessionId;
        sessionIdRef.current = clientSessionId;

        try {
          const session = await createReviewSession(clientSessionId, lessonId, ownerUserId);
          if (isMounted) {
            sessionIdRef.current = session.id;
          }
        } catch {
          if (isMounted) {
            sessionIdRef.current = clientSessionId;
          }
        }

        const result = await fetchLessonDetail(lessonId);
        const activeItems = (result.lesson?.vocabularyItems || []).filter((item) => item.isActive !== false);

        if (isMounted) {
          setItems(activeItems);
          setCurrentIndex(0);
          setIsRevealed(false);
          startTickRef.current = clock.now();
          setIsLoading(false);
        }
      } catch {
        if (isMounted) {
          setErrorMessage(t('content.error'));
          setIsLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [lessonId, clock, t, ownerUserId]);

  const handleReveal = () => {
    setIsRevealed(true);
  };

  const handleResponse = async (isCorrect: boolean) => {
    if (!ownerUserId || isSubmitting || currentIndex >= items.length) return;
    setIsSubmitting(true);

    const finishTick = clock.now();
    const account = await loadAuthenticatedAccount().catch(() => null);
    if (!account || account.userId !== ownerUserId || !isAccountCurrent(account)) {
      setIsSubmitting(false);
      setErrorMessage(t('content.error'));
      return;
    }
    // Capture before any submission await. Logout/login must never relabel an
    // already-created event when its network request falls back to the queue.
    const capturedOwner = account.userId;
    const durationMs = clock.elapsedMs(startTickRef.current, finishTick);
    const currentItem = items[currentIndex];
    const clientEventId = generateUUID();

    const attemptPayload: ReviewAttemptCreate = {
      client_event_id: clientEventId,
      session_id: sessionIdRef.current,
      client_session_id: sessionIdRef.current,
      vocabulary_item_id: currentItem.id,
      response_time_ms: durationMs,
      correct: isCorrect,
      submitted_answer: isCorrect ? 'correct' : 'incorrect',
      client_interaction_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      device_platform: 'android',
      application_version: 'v0.1',
    };

    try {
      await submitReviewAttempt(attemptPayload, capturedOwner);
      statsRef.current.synced += 1;
    } catch {
      // Offline fallback: enqueue to SQLite queue
      await enqueuePendingReview(attemptPayload, capturedOwner);
      statsRef.current.queued += 1;
    }

    const nextIndex = currentIndex + 1;
    if (nextIndex < items.length) {
      setCurrentIndex(nextIndex);
      setIsRevealed(false);
      setIsSubmitting(false);
      startTickRef.current = clock.now();
    } else {
      // Completed review
      setIsSubmitting(false);
      router.replace({
        pathname: '/(app)/review/result' as any,
        params: {
          lessonId: lessonId || '',
          totalCount: String(items.length),
          syncedCount: String(statsRef.current.synced),
          queuedCount: String(statsRef.current.queued),
        },
      });
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered} testID="loading-indicator">
          <ActivityIndicator size="large" color="#2563eb" />
          <AppText style={styles.statusText}>{t('common.loading')}</AppText>
        </View>
      </SafeAreaView>
    );
  }

  if (errorMessage || items.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable testID="back-btn" style={styles.backButton} onPress={() => router.back()}>
            <AppText style={styles.backButtonText}>← {t('common.back')}</AppText>
          </Pressable>
          <AppText style={styles.screenTitle}>{t('reviews.title')}</AppText>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.centered} testID="error-container">
          <AppText style={styles.errorText}>
            {errorMessage || t('reviews.noItems')}
          </AppText>
          <Pressable testID="retry-btn" style={styles.actionButton} onPress={initializeReview}>
            <AppText style={styles.actionButtonText}>{t('common.retry')}</AppText>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const currentItem = items[currentIndex];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable testID="exit-btn" style={styles.backButton} onPress={() => router.back()}>
          <AppText style={styles.backButtonText}>✕ {t('common.cancel')}</AppText>
        </Pressable>
        <AppText style={styles.counterText} testID="review-progress">
          {t('reviews.cardProgress', { current: currentIndex + 1, total: items.length })}
        </AppText>
        <View style={styles.placeholder} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Flashcard */}
        <View style={styles.card} testID="review-card">
          <View style={styles.badgeRow}>
            {currentItem.category ? (
              <View style={styles.badge}>
                <AppText style={styles.badgeText}>{currentItem.category}</AppText>
              </View>
            ) : null}
            {currentItem.difficulty ? (
              <View style={[styles.badge, styles.difficultyBadge]}>
                <AppText style={styles.badgeText}>{currentItem.difficulty}</AppText>
              </View>
            ) : null}
          </View>

          <AppText style={styles.termText} testID="card-term">
            {currentItem.term}
          </AppText>

          {currentItem.exampleSentence ? (
            <View style={styles.exampleContainer}>
              <AppText style={styles.exampleLabel}>{t('content.example')}:</AppText>
              <AppText style={styles.exampleText}>{`"${currentItem.exampleSentence}"`}</AppText>
            </View>
          ) : null}

          {/* Revealed Content */}
          {isRevealed ? (
            <View style={styles.revealedSection} testID="revealed-section">
              <View style={styles.divider} />
              <AppText style={styles.definitionLabel}>{t('content.definition')}:</AppText>
              <AppText style={styles.definitionText} testID="card-definition">
                {currentItem.definition}
              </AppText>

              {currentItem.translation ? (
                <View style={styles.translationContainer}>
                  <AppText style={styles.translationLabel}>{t('content.translation')}:</AppText>
                  <AppText style={styles.translationText}>{currentItem.translation}</AppText>
                </View>
              ) : null}
            </View>
          ) : (
            <Pressable
              testID="reveal-answer-btn"
              style={styles.revealButton}
              onPress={handleReveal}
            >
              <AppText style={styles.revealButtonText}>👀 {t('reviews.showAnswer')}</AppText>
            </Pressable>
          )}
        </View>

        {/* Binary Recall Evaluation (Development deterministic workflow) */}
        {isRevealed ? (
          <View style={styles.ratingSection} testID="rating-section">
            <AppText style={styles.ratingPrompt}>
              {t('reviews.didYouKnow')}
            </AppText>
            <View style={styles.buttonGrid}>
              <Pressable
                testID="rating-again-btn"
                style={[styles.ratingBtn, styles.againBtn]}
                disabled={isSubmitting}
                onPress={() => handleResponse(false)}
              >
                <AppText style={styles.ratingBtnText}>{t('reviews.incorrect')}</AppText>
              </Pressable>

              <Pressable
                testID="rating-good-btn"
                style={[styles.ratingBtn, styles.goodBtn]}
                disabled={isSubmitting}
                onPress={() => handleResponse(true)}
              >
                <AppText style={styles.ratingBtnText}>{t('reviews.correct')}</AppText>
              </Pressable>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  backButtonText: {
    fontSize: 15,
    color: '#64748b',
    fontWeight: '600',
  },
  screenTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  counterText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2563eb',
  },
  placeholder: {
    width: 60,
  },
  content: {
    padding: 16,
    flexGrow: 1,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    minHeight: 280,
    justifyContent: 'space-between',
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  badge: {
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  difficultyBadge: {
    backgroundColor: '#fef3c7',
  },
  badgeText: {
    fontSize: 12,
    color: '#0369a1',
    fontWeight: '600',
  },
  termText: {
    fontSize: 32,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
    marginVertical: 16,
  },
  exampleContainer: {
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#3b82f6',
    marginVertical: 8,
  },
  exampleLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
    marginBottom: 4,
  },
  exampleText: {
    fontSize: 14,
    color: '#334155',
    fontStyle: 'italic',
  },
  divider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 16,
  },
  revealedSection: {
    marginTop: 8,
  },
  definitionLabel: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
    marginBottom: 4,
  },
  definitionText: {
    fontSize: 18,
    color: '#1e293b',
    lineHeight: 26,
    fontWeight: '500',
  },
  translationContainer: {
    marginTop: 12,
  },
  translationLabel: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
    marginBottom: 2,
  },
  translationText: {
    fontSize: 16,
    color: '#2563eb',
    fontWeight: '600',
  },
  revealButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  revealButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  ratingSection: {
    marginTop: 20,
  },
  ratingPrompt: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    textAlign: 'center',
    marginBottom: 12,
  },
  buttonGrid: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  ratingBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  againBtn: {
    backgroundColor: '#ef4444',
  },
  hardBtn: {
    backgroundColor: '#f59e0b',
  },
  goodBtn: {
    backgroundColor: '#10b981',
  },
  easyBtn: {
    backgroundColor: '#3b82f6',
  },
  ratingBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  statusText: {
    marginTop: 12,
    fontSize: 15,
    color: '#64748b',
  },
  errorText: {
    fontSize: 16,
    color: '#dc2626',
    textAlign: 'center',
    marginBottom: 16,
  },
  actionButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
});
