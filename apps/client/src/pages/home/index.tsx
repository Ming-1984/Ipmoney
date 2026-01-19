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
import { Button, toast } from '../../ui/nutui';
import { priceTypeLabel } from '../../lib/labels';
import { fenToYuan } from '../../lib/money';

type PagedListingSummary = components['schemas']['PagedListingSummary'];
type ListingSummary = components['schemas']['ListingSummary'];
type PagedDemandSummary = components['schemas']['PagedDemandSummary'];
type DemandSummary = components['schemas']['DemandSummary'];
type Hall = 'patent' | 'demand';

type Conversation = { id: string };

function demandBudgetLabel(it: Pick<DemandSummary, 'budgetType' | 'budgetMinFen' | 'budgetMaxFen'>): string {
  const type = it.budgetType;
  if (!type) return '预算：-';
  if (type === 'NEGOTIABLE') return '预算：面议';
  const min = it.budgetMinFen;
  const max = it.budgetMaxFen;
  if (min !== undefined && max !== undefined) return `预算：￥${fenToYuan(min)}–￥${fenToYuan(max)}`;
  if (min !== undefined) return `预算：≥￥${fenToYuan(min)}`;
  if (max !== undefined) return `预算：≤￥${fenToYuan(max)}`;
  return '预算：固定';
}

function cooperationModeLabel(mode: components['schemas']['CooperationMode']): string {
  if (mode === 'TRANSFER') return '转让';
  if (mode === 'LICENSE') return '许可';
  if (mode === 'EQUITY') return '股权合作';
  if (mode === 'JOINT_DEV') return '联合开发';
  if (mode === 'COMMISSIONED_DEV') return '委托开发';
  return '其他';
}

