// Real Next.js server + synthetic backend HTTP contract. Never a runtime auth bypass.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { resolve } from 'node:path';
import test from 'node:test';

const cookie = 's'.repeat(43);
const csrf = 'c'.repeat(43);
let mode = 'active';
let seenCookie = '';
let seenOrigin = '';
let permissions = ['dashboard.view'];
let seenMutation;
const api = createServer(async (req, res) => {
  seenCookie = req.headers.cookie ?? '';
  seenOrigin = req.headers.origin ?? '';
  res.setHeader('Content-Type', 'application/json');
  if (req.url === '/api/v1/admin/auth/config') return res.end('{"enabled":false}');
  if (req.url === '/api/v1/admin/auth/start') {
    res.writeHead(303, { Location: 'https://id.example/authorize',
      'Set-Cookie': `fluentt_oidc=${cookie}; HttpOnly; Path=/; SameSite=Lax` }); return res.end();
  }
  if (req.url?.startsWith('/api/v1/admin/auth/callback')) {
    res.writeHead(303, { Location: `${web}/dashboard`,
      'Set-Cookie': `fluentt_admin=${cookie}; HttpOnly; Path=/; SameSite=Lax` }); return res.end();
  }
  if (mode === 'offline') { res.writeHead(503); return res.end('{}'); }
  if (!seenCookie.includes(`fluentt_admin=${cookie}`) || mode === 'revoked') {
    res.writeHead(401); return res.end('{"error":{"message":"Sign in again"}}');
  }
  if (req.url?.startsWith('/api/v1/admin/curriculum/') || req.url?.startsWith('/api/v1/admin/questions')) {
    if (req.method !== 'GET') {
      let body = ''; for await (const chunk of req) body += chunk;
      seenMutation = { method: req.method, body, csrf: req.headers['x-csrf-token'], revision: req.headers['if-match'],
        authorization: req.headers.authorization, origin: req.headers.origin };
    }
    return res.end(JSON.stringify({ items: [{ id: 'synthetic-fixture', code: 'synthetic-curriculum',
      name: 'Synthetic curriculum fixture', status: 'draft', verification_status: 'unverified' }],
      limit: 50, offset: 0, has_more: false, class_context: null }));
  }
  if (req.method === 'DELETE') {
    if (req.headers['x-csrf-token'] !== csrf) { res.writeHead(403); return res.end('{}'); }
    mode = 'revoked';
    res.writeHead(204, { 'Set-Cookie': 'fluentt_admin=; Max-Age=0; HttpOnly; Path=/; SameSite=Lax' }); return res.end();
  }
  const now = Date.now();
  res.end(JSON.stringify({ username: 'SyntheticAdmin', role: 'administrator', permissions,
    csrf_token: csrf, expires_at: new Date(now + 1800000).toISOString(), absolute_expires_at: new Date(now + 28800000).toISOString() }));
});
api.listen(0, '127.0.0.1'); await once(api, 'listening');
const portProbe = createServer().listen(0, '127.0.0.1'); await once(portProbe, 'listening');
const port = portProbe.address().port; await new Promise(r => portProbe.close(r));
const web = `http://localhost:${port}`;
const admin = resolve('apps/admin');
const child = spawn(process.execPath, [resolve(admin, 'node_modules/next/dist/bin/next'), 'dev', '--port', String(port)], {
  cwd: admin, windowsHide: true, env: { ...process.env, NODE_ENV: 'development', NEXT_TELEMETRY_DISABLED: '1',
    FLUENTT_ADMIN_WEB_ORIGIN: web, FLUENTT_API_URL: `http://127.0.0.1:${api.address().port}` }, stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '';
for (const stream of [child.stdout, child.stderr]) stream.on('data', bytes => { output = (output + bytes).slice(-24000); });
const request = (path, init = {}) => fetch(web + path, { redirect: 'manual', ...init });
try {
  let ready = false;
  for (let attempt = 0; attempt < 90; attempt++) {
    try { ready = (await request('/api/admin/config')).ok; } catch {}
    if (ready) break;
    if (child.exitCode !== null) throw new Error('Next.js test server exited');
    await new Promise(r => setTimeout(r, 500));
  }
  assert(ready, `Next.js test server must start. Server output: ${output}`);
  await test('anonymous direct dashboard request contains no account data and redirects to login', async () => {
    const response = await request('/dashboard'); const html = await response.text();
    assert(!html.includes('SyntheticAdmin'));
    assert(html.includes('/login?expired=1') || response.headers.get('location')?.includes('/login'));
  });
  await test('login shows disabled provider state without a password field', async () => {
    const html = await (await request('/login')).text();
    assert(html.includes('Administrator sign-in is not configured'));
    assert(!html.includes('type="password"'));
  });
  await test('BFF denies cross-site start/logout and unsupported paths/methods', async () => {
    assert.equal((await request('/api/admin/start', { method: 'POST', headers: { Origin: 'https://attacker.example' } })).status, 403);
    assert.equal((await request('/api/admin/session', { method: 'DELETE' })).status, 403);
    assert.equal((await request('/api/admin/users')).status, 404);
    assert.equal((await request('/api/admin/start')).status, 404);
  });
  await test('BFF forwards only admin cookies and authenticated dashboard is server rendered', async () => {
    const response = await request('/dashboard', { headers: { Cookie: `other_private=must-not-forward; fluentt_admin=${cookie}` } });
    assert((await response.text()).includes('SyntheticAdmin'));
    assert.equal(seenCookie, `fluentt_admin=${cookie}`);
    assert(response.headers.get('cache-control')?.includes('no-store'));
  });
  await test('OIDC redirects and HttpOnly cookies pass through the explicit BFF endpoints', async () => {
    const response = await request('/api/admin/start', { method: 'POST', headers: { Origin: web } });
    assert.equal(response.status, 303); assert.equal(response.headers.get('location'), 'https://id.example/authorize');
    assert(response.headers.get('set-cookie')?.includes('HttpOnly')); assert.equal(seenOrigin, web);
    const callback = await request('/api/admin/callback?state=synthetic&code=synthetic');
    assert.equal(callback.headers.get('location'), web + '/dashboard');
    assert(callback.headers.get('set-cookie')?.includes('fluentt_admin='));
    assert.equal((await request('/api/admin/callback?state=a&state=b')).status, 400);
  });
  await test('curriculum BFF permits only fixed read paths and forwards authentication', async () => {
    const anonymous = await request('/api/admin/curriculum/versions');
    assert.equal(anonymous.status, 401);
    assert(!anonymous.headers.get('set-cookie')?.includes('fluentt_oidc='));
    const result = await request('/api/admin/curriculum/versions?status=draft', { headers: { Cookie: `fluentt_admin=${cookie}` } });
    assert.equal(result.status, 200);
    assert.equal((await result.json()).items[0].code, 'synthetic-curriculum');
    assert(result.headers.get('cache-control')?.includes('no-store'));
    assert.equal((await request('/api/admin/curriculum/users')).status, 404);
    assert.equal((await request('/api/admin/curriculum/versions/not-a-uuid')).status, 404);
    assert.equal((await request('/api/admin/curriculum/versions', { method: 'POST' })).status, 405);
  });
  await test('curriculum page verifies server permissions before presenting management', async () => {
    const anonymous = await (await request('/curriculum')).text();
    assert(!anonymous.includes('SyntheticAdmin'));
    let html = await (await request('/curriculum', { headers: { Cookie: `fluentt_admin=${cookie}` } })).text();
    assert(html.includes('Curriculum access required'));
    permissions = ['dashboard.view', 'curriculum.read', 'curriculum.write', 'curriculum.publish'];
    html = await (await request('/curriculum', { headers: { Cookie: `fluentt_admin=${cookie}` } })).text();
    assert(html.includes('Subject definitions') && !html.includes('Curriculum access required'));
  });
  await test('management BFF enforces origin, size, fixed methods and write-header allowlists', async () => {
    const path = '/api/admin/curriculum/manage/versions';
    const headers = { Cookie: `other=private; fluentt_admin=${cookie}`, Origin: web,
      'Content-Type': 'application/json', 'X-CSRF-Token': csrf, 'If-Match': 'a'.repeat(64), Authorization: 'Bearer must-not-forward' };
    assert.equal((await request(path, { method: 'POST', headers: { ...headers, Origin: 'https://evil.example' }, body: '{}' })).status, 403);
    assert.equal((await request(path, { method: 'POST', headers, body: ' '.repeat(32769) })).status, 413);
    assert.equal((await request(path, { method: 'PATCH', headers, body: '{}' })).status, 405);
    assert.equal((await request('/api/admin/curriculum/manage/users', { headers })).status, 404);
    assert.equal((await request('/api/admin/curriculum/manage/topics/00000000-0000-0000-0000-000000000001/publish', { method: 'POST', headers, body: '{}' })).status, 404);
    const body = JSON.stringify({ values: { code: 'synthetic-fixture', name: 'Synthetic fixture' } });
    assert.equal((await request(path, { method: 'POST', headers, body })).status, 200);
    assert.equal(seenMutation.body, body); assert.equal(seenMutation.csrf, csrf);
    assert.equal(seenMutation.revision, 'a'.repeat(64)); assert.equal(seenMutation.origin, web);
    assert.equal(seenMutation.authorization, undefined); assert.equal(seenCookie, `fluentt_admin=${cookie}`);
    assert.equal((await request('/api/admin/curriculum/manage/versions/00000000-0000-0000-0000-000000000001/retire', { method: 'POST', headers })).status, 200);
  });
  await test('question page verifies server session and explicit question permission', async () => {
    assert(!(await (await request('/questions')).text()).includes('SyntheticAdmin'));
    const headers = { Cookie: `fluentt_admin=${cookie}` };
    assert((await (await request('/questions', { headers })).text()).includes('Question Bank access required'));
    permissions = ['dashboard.view', 'questions.read'];
    const html = await (await request('/questions', { headers })).text();
    assert(html.includes('unscored preview only') && !html.includes('Question Bank access required'));
    assert(!html.includes('Create Multiple Choice'));
  });
  await test('question BFF constrains paths, methods, ten-method writes, body size, cookies and security headers', async () => {
    const root = '/api/admin/questions', id = '00000000-0000-0000-0000-000000000001';
    const headers = { Cookie: `unrelated=private; fluentt_admin=${cookie}`, Origin: web, 'Content-Type': 'application/json',
      'X-CSRF-Token': csrf, 'If-Match': 'a'.repeat(64), Authorization: 'Bearer must-not-forward' };
    assert.equal((await request(root)).status, 401);
    assert.equal((await request(root, { method: 'POST', headers: { ...headers, Origin: 'https://evil.example' }, body: '{}' })).status, 403);
    assert.equal((await request(root, { method: 'POST', headers, body: ' '.repeat(65537) })).status, 413);
    assert.equal((await request(root, { method: 'POST', headers, body: '{' })).status, 422);
    assert.equal((await request(root, { method: 'POST', headers, body: '{"method":"eleventh_method"}' })).status, 422);
    for (const method of ['identification', 'fill_in_the_blank', 'multiple_select', 'flashcards', 'error_identification', 'word_arrangement', 'sentence_arrangement', 'matching_type']) {
      assert.equal((await request(root, { method: 'POST', headers, body: JSON.stringify({ method }) })).status, 200);
      assert.equal(JSON.parse(seenMutation.body).method, method);
    }
    assert.equal((await request(`${root}/${id}/revisions/${id}/key`, { method: 'PUT', headers, body: '{}' })).status, 405);
    assert.equal((await request(`${root}/users`, { headers })).status, 404);
    assert.equal((await request(`${root}/${id}/revisions/${id}/grade`, { method: 'POST', headers })).status, 404);
    const body = JSON.stringify({ method: 'true_false', content: {}, answer_key: { value: false } });
    assert.equal((await request(root, { method: 'POST', headers, body })).status, 200);
    assert.equal(seenMutation.body, body); assert.equal(seenMutation.csrf, csrf); assert.equal(seenMutation.revision, 'a'.repeat(64));
    assert.equal(seenMutation.authorization, undefined); assert.equal(seenCookie, `fluentt_admin=${cookie}`);
    const result = await request(`${root}/${id}/revisions/${id}`, { method: 'PUT', headers, body });
    assert.equal(result.status, 200); assert(result.headers.get('cache-control')?.includes('no-store'));
    assert.equal((await request(`${root}/${id}/revisions/${id}/publish`, { method: 'POST', headers })).status, 200);
  });
  await test('session restoration, CSRF rejection, logout and revoked-session clearing', async () => {
    const headers = { Cookie: `fluentt_admin=${cookie}`, Origin: web };
    assert.equal((await request('/api/admin/me', { headers })).status, 200);
    assert.equal((await request('/api/admin/session', { method: 'DELETE', headers })).status, 403);
    assert.equal((await request('/api/admin/session', { method: 'DELETE', headers: { ...headers, 'X-CSRF-Token': csrf } })).status, 204);
    const result = await request('/api/admin/me', { headers });
    assert.equal(result.status, 401); assert(result.headers.get('set-cookie')?.includes('Max-Age=0'));
    assert(!(await (await request('/dashboard', { headers })).text()).includes('SyntheticAdmin'));
  });
  await test('backend outage does not expose an authenticated dashboard', async () => {
    mode = 'offline';
    const html = await (await request('/dashboard', { headers: { Cookie: `fluentt_admin=${cookie}` } })).text();
    assert(!html.includes('Welcome,') && !html.includes('SyntheticAdmin'));
    assert.equal((await request('/api/admin/me')).status, 503);
  });
  assert(!output.includes('code=synthetic'), 'Callback authorization codes must not be logged');
} finally {
  child.kill();
  await Promise.race([once(child, 'exit'), new Promise(r => setTimeout(r, 5000))]);
  await new Promise(r => api.close(r));
}
