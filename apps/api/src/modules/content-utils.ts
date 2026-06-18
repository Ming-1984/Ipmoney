import { ContentMediaType } from '@prisma/client';

import { PrismaService } from '../common/prisma/prisma.service';

export type OrganizationSummary = {
  userId: string;
  displayName: string;
  verificationType?: string | null;
  verificationStatus?: string | null;
  orgCategory?: string | null;
  regionCode?: string | null;
  logoUrl?: string | null;
  intro?: string | null;
  stats?: unknown;
  verifiedAt?: string | null;
};

export type PublicSellerSummary = {
  id: string;
  displayName?: string | null;
  nickname?: string | null;
  avatarUrl?: string | null;
  verificationStatus?: string | null;
  verificationType?: string | null;
  orgCategory?: string | null;
};

export type ContentMediaDto = {
  fileId: string;
  type: string;
  sort: number;
  url?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  fileName?: string | null;
};

export type MediaInput = { fileId?: string; type?: string; sort?: number };

type PublicFileLike = {
  url?: string | null;
  fileName?: string | null;
};

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

export function normalizeDisplayText(value: unknown): string | undefined {
  const normalized = String(value ?? '').trim();
  if (!normalized) return undefined;
  if (EMPTY_DISPLAY_TEXT_SET.has(normalized)) return undefined;
  return normalized;
}

export function resolvePublicAvatarUrl(raw: unknown): string | null {
  const normalized = normalizeDisplayText(raw);
  if (!normalized) return null;
  return resolvePublicFileUrl({ url: normalized }) ?? null;
}

const LOCAL_HOST_SET = new Set(['127.0.0.1', 'localhost', '0.0.0.0']);
const LEGACY_API_HOST_SET = new Set([
  'api.ipmoney.cn',
  'www.ipmoney.cn',
  'ipmoney.cn',
  'admin.ipmoney.cn',
  'api.xn--m5rv27f.com',
  'www.xn--m5rv27f.com',
  'xn--m5rv27f.com',
  'admin.xn--m5rv27f.com',
]);

function normalizeBaseUrl(raw?: string): string {
  const value = String(raw || process.env.BASE_URL || '').trim();
  if (!value) return '';
  return value.replace(/\/$/, '');
}

function runtimePublicBaseUrl(): string {
  const configured = normalizeBaseUrl();
  if (configured) return configured;
  return 'https://api.ipmoney.cn';
}

function buildUploadsUrl(baseUrl: string, fileName: string): string {
  if (!baseUrl) return `/uploads/${encodeURIComponent(fileName)}`;
  return `${baseUrl}/uploads/${encodeURIComponent(fileName)}`;
}

function normalizePathLikeUrl(baseUrl: string, raw: string): string {
  if (!raw) return '';
  const pathLike = String(raw || '').trim();
  if (!pathLike) return '';
  if (!baseUrl) {
    if (pathLike.startsWith('/')) return pathLike;
    return `/${pathLike}`;
  }
  if (pathLike.startsWith('/')) return `${baseUrl}${pathLike}`;
  return `${baseUrl}/${pathLike}`;
}

export function extractFileIdFromFileUrl(rawUrl: unknown): string | null {
  const input = String(rawUrl || '').trim();
  if (!input) return null;
  let pathname = input;
  try {
    pathname = new URL(input).pathname || input;
  } catch {
    pathname = input.split('?')[0] || input;
  }
  const match = pathname.match(/\/files\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:$|\/)/i);
  return match?.[1] || null;
}

