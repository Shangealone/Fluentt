import { View } from "react-native";
import { InstructorHomeNavigation } from "../features/dashboard/InstructorHome";
import { useCallback, useRef, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { NotificationsView, type NotificationsState } from "../features/notifications/NotificationsView";
import { useSession } from "../session/provider";
import { destination, routeAllowed } from "../session/routing";
import type { NotificationItem } from "../services/api/materials";

const initialState: NotificationsState = { phase: "loading", page: null, error: null };

export default function NotificationsScreen() {
  const { profile, notifications } = useSession();
  const [state, setState] = useState<NotificationsState>(initialState);
  const [operation, setOperation] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const scope = useRef({ active: false, generation: 0, request: 0 });
  const lock = useRef(false);
  const ownerId = profile?.id;

  const load = useCallback(async () => {
    if (!scope.current.active) return;
    const generation = scope.current.generation;
    const request = ++scope.current.request;
    const current = () => scope.current.active && scope.current.generation === generation && scope.current.request === request;
    setState(initialState);
    setActionError("");
    try {
      const page = await notifications.list(50, 0);
      if (current()) setState({ phase: "ready", page, error: null });
    } catch (failure) {
      if (current()) setState({ phase: "error", page: null, error: failure instanceof Error ? failure.message : "Check your connection and try again." });
    }
  }, [notifications]);

  useFocusEffect(useCallback(() => {
    const generation = ++scope.current.generation;
    scope.current.active = !!ownerId;
    void load();
    return () => {
      if (scope.current.generation !== generation) return;
      scope.current.active = false;
      ++scope.current.generation;
      ++scope.current.request;
      lock.current = false;
      setState(initialState); setOperation(null); setActionError("");
    };
  }, [load, ownerId]));

  async function handleRead(item: NotificationItem) {
    if (!scope.current.active || lock.current) return;
    const generation = scope.current.generation;
    const current = () => scope.current.active && scope.current.generation === generation;
    lock.current = true; setOperation(item.id); setActionError("");
    try {
      if (!item.read_at) await notifications.read(item.id);
      if (!current()) return;
      const target = item.event_type === "assignment_published" ? "published-assignments" : item.event_type === "class_announcement" ? "communication" : null;
      if (target && routeAllowed(profile, target)) {
        if (target === "published-assignments") router.push("/published-assignments");
        else router.push("/communication");
      } else if (!item.read_at) await load();
    } catch (failure) {
      if (current()) setActionError(failure instanceof Error ? failure.message : "We couldn’t mark this update as read. Refresh your updates and try again.");
    } finally {
      if (current()) { lock.current = false; setOperation(null); }
    }
  }

  async function handleReadAll() {
    if (!scope.current.active || lock.current) return;
    const generation = scope.current.generation;
    const current = () => scope.current.active && scope.current.generation === generation;
    lock.current = true; setOperation("all"); setActionError("");
    try {
      await notifications.readAll();
      if (current()) await load();
    } catch (failure) {
      if (current()) setActionError(failure instanceof Error ? failure.message : "We couldn’t mark your updates as read. Refresh your updates and try again.");
    } finally {
      if (current()) { lock.current = false; setOperation(null); }
    }
  }

  if (!profile) return null;
  return <View style={{ flex: 1 }}><NotificationsView state={state} operation={operation} actionError={actionError}
    onBack={() => router.replace(destination(profile))} onAccount={() => router.push("/account")}
    onRefresh={() => { if (!lock.current) void load(); }}
    onRead={item => void handleRead(item)} onReadAll={() => void handleReadAll()} />
    {profile.role === "instructor" && <InstructorHomeNavigation activeRoute="/notifications" />}
  </View>;
}
