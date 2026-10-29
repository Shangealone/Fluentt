import { Pressable, Text, View } from "react-native";
import { s } from "./ui";
export function Choices<T extends string | number>({
  values,
  value,
  onChange,
  label,
  disabled = false,
}: {
  values: readonly T[];
  value: T | null;
  onChange: (value: T) => void;
  label: (value: T) => string;
  disabled?: boolean;
}) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
      {values.map((item) => (
        <Pressable
          key={item}
          accessibilityRole="radio"
          aria-checked={item === value}
          aria-disabled={disabled}
          accessibilityState={{
            selected: item === value,
            checked: item === value,
            disabled,
          }}
          disabled={disabled}
          accessibilityLabel={label(item)}
          onPress={() => onChange(item)}
          style={[
            s.card,
            {
              padding: 16,
              minWidth: 100,
              minHeight: 56,
              flexGrow: 1,
              borderWidth: 2,
              borderColor: item === value ? "#23664E" : "#D7E1D9",
              backgroundColor: item === value ? "#E4EDB9" : "white",
            },
          ]}
        >
          <Text style={s.body}>
            {label(item)}
            {item === value ? " ✓" : ""}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
export const grades = Array.from({ length: 12 }, (_, i) => i + 1);
export const languages = ["english", "tagalog"] as const;
