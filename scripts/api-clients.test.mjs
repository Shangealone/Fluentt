import assert from 'node:assert/strict';
import test from 'node:test';
import {checkHealth as mobile} from '../apps/mobile/src/services/api/client.ts';
import {checkHealth as admin} from '../apps/admin/src/services/api.ts';

for (const [name, check, key] of [['mobile', mobile, 'EXPO_PUBLIC_API_URL'], ['admin', admin, 'NEXT_PUBLIC_API_URL']]) {
  test(`${name} client handles configured URL, success and failures`, async () => {
    const originalFetch = globalThis.fetch;
    const previous = process.env[key];
    try {
      process.env[key] = 'http://localhost:8000/';
      globalThis.fetch = async (url, options) => {
        assert.equal(url, 'http://localhost:8000/api/v1/health');
        assert.ok(options.signal instanceof AbortSignal);
        return Response.json({status: 'ok', service: 'fluentt-api'});
      };
      assert.equal((await check()).status, 'ok');
      globalThis.fetch = async () => Response.json({status: 'wrong'});
      await assert.rejects(check, /Unexpected backend response/);
      globalThis.fetch = async () => new Response('', {status: 503});
      await assert.rejects(check, /HTTP 503/);
      globalThis.fetch = async () => { throw new TypeError('Network unavailable'); };
      await assert.rejects(check, /Network unavailable/);
      const originalSetTimeout = globalThis.setTimeout;
      try {
        globalThis.setTimeout = (callback) => originalSetTimeout(callback, 1);
        globalThis.fetch = async (_url, {signal}) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted'))));
        await assert.rejects(check, /Connection timed out/);
      } finally { globalThis.setTimeout = originalSetTimeout; }
      delete process.env[key];
      await assert.rejects(check, /Set .* to connect/);
    } finally {
      globalThis.fetch = originalFetch;
      if (previous === undefined) delete process.env[key]; else process.env[key] = previous;
    }
  });
}