export default function HomePage() {
  const [hall, setHall] = useState<Hall>('patent');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PagedListingSummary | null>(null);
  const [demandData, setDemandData] = useState<PagedDemandSummary | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => new Set(getFavoriteListingIds()));
  const [searchValue, setSearchValue] = useState('');

  const load = useCallback(async (targetHall: Hall) => {
    setLoading(true);
    setError(null);
    try {
      if (targetHall === 'patent') {
        const d = await apiGet<PagedListingSummary>('/search/listings', {
          sortBy: 'NEWEST',
          page: 1,
          pageSize: 3,
        });
        setData(d);
      } else {
        const d = await apiGet<PagedDemandSummary>('/search/demands', {
          sortBy: 'NEWEST',
          page: 1,
          pageSize: 3,
        });
        setDemandData(d);
      }
    } catch (e: any) {
      setError(e?.message || '加载失败');
      if (targetHall === 'patent') {
        setData(null);
      } else {
        setDemandData(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(hall);
  }, [hall, load]);

  useEffect(() => {
    if (!getToken()) return;
    syncFavorites()
      .then((ids) => setFavoriteIds(new Set(ids)))
      .catch(() => {});
  }, []);

  const listingItems = useMemo(() => data?.items || [], [data?.items]);
  const demandItems = useMemo(() => demandData?.items || [], [demandData?.items]);

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

  const goSearch = useCallback(
    (value?: string) => {
      const keyword = typeof value === 'string' ? value.trim() : '';
      if (!keyword) {
        if (typeof value === 'string') {
          toast('请输入关键词');
          return;
        }
        Taro.switchTab({ url: '/pages/search/index' });
        return;
      }
      Taro.setStorageSync(STORAGE_KEYS.searchPrefill, { q: keyword, tab: hall === 'patent' ? 'LISTING' : 'DEMAND' });
      Taro.switchTab({ url: '/pages/search/index' });
    },
    [hall],
  );
  const goMap = useCallback(() => Taro.navigateTo({ url: '/pages/patent-map/index' }), []);
  const goInventors = useCallback(() => Taro.navigateTo({ url: '/pages/inventors/index' }), []);
  const goArtworks = useCallback(() => {
    Taro.setStorageSync(STORAGE_KEYS.searchPrefill, { tab: 'ARTWORK' });
    Taro.switchTab({ url: '/pages/search/index' });
  }, []);
  const goAchievements = useCallback(() => {
    Taro.setStorageSync(STORAGE_KEYS.searchPrefill, { tab: 'ACHIEVEMENT' });
    Taro.switchTab({ url: '/pages/search/index' });
  }, []);
  const goPatentExplore = useCallback(() => {
    Taro.setStorageSync(STORAGE_KEYS.searchPrefill, { tab: 'LISTING' });
    Taro.switchTab({ url: '/pages/search/index' });
  }, []);
  const goDemandSearch = useCallback(() => {
    Taro.setStorageSync(STORAGE_KEYS.searchPrefill, { tab: 'DEMAND' });
    Taro.switchTab({ url: '/pages/search/index' });
  }, []);
  const goPublish = useCallback(() => {
    Taro.switchTab({ url: '/pages/publish/index' });
  }, []);

  return (
    <View className="container home-v3">
      <View className="home-hero">
        <View className="home-hero-glow" />
        <View className="home-hero-header">
          <View className="home-hero-brand">
            <Image className="home-hero-logo" src={logoGif} mode="aspectFit" />
            <View className="home-hero-brand-text">
              <Text className="home-hero-title">
                IP<Text style={{ color: 'var(--c-primary)' }}>MONEY</Text>
              </Text>
              <Text className="home-hero-subtitle">专利点金台</Text>
            </View>
          </View>
          <View className="home-hero-pill" />
        </View>

        <View className="home-segmented">
          {[
            { key: 'patent', label: '专利厅' },
            { key: 'demand', label: '需求厅' },
          ].map((it) => (
            <View
              key={it.key}
              className={`home-segmented-item ${hall === it.key ? 'is-active' : ''}`}
              onClick={() => setHall(it.key as Hall)}
            >
              {it.label}
            </View>
          ))}
        </View>
      </View>

      <View className="home-search-wrap">
        <SearchEntry
          value={searchValue}
          placeholder="搜索专利号 / 标题 / 发明人 / 需求关键词"
          actionText="检索"
          onChange={setSearchValue}
          onSearch={goSearch}
        />
      </View>

      <View className="home-cta-row">
        <View className="home-cta-card publish" onClick={goPublish}>
          <View className="home-cta-icon">
            <AppIcon name="patent-achievement" size={44} />
          </View>
          <View className="home-cta-text">
            <Text className="home-cta-title">{hall === 'patent' ? '发专利' : '发需求'}</Text>
            <Text className="home-cta-sub">Publish</Text>
          </View>
        </View>
        <View className="home-cta-card discover" onClick={hall === 'patent' ? goSearch : goDemandSearch}>
          <View className="home-cta-icon">
            <AppIcon name="patent-map" size={44} />
          </View>
          <View className="home-cta-text">
            <Text className="home-cta-title">{hall === 'patent' ? '找专利' : '找需求'}</Text>
            <Text className="home-cta-sub">Discover</Text>
          </View>
        </View>
      </View>

      <Surface padding="none" className="home-feature-surface">
        <View className="home-feature-grid">
          {[
            {
              key: 'sleeping',
              title: '沉睡专利',
              icon: 'sleep-patent' as const,
              badge: 'brand' as const,
              onClick: goPatentExplore,
            },
            {
              key: 'inventors',
              title: '发明人榜',
              icon: 'inventor-rank' as const,
              badge: 'purple' as const,
              onClick: goInventors,
            },
            {
              key: 'map',
              title: '专利地图',
              icon: 'patent-map' as const,
              badge: 'blue' as const,
              onClick: goMap,
            },
            {
              key: 'achievement',
              title: '专利成果',
              icon: 'patent-achievement' as const,
              badge: 'green' as const,
              onClick: goAchievements,
            },
            {
              key: 'artworks',
              title: '书画专区',
              icon: 'painting-zone' as const,
              badge: 'gold' as const,
              onClick: goArtworks,
            },
          ].map((it) => (
            <View key={it.key} className="home-feature-item" onClick={it.onClick}>
              <View className="home-feature-chip">
                <IconBadge variant={it.badge} size="md">
                  <AppIcon name={it.icon} size={36} />
                </IconBadge>
              </View>
              <Text className="home-feature-label">{it.title}</Text>
            </View>
          ))}
        </View>
      </Surface>

      <View className="home-media-card">
        <Swiper className="home-promo-swiper" indicatorDots autoplay={false} circular>
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
      </View>

      <SectionHeader title={hall === 'patent' ? '精选专利推荐' : '热门需求广场'} />

      {loading ? (
        <ListingListSkeleton count={3} />
      ) : error ? (
        <ErrorCard message={error} onRetry={() => load(hall)} />
      ) : hall === 'patent' ? (
        listingItems.length ? (
          <Surface padding="none" className="listing-list">
            {listingItems.map((it: ListingSummary) => (
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
          <EmptyCard message="暂无最新专利" actionText="刷新" onAction={() => load(hall)} />
        )
      ) : demandItems.length ? (
        <View>
          {demandItems.map((it: DemandSummary) => (
            <Surface
              key={it.id}
              className="home-demand-card"
              onClick={() => {
                Taro.navigateTo({ url: `/pages/demand/detail/index?demandId=${it.id}` });
              }}
            >
              <Text className="text-title clamp-2">{it.title || '未命名需求'}</Text>
              <View style={{ height: '8rpx' }} />
              <View className="row" style={{ gap: '10rpx', flexWrap: 'wrap' }}>
                <Text className="tag tag-gold">{demandBudgetLabel(it)}</Text>
                <Text className="tag">{priceTypeLabel(it.budgetType || 'NEGOTIABLE')}</Text>
                {it.publisher?.displayName ? <Text className="tag">{it.publisher.displayName}</Text> : null}
              </View>
              {it.cooperationModes?.length || it.industryTags?.length ? (
                <>
                  <View style={{ height: '6rpx' }} />
                  <View className="row" style={{ gap: '10rpx', flexWrap: 'wrap' }}>
                    {it.cooperationModes?.slice(0, 2).map((m) => (
                      <Text key={`${it.id}-co-${m}`} className="tag">
                        {cooperationModeLabel(m)}
                      </Text>
                    ))}
                    {it.industryTags?.slice(0, 2).map((t) => (
                      <Text key={`${it.id}-tag-${t}`} className="tag">
                        {t}
                      </Text>
                    ))}
                  </View>
                </>
              ) : null}
              {it.summary ? (
                <>
                  <View style={{ height: '10rpx' }} />
                  <Text className="muted clamp-2">{it.summary}</Text>
                </>
              ) : null}
              <View style={{ height: '12rpx' }} />
              <Button
                type="primary"
                variant="primary"
                block
                onClick={() => Taro.navigateTo({ url: `/pages/demand/detail/index?demandId=${it.id}` })}
              >
                详情
              </Button>
            </Surface>
          ))}
        </View>
      ) : (
        <EmptyCard message="暂无最新需求" actionText="刷新" onAction={() => load(hall)} />
      )}
    </View>
  );
}
