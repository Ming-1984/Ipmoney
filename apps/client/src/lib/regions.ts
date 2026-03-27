import Taro from '@tarojs/taro';

import type { components } from '@ipmoney/api-types';

import { apiGet } from './api';
import regionProvinceSeed from '../data/regions-cn-provinces.json';

import { STORAGE_KEYS } from '../constants';

type RegionNode = components['schemas']['RegionNode'];
type RegionLevel = components['schemas']['RegionLevel'];
type RegionPickerEventLike = {
  detail?: {
    value?: unknown;
    code?: unknown;
    postcode?: unknown;
  } | null;
};

type RegionNameMap = Record<string, string>;
const HIDDEN_TEST_REGION_NAME_PATTERNS = [
  /^smoke[-_\s/]*region(?:[-_\s/]|$)/i,
  /^e2e[-_\s/]*region(?:[-_\s/]|$)/i,
  /^qa[-_\s/]*region(?:[-_\s/]|$)/i,
];

const FALLBACK_REGION_NAMES: RegionNameMap = (regionProvinceSeed as Array<Pick<RegionNode, 'code' | 'name'>>).reduce(
  (acc, item) => {
    const code = (item?.code || '').trim();
    const name = (item?.name || '').trim();
    if (code && name) acc[code] = name;
    return acc;
  },
  {} as RegionNameMap,
);

let regionNameMapCache: RegionNameMap | null = null;
let regionNamesReady = false;
let regionNamesLoading: Promise<void> | null = null;

function isVisibleRegionName(name: string): boolean {
  const normalized = String(name || '').trim();
  if (!normalized) return false;
  return !HIDDEN_TEST_REGION_NAME_PATTERNS.some((pattern) => pattern.test(normalized));
}

function sanitizeRegionNameMap(raw: unknown): RegionNameMap {
  if (!raw || typeof raw !== 'object') return {};
  const normalizedMap: RegionNameMap = {};
  for (const [rawCode, rawName] of Object.entries(raw as Record<string, unknown>)) {
    const code = String(rawCode || '').trim();
    const name = String(rawName || '').trim();
    if (!code || !isVisibleRegionName(name)) continue;
    normalizedMap[code] = name;
  }
  return normalizedMap;
}

function readRegionNameMap(): RegionNameMap {
  if (regionNameMapCache) return regionNameMapCache;
  try {
    const raw = Taro.getStorageSync(STORAGE_KEYS.regionNameMap);
    if (raw && typeof raw === 'object') {
      regionNameMapCache = { ...FALLBACK_REGION_NAMES, ...sanitizeRegionNameMap(raw) };
      return regionNameMapCache;
    }
  } catch {
    // ignore
  }
  regionNameMapCache = { ...FALLBACK_REGION_NAMES };
  return regionNameMapCache;
}

function writeRegionNameMap(map: RegionNameMap) {
  regionNameMapCache = map;
  try {
    Taro.setStorageSync(STORAGE_KEYS.regionNameMap, map);
  } catch {
    // ignore
  }
}

export function cacheRegionNames(nodes: Array<Pick<RegionNode, 'code' | 'name'> | null | undefined>) {
  const map = readRegionNameMap();
  let changed = false;

  for (const n of nodes) {
    const code = (n?.code || '').trim();
    const name = (n?.name || '').trim();
    if (!code || !isVisibleRegionName(name)) continue;
    if (map[code] === name) continue;
    map[code] = name;
    changed = true;
  }

  if (changed) writeRegionNameMap(map);
}

function normalizeRegionPath(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw
      .map((item) => String(item || '').trim())
      .filter(Boolean);
  }
  const text = String(raw || '').trim();
  if (!text) return [];
  if (text.includes(',')) {
    return text
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [text];
}

function looksLikeRegionCode(value: string): boolean {
  return /^\d{2,}$/.test(value);
}

export type RegionPickerSelection = {
  code: string;
  name: string;
  level: RegionLevel;
  pathCodes: string[];
  pathNames: string[];
};

export function parseRegionPickerSelection(input: unknown): RegionPickerSelection | null {
  const detail =
    (input as RegionPickerEventLike | null | undefined)?.detail &&
    typeof (input as RegionPickerEventLike).detail === 'object'
      ? (input as RegionPickerEventLike).detail
      : (input as RegionPickerEventLike['detail']);

  const rawPathNames = normalizeRegionPath(detail?.value);
  const rawPathCodesFromCode = normalizeRegionPath(detail?.code);
  const rawPathCodesFromPostcode = normalizeRegionPath(detail?.postcode);
  let pathCodes = rawPathCodesFromCode.length ? rawPathCodesFromCode : rawPathCodesFromPostcode;
  let pathNames = rawPathNames;

  if (!pathCodes.length && rawPathNames.length && rawPathNames.every(looksLikeRegionCode)) {
    pathCodes = rawPathNames;
    pathNames = [];
  }

  if (!pathCodes.length) return null;

  cacheRegionNames(
    pathCodes.map((code, index) => ({
      code,
      name: pathNames[index] || '',
    })),
  );

  if (!pathNames.length) {
    pathNames = pathCodes.map((code) => regionNameByCode(code) || '');
  }

  const code = pathCodes[pathCodes.length - 1] || '';
  if (!code) return null;

  const name = (pathNames[pathNames.length - 1] || regionNameByCode(code) || code).trim();
  const level: RegionLevel = pathCodes.length >= 3 ? 'DISTRICT' : pathCodes.length === 2 ? 'CITY' : 'PROVINCE';

  return {
    code,
    name: name || code,
    level,
    pathCodes,
    pathNames,
  };
}

export function regionNameByCode(code?: string | null): string | null {
  if (!code) return null;
  const map = readRegionNameMap();
  return map[code] || null;
}

export function regionDisplayName(code?: string | null, name?: string | null, empty = '-'): string {
  const n = (name || '').trim();
  if (n) return n;
  const c = (code || '').trim();
  if (!c) return empty;
  return regionNameByCode(c) || c;
}

export function hasRegionNameCache(): boolean {
  const map = readRegionNameMap();
  return Object.keys(map).length > 0;
}

export async function ensureRegionNamesReady(levels: RegionLevel[] = ['PROVINCE', 'CITY', 'DISTRICT']): Promise<void> {
  if (regionNamesReady) return;
  if (regionNamesLoading) return regionNamesLoading;

  regionNamesLoading = (async () => {
    const requests = levels.map((level) =>
      apiGet<RegionNode[]>('/regions', { level })
        .then((nodes) => cacheRegionNames(nodes))
        .catch(() => {}),
    );
    await Promise.all(requests);
    regionNamesReady = true;
  })().finally(() => {
    regionNamesLoading = null;
  });

  return regionNamesLoading;
}
