import Taro from '@tarojs/taro';

import type { components } from '@ipmoney/api-types';

import { STORAGE_KEYS } from '../constants';
import { apiDelete, apiGet, apiPost } from './api';

type PagedListingSummary = components['schemas']['PagedListingSummary'];
type PagedDemandSummary = components['schemas']['PagedDemandSummary'];
type PagedAchievementSummary = components['schemas']['PagedAchievementSummary'];
type PagedArtworkSummary = components['schemas']['PagedArtworkSummary'];

function readIds(): string[] {
  const v = Taro.getStorageSync(STORAGE_KEYS.favoriteListingIds);
  if (Array.isArray(v)) return v.filter((x) => typeof x === 'string');
  return [];
}

function writeIds(ids: string[]) {
  const uniq = Array.from(new Set(ids.filter(Boolean))).slice(0, 500);
  Taro.setStorageSync(STORAGE_KEYS.favoriteListingIds, uniq);
}

function readDemandIds(): string[] {
  const v = Taro.getStorageSync(STORAGE_KEYS.favoriteDemandIds);
  if (Array.isArray(v)) return v.filter((x) => typeof x === 'string');
  return [];
}

function writeDemandIds(ids: string[]) {
  const uniq = Array.from(new Set(ids.filter(Boolean))).slice(0, 500);
  Taro.setStorageSync(STORAGE_KEYS.favoriteDemandIds, uniq);
}

function readAchievementIds(): string[] {
  const v = Taro.getStorageSync(STORAGE_KEYS.favoriteAchievementIds);
  if (Array.isArray(v)) return v.filter((x) => typeof x === 'string');
  return [];
}

function writeAchievementIds(ids: string[]) {
  const uniq = Array.from(new Set(ids.filter(Boolean))).slice(0, 500);
  Taro.setStorageSync(STORAGE_KEYS.favoriteAchievementIds, uniq);
}

function readArtworkIds(): string[] {
  const v = Taro.getStorageSync(STORAGE_KEYS.favoriteArtworkIds);
  if (Array.isArray(v)) return v.filter((x) => typeof x === 'string');
  return [];
}

function writeArtworkIds(ids: string[]) {
  const uniq = Array.from(new Set(ids.filter(Boolean))).slice(0, 500);
  Taro.setStorageSync(STORAGE_KEYS.favoriteArtworkIds, uniq);
}

export function getFavoriteListingIds(): string[] {
  return readIds();
}

export function isFavorited(listingId: string): boolean {
  if (!listingId) return false;
  return new Set(readIds()).has(listingId);
}

export function getFavoriteDemandIds(): string[] {
  return readDemandIds();
}

export function isDemandFavorited(demandId: string): boolean {
  if (!demandId) return false;
  return new Set(readDemandIds()).has(demandId);
}

export function getFavoriteAchievementIds(): string[] {
  return readAchievementIds();
}

export function isAchievementFavorited(achievementId: string): boolean {
  if (!achievementId) return false;
  return new Set(readAchievementIds()).has(achievementId);
}

export function getFavoriteArtworkIds(): string[] {
  return readArtworkIds();
}

export function isArtworkFavorited(artworkId: string): boolean {
  if (!artworkId) return false;
  return new Set(readArtworkIds()).has(artworkId);
}

export async function syncFavorites(): Promise<string[]> {
  const res = await apiGet<PagedListingSummary>('/me/favorites', { page: 1, pageSize: 50 });
  const ids = (res.items || []).map((it) => it.id).filter(Boolean);
  writeIds(ids);
  return ids;
}

export async function syncFavoriteDemands(): Promise<string[]> {
  const res = await apiGet<PagedDemandSummary>('/me/favorites/demands', { page: 1, pageSize: 50 });
  const ids = (res.items || []).map((it) => it.id).filter(Boolean);
  writeDemandIds(ids);
  return ids;
}

