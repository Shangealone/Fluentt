import React, { useCallback } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText } from '../../src/components/AppText';
import { useSyncStatus } from '../../src/offline/useSyncStatus';

export default function SyncStatusScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const {
    pendingCount,
    failedCount,
    authPaused,
    hasVerifiedAccount,
    isSyncing,
    isOnline,
    isServerReachable,
    lastSyncedAt,
    syncError,
    syncNow,
    refreshCount,
    refreshReachability,
  } = useSyncStatus();

  useFocusEffect(
    useCallback(() => {
      refreshCount();
      refreshReachability();
    }, [refreshCount, refreshReachability])
  );

  let connectionBoxStyle = styles.offlineBox;
  let connectionDotStyle = styles.offlineDot;
  let connectionTextStyle = styles.offlineText;
  let connectionLabel = t('sync.networkOffline');

  if (isOnline && isServerReachable) {
    connectionBoxStyle = styles.onlineBox;
    connectionDotStyle = styles.onlineDot;
    connectionTextStyle = styles.onlineText;
    connectionLabel = t('sync.connectedToServer');
  } else if (isOnline && !isServerReachable) {
    connectionBoxStyle = styles.unreachableBox;
    connectionDotStyle = styles.unreachableDot;
    connectionTextStyle = styles.unreachableText;
    connectionLabel = t('sync.serverUnreachable');
  }

  const isSyncDisabled = !hasVerifiedAccount || authPaused || !isOnline || !isServerReachable || isSyncing;

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
        <AppText style={styles.screenTitle}>{t('sync.title')}</AppText>
        <View style={styles.placeholder} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Network Connectivity Badge */}
        <View
          style={[styles.connectionBox, connectionBoxStyle]}
          testID="connection-status-badge"
        >
          <View style={[styles.dot, connectionDotStyle]} />
          <AppText style={[styles.connectionText, connectionTextStyle]}>
            {connectionLabel}
          </AppText>
        </View>

        {/* Sync Summary Card */}
        <View style={styles.card}>
          <AppText style={styles.cardTitle}>{t('sync.status')}</AppText>

          <View style={styles.statRow}>
            <AppText style={styles.statLabel}>{t('sync.pendingEvents', { count: pendingCount })}</AppText>
            <AppText style={styles.statBadge} testID="pending-count-badge">
              {pendingCount}
            </AppText>
          </View>

          <View style={styles.statRow}>
            <AppText style={styles.statLabel}>{t('sync.lastSynced', { time: '' }).trim()}</AppText>
            <AppText style={styles.statValue} testID="last-synced-time">
              {lastSyncedAt ? lastSyncedAt.toLocaleTimeString() : t('sync.never')}
            </AppText>
          </View>

          {hasVerifiedAccount && pendingCount === 0 && !syncError ? (
            <View style={styles.syncedBanner} testID="all-synced-banner">
              <AppText style={styles.syncedBannerText}>
                ✓ {t('sync.allSynced')}
              </AppText>
            </View>
          ) : null}

          {failedCount > 0 ? (
            <AppText testID="rejected-reviews-notice" style={styles.errorBannerText}>
              {t('sync.rejectedEvents', { count: failedCount })}
            </AppText>
          ) : null}
          {authPaused ? (
            <AppText testID="auth-paused-notice" style={styles.errorBannerText}>{t('sync.authErrorNotice')}</AppText>
          ) : null}

          {syncError ? (
            <View style={styles.errorBanner} testID="sync-error-banner">
              <AppText style={styles.errorBannerText}>
                ⚠️ {t('sync.syncFailed', { error: syncError })}
              </AppText>
            </View>
          ) : null}
        </View>

        {/* Action Button */}
        <Pressable
          testID="sync-now-btn"
          style={[styles.syncButton, isSyncDisabled ? styles.disabledButton : null]}
          disabled={isSyncDisabled}
          onPress={syncNow}
        >
          {isSyncing ? (
            <View style={styles.buttonContent}>
              <ActivityIndicator size="small" color="#ffffff" />
              <AppText style={styles.syncButtonText}>{t('sync.syncing')}</AppText>
            </View>
          ) : (
            <AppText style={styles.syncButtonText}>🔄 {t('sync.syncNow')}</AppText>
          )}
        </Pressable>
      </ScrollView>
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
  connectionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
    borderWidth: 1,
  },
  onlineBox: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  offlineBox: {
    backgroundColor: '#fef3c7',
    borderColor: '#fde68a',
  },
  unreachableBox: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  onlineDot: {
    backgroundColor: '#16a34a',
  },
  offlineDot: {
    backgroundColor: '#d97706',
  },
  unreachableDot: {
    backgroundColor: '#d97706',
  },
  connectionText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  onlineText: {
    color: '#166534',
  },
  offlineText: {
    color: '#92400e',
  },
  unreachableText: {
    color: '#b45309',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 14,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  statLabel: {
    fontSize: 14,
    color: '#475569',
  },
  statBadge: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2563eb',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statValue: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  syncedBanner: {
    marginTop: 14,
    backgroundColor: '#f0fdf4',
    padding: 10,
    borderRadius: 8,
  },
  syncedBannerText: {
    fontSize: 13,
    color: '#166534',
    fontWeight: '600',
    textAlign: 'center',
  },
  errorBanner: {
    marginTop: 14,
    backgroundColor: '#fef2f2',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorBannerText: {
    fontSize: 13,
    color: '#dc2626',
    fontWeight: '500',
  },
  syncButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    opacity: 0.6,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  syncButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
