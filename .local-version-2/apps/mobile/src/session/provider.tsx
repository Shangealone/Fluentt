import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from "react";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { identity, type Profile, type Role, type PreferenceSettings, type BrowserSession, type RegistrationClass } from "../services/api/identity";
import { secureVault } from "./vault";
import { SessionChangedError, SessionController } from "./controller";
import { classApi, type ClassAccess } from "../services/api/classes";
import { enrollmentApi, type ClassPreview, type EnrollmentAccess } from "../services/api/enrollment";
import { assignmentAccess, type AssignmentAccess } from "../services/api/assignments";
import { captureAccess, type CaptureAccess } from "../services/api/capture";
import { resultsAccess, type ResultsAccess } from "../services/api/results";
import { progressAccess, type ProgressAccess } from "../services/api/progress";

import { monitoringAccess, type MonitoringAccess } from "../services/api/monitoring";

import { communicationAccess, type CommunicationAccess } from "../services/api/communications";
import { pathwayAccess, type PathwayAccess } from "../services/api/pathways";
import {
  materialsAccess,
  notificationsAccess,
  type MaterialsAccess,
  type NotificationsAccess,
} from "../services/api/materials";
import { pronunciationAccess, type PronunciationAccess } from "../services/api/pronunciation";
import { conversationAccess, type ConversationAccess } from "../services/api/conversation";
import { researchAccess, type ResearchAccess } from "../services/api/research";
import { practiceAccess, type PracticeAccess } from "../services/api/practice";
import { personalHistoryAccess, type PersonalHistoryAccess } from "../services/api/personalHistory";
import { browserTransport, configureApiPlatform, type AuthContext } from "../services/api/client";
configureApiPlatform(Platform.OS);
const vault = secureVault(SecureStore, Platform.OS);
async function restoreBrowser(): Promise<BrowserSession | null> {
  const key = "fluentt.device-session";
  let legacy: string | null = null;
  try { legacy = window.localStorage.getItem(key); } catch {}
  try {
    const session = legacy ? await identity.exchange(legacy) : await identity.browserMe();
    if (legacy) { try { window.localStorage.removeItem(key); } catch { throw new Error("Your previous sign-in could not be removed. Allow site storage and retry."); } }
    return session;
  } catch (error) {
    if ((error as {status?: number}).status === 401) {
      if (legacy) { try { window.localStorage.removeItem(key); } catch {} }
      return null;
    }
    throw error;
  }
}
type Recovery = "restore" | "logout" | "clear";

