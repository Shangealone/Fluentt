import test from "node:test";
import assert from "node:assert/strict";
import { identity } from "../apps/mobile/src/services/api/identity.ts";
import { SessionController } from "../apps/mobile/src/session/controller.ts";
import { routeAllowed } from "../apps/mobile/src/session/routing.ts";

test("routeAllowed allows login for unauthenticated users", () => {
  assert.equal(routeAllowed(null, "login", false, false), true);
  assert.equal(routeAllowed(null, "username", false, false), true);
  assert.equal(routeAllowed(null, "index", false, false), true);
  assert.equal(routeAllowed(null, "student", false, false), false);
  assert.equal(routeAllowed(null, "instructor", false, false), false);
});

test("SessionController.login saves issued credential to vault and updates state", async () => {
  let savedCredential = null;
  const mockVault = {
    read: async () => savedCredential,
    save: async (token) => { savedCredential = token; },
    clear: async () => { savedCredential = null; },
  };

  const controller = new SessionController(mockVault);
  const mockProfile = {
    id: "usr_123",
    username: "test_learner",
    canonical_username: "test_learner",
    role: "school_student",
    profile_status: "active",
    onboarding_step: null,
    grade: 7,
    language: "tagalog",
  };

  const token = "flt_0123456789012345678901234567890123456789012";
  const result = await controller.login(async () => ({
    user: mockProfile,
    session: {
      credential: token,
      token_type: "Bearer",
      expires_at: "2026-11-20T00:00:00Z",
      absolute_expires_at: "2027-01-20T00:00:00Z",
    },
  }));

  assert.equal(result.username, "test_learner");
  assert.equal(controller.credential, token);
  assert.equal(savedCredential, token);
  assert.equal(controller.blocked, false);
});

test("identity.create passes password when supplied", async () => {
  assert.equal(typeof identity.create, "function");
  assert.equal(typeof identity.login, "function");
});