export function resolvePublicFileUrl(file?: PublicFileLike | null, opts?: { baseUrl?: string }): string | null {
  if (!file) return null;
  const configuredBaseUrl = normalizeBaseUrl(opts?.baseUrl);
  const rawUrl = String(file.url || '').trim();
  const fileName = String(file.fileName || '').trim();

  if (!rawUrl) {
    if (!fileName) return null;
    return buildUploadsUrl(configuredBaseUrl || runtimePublicBaseUrl(), fileName);
  }

  try {
    const parsed = new URL(rawUrl);
    const preferredBaseUrl = configuredBaseUrl || runtimePublicBaseUrl();
    const shouldRewriteLegacyHost = LOCAL_HOST_SET.has(parsed.hostname) || LEGACY_API_HOST_SET.has(parsed.hostname);
    const runtimeBaseUrl = shouldRewriteLegacyHost
      ? preferredBaseUrl
      : `${parsed.protocol}//${parsed.host}`.replace(/\/$/, '');
    const pathname = String(parsed.pathname || '').trim();

    if (pathname.startsWith('/files/')) {
      if (fileName) return buildUploadsUrl(runtimeBaseUrl, fileName);
      if (runtimeBaseUrl) return `${runtimeBaseUrl}${pathname}`;
      return rawUrl;
    }
    if (pathname.startsWith('/uploads/')) {
      if (shouldRewriteLegacyHost && runtimeBaseUrl) return `${runtimeBaseUrl}${pathname}`;
      return rawUrl;
    }
    if (shouldRewriteLegacyHost && runtimeBaseUrl) {
      return `${runtimeBaseUrl}${pathname}${parsed.search || ''}${parsed.hash || ''}`;
    }
    return rawUrl;
  } catch {
    if (rawUrl.startsWith('/files/')) {
      const base = configuredBaseUrl || runtimePublicBaseUrl();
      if (fileName) return buildUploadsUrl(base, fileName);
      return normalizePathLikeUrl(base, rawUrl);
    }
    if (rawUrl.startsWith('/uploads/') || rawUrl.startsWith('uploads/')) {
      return normalizePathLikeUrl(configuredBaseUrl || runtimePublicBaseUrl(), rawUrl);
    }
    return rawUrl;
  }
}

export function normalizeStringArray(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input
      .map((value) => String(value || '').trim())
      .filter((value) => value.length > 0);
  }
  if (typeof input === 'string') {
    return input
      .split(',')
      .map((value) => String(value || '').trim())
      .filter((value) => value.length > 0);
  }
  return [];
}

const HIDDEN_TEST_INDUSTRY_TAG_PATTERNS = [
  /^smoke[-_\s/]*tag(?:[-_\s/]|$)/i,
  /^e2e[-_\s/]*tag(?:[-_\s/]|$)/i,
  /^qa[-_\s/]*tag(?:[-_\s/]|$)/i,
];

