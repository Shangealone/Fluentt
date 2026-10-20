import { useState } from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
import { router } from "expo-router";
import { Screen, Button, Input, ErrorMessage, Loading, Badge, s } from "../components/ui";
import { useSession } from "../session/provider";
import { destination } from "../session/routing";
import { theme } from "../theme/tokens";

export default function LoginScreen() {
  const session = useSession();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = username.trim().length >= 3 && password.length >= 6 && !busy;

  async function handleLogin() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await session.login(username.trim(), password);
      // Wait for session state update and route to destination
      const profile = session.profile;
      if (profile) {
        router.replace(destination(profile));
      } else {
        router.replace("/student");
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Invalid username or password. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen backDisabled={busy}>
      <View style={styles.header}>
        <Badge label="SECURE SIGN IN" variant="info" icon="🔒" />
        <Text style={s.title}>Welcome back.</Text>
        <Text style={s.body}>
          Enter your unique username and password to access your classes and learning records.
        </Text>
      </View>

      <View style={styles.form}>
        <Text style={s.heading}>Username</Text>
        <Input
          accessibilityLabel="Username"
          value={username}
          editable={!busy}
          onChangeText={(val) => {
            setUsername(val);
            if (error) setError(null);
          }}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="e.g. maria_santos"
          returnKeyType="next"
        />

        <View style={styles.passwordRow}>
          <Text style={s.heading}>Password</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={showPassword ? "Hide password" : "Show password"}
            onPress={() => setShowPassword(!showPassword)}
            hitSlop={8}
          >
            <Text style={styles.toggleText}>{showPassword ? "Hide" : "Show"}</Text>
          </Pressable>
        </View>
        <Input
          accessibilityLabel="Password"
          value={password}
          editable={!busy}
          secureTextEntry={!showPassword}
          onChangeText={(val) => {
            setPassword(val);
            if (error) setError(null);
          }}
          autoCapitalize="none"
          placeholder="At least 6 characters"
          returnKeyType="go"
          onSubmitEditing={() => {
            if (canSubmit) void handleLogin();
          }}
        />

        {error ? <ErrorMessage message={error} /> : null}
        {busy ? <Loading /> : null}

        <View style={styles.actions}>
          <Button
            label={busy ? "Signing in…" : "Sign In →"}
            variant="primary"
            disabled={!canSubmit}
            onPress={() => void handleLogin()}
          />
          <Button
            label="Don't have an account? Create one"
            variant="secondary"
            disabled={busy}
            onPress={() => router.push("/")}
          />
        </View>
      </View>

      <View style={[s.card, styles.infoCard]}>
        <Text style={styles.infoTitle}>Protected Account Identity</Text>
        <Text style={s.body}>
          Your password is cryptographically hashed with scrypt. Account credentials are never shared or readable by other users.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 8, marginBottom: 12 },
  form: { gap: 12 },
  passwordRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  toggleText: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.colors.primary,
  },
  actions: { gap: 10, marginTop: 12 },
  infoCard: {
    backgroundColor: theme.colors.surfaceSubtle,
    marginTop: 20,
    gap: 6,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.colors.ink,
  },
});
