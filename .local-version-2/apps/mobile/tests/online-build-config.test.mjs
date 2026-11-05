import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const configure = require("../app.config.js");
const config = require("../app.json").expo;

test("default build preserves the existing app identity and plugins", () => {
  const previous = process.env.FLUENTT_BUILD_VARIANT;
  delete process.env.FLUENTT_BUILD_VARIANT;
  try { assert.equal(configure({ config }), config); }
  finally {
    if (previous === undefined) delete process.env.FLUENTT_BUILD_VARIANT;
    else process.env.FLUENTT_BUILD_VARIANT = previous;
  }
});

test("online Android build refuses a local or missing backend and keeps a distinct identity", () => {
  const variant = process.env.FLUENTT_BUILD_VARIANT;
  const endpoint = process.env.EXPO_PUBLIC_ANDROID_API_URL;
  process.env.FLUENTT_BUILD_VARIANT = "online-demo";
  try {
    for (const wrong of ["", "http://localhost:8004", "https://fluentt-synthetic-staging.onrender.com"]) {
      process.env.EXPO_PUBLIC_ANDROID_API_URL = wrong;
      assert.throws(() => configure({ config }), /verified HTTPS/);
    }
    process.env.EXPO_PUBLIC_ANDROID_API_URL = "https://fluentt-team-demo.onrender.com";
    const online = configure({ config });
    assert.notEqual(online.android.package, config.android.package);
    assert.equal(online.android.package, "com.shangealone.fluentt.classlearning");
    assert.equal(online.android.versionCode, 9);
    assert.deepEqual(online.plugins, config.plugins);
    assert.deepEqual(online.android.permissions, config.android.permissions);
  } finally {
    if (variant === undefined) delete process.env.FLUENTT_BUILD_VARIANT;
    else process.env.FLUENTT_BUILD_VARIANT = variant;
    if (endpoint === undefined) delete process.env.EXPO_PUBLIC_ANDROID_API_URL;
    else process.env.EXPO_PUBLIC_ANDROID_API_URL = endpoint;
  }
});
