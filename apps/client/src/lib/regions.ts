import Taro from '@tarojs/taro';

import type { components } from '@ipmoney/api-types';

import { STORAGE_KEYS } from '../constants';

type RegionNode = components['schemas']['RegionNode'];

type RegionNameMap = Record<string, string>;

let regionNameMapCache: RegionNameMap | null = null;

function readRegionNameMap(): RegionNameMap {
  if (regionNameMapCache) return regionNameMapCache;
  try {
    const raw = Taro.getStorageSync(STORAGE_KEYS.regionNameMap);
    if (raw && typeof raw === 'object') {
      regionNameMapCache = raw as RegionNameMap;
      return regionNameMapCache;
    }
  } catch {
    // ignore
  }
  regionNameMapCache = {};
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

