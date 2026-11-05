import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

function access(value) {
  let called = 0;
  const source = fs.readFileSync(new URL("../src/services/api/vocabulary.ts", import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  class ApiError extends Error { constructor(status, message) { super(message); this.status = status; } }
  new Function("require", "module", "exports", code)(() => ({ ApiError, request: async (path, method, body, auth) => {
    assert.equal(path, "/me/parallel-study/status"); assert.equal(method, "GET"); assert.equal(auth, "test-session");
    return value;
  } }), module, module.exports);
  return { api: module.exports.vocabularyAccess(operation => { called++; return operation("test-session"); }), count: () => called };
}

test("parallel status uses authenticated session wrapper and accepts inactive only", async () => {
  const fixture = access({ status: "inactive", participation_enabled: false });
  assert.equal((await fixture.api.parallelStatus()).status, "inactive");
  assert.equal(fixture.count(), 1);
});

test("unexpected activation cannot become a student participation state", async () => {
  for (const value of [{ status: "active", participation_enabled: true }, {}, null]) {
    await assert.rejects(access(value).api.parallelStatus());
  }
});
