import { useEffect, useState } from "react";
import { BackHandler, Text } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Screen, Button, Loading, ErrorMessage, s } from "../components/ui";
import { ClassForm } from "../features/classes/ClassForm";
import { useSession } from "../session/provider";
import type { ClassDetails } from "../services/api/classes";
export default function ClassEdit() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { classes } = useSession();
  const [row, setRow] = useState<ClassDetails | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let active = true;
    const load = id
      ? classes.get(id)
      : Promise.reject(new Error("Choose a class from My Classes."));
    load
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
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => saving,
    );
    return () => subscription.remove();
  }, [saving]);
  return (
    <Screen>
      <Button
        secondary
        label="← My Classes"
        disabled={saving}
        onPress={() => router.replace("/instructor")}
      />
      <Text style={s.title}>Edit your class.</Text>
      <Text style={s.body}>
        Renaming keeps the invitation code. Grade and language can change only
        before a subject, membership or learning activity is attached.
      </Text>
      {loading ? (
        <Loading />
      ) : error ? (
        <>
          <ErrorMessage message={error} />
          <Button
            label="Retry loading class"
            onPress={() => {
              setLoading(true);
              setError("");
              setRevision(revision + 1);
            }}
          />
        </>
      ) : row ? (
        <ClassForm
          initial={row}
          label="Save Changes"
          onSubmit={async (draft) => {
            setSaving(true);
            try {
              await classes.update(row.id, draft);
              router.replace({
                pathname: "/class-details",
                params: { id: row.id },
              });
            } finally {
              setSaving(false);
            }
          }}
        />
      ) : null}
    </Screen>
  );
}
