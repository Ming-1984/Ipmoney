const DETAIL_CACHE_TTL_MS = 60 * 1000;

type CacheRecord<T> = {
  data: T;
  updatedAt: number;
};

const detailCache = new Map<string, CacheRecord<unknown>>();

function buildKey(scope: string, id: string): string {
  const normalizedScope = String(scope || '').trim();
  const normalizedId = String(id || '').trim();
  if (!normalizedScope || !normalizedId) return '';
  return `${normalizedScope}:${normalizedId}`;
}

export function getDetailCache<T>(scope: string, id: string): T | null {
  const key = buildKey(scope, id);
  if (!key) return null;
  const cached = detailCache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.updatedAt > DETAIL_CACHE_TTL_MS) {
    detailCache.delete(key);
    return null;
  }
  return cached.data as T;
}

export function setDetailCache<T>(scope: string, id: string, data: T) {
  const key = buildKey(scope, id);
  if (!key) return;
  detailCache.set(key, { data, updatedAt: Date.now() });
}

export function clearDetailCache(scope?: string, id?: string) {
  const hasScope = Boolean(String(scope || '').trim());
  const hasId = Boolean(String(id || '').trim());
  if (!hasScope && !hasId) {
    detailCache.clear();
    return;
  }
  if (hasScope && hasId) {
    const key = buildKey(String(scope), String(id));
    if (key) detailCache.delete(key);
    return;
  }
  if (hasScope) {
    const prefix = `${String(scope).trim()}:`;
    for (const key of detailCache.keys()) {
      if (key.startsWith(prefix)) detailCache.delete(key);
    }
  }
}