type Session = {
  profile: Profile | null;
  registrationPreview: (code: string) => Promise<ClassPreview>;
  loading: boolean;
  error: string | null;
  recovery: Recovery;
  retry: () => void;
  create: (username: string, role: Role, password: string, enrollment?: RegistrationClass) => Promise<Profile>;
  login: (username: string, password: string) => Promise<Profile>;
  setPassword: (password: string) => Promise<Profile>;
  save: (settings: PreferenceSettings) => Promise<void>;
  logout: () => void;
  pending: boolean;
  classes: ClassAccess;
  enrollment: EnrollmentAccess;
  assignments: AssignmentAccess;
  capture: CaptureAccess;
  results: ResultsAccess;
  progress: ProgressAccess;
  monitoring: MonitoringAccess;
  communication: CommunicationAccess;
  pathway: PathwayAccess;
  materials: MaterialsAccess;
  notifications: NotificationsAccess;
  pronunciation: PronunciationAccess;
  conversation: ConversationAccess;
  research: ResearchAccess;
  practice: PracticeAccess;
  activityHistory: PersonalHistoryAccess;
  refreshProfile: () => Promise<Profile | null>;
};
const Context = createContext<Session | null>(null);
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [controller] = useState(() => new SessionController(vault, Platform.OS === "web" ? restoreBrowser : undefined));
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [recovery, setRecovery] = useState<Recovery>("restore");
  const recoveryBusy = useRef(false);

  const recover = useCallback(async (operation: Recovery) => {
    if (recoveryBusy.current) return;
    recoveryBusy.current = true;
    setLoading(true);
    setError(null);
    setProfile(null);
    setRecovery(operation);
    try {
      if (operation === "restore") setProfile(await controller.restore(identity.me));
      else if (operation === "logout") await controller.logout(identity.revoke);
      else await controller.clear();
    } catch (error) {
      if (error instanceof SessionChangedError) return;
      setError(operation === "logout"
        ? "Sign-out could not finish. Please retry."
        : operation === "clear"
          ? "Your sign-in has expired. Please retry."
          : "We could not check your sign-in. Check your connection and retry.");
    } finally { recoveryBusy.current = false; setLoading(false); }
  }, [controller]);

  useEffect(() => {
    let active = true;
    controller.restore(identity.me)
      .then((current) => { if (active) setProfile(current); })
      .catch((error) => {
        if (active && !(error instanceof SessionChangedError))
          setError("We could not check your sign-in. Check your connection and retry.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [controller]);

  const authenticated = useCallback(async <T,>(operation: (credential: AuthContext) => Promise<T>): Promise<T> => {
    try { return await controller.run(operation); }
    catch (error) {
      if ((error as { status?: number }).status === 401) {
        // Hide protected data immediately; cleanup never depends on a second network validation.
        setProfile(null);
        setLoading(true);
        setError(null);
        setRecovery("clear");
        try { await controller.invalidate(); }
        catch { setError("Your sign-in has expired. Please retry."); }
        finally { setLoading(false); }
      }
      throw error;
    }
  }, [controller]);
  const liveClasses = useMemo<ClassAccess>(() => ({
    create: async (draft, key) => {
      const row = await authenticated((secret) => classApi.create(secret, draft, key));
      setProfile((previous) => previous?.role === "instructor"
        ? { ...previous, profile_status: "active", onboarding_step: null } : previous);
      return row;
    },
    mine: (offset) => authenticated((secret) => classApi.mine(secret, offset)),
    get: (id) => authenticated((secret) => classApi.get(secret, id)),
    update: (id, draft) => authenticated((secret) => classApi.update(secret, id, draft)),
  }), [authenticated]);
  const liveEnrollment = useMemo<EnrollmentAccess>(() => ({
    preview: (code) => authenticated((secret) => enrollmentApi.preview(secret, code)),
    confirm: async (body) => {
      const row = await authenticated((secret) => enrollmentApi.confirm(secret, body));
      setProfile((previous) => previous?.role === "school_student"
        ? { ...previous, profile_status: "active", onboarding_step: null } : previous);
      return row;
    },
    mine: (offset) => authenticated((secret) => enrollmentApi.mine(secret, offset)),
  }), [authenticated]);
  const refreshProfile = useCallback(async () => {
    const current = await authenticated(identity.me);
    setProfile(current);
    return current;
  }, [authenticated]);
  const liveAssignments = useMemo(() => assignmentAccess(authenticated), [authenticated]);
  const liveCapture = useMemo(() => captureAccess(authenticated), [authenticated]);
  const liveResults = useMemo(() => resultsAccess(authenticated), [authenticated]);
  const liveCommunication = useMemo(() => communicationAccess(authenticated), [authenticated]);
  const liveMonitoring = useMemo(() => monitoringAccess(authenticated), [authenticated]);
  const liveProgress = useMemo(() => progressAccess(authenticated), [authenticated]);
  const livePathway = useMemo(() => pathwayAccess(authenticated), [authenticated]);
  const liveMaterials = useMemo(() => materialsAccess(authenticated), [authenticated]);
  const liveNotifications = useMemo(() => notificationsAccess(authenticated), [authenticated]);
  const livePronunciation = useMemo(() => pronunciationAccess(authenticated), [authenticated]);
  const liveConversation = useMemo(() => conversationAccess(authenticated), [authenticated]);
  const liveResearch = useMemo(() => researchAccess(authenticated), [authenticated]);
  const livePractice = useMemo(() => practiceAccess(authenticated), [authenticated]);
  const liveActivityHistory = useMemo(() => personalHistoryAccess(authenticated), [authenticated]);
  return <Context.Provider value={{
    profile, registrationPreview: code => enrollmentApi.registrationPreview(code, Platform.OS === "web" ? browserTransport : undefined), classes: liveClasses, enrollment: liveEnrollment, assignments: liveAssignments, capture: liveCapture, results: liveResults, progress: liveProgress, monitoring: liveMonitoring, communication: liveCommunication, pathway: livePathway, materials: liveMaterials, notifications: liveNotifications, pronunciation: livePronunciation, conversation: liveConversation, research: liveResearch, practice: livePractice, activityHistory: liveActivityHistory, refreshProfile, loading, error, recovery, pending,
    retry: () => void recover(recovery),
    logout: () => { void recover("logout"); },
    create: async (username, role, password, enrollment) => {
      try {
        const current = await controller.create(() => Platform.OS === "web" ? identity.browserCreate(username, role, password, enrollment) : identity.create(username, role, password, enrollment));
        setProfile(current); return current;
      } finally { setPending(controller.pending !== null); }
    },
    login: async (username, password) => {
      try {
        const current = await controller.login(() => Platform.OS === "web" ? identity.browserLogin(username, password) : identity.login(username, password));
        setProfile(current); return current;
      } finally { setPending(controller.pending !== null); }
    },
    setPassword: async password => { const current = await authenticated(auth => identity.setPassword(auth, password)); setProfile(current); return current; },
    save: async settings => { setProfile(await authenticated(auth => identity.preferences(auth, settings))); },
  }}>{children}</Context.Provider>;
}
export function useSession() {
  const session = useContext(Context);
  if (!session) throw new Error("Session provider missing");
  return session;
}
