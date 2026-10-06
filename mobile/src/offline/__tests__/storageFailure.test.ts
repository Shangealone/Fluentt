import { getDatabase, closeDatabaseForTesting } from '../db';
import { openDatabaseAsync } from 'expo-sqlite';

jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));

it('fails closed on native initialization failure, creates no volatile replacement, and can retry', async () => {
  const environment = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    jest.mocked(openDatabaseAsync).mockRejectedValue(new Error('SQLite open failed'));
    await expect(getDatabase()).rejects.toThrow('Durable SQLite storage is unavailable');
    await expect(getDatabase()).rejects.toThrow('Durable SQLite storage is unavailable');
    expect(openDatabaseAsync).toHaveBeenCalledTimes(2);
    const db = { execAsync: jest.fn().mockResolvedValue(undefined), getAllAsync: jest.fn().mockResolvedValue([]), closeAsync: jest.fn() };
    jest.mocked(openDatabaseAsync).mockResolvedValue(db as any);
    expect(await getDatabase()).toBe(db);
  } finally {
    await closeDatabaseForTesting();
    process.env.NODE_ENV = environment;
  }
});
