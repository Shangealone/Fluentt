import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

function access(response, status = 200) {
  const source = fs.readFileSync(new URL("../src/services/api/vocabulary.ts", import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} }, calls = [];
  class ApiError extends Error { constructor(status, message) { super(message); this.status = status; } }
  new Function("require", "module", "exports", code)(() => ({ ApiError, request: async (...args) => {
    calls.push(args); if (status !== 200) throw new ApiError(status, "Unavailable"); return response;
  } }), module, module.exports);
  return { api: module.exports.vocabularyAccess(operation => operation("synthetic-session")), calls };
}

test("disabled test studies hide without authorizing an experiment", async () => {
  const f = access(null, 404);
  assert.deepEqual(await f.api.parallelStudies(), { items: [], development_only: false });
});

test("draft requires public-only questions and development provenance", async () => {
  const draft = { id: "attempt", status: "draft", revision: 1, development_only: true, responses: {},
    cards: [{ response_id: "item", format: "typed_recall", prompt: "Synthetic prompt", options: [] }] };
  assert.equal((await access(draft).api.parallelAttempt("study", "attempt")).status, "draft");
  await assert.rejects(access({ ...draft, development_only: false }).api.parallelAttempt("study", "attempt"));
  await assert.rejects(access({ ...draft, cards: [{ ...draft.cards[0], accepted_forms: ["secret"] }] }).api.parallelAttempt("study", "attempt"));
});

test("submission retains request body and authenticated scope", async () => {
  const receipt = { id: "attempt", status: "completed", revision: 2, development_only: true,
    submitted_at: "2026-11-01T00:00:00Z", result: { points: 1, maximum: 1, scheduler: null } };
  const f = access(receipt);
  const body = { responses: { item: "a" }, ratings: {}, expected_revision: 1, request_id: "frozen-request" };
  await f.api.parallelWrite("study", "attempt", "submit", body);
  assert.equal(f.calls[0][0], "/me/parallel-test/studies/study/attempts/attempt/submit");
  assert.equal(f.calls[0][2], body);
  assert.equal(f.calls[0][3], "synthetic-session");
  await assert.rejects(access({ ...receipt, result: { points: 500, maximum: 1 } }).api.parallelAttempt("study", "attempt"));
});
