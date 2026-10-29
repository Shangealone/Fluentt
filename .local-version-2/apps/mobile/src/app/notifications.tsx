import { useCallback, useState } from "react";
import { StyleSheet, Text, View, Pressable, ScrollView } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Screen, Button, EmptyState, s } from "../components/ui";
import { AppHeader, LoadState } from "../components/navigation";
import { useSession } from "../session/provider";
import { theme } from "../theme/tokens";
import type { NotificationItem, NotificationPage } from "../services/api/materials";

export default function NotificationsScreen() {
  const { profile, notifications } = useSession();
  const [state, setState] = useState<{
    phase: "loading" | "ready" | "error";
    page: NotificationPage | null;
    error: string | null;
  }>({
    phase: "loading",
    page: null,
    error: null,
  });

  const load = useCallback(() => {
    setState({ phase: "loading", page: null, error: null });
    notifications
      .list(50, 0)
      .then((page) => setState({ phase: "ready", page, error: null }))
      .catch((err) =>
        setState({
          phase: "error",
          page: null,
          error: err instanceof Error ? err.message : "Unable to load notifications.",
        })
      );
  }, [notifications]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      notifications
        .list(50, 0)
        .then((page) => {
          if (active) setState({ phase: "ready", page, error: null });
        })
        .catch((err) => {
          if (active)
            setState({
              phase: "error",
              page: null,
              error: err instanceof Error ? err.message : "Unable to load notifications.",
            });
        });
      return () => {
        active = false;
        setState({ phase: "loading", page: null, error: null });
      };
    }, [notifications])
  );

  const handleRead = async (item: NotificationItem) => {
    if (!item.read_at) {
      await notifications.read(item.id);
      load();
    }
    // Navigate to target if relevant resource is present
    if (item.event_type === "assignment_published") {
      router.push("/published-assignments");
    } else if (item.event_type === "class_announcement") {
      router.push("/communication");
    }
  };

  const handleReadAll = async () => {
    await notifications.readAll();
    load();
  };

  const unreadCount = state.page?.unread_count ?? 0;

  return (
    <Screen>
      <AppHeader
        navigation
        title="Notifications"
        subtitle={unreadCount > 0 ? `${unreadCount} unread update${unreadCount > 1 ? "s" : ""}` : "All caught up"}
      />

      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={s.subheading}>Activity & Updates</Text>
        {unreadCount > 0 && (
          <Button label="Mark all as read" size="sm" variant="ghost" onPress={handleReadAll} />
        )}
      </View>

      <LoadState phase={state.phase} error={state.error} retry={load} />

      {state.phase === "ready" && state.page && (
        <>
          {state.page.items.length === 0 ? (
            <EmptyState
              icon="🔔"
              title="No notifications yet"
              description="You will be notified here when assignments are published or announcements are posted."
            />
          ) : (
            <View style={{ gap: 10 }}>
              {state.page.items.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => handleRead(item)}
                  style={({ pressed }) => [
                    styles.notifCard,
                    item.read_at === null && styles.unreadCard,
                    { opacity: pressed ? 0.8 : 1 },
                  ]}
                >
                  <View style={styles.iconCircle}>
                    <Text style={styles.iconText}>
                      {item.event_type === "assignment_published"
                        ? "📝"
                        : item.event_type === "class_announcement"
                        ? "📢"
                        : item.event_type === "learning_material_available"
                        ? "📚"
                        : "ℹ️"}
                    </Text>
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <Text style={[styles.titleText, item.read_at === null && styles.boldTitle]}>
                        {item.title}
                      </Text>
                      {item.read_at === null && <View style={styles.unreadDot} />}
                    </View>
                    <Text style={styles.messageText}>{item.message}</Text>
                    <Text style={styles.dateText}>{new Date(item.created_at).toLocaleString()}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </>
      )}

      <Button label="Refresh notifications" secondary onPress={load} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  notifCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  unreadCard: {
    backgroundColor: "#FFFFFF",
    borderColor: theme.colors.primary,
    borderLeftWidth: 4,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F4F6FB",
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: {
    fontSize: 16,
  },
  titleText: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.ink,
    flex: 1,
  },
  boldTitle: {
    fontWeight: "800",
    color: theme.colors.primary,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.primary,
    marginTop: 4,
  },
  messageText: {
    fontSize: 13,
    color: theme.colors.ink,
    lineHeight: 18,
  },
  dateText: {
    fontSize: 11,
    color: theme.colors.muted,
    marginTop: 2,
  },
});
