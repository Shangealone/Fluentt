import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../src/auth/AuthProvider';
import { AppText } from '../../src/components/AppText';

export default function ChangePasswordScreen() {
  const { t } = useTranslation();
  const { changePassword, logout } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setErrorMessage(t('common.error'));
      return;
    }

    if (newPassword.length < 8) {
      setErrorMessage(t('auth.passwordTooShort'));
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage(t('auth.passwordMismatch'));
      return;
    }

    try {
      setLoading(true);
      setErrorMessage(null);
      await changePassword(currentPassword, newPassword);
    } catch (err: any) {
      setErrorMessage(err.data?.detail || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <AppText style={styles.title} i18nKey="auth.changePassword" />
          <View style={styles.noticeBox}>
            <AppText style={styles.noticeText} i18nKey="auth.mustChangePasswordNotice" />
          </View>
        </View>

        {errorMessage ? (
          <View style={styles.errorContainer}>
            <AppText style={styles.errorText}>{errorMessage}</AppText>
          </View>
        ) : null}

        <View style={styles.formGroup}>
          <AppText style={styles.label} i18nKey="auth.currentPassword" />
          <TextInput
            style={styles.input}
            secureTextEntry
            placeholder={t('auth.currentPassword')}
            placeholderTextColor="#64748b"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            editable={!loading}
          />
        </View>

        <View style={styles.formGroup}>
          <AppText style={styles.label} i18nKey="auth.newPassword" />
          <TextInput
            style={styles.input}
            secureTextEntry
            placeholder={t('auth.newPassword')}
            placeholderTextColor="#64748b"
            value={newPassword}
            onChangeText={setNewPassword}
            editable={!loading}
          />
        </View>

        <View style={styles.formGroup}>
          <AppText style={styles.label} i18nKey="auth.confirmNewPassword" />
          <TextInput
            style={styles.input}
            secureTextEntry
            placeholder={t('auth.confirmNewPassword')}
            placeholderTextColor="#64748b"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            editable={!loading}
          />
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleChangePassword}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <AppText style={styles.buttonText} i18nKey="auth.submitChangePassword" />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={() => logout()}
          disabled={loading}
          activeOpacity={0.7}
        >
          <AppText style={styles.logoutButtonText} i18nKey="common.logout" />
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    marginBottom: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 16,
    textAlign: 'center',
  },
  noticeBox: {
    backgroundColor: 'rgba(234, 179, 8, 0.15)',
    borderWidth: 1,
    borderColor: '#eab308',
    borderRadius: 8,
    padding: 12,
    width: '100%',
  },
  noticeText: {
    color: '#fde047',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
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
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#cbd5e1',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#f8fafc',
  },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  logoutButton: {
    marginTop: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: '#94a3b8',
    fontSize: 14,
  },
});
