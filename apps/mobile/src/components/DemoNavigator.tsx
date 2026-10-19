import { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { useSession, type DemoRole } from "../session/provider";
import { theme } from "../theme/tokens";

type RouteItem = {
  title: string;
  desc: string;
  route: string;
  params?: Record<string, string>;
  role?: DemoRole;
};

const INSTRUCTOR_ROUTES: RouteItem[] = [
  {
    title: "Instructor Dashboard",
    desc: "Classes overview, invitations, and quick actions",
    route: "/instructor",
    role: "instructor",
  },
  {
    title: "Class Details & Roster",
    desc: "Grade 7 Mabini details, join code, and student list",
    route: "/class-details",
    params: { id: "demo-class-1" },
    role: "instructor",
  },
  {
    title: "Edit Class Details",
    desc: "Update class name, grade, language, or description",
    route: "/class-edit",
    params: { id: "demo-class-1" },
    role: "instructor",
  },
  {
    title: "Create First Class",
    desc: "Form to register a new class and generate a join code",
    route: "/first-class",
    role: "instructor",
  },
  {
    title: "Class Assignments",
    desc: "Manage drafts, published items, and revision states",
    route: "/assignments",
    params: { classId: "demo-class-1" },
    role: "instructor",
  },
  {
    title: "Assignment Builder",
    desc: "Author and preview all 10 question methods",
    route: "/assignment-builder",
    params: { classId: "demo-class-1", id: "demo-draft-1" },
    role: "instructor",
  },
  {
    title: "Submissions & Result Release",
    desc: "Inspect learner attempts and release objective scores",
    route: "/assignment-results",
    params: { id: "demo-pub-1", attemptId: "demo-attempt-1" },
    role: "instructor",
  },
  {
    title: "Class Progress Monitoring",
    desc: "Real-time participation rates, averages, and question analytics",
    route: "/instructor-monitoring",
    params: { classId: "demo-class-1" },
    role: "instructor",
  },
  {
    title: "Class Communication",
    desc: "Post announcements and answer learner direct messages",
    route: "/communication",
    params: { classId: "demo-class-1" },
    role: "instructor",
  },
];

const STUDENT_ROUTES: RouteItem[] = [
  {
    title: "Student Dashboard",
    desc: "Classrooms, enrolled progress, and active tasks",
    route: "/student",
    role: "student",
  },
  {
    title: "Published Assignments",
    desc: "View class assessments available to take or review",
    route: "/published-assignments",
    params: { classId: "demo-class-1" },
    role: "student",
  },
  {
    title: "Assignment Player (10 Methods)",
    desc: "Interactive attempt player for all 10 question formats",
    route: "/assignment-attempt",
    params: { id: "demo-pub-1" },
    role: "student",
  },
  {
    title: "Assessment Results",
    desc: "View released score (8/9), item breakdown, and feedback",
    route: "/assessment-results",
    params: { id: "demo-pub-1" },
    role: "student",
  },
  {
    title: "Learning History",
    desc: "Student completed submissions record and timestamps",
    route: "/learning-history",
    params: { classId: "demo-class-1" },
    role: "student",
  },
  {
    title: "Class Q&A & Announcements",
    desc: "Read instructor updates and send direct questions",
    route: "/communication",
    params: { classId: "demo-class-1" },
    role: "student",
  },
  {
    title: "Join with Class Code",
    desc: "Input 6-digit code to preview and confirm enrollment",
    route: "/class-code",
    role: "student",
  },
  {
    title: "Learning Preferences",
    desc: "Choose the topics, lessons, and language you need",
    route: "/preferences",
    role: "personal",
  },
];

const ONBOARDING_ROUTES: RouteItem[] = [
  {
    title: "Welcome Landing",
    desc: "Initial application welcome screen",
    route: "/",
  },
  {
    title: "School Role Selection",
    desc: "Choose between Student and Instructor paths",
    route: "/school-role",
  },
  {
    title: "Username Registration",
    desc: "Unique handle setup with live validation",
    route: "/username",
    params: { role: "school_student" },
  },
  {
    title: "Topics & Lessons",
    desc: "Tell us what you want to work on",
    route: "/learning-focus",
    role: "personal",
  },
  {
    title: "Learning Language",
    desc: "Select English or Tagalog track",
    route: "/language",
  },
  {
    title: "My Account Profile",
    desc: "Profile status, device session, and sign-out controls",
    route: "/account",
  },
];

export function DemoNavigator() {
  const [open, setOpen] = useState(false);
  const session = useSession();

  const handleNavigate = (item: RouteItem) => {
    if (item.role && item.role !== session.demoRole) {
      session.switchDemoRole(item.role);
    } else if (!session.isDemo) {
      session.setDemoMode(true);
    }

    setOpen(false);

    // Short timeout to allow state transition before navigation
    setTimeout(() => {
      if (item.params) {
        router.push({ pathname: item.route as never, params: item.params });
      } else {
        router.push(item.route as never);
      }
    }, 50);
  };

  const handleRoleSelect = (role: DemoRole) => {
    session.switchDemoRole(role);
    if (role === "instructor") router.replace("/instructor");
    else if (role === "student") router.replace("/student");
    else router.replace("/preferences");
  };

  return (
    <>
      {/* Floating Demo Hub Button */}
      <Pressable
        style={({ pressed }) => [
          styles.floatingTrigger,
          pressed && { opacity: 0.85, transform: [{ scale: 0.96 }] },
        ]}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Open Demo Navigation Hub"
      >
        <View style={styles.floatingIndicator} />
        <Text style={styles.floatingText}>⚡ Demo Hub</Text>
      </Pressable>

      {/* Demo Modal Drawer */}
      <Modal
        visible={open}
        animationType="slide"
        transparent
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <View style={styles.brandBadgeRow}>
                  <Text style={styles.brandTitle}>FLUENTT</Text>
                  <View style={styles.activePill}>
                    <Text style={styles.activePillText}>DEMO MODE ACTIVE</Text>
                  </View>
                </View>
                <Text style={styles.modalSubtitle}>
                  One-tap access to every page, persona, and question method
                </Text>
              </View>
              <Pressable
                onPress={() => setOpen(false)}
                style={styles.closeButton}
                accessibilityRole="button"
                accessibilityLabel="Close Demo Hub"
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
              {/* Persona Switcher Section */}
              <Text style={styles.sectionHeading}>ACTIVE PERSONA</Text>
              <View style={styles.personaRow}>
                <Pressable
                  style={[
                    styles.personaCard,
                    session.demoRole === "instructor" && styles.personaCardActive,
                  ]}
                  onPress={() => handleRoleSelect("instructor")}
                >
                  <Text style={styles.personaIcon}>👨‍🏫</Text>
                  <Text style={styles.personaTitle}>Instructor</Text>
                  <Text style={styles.personaSub}>@guro_santos</Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.personaCard,
                    session.demoRole === "student" && styles.personaCardActive,
                  ]}
                  onPress={() => handleRoleSelect("student")}
                >
                  <Text style={styles.personaIcon}>🧑‍🎓</Text>
                  <Text style={styles.personaTitle}>Student</Text>
                  <Text style={styles.personaSub}>@juan_delacruz</Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.personaCard,
                    session.demoRole === "personal" && styles.personaCardActive,
                  ]}
                  onPress={() => handleRoleSelect("personal")}
                >
                  <Text style={styles.personaIcon}>🌟</Text>
                  <Text style={styles.personaTitle}>Personal</Text>
                  <Text style={styles.personaSub}>@maria_clara</Text>
                </Pressable>
              </View>

              {/* Reset / Live toggle controls */}
              <View style={styles.controlsRow}>
                <Pressable
                  style={styles.actionPill}
                  onPress={() => {
                    session.resetDemoData();
                  }}
                >
                  <Text style={styles.actionPillText}>🔄 Reset Demo Data</Text>
                </Pressable>
                <Pressable
                  style={styles.actionPill}
                  onPress={() => {
                    session.setDemoMode(!session.isDemo);
                  }}
                >
                  <Text style={styles.actionPillText}>
                    {session.isDemo ? "🟢 Offline Demo" : "⚪ Live Server"}
                  </Text>
                </Pressable>
              </View>

              {/* Instructor Screens Directory */}
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionHeading}>INSTRUCTOR SCREENS</Text>
                <Text style={styles.badgeCount}>{INSTRUCTOR_ROUTES.length} PAGES</Text>
              </View>
              {INSTRUCTOR_ROUTES.map((item) => (
                <Pressable
                  key={item.title}
                  style={({ pressed }) => [
                    styles.routeCard,
                    pressed && styles.routeCardPressed,
                  ]}
                  onPress={() => handleNavigate(item)}
                >
                  <View style={styles.routeHeader}>
                    <Text style={styles.routeTitle}>{item.title}</Text>
                    <Text style={styles.routeArrow}>→</Text>
                  </View>
                  <Text style={styles.routeDesc}>{item.desc}</Text>
                </Pressable>
              ))}

              {/* Student Screens Directory */}
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionHeading}>STUDENT SCREENS</Text>
                <Text style={styles.badgeCount}>{STUDENT_ROUTES.length} PAGES</Text>
              </View>
              {STUDENT_ROUTES.map((item) => (
                <Pressable
                  key={item.title}
                  style={({ pressed }) => [
                    styles.routeCard,
                    pressed && styles.routeCardPressed,
                  ]}
                  onPress={() => handleNavigate(item)}
                >
                  <View style={styles.routeHeader}>
                    <Text style={styles.routeTitle}>{item.title}</Text>
                    <Text style={styles.routeArrow}>→</Text>
                  </View>
                  <Text style={styles.routeDesc}>{item.desc}</Text>
                </Pressable>
              ))}

              {/* Onboarding & Setup Screens */}
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionHeading}>ONBOARDING & ACCOUNT</Text>
                <Text style={styles.badgeCount}>{ONBOARDING_ROUTES.length} PAGES</Text>
              </View>
              {ONBOARDING_ROUTES.map((item) => (
                <Pressable
                  key={item.title}
                  style={({ pressed }) => [
                    styles.routeCard,
                    pressed && styles.routeCardPressed,
                  ]}
                  onPress={() => handleNavigate(item)}
                >
                  <View style={styles.routeHeader}>
                    <Text style={styles.routeTitle}>{item.title}</Text>
                    <Text style={styles.routeArrow}>→</Text>
                  </View>
                  <Text style={styles.routeDesc}>{item.desc}</Text>
                </Pressable>
              ))}

              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  floatingTrigger: {
    position: "absolute",
    bottom: 28,
    right: 20,
    zIndex: 9999,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#0F172A",
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: "#334155",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: "0 8px 24px rgba(15, 23, 42, 0.25)",
        cursor: "pointer",
        transition: "all 0.15s ease",
      },
    }),
  },
  floatingIndicator: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#10B981",
  },
  floatingText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#F8FAFC",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "88%",
    width: "100%",
    maxWidth: 700,
    alignSelf: "center",
    overflow: "hidden",
    borderTopWidth: 1,
    borderColor: "#E2E8F0",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
  },
  brandBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 2,
    color: "#0F172A",
  },
  activePill: {
    backgroundColor: "#ECFDF5",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  activePillText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#065F46",
    letterSpacing: 1,
  },
  modalSubtitle: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 4,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
  },
  scrollContent: {
    padding: 20,
    gap: 12,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
    marginBottom: 4,
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.5,
    color: "#0D9488",
  },
  badgeCount: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748B",
  },
  personaRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
  },
  personaCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    alignItems: "center",
    gap: 4,
  },
  personaCardActive: {
    borderColor: "#0D9488",
    backgroundColor: "#F0FDFA",
  },
  personaIcon: {
    fontSize: 24,
  },
  personaTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
  },
  personaSub: {
    fontSize: 11,
    color: "#64748B",
    textAlign: "center",
  },
  controlsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
    marginBottom: 8,
  },
  actionPill: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
  },
  actionPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0F172A",
  },
  routeCard: {
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 4,
  },
  routeCardPressed: {
    backgroundColor: "#F0FDFA",
    borderColor: "#0D9488",
  },
  routeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  routeTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
  },
  routeArrow: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0D9488",
  },
  routeDesc: {
    fontSize: 13,
    color: "#64748B",
    lineHeight: 18,
  },
});
