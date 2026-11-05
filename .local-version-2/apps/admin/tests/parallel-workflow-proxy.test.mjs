import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

function handler() {
  const source = fs.readFileSync(new URL("../src/app/api/admin/parallel-test/[id]/[action]/route.ts", import.meta.url), "utf8");
  const fixtureModule = { exports: {} }, calls = [];
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const deps = {
    "next/server": {}, "@/services/admin-server": { webOrigin: () => "http://localhost:3000", backend: async (...args) => { calls.push(args); return Response.json({ status: "synthetic-only" }); } },
    "@/services/research-routing": { uuid: /^[0-9a-f-]{36}$/, boundedText: async body => new Response(body).text() },
  };
  new Function("require", "module", "exports", code)(name => deps[name], fixtureModule, fixtureModule.exports);
  return { post: fixtureModule.exports.POST, calls };
}

test("test setup proxy restricts paths and protects Origin/CSRF", async () => {
  const f = handler(), id = "a".repeat(36);
  const request = (headers = {}) => new Request("http://localhost:3000/api/admin/parallel-test/x/configure", {
    method: "POST", headers: { Origin: "http://localhost:3000", "Content-Type": "application/json", "X-CSRF-Token": "a".repeat(43), ...headers }, body: "{}" });
  const context = action => ({ params: Promise.resolve({ id, action }) });
  assert.equal((await f.post(request(), context("delete"))).status, 404);
  assert.equal((await f.post(request({ Origin: "https://other.example" }), context("configure"))).status, 403);
  assert.equal((await f.post(request({ "X-CSRF-Token": "bad" }), context("configure"))).status, 403);
  assert.equal(f.calls.length, 0);
  assert.equal((await f.post(request(), context("configure"))).status, 200);
  assert.equal(f.calls[0][0], `/parallel-studies/${id}/test-workflow`);
  assert.equal(f.calls[0][1].headers.Authorization, undefined);
});
