import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText } from '../../../src/components/AppText';
import { useAuth } from '../../../src/auth/AuthProvider';
import { fetchLessons } from '../../../src/content/api';
import { LessonSummary } from '../../../src/content/types';

export default function LessonsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();

  const targetLanguage = user?.targetLearningLanguage || 'en';

  const [lessons, setLessons] = useState<LessonSummary[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isOffline, setIsOffline] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadLessons = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const result = await fetchLessons(targetLanguage);
      setLessons(result.lessons);
      setIsOffline(result.isOffline);
    } catch {
      setErrorMessage(t('content.error'));
    } finally {
      setIsLoading(false);
    }
  }, [targetLanguage, t]);

  useEffect(() => {
    let isMounted = true;
    fetchLessons(targetLanguage)
      .then((result) => {
        if (isMounted) {
          setLessons(result.lessons);
          setIsOffline(result.isOffline);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setErrorMessage(t('content.error'));
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [targetLanguage, t]);

  const renderLessonItem = ({ item }: { item: LessonSummary }) => (
    <Pressable
      testID={`lesson-card-${item.id}`}
      style={({ pressed }) => [styles.lessonCard, pressed && styles.cardPressed]}
      onPress={() => router.push({ pathname: '/(app)/lessons/[lessonId]' as any, params: {
        lessonId: item.id, ...(item.contentReleaseId ? { contentReleaseId: item.contentReleaseId } : {}),
      } })}
    >
      <View style={styles.cardHeader}>
        <AppText style={styles.lessonTitle}>{item.title}</AppText>
        <AppText style={styles.versionBadge}>{item.contentVersion}</AppText>
      </View>
      {item.description ? (
        <AppText style={styles.lessonDesc}>{item.description}</AppText>
      ) : null}
      <View style={styles.cardFooter}>
        <AppText style={styles.itemCountText}>
          {t('content.itemsCount', { count: item.itemCount })}
        </AppText>
      </View>
    </Pressable>
  );

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
        <AppText style={styles.screenTitle}>{t('content.lessons')}</AppText>
        <View style={styles.placeholder} />
      </View>

      {isOffline ? (
        <View testID="offline-banner" style={styles.offlineBanner}>
          <AppText style={styles.offlineBannerText}>
            ⚡ {t('content.offlineNotice')}
          </AppText>
        </View>
      ) : null}

      {isLoading ? (
        <View style={styles.centered} testID="loading-indicator">
          <ActivityIndicator size="large" color="#2563eb" />
          <AppText style={styles.statusText}>{t('content.loading')}</AppText>
        </View>
      ) : errorMessage ? (
        <View style={styles.centered} testID="error-container">
          <AppText style={styles.errorText}>{errorMessage}</AppText>
          <Pressable
            testID="retry-btn"
            style={styles.retryButton}
            onPress={loadLessons}
          >
            <AppText style={styles.retryButtonText}>{t('common.retry')}</AppText>
          </Pressable>
        </View>
      ) : lessons.length === 0 ? (
        <View style={styles.centered} testID="empty-container">
          <AppText style={styles.emptyText}>{t('content.empty')}</AppText>
          <Pressable
            testID="retry-btn"
            style={styles.retryButton}
            onPress={loadLessons}
          >
            <AppText style={styles.retryButtonText}>{t('common.retry')}</AppText>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={lessons}
          keyExtractor={(item) => item.id}
          renderItem={renderLessonItem}
          contentContainerStyle={styles.listContent}
          testID="lessons-list"
        />
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
  offlineBanner: {
    backgroundColor: '#fef3c7',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#fde68a',
  },
  offlineBannerText: {
    fontSize: 13,
    color: '#92400e',
    fontWeight: '600',
    textAlign: 'center',
  },
  listContent: {
    padding: 16,
  },
  lessonCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardPressed: {
    backgroundColor: '#f1f5f9',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  lessonTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1e293b',
    flex: 1,
    marginRight: 8,
  },
  versionBadge: {
    fontSize: 11,
    color: '#64748b',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  lessonDesc: {
    fontSize: 14,
    color: '#475569',
    marginBottom: 10,
    lineHeight: 20,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: '#f8fafc',
    paddingTop: 8,
  },
  itemCountText: {
    fontSize: 12,
    color: '#2563eb',
    fontWeight: '600',
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
  emptyText: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 16,
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
