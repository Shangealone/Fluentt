import { useCallback, useState, useRef } from "react";
import { Text, View } from "react-native";
import { useFocusEffect, router } from "expo-router";
import {
  Screen,
  Button,
  Loading,
  ErrorMessage,
  EmptyState,
  s,
} from "../components/ui";
import { useSession } from "../session/provider";
import type { ClassDetails } from "../services/api/classes";
export default function Instructor() {
  const { profile, classes } = useSession();
  const [rows, setRows] = useState<ClassDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const generation = useRef(0);
  const [hasMore, setHasMore] = useState(false);
  const [moreBusy, setMoreBusy] = useState(false);
  const loadClasses = useCallback(async () => {
    const current = ++generation.current;
    setLoading(true);
    setError("");
    try {
      const result = await classes.mine();
      if (current === generation.current) {
        setRows(result);
        setHasMore(result.length === 50);
      }
    } catch (error) {
      if (current === generation.current)
        setError(
          error instanceof Error
            ? error.message
            : "Please retry loading classes.",
        );
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }, [classes]);
  useFocusEffect(
    useCallback(() => {
      void loadClasses();
      return () => {
        generation.current += 1;
      };
    }, [loadClasses]),
  );
  return (
    <Screen>
      <Text style={s.brand}>FLUENTT</Text>
      <Text style={s.eyebrow}>INSTRUCTOR SPACE</Text>
      <Text style={s.title}>Hello, {profile?.username}.</Text>
      <Text style={s.heading}>My Classes</Text>
      <Button
        label="Create Another Class"
        onPress={() => router.push("/first-class")}
      />
      {loading && <Loading />}
      {!!error && <ErrorMessage message={error} />}
      <Button
        secondary
        label="Refresh My Classes"
        disabled={loading || moreBusy}
        onPress={() => void loadClasses()}
      />
      {!loading && !error && rows.length === 0 && (
        <EmptyState
          title="Your first class starts here"
          description="Create a class to get its invitation code. No classes are saved yet."
        />
      )}
      {rows.map((row) => (
        <View key={row.id} style={s.card}>
          <Text style={s.heading}>{row.class_name}</Text>
          <Text style={s.body}>
            Grade {row.grade_level} ·{" "}
            {row.language === "english" ? "English" : "Tagalog"} · {row.status}
          </Text>
          <Text selectable style={s.heading}>
            {row.join_code ?? "No active code"}
          </Text>
          <Button
            secondary
            label={`View ${row.class_name}`}
            onPress={() =>
              router.push({
                pathname: "/class-details",
                params: { id: row.id },
              })
            }
          />
        </View>
      ))}
      {hasMore && (
        <Button
          secondary
          label={moreBusy ? "Loading classes…" : "Load more classes"}
          disabled={moreBusy || loading}
          onPress={async () => {
            setMoreBusy(true);
            setError("");
            try {
              const next = await classes.mine(rows.length);
              setRows((previous) => [
                ...previous,
                ...next.filter(
                  (row) => !previous.some((item) => item.id === row.id),
                ),
              ]);
              setHasMore(next.length === 50);
            } catch (error) {
              setError(
                error instanceof Error ? error.message : "Please retry.",
              );
            } finally {
              setMoreBusy(false);
            }
          }}
        />
      )}
      <Text style={s.body}>
        Student enrollment is coming in Section 06. Assignments and analytics
        will arrive later.
      </Text>
    </Screen>
  );
}
