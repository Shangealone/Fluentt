import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from "react";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { identity, type Profile, type Role, type PreferenceSettings, type LearningExperience } from "../services/api/identity";
import { secureVault } from "./vault";
import { SessionChangedError, SessionController } from "./controller";
import { classApi, type ClassAccess } from "../services/api/classes";
import { enrollmentApi, type EnrollmentAccess } from "../services/api/enrollment";
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
import { createDemoPracticeApi } from "../demo/personalPractice";
import {
  DEMO_PROFILES,
  createDemoClassesApi,
  createDemoEnrollmentApi,
  createDemoAssignmentApi,
  createDemoCaptureApi,
  createDemoResultsApi,
  createDemoProgressApi,
  createDemoMonitoringApi,
  createDemoCommunicationApi,
  createDemoPathwayApi,
  createDemoMaterialsApi,
  createDemoNotificationsApi,
  createDemoPronunciationApi,
  createDemoConversationApi,
  createDemoResearchApi,
  demoStore,
} from "../demo/demoData";

let webMemoryToken: string | null = null;
const webVault = {
  read: async () => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        return window.localStorage.getItem("fluentt.device-session");
      }
    } catch {}
    return webMemoryToken;
  },
  save: async (credential: string) => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem("fluentt.device-session", credential);
      }
    } catch {}
    webMemoryToken = credential;
  },
  clear: async () => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.removeItem("fluentt.device-session");
      }
    } catch {}
    webMemoryToken = null;
  },
};
const vault = Platform.OS === "web" ? webVault : secureVault(SecureStore, Platform.OS);
type Recovery = "restore" | "logout" | "clear";
export type DemoRole = "instructor" | "student" | "personal";

