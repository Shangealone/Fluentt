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
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
  type TextStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "../theme/tokens";
import { BackButton } from "./BackButton";

export function Screen({ children, style, backDisabled = false }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; backDisabled?: boolean }) {
  return (
    <SafeAreaView style={[s.safe, style]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={s.container}
          showsVerticalScrollIndicator={false}
        >
          <BackButton disabled={backDisabled} />
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export type ButtonVariant = "primary" | "secondary" | "outline" | "danger" | "ghost" | "accent";
export type ButtonSize = "sm" | "md" | "lg";

function actionIcon(label: string): string | undefined {
  if (/^(save|confirm)/i.test(label)) return "✓";
  if (/^(refresh|retry|reload)/i.test(label)) return "↻";
  if (/^(create|join|add)/i.test(label)) return "+";
  if (/^(edit|write)/i.test(label)) return "✎";
  if (/^(view|open).*assignment/i.test(label)) return "▤";
  if (/^(class messages|messages)/i.test(label)) return "✉";
  if (/^(learning history|progress)/i.test(label)) return "◷";
  if (/^(continue|start|preview)/i.test(label)) return "→";
  return undefined;
}

const btnVariantStyles: Record<ButtonVariant, ViewStyle> = {
  primary: {
    backgroundColor: theme.colors.primary,
    ...Platform.select({
      ios: {
        shadowColor: theme.colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: "0 3px 10px rgba(52, 88, 200, 0.12)",
      },
    }),
  },
  secondary: {
    backgroundColor: theme.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  outline: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
  },
  danger: {
    backgroundColor: theme.colors.errorLight,
    borderWidth: 1,
    borderColor: "#FECDD3",
  },
  ghost: {
    backgroundColor: "transparent",
  },
  accent: {
    backgroundColor: theme.colors.indigo,
  },
};

const btnSizeStyles: Record<ButtonSize, ViewStyle> = {
  sm: {
    minHeight: 44,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  md: {
    minHeight: 50,
    paddingVertical: 13,
    paddingHorizontal: 20,
    borderRadius: 14,
  },
  lg: {
    minHeight: 56,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
  },
};

const btnTextVariantStyles: Record<ButtonVariant, TextStyle> = {
  primary: { color: theme.colors.white },
  secondary: { color: theme.colors.ink },
  outline: { color: theme.colors.primary },
  danger: { color: theme.colors.error },
  ghost: { color: theme.colors.primary },
  accent: { color: theme.colors.white },
};

const btnTextSizeStyles: Record<ButtonSize, TextStyle> = {
  sm: { fontSize: 13 },
  md: { fontSize: 15 },
  lg: { fontSize: 17 },
};

export function Button({
  label,
  onPress,
  disabled = false,
  secondary = false,
  variant,
  size = "md",
  icon,
  style,
  textStyle,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}) {
  const activeVariant: ButtonVariant = variant ?? (secondary ? "secondary" : "primary");
  const visualIcon = icon ?? actionIcon(label);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.buttonBase,
        btnVariantStyles[activeVariant],
        btnSizeStyles[size],
        {
          opacity: disabled ? 0.45 : pressed ? 0.88 : 1,
          transform: [{ scale: pressed && !disabled ? 0.985 : 1 }],
        },
        style,
      ]}
    >
      <View style={s.btnContentRow}>
        {!!visualIcon && <Text accessible={false} style={[s.btnIcon, btnTextVariantStyles[activeVariant]]}>{visualIcon}</Text>}
        <Text
          style={[
            s.buttonText,
            btnTextVariantStyles[activeVariant],
            btnTextSizeStyles[size],
            textStyle,
          ]}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

export type BadgeVariant = "success" | "info" | "warning" | "neutral" | "danger" | "purple";

const badgeVariantStyles: Record<BadgeVariant, ViewStyle> = {
  success: {
    backgroundColor: theme.colors.successLight,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  info: {
    backgroundColor: theme.colors.indigoLight,
    borderWidth: 1,
    borderColor: "#C7D2FE",
  },
  warning: {
    backgroundColor: theme.colors.warningLight,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  neutral: {
    backgroundColor: theme.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  danger: {
    backgroundColor: theme.colors.errorLight,
    borderWidth: 1,
    borderColor: "#FECDD3",
  },
  purple: {
    backgroundColor: "#F3E8FF",
    borderWidth: 1,
    borderColor: "#E9D5FF",
  },
};

const badgeTextVariantStyles: Record<BadgeVariant, TextStyle> = {
  success: { color: "#065F46" },
  info: { color: "#3730A3" },
  warning: { color: "#92400E" },
  neutral: { color: theme.colors.muted },
  danger: { color: theme.colors.error },
  purple: { color: "#6B21A8" },
};

export function Badge({
  label,
  variant = "neutral",
  icon,
}: {
  label: string;
  variant?: BadgeVariant;
  icon?: string;
}) {
  return (
    <View style={[s.badgeBase, badgeVariantStyles[variant]]}>
      {!!icon && <Text style={s.badgeIcon}>{icon}</Text>}
      <Text style={[s.badgeText, badgeTextVariantStyles[variant]]}>
        {label}
      </Text>
    </View>
  );
}

export function Input(props: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={theme.colors.subtle}
      {...props}
      style={[s.input, props.style]}
    />
  );
}

export function Loading() {
  return (
    <View style={s.loadingContainer}>
      <ActivityIndicator
        accessibilityLabel="Loading"
        color={theme.colors.primary}
        size="large"
      />
    </View>
  );
}

export function ErrorMessage({ message }: { message: string }) {
  return (
    <View style={s.errorCard}>
      <Text style={s.errorIcon}>⚠️</Text>
      <Text accessibilityRole="alert" style={s.error}>
        {message}
      </Text>
    </View>
  );
}

export function EmptyState({
  title,
  description,
  icon = "📋",
  action,
}: {
  title: string;
  description: string;
  icon?: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={[s.card, s.emptyCard]}>
      <Text style={s.emptyIcon}>{icon}</Text>
      <Text style={s.heading}>{title}</Text>
      <Text style={[s.body, s.emptyDescription]}>{description}</Text>
      {action && <View style={{ marginTop: 12, width: "100%" }}>{action}</View>}
    </View>
  );
}

export const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 100,
    gap: 24,
    width: "100%",
    maxWidth: 1040,
    alignSelf: "center",
    flexGrow: 1,
  },
  brand: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 1.5,
    color: theme.colors.primary,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.5,
    color: theme.colors.primary,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 30,
    lineHeight: 38,
    fontWeight: "800",
    color: theme.colors.ink,
    letterSpacing: -0.6,
  },
  heading: {
    fontSize: 21,
    fontWeight: "700",
    color: theme.colors.ink,
    letterSpacing: -0.3,
  },
  subheading: {
    fontSize: 17,
    fontWeight: "600",
    color: theme.colors.ink,
  },
  body: {
    fontSize: 16,
    lineHeight: 25,
    color: theme.colors.muted,
  },
  card: {
    padding: 20,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 14,
    ...Platform.select({
      ios: {
        shadowColor: "#0F172A",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 14,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: "0 4px 20px -2px rgba(15, 23, 42, 0.06), 0 1px 3px rgba(15, 23, 42, 0.03)",
      },
    }),
  },

  // Base Button
  buttonBase: {
    minHeight: 50,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    ...Platform.select({
      web: {
        cursor: "pointer",
        transition: "all 0.15s ease",
      },
    }),
  },
  button: {
    backgroundColor: theme.colors.primary,
    minHeight: 50,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  btnContentRow: {
    flexShrink: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  btnIcon: {
    fontSize: 16,
  },
  buttonText: {
    flexShrink: 1,
    textAlign: "center",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.2,
    color: theme.colors.white,
  },

  // Base Badge
  badgeBase: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingVertical: 5,
    paddingHorizontal: 11,
    borderRadius: 9999,
    gap: 5,
  },
  badgeIcon: {
    fontSize: 11,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.1,
  },

  // Input
  input: {
    minHeight: 52,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: theme.colors.ink,
    fontSize: 16,
    backgroundColor: theme.colors.surface,
  },

  // Loading
  loadingContainer: {
    padding: 32,
    alignItems: "center",
    justifyContent: "center",
  },

  // Errors & Alerts
  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: theme.colors.errorLight,
    borderWidth: 1,
    borderColor: "#FECDD3",
    borderRadius: 14,
    padding: 16,
  },
  errorIcon: {
    fontSize: 18,
  },
  error: {
    color: theme.colors.error,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "600",
    flex: 1,
  },

  // Empty state
  emptyCard: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 36,
    textAlign: "center",
  },
  emptyIcon: {
    fontSize: 42,
    marginBottom: 8,
  },
  emptyDescription: {
    textAlign: "center",
    maxWidth: 420,
  },
});
