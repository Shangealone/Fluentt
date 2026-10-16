import type { Vault } from "./controller";
type SecureStorePort = {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
};
export function secureVault(store: SecureStorePort, platform: string): Vault {
  const key = "fluentt.device-session";
  return {
    read: async () => (platform === "web" ? null : store.getItemAsync(key)),
    save: async (credential) => {
      if (platform === "web")
        throw new Error("Secure device storage requires Android or iOS.");
      await store.setItemAsync(key, credential);
    },
    clear: async () => {
      if (platform !== "web") await store.deleteItemAsync(key);
    },
  };
}