export async function syncFavoriteAchievements(): Promise<string[]> {
  const res = await apiGet<PagedAchievementSummary>('/me/favorites/achievements', { page: 1, pageSize: 50 });
  const ids = (res.items || []).map((it) => it.id).filter(Boolean);
  writeAchievementIds(ids);
  return ids;
}

export async function syncFavoriteArtworks(): Promise<string[]> {
  const res = await apiGet<PagedArtworkSummary>('/me/favorites/artworks', { page: 1, pageSize: 50 });
  const ids = (res.items || []).map((it) => it.id).filter(Boolean);
  writeArtworkIds(ids);
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

export async function favoriteDemand(demandId: string): Promise<void> {
  await apiPost<void>(`/demands/${demandId}/favorites`, {}, { idempotencyKey: `fav-demand-${demandId}` });
  const next = new Set(readDemandIds());
  next.add(demandId);
  writeDemandIds(Array.from(next));
}

export async function unfavoriteDemand(demandId: string): Promise<void> {
  await apiDelete(`/demands/${demandId}/favorites`, { idempotencyKey: `unfav-demand-${demandId}` });
  const next = new Set(readDemandIds());
  next.delete(demandId);
  writeDemandIds(Array.from(next));
}

export async function favoriteAchievement(achievementId: string): Promise<void> {
  await apiPost<void>(`/achievements/${achievementId}/favorites`, {}, { idempotencyKey: `fav-achievement-${achievementId}` });
  const next = new Set(readAchievementIds());
  next.add(achievementId);
  writeAchievementIds(Array.from(next));
}

export async function unfavoriteAchievement(achievementId: string): Promise<void> {
  await apiDelete(`/achievements/${achievementId}/favorites`, { idempotencyKey: `unfav-achievement-${achievementId}` });
  const next = new Set(readAchievementIds());
  next.delete(achievementId);
  writeAchievementIds(Array.from(next));
}

export async function favoriteArtwork(artworkId: string): Promise<void> {
  await apiPost<void>(`/artworks/${artworkId}/favorites`, {}, { idempotencyKey: `fav-artwork-${artworkId}` });
  const next = new Set(readArtworkIds());
  next.add(artworkId);
  writeArtworkIds(Array.from(next));
}

export async function unfavoriteArtwork(artworkId: string): Promise<void> {
  await apiDelete(`/artworks/${artworkId}/favorites`, { idempotencyKey: `unfav-artwork-${artworkId}` });
  const next = new Set(readArtworkIds());
  next.delete(artworkId);
  writeArtworkIds(Array.from(next));
}

export async function listFavorites(page = 1, pageSize = 20): Promise<PagedListingSummary> {
  const res = await apiGet<PagedListingSummary>('/me/favorites', { page, pageSize });
  const ids = (res.items || []).map((it) => it.id).filter(Boolean);
  if (page === 1) writeIds(ids);
  return res;
}

export async function listFavoriteDemands(page = 1, pageSize = 20): Promise<PagedDemandSummary> {
  const res = await apiGet<PagedDemandSummary>('/me/favorites/demands', { page, pageSize });
  const ids = (res.items || []).map((it) => it.id).filter(Boolean);
  if (page === 1) writeDemandIds(ids);
  return res;
}

export async function listFavoriteAchievements(page = 1, pageSize = 20): Promise<PagedAchievementSummary> {
  const res = await apiGet<PagedAchievementSummary>('/me/favorites/achievements', { page, pageSize });
  const ids = (res.items || []).map((it) => it.id).filter(Boolean);
  if (page === 1) writeAchievementIds(ids);
  return res;
}

export async function listFavoriteArtworks(page = 1, pageSize = 20): Promise<PagedArtworkSummary> {
  const res = await apiGet<PagedArtworkSummary>('/me/favorites/artworks', { page, pageSize });
  const ids = (res.items || []).map((it) => it.id).filter(Boolean);
  if (page === 1) writeArtworkIds(ids);
  return res;
}
