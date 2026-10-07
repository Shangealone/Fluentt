/** Invalid successful responses are retryable contract failures, not HTTP rejections. */
export class ContractError extends Error {
  constructor(message: string) { super(message); this.name = 'ContractError'; }
}
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ContractError('Expected a response object.');
  return value as Record<string, unknown>;
}
export function stringField(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  if (typeof value !== 'string' || !value.trim()) throw new ContractError(`Missing or invalid ${key}.`);
  return value;
}
export function nullableString(row: Record<string, unknown>, key: string): string | null {
  if (row[key] === null) return null;
  if (typeof row[key] !== 'string') throw new ContractError(`Missing or invalid ${key}.`);
  return row[key];
}
export function booleanField(row: Record<string, unknown>, key: string): boolean {
  if (typeof row[key] !== 'boolean') throw new ContractError(`Missing or invalid ${key}.`);
  return row[key];
}
export function integerField(row: Record<string, unknown>, key: string, minimum = 0): number {
  const value = row[key];
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) throw new ContractError(`Missing or invalid ${key}.`);
  return value;
}
export function timestampField(row: Record<string, unknown>, key: string): string {
  const value = stringField(row, key);
  if (!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) throw new ContractError(`Invalid timestamp ${key}.`);
  return value;
}
export function arrayField(row: Record<string, unknown>, key: string): unknown[] {
  if (!Array.isArray(row[key])) throw new ContractError(`Missing or invalid ${key}.`);
  return row[key];
}
function isJson(value: unknown): value is JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJson);
  return typeof value === 'object' && value !== null && Object.values(value).every(isJson);
}
export function stateField(row: Record<string, unknown>, key: string): Record<string, JsonValue> | null {
  const value = row[key];
  if (value === null) return null;
  if (typeof value !== 'object' || !isJson(value) || Array.isArray(value)) throw new ContractError(`Missing or invalid ${key}.`);
  return value as Record<string, JsonValue>;
}
