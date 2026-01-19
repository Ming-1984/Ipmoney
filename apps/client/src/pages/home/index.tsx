import { View, Text, Image, Swiper, SwiperItem } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import type { components } from '@ipmoney/api-types';

import logoGif from '../../assets/brand/logo.gif';
import promoCertificateGif from '../../assets/home/promo-certificate.gif';
import promoFreePublishImg from '../../assets/home/promo-free-publish.jpg';
import { STORAGE_KEYS } from '../../constants';
import { getToken } from '../../lib/auth';
import { apiGet, apiPost } from '../../lib/api';
import { favorite, getFavoriteListingIds, syncFavorites, unfavorite } from '../../lib/favorites';
import { ensureApproved } from '../../lib/guard';
import { AppIcon } from '../../ui/Icon';
import { ListingCard } from '../../ui/ListingCard';
import { ListingListSkeleton } from '../../ui/ListingSkeleton';
import { SearchEntry } from '../../ui/SearchEntry';
import { EmptyCard, ErrorCard } from '../../ui/StateCards';
import { IconBadge, SectionHeader, Surface } from '../../ui/layout';
import { toast } from '../../ui/nutui';

type PagedListingSummary = components['schemas']['PagedListingSummary'];
type ListingSummary = components['schemas']['ListingSummary'];

type Conversation = { id: string };

export default function HomePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PagedListingSummary | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => new Set(getFavoriteListingIds()));
  const [searchValue, setSearchValue] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await apiGet<PagedListingSummary>('/search/listings', {
        sortBy: 'NEWEST',
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
      toast(e?.message || '进入咨询失败');
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
          toast('已取消收藏', { icon: 'success' });
          return;
        }
        await favorite(listingId);
        setFavoriteIds((prev) => new Set(prev).add(listingId));
        toast('已收藏', { icon: 'success' });
      } catch (e: any) {
        toast(e?.message || '操作失败');
      }
    },
    [favoriteIds],
  );

  const goSearch = useCallback((value?: string) => {
    const keyword = typeof value === 'string' ? value.trim() : '';
    if (!keyword) {
      if (typeof value === 'string') {
        toast('请输入关键词');
        return;
      }
      Taro.switchTab({ url: '/pages/search/index' });
      return;
    }
    Taro.setStorageSync(STORAGE_KEYS.searchPrefill, { q: keyword, tab: 'LISTING' });
    Taro.switchTab({ url: '/pages/search/index' });
  }, []);
  const goMap = useCallback(() => Taro.navigateTo({ url: '/pages/patent-map/index' }), []);
  const goInventors = useCallback(() => Taro.navigateTo({ url: '/pages/inventors/index' }), []);
  const goOrganizations = useCallback(() => Taro.navigateTo({ url: '/pages/organizations/index' }), []);
  const goArtworks = useCallback(() => {
    Taro.setStorageSync(STORAGE_KEYS.searchPrefill, { tab: 'ARTWORK' });
    Taro.switchTab({ url: '/pages/search/index' });
  }, []);
  const goTechManagers = useCallback(() => Taro.navigateTo({ url: '/pages/tech-managers/index' }), []);

  return (
    <View className="container">
      <Surface className="home-brand" padding="md">
        <View className="row" style={{ gap: '18rpx', alignItems: 'flex-start' }}>
          <View className="home-brand-badge">
            <Image className="home-brand-logo" src={logoGif} mode="aspectFit" />
          </View>
          <View className="min-w-0" style={{ flex: 1 }}>
            <Text className="text-display" style={{ color: 'var(--c-primary)' }}>
              Ipmoney
            </Text>
            <View style={{ height: '6rpx' }} />
            <Text className="text-subtitle break-word">专利点金台</Text>
          </View>
        </View>
        <View style={{ height: '10rpx' }} />
        <Text className="text-caption">让价值更可见、更可交易 · 发明/实用新型/外观设计 · 转让/许可</Text>
      </Surface>

      <View style={{ height: '20rpx' }} />

      <SearchEntry
        value={searchValue}
        placeholder="搜索专利号 / 标题 / 发明人 / 书画作品"
        actionText="检索"
        onChange={setSearchValue}
        onSearch={goSearch}
      />

      <View style={{ height: '28rpx' }} />

      <Surface padding="none" className="home-grid-surface">
        <View className="home-grid">
          {[
            {
              key: 'sleeping',
              title: '沉睡专利',
              icon: 'feeds' as const,
              badge: 'brand' as const,
              onClick: goSearch,
            },
            {
              key: 'artworks',
              title: '书画专区',
              icon: 'artworks' as const,
              badge: 'gold' as const,
              onClick: goArtworks,
            },
            {
              key: 'tech-managers',
              title: '技术经理人',
              icon: 'tech-managers' as const,
              badge: 'purple' as const,
              onClick: goTechManagers,
            },
            {
              key: 'inventors',
              title: '发明人榜',
              icon: 'inventors' as const,
              badge: 'purple' as const,
              onClick: goInventors,
            },
            {
              key: 'map',
              title: '专利地图',
              icon: 'map' as const,
              badge: 'blue' as const,
              onClick: goMap,
            },
            {
              key: 'orgs',
              title: '机构展示',
              icon: 'organizations' as const,
              badge: 'green' as const,
              onClick: goOrganizations,
            },
          ].map((it) => (
            <View key={it.key} className="home-grid-item" onClick={it.onClick}>
              <View className="home-grid-item-inner">
                <IconBadge variant={it.badge} size="md">
                  <AppIcon name={it.icon} size={30} color="#fff" />
                </IconBadge>
                <Text className="home-grid-label">{it.title}</Text>
              </View>
            </View>
          ))}
        </View>
      </Surface>

      <View style={{ height: '28rpx' }} />

      <Swiper
        className="home-promo-swiper"
        indicatorDots
        autoplay={false}
        circular
      >
        <SwiperItem>
          <View className="home-promo-strip">
            <Image className="home-promo-strip-gif" src={promoCertificateGif} mode="aspectFill" />
          </View>
        </SwiperItem>
        <SwiperItem>
          <View className="home-promo-strip">
            <Image className="home-promo-strip-gif" src={promoFreePublishImg} mode="aspectFill" />
          </View>
        </SwiperItem>
      </Swiper>

      <View style={{ height: '24rpx' }} />

      <SectionHeader title="最新专利" />

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
        <EmptyCard message="暂无最新专利" actionText="刷新" onAction={load} />
      )}
    </View>
  );
}
