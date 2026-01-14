import { View, Text, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import type { components } from '@ipmoney/api-types';

import logoPng from '../../assets/brand/logo.png';
import { getToken } from '../../lib/auth';
import { apiGet, apiPost } from '../../lib/api';
import { favorite, getFavoriteListingIds, syncFavorites, unfavorite } from '../../lib/favorites';
import { ensureApproved } from '../../lib/guard';
import { AppIcon } from '../../ui/Icon';
import { ListingCard } from '../../ui/ListingCard';
import { ListingListSkeleton } from '../../ui/ListingSkeleton';
import { SearchEntry } from '../../ui/SearchEntry';
import { EmptyCard, ErrorCard } from '../../ui/StateCards';
import { Surface } from '../../ui/layout';

type PagedListingSummary = components['schemas']['PagedListingSummary'];
type ListingSummary = components['schemas']['ListingSummary'];

type Conversation = { id: string };

export default function HomePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PagedListingSummary | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => new Set(getFavoriteListingIds()));

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await apiGet<PagedListingSummary>('/search/listings', {
        sortBy: 'RECOMMENDED',
        page: 1,
        pageSize: 3,
      });
      setData(d);
    } catch (e: any) {
      setError(e?.message || '加载失败');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

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

  const goSearch = useCallback(() => Taro.switchTab({ url: '/pages/search/index' }), []);
  const goFeeds = useCallback(() => Taro.navigateTo({ url: '/pages/feeds/index' }), []);
  const goMap = useCallback(() => Taro.navigateTo({ url: '/pages/patent-map/index' }), []);
  const goInventors = useCallback(() => Taro.navigateTo({ url: '/pages/inventors/index' }), []);
  const goOrganizations = useCallback(() => Taro.navigateTo({ url: '/pages/organizations/index' }), []);

  return (
    <View className="container">
      <Surface className="home-brand" padding="md">
        <View className="row-between">
          <View className="min-w-0" style={{ flex: 1 }}>
            <Text className="text-display" style={{ color: 'var(--c-primary)' }}>
              Ipmoney
            </Text>
            <View style={{ height: '6rpx' }} />
            <Text className="text-subtitle break-word">专利变金豆矿，让价值更可见、更可交易</Text>
          </View>
          <View className="home-brand-badge">
            <Image className="home-brand-logo" src={logoPng} mode="aspectFit" />
          </View>
        </View>
        <View style={{ height: '10rpx' }} />
        <Text className="text-caption">发明 / 实用新型 / 外观设计 · 转让 / 许可</Text>
      </Surface>

      <View style={{ height: '20rpx' }} />

      <SearchEntry
        value=""
        placeholder="搜索专利号 / 标题 / 发明人…"
        actionText="检索"
        readOnly
        onPress={goSearch}
        onSearch={() => goSearch()}
      />

      <View style={{ height: '20rpx' }} />

      <Surface padding="none" className="home-grid">
        {[
          {
            key: 'feeds',
            title: '猜你喜欢',
            icon: 'feeds' as const,
            bg: 'linear-gradient(135deg, #FF6A00, #FFC54D)',
            onClick: goFeeds,
          },
          {
            key: 'inventors',
            title: '发明人榜',
            icon: 'inventors' as const,
            bg: 'linear-gradient(135deg, #7C3AED, #FB7185)',
            onClick: goInventors,
          },
          {
            key: 'map',
            title: '专利地图',
            icon: 'map' as const,
            bg: 'linear-gradient(135deg, #2563EB, #22D3EE)',
            onClick: goMap,
          },
          {
            key: 'orgs',
            title: '机构展示',
            icon: 'organizations' as const,
            bg: 'linear-gradient(135deg, #16A34A, #34D399)',
            onClick: goOrganizations,
          },
        ].map((it) => (
          <View key={it.key} className="home-grid-item" onClick={it.onClick}>
            <View className="home-grid-icon" style={{ background: it.bg }}>
              <AppIcon name={it.icon} size={20} color="#fff" />
            </View>
            <View style={{ height: '6rpx' }} />
            <Text className="text-card-title">{it.title}</Text>
          </View>
        ))}
      </Surface>

      <View style={{ height: '24rpx' }} />

      <View className="home-section">
        <View className="row-between">
          <View className="row" style={{ gap: '12rpx' }}>
            <View className="home-section-accent" />
            <Text className="text-title">热门推荐</Text>
          </View>
          <View className="row" style={{ gap: '12rpx' }}>
            <Text className="tag tag-gold">实时</Text>
            <Text className="home-section-more" onClick={goFeeds}>
              更多 &gt;
            </Text>
          </View>
        </View>
        <View style={{ height: '8rpx' }} />
        <Text className="text-caption">
          推荐分由发布时间、浏览、收藏与咨询等实时计算；收藏/咨询/下单需登录且审核通过。
        </Text>
      </View>

      <View style={{ height: '12rpx' }} />

      {loading ? (
        <ListingListSkeleton count={3} />
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
        <EmptyCard message="暂无推荐内容" actionText="刷新" onAction={load} />
      )}
    </View>
  );
}
