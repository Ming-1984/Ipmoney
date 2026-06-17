import { View, Text, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect } from 'react';
import './index.scss';

import type { components } from '@ipmoney/api-types';

import { STORAGE_KEYS } from '../../constants';
import { apiGet } from '../../lib/api';
import { displayTitleOrFallback } from '../../lib/displayText';
import { usePagedList } from '../../lib/usePagedList';
import { ListFooter } from '../../ui/ListFooter';
import { PullToRefresh, toast } from '../../ui/nutui';
import { EmptyCard, ErrorCard, LoadingCard } from '../../ui/StateCards';

type InventorRankingItem = components['schemas']['InventorRankingItem'];
type PagedInventorRanking = components['schemas']['PagedInventorRanking'];

const LABEL_PATENT_COUNT = '专利数';
const LABEL_LISTING_COUNT = '关联上架';
const LABEL_EMPTY = '暂无数据';
const LABEL_REFRESH = '刷新';

function renderInitial(name: string): string {
  const first = String(name || '').trim().slice(0, 1);
  return first || '发';
}

function inventorNameText(name: unknown): string {
  return displayTitleOrFallback(name, '发明人待补充');
}

export default function InventorsPage() {
  const openInventor = useCallback((inventorName: string) => {
    const name = String(inventorName || '').trim();
    if (!name) return;
    Taro.setStorageSync(STORAGE_KEYS.searchPrefill, {
      tab: 'LISTING',
      q: name,
      qType: 'INVENTOR',
      reset: true,
    });
    void Taro.navigateTo({ url: '/subpackages/search/index' });
  }, []);

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

  const showInitialLoading = loading && items.length === 0;

  return (
    <View className="container consult-page inventor-rank-page">
      <PullToRefresh type="primary" disabled={showInitialLoading || refreshing} onRefresh={refresh}>
        {showInitialLoading ? (
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
                    {topItems.map((item, idx) => {
                      const rank = idx + 1;
                      const avatar = String(item.avatarUrl || '').trim();
                      const nameText = inventorNameText(item.inventorName);
                      const initial = renderInitial(nameText);
                      return (
                        <View
                          key={`${nameText}-${rank}`}
                          className={`inventor-podium-card rank-${rank}`}
                          onClick={() => openInventor(item.inventorName)}
                        >
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
                          <Text className="inventor-podium-name clamp-1">{nameText}</Text>
                          <View className="inventor-podium-stats">
                            <Text className="inventor-podium-score">{item.patentCount}</Text>
                            <Text className="inventor-podium-score-label">{LABEL_PATENT_COUNT}</Text>
                            <Text className="inventor-podium-subscore">
                              {LABEL_LISTING_COUNT} {item.listingCount}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                ) : null}

                {restItems.length ? (
                  <View className="inventor-rank-list compact">
                    {restItems.map((item, idx) => {
                      const rank = idx + 4;
                      const avatar = String(item.avatarUrl || '').trim();
                      const nameText = inventorNameText(item.inventorName);
                      const initial = renderInitial(nameText);
                      return (
                        <View
                          key={`${nameText}-${rank}`}
                          className="inventor-rank-row"
                          onClick={() => openInventor(item.inventorName)}
                        >
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
                            <Text className="inventor-rank-row-name clamp-1">{nameText}</Text>
                          </View>
                          <View className="inventor-rank-row-stats">
                            <Text className="inventor-rank-row-stat-num">{item.patentCount}</Text>
                            <Text className="inventor-rank-row-stat-label">{LABEL_PATENT_COUNT}</Text>
                            <Text className="inventor-rank-row-stat-sub">
                              {LABEL_LISTING_COUNT} {item.listingCount}
                            </Text>
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

        {!showInitialLoading && items.length ? (
          <ListFooter loadingMore={loadingMore} hasMore={hasMore} onLoadMore={loadMore} showNoMore />
        ) : null}
      </PullToRefresh>
    </View>
  );
}
