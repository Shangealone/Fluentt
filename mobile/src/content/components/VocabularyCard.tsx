import React from 'react';
import { View, StyleSheet } from 'react-native';
import { VocabularyItem } from '../types';
import { AppText } from '../../components/AppText';
import { useTranslation } from 'react-i18next';

interface VocabularyCardProps {
  item: VocabularyItem;
}

export function VocabularyCard({ item }: VocabularyCardProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.card} testID={`vocab-card-${item.id}`}>
      <View style={styles.headerRow}>
        <AppText style={styles.term}>{item.term}</AppText>
        {item.difficulty ? (
          <View style={styles.badge}>
            <AppText style={styles.badgeText}>{item.difficulty}</AppText>
          </View>
        ) : null}
      </View>

      {item.translation ? (
        <View style={styles.section}>
          <AppText style={styles.metaLabel}>{t('content.translation')}:</AppText>
          <AppText style={styles.translationText}>{item.translation}</AppText>
        </View>
      ) : null}

      <View style={styles.section}>
        <AppText style={styles.metaLabel}>{t('content.definition')}:</AppText>
        <AppText style={styles.definitionText}>{item.definition}</AppText>
      </View>

      {item.exampleSentence ? (
        <View style={styles.exampleContainer}>
          <AppText style={styles.metaLabel}>{t('content.example')}:</AppText>
          <AppText style={styles.exampleText}>&ldquo;{item.exampleSentence}&rdquo;</AppText>
        </View>
      ) : null}

      <View style={styles.footer}>
        <AppText style={styles.versionText}>
          {t('content.version')}: {item.contentVersion}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  term: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  badge: {
    backgroundColor: '#e0e7ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3730a3',
    textTransform: 'capitalize',
  },
  section: {
    marginBottom: 8,
  },
  metaLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  translationText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2563eb',
  },
  definitionText: {
    fontSize: 15,
    color: '#334155',
    lineHeight: 21,
  },
  exampleContainer: {
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#3b82f6',
    marginTop: 4,
    marginBottom: 8,
  },
  exampleText: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#475569',
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 8,
    marginTop: 4,
  },
  versionText: {
    fontSize: 11,
    color: '#94a3b8',
  },
});
