import Taro from '@tarojs/taro';

import type { components } from '@ipmoney/api-types';

import { apiGet } from './api';
import regionProvinceSeed from '../data/regions-cn-provinces.json';

import { STORAGE_KEYS } from '../constants';

type RegionNode = components['schemas']['RegionNode'];
type RegionLevel = components['schemas']['RegionLevel'];

type RegionNameMap = Record<string, string>;

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

function readRegionNameMap(): RegionNameMap {
  if (regionNameMapCache) return regionNameMapCache;
  try {
    const raw = Taro.getStorageSync(STORAGE_KEYS.regionNameMap);
    if (raw && typeof raw === 'object') {
      regionNameMapCache = { ...FALLBACK_REGION_NAMES, ...(raw as RegionNameMap) };
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
    if (!code || !name) continue;
    if (map[code] === name) continue;
    map[code] = name;
    changed = true;
  }

  if (changed) writeRegionNameMap(map);
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
