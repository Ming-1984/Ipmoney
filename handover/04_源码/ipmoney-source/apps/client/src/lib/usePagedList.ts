import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type PageInfo = { page: number; pageSize: number; total: number };

export type PagedResult<T> = {
  items: T[];
  page?: PageInfo;
};

type ErrorContext = 'load' | 'refresh' | 'loadMore';

type UsePagedListOptions = {
  pageSize?: number;
  onError?: (message: string, ctx: ErrorContext) => void;
  keepItemsOnRefreshError?: boolean;
};

export function usePagedList<T>(
  fetcher: (args: { page: number; pageSize: number }) => Promise<PagedResult<T>>,
  options?: UsePagedListOptions,
) {
  const pageSize = options?.pageSize ?? 20;
  const requestIdRef = useRef(0);
  const onErrorRef = useRef<UsePagedListOptions['onError']>(options?.onError);
  const keepItemsOnRefreshErrorRef = useRef<boolean>(options?.keepItemsOnRefreshError ?? true);

  const [items, setItemsState] = useState<T[]>([]);
  const [pageInfo, setPageInfo] = useState<PageInfo | null>(null);
  const [page, setPage] = useState(1);
  const [lastCount, setLastCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const itemsLengthRef = useRef(0);
  const loadingRef = useRef(false);
  const refreshingRef = useRef(false);
  const loadingMoreRef = useRef(false);

  useEffect(() => {
    onErrorRef.current = options?.onError;
    keepItemsOnRefreshErrorRef.current = options?.keepItemsOnRefreshError ?? true;
  }, [options?.onError, options?.keepItemsOnRefreshError]);

  useEffect(() => {
    itemsLengthRef.current = items.length;
  }, [items.length]);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    refreshingRef.current = refreshing;
  }, [refreshing]);

  useEffect(() => {
    loadingMoreRef.current = loadingMore;
  }, [loadingMore]);

  const setItems = useCallback((next: T[] | ((prev: T[]) => T[])) => {
    setItemsState((prev) => {
      const value = typeof next === 'function' ? (next as (p: T[]) => T[])(prev) : next;
      return value;
    });
  }, []);

  const applyResult = useCallback(
    (result: PagedResult<T>, targetPage: number, append: boolean) => {
      const incoming = Array.isArray(result?.items) ? result.items : [];
      setLastCount(incoming.length);
      setPage(targetPage);
      setPageInfo(result.page ?? null);
      setItems((prev) => (append ? [...prev, ...incoming] : incoming));
    },
    [setItems],
  );

  const loadPage = useCallback(
    async (targetPage: number, ctx: ErrorContext, append: boolean) => {
      const requestId = ++requestIdRef.current;
      if (ctx === 'load') {
        loadingRef.current = true;
        setLoading(true);
      }
      if (ctx === 'refresh') {
        refreshingRef.current = true;
        setRefreshing(true);
      }
      if (ctx === 'loadMore') {
        loadingMoreRef.current = true;
        setLoadingMore(true);
      }
      if (ctx !== 'loadMore') setError(null);

      try {
        const result = await fetcher({ page: targetPage, pageSize });
        if (requestId !== requestIdRef.current) return;
        applyResult(result, targetPage, append);
        setError(null);
      } catch (e: any) {
        if (requestId !== requestIdRef.current) return;
        const message = e?.message || '加载失败';
        const hasItems = itemsLengthRef.current > 0;
        const keepOnRefresh = ctx === 'refresh' && keepItemsOnRefreshErrorRef.current && hasItems;
        if (ctx === 'loadMore' && itemsLengthRef.current > 0) {
          onErrorRef.current?.(message, ctx);
        } else if (keepOnRefresh) {
          onErrorRef.current?.(message, ctx);
        } else {
          setError(message);
          if (!append) setItems([]);
          onErrorRef.current?.(message, ctx);
        }
      } finally {
        if (requestId === requestIdRef.current) {
          if (ctx === 'load') {
            loadingRef.current = false;
            setLoading(false);
          }
          if (ctx === 'refresh') {
            refreshingRef.current = false;
            setRefreshing(false);
          }
          if (ctx === 'loadMore') {
            loadingMoreRef.current = false;
            setLoadingMore(false);
          }
        }
      }
    },
    [applyResult, fetcher, pageSize, setItems],
  );

  const reload = useCallback(async () => {
    // Force a fresh first-page load: cancel stale inflight requests and bypass
    // transient loading flags so route-prefill auto search can reliably trigger.
    requestIdRef.current += 1;
    loadingRef.current = false;
    refreshingRef.current = false;
    loadingMoreRef.current = false;
    setLoading(false);
    setRefreshing(false);
    setLoadingMore(false);
    await loadPage(1, 'load', false);
  }, [loadPage]);

  const refresh = useCallback(async () => {
    if (loadingRef.current || refreshingRef.current || loadingMoreRef.current) return;
    await loadPage(1, 'refresh', false);
  }, [loadPage]);

  const hasMore = useMemo(() => {
    if (pageInfo) {
      return pageInfo.page * pageInfo.pageSize < pageInfo.total;
    }
    return lastCount >= pageSize;
  }, [lastCount, pageInfo, pageSize]);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || refreshingRef.current || loadingMoreRef.current) return;
    if (!hasMore) return;
    await loadPage(page + 1, 'loadMore', true);
  }, [hasMore, loadPage, page]);

  const reset = useCallback(() => {
    requestIdRef.current += 1;
    loadingRef.current = false;
    refreshingRef.current = false;
    loadingMoreRef.current = false;
    itemsLengthRef.current = 0;
    setItems([]);
    setPage(1);
    setPageInfo(null);
    setLastCount(0);
    setError(null);
    setLoading(false);
    setRefreshing(false);
    setLoadingMore(false);
  }, [setItems]);

  return {
    items,
    setItems,
    pageInfo,
    page,
    loading,
    refreshing,
    loadingMore,
    error,
    hasMore,
    reload,
    refresh,
    loadMore,
    reset,
  };
}
