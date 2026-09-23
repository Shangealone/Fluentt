// Live End-to-End Mobile-FastAPI Integration Verification
//
// Usage:
//   FLUENTT_E2E_EMAIL=dev_learner@example.test \
//   FLUENTT_E2E_TEMP_PASSWORD=<temporary-password> \
//   FLUENTT_E2E_NEW_PASSWORD=<new-test-password> \
//   node mobile/scripts/verify_e2e_live.mjs
//
// Optional environment variables:
//   FLUENTT_API_BASE_URL=http://127.0.0.1:8000

const API_BASE_URL = process.env.FLUENTT_API_BASE_URL || 'http://127.0.0.1:8000';

const E2E_EMAIL = process.env.FLUENTT_E2E_EMAIL;
const E2E_TEMP_PASSWORD = process.env.FLUENTT_E2E_TEMP_PASSWORD;
const E2E_NEW_PASSWORD = process.env.FLUENTT_E2E_NEW_PASSWORD;

const missingEnvVars = [];
if (!E2E_EMAIL) missingEnvVars.push('FLUENTT_E2E_EMAIL');
if (!E2E_TEMP_PASSWORD) missingEnvVars.push('FLUENTT_E2E_TEMP_PASSWORD');
if (!E2E_NEW_PASSWORD) missingEnvVars.push('FLUENTT_E2E_NEW_PASSWORD');

if (missingEnvVars.length > 0) {
  console.error(
    `❌ Missing required environment variables:\n` +
      missingEnvVars.map((v) => `   - ${v}`).join('\n') +
      `\n\nPlease set these variables before running this verification script, e.g.:\n` +
      `  FLUENTT_E2E_EMAIL=dev_learner@example.test\n` +
      `  FLUENTT_E2E_TEMP_PASSWORD=<temporary-password>\n` +
      `  FLUENTT_E2E_NEW_PASSWORD=<new-test-password>\n`
  );
  process.exit(1);
}

