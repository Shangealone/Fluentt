import { useEffect } from "react";
import { Platform, Text, View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SessionProvider, useSession } from "../session/provider";
import { destination, routeAllowed } from "../session/routing";
import { Screen, Loading, ErrorMessage, Button, s } from "../components/ui";
import { DemoNavigator } from "../components/DemoNavigator";
import { PersonalBottomNavigation } from "../components/PersonalBottomNavigation";
import { ClassroomBottomNavigation } from "../components/ClassroomBottomNavigation";
function Navigator() {
  const session = useSession();
  if (session.loading || session.error) return <Screen>
    <Text style={s.brand}>FLUENTT</Text>
    <Text accessibilityRole="header" style={s.heading}>
      {session.recovery === "logout" ? "Signing out safely" : session.recovery === "clear" ? "Clearing an invalid session" : "Restoring your learning space"}
    </Text>
    {session.loading ? <Loading /> : <>
      <ErrorMessage message={session.error!} />
      <Button label={session.recovery === "logout" ? "Retry sign-out" : session.recovery === "clear" ? "Retry secure cleanup" : "Retry session check"} onPress={session.retry} />
      <Button secondary label="⚡ Explore in Demo Mode (Preview All Screens)" onPress={() => session.setDemoMode(true)} />
    </>}
  </Screen>;
  const target = session.profile ? destination(session.profile) : "/";
  const allowed = (route: string) => routeAllowed(session.profile, route, session.pending, session.isDemo);
  return <Stack screenOptions={{ headerShown: false }}>
    <Stack.Protected guard={!session.profile || session.isDemo} redirectTo={target}>
      <Stack.Protected guard={!session.pending || session.isDemo}>
        <Stack.Screen name="index" />
        <Stack.Screen name="school-role" />
      </Stack.Protected>
      <Stack.Screen name="username" options={{ gestureEnabled: !session.pending }} />
      <Stack.Screen name="login" />
    </Stack.Protected>
    <Stack.Protected guard={allowed("instructor")} redirectTo={target}>
      <Stack.Screen name="instructor" />
      <Stack.Screen name="instructor-monitoring" />
      <Stack.Screen name="first-class" options={{ gestureEnabled: false }} />
      <Stack.Screen name="class-details" />
      <Stack.Screen name="class-edit" options={{ gestureEnabled: false }} />
      <Stack.Screen name="assignments" />
      <Stack.Screen name="assignment-builder" />
      <Stack.Screen name="assignment-results" />
    </Stack.Protected>
    {(["grade", "learning-focus", "language", "experience", "student", "my-classes", "question-practice", "personal-stats", "conversation", "pronunciation", "research"] as const).map((name) => <Stack.Protected key={name} guard={allowed(name)} redirectTo={target}>
      <Stack.Screen name={name} />
    </Stack.Protected>)}
    <Stack.Protected guard={allowed("class-code")} redirectTo={target}>
      <Stack.Screen name="class-code" options={{ gestureEnabled: false }} />
    </Stack.Protected>
    <Stack.Protected guard={allowed("published-assignments")} redirectTo={target}>
      <Stack.Screen name="published-assignments" />
      <Stack.Screen name="assignment-attempt" />
      <Stack.Screen name="assessment-results" />
    </Stack.Protected>
    <Stack.Protected guard={allowed("communication")} redirectTo={target}>
      <Stack.Screen name="communication" />
    </Stack.Protected>
    <Stack.Protected guard={allowed("account")} redirectTo={target}>
      <Stack.Screen name="account" />
    </Stack.Protected>
    <Stack.Protected guard={allowed("notifications")} redirectTo={target}>
      <Stack.Screen name="notifications" />
    </Stack.Protected>
    <Stack.Protected guard={allowed("learning-materials")} redirectTo={target}>
      <Stack.Screen name="learning-materials" />
    </Stack.Protected>
    <Stack.Protected guard={allowed("learning-history")} redirectTo={target}>
      <Stack.Screen name="learning-history" />
    </Stack.Protected>
    <Stack.Protected guard={allowed("preferences")} redirectTo={target}>
      <Stack.Screen name="preferences" options={{ gestureEnabled: false }} />
    </Stack.Protected>
  </Stack>;
}

export default function Layout() {
  useEffect(() => {
    if (Platform.OS === "web" && typeof document !== "undefined") {
      const id = "fluentt-global-web-styles";
      if (!document.getElementById(id)) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Space+Grotesk:wght@600;700;800&display=swap";
        document.head.appendChild(link);

        const style = document.createElement("style");
        style.id = id;
        style.textContent = `
          * {
            font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important;
            box-sizing: border-box;
          }
          body {
            background-color: #F4F6FB !important;
            margin: 0;
            padding: 0;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
          }
          :focus-visible {
            outline: 3px solid #3458C8;
            outline-offset: 3px;
          }
          /* Custom modern scrollbars */
          ::-webkit-scrollbar {
            width: 8px;
            height: 8px;
          }
          ::-webkit-scrollbar-track {
            background: #F1F5F9;
          }
          ::-webkit-scrollbar-thumb {
            background: #CBD5E1;
            border-radius: 4px;
          }
          ::-webkit-scrollbar-thumb:hover {
            background: #94A3B8;
          }
        `;
        document.head.appendChild(style);
      }
    }
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <SessionProvider>
        <View style={{ flex: 1 }}>
          <View style={{ flex: 1 }}><Navigator /></View>
          <PersonalBottomNavigation />
          <ClassroomBottomNavigation />
        </View>
        <DemoNavigator />
      </SessionProvider>
    </SafeAreaProvider>
  );
}
