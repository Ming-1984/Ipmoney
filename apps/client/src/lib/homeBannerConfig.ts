import bannerFallbackCover from '../assets/home/promo-certificate.png';
import { normalizeDisplayText } from './displayText';

export type BannerMediaType = 'IMAGE' | 'VIDEO';

export type BannerVideoMeta = {
  durationMs?: number;
  loop?: boolean;
  muted?: boolean;
  autoplay?: boolean;
  objectFit?: 'contain' | 'cover' | 'fill';
};

export type BannerItem = {
  id: string;
  title: string;
  imageUrl: string;
  linkUrl?: string;
  enabled: boolean;
  order: number;
  mediaType?: BannerMediaType;
  videoUrl?: string;
  posterUrl?: string;
  videoMeta?: BannerVideoMeta;
};

export type BannerConfig = {
  items: BannerItem[];
};

export type HomeBannerItem = {
  id: string;
  title: string;
  cover: string;
  mediaType: BannerMediaType;
  videoUrl?: string;
  linkUrl?: string;
  order: number;
  source: 'remote' | 'fallback';
};

export const HOME_BANNER_FALLBACK_COVER = bannerFallbackCover;

const DEFAULT_FALLBACK_BANNER: HomeBannerItem = {
  id: 'banner-fallback-default',
  title: '首页推荐',
  cover: HOME_BANNER_FALLBACK_COVER,
  mediaType: 'IMAGE',
  linkUrl: '/subpackages/search/index',
  order: 1,
  source: 'fallback',
};

export function buildHomeBannerItems(config?: BannerConfig | null): HomeBannerItem[] {
  const items = Array.isArray(config?.items) ? config!.items : [];
  const remoteItems = items
    .filter((item) => item && item.enabled !== false)
    .map((item) => {
      const mediaType = item.mediaType ?? 'IMAGE';
      const cover = String(item.posterUrl || item.imageUrl || '').trim();
      return {
        id: String(item.id || '').trim() || item.videoUrl || item.imageUrl || `banner-${Date.now()}`,
        title: normalizeDisplayText(item.title) || '\u9996\u9875\u89c6\u9891',
        cover,
        mediaType,
        videoUrl: item.videoUrl,
        linkUrl: item.linkUrl,
        order: Number.isFinite(item.order) ? Number(item.order) : 0,
        source: 'remote' as const,
      };
    })
    .filter((item) => Boolean(item.cover))
    .filter((item) => (item.mediaType === 'VIDEO' ? Boolean(item.videoUrl) : true))
    .sort((a, b) => a.order - b.order);

  if (remoteItems.length) return remoteItems;
  return [DEFAULT_FALLBACK_BANNER];
}

export function clampBannerIndex(rawIndex: number, length: number) {
  if (!Number.isFinite(rawIndex) || length <= 0) return 0;
  const safe = Math.max(0, Math.floor(rawIndex));
  return Math.min(safe, length - 1);
}
