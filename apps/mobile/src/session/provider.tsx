import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from "react";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { identity, type Profile, type Role, type PreferenceSettings } from "../services/api/identity";
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
  demoStore,
} from "../demo/demoData";

const vault = secureVault(SecureStore, Platform.OS);
type Recovery = "restore" | "logout" | "clear";
export type DemoRole = "instructor" | "student" | "personal";

type Session = {
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  recovery: Recovery;
  retry: () => void;
  create: (username: string, role: Role, preview?: boolean) => Promise<void>;
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

  const demoClasses = useMemo(() => createDemoClassesApi(), [demoVersion]);
  const demoEnrollment = useMemo(() => createDemoEnrollmentApi(), [demoVersion]);
  const demoAssignments = useMemo(() => createDemoAssignmentApi(), [demoVersion]);
  const demoCapture = useMemo(() => createDemoCaptureApi(), [demoVersion]);
  const demoResults = useMemo(() => createDemoResultsApi(), [demoVersion]);
  const demoProgress = useMemo(() => createDemoProgressApi(), [demoVersion]);
  const demoMonitoring = useMemo(() => createDemoMonitoringApi(), [demoVersion]);
  const demoCommunication = useMemo(() => createDemoCommunicationApi(), [demoVersion]);

  const activeProfile = isDemo ? demoProfiles[demoRole] : profile;
  const classes = isDemo ? demoClasses : liveClasses;
  const enrollment = isDemo ? demoEnrollment : liveEnrollment;
  const assignments = isDemo ? demoAssignments : liveAssignments;
  const capture = isDemo ? demoCapture : liveCapture;
  const results = isDemo ? demoResults : liveResults;
  const progress = isDemo ? demoProgress : liveProgress;
  const monitoring = isDemo ? demoMonitoring : liveMonitoring;
  const communication = isDemo ? demoCommunication : liveCommunication;

  const switchDemoRole = useCallback((role: DemoRole) => {
    setIsDemo(true);
    setDemoRole(role);
    setError(null);
  }, []);

  const resetDemoData = useCallback(() => {
    demoStore.reset();
    setDemoProfiles({ ...DEMO_PROFILES });
    setDemoVersion((v) => v + 1);
  }, []);

  return <Context.Provider value={{
    profile: activeProfile, classes, enrollment, assignments, capture, results, progress, monitoring, communication, refreshProfile, loading, error, recovery, pending,
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
    create: async (username, role, preview = false) => {
      if (preview || isDemo || Platform.OS === "web") {
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
      try { setProfile(await controller.create(() => identity.create(username, role))); }
      finally { setPending(controller.pending !== null); }
    },
    save: async (settings) => {
      if (isDemo) {
        setDemoProfiles((prev) => ({
          ...prev,
          personal: {
            ...prev.personal,
            ...settings,
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
