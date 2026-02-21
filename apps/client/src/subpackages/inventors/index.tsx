import { View, Text } from '@tarojs/components';
import React, { useCallback, useEffect } from 'react';
import './index.scss';

import { apiGet } from '../../lib/api';
import { usePagedList } from '../../lib/usePagedList';
import { ListFooter } from '../../ui/ListFooter';
import { PullToRefresh, toast } from '../../ui/nutui';
import { EmptyCard, ErrorCard, LoadingCard } from '../../ui/StateCards';

type InventorRankingItem = {
  inventorName: string;
  patentCount: number;
  listingCount: number;
  location?: string;
  typeLabel?: string;
  tags?: string[];
};

type PagedInventorRanking = {
  items: InventorRankingItem[];
  page: { page: number; pageSize: number; total: number };
};

const LABEL_RANK = '\u6392\u540d';
const LABEL_PATENT_COUNT = '\u4e13\u5229\u6570';
const LABEL_LISTING_COUNT = '\u5173\u8054\u4e0a\u67b6';
const LABEL_EMPTY = '\u6682\u65e0\u6570\u636e';
const LABEL_REFRESH = '\u5237\u65b0';

export default function InventorsPage() {
  const fetcher = useCallback(
    async ({ page, pageSize }: { page: number; pageSize: number }) =>
      apiGet<PagedInventorRanking>('/search/inventors', {
        page,
        pageSize,
      }),
    [],
  );

  const { items, loading, error, refreshing, loadingMore, hasMore, reload, refresh, loadMore } =
    usePagedList<InventorRankingItem>(fetcher, {
      pageSize: 20,
      onError: (message, ctx) => {
        if (ctx === 'loadMore') toast(message);
      },
    });

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <View className="container consult-page inventor-rank-page">
      <PullToRefresh type="primary" disabled={loading || refreshing} onRefresh={refresh}>
        {loading ? (
          <LoadingCard />
        ) : error ? (
          <ErrorCard message={error} onRetry={reload} />
        ) : items.length ? (
          <View className="inventor-rank-list">
            {items.map((it, idx) => {
              const rank = idx + 1;
              const isTop = rank <= 3;
              const typeLabel = it.typeLabel || '';
              const tags = it.tags || [];
              const showTags = Boolean(typeLabel || tags.length);
              return (
                <View key={`${it.inventorName}-${idx}`} className={`inventor-rank-card ${isTop ? 'is-top' : ''}`}>
                  <View className={`inventor-rank-badge ${isTop ? 'is-top' : ''} rank-${rank}`}>
                    <Text className="inventor-rank-badge-text">{rank}</Text>
                    <Text className="inventor-rank-badge-label">{LABEL_RANK}</Text>
                  </View>
                  <View className="inventor-rank-main">
                    <View className="inventor-rank-title-row">
                      <Text className="inventor-rank-name clamp-1">{it.inventorName}</Text>
                      {it.location ? <Text className="inventor-rank-location">{it.location}</Text> : null}
                    </View>
                    {showTags ? (
                      <View className="inventor-rank-tags">
                        {typeLabel ? <Text className="inventor-rank-chip inventor-rank-chip-primary">{typeLabel}</Text> : null}
                        {tags.map((tag) => (
                          <Text key={`${it.inventorName}-${tag}`} className="inventor-rank-chip">
                            {tag}
                          </Text>
                        ))}
                      </View>
                    ) : null}
                  </View>
                  <View className="inventor-rank-stats">
                    <View className="inventor-rank-stat">
                      <Text className="inventor-rank-stat-num">{it.patentCount}</Text>
                      <Text className="inventor-rank-stat-label">{LABEL_PATENT_COUNT}</Text>
                    </View>
                    <View className="inventor-rank-stat">
                      <Text className="inventor-rank-stat-num is-muted">{it.listingCount}</Text>
                      <Text className="inventor-rank-stat-label">{LABEL_LISTING_COUNT}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <EmptyCard message={LABEL_EMPTY} actionText={LABEL_REFRESH} onAction={reload} />
        )}

        {!loading && items.length ? (
          <ListFooter loadingMore={loadingMore} hasMore={hasMore} onLoadMore={loadMore} showNoMore />
        ) : null}
      </PullToRefresh>
    </View>
  );
}
