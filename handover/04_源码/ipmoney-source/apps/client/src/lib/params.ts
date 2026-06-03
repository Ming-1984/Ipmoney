const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseStringParam(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  return str ? str : null;
}

export function parseNumberParam(value: unknown): number | null {
  const str = parseStringParam(value);
  if (!str) return null;
  const n = Number(str);
  return Number.isFinite(n) ? n : null;
}

export function parseUuidParam(value: unknown): string | null {
  const str = parseStringParam(value);
  if (!str) return null;
  return UUID_RE.test(str) ? str : null;
}

