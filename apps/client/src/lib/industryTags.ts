import { useCallback, useEffect, useMemo, useState } from 'react';

import type { components } from '@ipmoney/api-types';

import { apiGet } from './api';

export type IndustryTag = components['schemas']['IndustryTag'];

type Cache = {
  tags: IndustryTag[] | null;
  inFlight: Promise<IndustryTag[]> | null;
};

const HIDDEN_TEST_TAG_PATTERNS = [
  /^smoke[-_\s]?tag(?:[-_\s]|$)/i,
  /^e2e[-_\s]?tag(?:[-_\s]|$)/i,
  /^qa[-_\s]?tag(?:[-_\s]|$)/i,
];

export function isVisibleIndustryTagName(name: string): boolean {
  const normalized = String(name || '').trim();
  if (!normalized) return false;
  return !HIDDEN_TEST_TAG_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function sanitizeIndustryTagNames(input: readonly unknown[] | null | undefined): string[] {
  if (!Array.isArray(input)) return [];
  const uniqueNormalized = new Set<string>();
  const sanitized: string[] = [];
  for (const item of input) {
    const normalized = String(item || '').trim();
    if (!isVisibleIndustryTagName(normalized)) continue;
    const dedupeKey = normalized.toLowerCase();
    if (uniqueNormalized.has(dedupeKey)) continue;
    uniqueNormalized.add(dedupeKey);
    sanitized.push(normalized);
  }
  return sanitized;
}

const cache: Cache = {
  tags: null,
  inFlight: null,
};

export async function listPublicIndustryTags(opts?: { force?: boolean }): Promise<IndustryTag[]> {
  const force = Boolean(opts?.force);
  if (!force && cache.tags) return cache.tags;
  if (!force && cache.inFlight) return cache.inFlight;

  const p = apiGet<IndustryTag[]>('/public/industry-tags').then((res) => {
    const tags = Array.isArray(res)
      ? res.filter((t) => t && typeof t === 'object' && isVisibleIndustryTagName(String((t as any).name || '')))
      : [];
    cache.tags = tags;
    cache.inFlight = null;
    return tags;
  });

  cache.inFlight = p;

  try {
    return await p;
  } catch (e) {
    // Allow retry.
    cache.inFlight = null;
    throw e;
  }
}

export function usePublicIndustryTags() {
  const [tags, setTags] = useState<IndustryTag[] | null>(() => cache.tags);
  const [loading, setLoading] = useState(() => cache.tags === null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await listPublicIndustryTags({ force: true });
      setTags(next);
    } catch (e: any) {
      setError(e?.message || 'Failed to load industry tags');
      setTags(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (cache.tags) return;
    void reload();
  }, [reload]);

  const names = useMemo(() => sanitizeIndustryTagNames((tags || []).map((t) => String(t.name || ''))), [tags]);

  return { tags, names, loading, error, reload };
}
