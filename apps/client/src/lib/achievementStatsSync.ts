import Taro from '@tarojs/taro';

import type { components } from '@ipmoney/api-types';

import { STORAGE_KEYS } from '../constants';

type AchievementSummary = components['schemas']['AchievementSummary'];
type AchievementStats = NonNullable<AchievementSummary['stats']>;

export type AchievementStatsPatch = {
  achievementId: string;
  stats?: Partial<AchievementStats>;
  favorited?: boolean;
  updatedAt?: number;
};

const ACHIEVEMENT_STATS_EVENT = 'achievement:stats-changed';
const ACHIEVEMENT_STATS_PATCH_TTL_MS = 5 * 60 * 1000;
const ACHIEVEMENT_STATS_PATCH_LIMIT = 200;

function normalizeCount(value: unknown): number | undefined {
  const num = Number(value);
  if (!Number.isFinite(num)) return undefined;
  return Math.max(0, Math.round(num));
}

function normalizePatch(input: AchievementStatsPatch): AchievementStatsPatch | null {
  const achievementId = String(input?.achievementId || '').trim();
  if (!achievementId) return null;

  const stats: Partial<AchievementStats> = {};
  const viewCount = normalizeCount(input.stats?.viewCount);
  const favoriteCount = normalizeCount(input.stats?.favoriteCount);
  const consultCount = normalizeCount(input.stats?.consultCount);
  const commentCount = normalizeCount(input.stats?.commentCount);
  if (viewCount !== undefined) stats.viewCount = viewCount;
  if (favoriteCount !== undefined) stats.favoriteCount = favoriteCount;
  if (consultCount !== undefined) stats.consultCount = consultCount;
  if (commentCount !== undefined) stats.commentCount = commentCount;

  return {
    achievementId,
    ...(Object.keys(stats).length ? { stats } : {}),
    ...(typeof input.favorited === 'boolean' ? { favorited: input.favorited } : {}),
    updatedAt: Number.isFinite(Number(input.updatedAt)) ? Number(input.updatedAt) : Date.now(),
  };
}

function readPatchMap(): Record<string, AchievementStatsPatch> {
  let raw: unknown = null;
  try {
    raw = Taro.getStorageSync(STORAGE_KEYS.achievementStatsPatches);
  } catch {
    return {};
  }
  if (!raw || typeof raw !== 'object') return {};

  const now = Date.now();
  const entries = Object.entries(raw as Record<string, AchievementStatsPatch>)
    .map(([, patch]) => normalizePatch(patch))
    .filter((patch): patch is AchievementStatsPatch => Boolean(patch))
    .filter((patch) => now - Number(patch.updatedAt || 0) <= ACHIEVEMENT_STATS_PATCH_TTL_MS)
    .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))
    .slice(0, ACHIEVEMENT_STATS_PATCH_LIMIT);

  return entries.reduce(
    (acc, patch) => {
      acc[patch.achievementId] = patch;
      return acc;
    },
    {} as Record<string, AchievementStatsPatch>,
  );
}

function writePatchMap(map: Record<string, AchievementStatsPatch>) {
  try {
    Taro.setStorageSync(STORAGE_KEYS.achievementStatsPatches, map);
  } catch {
    // ignore storage bridge failures
  }
}

export function notifyAchievementStatsChanged(input: AchievementStatsPatch) {
  const patch = normalizePatch(input);
  if (!patch) return;

  const map = readPatchMap();
  const previous = map[patch.achievementId];
  map[patch.achievementId] = {
    achievementId: patch.achievementId,
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
    Taro.eventCenter.trigger(ACHIEVEMENT_STATS_EVENT, map[patch.achievementId]);
  } catch {
    // ignore event bridge failures
  }
}

export function onAchievementStatsChanged(handler: (patch: AchievementStatsPatch) => void) {
  try {
    Taro.eventCenter.on(ACHIEVEMENT_STATS_EVENT, handler);
  } catch {
    // ignore event bridge failures
  }
  return () => {
    try {
      Taro.eventCenter.off(ACHIEVEMENT_STATS_EVENT, handler);
    } catch {
      // ignore event bridge failures
    }
  };
}

export function mergeAchievementStatsPatch<T extends { id?: string; stats?: AchievementStats | null }>(item: T): T {
  const achievementId = String(item?.id || '').trim();
  if (!achievementId) return item;

  const patch = readPatchMap()[achievementId];
  if (!patch?.stats) return item;

  return {
    ...item,
    stats: {
      ...(item.stats || {}),
      ...patch.stats,
    } as AchievementStats,
  };
}

export function mergeAchievementStatsPatches<T extends { id?: string; stats?: AchievementStats | null }>(items: T[]): T[] {
  return items.map((item) => mergeAchievementStatsPatch(item));
}
