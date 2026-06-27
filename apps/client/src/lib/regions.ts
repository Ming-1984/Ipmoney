import Taro from '@tarojs/taro';

import type { components } from '@ipmoney/api-types';

import { apiGet } from './api';
import regionSeed from '../data/regions-cn.json';

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
type RegionParentMap = Record<string, string>;
type RegionPathNameMap = Record<string, string>;
type ProfileRegionPathNameMap = Record<string, string>;
const HIDDEN_TEST_REGION_NAME_PATTERNS = [
  /^smoke[-_\s/]*region(?:[-_\s/]|$)/i,
  /^e2e[-_\s/]*region(?:[-_\s/]|$)/i,
  /^qa[-_\s/]*region(?:[-_\s/]|$)/i,
];

const FALLBACK_REGION_NAMES: RegionNameMap = (regionSeed as Array<Pick<RegionNode, 'code' | 'name'>>).reduce(
  (acc, item) => {
    const code = (item?.code || '').trim();
    const name = (item?.name || '').trim();
    if (code && name) acc[code] = name;
    return acc;
  },
  {} as RegionNameMap,
);
const FALLBACK_REGION_PARENTS: RegionParentMap = (
  regionSeed as Array<Pick<RegionNode, 'code' | 'parentCode'>>
).reduce((acc, item) => {
  const code = (item?.code || '').trim();
  const parentCode = (item?.parentCode || '').trim();
  if (code && parentCode) acc[code] = parentCode;
  return acc;
}, {} as RegionParentMap);

let regionNameMapCache: RegionNameMap | null = null;
let regionParentMapCache: RegionParentMap | null = null;
let regionPathNameMapCache: RegionPathNameMap | null = null;
let profileRegionPathNameMapCache: ProfileRegionPathNameMap | null = null;
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

