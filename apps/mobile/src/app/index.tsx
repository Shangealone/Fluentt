import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Screen, Button, Badge, s } from "../components/ui";
import { LearningBanner } from "../components/LearningBanner";
import { theme } from "../theme/tokens";
import { useSession, type DemoRole } from "../session/provider";

export default function Welcome() {
  const session = useSession();
  const preview = (role: DemoRole) => {
    session.switchDemoRole(role);
    router.push(role === "instructor" ? "/instructor" : "/student");
  };
  return <Screen>
    <View style={styles.brand}><Text style={s.brand}>FLUENTT</Text><Text style={s.body}>English & Tagalog</Text></View>
    <LearningBanner title="A clearer path to learning." description="One place for your classes, assignments, and conversations. Start by choosing how you’ll use Fluentt." />
    <View style={styles.section}>
      <Text accessibilityRole="header" style={s.heading}>How would you like to get started?</Text>
      <Text style={s.body}>Choose the space that fits you.</Text>
    </View>
    <View style={styles.paths}>
      <View style={[s.card, styles.path]}>
        <View style={styles.step}><Text style={styles.stepText}>01</Text></View>
        <Text accessibilityRole="header" style={s.heading}>Learn with your class</Text>
        <Text style={s.body}>For students joining a class and instructors managing their classrooms.</Text>
        <Button label="Continue with school" onPress={() => router.push("/school-role")} />
      </View>
      <View style={[s.card, styles.path]}>
        <View style={[styles.step, { backgroundColor: "#FFF2DC" }]}><Text style={[styles.stepText, { color: "#80581F" }]}>02</Text></View>
        <Text accessibilityRole="header" style={s.heading}>Set up personal learning</Text>
        <Text style={s.body}>Practise conversations, learn pronunciation, and explore lessons and topics by difficulty.</Text>
        <Button label="Create a personal profile" secondary onPress={() => router.push({ pathname: "/username", params: { role: "personal_student" } })} />
      </View>
    </View>
    <View style={[s.card, styles.loginCard]}>
      <View style={styles.loginCardLeft}>
        <Text accessibilityRole="header" style={s.subheading}>Already have an account?</Text>
        <Text style={s.body}>Sign in with your username and password to access your classes and history.</Text>
      </View>
      <Button label="Sign In with Password →" secondary onPress={() => router.push("/login")} />
    </View>
    <View style={[s.card, styles.preview]}>
      <Badge label="Sample data only" variant="neutral" />
      <Text accessibilityRole="header" style={s.subheading}>Take a look around first</Text>
      <Text style={s.body}>Explore a sample account without setting up a profile. Demo activity does not represent real learner results.</Text>
      <View style={styles.demoActions}>
        <Button label="Preview as student" secondary onPress={() => preview("student")} />
        <Button label="Preview as instructor" secondary onPress={() => preview("instructor")} />
        <Button label="Preview personal space" variant="ghost" onPress={() => preview("personal")} />
      </View>
    </View>
    <Text style={styles.footer}>A space to learn. A simpler way to teach.</Text>
  </Screen>;
}
const styles = StyleSheet.create({
  brand: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 12, paddingVertical: 8 },
  section: { gap: 4, paddingTop: 8 },
  paths: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  path: { flex: 1, flexBasis: 280, gap: 16 },
  step: { height: 44, width: 44, borderRadius: 12, backgroundColor: theme.colors.primaryLight, justifyContent: "center", alignItems: "center" },
  stepText: { color: theme.colors.primary, fontSize: 16, fontWeight: "800" },
  preview: { backgroundColor: "#EEF1F8", gap: 12 },
  loginCard: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 12, backgroundColor: "#F0F4FF", borderColor: "#D0DBF5" },
  loginCardLeft: { flex: 1, minWidth: 200, gap: 4 },
  demoActions: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  footer: { color: theme.colors.muted, textAlign: "center", fontSize: 13, paddingVertical: 16 },
});
