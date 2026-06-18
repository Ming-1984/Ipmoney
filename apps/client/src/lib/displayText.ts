const EMPTY_DISPLAY_TEXT_SET = new Set([
  '-',
  '--',
  '—',
  '——',
  '无',
  '暂无',
  '待补充',
  '未填写',
  '未提供',
  'N/A',
  'NA',
  'null',
  'NULL',
  'None',
  'none',
]);

export function normalizeDisplayText(value: unknown): string {
  const normalized = String(value ?? '').trim();
  if (!normalized) return '';
  if (EMPTY_DISPLAY_TEXT_SET.has(normalized)) return '';
  return normalized;
}

export function displayTitleOrFallback(value: unknown, fallback: string): string {
  return normalizeDisplayText(value) || fallback;
}

export function displayInfoOrDash(value: unknown): string {
  return normalizeDisplayText(value) || '-';
}

export function displayInfoOrPlaceholder(value: unknown, placeholder = '暂无信息'): string {
  return normalizeDisplayText(value) || placeholder;
}

export function displayTitleWithSecondary(
  title: unknown,
  fallback: string,
  options?: { secondary?: unknown; secondaryPrefix?: string },
): string {
  const normalizedTitle = normalizeDisplayText(title);
  if (normalizedTitle) return normalizedTitle;
  const normalizedSecondary = normalizeDisplayText(options?.secondary);
  if (normalizedSecondary) {
    return `${options?.secondaryPrefix || ''}${normalizedSecondary}`;
  }
  return fallback;
}

export function displayUserName(
  user?: { displayName?: unknown; nickname?: unknown } | null,
  fallback = '平台用户',
): string {
  return normalizeDisplayText(user?.displayName) || normalizeDisplayText(user?.nickname) || fallback;
}

export function displayInitial(value: unknown, fallback: string, options?: { uppercase?: boolean }): string {
  const initial = (normalizeDisplayText(value) || fallback).slice(0, 1);
  return options?.uppercase ? initial.toUpperCase() : initial;
}
