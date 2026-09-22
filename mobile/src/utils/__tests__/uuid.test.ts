import { generateUUID } from '../uuid';

describe('UUID generator', () => {
  it('generates valid RFC 4122 UUID v4', () => {
    const id = generateUUID();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(id).toMatch(uuidRegex);
  });

  it('generates unique UUIDs', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateUUID());
    }
    expect(ids.size).toBe(100);
  });
});
