export function fenToYuan(fen?: number | null, options?: { digits?: 0 | 2; empty?: string }): string {
  const empty = options?.empty ?? '-';
  if (fen === undefined || fen === null) return empty;
  const n = Number(fen);
  if (!Number.isFinite(n)) return empty;
  const yuan = n / 100;
  return String(Math.round(yuan));
}

export function fenToYuanInt(fen?: number | null, empty?: string): string {
  return fenToYuan(fen, { digits: 0, empty });
}
