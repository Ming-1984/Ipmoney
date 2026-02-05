export function fenToYuan(fen?: number | null, options?: { empty?: string }): string {
  const empty = options?.empty ?? '-';
  if (fen === undefined || fen === null) return empty;
  const n = Number(fen);
  if (!Number.isFinite(n)) return empty;
  return String(Math.round(n / 100));
}

export function fenToYuanNumber(fen?: number | null, options?: { empty?: number }): number {
  const empty = options?.empty ?? 0;
  if (fen === undefined || fen === null) return empty;
  const n = Number(fen);
  if (!Number.isFinite(n)) return empty;
  return n / 100;
}

export function yuanToFen(yuan?: number | null, options?: { empty?: number }): number {
  const empty = options?.empty ?? 0;
  if (yuan === undefined || yuan === null) return empty;
  const n = Number(yuan);
  if (!Number.isFinite(n)) return empty;
  return Math.round(n * 100);
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function formatTimeSmart(value?: string | null, options?: { empty?: string }): string {
  const empty = options?.empty ?? '-';
  if (!value) return empty;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);

  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const hm = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  if (sameDay) return hm;

  const sameYear = d.getFullYear() === now.getFullYear();
  const md = `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  if (sameYear) return `${md} ${hm}`;

  return `${d.getFullYear()}-${md} ${hm}`;
}
