export function fenToYuan(fen?: number | null, options?: { digits?: 0 | 2; empty?: string }): string {
  const empty = options?.empty ?? '-';
  if (fen === undefined || fen === null) return empty;
  const n = Number(fen);
  if (!Number.isFinite(n)) return empty;
  const digits = options?.digits ?? 2;
  const yuan = n / 100;
  if (digits === 0) return String(Math.round(yuan));
  return yuan.toFixed(2);
}

export function fenToYuanInt(fen?: number | null, empty?: string): string {
  return fenToYuan(fen, { digits: 0, empty });
}

