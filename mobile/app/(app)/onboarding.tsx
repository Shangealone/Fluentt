import React, { useState } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../src/auth/AuthProvider';
import { AppText } from '../../src/components/AppText';
import { setInterfaceLanguage } from '../../src/i18n';
import { updateLearnerPreferences } from '../../src/profile/api';
import { LanguageCode } from '../../src/profile/types';

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, refreshProfile } = useAuth();

  const [selectedUiLang, setSelectedUiLang] = useState<LanguageCode>(
    user?.interfaceLanguage || 'en'
  );
  const [selectedTargetLang, setSelectedTargetLang] = useState<LanguageCode | null>(
    user?.targetLearningLanguage || null
  );
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSelectUiLang = async (lang: LanguageCode) => {
    setSelectedUiLang(lang);
    await setInterfaceLanguage(lang);
  };

  const handleSelectTargetLang = (lang: LanguageCode) => {
    setSelectedTargetLang(lang);
  };

  const handleSave = async () => {
    if (!selectedUiLang || !selectedTargetLang) {
      setErrorMessage(t('onboarding.validationError'));
      return;
    }

    try {
      setLoading(true);
      setErrorMessage(null);
      await updateLearnerPreferences({
        interfaceLanguage: selectedUiLang,
        targetLearningLanguage: selectedTargetLang,
      });
      await refreshProfile();
      router.replace('/(app)/home' as any);
    } catch (err: any) {
      setErrorMessage(err.data?.detail?.[0]?.msg || t('onboarding.validationError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <AppText style={styles.title} i18nKey="onboarding.title" />
        <AppText style={styles.subtitle} i18nKey="onboarding.subtitle" />
      </View>

      {errorMessage ? (
        <View style={styles.errorContainer} testID="preference-error">
          <AppText style={styles.errorText}>{errorMessage}</AppText>
        </View>
      ) : null}

      <View style={styles.section}>
        <AppText style={styles.sectionTitle} i18nKey="onboarding.interfaceLanguage" />
        <View style={styles.optionsRow}>
          <TouchableOpacity
            testID="ui-lang-en"
            style={[styles.optionCard, selectedUiLang === 'en' && styles.optionCardSelected]}
            onPress={() => handleSelectUiLang('en')}
            disabled={loading}
          >
            <AppText
              style={[styles.optionText, selectedUiLang === 'en' && styles.optionTextSelected]}
              i18nKey="languages.en"
            />
          </TouchableOpacity>
          <TouchableOpacity
            testID="ui-lang-fil"
            style={[styles.optionCard, selectedUiLang === 'fil' && styles.optionCardSelected]}
            onPress={() => handleSelectUiLang('fil')}
            disabled={loading}
          >
            <AppText
              style={[styles.optionText, selectedUiLang === 'fil' && styles.optionTextSelected]}
              i18nKey="languages.fil"
            />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <AppText style={styles.sectionTitle} i18nKey="onboarding.targetLanguage" />
        <View style={styles.optionsRow}>
          <TouchableOpacity
            testID="target-lang-en"
            style={[styles.optionCard, selectedTargetLang === 'en' && styles.optionCardSelected]}
            onPress={() => handleSelectTargetLang('en')}
            disabled={loading}
          >
            <AppText
              style={[styles.optionText, selectedTargetLang === 'en' && styles.optionTextSelected]}
              i18nKey="languages.en"
            />
          </TouchableOpacity>
          <TouchableOpacity
            testID="target-lang-fil"
            style={[styles.optionCard, selectedTargetLang === 'fil' && styles.optionCardSelected]}
            onPress={() => handleSelectTargetLang('fil')}
            disabled={loading}
          >
            <AppText
              style={[styles.optionText, selectedTargetLang === 'fil' && styles.optionTextSelected]}
              i18nKey="languages.fil"
            />
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity
        testID="save-preferences-btn"
        style={[styles.saveButton, (!selectedTargetLang || loading) && styles.buttonDisabled]}
        onPress={handleSave}
        disabled={!selectedTargetLang || loading}
        activeOpacity={0.8}
      >
        {loading ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <AppText style={styles.saveButtonText} i18nKey="onboarding.savePreferences" />
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#0f172a',
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    marginBottom: 32,
    alignItems: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#f8fafc',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 22,
  },
  errorContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#ef4444',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 14,
    textAlign: 'center',
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#cbd5e1',
    marginBottom: 12,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  optionCard: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderWidth: 1.5,
    borderColor: '#334155',
    borderRadius: 12,
    paddingVertical: 18,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionCardSelected: {
    borderColor: '#38bdf8',
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
  },
  optionText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#94a3b8',
    textAlign: 'center',
  },
  optionTextSelected: {
    color: '#38bdf8',
    fontWeight: '700',
  },
  saveButton: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
