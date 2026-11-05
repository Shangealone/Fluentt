import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";
import * as jsx from "react/jsx-runtime";

function load(file, dependencies) {
  const source = fs.readFileSync(new URL(file, import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const fixture = { exports: {} };
  new Function("require", "module", "exports", code)(name => {
    if (name === "react/jsx-runtime") return jsx;
    if (name.endsWith(".png") || name.endsWith(".jpg")) return name;
    assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
    return dependencies[name];
  }, fixture, fixture.exports);
  return fixture.exports;
}

function descendants(row) {
  if (row == null || typeof row === "boolean") return [];
  if (Array.isArray(row)) return row.flatMap(descendants);
  return typeof row === "object" ? [row, ...descendants(row.props?.children)] : [row];
}

test("Class Learning welcome button uses the version-5 authenticated school entry", () => {
  const pushes = [];
  const WelcomeScreen = load("../src/features/welcome/WelcomeScreen.tsx", {
    "react-native": { Image: "Image", Pressable: "Pressable", ScrollView: "ScrollView", View: "View",
      StyleSheet: { create: value => value, absoluteFill: {} } },
    "../../accessibility/Primitives": { Text: "Text", useWindowDimensions: () => ({ width: 390 }) },
    "react-native-safe-area-context": { SafeAreaView: "SafeAreaView" },
    "../../components/FluenttLogo": { FluenttLogo: "Logo" }, "../../components/PersonalIcon": { PersonalIcon: "Icon" },
    "../../theme/personal": { homeColors: {} },
  }).WelcomeScreen;
  const entry = load("../src/app/index.tsx", { "expo-router": { router: { push: path => pushes.push(path) } },
    "../features/welcome/WelcomeScreen": { WelcomeScreen } }).default();
  assert.equal(entry.props.onPersonal, undefined);
  const nodes = descendants(WelcomeScreen(entry.props));
  assert.ok(nodes.includes("Class Learning"));
  assert.ok(!nodes.includes("Learn on my own"));
  const button = nodes.find(node => node.props?.accessibilityLabel?.startsWith("Class Learning."));
  button.props.onPress();
  assert.deepEqual(pushes, ["/auth?mode=create&role=school_student"]);
  entry.props.onTeacher();
  entry.props.onSignIn();
  assert.deepEqual(pushes.slice(1), ["/auth?mode=create&role=instructor", "/auth?mode=signin"]);
});

test("school client does not advertise personal signup even when an older server offers it", async () => {
  for (const fails of [false, true]) {
    const updates = [];
    let cleanup;
    const hook = load("../src/features/auth/useRegistrationOptions.ts", {
      react: { useState: initial => [initial, value => updates.push(value)], useEffect: effect => { cleanup = effect(); } },
      "../../services/api/identity": { identity: { registrationOptions: () => fails
        ? Promise.reject(new Error("offline")) : Promise.resolve({ roles: ["personal_student", "school_student", "instructor"] }) } },
    }).useRegistrationOptions;
    assert.deepEqual(hook(), { personalLearnerEnabled: false, loading: true });
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(updates, [{ personalLearnerEnabled: false, loading: false }]);
    cleanup();
  }
});

test("school sign-in keeps the class dashboard and school-only lesson guards, preserving legacy personal accounts", () => {
  const route = load("../src/session/routing.ts", {});
  for (const role of ["school_student", "personal_student"]) {
    const profile = { id: "test-profile", role, profile_status: "active", language: "english", experience: "easy", has_password: true };
    const screen = load("../src/app/student.tsx", {
      "../session/provider": { useSession: () => ({ profile }) },
      "../features/dashboard/PersonalHome": { PersonalHome: "PersonalHome" },
      "../components/PersonalScreen": { PersonalScreen: "PersonalScreen" },
      "../features/dashboard/ClassroomHome": { ClassroomHome: "ClassroomHome" },
      "../features/dashboard/SchoolHomeScreen": { SchoolHomeScreen: "SchoolHomeScreen" },
    }).default();
    assert.equal(screen.type, role === "school_student" ? "SchoolHomeScreen" : "PersonalScreen");
    assert.equal(screen.props.children.type, role === "school_student" ? "ClassroomHome" : "PersonalHome");
    assert.equal(route.destination(profile), "/student");
    assert.equal(route.routeAllowed(profile, "class-lessons"), role === "school_student");
    assert.equal(route.routeAllowed(profile, "published-assignments"), role === "school_student");
    assert.equal(route.routeAllowed(profile, "pronunciation"), true);
  }
  assert.equal(route.routeAllowed(null, "class-lessons"), false);
});

test("version-5 teacher class form offers proficiency choices and no grade selector", () => {
  const changes = [];
  const levels = load("../src/services/api/classProficiency.ts", {});
  const view = load("../src/features/classes/CreateClassView.tsx", {
    react: { useState: value => [value, () => {}] },
    "react-native": { ActivityIndicator: "ActivityIndicator", Image: "Image", KeyboardAvoidingView: "KeyboardAvoidingView",
      Platform: { OS: "web" }, Pressable: "Pressable", ScrollView: "ScrollView", View: "View", StyleSheet: { create: value => value } },
    "../../accessibility/Primitives": { Text: "Text", TextInput: "TextInput", useWindowDimensions: () => ({ width: 390, fontScale: 1 }) },
    "react-native-safe-area-context": { SafeAreaView: "SafeAreaView" },
    "../../components/FluenttLogo": { FluenttLogo: "Logo" }, "../../components/PersonalIcon": { PersonalIcon: "Icon" },
    "../../theme/personal": { homeColors: {} }, "../../components/onboarding": { languages: ["english", "tagalog"] },
    "../../services/api/classProficiency": levels,
  }).CreateClassView;
  const fields = { class_name: "Synthetic class", proficiency_level: null, language: "english", description: "" };
  const nodes = descendants(view({ fields, operation: null, locked: false, error: "", onChange: value => changes.push(value) }));
  assert.ok(nodes.includes("Class proficiency level (optional)"));
  assert.deepEqual(nodes.filter(node => node.props?.accessibilityRole === "radiogroup").map(node => node.props.accessibilityLabel),
    ["Class proficiency level", "Learning language"]);
  assert.ok(!nodes.some(node => typeof node === "string" && /^Grade\s+\d+$/.test(node)));
  for (const level of ["Beginner", "Intermediate", "Advanced"]) {
    const option = nodes.find(node => node.props?.accessibilityRole === "radio" && node.props.accessibilityLabel === level);
    assert.ok(option, level);
    option.props.onPress();
  }
  assert.deepEqual(changes.map(row => row.proficiency_level), ["beginner", "intermediate", "advanced"]);
  assert.ok(changes.every(row => !("grade_level" in row)));
});
