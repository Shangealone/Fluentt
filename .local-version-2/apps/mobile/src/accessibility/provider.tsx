import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AccessibilityInfo, AppState, Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

export type ReadingPreferences = { useDeviceSettings: boolean; textSize: "standard" | "larger" | "extra"; highContrast: boolean; reduceMotion: boolean };
export const defaultReadingPreferences: ReadingPreferences = { useDeviceSettings: true, textSize: "standard", highContrast: false, reduceMotion: false };
export const readingScale = (size: ReadingPreferences["textSize"]) => size === "extra" ? 1.32 : size === "larger" ? 1.15 : 1;
const storageKey = "fluentt.accessibility.v1";
type ReadingContext = {
  preferences: ReadingPreferences; loading: boolean; restoreError: string;
  highContrast: boolean; reduceMotion: boolean; textScale: number | null;
  save: (preferences: ReadingPreferences) => Promise<void>;
};
const Context = createContext<ReadingContext>({
  preferences: defaultReadingPreferences, loading: false, restoreError: "", highContrast: false, reduceMotion: false, textScale: null,
  save: async () => { throw new Error("Reading preferences are unavailable. Reopen the app and try again."); },
});
function valid(value: unknown): value is ReadingPreferences {
  if (!value || typeof value !== "object") return false;
  const row = value as ReadingPreferences;
  return typeof row.useDeviceSettings === "boolean" && ["standard", "larger", "extra"].includes(row.textSize) && typeof row.highContrast === "boolean" && typeof row.reduceMotion === "boolean";
}

export function ReadingPreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<ReadingPreferences>(defaultReadingPreferences);
  const [loading, setLoading] = useState(true), [restoreError, setRestoreError] = useState("");
  const [systemContrast, setSystemContrast] = useState(false), [systemMotion, setSystemMotion] = useState(false);
  const saving = useRef(false), alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    let active = true;
    async function restore() {
      try {
        const raw = Platform.OS === "web" ? window.localStorage.getItem(storageKey) : await SecureStore.getItemAsync(storageKey);
        if (!active || !raw) return;
        const stored = JSON.parse(raw);
        if (stored.version !== 1 || !valid(stored.preferences)) throw new Error("Invalid reading preferences.");
        setPreferences(stored.preferences);
      } catch {
        if (active) setRestoreError("We couldn’t load your saved reading preferences. You can choose and save them again.");
      } finally { if (active) setLoading(false); }
    }
    void restore();
    return () => { active = false; alive.current = false; };
  }, []);

  useEffect(() => {
    let active = true;
    if (Platform.OS === "web") {
      const contrast = window.matchMedia("(prefers-contrast: more)"), forced = window.matchMedia("(forced-colors: active)"), motion = window.matchMedia("(prefers-reduced-motion: reduce)");
      const update = () => { setSystemContrast(contrast.matches || forced.matches); setSystemMotion(motion.matches); };
      update();
      for (const query of [contrast, forced, motion]) query.addEventListener("change", update);
      return () => { for (const query of [contrast, forced, motion]) query.removeEventListener("change", update); };
    }
    async function update() {
      const [motion, contrast] = await Promise.allSettled([
        Promise.resolve().then(() => AccessibilityInfo.isReduceMotionEnabled()),
        Promise.resolve().then(() => Platform.OS === "android" ? AccessibilityInfo.isHighTextContrastEnabled?.() ?? false : AccessibilityInfo.isDarkerSystemColorsEnabled?.() ?? false),
      ]);
      if (!active) return;
      if (motion.status === "fulfilled") setSystemMotion(motion.value);
      if (contrast.status === "fulfilled") setSystemContrast(contrast.value);
    }
    void update();
    const motion = AccessibilityInfo.addEventListener("reduceMotionChanged", value => { if (active) setSystemMotion(value); });
    const app = AppState.addEventListener("change", value => { if (value === "active") void update(); });
    return () => { active = false; motion.remove(); app.remove(); };
  }, []);

  const highContrast = preferences.useDeviceSettings ? systemContrast : preferences.highContrast;
  const reduceMotion = preferences.useDeviceSettings ? systemMotion : preferences.reduceMotion;
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const style = document.createElement("style");
    style.textContent = 'html[data-fluentt-reduce-motion="true"] *, html[data-fluentt-reduce-motion="true"] *::before, html[data-fluentt-reduce-motion="true"] *::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; } html[data-fluentt-high-contrast="true"] input, html[data-fluentt-high-contrast="true"] textarea { border-color: #6B8978 !important; }';
    document.head.appendChild(style);
    return () => { style.remove(); };
  }, []);
  useEffect(() => {
    if (Platform.OS !== "web") return;
    document.documentElement.dataset.fluenttReduceMotion = String(reduceMotion);
    document.documentElement.dataset.fluenttHighContrast = String(highContrast);
    return () => { delete document.documentElement.dataset.fluenttReduceMotion; delete document.documentElement.dataset.fluenttHighContrast; };
  }, [reduceMotion, highContrast]);

  const save = useCallback(async (next: ReadingPreferences) => {
    if (loading || saving.current) throw new Error("Please wait for your reading preferences to finish loading or saving.");
    if (!valid(next)) throw new Error("Choose valid reading preferences.");
    saving.current = true;
    try {
      const data = JSON.stringify({ version: 1, preferences: next });
      if (Platform.OS === "web") window.localStorage.setItem(storageKey, data);
      else await SecureStore.setItemAsync(storageKey, data);
      if (alive.current) { setPreferences({ ...next }); setRestoreError(""); }
    } catch {
      throw new Error("We couldn’t save your reading preferences on this device. Allow app storage and try again.");
    } finally { saving.current = false; }
  }, [loading]);
  return <Context.Provider value={{ preferences, loading, restoreError, highContrast, reduceMotion, textScale: preferences.useDeviceSettings ? null : readingScale(preferences.textSize), save }}>{children}</Context.Provider>;
}

export function useReadingPreferences() { return useContext(Context); }
