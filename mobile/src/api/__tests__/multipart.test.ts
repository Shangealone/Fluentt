import { apiClient } from '../client';

it('lets fetch supply the multipart boundary while keeping the JSON default for JSON requests', async () => {
  const original = global.fetch;
  const fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
  global.fetch = fetch;
  try {
    const body = new FormData(); body.append('metadata', '{}');
    await apiClient('/pronunciation/attempts', { method: 'POST', body, requiresAuth: false });
    expect(fetch.mock.calls[0][1].headers).not.toHaveProperty('Content-Type');
    expect(fetch.mock.calls[0][1].body).toBe(body);
    await apiClient('/auth/login', { method: 'POST', body: '{}', requiresAuth: false });
    expect(fetch.mock.calls[1][1].headers['Content-Type']).toBe('application/json');
  } finally { global.fetch = original; }
});
