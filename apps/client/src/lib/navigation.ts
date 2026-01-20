import Taro from '@tarojs/taro';

const TAB_PAGE_PATHS = [
  '/pages/tech-managers/index',
  '/pages/search/index',
  '/pages/home/index',
  '/pages/messages/index',
  '/pages/me/index',
] as const;

function normalizeUrlPath(url: string): string {
  const path = url.split('?')[0] ?? url;
  return path.split('#')[0] ?? path;
}

export function isTabPageUrl(url: string): boolean {
  const path = normalizeUrlPath(url);
  return (TAB_PAGE_PATHS as readonly string[]).includes(path);
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
