import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { AuthProvider, useAuth } from '../src/auth/AuthProvider';
import '../src/i18n';

function NavigationGuard({ children }: { children: React.ReactNode }) {
  const { status, user } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') {
      return;
    }

    const segs = segments as string[];
    const firstSegment = segs[0];
    const secondSegment = segs[1];
    const inAuthGroup = firstSegment === '(auth)';
    const isRootIndex = segs.length === 0 || firstSegment === 'index';

    if (status === 'signedOut') {
      if (!inAuthGroup || secondSegment !== 'login') {
        router.replace('/(auth)/login' as any);
      }
    } else if (status === 'mustChangePassword') {
      if (!inAuthGroup || secondSegment !== 'change-password') {
        router.replace('/(auth)/change-password' as any);
      }
    } else if (status === 'signedIn') {
      if (inAuthGroup || isRootIndex) {
        if (!user?.interfaceLanguage || !user?.targetLearningLanguage) {
          router.replace('/(app)/onboarding' as any);
        } else {
          router.replace('/(app)/home' as any);
        }
      }
    }
  }, [status, segments, user]);

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <NavigationGuard>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(app)" />
        </Stack>
      </NavigationGuard>
    </AuthProvider>
  );
}
