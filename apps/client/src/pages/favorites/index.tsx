import { View, Text, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './index.scss';

import type { components } from '@ipmoney/api-types';

import {
  listFavoriteAchievements,
  listFavoriteArtworks,
  listFavoriteDemands,
  listFavorites,
  unfavorite,
  unfavoriteAchievement,
  unfavoriteArtwork,
  unfavoriteDemand,
} from '../../lib/favorites';
import { apiPost } from '../../lib/api';
import { resolveLocalAsset } from '../../lib/localAssets';
import { fenToYuan } from '../../lib/money';
import { regionNameByCode } from '../../lib/regions';
import { ensureApproved, usePageAccess } from '../../lib/guard';
import { CategoryControl } from '../../ui/filters';
import { ArtworkCard } from '../../ui/ArtworkCard';
import { ListingCard } from '../../ui/ListingCard';
import { PageState } from '../../ui/PageState';
import { PageHeader, Spacer, Surface } from '../../ui/layout';
import { toast } from '../../ui/nutui';
import iconAward from '../../assets/icons/icon-award-teal.svg';

type PagedListingSummary = components['schemas']['PagedListingSummary'];
type ListingSummary = components['schemas']['ListingSummary'];
type PagedDemandSummary = components['schemas']['PagedDemandSummary'];
type DemandSummary = components['schemas']['DemandSummary'];
type PriceType = components['schemas']['PriceType'];
type PagedAchievementSummary = components['schemas']['PagedAchievementSummary'];
type AchievementSummary = components['schemas']['AchievementSummary'];
type PagedArtworkSummary = components['schemas']['PagedArtworkSummary'];
type ArtworkSummary = components['schemas']['ArtworkSummary'];

type Conversation = { id: string };

type FavoriteTab = 'LISTING' | 'DEMAND' | 'ACHIEVEMENT' | 'ARTWORK';

type CooperationMode = components['schemas']['CooperationMode'];
type AchievementMaturity = components['schemas']['AchievementMaturity'];

function cooperationModeLabel(mode: CooperationMode): string {
  if (mode === 'TRANSFER') return '专利转让';
  if (mode === 'TECH_CONSULTING') return '技术咨询';
  if (mode === 'COMMISSIONED_DEV') return '委托开发';
  if (mode === 'PLATFORM_CO_BUILD') return '平台共建';
  return '其他';
}

function demandBudgetValue(it: Pick<DemandSummary, 'budgetType' | 'budgetMinFen' | 'budgetMaxFen'>): string {
  const type = it.budgetType as PriceType | undefined;
  if (!type) return '-';
  if (type === 'NEGOTIABLE') return '面议';
  const min = it.budgetMinFen;
  const max = it.budgetMaxFen;
  if (min !== undefined && max !== undefined) return `￥${fenToYuan(min)}-￥${fenToYuan(max)}`;
  if (min !== undefined) return `￥${fenToYuan(min)}以上`;
  if (max !== undefined) return `￥${fenToYuan(max)}以内`;
  return '固定预算';
}

function maturityLabelShort(m?: AchievementMaturity | ''): string | null {
  if (!m) return null;
  if (m === 'CONCEPT') return '概念';
  if (m === 'PROTOTYPE') return '样机/原型';
  if (m === 'PILOT') return '中试';
  if (m === 'MASS_PRODUCTION') return '量产';
  if (m === 'COMMERCIALIZED') return '已产业化';
  return '其他';
}

export default function FavoritesPage() {
  const [tab, setTab] = useState<FavoriteTab>('LISTING');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [listingData, setListingData] = useState<PagedListingSummary | null>(null);
  const [demandData, setDemandData] = useState<PagedDemandSummary | null>(null);
  const [achievementData, setAchievementData] = useState<PagedAchievementSummary | null>(null);
  const [artworkData, setArtworkData] = useState<PagedArtworkSummary | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (tab === 'LISTING') {
        const d = await listFavorites(1, 20);
        setListingData(d);
        return;
      }
      if (tab === 'DEMAND') {
        const d = await listFavoriteDemands(1, 20);
        setDemandData(d);
        return;
      }
      if (tab === 'ACHIEVEMENT') {
        const d = await listFavoriteAchievements(1, 20);
        setAchievementData(d);
        return;
      }
      const d = await listFavoriteArtworks(1, 20);
      setArtworkData(d);
    } catch (e: any) {
      setError(e?.message || '加载失败');
      setListingData(null);
      setDemandData(null);
      setAchievementData(null);
      setArtworkData(null);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  const access = usePageAccess('approved-required', (a) => {
    if (a.state === 'ok') {
      void load();
      return;
    }
    setLoading(false);
    setError(null);
    setListingData(null);
    setDemandData(null);
    setAchievementData(null);
    setArtworkData(null);
  });

  useEffect(() => {
    if (access.state !== 'ok') return;
    void load();
  }, [access.state, load, tab]);

  const listingItems = useMemo(() => listingData?.items || [], [listingData?.items]);
  const demandItems = useMemo(() => demandData?.items || [], [demandData?.items]);
  const achievementItems = useMemo(() => achievementData?.items || [], [achievementData?.items]);
  const artworkItems = useMemo(() => artworkData?.items || [], [artworkData?.items]);

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
        { idempotencyKey: `conv-${listingId}` },
      );
      Taro.navigateTo({ url: `/pages/messages/chat/index?conversationId=${conv.id}` });
    } catch (e: any) {
      toast(e?.message || '进入咨询失败');
    }
  }, []);

  const startArtworkConsult = useCallback(async (artworkId: string) => {
    if (!ensureApproved()) return;
    try {
      const conv = await apiPost<Conversation>(
        `/artworks/${artworkId}/conversations`,
        {},
        { idempotencyKey: `conv-artwork-${artworkId}` },
      );
      Taro.navigateTo({ url: `/pages/messages/chat/index?conversationId=${conv.id}` });
    } catch (e: any) {
      toast(e?.message || '进入咨询失败');
    }
  }, []);

  const renderContent = () => {
    if (tab === 'LISTING') {
      return (
        <View className="search-card-list listing-card-list">
          {listingItems.map((it: ListingSummary) => (
            <ListingCard
              key={it.id}
              item={it}
              favorited
              onClick={() => {
                Taro.navigateTo({ url: `/pages/listing/detail/index?listingId=${it.id}` });
              }}
              onFavorite={async () => {
                if (!ensureApproved()) return;
                try {
                  await unfavorite(it.id);
                  toast('已取消收藏', { icon: 'success' });
                  void load();
                } catch (e: any) {
                  toast(e?.message || '操作失败');
                }
              }}
              onConsult={() => {
                void startConsult(it.id);
              }}
            />
          ))}
        </View>
      );
    }

    if (tab === 'DEMAND') {
      return (
        <View className="search-card-list">
          {demandItems.map((it: DemandSummary) => {
            const location = it.regionName || (it.regionCode ? regionNameByCode(it.regionCode) || '' : '');
            const publisher = it.publisher?.displayName || '';
            const budgetValue = demandBudgetValue(it);
            const primaryTag = it.cooperationModes?.[0]
              ? cooperationModeLabel(it.cooperationModes[0])
              : it.industryTags?.[0] || '技术需求';

            return (
              <View
                key={it.id}
                className="demand-card-target"
                onClick={() => {
                  Taro.navigateTo({ url: `/pages/demand/detail/index?demandId=${it.id}` });
                }}
              >
                <View className="demand-card-main">
                  <View className="demand-card-tags">
                    <Text className="demand-card-tag">{primaryTag}</Text>
                    {location ? <Text className="demand-card-location">{location}</Text> : null}
                  </View>
                  <Text className="demand-card-title clamp-2">{it.title || '未命名需求'}</Text>
                  <Text className="demand-card-subinfo clamp-1">供给方：{publisher || '-'}</Text>
                  <View className="demand-card-budget">
                    <Text className="demand-card-budget-label">预算</Text>
                    <Text className="demand-card-budget-value">{budgetValue}</Text>
                  </View>
                </View>
                <View
                  className="demand-card-action"
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (!ensureApproved()) return;
                    try {
                      await unfavoriteDemand(it.id);
                      toast('已取消收藏', { icon: 'success' });
                      void load();
                    } catch (err: any) {
                      toast(err?.message || '操作失败');
                    }
                  }}
                >
                  取消收藏
                </View>
              </View>
            );
          })}
        </View>
      );
    }

    if (tab === 'ACHIEVEMENT') {
      return (
        <View className="search-card-list">
          {achievementItems.map((it: AchievementSummary) => {
            const cover = resolveLocalAsset(it.coverUrl || '');
            const publisher = it.publisher?.displayName || '';
            const location = it.regionName || (it.regionCode ? regionNameByCode(it.regionCode) || '' : '');
            const maturityText = maturityLabelShort(it.maturity || '');
            const tags: { label: string; tone: 'green' | 'slate' }[] = [];
            it.cooperationModes?.slice(0, 2).forEach((m) => tags.push({ label: cooperationModeLabel(m), tone: 'green' }));
            it.industryTags?.slice(0, 2).forEach((t) => tags.push({ label: t, tone: 'slate' }));
            const visibleTags = tags.slice(0, 3);
            const subinfoParts: string[] = [];
            if (publisher) subinfoParts.push(`机构：${publisher}`);
            if (location) subinfoParts.push(location);
            const subinfo = subinfoParts.join(' · ');

            return (
              <View
                className="list-card listing-item listing-item--compact search-card achievement-card"
                key={it.id}
                onClick={() => {
                  Taro.navigateTo({ url: `/pages/achievement/detail/index?achievementId=${it.id}` });
                }}
                onLongPress={async () => {
                  if (!ensureApproved()) return;
                  try {
                    await unfavoriteAchievement(it.id);
                    toast('已取消收藏', { icon: 'success' });
                    void load();
                  } catch (err: any) {
                    toast(err?.message || '操作失败');
                  }
                }}
              >
                <View className="list-card-thumb listing-thumb thumb-tone-green achievement-thumb">
                  {cover ? (
                    <Image className="list-card-thumb-cover" src={cover} mode="aspectFill" />
                  ) : (
                    <Image className="list-card-thumb-img" src={iconAward} svg mode="aspectFit" />
                  )}
                </View>
                <View className="list-card-body listing-body--compact">
                  <View className="list-card-head">
                    <View className="list-card-head-main">
                      {visibleTags.length ? (
                        <View className="list-card-badges listing-badges-compact">
                          {visibleTags.map((tag, idx) => (
                            <Text
                              key={`${it.id}-tag-${idx}`}
                              className={`listing-tag listing-tag--${tag.tone} listing-tag--small`}
                            >
                              {tag.label}
                            </Text>
                          ))}
                        </View>
                      ) : null}
                      <Text className="list-card-title clamp-1">{it.title || '未命名成果'}</Text>
                    </View>
                  </View>
                  {subinfo ? <Text className="list-card-subinfo clamp-1">{subinfo}</Text> : null}
                  {maturityText ? (
                    <View className="list-card-footer listing-footer-stacked">
                      <Text className="list-card-price">
                        应用阶段 <Text className="list-card-price-value list-card-price-value--muted">{maturityText}</Text>
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      );
    }

    return (
      <Surface padding="none" className="listing-list">
        {artworkItems.map((it: ArtworkSummary) => (
          <ArtworkCard
            key={it.id}
            item={it}
            favorited
            onClick={() => {
              Taro.navigateTo({ url: `/pages/artwork/detail/index?artworkId=${it.id}` });
            }}
            onFavorite={async () => {
              if (!ensureApproved()) return;
              try {
                await unfavoriteArtwork(it.id);
                toast('已取消收藏', { icon: 'success' });
                void load();
              } catch (e: any) {
                toast(e?.message || '操作失败');
              }
            }}
            onConsult={() => {
              void startArtworkConsult(it.id);
            }}
          />
        ))}
      </Surface>
    );
  };

  return (
    <View className="container">
      <PageHeader title="我的收藏" subtitle="收藏后可快速回访；取消收藏后将不再显示" />
      <Spacer />

      <Surface>
        <Text className="text-strong">类型</Text>
        <View style={{ height: '10rpx' }} />
        <CategoryControl
          value={tab}
          options={[
            { label: '专利', value: 'LISTING' },
            { label: '需求', value: 'DEMAND' },
            { label: '成果', value: 'ACHIEVEMENT' },
            { label: '书画', value: 'ARTWORK' },
          ]}
          onChange={(v) => {
            setTab(v as FavoriteTab);
          }}
        />
      </Surface>

      <View style={{ height: '16rpx' }} />

      <PageState
        access={access}
        loading={loading}
        error={error}
        onRetry={load}
        empty={
          !loading &&
          !error &&
          (tab === 'LISTING'
            ? listingItems.length === 0
            : tab === 'DEMAND'
              ? demandItems.length === 0
              : tab === 'ACHIEVEMENT'
                ? achievementItems.length === 0
                : artworkItems.length === 0)
        }
        emptyMessage="暂无收藏"
        emptyActionText="刷新"
        onEmptyAction={load}
      >
        {renderContent()}
      </PageState>
    </View>
  );
}
