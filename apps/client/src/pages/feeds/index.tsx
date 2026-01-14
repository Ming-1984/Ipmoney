import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import type { components } from '@ipmoney/api-types';

import { getToken } from '../../lib/auth';
import { apiGet, apiPost } from '../../lib/api';
import { favorite, getFavoriteListingIds, syncFavorites, unfavorite } from '../../lib/favorites';
import { ensureApproved } from '../../lib/guard';
import { PageHeader, Spacer, Surface } from '../../ui/layout';
import { Button, Segmented } from '../../ui/nutui';
import { ListingCard } from '../../ui/ListingCard';
import { ListingListSkeleton } from '../../ui/ListingSkeleton';
import { EmptyCard, ErrorCard } from '../../ui/StateCards';

type PagedListingSummary = components['schemas']['PagedListingSummary'];
type ListingSummary = components['schemas']['ListingSummary'];

type Conversation = { id: string };
type FeedMode = 'RECOMMENDED' | 'NEWEST' | 'POPULAR';

export default function FeedsPage() {
  const [mode, setMode] = useState<FeedMode>('RECOMMENDED');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PagedListingSummary | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => new Set(getFavoriteListingIds()));

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getToken();
      const d =
        token && mode === 'RECOMMENDED'
          ? await apiGet<PagedListingSummary>('/me/recommendations/listings', {
              page: 1,
              pageSize: 10,
            })
          : await apiGet<PagedListingSummary>('/search/listings', {
              sortBy: mode,
              page: 1,
              pageSize: 10,
            });
      setData(d);
    } catch (e: any) {
      setError(e?.message || '加载失败');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!getToken()) return;
    syncFavorites()
      .then((ids) => setFavoriteIds(new Set(ids)))
      .catch(() => {});
  }, []);

  const items = useMemo(() => data?.items || [], [data?.items]);

  const startConsult = useCallback(async (listingId: string) => {
    if (!ensureApproved()) return;
    try {
      await apiPost<void>(`/listings/${listingId}/consultations`, { channel: 'FORM' }, { idempotencyKey: `c-${listingId}` });
    } catch (_) {
      // ignore: heat event
    }
    try {
      const conv = await apiPost<Conversation>(
        `/listings/${listingId}/conversations`,
        {},
        { idempotencyKey: `demo-consult-${listingId}` },
      );
      Taro.navigateTo({ url: `/pages/messages/chat/index?conversationId=${conv.id}` });
    } catch (e: any) {
      Taro.showToast({ title: e?.message || '进入咨询失败', icon: 'none' });
    }
  }, []);

  const toggleFavorite = useCallback(
    async (listingId: string) => {
      if (!ensureApproved()) return;
      const isFav = favoriteIds.has(listingId);
      try {
        if (isFav) {
          await unfavorite(listingId);
          setFavoriteIds((prev) => {
            const next = new Set(prev);
            next.delete(listingId);
            return next;
          });
          Taro.showToast({ title: '已取消收藏', icon: 'success' });
          return;
        }
        await favorite(listingId);
        setFavoriteIds((prev) => new Set(prev).add(listingId));
        Taro.showToast({ title: '已收藏', icon: 'success' });
      } catch (e: any) {
        Taro.showToast({ title: e?.message || '操作失败', icon: 'none' });
      }
    },
    [favoriteIds],
  );

  return (
    <View className="container">
      <PageHeader title="信息流" subtitle="多维度权重推荐：发布时间、点击量、收藏与咨询热度（后台可调）。" />
      <Spacer />

      <View className="card">
        <Text className="text-card-title">切换</Text>
        <View style={{ height: '10rpx' }} />
        <Segmented
          value={mode}
          options={[
            { label: '推荐', value: 'RECOMMENDED' },
            { label: '最新', value: 'NEWEST' },
            { label: '热度', value: 'POPULAR' },
          ]}
          onChange={(value) => setMode(value as FeedMode)}
        />

        <View style={{ height: '10rpx' }} />
        <View className="row" style={{ gap: '12rpx' }}>
          <View style={{ flex: 1 }}>
            <Button
              variant="ghost"
              onClick={() => {
                Taro.navigateTo({ url: '/pages/inventors/index' });
              }}
            >
              发明人榜
            </Button>
          </View>
          <View style={{ flex: 1 }}>
            <Button
              variant="ghost"
              onClick={() => {
                Taro.navigateTo({ url: '/pages/organizations/index' });
              }}
            >
              机构展示
            </Button>
          </View>
        </View>

        <View style={{ height: '12rpx' }} />
        <Button variant="ghost" onClick={load}>
          刷新当前信息流
        </Button>
      </View>

      <View style={{ height: '16rpx' }} />

      {loading ? (
        <ListingListSkeleton />
      ) : error ? (
        <ErrorCard message={error} onRetry={load} />
      ) : items.length ? (
        <Surface padding="none" className="listing-list">
          {items.map((it: ListingSummary) => (
            <ListingCard
              key={it.id}
              item={it}
              favorited={favoriteIds.has(it.id)}
              onClick={() => {
                Taro.navigateTo({ url: `/pages/listing/detail/index?listingId=${it.id}` });
              }}
              onFavorite={() => {
                void toggleFavorite(it.id);
              }}
              onConsult={() => {
                void startConsult(it.id);
              }}
            />
          ))}
        </Surface>
      ) : (
        <EmptyCard
          message="暂无推荐内容，稍后再试或返回检索查看更多。"
          actionText="刷新"
          onAction={load}
        />
      )}
    </View>
  );
}
