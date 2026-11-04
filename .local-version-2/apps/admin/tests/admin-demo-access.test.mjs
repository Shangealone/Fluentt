import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import ts from "typescript";

const admin = path.resolve(import.meta.dirname, "..");
function load(relative, dependencies = {}) {
  const source = fs.readFileSync(path.join(admin, relative), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const compiled = { exports: {} };
  new Function("require", "module", "exports", code)((name) => {
    if (name in dependencies) return dependencies[name];
    throw new Error(`Unexpected dependency: ${name}`);
  }, compiled, compiled.exports);
  return compiled.exports;
}

test("demonstration access requires explicit development opt-in", () => {
  const { adminDemoEnabled } = load("src/services/admin-demo-access.ts");
  const originalMode = process.env.NODE_ENV;
  const originalFlag = process.env.FLUENTT_ENABLE_ADMIN_DEMO;
  try {
    for (const mode of ["development", "production", "test", undefined]) {
      for (const flag of ["1", "0", "true", undefined]) {
        if (mode === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = mode;
        if (flag === undefined) delete process.env.FLUENTT_ENABLE_ADMIN_DEMO; else process.env.FLUENTT_ENABLE_ADMIN_DEMO = flag;
        assert.equal(adminDemoEnabled(), mode === "development" && flag === "1", `${mode}/${flag}`);
      }
    }
  } finally {
    if (originalMode === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = originalMode;
    if (originalFlag === undefined) delete process.env.FLUENTT_ENABLE_ADMIN_DEMO; else process.env.FLUENTT_ENABLE_ADMIN_DEMO = originalFlag;
  }
});

test("disabled demo rejects login without a cookie and ignores a forged demo session", async () => {
  let upstreamCalls = 0;
  const routes = load("src/app/api/admin/[action]/route.ts", {
    "next/server": {},
    "@/services/admin-demo-access": { adminDemoEnabled: () => false },
    "@/services/admin-server": {
      adminCookieNames: () => ["fluentt_admin"], webOrigin: () => "http://localhost:3000",
      backend: async () => { upstreamCalls++; return Response.json({ error: { message: "Sign in" } }, { status: 401 }); },
    },
    "@/services/admin-demo": { DEMO_ADMIN_COOKIE: "fluentt_demo_admin", DEMO_ADMIN_PROFILE: { username: "sample" } },
  });
  const request = { method: "POST", headers: new Headers(), cookies: { get: () => ({ value: "1" }) } };
  const login = await routes.POST(request, { params: Promise.resolve({ action: "demo-login" }) });
  assert.equal(login.status, 404);
  assert.equal(login.headers.get("set-cookie"), null);
  request.method = "GET";
  const profile = await routes.GET(request, { params: Promise.resolve({ action: "me" }) });
  assert.equal(profile.status, 401);
  assert.equal(upstreamCalls, 1);
  assert.equal((await profile.json()).username, undefined);
});

test("forged demo cookies cannot select sample curriculum, question or research responses", async () => {
  for (const [relative, segments] of [
    ["src/app/api/admin/curriculum/[...segments]/route.ts", ["versions"]],
    ["src/app/api/admin/questions/[[...segments]]/route.ts", []],
    ["src/app/api/admin/research/[[...segments]]/route.ts", ["studies"]],
  ]) {
    let upstreamCalls = 0;
    const routes = load(relative, {
      "next/server": {},
      "@/services/admin-demo-access": { adminDemoEnabled: () => false },
      "@/services/admin-demo": {},
      "@/services/research-proxy": {},
      "@/services/admin-server": {
        adminCookieNames: () => ["fluentt_admin"], webOrigin: () => "http://localhost:3000",
        backend: async () => { upstreamCalls++; return Response.json({}, { status: 401 }); },
      },
    });
    const request = { method: "GET", nextUrl: new URL("http://localhost:3000"), headers: new Headers(), cookies: { get: () => ({ value: "1" }) } };
    const response = await routes.GET(request, { params: Promise.resolve({ segments }) });
    assert.equal(response.status, 401, relative);
    assert.equal(upstreamCalls, 1, relative);
  }
});

test("forged demo cookie cannot bypass requireAdmin backend verification", async () => {
  const originalFetch = globalThis.fetch;
  let upstreamCalls = 0;
  try {
    globalThis.fetch = async () => { upstreamCalls++; return Response.json({}, { status: 401 }); };
    const service = load("src/services/admin-server.ts", {
      "server-only": {},
      "next/headers": { cookies: async () => ({ get: (name) => name === "fluentt_demo_admin" ? { value: "1" } : undefined }) },
      "next/navigation": { redirect: (url) => { throw new Error(`redirect:${url}`); } },
      "next/server": { connection: async () => {} },
      "./admin-contract": { isAdminProfile: () => false },
      "./admin-demo-access": { adminDemoEnabled: () => false },
      "./admin-demo": { DEMO_ADMIN_COOKIE: "fluentt_demo_admin", DEMO_ADMIN_PROFILE: { username: "sample" } },
    });
    await assert.rejects(service.requireAdmin(), /redirect:\/login\?expired=1/);
    assert.equal(upstreamCalls, 1);
  } finally { globalThis.fetch = originalFetch; }
});
