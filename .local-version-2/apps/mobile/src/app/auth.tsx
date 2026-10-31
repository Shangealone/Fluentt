import { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler } from "react-native";
import { router, useFocusEffect, useLocalSearchParams, usePreventRemove } from "expo-router";
import { AuthScreenView, type AuthErrors, type AuthFields } from "../features/auth/AuthScreenView";
import { authRoles } from "../features/auth/AuthArtwork";
import { useSession } from "../session/provider";
import { destination, usernameError } from "../session/routing";
import { ApiError, type Role } from "../services/api/identity";
import type { ClassPreview } from "../services/api/enrollment";

type Mode = "signin" | "create";
const emptyFields: AuthFields = { username: "", password: "", confirmation: "", classCode: "" };

export default function Auth() {
  const params = useLocalSearchParams<{ mode?: string; role?: string }>();
  const initialMode = params.mode === "create" ? "create" : "signin";
  const initialRole = authRoles.find(value => value.value === params.role)?.value ?? "personal_student";
  return <AuthForm initialMode={initialMode} initialRole={initialRole} />;
}

function AuthForm({ initialMode, initialRole }: { initialMode: Mode; initialRole: Role }) {
  const session = useSession();
  const sessionRef = useRef(session); sessionRef.current = session;
  const [mode, setMode] = useState<Mode>(initialMode), [step, setStep] = useState<"type" | "account">("type"), [role, setRole] = useState<Role>(initialRole);
  const [fields, setFields] = useState<AuthFields>(emptyFields), [errors, setErrors] = useState<AuthErrors>({});
  const [preview, setPreview] = useState<{ code: string; data: ClassPreview } | null>(null);
  const [operation, setOperation] = useState<"auth" | "class" | null>(null), [error, setError] = useState(""), [uncertain, setUncertain] = useState(false);
  const [focusKey, setFocusKey] = useState(0), [visibilityReset, setVisibilityReset] = useState(0);
  const active = useRef(false), generation = useRef(0), lock = useRef(false), allowExit = useRef(false);
  const incoming = useRef({ mode: initialMode, role: initialRole });
  const operationRef = useRef<"auth" | "class" | null>(null), backRef = useRef<() => void>(() => {});
  const classPreview = preview?.code === fields.classCode ? preview.data : null;
  const locked = () => lock.current || sessionRef.current.pending;

  // Param updates do not remove the route. Defer them instead of replacing a form with an active operation.
  useEffect(() => {
    if (incoming.current.mode === initialMode && incoming.current.role === initialRole) return;
    if (lock.current || session.pending) return;
    incoming.current = { mode: initialMode, role: initialRole };
    setMode(initialMode); setRole(initialRole); setStep("type"); setPreview(null); setErrors({});
    setFields(value => ({ ...value, password: "", confirmation: "", classCode: "" }));
    if (initialMode === "signin") setUncertain(false);
    if (initialMode === "signin" || !uncertain) setError("");
    setVisibilityReset(value => value + 1); setFocusKey(value => value + 1);
  }, [initialMode, initialRole, operation, session.pending, uncertain]);

  useFocusEffect(useCallback(() => {
    active.current = true; setOperation(operationRef.current);
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => { backRef.current(); return true; });
    return () => {
      active.current = false; generation.current += 1; subscription.remove();
      setFields(value => ({ ...value, password: "", confirmation: "" })); setVisibilityReset(value => value + 1);
    };
  }, []));
  useEffect(() => {
    if (!session.pending) return;
    setFields(value => ({ ...value, password: "", confirmation: "" })); setVisibilityReset(value => value + 1); setUncertain(false); setErrors({});
  }, [session.pending]);
  usePreventRemove((!!operation || session.pending) && !session.profile, ({ repeat }) => {
    if (allowExit.current || sessionRef.current.profile) repeat();
  });

  function resetMessages() { if (!uncertain) setError(""); setErrors({}); }
  function back() {
    if (locked()) return;
    if (mode === "create" && step === "account") { setStep("type"); resetMessages(); setFocusKey(value => value + 1); }
    else router.replace("/");
  }
  backRef.current = back;
  function changeMode(next: Mode) {
    if (locked()) return;
    setMode(next); setStep("type"); resetMessages(); setError(""); setUncertain(false);
    setFields(value => ({ ...value, password: "", confirmation: "" })); setVisibilityReset(value => value + 1); setFocusKey(value => value + 1);
  }
  function changeRole(next: Role) {
    if (locked() || next === role) return;
    setRole(next); setFields(value => ({ ...value, classCode: "" })); setPreview(null); resetMessages(); setFocusKey(value => value + 1);
  }
  function change(field: keyof AuthFields, value: string) {
    if (locked()) return;
    const next = field === "classCode" ? value.replace(/[^0-9]/g, "").slice(0, 6) : value;
    setFields(current => ({ ...current, [field]: next })); setErrors(current => ({ ...current, [field]: "" }));
    if (field === "classCode") { setPreview(null); if (!uncertain) setError(""); }
  }
  function nextStep() {
    if (locked()) return;
    if (role === "school_student" && !classPreview) { setErrors({ classCode: "Check your class code before continuing." }); setFocusKey(value => value + 1); return; }
    resetMessages(); setStep("account"); setFocusKey(value => value + 1);
  }
  async function checkClass() {
    if (locked() || !active.current || mode !== "create" || role !== "school_student") return;
    if (!/^[0-9]{6}$/.test(fields.classCode)) { setErrors({ classCode: "Enter the six-digit code from your teacher." }); setFocusKey(value => value + 1); return; }
    const code = fields.classCode, request = generation.current;
    lock.current = true; operationRef.current = "class"; setOperation("class"); setPreview(null); resetMessages();
    try {
      const data = await sessionRef.current.registrationPreview(code);
      if (active.current && generation.current === request) setPreview({ code, data });
    } catch (cause) {
      if (active.current && generation.current === request) { setErrors({ classCode: cause instanceof Error ? cause.message : "We could not check that class code. Please try again." }); setFocusKey(value => value + 1); }
    } finally { lock.current = false; operationRef.current = null; if (active.current) setOperation(null); }
  }
  async function submit() {
    if (lock.current || !active.current) return;
    const currentSession = sessionRef.current, creating = mode === "create";
    if (!currentSession.pending) {
      if (creating && (step !== "account" || (role === "school_student" && !classPreview))) { setStep("type"); setErrors({ classCode: "Check your class code before creating your account." }); setFocusKey(value => value + 1); return; }
      if (creating && uncertain) return;
      const validation: AuthErrors = {};
      const invalid = creating ? usernameError(fields.username) : !fields.username.trim() ? "Enter your username." : null;
      if (invalid) validation.username = invalid;
      const length = Array.from(fields.password).length;
      if (length < (creating ? 6 : 1) || length > 128) validation.password = creating ? "Choose a password with 6–128 characters." : "Enter your password.";
      if (creating && fields.password !== fields.confirmation) validation.confirmation = "Your passwords don’t match.";
      setErrors(validation);
      if (Object.keys(validation).length) { setFocusKey(value => value + 1); return; }
    }
    const request = generation.current;
    lock.current = true; operationRef.current = "auth"; allowExit.current = false; setOperation("auth"); setError("");
    try {
      const classDetails = creating && role === "school_student" && classPreview ? { code: fields.classCode, class_version: classPreview.class_version } : undefined;
      // The session controller retries retained issuance when pending; it never creates a second account for recovery.
      const profile = creating ? await currentSession.create(fields.username, role, fields.password, classDetails) : await currentSession.login(fields.username.trim(), fields.password);
      if (active.current && request === generation.current) {
        setFields(value => ({ ...value, password: "", confirmation: "" })); setVisibilityReset(value => value + 1);
        allowExit.current = true; router.replace(destination(profile));
      }
    } catch (cause) {
      if (active.current && request === generation.current) {
        const usernameTaken = creating && cause instanceof ApiError && cause.status === 409 && cause.message === "This username is already taken.";
        if (usernameTaken) setErrors({ username: cause.message });
        if (creating && role === "school_student" && cause instanceof ApiError && (cause.status === 404 || cause.message === "Class details changed. Verify the code and review again.")) {
          setPreview(null); setStep("type"); setErrors({ classCode: cause.message });
        }
        const message = cause instanceof Error ? cause.message : "We could not sign you in. Please try again.";
        const unknownCreation = creating && (cause as { status?: number } | null)?.status === 0 && !message.includes("did not keep the sign-in cookie");
        setUncertain(unknownCreation); setError(usernameTaken ? "" : unknownCreation ? `${message} Your account may already be saved. Try signing in before creating it again.` : message); setFocusKey(value => value + 1);
      }
    } finally { lock.current = false; operationRef.current = null; if (active.current) setOperation(null); }
  }

  return <AuthScreenView mode={mode} step={step} role={role} fields={fields} errors={errors} preview={classPreview} operation={operation}
    pending={session.pending} uncertain={uncertain} error={error} focusKey={focusKey} visibilityReset={visibilityReset}
    onChange={change} onMode={changeMode} onRole={changeRole} onCheck={() => { void checkClass(); }} onNext={nextStep} onSubmit={() => { void submit(); }} onBack={back} />;
}
