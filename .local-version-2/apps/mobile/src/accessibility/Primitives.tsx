import { createContext, forwardRef, useContext, type ComponentRef } from "react";
import { StyleSheet, Text as NativeText, TextInput as NativeTextInput, useWindowDimensions as useNativeWindowDimensions, type TextProps, type TextInputProps, type TextStyle } from "react-native";
import { useReadingPreferences } from "./provider";

const InsideText = createContext(false);
const contrastColors: Record<string, string> = {
  "#63766d": "#304C40", "#173e3b": "#0D2926", "#646773": "#353945", "#52685d": "#29483A",
  "#7b887f": "#3F594A", "#88958d": "#3F594A", "#7d8b82": "#3F594A", "#50685e": "#29483A",
  "#496653": "#29483A", "#758078": "#3F594A", "#7b8e7e": "#3F594A", "#176556": "#0C5143",
  "#64748b": "#334155", "#52627b": "#293950", "#94a3b8": "#475569",
};
export function contrastColor(value: TextStyle["color"]): TextStyle["color"] {
  return typeof value === "string" ? contrastColors[value.toLowerCase()] ?? value : value;
}
function scaledStyle(style: TextStyle, scale: number | null, nested: boolean, input = false): TextStyle {
  if (scale === null) return {};
  return {
    ...(typeof style.fontSize === "number" ? { fontSize: style.fontSize * scale } : !nested ? { fontSize: (input ? 16 : 14) * scale } : {}),
    ...(typeof style.lineHeight === "number" ? { lineHeight: style.lineHeight * scale } : {}),
  };
}

/** Native text scaling is retained by default; explicit device overrides are applied once. */
export const Text = forwardRef<ComponentRef<typeof NativeText>, TextProps>(function ReadingText({ style, children, ...props }, ref) {
  const { textScale, highContrast } = useReadingPreferences();
  const nested = useContext(InsideText);
  const base = StyleSheet.flatten(style) ?? {};
  const scale = textScale === null ? null : props.maxFontSizeMultiplier && props.maxFontSizeMultiplier > 0 ? Math.min(textScale, props.maxFontSizeMultiplier) : textScale;
  const override: TextStyle = { ...scaledStyle(base, scale, nested), ...(highContrast && base.color ? { color: contrastColor(base.color) } : {}) };
  return <NativeText {...props} ref={ref} allowFontScaling={textScale === null ? props.allowFontScaling : false} style={[style, override]}><InsideText.Provider value={true}>{children}</InsideText.Provider></NativeText>;
});

export const TextInput = forwardRef<ComponentRef<typeof NativeTextInput>, TextInputProps>(function ReadingInput({ style, ...props }, ref) {
  const { textScale, highContrast } = useReadingPreferences();
  const base = StyleSheet.flatten(style) ?? {};
  const override: TextStyle = { ...scaledStyle(base, textScale, false, true), ...(highContrast ? { ...(base.color ? { color: contrastColor(base.color) } : {}), borderColor: "#6B8978" } : {}) };
  return <NativeTextInput {...props} ref={ref} allowFontScaling={textScale === null ? props.allowFontScaling : false} placeholderTextColor={highContrast ? contrastColor(props.placeholderTextColor) : props.placeholderTextColor} style={[style, override]} />;
});

/** Layouts that already respond to larger device text also respond to app overrides. */
export function useWindowDimensions() {
  const dimensions = useNativeWindowDimensions();
  const { textScale } = useReadingPreferences();
  return textScale === null ? dimensions : { ...dimensions, fontScale: textScale };
}
