import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import {
  identity,
  type Profile,
  type Role,
  type Language,
} from "../services/api/identity";
import { secureVault } from "./vault";
import { SessionController } from "./controller";
import { classApi, type ClassAccess } from "../services/api/classes";
const vault = secureVault(SecureStore, Platform.OS);
type Session = {
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
  create: (username: string, role: Role) => Promise<void>;
  save: (settings: { grade?: number; language?: Language }) => Promise<void>;
  pending: boolean;
  classes: ClassAccess;
  refreshProfile: () => Promise<Profile | null>;
};
const Context = createContext<Session | null>(null);
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const controller = useState(() => new SessionController(vault))[0];
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const restore = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setProfile(await controller.restore(identity.me));
    } catch {
      setError(
        "We could not restore your device session. Retry to keep your existing profile.",
      );
    } finally {
      setLoading(false);
    }
  }, [controller]);
  useEffect(() => {
    let active = true;
    controller
      .restore(identity.me)
      .then((profile) => {
        if (active) setProfile(profile);
      })
      .catch(() => {
        if (active)
          setError(
            "We could not restore your device session. Retry to keep your existing profile.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [controller]);
  const authenticated = useCallback(
    async <T,>(operation: (credential: string) => Promise<T>): Promise<T> => {
      if (!controller.credential)
        throw new Error("No device session. Reopen FLUENTT to restore it.");
      try {
        return await operation(controller.credential);
      } catch (error) {
        if ((error as { status?: number }).status === 401) await restore();
        throw error;
      }
    },
    [controller, restore],
  );
  const classes = useMemo<ClassAccess>(
    () => ({
      create: async (draft, key) => {
        const row = await authenticated((secret) =>
          classApi.create(secret, draft, key),
        );
        setProfile((previous) =>
          previous?.role === "instructor"
            ? { ...previous, profile_status: "active", onboarding_step: null }
            : previous,
        );
        return row;
      },
      mine: (offset) =>
        authenticated((secret) => classApi.mine(secret, offset)),
      get: (id) => authenticated((secret) => classApi.get(secret, id)),
      update: (id, draft) =>
        authenticated((secret) => classApi.update(secret, id, draft)),
    }),
    [authenticated],
  );
  return (
    <Context.Provider
      value={{
        profile,
        classes,
        refreshProfile: async () => {
          const current = await authenticated(identity.me);
          setProfile(current);
          return current;
        },
        loading,
        error,
        retry: () => void restore(),
        pending,
        create: async (username, role) => {
          if (Platform.OS === "web")
            throw new Error(
              "Open the Android or iOS app to create a profile with secure storage. Web is a navigation preview.",
            );
          try {
            setProfile(
              await controller.create(() => identity.create(username, role)),
            );
          } finally {
            setPending(controller.pending !== null);
          }
        },
        save: async (settings) => {
          if (!controller.credential) throw new Error("No device session.");
          try {
            setProfile(
              await identity.preferences(controller.credential, settings),
            );
          } catch (error) {
            if ((error as { status?: number }).status === 401) await restore();
            throw error;
          }
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useSession() {
  const session = useContext(Context);
  if (!session) throw new Error("Session provider missing");
  return session;
}
