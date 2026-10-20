import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Button, ErrorMessage, Loading, s } from "./ui";
import { useSession } from "../session/provider";
import { destination } from "../session/routing";
import { theme } from "../theme/tokens";

export function AppHeader({
  title,
  account = true,
  disabled = false,
  subtitle,
  navigation = false,
}: {
  title: string;
  back?: boolean;
  account?: boolean;
  disabled?: boolean;
  subtitle?: string;
  navigation?: boolean;
}) {
  const { profile } = useSession();

  const roleLabel =
    profile?.role === "instructor"
      ? "Instructor"
      : profile?.role === "school_student"
      ? "Student"
      : "Personal learner";

  return (
    <View style={navStyles.container}>
      {/* Top Navbar Row */}
      <View style={navStyles.topBar}>
          <View style={navStyles.brandRow}>
            <View style={navStyles.brandLogo}>
              <Text style={navStyles.brandIcon}>f.</Text>
            </View>
            <View>
              <Text style={s.brand}>FLUENTT</Text>
              <Text style={navStyles.brandSub}>Your learning space</Text>
            </View>
          </View>

        {account && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`My account · ${roleLabel}`}
            disabled={disabled}
            onPress={() => router.push("/account")}
            style={({ pressed }) => [
              navStyles.accountPill,
              { opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
            ]}
          >
            <View style={navStyles.avatarCircle}>
              <Text style={navStyles.avatarText}>
                {profile?.username ? profile.username.charAt(0).toUpperCase() : "U"}
              </Text>
            </View>
            <Text style={navStyles.accountName} numberOfLines={1}>
              My account
            </Text>
          </Pressable>
        )}
      </View>

      {navigation && profile && profile.role !== "personal_student" && <View style={navStyles.quickNav}>
        <Button label="Home" icon="⌂" size="sm" variant="outline" disabled={disabled} onPress={() => router.push(profile.role === "instructor" ? "/instructor" : destination(profile))} />
        <Button label="Messages" icon="✉" size="sm" variant="ghost" disabled={disabled} onPress={() => router.push("/communication")} />
        <Button label="Notifications" icon="🔔" size="sm" variant="ghost" disabled={disabled} onPress={() => router.push("/notifications")} />
        {profile.role !== "instructor" && (
          <Button
            label="Pronunciation"
            icon="🎙"
            size="sm"
            variant="ghost"
            disabled={disabled}
            onPress={() => router.push("/pronunciation")}
          />
        )}
        {profile.role !== "instructor" && (
          <Button
            label="Conversation"
            icon="💬"
            size="sm"
            variant="ghost"
            disabled={disabled}
            onPress={() => router.push("/conversation")}
          />
        )}
        {profile.role === "school_student" && (
          <Button
            label="Research"
            icon="🔬"
            size="sm"
            variant="ghost"
            disabled={disabled}
            onPress={() => router.push("/research")}
          />
        )}
        <Button icon={profile.role === "instructor" ? "▥" : "◷"} label={profile.role === "instructor" ? "Class monitoring" : "Learning history"} size="sm" variant="ghost" disabled={disabled} onPress={() => router.push(profile.role === "instructor" ? "/instructor-monitoring" : "/learning-history")} />
      </View>}

      {/* Main Title Section */}
      <View style={navStyles.titleSection}>
        {subtitle && <Text style={s.eyebrow}>{subtitle}</Text>}
        <Text accessibilityRole="header" style={s.title}>
          {title}
        </Text>
      </View>
    </View>
  );
}

export function LoadState({
  phase,
  error,
  retry,
}: {
  phase: "loading" | "ready" | "error";
  error: string | null;
  retry: () => void;
}) {
  if (phase === "loading") {
    return (
      <View style={navStyles.loadBox}>
        <Loading />
        <Text style={s.body}>Checking your latest account data</Text>
      </View>
    );
  }
  if (phase === "error") {
    return (
      <View style={{ gap: 14 }}>
        <ErrorMessage message={error ?? "Unable to load data. Please retry."} />
        <Button label="Retry loading" variant="secondary" onPress={retry} />
      </View>
    );
  }
  return null;
}

export function UpcomingLearning({ school = false }: { school?: boolean }) {
  return (
    <View style={[s.card, navStyles.upcomingCard]}>
      <Text style={s.subheading}>More ways to learn</Text>
      <Text style={s.body}>
        {school
          ? "Classroom assignments, released objective results, and spoken pronunciation practice are active."
          : "Personal learning pathway, learning materials, and spoken pronunciation practice are active."}
      </Text>
    </View>
  );
}

const navStyles = StyleSheet.create({
  container: {
    gap: 16,
    paddingBottom: 4,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  brandLogo: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  brandIcon: {
    fontSize: 26,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  brandSub: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
    color: theme.colors.subtle,
  },
  accountPill: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 9999,
  },
  avatarCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: theme.colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 12,
    fontWeight: "800",
    color: theme.colors.primary,
  },
  accountName: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.colors.ink,
    maxWidth: 120,
  },
  accountRole: {
    fontSize: 11,
    color: theme.colors.muted,
  },
  titleSection: {
    gap: 6,
    paddingTop: 12,
  },
  quickNav: { flexDirection: "row", flexWrap: "wrap", gap: 4, borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: 12 },
  loadBox: {
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12,
  },
  upcomingCard: {
    backgroundColor: theme.colors.surfaceSubtle,
    borderColor: theme.colors.border,
  },
  upcomingHeader: {
    gap: 8,
  },
});
