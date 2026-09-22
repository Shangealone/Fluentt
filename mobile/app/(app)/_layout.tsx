import React from 'react';
import { Stack } from 'expo-router';

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="home" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="lessons" />
      <Stack.Screen name="review" />
      <Stack.Screen name="sync-status" />
      <Stack.Screen name="progress" />
    </Stack>
  );
}
