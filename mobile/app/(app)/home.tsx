import React, { useEffect, useState } from 'react';
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
import { useAuth } from '../../src/auth/AuthProvider';
import { fetchLessons } from '../../src/content/api';

export default function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();

  const targetLanguage = user?.targetLearningLanguage || 'en';
  const targetLanguageLabel = t(`languages.${targetLanguage}`);

  const [lessonCount, setLessonCount] = useState<number | null>(null);
  const [isOffline, setIsOffline] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    fetchLessons(targetLanguage)
      .then((result) => {
        if (isMounted) {
          setLessonCount(result.lessons.length);
          setIsOffline(result.isOffline);
        }
      })
      .catch(() => {
        // Keep non-blocking
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [targetLanguage]);

  const greeting = user?.participantCode
    ? `${t('home.greeting')} (${user.participantCode})`
    : t('home.greeting');

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <AppText style={styles.appBadge}>FLUENTT</AppText>
            <AppText style={styles.greeting} testID="home-greeting">
              {greeting}
            </AppText>
          </View>
          <Pressable
            testID="settings-btn"
            style={styles.settingsIconBtn}
            onPress={() => router.push('/(app)/settings' as any)}
          >
            <AppText style={styles.settingsBtnText}>⚙</AppText>
          </Pressable>
        </View>

        {isOffline ? (
          <View testID="home-offline-banner" style={styles.offlineBanner}>
            <AppText style={styles.offlineBannerText}>
              ⚡ {t('content.offlineNotice')}
            </AppText>
          </View>
        ) : null}

        {/* Current Target Language Card */}
        <View style={styles.card}>
          <AppText style={styles.cardSubtitle}>
            {t('home.currentLanguage', { language: targetLanguageLabel })}
          </AppText>
          <View style={styles.targetLangBadge}>
            <AppText style={styles.targetLangBadgeText}>
              {targetLanguageLabel}
            </AppText>
          </View>
        </View>

        {/* Learning Summary Card (honest data only) */}
        <View style={styles.card}>
          <AppText style={styles.cardTitle}>{t('home.summaryTitle')}</AppText>
          {isLoading ? (
            <ActivityIndicator size="small" color="#2563eb" style={{ marginVertical: 8 }} />
          ) : (
            <AppText style={styles.statCount} testID="lesson-count-stat">
              {lessonCount !== null
                ? t('home.activeLessonsCount', { count: lessonCount })
                : t('content.loading')}
            </AppText>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <Pressable
            testID="browse-lessons-btn"
            style={styles.primaryButton}
            onPress={() => router.push('/(app)/lessons' as any)}
          >
            <AppText style={styles.primaryButtonText}>
              {t('home.browseLessons')} →
            </AppText>
          </Pressable>

          <Pressable
            testID="view-progress-btn"
            style={styles.secondaryButton}
            onPress={() => router.push('/(app)/progress' as any)}
          >
            <AppText style={styles.secondaryButtonText}>
              📊 {t('progress.title')}
            </AppText>
          </Pressable>

          <Pressable
            testID="sync-status-btn"
            style={styles.secondaryButton}
            onPress={() => router.push('/(app)/sync-status' as any)}
          >
            <AppText style={styles.secondaryButtonText}>
              🔄 {t('sync.title')}
            </AppText>
          </Pressable>

          <Pressable
            testID="open-settings-btn"
            style={styles.secondaryButton}
            onPress={() => router.push('/(app)/settings' as any)}
          >
            <AppText style={styles.secondaryButtonText}>
              {t('home.settings')}
            </AppText>
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
  scrollContent: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  appBadge: {
    fontSize: 12,
    fontWeight: '800',
    color: '#2563eb',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  greeting: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 4,
  },
  settingsIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsBtnText: {
    fontSize: 20,
    color: '#475569',
  },
  offlineBanner: {
    backgroundColor: '#fef3c7',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  offlineBannerText: {
    fontSize: 13,
    color: '#92400e',
    fontWeight: '600',
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 8,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 10,
  },
  targetLangBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#dbeafe',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  targetLangBadgeText: {
    color: '#1d4ed8',
    fontWeight: '700',
    fontSize: 14,
  },
  statCount: {
    fontSize: 15,
    color: '#334155',
    fontWeight: '600',
  },
  actionsContainer: {
    marginTop: 8,
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  secondaryButtonText: {
    color: '#475569',
    fontSize: 16,
    fontWeight: '600',
  },
});
