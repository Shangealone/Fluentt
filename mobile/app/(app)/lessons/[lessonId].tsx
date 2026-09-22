import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText } from '../../../src/components/AppText';
import { fetchLessonDetail } from '../../../src/content/api';
import { LessonDetail } from '../../../src/content/types';
import { VocabularyCard } from '../../../src/content/components/VocabularyCard';

export default function LessonDetailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { lessonId } = useLocalSearchParams<{ lessonId: string }>();

  const [lesson, setLesson] = useState<LessonDetail | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isOffline, setIsOffline] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadLessonDetail = useCallback(async () => {
    if (!lessonId) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const result = await fetchLessonDetail(lessonId);
      setLesson(result.lesson);
      setIsOffline(result.isOffline);
    } catch (err: any) {
      setErrorMessage(t('content.error'));
    } finally {
      setIsLoading(false);
    }
  }, [lessonId, t]);

  useEffect(() => {
    loadLessonDetail();
  }, [loadLessonDetail]);

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
        <AppText style={styles.screenTitle} numberOfLines={1}>
          {lesson?.title || t('content.lessonDetail')}
        </AppText>
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
          <AppText style={styles.statusText}>{t('common.loading')}</AppText>
        </View>
      ) : errorMessage ? (
        <View style={styles.centered} testID="error-container">
          <AppText style={styles.errorText}>{errorMessage}</AppText>
          <Pressable
            testID="retry-btn"
            style={styles.retryButton}
            onPress={loadLessonDetail}
          >
            <AppText style={styles.retryButtonText}>{t('common.retry')}</AppText>
          </Pressable>
        </View>
      ) : !lesson || lesson.vocabularyItems.length === 0 ? (
        <View style={styles.centered} testID="empty-container">
          <AppText style={styles.emptyText}>{t('content.emptyDetail')}</AppText>
          <Pressable
            testID="retry-btn"
            style={styles.retryButton}
            onPress={loadLessonDetail}
          >
            <AppText style={styles.retryButtonText}>{t('common.retry')}</AppText>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={lesson.vocabularyItems}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <VocabularyCard item={item} />}
          contentContainerStyle={styles.listContent}
          testID="vocabulary-list"
          ListHeaderComponent={
            <View style={styles.lessonMeta}>
              {lesson.description ? (
                <AppText style={styles.lessonDescription}>
                  {lesson.description}
                </AppText>
              ) : null}
              <View style={styles.metaRow}>
                <AppText style={styles.metaBadge}>
                  {t('content.version')}: {lesson.contentVersion}
                </AppText>
                <AppText style={styles.metaBadge}>
                  {t('content.itemsCount', { count: lesson.vocabularyItems.length })}
                </AppText>
              </View>
            </View>
          }
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
    maxWidth: '60%',
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
  lessonMeta: {
    marginBottom: 12,
    backgroundColor: '#ffffff',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  lessonDescription: {
    fontSize: 15,
    color: '#334155',
    lineHeight: 22,
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaBadge: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
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
