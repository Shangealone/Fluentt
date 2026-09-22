import React from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { AppText } from '../src/components/AppText';

export default function IndexScreen() {
  return (
    <View style={styles.container}>
      <AppText style={styles.title} i18nKey="onboarding.title">
        FLUENTT
      </AppText>
      <ActivityIndicator size="large" color="#2563eb" style={styles.spinner} />
      <AppText style={styles.subtitle} i18nKey="common.loading">
        Loading...
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginBottom: 16,
    textAlign: 'center',
  },
  spinner: {
    marginVertical: 16,
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
  },
});
