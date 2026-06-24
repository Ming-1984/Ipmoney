import Taro from '@tarojs/taro';

const TAB_PAGE_PATHS = [
  '/pages/home/index',
  '/pages/tech-managers/index',
  '/pages/publish/index',
  '/pages/messages/index',
  '/pages/me/index',
] as const;

export function normalizePageUrl(url?: string, fallback = ''): string {
  const raw = String(url || '').trim();
  if (!raw) return fallback;
  if (/^https?:\/\//i.test(raw) || raw.startsWith('//')) return fallback;
  const normalized = raw.startsWith('/') ? raw : `/${raw}`;
  if (normalized.startsWith('/pages/') || normalized.startsWith('/subpackages/')) {
    return normalized;
  }
  return fallback;
}

function normalizeUrlPath(url: string): string {
  const path = url.split('?')[0] ?? url;
  return path.split('#')[0] ?? path;
}

export function isTabPageUrl(url: string): boolean {
  const path = normalizeUrlPath(url);
  return (TAB_PAGE_PATHS as readonly string[]).includes(path);
}

function getPageStackSize(): number {
  try {
    const pages = Taro.getCurrentPages?.() ?? [];
    return Array.isArray(pages) ? pages.length : 0;
  } catch {
    return 0;
  }
}

function isPageStackOverflowError(error: unknown): boolean {
  const message = String((error as any)?.errMsg || (error as any)?.message || error || '').toLowerCase();
  return message.includes('webview count limit') || message.includes('page stack') || message.includes('navigateto');
}

export async function safeOpenPage(url: string, options?: { fallbackToRedirect?: boolean }) {
  const target = normalizePageUrl(url);
  if (!target) {
    throw new Error('无效页面路径');
  }

  if (isTabPageUrl(target)) {
    await Taro.switchTab({ url: target });
    return;
  }

  const preferRedirect = options?.fallbackToRedirect !== false;
  const stackSize = getPageStackSize();
  if (preferRedirect && stackSize >= 9) {
    await Taro.redirectTo({ url: target });
    return;
  }

  try {
    await Taro.navigateTo({ url: target });
  } catch (error) {
    if (!preferRedirect) throw error;
    if (!isPageStackOverflowError(error)) throw error;
    try {
      await Taro.redirectTo({ url: target });
    } catch {
      await Taro.reLaunch({ url: target });
    }
  }
}

export async function safeNavigateBack(options?: { fallbackUrl?: string }) {
  const fallbackUrl = options?.fallbackUrl ?? '/pages/home/index';

  try {
    const pages = Taro.getCurrentPages?.() ?? [];
    if (Array.isArray(pages) && pages.length > 1) {
      await Taro.navigateBack();
      return;
    }
  } catch {
    // ignore
  }

  try {
    if (isTabPageUrl(fallbackUrl)) {
      await Taro.switchTab({ url: fallbackUrl });
      return;
    }
  } catch {
    // ignore
  }

  try {
    await Taro.redirectTo({ url: fallbackUrl });
    return;
  } catch {
    // ignore
  }

  await Taro.reLaunch({ url: fallbackUrl });
}
