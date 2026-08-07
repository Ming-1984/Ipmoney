export type GlobalShareOptions = {
  title?: string;
  path?: string;
  imageUrl?: string;
  visibility?: 'public' | 'private';
};

export type SharePayload = {
  title: string;
  path: string;
  imageUrl?: string;
};

export const DEFAULT_SHARE_TITLE = 'IPMONEY 知识产权服务平台';
export const DEFAULT_SHARE_PATH = '/pages/home/index';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PUBLIC_DETAIL_ROUTES: Record<string, string> = {
  '/subpackages/patent/detail/index': 'patentId',
  '/subpackages/listing/detail/index': 'listingId',
  '/subpackages/achievement/detail/index': 'achievementId',
  '/subpackages/organizations/detail/index': 'orgUserId',
};

function normalizeTitle(value?: string): string {
  const title = String(value || '').replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!title) return DEFAULT_SHARE_TITLE;
  return Array.from(title).slice(0, 30).join('');
}

function normalizeImageUrl(value?: string): string | undefined {
  const imageUrl = String(value || '').trim();
  const match = imageUrl.match(/^https:\/\/([^\s/?#:]+)(?::\d+)?(?:[/?#][^\s]*)?$/i);
  if (!match) return undefined;
  const host = match[1].toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === 'example.com') return undefined;
  return imageUrl;
}

function decodeQueryPart(value: string): string | null {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '));
  } catch (_) {
    return null;
  }
}

function normalizePublicPath(value?: string): string {
  const rawPath = String(value || '').trim();
  if (!rawPath || rawPath === DEFAULT_SHARE_PATH) return DEFAULT_SHARE_PATH;
  if (!rawPath.startsWith('/') || rawPath.includes('//') || rawPath.includes('..') || rawPath.includes('#')) return DEFAULT_SHARE_PATH;
  const queryIndex = rawPath.indexOf('?');
  const pathname = queryIndex >= 0 ? rawPath.slice(0, queryIndex) : rawPath;
  const expectedParam = PUBLIC_DETAIL_ROUTES[pathname];
  if (!expectedParam) return DEFAULT_SHARE_PATH;
  const query = queryIndex >= 0 ? rawPath.slice(queryIndex + 1) : '';
  const entries = query.split('&').map((entry) => {
    const separator = entry.indexOf('=');
    return [decodeQueryPart(separator >= 0 ? entry.slice(0, separator) : entry), decodeQueryPart(separator >= 0 ? entry.slice(separator + 1) : '')];
  });
  if (entries.length !== 1 || entries[0][0] !== expectedParam || !UUID_PATTERN.test(entries[0][1] || '')) return DEFAULT_SHARE_PATH;
  const id = entries[0][1] || '';
  return `${pathname}?${expectedParam}=${encodeURIComponent(id)}`;
}

export function buildSharePayload(options: GlobalShareOptions = {}): SharePayload {
  const isPublic = options.visibility === 'public';
  return {
    title: normalizeTitle(options.title),
    path: isPublic ? normalizePublicPath(options.path) : DEFAULT_SHARE_PATH,
    imageUrl: normalizeImageUrl(options.imageUrl),
  };
}
