import React from 'react';
import { View, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText } from '../../../src/components/AppText';

export default function ReviewResultScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{
    lessonId?: string;
    totalCount?: string;
    syncedCount?: string;
    queuedCount?: string;
  }>();

  const totalCount = Number(params.totalCount || '0');
  const syncedCount = Number(params.syncedCount || '0');
  const queuedCount = Number(params.queuedCount || '0');

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Success Icon / Card */}
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <AppText style={styles.checkmark}>✓</AppText>
          </View>
          <AppText style={styles.title} testID="result-title">
            {t('reviews.completeTitle')}
          </AppText>
          <AppText style={styles.subtitle}>{t('reviews.completeSubtitle')}</AppText>

          {/* Sync Status Banner */}
          {queuedCount > 0 ? (
            <View style={styles.offlineNoticeBox} testID="sync-pending-notice">
              <AppText style={styles.offlineNoticeTitle}>
                📱 {t('reviews.queuedOffline')}
              </AppText>
              <AppText style={styles.offlineNoticeBody}>
                {t('sync.offlineNotice')}
              </AppText>
            </View>
          ) : (
            <View style={styles.syncedNoticeBox} testID="all-synced-notice">
              <AppText style={styles.syncedNoticeText}>
                ☁️ {t('reviews.syncedOnline')}
              </AppText>
            </View>
          )}

          {/* Stats Breakdown */}
          <View style={styles.statsContainer}>
            <View style={styles.statBox}>
              <AppText style={styles.statNumber} testID="total-reviewed-count">
                {totalCount}
              </AppText>
              <AppText style={styles.statLabel}>{t('reviews.totalReviewed')}</AppText>
            </View>

            <View style={styles.statBox}>
              <AppText style={[styles.statNumber, styles.syncedNumber]} testID="synced-count">
                {syncedCount}
              </AppText>
              <AppText style={styles.statLabel}>{t('reviews.syncedCount')}</AppText>
            </View>

            <View style={styles.statBox}>
              <AppText
                style={[styles.statNumber, queuedCount > 0 ? styles.queuedNumber : null]}
                testID="queued-count"
              >
                {queuedCount}
              </AppText>
              <AppText style={styles.statLabel}>{t('reviews.pendingCount')}</AppText>
            </View>
          </View>
        </View>

        {/* Navigation Action Buttons */}
        <View style={styles.buttonGroup}>
          <Pressable
            testID="back-to-lessons-btn"
            style={styles.primaryButton}
            onPress={() => router.replace('/(app)/lessons' as any)}
          >
            <AppText style={styles.primaryButtonText}>{t('reviews.backToLessons')}</AppText>
          </Pressable>

          <Pressable
            testID="view-sync-status-btn"
            style={styles.secondaryButton}
            onPress={() => router.push('/(app)/sync-status' as any)}
          >
            <AppText style={styles.secondaryButtonText}>{t('reviews.viewSyncStatus')}</AppText>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    padding: 20,
    flexGrow: 1,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  checkmark: {
    fontSize: 36,
    color: '#16a34a',
    fontWeight: '800',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 20,
  },
  offlineNoticeBox: {
    width: '100%',
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#fde68a',
    marginBottom: 20,
  },
  offlineNoticeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#92400e',
    marginBottom: 4,
  },
  offlineNoticeBody: {
    fontSize: 13,
    color: '#b45309',
    lineHeight: 18,
  },
  syncedNoticeBox: {
    width: '100%',
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    marginBottom: 20,
  },
  syncedNoticeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#166534',
    textAlign: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 2,
  },
  syncedNumber: {
    color: '#16a34a',
  },
  queuedNumber: {
    color: '#d97706',
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
    textAlign: 'center',
  },
  buttonGroup: {
    marginTop: 24,
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: '#ffffff',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  secondaryButtonText: {
    color: '#334155',
    fontSize: 15,
    fontWeight: '600',
  },
});
