import { useEffect, useState } from "react";
import { Text } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Screen, Button, Loading, ErrorMessage, s } from "../components/ui";
import { CodeCard } from "../features/classes/CodeCard";
import { useSession } from "../session/provider";
import type { ClassDetails } from "../services/api/classes";
export default function ClassDetail() {
  const { id, created } = useLocalSearchParams<{
    id?: string;
    created?: string;
  }>();
  const { classes } = useSession();
  const [row, setRow] = useState<ClassDetails | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    if (!id) {
      Promise.resolve().then(() => {
        if (active) {
          setError("Choose a class from My Classes.");
          setLoading(false);
        }
      });
      return () => {
        active = false;
      };
    }
    classes
      .get(id)
      .then((row) => {
        if (active) setRow(row);
      })
      .catch((error) => {
        if (active) setError(error.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [classes, id, revision]);
  return (
    <Screen>
      <Button
        secondary
        label="← My Classes"
        onPress={() => router.replace("/instructor")}
      />
      {loading ? (
        <Loading />
      ) : error ? (
        <>
          <ErrorMessage message={error} />
          <Button
            label="Retry class details"
            onPress={() => {
              setLoading(true);
              setError("");
              setRevision(revision + 1);
            }}
          />
        </>
      ) : row ? (
        <>
          {created === "1" && (
            <Text accessibilityRole="alert" style={s.eyebrow}>
              CLASS SAVED SUCCESSFULLY
            </Text>
          )}
          <Text style={s.title}>{row.class_name}</Text>
          <Text style={s.body}>
            Grade {row.grade_level} ·{" "}
            {row.language === "english" ? "English" : "Tagalog"}
          </Text>
          <Text style={s.body}>
            Status: {row.status} · Created{" "}
            {new Date(row.created_at).toLocaleDateString()}
          </Text>
          {!!row.description && <Text style={s.body}>{row.description}</Text>}
          <CodeCard code={row.join_code} name={row.class_name} />
          <Button
            secondary
            label="Edit Class Details"
            disabled={row.status !== "active"}
            onPress={() =>
              router.push({ pathname: "/class-edit", params: { id: row.id } })
            }
          />
          <Text style={s.body}>
            Student enrollment is not available yet. No roster is shown until
            enrollment is implemented.
          </Text>
        </>
      ) : null}
    </Screen>
  );
}
