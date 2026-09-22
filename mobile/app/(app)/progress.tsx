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
          {/* Key Metrics Row */}
          <View style={styles.metricsRow}>
            <View style={styles.metricCard}>
              <AppText style={styles.metricNumber} testID="total-reviews-stat">
                {progress.total_reviews}
              </AppText>
              <AppText style={styles.metricLabel}>{t('progress.totalReviews')}</AppText>
            </View>

            <View style={styles.metricCard}>
              <AppText style={styles.metricNumber} testID="unique-words-stat">
                {progress.unique_vocabulary_reviewed}
              </AppText>
              <AppText style={styles.metricLabel}>{t('progress.uniqueWords')}</AppText>
            </View>

            <View style={styles.metricCard}>
              <AppText style={[styles.metricNumber, styles.streakNumber]} testID="streak-days-stat">
                🔥 {progress.streak_days}
              </AppText>
              <AppText style={styles.metricLabel}>{t('progress.streakDays')}</AppText>
            </View>
          </View>

          {/* Performance Breakdown Card */}
          <View style={styles.sectionCard}>
            <AppText style={styles.sectionTitle}>{t('progress.performanceBreakdown')}</AppText>
            <View style={styles.breakdownGrid}>
              <View style={[styles.breakdownBox, styles.againBg]}>
                <AppText style={styles.breakdownValue}>{progress.performance_breakdown.again || 0}</AppText>
                <AppText style={styles.breakdownLabel}>{t('reviews.ratingAgain')}</AppText>
              </View>

              <View style={[styles.breakdownBox, styles.hardBg]}>
                <AppText style={styles.breakdownValue}>{progress.performance_breakdown.hard || 0}</AppText>
                <AppText style={styles.breakdownLabel}>{t('reviews.ratingHard')}</AppText>
              </View>

              <View style={[styles.breakdownBox, styles.goodBg]}>
                <AppText style={styles.breakdownValue}>{progress.performance_breakdown.good || 0}</AppText>
                <AppText style={styles.breakdownLabel}>{t('reviews.ratingGood')}</AppText>
              </View>

              <View style={[styles.breakdownBox, styles.easyBg]}>
                <AppText style={styles.breakdownValue}>{progress.performance_breakdown.easy || 0}</AppText>
                <AppText style={styles.breakdownLabel}>{t('reviews.ratingEasy')}</AppText>
              </View>
            </View>
          </View>

          {/* Recent Activity List */}
          <View style={styles.sectionCard}>
            <AppText style={styles.sectionTitle}>{t('progress.recentActivity')}</AppText>
            {progress.recent_activity.length === 0 ? (
              <AppText style={styles.emptyText} testID="empty-activity-notice">
                {t('progress.noActivity')}
              </AppText>
            ) : (
              <View testID="recent-activity-list">
                {progress.recent_activity.map((item) => (
                  <View key={item.attempt_id} style={styles.activityItem}>
                    <View style={styles.activityMain}>
                      <AppText style={styles.activityTerm}>{item.term}</AppText>
                      <AppText style={styles.activityTime}>
                        {new Date(item.created_at).toLocaleDateString()}
                      </AppText>
                    </View>
                    <View
                      style={[
                        styles.ratingBadge,
                        item.performance_rating === 'easy'
                          ? styles.easyBadge
                          : item.performance_rating === 'good'
                          ? styles.goodBadge
                          : item.performance_rating === 'hard'
                          ? styles.hardBadge
                          : styles.againBadge,
                      ]}
                    >
                      <AppText style={styles.ratingBadgeText}>
                        {item.performance_rating || (item.correct ? 'correct' : 'again')}
                      </AppText>
                    </View>
                  </View>
                ))}
              </View>
            )}
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
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 1,
  },
  metricNumber: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  streakNumber: {
    color: '#ea580c',
  },
  metricLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
    textAlign: 'center',
  },
  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 14,
  },
  breakdownGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  breakdownBox: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  againBg: {
    backgroundColor: '#fef2f2',
  },
  hardBg: {
    backgroundColor: '#fffbeb',
  },
  goodBg: {
    backgroundColor: '#f0fdf4',
  },
  easyBg: {
    backgroundColor: '#eff6ff',
  },
  breakdownValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  breakdownLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 2,
  },
  emptyText: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    paddingVertical: 12,
  },
  activityItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  activityMain: {
    flex: 1,
  },
  activityTerm: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
  },
  activityTime: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  ratingBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  ratingBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  againBadge: {
    backgroundColor: '#fee2e2',
  },
  hardBadge: {
    backgroundColor: '#fef3c7',
  },
  goodBadge: {
    backgroundColor: '#dcfce7',
  },
  easyBadge: {
    backgroundColor: '#dbeafe',
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
