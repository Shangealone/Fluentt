import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Text } from "react-native";
import { SessionProvider, useSession } from "../session/provider";
import { destination } from "../session/routing";
import { Screen, Loading, ErrorMessage, Button, s } from "../components/ui";
function Navigator() {
  const session = useSession();
  if (session.loading || session.error)
    return (
      <Screen>
        <Text style={s.brand}>FLUENTT</Text>
        <Text style={s.heading}>Restoring your learning space</Text>
        {session.loading ? (
          <Loading />
        ) : (
          <>
            <ErrorMessage message={session.error!} />
            <Button label="Retry session check" onPress={session.retry} />
          </>
        )}
      </Screen>
    );
  const target = session.profile ? destination(session.profile) : null;
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!session.profile}>
        <Stack.Protected guard={!session.pending}>
          <Stack.Screen name="index" />
          <Stack.Screen name="school-role" />
        </Stack.Protected>
        <Stack.Screen
          name="username"
          options={{ gestureEnabled: !session.pending }}
        />
      </Stack.Protected>
      <Stack.Protected guard={target === "/instructor"}>
        <Stack.Screen name="instructor" />
      </Stack.Protected>
      <Stack.Protected guard={session.profile?.role === "instructor"}>
        <Stack.Screen name="first-class" options={{ gestureEnabled: false }} />
        <Stack.Screen name="class-details" />
        <Stack.Screen name="class-edit" options={{ gestureEnabled: false }} />
      </Stack.Protected>
      {(["grade", "language", "class-code", "student"] as const).map((name) => (
        <Stack.Protected key={name} guard={target === `/${name}`}>
          <Stack.Screen name={name} />
        </Stack.Protected>
      ))}
    </Stack>
  );
}
export default function Layout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <SessionProvider>
        <Navigator />
      </SessionProvider>
    </SafeAreaProvider>
  );
}
