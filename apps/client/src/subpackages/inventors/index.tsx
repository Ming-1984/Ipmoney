import { View, Text, Image } from '@tarojs/components';
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
  avatarUrl?: string | null;
  location?: string;
  typeLabel?: string;
  tags?: string[];
};

type PagedInventorRanking = {
  items: InventorRankingItem[];
  page: { page: number; pageSize: number; total: number };
};

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
          (() => {
            const topItems = items.slice(0, 3);
            const restItems = items.slice(3);
            return (
              <View className="inventor-rank-content">
                {topItems.length ? (
                  <View className="inventor-rank-podium">
                    {topItems.map((it, idx) => {
                      const rank = idx + 1;
                      const avatar = String(it.avatarUrl || '').trim();
                      const initial = (it.inventorName || '').trim().slice(0, 1) || '发';
                      return (
                        <View key={`${it.inventorName}-${rank}`} className={`inventor-podium-card rank-${rank}`}>
                          <View className={`inventor-podium-badge rank-${rank}`}>
                            <Text className="inventor-podium-badge-text">{rank}</Text>
                          </View>
                          <View className={`inventor-podium-avatar rank-${rank}`}>
                            {avatar ? (
                              <Image className="inventor-podium-avatar-img" src={avatar} mode="aspectFill" />
                            ) : (
                              <Text className="inventor-podium-avatar-text">{initial}</Text>
                            )}
                          </View>
                          <Text className="inventor-podium-name clamp-1">{it.inventorName}</Text>
                          <View className="inventor-podium-stats">
                            <Text className="inventor-podium-score">{it.patentCount}</Text>
                            <Text className="inventor-podium-score-label">{LABEL_PATENT_COUNT}</Text>
                            <Text className="inventor-podium-subscore">{LABEL_LISTING_COUNT} {it.listingCount}</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                ) : null}

                {restItems.length ? (
                  <View className="inventor-rank-list compact">
                    {restItems.map((it, idx) => {
                      const rank = idx + 4;
                      const typeLabel = it.typeLabel || '';
                      const tags = it.tags || [];
                      const showTags = Boolean(typeLabel || tags.length || it.location);
                      const avatar = String(it.avatarUrl || '').trim();
                      const initial = (it.inventorName || '').trim().slice(0, 1) || '发';
                      return (
                        <View key={`${it.inventorName}-${rank}`} className="inventor-rank-row">
                          <View className={`inventor-rank-row-badge rank-${rank}`}>
                            <Text className="inventor-rank-row-badge-text">{rank}</Text>
                          </View>
                          <View className="inventor-rank-row-avatar">
                            {avatar ? (
                              <Image className="inventor-rank-row-avatar-img" src={avatar} mode="aspectFill" />
                            ) : (
                              <Text className="inventor-rank-row-avatar-text">{initial}</Text>
                            )}
                          </View>
                          <View className="inventor-rank-row-main">
                            <Text className="inventor-rank-row-name clamp-1">{it.inventorName}</Text>
                            {showTags ? (
                              <View className="inventor-rank-tags">
                                {it.location ? <Text className="inventor-rank-chip">{it.location}</Text> : null}
                                {typeLabel ? <Text className="inventor-rank-chip inventor-rank-chip-primary">{typeLabel}</Text> : null}
                                {tags.map((tag) => (
                                  <Text key={`${it.inventorName}-${tag}`} className="inventor-rank-chip">
                                    {tag}
                                  </Text>
                                ))}
                              </View>
                            ) : null}
                          </View>
                          <View className="inventor-rank-row-stats">
                            <Text className="inventor-rank-row-stat-num">{it.patentCount}</Text>
                            <Text className="inventor-rank-row-stat-label">{LABEL_PATENT_COUNT}</Text>
                            <Text className="inventor-rank-row-stat-sub">{LABEL_LISTING_COUNT} {it.listingCount}</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            );
          })()
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
