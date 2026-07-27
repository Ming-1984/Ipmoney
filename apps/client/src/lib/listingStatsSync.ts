import Taro from '@tarojs/taro';

import type { components } from '@ipmoney/api-types';

import { STORAGE_KEYS } from '../constants';

type ListingSummary = components['schemas']['ListingSummary'];
type ListingStats = NonNullable<ListingSummary['stats']>;

export type ListingStatsPatch = {
  listingId: string;
  stats?: Partial<ListingStats>;
  favorited?: boolean;
  updatedAt?: number;
};

const LISTING_STATS_EVENT = 'listing:stats-changed';
const LISTING_STATS_PATCH_TTL_MS = 5 * 60 * 1000;
const LISTING_STATS_PATCH_LIMIT = 200;

function normalizeCount(value: unknown): number | undefined {
  const num = Number(value);
  if (!Number.isFinite(num)) return undefined;
  return Math.max(0, Math.round(num));
}

function normalizePatch(input: ListingStatsPatch): ListingStatsPatch | null {
  const listingId = String(input?.listingId || '').trim();
  if (!listingId) return null;

  const stats: Partial<ListingStats> = {};
  const viewCount = normalizeCount(input.stats?.viewCount);
  const favoriteCount = normalizeCount(input.stats?.favoriteCount);
  const consultCount = normalizeCount(input.stats?.consultCount);
  const commentCount = normalizeCount(input.stats?.commentCount);
  if (viewCount !== undefined) stats.viewCount = viewCount;
  if (favoriteCount !== undefined) stats.favoriteCount = favoriteCount;
  if (consultCount !== undefined) stats.consultCount = consultCount;
  if (commentCount !== undefined) stats.commentCount = commentCount;

  return {
    listingId,
    ...(Object.keys(stats).length ? { stats } : {}),
    ...(typeof input.favorited === 'boolean' ? { favorited: input.favorited } : {}),
    updatedAt: Number.isFinite(Number(input.updatedAt)) ? Number(input.updatedAt) : Date.now(),
  };
}

function readPatchMap(): Record<string, ListingStatsPatch> {
  let raw: unknown = null;
  try {
    raw = Taro.getStorageSync(STORAGE_KEYS.listingStatsPatches);
  } catch {
    return {};
  }
  if (!raw || typeof raw !== 'object') return {};

  const now = Date.now();
  const entries = Object.entries(raw as Record<string, ListingStatsPatch>)
    .map(([, patch]) => normalizePatch(patch))
    .filter((patch): patch is ListingStatsPatch => Boolean(patch))
    .filter((patch) => now - Number(patch.updatedAt || 0) <= LISTING_STATS_PATCH_TTL_MS)
    .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))
    .slice(0, LISTING_STATS_PATCH_LIMIT);

  return entries.reduce(
    (acc, patch) => {
      acc[patch.listingId] = patch;
      return acc;
    },
    {} as Record<string, ListingStatsPatch>,
  );
}

function writePatchMap(map: Record<string, ListingStatsPatch>) {
  try {
    Taro.setStorageSync(STORAGE_KEYS.listingStatsPatches, map);
  } catch {
    // ignore storage bridge failures
  }
}

export function notifyListingStatsChanged(input: ListingStatsPatch) {
  const patch = normalizePatch(input);
  if (!patch) return;

  const map = readPatchMap();
  const previous = map[patch.listingId];
  map[patch.listingId] = {
    listingId: patch.listingId,
    stats: {
      ...(previous?.stats || {}),
      ...(patch.stats || {}),
    },
    ...(typeof patch.favorited === 'boolean'
      ? { favorited: patch.favorited }
      : typeof previous?.favorited === 'boolean'
        ? { favorited: previous.favorited }
        : {}),
    updatedAt: patch.updatedAt,
  };
  writePatchMap(map);

  try {
    Taro.eventCenter.trigger(LISTING_STATS_EVENT, map[patch.listingId]);
  } catch {
    // ignore event bridge failures
  }
}

export function onListingStatsChanged(handler: (patch: ListingStatsPatch) => void) {
  try {
    Taro.eventCenter.on(LISTING_STATS_EVENT, handler);
  } catch {
    // ignore event bridge failures
  }
  return () => {
    try {
      Taro.eventCenter.off(LISTING_STATS_EVENT, handler);
    } catch {
      // ignore event bridge failures
    }
  };
}

export function mergeListingStatsPatch<T extends { id?: string; stats?: ListingStats | null }>(item: T): T {
  const listingId = String(item?.id || '').trim();
  if (!listingId) return item;

  const patch = readPatchMap()[listingId];
  if (!patch?.stats) return item;

  return {
    ...item,
    stats: {
      ...(item.stats || {}),
      ...patch.stats,
    } as ListingStats,
  };
}

export function mergeListingStatsPatches<T extends { id?: string; stats?: ListingStats | null }>(items: T[]): T[] {
  return items.map((item) => mergeListingStatsPatch(item));
}
