import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "../theme/tokens";
export function Screen({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={s.container}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
export function Button({
  label,
  onPress,
  disabled = false,
  secondary = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        secondary && {
          backgroundColor: "transparent",
          borderWidth: 1,
          borderColor: theme.colors.border,
        },
        { opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
      ]}
    >
      <Text
        style={[s.buttonText, secondary && { color: theme.colors.primary }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}
export function Input(props: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={theme.colors.muted}
      {...props}
      style={[s.input, props.style]}
    />
  );
}
export function Loading() {
  return (
    <ActivityIndicator
      accessibilityLabel="Loading"
      color={theme.colors.primary}
    />
  );
}
export function ErrorMessage({ message }: { message: string }) {
  return (
    <Text accessibilityRole="alert" style={s.error}>
      {message}
    </Text>
  );
}
export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <View style={s.card}>
      <Text style={s.heading}>{title}</Text>
      <Text style={s.body}>{description}</Text>
    </View>
  );
}
export const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  container: {
    padding: 24,
    gap: 24,
    width: "100%",
    maxWidth: 680,
    alignSelf: "center",
    flexGrow: 1,
  },
  brand: {
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: 3,
    color: theme.colors.ink,
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 2,
    color: theme.colors.primary,
  },
  title: {
    fontSize: 40,
    lineHeight: 46,
    fontWeight: "800",
    color: theme.colors.ink,
  },
  heading: { fontSize: 24, fontWeight: "700", color: theme.colors.ink },
  body: { fontSize: 16, lineHeight: 25, color: theme.colors.muted },
  card: {
    padding: 24,
    borderRadius: 24,
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 12,
  },
  button: {
    backgroundColor: theme.colors.primary,
    minHeight: 52,
    padding: 16,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonText: { fontSize: 16, fontWeight: "700", color: theme.colors.white },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    padding: 16,
    color: theme.colors.ink,
  },
  error: { color: theme.colors.error, fontSize: 15, lineHeight: 23 },
});
