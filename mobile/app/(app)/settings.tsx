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

export default function SettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, refreshProfile, logout } = useAuth();

  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleUpdateInterfaceLanguage = async (code: LanguageCode) => {
    try {
      setSaving(true);
      setErrorMessage(null);
      setSuccessMessage(null);
      await setInterfaceLanguage(code);
      await updateLearnerPreferences({ interfaceLanguage: code });
      await refreshProfile();
      setSuccessMessage(t('settings.savedSuccess'));
    } catch (err: any) {
      setErrorMessage(err.data?.detail?.[0]?.msg || t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateTargetLanguage = async (code: LanguageCode) => {
    try {
      setSaving(true);
      setErrorMessage(null);
      setSuccessMessage(null);
      await updateLearnerPreferences({ targetLearningLanguage: code });
      await refreshProfile();
      setSuccessMessage(t('settings.savedSuccess'));
    } catch (err: any) {
      setErrorMessage(err.data?.detail?.[0]?.msg || t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.navBar}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <AppText style={styles.backButtonText} i18nKey="common.back" />
        </TouchableOpacity>
        <AppText style={styles.headerTitle} i18nKey="settings.title" />
        <View style={{ width: 40 }} />
      </View>

      {successMessage ? (
        <View style={styles.successContainer}>
          <AppText style={styles.successText}>{successMessage}</AppText>
        </View>
      ) : null}

      {errorMessage ? (
        <View style={styles.errorContainer}>
          <AppText style={styles.errorText}>{errorMessage}</AppText>
        </View>
      ) : null}

      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <AppText style={styles.infoLabel} i18nKey="settings.participantCode" />
          <AppText style={styles.infoValue}>{user?.participantCode || '—'}</AppText>
        </View>
        <View style={styles.divider} />
        <View style={styles.infoRow}>
          <AppText style={styles.infoLabel} i18nKey="settings.email" />
          <AppText style={styles.infoValue}>{user?.email || '—'}</AppText>
        </View>
      </View>

      <View style={styles.section}>
        <AppText style={styles.sectionTitle} i18nKey="settings.interfaceLanguage" />
        <View style={styles.optionsRow}>
          <TouchableOpacity
            style={[
              styles.optionCard,
              user?.interfaceLanguage === 'en' && styles.optionCardSelected,
            ]}
            onPress={() => handleUpdateInterfaceLanguage('en')}
            disabled={saving}
          >
            <AppText
              style={[
                styles.optionText,
                user?.interfaceLanguage === 'en' && styles.optionTextSelected,
              ]}
              i18nKey="languages.en"
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.optionCard,
              user?.interfaceLanguage === 'fil' && styles.optionCardSelected,
            ]}
            onPress={() => handleUpdateInterfaceLanguage('fil')}
            disabled={saving}
          >
            <AppText
              style={[
                styles.optionText,
                user?.interfaceLanguage === 'fil' && styles.optionTextSelected,
              ]}
              i18nKey="languages.fil"
            />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <AppText style={styles.sectionTitle} i18nKey="settings.targetLanguage" />
        <View style={styles.optionsRow}>
          <TouchableOpacity
            style={[
              styles.optionCard,
              user?.targetLearningLanguage === 'en' && styles.optionCardSelected,
            ]}
            onPress={() => handleUpdateTargetLanguage('en')}
            disabled={saving}
          >
            <AppText
              style={[
                styles.optionText,
                user?.targetLearningLanguage === 'en' && styles.optionTextSelected,
              ]}
              i18nKey="languages.en"
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.optionCard,
              user?.targetLearningLanguage === 'fil' && styles.optionCardSelected,
            ]}
            onPress={() => handleUpdateTargetLanguage('fil')}
            disabled={saving}
          >
            <AppText
              style={[
                styles.optionText,
                user?.targetLearningLanguage === 'fil' && styles.optionTextSelected,
              ]}
              i18nKey="languages.fil"
            />
          </TouchableOpacity>
        </View>
      </View>

      {saving ? (
        <ActivityIndicator color="#38bdf8" style={styles.savingIndicator} />
      ) : null}

      <TouchableOpacity
        style={styles.logoutButton}
        onPress={() => logout()}
        activeOpacity={0.8}
      >
        <AppText style={styles.logoutText} i18nKey="settings.logout" />
      </TouchableOpacity>

      <View style={styles.footer}>
        <AppText style={styles.footerText} i18nKey="settings.version" />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#0f172a',
    padding: 24,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 24,
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  backButtonText: {
    color: '#38bdf8',
    fontSize: 15,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f8fafc',
  },
  successContainer: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderWidth: 1,
    borderColor: '#22c55e',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  successText: {
    color: '#86efac',
    fontSize: 14,
    textAlign: 'center',
  },
  errorContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#ef4444',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 14,
    textAlign: 'center',
  },
  infoCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  infoLabel: {
    color: '#94a3b8',
    fontSize: 14,
  },
  infoValue: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 8,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 15,
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
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionCardSelected: {
    borderColor: '#38bdf8',
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
  },
  optionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#94a3b8',
    textAlign: 'center',
  },
  optionTextSelected: {
    color: '#38bdf8',
    fontWeight: '700',
  },
  savingIndicator: {
    marginVertical: 12,
  },
  logoutButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: '#ef4444',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  logoutText: {
    color: '#f87171',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    paddingBottom: 20,
  },
  footerText: {
    color: '#64748b',
    fontSize: 12,
  },
});
