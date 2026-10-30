import { Platform, Share } from "react-native";
import * as Clipboard from "expo-clipboard";
import { copyClassCode, shareClassCode } from "./state";

/** The browser clipboard fallback can report success when execCommand did not copy. */
export function copyInvitation(code: string): Promise<string> {
  return copyClassCode(code, async value => {
    try {
      if (Platform.OS !== "web") return await Clipboard.setStringAsync(value);
      if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) return false;
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      return false;
    }
  });
}

export function shareInvitation(code: string, name: string): Promise<string> {
  return shareClassCode(code, name, async message => {
    try {
      const result = await Share.share({ message });
      // React Native Web forwards navigator.share, which resolves without an action object.
      return Platform.OS === "web" || result?.action === Share.sharedAction;
    } catch (failure) {
      if (failure && typeof failure === "object" && "name" in failure && failure.name === "AbortError") return false;
      throw new Error("Sharing isn’t available here. Copy the code and share it with your students.");
    }
  });
}
