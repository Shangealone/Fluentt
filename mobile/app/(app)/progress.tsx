import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText } from '../../src/components/AppText';
import { fetchLearnerProgress } from '../../src/progress/api';
import { LearnerProgressResponse } from '../../src/progress/types';

export default function ProgressScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const [progress, setProgress] = useState<LearnerProgressResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadProgress = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await fetchLearnerProgress();
      setProgress(data);
    } catch {
      setErrorMessage(t('common.error'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    let isMounted = true;
    fetchLearnerProgress()
      .then((data) => {
        if (isMounted) {
          setProgress(data);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setErrorMessage(t('common.error'));
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [t]);

  const accuracyPercent = progress
    ? `${(progress.accuracy_rate * 100).toFixed(1)}%`
    : '0.0%';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable
          testID="back-btn"
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <AppText style={styles.backButtonText}>← {t('common.back')}</AppText>
        </Pressable>
        <AppText style={styles.screenTitle}>{t('progress.title')}</AppText>
        <View style={styles.placeholder} />
      </View>

      {isLoading ? (
        <View style={styles.centered} testID="loading-indicator">
          <ActivityIndicator size="large" color="#2563eb" />
          <AppText style={styles.statusText}>{t('common.loading')}</AppText>
        </View>
      ) : errorMessage ? (
        <View style={styles.centered} testID="error-container">
          <AppText style={styles.errorText}>{errorMessage}</AppText>
          <Pressable testID="retry-btn" style={styles.retryButton} onPress={loadProgress}>
            <AppText style={styles.retryButtonText}>{t('common.retry')}</AppText>
          </Pressable>
        </View>
      ) : !progress ? null : (
        <ScrollView contentContainerStyle={styles.content}>
          {/* Factual Server-Accepted Aggregate Cards */}
          <View style={styles.grid}>
            <View style={styles.metricCard}>
              <AppText style={styles.metricNumber} testID="vocab-studied-stat">
                {progress.vocabulary_items_studied}
              </AppText>
              <AppText style={styles.metricLabel}>{t('progress.vocabularyItemsStudied')}</AppText>
            </View>

            <View style={styles.metricCard}>
              <AppText style={styles.metricNumber} testID="total-reviews-stat">
                {progress.review_attempts_completed}
              </AppText>
              <AppText style={styles.metricLabel}>{t('progress.reviewAttemptsCompleted')}</AppText>
            </View>

            <View style={styles.metricCard}>
              <AppText style={[styles.metricNumber, styles.correctNumber]} testID="correct-attempts-stat">
                {progress.correct_attempts}
              </AppText>
              <AppText style={styles.metricLabel}>{t('progress.correctAttempts')}</AppText>
            </View>

            <View style={styles.metricCard}>
              <AppText style={[styles.metricNumber, styles.accuracyNumber]} testID="accuracy-rate-stat">
                {accuracyPercent}
              </AppText>
              <AppText style={styles.metricLabel}>{t('progress.accuracyRate')}</AppText>
            </View>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
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
    color: '#2563eb',
    fontWeight: '600',
  },
  screenTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  placeholder: {
    width: 60,
  },
  content: {
    padding: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metricCard: {
    width: '48%',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  metricNumber: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 6,
  },
  correctNumber: {
    color: '#16a34a',
  },
  accuracyNumber: {
    color: '#2563eb',
  },
  metricLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 16,
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
  retryButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
});
