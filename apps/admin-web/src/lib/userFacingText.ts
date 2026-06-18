const EMPTY_LIKE_TEXTS = new Set([
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

export function normalizeUserFacingText(value: unknown): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  return EMPTY_LIKE_TEXTS.has(trimmed) ? '' : trimmed;
}

export function displayAdminTitle(value: unknown, fallback: string): string {
  return normalizeUserFacingText(value) || fallback;
}

export function displayAdminInfo(value: unknown, fallback = '-'): string {
  return normalizeUserFacingText(value) || fallback;
}

export function displayUserName(
  user?: { displayName?: unknown; nickname?: unknown } | null,
  fallback = '平台用户',
): string {
  return normalizeUserFacingText(user?.displayName) || normalizeUserFacingText(user?.nickname) || fallback;
}

export function displayUserInitial(value: unknown, fallback: string): string {
  return (normalizeUserFacingText(value) || fallback).slice(0, 1);
}

export function displayAdminTitleWithSecondary(
  title: unknown,
  fallback: string,
  options?: { secondary?: unknown; secondaryPrefix?: string },
): string {
  const normalizedTitle = normalizeUserFacingText(title);
  if (normalizedTitle) return normalizedTitle;
  const normalizedSecondary = normalizeUserFacingText(options?.secondary);
  if (normalizedSecondary) {
    return `${options?.secondaryPrefix || ''}${normalizedSecondary}`;
  }
  return fallback;
}

export function formatRegionCodeDisplay(value: unknown, fallback = '未设置'): string {
  const text = normalizeUserFacingText(value);
  if (!text) return fallback;
  if (/^\d{6}$/.test(text)) return `地区信息待完善（${text}）`;
  if (/^\d+$/.test(text)) return `地区代码 ${text}`;
  return text;
}
