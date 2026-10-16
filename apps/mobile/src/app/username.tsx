import { useEffect, useRef, useState } from "react";
import { BackHandler, Text, Platform } from "react-native";
import { router, useLocalSearchParams, Redirect } from "expo-router";
import {
  Screen,
  Button,
  Input,
  Loading,
  ErrorMessage,
  s,
} from "../components/ui";
import { identity, type Role } from "../services/api/identity";
import { usernameError } from "../session/routing";
import { useSession } from "../session/provider";
export default function Username() {
  const { role } = useLocalSearchParams<{ role?: string }>();
  const session = useSession();
  const [name, setName] = useState("");
  const [checked, setChecked] = useState("");
  const [available, setAvailable] = useState(false);
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [attempt, setAttempt] = useState(0);
  const lock = useRef(false);
  const invalid = usernameError(name);
  useEffect(() => {
    let active = true;
    if (invalid) return;
    const timer = setTimeout(() => {
      setChecking(true);
      identity
        .check(name)
        .then((result) => {
          if (active) {
            setChecked(name);
            setAvailable(result.available);
            setFeedback(result.message);
          }
        })
        .catch((error) => {
          if (active) setError(error.message);
        })
        .finally(() => {
          if (active) setChecking(false);
        });
    }, 500);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [name, invalid, attempt]);
  useEffect(() => {
    const sub = BackHandler.addEventListener(
      "hardwareBackPress",
      () => busy || session.pending,
    );
    return () => sub.remove();
  }, [busy, session.pending]);
  if (
    !["personal_student", "school_student", "instructor"].includes(role ?? "")
  )
    return <Redirect href="/" />;
  async function submit() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await session.create(name, role as Role);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Please try again.");
      if ((error as { status?: number }).status === 409) {
        setAvailable(false);
        setFeedback("This username is already taken.");
      }
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <Screen>
      {!session.pending && (
        <Button
          secondary
          label="← Back"
          disabled={busy}
          onPress={() =>
            router.replace(role === "personal_student" ? "/" : "/school-role")
          }
        />
      )}
      <Text style={s.eyebrow}>
        {role === "instructor"
          ? "INSTRUCTOR"
          : role === "school_student"
            ? "SCHOOL STUDENT"
            : "PERSONAL LEARNING"}
      </Text>
      <Text style={s.title}>Make this space yours.</Text>
      <Text style={s.body}>
        Choose a unique username. It identifies your profile; your device
        securely keeps your session.
      </Text>
      <Text style={s.heading}>Your username</Text>
      <Input
        accessibilityLabel="Username"
        value={name}
        editable={!busy && !session.pending}
        onChangeText={(value) => {
          setName(value);
          setChecked("");
          setAvailable(false);
          setFeedback("");
          setChecking(false);
          setError("");
        }}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={24}
        placeholder="e.g. bright_learner"
        returnKeyType="done"
      />
      {name && invalid ? <ErrorMessage message={invalid} /> : null}
      {checking && <Loading />}
      {checked === name && feedback ? (
        <Text accessibilityLiveRegion="polite" style={s.body}>
          {feedback}
        </Text>
      ) : null}
      {error ? (
        <>
          <ErrorMessage message={error} />
          {!session.pending && (
            <Button
              label="Retry availability check"
              disabled={busy || !!invalid}
              onPress={() => {
                setError("");
                setAttempt(attempt + 1);
              }}
            />
          )}
        </>
      ) : null}
      {session.pending && (
        <Text style={s.body}>
          Your profile was created, but secure storage failed. Retry saving here
          before leaving this screen.
        </Text>
      )}
      {Platform.OS === "web" && (
        <Text style={s.body}>
          Web preview: profile creation requires Android or iOS secure storage.
        </Text>
      )}
      <Button
        label={
          busy
            ? "Please wait…"
            : session.pending
              ? "Retry secure save"
              : "Create my profile"
        }
        disabled={
          busy ||
          (!session.pending &&
            (!!invalid || !available || checked !== name || checking))
        }
        onPress={() => void submit()}
      />
    </Screen>
  );
}
