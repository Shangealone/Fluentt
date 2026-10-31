import { createContext, useContext } from "react";
import { StyleSheet } from "react-native";
import { homeColors as c } from "./personal";

/** Opt-in presentation for the school assignment player; other question hosts retain their styles. */
export const AssignmentPresentation = createContext(false);
const question = StyleSheet.create({
  card: { padding: 0, borderWidth: 0, borderRadius: 0, backgroundColor: "transparent", gap: 14 },
  heading: { fontSize: 20, lineHeight: 29, fontWeight: "700", letterSpacing: -0.5, color: c.ink },
  body: { fontSize: 14, lineHeight: 24, color: c.muted },
  input: { minHeight: 52, borderWidth: 1, borderColor: c.line, borderRadius: 13, backgroundColor: "#FBFCF9", color: c.ink, padding: 12, fontSize: 16, lineHeight: 26 },
});
const choices = StyleSheet.create({
  option: { minHeight: 53, borderWidth: 1, borderColor: c.line, borderRadius: 14, padding: 13, backgroundColor: "#FFFFFF", justifyContent: "center" },
  selected: { borderColor: "#6C9981", backgroundColor: "#F0F5E9" },
  answer: { fontSize: 16, lineHeight: 26, fontWeight: "500", color: c.ink, flexShrink: 1 },
});
export function useAssignmentQuestionStyles<T extends object>(base: T) {
  return useContext(AssignmentPresentation) ? { ...base, ...question } : base;
}
export function useAssignmentChoiceStyles<T extends object>(base: T) {
  return useContext(AssignmentPresentation) ? { ...base, ...choices } : base;
}