export function isVisibleIndustryTagName(name: string): boolean {
  const normalized = String(name || '').trim();
  if (!normalized) return false;
  return !HIDDEN_TEST_INDUSTRY_TAG_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function sanitizeIndustryTagNames(input: unknown): string[] {
  const normalizedList = normalizeStringArray(input);
  const dedupe = new Set<string>();
  const out: string[] = [];
  for (const value of normalizedList) {
    if (!isVisibleIndustryTagName(value)) continue;
    const key = value.toLowerCase();
    if (dedupe.has(key)) continue;
    dedupe.add(key);
    out.push(value);
  }
  return out;
}

const HIDDEN_TEST_SERVICE_TAG_PATTERNS = [
  /^smoke[-_\s/]*service(?:[-_\s/]*tag)?(?:[-_\s/]|$)/i,
  /^e2e[-_\s/]*service(?:[-_\s/]*tag)?(?:[-_\s/]|$)/i,
  /^qa[-_\s/]*service(?:[-_\s/]*tag)?(?:[-_\s/]|$)/i,
];

export function isVisibleServiceTagName(name: string): boolean {
  const normalized = String(name || '').trim();
  if (!normalized) return false;
  return !HIDDEN_TEST_SERVICE_TAG_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function sanitizeServiceTagNames(input: unknown): string[] {
  const normalizedList = normalizeStringArray(input);
  const dedupe = new Set<string>();
  const out: string[] = [];
  for (const value of normalizedList) {
    if (!isVisibleServiceTagName(value)) continue;
    const key = value.toLowerCase();
    if (dedupe.has(key)) continue;
    dedupe.add(key);
    out.push(value);
  }
  return out;
}

export function normalizeMediaInput(
  input: unknown,
): Array<{ fileId: string; type: ContentMediaType; sort: number }> {
  if (!Array.isArray(input)) return [];
  const out: Array<{ fileId: string; type: ContentMediaType; sort: number }> = [];
  input.forEach((item, index) => {
    const fileId = String((item as MediaInput)?.fileId || '').trim();
    const rawType = String((item as MediaInput)?.type || '').trim().toUpperCase();
    if (!fileId || !['IMAGE', 'VIDEO', 'FILE'].includes(rawType)) return;
    const sortValue = (item as MediaInput)?.sort;
    const sort = Number.isFinite(Number(sortValue)) ? Number(sortValue) : index;
    out.push({ fileId, type: rawType as ContentMediaType, sort });
  });
  return out;
}

export function mapContentMedia(records: Array<{ fileId: string; type: string; sort: number; file?: any }> = []): ContentMediaDto[] {
  return [...records]
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
    .map((item) => ({
      fileId: item.fileId,
      type: item.type,
      sort: item.sort ?? 0,
      url: resolvePublicFileUrl(item.file) ?? null,
      mimeType: item.file?.mimeType ?? null,
      sizeBytes: item.file?.sizeBytes ?? null,
      fileName: item.file?.fileName ?? null,
    }));
}

export function mapStats(
  stats?: { viewCount?: number; favoriteCount?: number; consultCount?: number; commentCount?: number } | null,
) {
  return {
    viewCount: stats?.viewCount ?? 0,
    favoriteCount: stats?.favoriteCount ?? 0,
    consultCount: stats?.consultCount ?? 0,
    commentCount: stats?.commentCount ?? 0,
  };
}

const PLATFORM_BRAND_NAME = 'ipmoney';

export function isPlatformBrandedSellerListing(listing: any): boolean {
  const source = String(listing?.source || '').trim().toUpperCase();
  const consultationRouting = String(listing?.consultationRouting || '').trim().toUpperCase();
  return (source === 'ADMIN' || source === 'PLATFORM') && consultationRouting === 'PLATFORM';
}

export function resolvePublicSellerNickname(listing: any): string | undefined {
  if (isPlatformBrandedSellerListing(listing)) return PLATFORM_BRAND_NAME;
  const verificationDisplayName = normalizeDisplayText(listing?.seller?.verifications?.[0]?.displayName);
  return verificationDisplayName || undefined;
}

export function resolvePublicSellerVerificationType(listing: any): string | undefined {
  if (isPlatformBrandedSellerListing(listing)) return undefined;
  const verificationType = normalizeDisplayText(listing?.seller?.verifications?.[0]?.verificationType)?.toUpperCase();
  return verificationType || undefined;
}

export function resolvePublicSellerVerificationStatus(listing: any): string | undefined {
  if (isPlatformBrandedSellerListing(listing)) return undefined;
  const verificationStatus = normalizeDisplayText(listing?.seller?.verifications?.[0]?.verificationStatus)?.toUpperCase();
  return verificationStatus || undefined;
}

export function resolvePublicSellerOrgCategory(listing: any): 'RESEARCH_INSTITUTE' | 'OTHER' | undefined {
  const verificationType = resolvePublicSellerVerificationType(listing);
  if (verificationType === 'ACADEMY') return 'RESEARCH_INSTITUTE';
  if (verificationType === 'COMPANY' || verificationType === 'GOVERNMENT' || verificationType === 'ASSOCIATION') {
    return 'OTHER';
  }
  return undefined;
}

export function toPublicSellerSummary(listing: any): PublicSellerSummary | null {
  if (!listing?.seller) return null;
  const displayName = resolvePublicSellerNickname(listing);
  return {
    id: listing.seller.id,
    displayName,
    nickname: displayName,
    avatarUrl: resolvePublicFileUrl({ url: listing.seller.avatarUrl }),
    verificationStatus: resolvePublicSellerVerificationStatus(listing),
    verificationType: resolvePublicSellerVerificationType(listing),
    orgCategory: resolvePublicSellerOrgCategory(listing),
  };
}

function toPublisherSummary(user: any, verification?: any): OrganizationSummary {
  const verificationType = normalizeDisplayText(verification?.verificationType) ?? null;
  const verificationStatus = normalizeDisplayText(verification?.verificationStatus) ?? null;
  return {
    userId: user.id,
    displayName: normalizeDisplayText(verification?.displayName) ?? '',
    verificationType,
    verificationStatus,
    orgCategory: null,
    regionCode: verification?.regionCode ?? user.regionCode ?? null,
    logoUrl: resolvePublicFileUrl(verification?.logoFile) ?? null,
    intro: normalizeDisplayText(verification?.intro) ?? null,
    stats: undefined,
    verifiedAt: verification?.reviewedAt ? verification.reviewedAt.toISOString() : null,
  };
}

export async function buildPublisherMap(prisma: PrismaService, userIds: string[]) {
  const uniqueIds = Array.from(new Set(userIds.filter((id) => String(id || '').length > 0)));
  if (uniqueIds.length === 0) return {} as Record<string, OrganizationSummary>;

  const users = await prisma.user.findMany({
    where: { id: { in: uniqueIds } },
    include: {
      verifications: {
        orderBy: { submittedAt: 'desc' },
        take: 1,
        include: { logoFile: true },
      },
    },
  });

  const map: Record<string, OrganizationSummary> = {};
  for (const user of users) {
    const verification = user.verifications?.[0];
    map[user.id] = toPublisherSummary(user, verification);
  }
  return map;
}
