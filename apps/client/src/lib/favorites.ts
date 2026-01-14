import Taro from '@tarojs/taro';

import type { components } from '@ipmoney/api-types';

import { STORAGE_KEYS } from '../constants';
import { apiDelete, apiGet, apiPost } from './api';

type PagedListingSummary = components['schemas']['PagedListingSummary'];

function readIds(): string[] {
  const v = Taro.getStorageSync(STORAGE_KEYS.favoriteListingIds);
  if (Array.isArray(v)) return v.filter((x) => typeof x === 'string');
  return [];
}

function writeIds(ids: string[]) {
  const uniq = Array.from(new Set(ids.filter(Boolean))).slice(0, 500);
  Taro.setStorageSync(STORAGE_KEYS.favoriteListingIds, uniq);
}

export function getFavoriteListingIds(): string[] {
  return readIds();
}

export function isFavorited(listingId: string): boolean {
  if (!listingId) return false;
  return new Set(readIds()).has(listingId);
}

export async function syncFavorites(): Promise<string[]> {
  const res = await apiGet<PagedListingSummary>('/me/favorites', { page: 1, pageSize: 50 });
  const ids = (res.items || []).map((it) => it.id).filter(Boolean);
  writeIds(ids);
  return ids;
}

export async function favorite(listingId: string): Promise<void> {
  await apiPost<void>(`/listings/${listingId}/favorites`, {}, { idempotencyKey: `fav-${listingId}` });
  const next = new Set(readIds());
  next.add(listingId);
  writeIds(Array.from(next));
}

export async function unfavorite(listingId: string): Promise<void> {
  await apiDelete(`/listings/${listingId}/favorites`, { idempotencyKey: `unfav-${listingId}` });
  const next = new Set(readIds());
  next.delete(listingId);
  writeIds(Array.from(next));
}

export async function listFavorites(page = 1, pageSize = 20): Promise<PagedListingSummary> {
  const res = await apiGet<PagedListingSummary>('/me/favorites', { page, pageSize });
  const ids = (res.items || []).map((it) => it.id).filter(Boolean);
  if (page === 1) writeIds(ids);
  return res;
}