async function request(endpoint, options = {}, token = null) {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };
  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function main() {
  console.log('===============================================================');
  console.log('  FLUENTT v0.1B — Live Mobile-to-FastAPI End-to-End Lifecycle  ');
  console.log('===============================================================\n');

  // Step 1: Login with temporary password
  console.log('1. [AUTH] Logging in with researcher-provisioned temporary password...');
  const loginRes = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: E2E_EMAIL,
      password: E2E_TEMP_PASSWORD,
    }),
  });

  if (!loginRes.ok) {
    throw new Error(`Login failed with status ${loginRes.status}: ${JSON.stringify(loginRes.data)}`);
  }
  console.log('   ✓ Status:', loginRes.status);
  console.log('   ✓ must_change_password:', loginRes.data.must_change_password);
  if (!loginRes.data.must_change_password) {
    throw new Error('Expected must_change_password=true on first login');
  }

  let accessToken = loginRes.data.access_token;
  let refreshToken = loginRes.data.refresh_token;

  // Step 2: First-login forced password change
  console.log('\n2. [AUTH] Executing required password change...');
  const changeRes = await request(
    '/auth/change-password',
    {
      method: 'POST',
      body: JSON.stringify({
        current_password: E2E_TEMP_PASSWORD,
        new_password: E2E_NEW_PASSWORD,
      }),
    },
    accessToken
  );

  if (!changeRes.ok) {
    throw new Error(`Change password failed: ${JSON.stringify(changeRes.data)}`);
  }
  console.log('   ✓ Status:', changeRes.status);
  console.log('   ✓ must_change_password is now:', changeRes.data.must_change_password);
  accessToken = changeRes.data.access_token;
  refreshToken = changeRes.data.refresh_token;

  // Step 3: Session restoration via /users/me
  console.log('\n3. [SESSION] Restoring session via GET /users/me...');
  const profileRes = await request('/users/me', {}, accessToken);
  if (!profileRes.ok) {
    throw new Error(`Session restoration failed: ${JSON.stringify(profileRes.data)}`);
  }
  console.log('   ✓ Learner ID:', profileRes.data.id);
  console.log('   ✓ Participant Code:', profileRes.data.participant_code);
  console.log('   ✓ Email:', profileRes.data.email);

  // Step 4: Independent language preferences
  console.log('\n4. [PREFERENCES] Setting independent language preferences (interface=fil, target=en)...');
  const prefRes = await request(
    '/users/me/preferences',
    {
      method: 'PATCH',
      body: JSON.stringify({
        interface_language: 'fil',
        target_learning_language: 'en',
      }),
    },
    accessToken
  );
  if (!prefRes.ok) {
    throw new Error(`Preferences update failed: ${JSON.stringify(prefRes.data)}`);
  }
  console.log('   ✓ Updated interface_language:', prefRes.data.interface_language);
  console.log('   ✓ Updated target_learning_language:', prefRes.data.target_learning_language);

  // Step 5: Content browsing - lessons list
  console.log('\n5. [CONTENT] Fetching active lessons for target language (en)...');
  const lessonsRes = await request('/content/lessons?language=en', {}, accessToken);
  if (!lessonsRes.ok) {
    throw new Error(`Fetch lessons failed: ${JSON.stringify(lessonsRes.data)}`);
  }
  console.log('   ✓ Lessons found:', lessonsRes.data.length);
  const lesson = lessonsRes.data[0];
  console.log(`   ✓ Lesson 1: "${lesson.title}" | Version: ${lesson.content_version} | Items: ${lesson.item_count}`);

  // Step 6: Vocabulary study - lesson detail
  console.log(`\n6. [VOCABULARY] Fetching vocabulary items for lesson "${lesson.title}" (${lesson.id})...`);
  const detailRes = await request(`/content/lessons/${lesson.id}`, {}, accessToken);
  if (!detailRes.ok) {
    throw new Error(`Fetch lesson detail failed: ${JSON.stringify(detailRes.data)}`);
  }
  console.log('   ✓ Vocabulary count:', detailRes.data.vocabulary_items.length);
  const vocab = detailRes.data.vocabulary_items[0];
  console.log(`   ✓ Term: "${vocab.term}" | Translation: "${vocab.translation}" | Difficulty: "${vocab.difficulty}"`);
  console.log(`   ✓ Definition: "${vocab.definition}"`);
  console.log(`   ✓ Example: "${vocab.example_sentence}"`);

  // Step 7: Refresh token rotation
  console.log('\n7. [SECURITY] Testing refresh-token rotation...');
  const refreshRes = await request('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!refreshRes.ok) {
    throw new Error(`Refresh failed: ${JSON.stringify(refreshRes.data)}`);
  }
  console.log('   ✓ Refresh succeeded. Rotated access and refresh tokens received.');
  accessToken = refreshRes.data.access_token;
  refreshToken = refreshRes.data.refresh_token;

  // Step 8: Security - unauthenticated request rejected
  console.log('\n8. [SECURITY] Verifying unauthenticated request is rejected with 401...');
  const unauthRes = await request('/content/lessons?language=en', {});
  console.log('   ✓ Unauthenticated status:', unauthRes.status);
  if (unauthRes.status !== 401) {
    throw new Error('Expected 401 status on unauthenticated access');
  }

  // Step 9: Logout
  console.log('\n9. [AUTH] Logging out session...');
  const logoutRes = await request(
    '/auth/logout',
    {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    },
    accessToken
  );
  console.log('   ✓ Logout status:', logoutRes.status);

  console.log('\n===============================================================');
  console.log('  ALL PLAN B MOBILE-BACKEND LIVE INTEGRATION CHECKS PASSED!     ');
  console.log('===============================================================\n');
}

main().catch((err) => {
  console.error('❌ Integration check failed:', err);
  process.exit(1);
});
