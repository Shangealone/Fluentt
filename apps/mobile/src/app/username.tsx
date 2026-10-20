import { useEffect, useRef, useState } from "react";
import { BackHandler, Text, Platform, View, Pressable, StyleSheet } from "react-native";
import { router, useLocalSearchParams, Redirect } from "expo-router";
import {
  Screen,
  Button,
  Input,
  Loading,
  ErrorMessage,
  Badge,
  s,
} from "../components/ui";
import { identity, type Role } from "../services/api/identity";
import { destination, usernameError } from "../session/routing";
import { useSession } from "../session/provider";
import { theme } from "../theme/tokens";

const DEMO_USERNAMES: Record<string, { handle: string; badge: string; desc: string }[]> = {
  instructor: [
    { handle: "guro_santos", badge: "Primary Demo", desc: "Grade 7 Filipino & English Teacher" },
    { handle: "teacher_elena", badge: "Secondary", desc: "High School Literature Specialist" },
    { handle: "prof_mendoza", badge: "Curriculum", desc: "Tagalog Assessment Coordinator" },
  ],
  school_student: [
    { handle: "juan_delacruz", badge: "Primary Demo", desc: "Grade 7 Section Mabini Student" },
    { handle: "clara_reyes", badge: "Honor Roll", desc: "Top Performing Grade 7 Student" },
    { handle: "miguel_santos", badge: "Active Learner", desc: "Active in Filipino Quizzes" },
  ],
  personal_student: [
    { handle: "maria_clara", badge: "Primary Demo", desc: "Self-Paced Filipino Track" },
    { handle: "learner_kat", badge: "Independent", desc: "English Conversational Learner" },
    { handle: "mark_pinoy", badge: "Beginner", desc: "Tagalog Vocabulary Track" },
  ],
};
const DEMO_PASSWORD = "FluenttDemo123!";

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
  const [sample, setSample] = useState<string | null>(null);
  const [createdUsername, setCreatedUsername] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const lock = useRef(false);
  const invalid = usernameError(name);

  const suggestions = DEMO_USERNAMES[role ?? ""] ?? DEMO_USERNAMES.personal_student;

  function applyAutofill(handle: string) {
    setSample(handle);
    setName(handle);
    setPassword(DEMO_PASSWORD);
    setConfirmPassword(DEMO_PASSWORD);
    setChecked(handle);
    setAvailable(true);
    setChecking(false);
    setError("");
    setFeedback("Demo username and password filled. No real account will be created.");
  }

  useEffect(() => {
    let active = true;
    if (invalid || session.isDemo || sample === name) return;
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
        .catch((err) => {
          if (active) {
            if (session.isDemo || Platform.OS === "web") {
              setChecked(name);
              setAvailable(true);
              setFeedback("Available for demo profile");
              setError("");
            } else {
              setError(err instanceof Error ? err.message : "Network error");
            }
          }
        })
        .finally(() => {
          if (active) setChecking(false);
        });
    }, 400);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [name, invalid, attempt, session.isDemo, sample]);

  useEffect(() => {
    const profile = session.profile;
    if (createdUsername && profile && profile.role === role && profile.canonical_username === createdUsername.toLowerCase()) {
      router.replace(destination(profile));
    }
  }, [createdUsername, session.profile, role]);

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

  async function submit(overrideName?: string, preview = sample === name) {
    const finalName = overrideName ?? name;
    if (lock.current) return;
    if (!preview && sample !== finalName) {
      if (password.length > 0 && password.length < 6) {
        setError("Password must be at least 6 characters.");
        return;
      }
      if (password.length > 0 && password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
    }
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      if (preview || !password) {
        await session.create(finalName, role as Role, preview);
      } else {
        await session.create(finalName, role as Role, preview, password);
      }
      setCreatedUsername(finalName);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Please try again.");
      if ((err as { status?: number }).status === 409) {
        setAvailable(false);
        setFeedback("This username is already taken.");
      }
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <Screen backDisabled={busy || session.pending}>
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

      {/* Quick Demo Autofill Card */}
      <View style={userStyles.autofillCard}>
        <View style={userStyles.autofillHeader}>
          <Badge label="DEMO FAST-TRACK" variant="purple" icon="⚡" />
          <Text style={userStyles.autofillTitle}>Autofill Demo Account</Text>
        </View>
        <Text style={userStyles.autofillSub}>
          Choose a sample account to fill its username and password, then press Continue. Demo password: FluenttDemo123!
        </Text>
        <View style={userStyles.chipsContainer}>
          {suggestions.map((item) => {
            const isSelected = name === item.handle;
            return (
              <Pressable
                key={item.handle}
                accessibilityRole="button"
                accessibilityLabel={`Use demo username @${item.handle}`}
                accessibilityState={{ selected: isSelected, disabled: busy || session.pending }}
                disabled={busy || session.pending}
                style={({ pressed }) => [
                  userStyles.chip,
                  isSelected && userStyles.chipActive,
                  pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                ]}
                onPress={() => applyAutofill(item.handle)}
              >
                <View style={userStyles.chipTop}>
                  <Text style={[userStyles.chipHandle, isSelected && userStyles.chipHandleActive]}>
                    @{item.handle}
                  </Text>
                  <Text style={userStyles.chipBadge}>{item.badge}</Text>
                </View>
                <Text style={userStyles.chipDesc}>{item.desc}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Text style={s.heading}>Your username</Text>
      <Input
        accessibilityLabel="Username"
        value={name}
        editable={!busy && !session.pending}
        onChangeText={(value) => {
          if (sample !== null) {
            setPassword("");
            setConfirmPassword("");
          }
          setSample(null);
          setCreatedUsername(null);
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
        placeholder="e.g. Shan Gealone"
        returnKeyType="done"
      />
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
        <Text style={s.heading}>Password</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={showPassword ? "Hide password" : "Show password"}
          onPress={() => setShowPassword(!showPassword)}
          hitSlop={8}
        >
          <Text style={{ fontSize: 13, fontWeight: "700", color: theme.colors.primary }}>
            {showPassword ? "Hide" : "Show"}
          </Text>
        </Pressable>
      </View>
      <Input
        accessibilityLabel="Password"
        value={password}
        editable={!busy && !session.pending}
        secureTextEntry={!showPassword}
        onChangeText={(val) => {
          setPassword(val);
          setError("");
        }}
        autoCapitalize="none"
        placeholder="At least 6 characters"
        returnKeyType="next"
      />

      <Text style={[s.heading, { marginTop: 8 }]}>Confirm Password</Text>
      <Input
        accessibilityLabel="Confirm Password"
        value={confirmPassword}
        editable={!busy && !session.pending}
        secureTextEntry={!showPassword}
        onChangeText={(val) => {
          setConfirmPassword(val);
          setError("");
        }}
        autoCapitalize="none"
        placeholder="Re-enter your password"
        returnKeyType="done"
      />

      {name && invalid ? <ErrorMessage message={invalid} /> : null}
      {checking && <Loading />}
      {checked === name && feedback ? (
        <Text accessibilityLiveRegion="polite" style={userStyles.feedbackText}>
          ✓ {feedback}
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

      {/* Action Buttons */}
      <View style={{ gap: 10, marginTop: 16 }}>
        <Button
          label={
            busy
              ? "Please wait…"
              : session.pending
                ? "Retry secure save"
                : name
                  ? `Continue as @${name} →`
                  : "Create my profile"
          }
          variant="primary"
          disabled={
            busy ||
            (!session.pending &&
              (!!invalid || (!available && !session.isDemo && Platform.OS !== "web") || checking))
          }
          onPress={() => void submit()}
        />

        <Button
          label="Already have an account? Sign in here →"
          variant="ghost"
          disabled={busy || session.pending}
          onPress={() => router.push("/login")}
        />

        {/* Quick Launch with Default Primary */}
        {suggestions[0] && name !== suggestions[0].handle && (
          <Button
            label={`⚡ Fast-Enter as @${suggestions[0].handle}`}
            variant="secondary"
            disabled={busy || session.pending}
            onPress={() => {
              applyAutofill(suggestions[0].handle);
              void submit(suggestions[0].handle, true);
            }}
          />
        )}
      </View>
    </Screen>
  );
}

const userStyles = StyleSheet.create({
  autofillCard: {
    backgroundColor: theme.colors.surfaceSubtle,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: 20,
    padding: 18,
    gap: 12,
    marginTop: 8,
    marginBottom: 12,
  },
  autofillHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  autofillTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.colors.ink,
  },
  autofillSub: {
    fontSize: 13,
    color: theme.colors.muted,
  },
  chipsContainer: {
    gap: 10,
  },
  chip: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: 14,
    padding: 12,
    gap: 4,
  },
  chipActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.accent,
  },
  chipTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  chipHandle: {
    fontSize: 15,
    fontWeight: "700",
    color: theme.colors.ink,
  },
  chipHandleActive: {
    color: theme.colors.primary,
  },
  chipBadge: {
    fontSize: 11,
    fontWeight: "700",
    color: theme.colors.primary,
    backgroundColor: theme.colors.accent,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  chipDesc: {
    fontSize: 12,
    color: theme.colors.muted,
  },
  feedbackText: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.success,
    marginTop: 4,
  },
});
