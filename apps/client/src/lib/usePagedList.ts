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
  const keepItemsOnRefreshErrorRef = useRef<boolean>(Boolean(options?.keepItemsOnRefreshError));

  const [items, setItemsState] = useState<T[]>([]);
  const [pageInfo, setPageInfo] = useState<PageInfo | null>(null);
  const [page, setPage] = useState(1);
  const [lastCount, setLastCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const itemsLengthRef = useRef(0);

  useEffect(() => {
    onErrorRef.current = options?.onError;
    keepItemsOnRefreshErrorRef.current = Boolean(options?.keepItemsOnRefreshError);
  }, [options?.onError, options?.keepItemsOnRefreshError]);

  useEffect(() => {
    itemsLengthRef.current = items.length;
  }, [items.length]);

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
      if (ctx === 'load') setLoading(true);
      if (ctx === 'refresh') setRefreshing(true);
      if (ctx === 'loadMore') setLoadingMore(true);
      if (ctx !== 'loadMore') setError(null);

      try {
        const result = await fetcher({ page: targetPage, pageSize });
        if (requestId !== requestIdRef.current) return;
        applyResult(result, targetPage, append);
        setError(null);
      } catch (e: any) {
        if (requestId !== requestIdRef.current) return;
        const message = e?.message || '加载失败';
        const keepOnRefresh = ctx === 'refresh' && keepItemsOnRefreshErrorRef.current;
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
          if (ctx === 'load') setLoading(false);
          if (ctx === 'refresh') setRefreshing(false);
          if (ctx === 'loadMore') setLoadingMore(false);
        }
      }
    },
    [applyResult, fetcher, pageSize, setItems],
  );

  const reload = useCallback(async () => {
    await loadPage(1, 'load', false);
  }, [loadPage]);

  const refresh = useCallback(async () => {
    await loadPage(1, 'refresh', false);
  }, [loadPage]);

  const hasMore = useMemo(() => {
    if (pageInfo) {
      return pageInfo.page * pageInfo.pageSize < pageInfo.total;
    }
    return lastCount >= pageSize;
  }, [lastCount, pageInfo, pageSize]);

  const loadMore = useCallback(async () => {
    if (loading || refreshing || loadingMore) return;
    if (!hasMore) return;
    await loadPage(page + 1, 'loadMore', true);
  }, [hasMore, loadPage, loading, loadingMore, page, refreshing]);

  const reset = useCallback(() => {
    requestIdRef.current += 1;
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
