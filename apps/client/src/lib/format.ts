function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function formatTimeSmart(value?: string | null): string {
  if (!value) return '-';
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

