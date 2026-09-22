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
import { getApiErrorMessage } from '../../src/api/client';

export default function LoginScreen() {
  const { t } = useTranslation();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setErrorMessage(t('auth.invalidCredentials'));
      return;
    }

    try {
      setLoading(true);
      setErrorMessage(null);
      await login(email.trim(), password);
    } catch (err: any) {
      setErrorMessage(getApiErrorMessage(err, t('auth.invalidCredentials')));
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
          <AppText style={styles.appTitle}>FLUENTT</AppText>
          <AppText style={styles.title} i18nKey="auth.login" />
        </View>

        {errorMessage ? (
          <View style={styles.errorContainer}>
            <AppText style={styles.errorText}>{errorMessage}</AppText>
          </View>
        ) : null}

        <View style={styles.formGroup}>
          <AppText style={styles.label} i18nKey="auth.email" />
          <TextInput
            style={styles.input}
            autoCapitalize="none"
            keyboardType="email-address"
            autoCorrect={false}
            placeholder={t('auth.emailPlaceholder')}
            placeholderTextColor="#64748b"
            value={email}
            onChangeText={setEmail}
            editable={!loading}
          />
        </View>

        <View style={styles.formGroup}>
          <AppText style={styles.label} i18nKey="auth.password" />
          <TextInput
            style={styles.input}
            secureTextEntry
            placeholder={t('auth.passwordPlaceholder')}
            placeholderTextColor="#64748b"
            value={password}
            onChangeText={setPassword}
            editable={!loading}
          />
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <AppText style={styles.buttonText} i18nKey="auth.submitLogin" />
          )}
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
    alignItems: 'center',
    marginBottom: 32,
  },
  appTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#38bdf8',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: '#f8fafc',
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
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#cbd5e1',
    marginBottom: 8,
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
});