function sanitizeRegionParentMap(raw: unknown): RegionParentMap {
  if (!raw || typeof raw !== 'object') return {};
  const normalizedMap: RegionParentMap = {};
  for (const [rawCode, rawParentCode] of Object.entries(raw as Record<string, unknown>)) {
    const code = String(rawCode || '').trim();
    const parentCode = String(rawParentCode || '').trim();
    if (!/^\d{6}$/.test(code) || !/^\d{6}$/.test(parentCode)) continue;
    normalizedMap[code] = parentCode;
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

function readRegionParentMap(): RegionParentMap {
  if (regionParentMapCache) return regionParentMapCache;
  try {
    const raw = Taro.getStorageSync(STORAGE_KEYS.regionParentMap);
    if (raw && typeof raw === 'object') {
      regionParentMapCache = { ...FALLBACK_REGION_PARENTS, ...sanitizeRegionParentMap(raw) };
      return regionParentMapCache;
    }
  } catch {
    // ignore
  }
  regionParentMapCache = { ...FALLBACK_REGION_PARENTS };
  return regionParentMapCache;
}

function writeRegionParentMap(map: RegionParentMap) {
  regionParentMapCache = map;
  try {
    Taro.setStorageSync(STORAGE_KEYS.regionParentMap, map);
  } catch {
    // ignore
  }
}

function writeRegionNameMap(map: RegionNameMap) {
  regionNameMapCache = map;
  try {
    Taro.setStorageSync(STORAGE_KEYS.regionNameMap, map);
  } catch {
    // ignore
  }
}

function readRegionPathNameMap(): RegionPathNameMap {
  if (regionPathNameMapCache) return regionPathNameMapCache;
  try {
    const raw = Taro.getStorageSync(STORAGE_KEYS.regionPathNameMap);
    if (raw && typeof raw === 'object') {
      regionPathNameMapCache = sanitizeRegionNameMap(raw);
      return regionPathNameMapCache;
    }
  } catch {
    // ignore
  }
  regionPathNameMapCache = {};
  return regionPathNameMapCache;
}

function writeRegionPathNameMap(map: RegionPathNameMap) {
  regionPathNameMapCache = map;
  try {
    Taro.setStorageSync(STORAGE_KEYS.regionPathNameMap, map);
  } catch {
    // ignore
  }
}

function readProfileRegionPathNameMap(): ProfileRegionPathNameMap {
  if (profileRegionPathNameMapCache) return profileRegionPathNameMapCache;
  try {
    const raw = Taro.getStorageSync(STORAGE_KEYS.profileRegionPathNameMap);
    if (raw && typeof raw === 'object') {
      profileRegionPathNameMapCache = sanitizeRegionNameMap(raw);
      return profileRegionPathNameMapCache;
    }
  } catch {
    // ignore
  }
  profileRegionPathNameMapCache = {};
  return profileRegionPathNameMapCache;
}

function writeProfileRegionPathNameMap(map: ProfileRegionPathNameMap) {
  profileRegionPathNameMapCache = map;
  try {
    Taro.setStorageSync(STORAGE_KEYS.profileRegionPathNameMap, map);
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

function cacheRegionParents(nodes: Array<Pick<RegionNode, 'code' | 'parentCode'> | null | undefined>) {
  const map = readRegionParentMap();
  let changed = false;

  for (const n of nodes) {
    const code = (n?.code || '').trim();
    const parentCode = (n?.parentCode || '').trim();
    if (!/^\d{6}$/.test(code) || !/^\d{6}$/.test(parentCode)) continue;
    if (map[code] === parentCode) continue;
    map[code] = parentCode;
    changed = true;
  }

  if (changed) writeRegionParentMap(map);
}

function cacheRegionPathName(code: string, pathNames: string[]) {
  const c = String(code || '').trim();
  const pathName = formatRegionPathNames(pathNames);
  if (!c || !isVisibleRegionName(pathName)) return;

  const map = readRegionPathNameMap();
  if (map[c] === pathName) return;
  map[c] = pathName;
  writeRegionPathNameMap(map);
}

function buildProfileRegionPathNameKey(profileId?: string | null, code?: string | null): string {
  const id = String(profileId || '').trim();
  const c = String(code || '').trim();
  return id && c ? `${id}:${c}` : '';
}

export function cacheProfileRegionPathName(profileId?: string | null, code?: string | null, pathName?: string | null) {
  const key = buildProfileRegionPathNameKey(profileId, code);
  const name = String(pathName || '').trim();
  if (!key || !isVisibleRegionName(name)) return;

  const map = readProfileRegionPathNameMap();
  if (map[key] === name) return;
  map[key] = name;
  writeProfileRegionPathNameMap(map);
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

function normalizeRegionName(name: string): string {
  return String(name || '').trim();
}

function findRegionCodeByName(name: string): string {
  const normalized = normalizeRegionName(name);
  if (!normalized) return '';
  const map = readRegionNameMap();
  for (const [code, itemName] of Object.entries(map)) {
    if (normalizeRegionName(itemName) === normalized) return code;
  }
  return '';
}

function completePathCodes(pathCodes: string[], pathNames: string[]): string[] {
  if (pathCodes.length >= pathNames.length || pathNames.length <= 1) return pathCodes;

  const completed = pathNames.map((name) => findRegionCodeByName(name));
  const selectedCode = pathCodes[pathCodes.length - 1] || '';
  if (selectedCode && !completed[completed.length - 1]) {
    completed[completed.length - 1] = selectedCode;
  }

  return completed.every(Boolean) ? completed : pathCodes;
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

  pathCodes = completePathCodes(pathCodes, pathNames);

  if (!pathCodes.length && rawPathNames.length && rawPathNames.every(looksLikeRegionCode)) {
    pathCodes = rawPathNames;
    pathNames = [];
  }

  if (!pathCodes.length) return null;

  if (!pathNames.length) {
    pathNames = pathCodes.map((code) => regionNameByCode(code) || '');
  }

  const code = pathCodes[pathCodes.length - 1] || '';
  if (!code) return null;

  const nameNodes =
    pathCodes.length === pathNames.length
      ? pathCodes.map((itemCode, index) => ({
          code: itemCode,
          name: pathNames[index] || '',
        }))
      : pathCodes.length === 1 && pathNames.length > 1
        ? []
        : pathCodes.length === 1
          ? [
              {
                code,
                name: pathNames[pathNames.length - 1] || '',
              },
            ]
        : pathCodes.map((itemCode, index) => ({
            code: itemCode,
            name: pathNames[index] || '',
          }));
  cacheRegionNames(nameNodes);
  cacheRegionPathName(code, pathNames);

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

function regionPathNamesByCode(code?: string | null): string[] {
  const c = String(code || '').trim();
  if (!c) return [];
  const nameMap = readRegionNameMap();
  const parentMap = readRegionParentMap();
  const pathCodes: string[] = [];
  const seen = new Set<string>();
  let current = c;

  while (current && !seen.has(current)) {
    seen.add(current);
    pathCodes.unshift(current);
    current = parentMap[current] || '';
  }

  return pathCodes.map((itemCode) => nameMap[itemCode] || '').filter(Boolean);
}

export function regionDisplayName(code?: string | null, name?: string | null, empty = '-'): string {
  const n = (name || '').trim();
  if (n) return n;
  const c = (code || '').trim();
  if (!c) return empty;
  const pathName = readRegionPathNameMap()[c];
  if (pathName) return pathName;
  const pathNames = regionPathNamesByCode(c);
  if (pathNames.length > 1) return formatRegionPathNames(pathNames);
  return regionNameByCode(c) || c;
}

export function profileRegionDisplayName(
  profileId?: string | null,
  code?: string | null,
  name?: string | null,
  empty = '-',
): string {
  const n = String(name || '').trim();
  if (n) return n;
  const key = buildProfileRegionPathNameKey(profileId, code);
  if (key) {
    const pathName = readProfileRegionPathNameMap()[key];
    if (pathName) return pathName;
  }
  return regionDisplayName(code, undefined, empty);
}

export function formatRegionPathNames(pathNames?: string[] | null, fallback = ''): string {
  const names = (pathNames || []).map((name) => String(name || '').trim()).filter(Boolean);
  return names.length ? names.join(' ') : fallback.trim();
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
        .then((nodes) => {
          cacheRegionNames(nodes);
          cacheRegionParents(nodes);
        })
        .catch(() => {}),
    );
    await Promise.all(requests);
    regionNamesReady = true;
  })().finally(() => {
    regionNamesLoading = null;
  });

  return regionNamesLoading;
}
