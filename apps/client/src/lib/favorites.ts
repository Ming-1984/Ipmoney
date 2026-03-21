import Taro from '@tarojs/taro';

import type { components } from '@ipmoney/api-types';

import { STORAGE_KEYS } from '../constants';
import { apiDelete, apiGet, apiPost } from './api';

type PagedListingSummary = components['schemas']['PagedListingSummary'];
type PagedAchievementSummary = components['schemas']['PagedAchievementSummary'];

function readIds(): string[] {
  const v = Taro.getStorageSync(STORAGE_KEYS.favoriteListingIds);
  if (Array.isArray(v)) return v.filter((x) => typeof x === 'string');
  return [];
}

function readAchievementIds(): string[] {
  const v = Taro.getStorageSync(STORAGE_KEYS.favoriteAchievementIds);
  if (Array.isArray(v)) return v.filter((x) => typeof x === 'string');
  return [];
}

function writeIds(ids: string[]) {
  const uniq = Array.from(new Set(ids.filter(Boolean))).slice(0, 500);
  Taro.setStorageSync(STORAGE_KEYS.favoriteListingIds, uniq);
}

function writeAchievementIds(ids: string[]) {
  const uniq = Array.from(new Set(ids.filter(Boolean))).slice(0, 500);
  Taro.setStorageSync(STORAGE_KEYS.favoriteAchievementIds, uniq);
}

export function getFavoriteListingIds(): string[] {
  return readIds();
}

export function getFavoriteAchievementIds(): string[] {
  return readAchievementIds();
}

export function isFavorited(listingId: string): boolean {
  if (!listingId) return false;
  return new Set(readIds()).has(listingId);
}

export function isAchievementFavorited(achievementId: string): boolean {
  if (!achievementId) return false;
  return new Set(readAchievementIds()).has(achievementId);
}

export async function syncFavorites(): Promise<string[]> {
  const res = await apiGet<PagedListingSummary>('/me/favorites', { page: 1, pageSize: 50 });
  const ids = (res.items || []).map((it) => it.id).filter(Boolean);
  writeIds(ids);
  return ids;
}

export async function syncAchievementFavorites(): Promise<string[]> {
  const res = await apiGet<PagedAchievementSummary>('/me/favorites/achievements', { page: 1, pageSize: 50 });
  const ids = (res.items || []).map((it) => it.id).filter(Boolean);
  writeAchievementIds(ids);
  return ids;
}

export async function favorite(listingId: string): Promise<void> {
  await apiPost<void>(`/listings/${listingId}/favorites`, {}, { idempotencyKey: `fav-${listingId}` });
  const next = new Set(readIds());
  next.add(listingId);
  writeIds(Array.from(next));
}

export async function favoriteAchievement(achievementId: string): Promise<void> {
  await apiPost<void>(`/achievements/${achievementId}/favorites`, {}, { idempotencyKey: `fav-ach-${achievementId}` });
  const next = new Set(readAchievementIds());
  next.add(achievementId);
  writeAchievementIds(Array.from(next));
}

export async function unfavorite(listingId: string): Promise<void> {
  await apiDelete(`/listings/${listingId}/favorites`, { idempotencyKey: `unfav-${listingId}` });
  const next = new Set(readIds());
  next.delete(listingId);
  writeIds(Array.from(next));
}

export async function unfavoriteAchievement(achievementId: string): Promise<void> {
  await apiDelete(`/achievements/${achievementId}/favorites`, { idempotencyKey: `unfav-ach-${achievementId}` });
  const next = new Set(readAchievementIds());
  next.delete(achievementId);
  writeAchievementIds(Array.from(next));
}

export async function listFavorites(page = 1, pageSize = 20): Promise<PagedListingSummary> {
  const res = await apiGet<PagedListingSummary>('/me/favorites', { page, pageSize });
  const ids = (res.items || []).map((it) => it.id).filter(Boolean);
  if (page === 1) writeIds(ids);
  return res;
}

export async function listAchievementFavorites(page = 1, pageSize = 20): Promise<PagedAchievementSummary> {
  const res = await apiGet<PagedAchievementSummary>('/me/favorites/achievements', { page, pageSize });
  const ids = (res.items || []).map((it) => it.id).filter(Boolean);
  if (page === 1) writeAchievementIds(ids);
  return res;
}
