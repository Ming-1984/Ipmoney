const PATENT_CACHE_TTL_MS = 60 * 1000;

type CacheRecord<T> = {
  data: T;
  updatedAt: number;
};

const patentCache = new Map<string, CacheRecord<unknown>>();

export function getPatentCache<T>(patentId: string): T | null {
  const key = String(patentId || '').trim();
  if (!key) return null;
  const cached = patentCache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.updatedAt > PATENT_CACHE_TTL_MS) {
    patentCache.delete(key);
    return null;
  }
  return cached.data as T;
}

export function setPatentCache<T>(patentId: string, data: T) {
  const key = String(patentId || '').trim();
  if (!key) return;
  patentCache.set(key, { data, updatedAt: Date.now() });
}

export function clearPatentCache(patentId?: string) {
  if (!patentId) {
    patentCache.clear();
    return;
  }
  const key = String(patentId || '').trim();
  if (!key) return;
  patentCache.delete(key);
}