type Session = {
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  recovery: Recovery;
  retry: () => void;
  create: (username: string, role: Role, preview?: boolean, password?: string) => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
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
  refreshProfile: () => Promise<Profile | null>;
  isDemo: boolean;
  demoRole: DemoRole;
  setDemoMode: (enabled: boolean) => void;
  switchDemoRole: (role: DemoRole) => void;
  resetDemoData: () => void;
};
const Context = createContext<Session | null>(null);
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [controller] = useState(() => new SessionController(vault));
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [demoRole, setDemoRole] = useState<DemoRole>("instructor");
  const [demoProfiles, setDemoProfiles] = useState(() => ({ ...DEMO_PROFILES }));
  const [demoVersion, setDemoVersion] = useState(0);
  const demoExperience = useRef<Record<string, LearningExperience>>({ tagalog: "some_words" });

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
        ? "Sign-out could not finish. Your dashboard is hidden. Retry to revoke the session and clear secure storage."
        : operation === "clear"
          ? "Your session is no longer valid. Retry clearing secure device storage."
          : "We could not restore your device session. Retry to keep your existing profile.");
    } finally { recoveryBusy.current = false; setLoading(false); }
  }, [controller]);

  useEffect(() => {
    let active = true;
    controller.restore(identity.me)
      .then((current) => { if (active) setProfile(current); })
      .catch((error) => {
        if (active && !(error instanceof SessionChangedError))
          setError("We could not restore your device session. Retry to keep your existing profile.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [controller]);

  const authenticated = useCallback(async <T,>(operation: (credential: string) => Promise<T>): Promise<T> => {
    try { return await controller.run(operation); }
    catch (error) {
      if ((error as { status?: number }).status === 401) {
        // Hide protected data immediately; cleanup never depends on a second network validation.
        setProfile(null);
        setLoading(true);
        setError(null);
        setRecovery("clear");
        try { await controller.invalidate(); }
        catch { setError("Your session is no longer valid. Retry clearing secure device storage."); }
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
    if (isDemo) return demoProfiles[demoRole];
    const current = await authenticated(identity.me);
    setProfile(current);
    return current;
  }, [authenticated, isDemo, demoProfiles, demoRole]);
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


  const demoClasses = useMemo(() => createDemoClassesApi(), [demoVersion]);
  const demoEnrollment = useMemo(() => createDemoEnrollmentApi(), [demoVersion]);
  const demoAssignments = useMemo(() => createDemoAssignmentApi(), [demoVersion]);
  const demoCapture = useMemo(() => createDemoCaptureApi(), [demoVersion]);
  const demoResults = useMemo(() => createDemoResultsApi(), [demoVersion]);
  const demoProgress = useMemo(() => createDemoProgressApi(), [demoVersion]);
  const demoMonitoring = useMemo(() => createDemoMonitoringApi(), [demoVersion]);
  const demoCommunication = useMemo(() => createDemoCommunicationApi(), [demoVersion]);
  const demoPathway = useMemo(() => createDemoPathwayApi(), [demoVersion]);
  const demoMaterials = useMemo(() => createDemoMaterialsApi(), [demoVersion]);
  const demoNotifications = useMemo(() => createDemoNotificationsApi(), [demoVersion]);
  const demoPronunciation = useMemo(() => createDemoPronunciationApi(), [demoVersion]);
  const demoConversation = useMemo(() => createDemoConversationApi(), [demoVersion]);
  const demoResearch = useMemo(() => createDemoResearchApi(), [demoVersion]);
  const demoLanguage = demoProfiles[demoRole].language;
  const demoPractice = useMemo(() => createDemoPracticeApi(demoLanguage ?? "tagalog"), [demoLanguage]);


  const activeProfile = isDemo ? demoProfiles[demoRole] : profile;
  const classes = isDemo ? demoClasses : liveClasses;
  const enrollment = isDemo ? demoEnrollment : liveEnrollment;
  const assignments = isDemo ? demoAssignments : liveAssignments;
  const capture = isDemo ? demoCapture : liveCapture;
  const results = isDemo ? demoResults : liveResults;
  const progress = isDemo ? demoProgress : liveProgress;
  const monitoring = isDemo ? demoMonitoring : liveMonitoring;
  const communication = isDemo ? demoCommunication : liveCommunication;
  const pathway = isDemo ? demoPathway : livePathway;
  const materials = isDemo ? demoMaterials : liveMaterials;
  const notifications = isDemo ? demoNotifications : liveNotifications;
  const pronunciation = isDemo ? demoPronunciation : livePronunciation;
  const conversation = isDemo ? demoConversation : liveConversation;
  const research = isDemo ? demoResearch : liveResearch;
  const practice = isDemo ? demoPractice : livePractice;

  const switchDemoRole = useCallback((role: DemoRole) => {
    setIsDemo(true);
    setDemoRole(role);
    setError(null);
  }, []);

  const resetDemoData = useCallback(() => {
    demoExperience.current = { tagalog: "some_words" };
    demoStore.reset();
    setDemoProfiles({ ...DEMO_PROFILES });
    setDemoVersion((v) => v + 1);
  }, []);

  return <Context.Provider value={{
    profile: activeProfile, classes, enrollment, assignments, capture, results, progress, monitoring, communication, pathway, materials, notifications, pronunciation, conversation, research, practice, refreshProfile, loading, error, recovery, pending,
    isDemo,
    demoRole,
    setDemoMode: setIsDemo,
    switchDemoRole,
    resetDemoData,
    retry: () => void recover(recovery),
    logout: () => {
      if (isDemo) {
        setIsDemo(false);
        setProfile(null);
        return;
      }
      void recover("logout");
    },
    create: async (username, role, preview = false, password?: string) => {
      if (preview || isDemo) {
        setIsDemo(true);
        const canon = username.toLowerCase();
        if (role === "instructor") {
          setDemoProfiles((prev) => ({
            ...prev,
            instructor: { ...prev.instructor, username, canonical_username: canon },
          }));
          setDemoRole("instructor");
        } else if (role === "school_student") {
          setDemoProfiles((prev) => ({
            ...prev,
            student: { ...prev.student, username, canonical_username: canon },
          }));
          setDemoRole("student");
        } else {
          setDemoProfiles((prev) => ({
            ...prev,
            personal: { ...prev.personal, username, canonical_username: canon },
          }));
          setDemoRole("personal");
        }
        return;
      }
      try { setProfile(await controller.create(() => identity.create(username, role, password))); }
      finally { setPending(controller.pending !== null); }
    },
    login: async (username: string, password: string) => {
      setIsDemo(false);
      try {
        setProfile(await controller.login(() => identity.login(username, password)));
      } finally {
        setPending(controller.pending !== null);
      }
    },
    save: async (settings) => {
      if (isDemo) {
        const language = settings.language ?? demoProfiles.personal.language;
        if (settings.experience && language) demoExperience.current[language] = settings.experience;
        setDemoProfiles((prev) => ({
          ...prev,
          personal: {
            ...prev.personal,
            ...settings,
            experience: language ? demoExperience.current[language] ?? null : null,
          },
        }));
        return;
      }
      setProfile(await authenticated((secret) => identity.preferences(secret, settings)));
    },
  }}>{children}</Context.Provider>;
}
export function useSession() {
  const session = useContext(Context);
  if (!session) throw new Error("Session provider missing");
  return session;
}
