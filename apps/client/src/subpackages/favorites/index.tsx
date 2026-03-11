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
import { sanitizeIndustryTagNames } from '../../lib/industryTags';
import { resolveLocalAsset } from '../../lib/localAssets';
import { fenToYuan } from '../../lib/money';
import { regionNameByCode } from '../../lib/regions';
import { ensureApproved, usePageAccess } from '../../lib/guard';
import { usePagedList } from '../../lib/usePagedList';
import { CategoryControl } from '../../ui/filters';
import { ArtworkCard } from '../../ui/ArtworkCard';
import { ListingCard } from '../../ui/ListingCard';
import { PageState } from '../../ui/PageState';
import { ListFooter } from '../../ui/ListFooter';
import { PageHeader, Spacer, Surface } from '../../ui/layout';
import { Button, PullToRefresh, toast } from '../../ui/nutui';
import iconAward from '../../assets/icons/icon-award-teal.svg';
import emptyFavorites from '../../assets/illustrations/empty-favorites.svg';

type ListingSummary = components['schemas']['ListingSummary'];
type DemandSummary = components['schemas']['DemandSummary'];
type PriceType = components['schemas']['PriceType'];
type AchievementSummary = components['schemas']['AchievementSummary'];
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
  const listingList = usePagedList<ListingSummary>(
    useCallback(async ({ page, pageSize }: { page: number; pageSize: number }) => listFavorites(page, pageSize), []),
    {
      pageSize: 20,
      onError: (message, ctx) => {
        if (ctx === 'loadMore') toast(message);
      },
    },
  );

  const demandList = usePagedList<DemandSummary>(
    useCallback(async ({ page, pageSize }: { page: number; pageSize: number }) => listFavoriteDemands(page, pageSize), []),
    {
      pageSize: 20,
      onError: (message, ctx) => {
        if (ctx === 'loadMore') toast(message);
      },
    },
  );

  const achievementList = usePagedList<AchievementSummary>(
    useCallback(async ({ page, pageSize }: { page: number; pageSize: number }) => listFavoriteAchievements(page, pageSize), []),
    {
      pageSize: 20,
      onError: (message, ctx) => {
        if (ctx === 'loadMore') toast(message);
      },
    },
  );

  const artworkList = usePagedList<ArtworkSummary>(
    useCallback(async ({ page, pageSize }: { page: number; pageSize: number }) => listFavoriteArtworks(page, pageSize), []),
    {
      pageSize: 20,
      onError: (message, ctx) => {
        if (ctx === 'loadMore') toast(message);
      },
    },
  );

  const resetAll = useCallback(() => {
    listingList.reset();
    demandList.reset();
    achievementList.reset();
    artworkList.reset();
  }, [achievementList.reset, artworkList.reset, demandList.reset, listingList.reset]);

  const access = usePageAccess('approved-required', (a) => {
    if (a.state === 'ok') return;
    resetAll();
  });

  useEffect(() => {
    if (access.state !== 'ok') return;
    if (tab === 'LISTING') {
      void listingList.reload();
      return;
    }
    if (tab === 'DEMAND') {
      void demandList.reload();
      return;
    }
    if (tab === 'ACHIEVEMENT') {
      void achievementList.reload();
      return;
    }
    void artworkList.reload();
  }, [access.state, tab, listingList.reload, demandList.reload, achievementList.reload, artworkList.reload]);

  const listingItems = useMemo(() => listingList.items, [listingList.items]);
  const demandItems = useMemo(() => demandList.items, [demandList.items]);
  const achievementItems = useMemo(() => achievementList.items, [achievementList.items]);
  const artworkItems = useMemo(() => artworkList.items, [artworkList.items]);

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
      Taro.navigateTo({ url: `/subpackages/messages/chat/index?conversationId=${conv.id}` });
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
      Taro.navigateTo({ url: `/subpackages/messages/chat/index?conversationId=${conv.id}` });
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
                Taro.navigateTo({ url: `/subpackages/listing/detail/index?listingId=${it.id}` });
              }}
              onFavorite={async () => {
                if (!ensureApproved()) return;
                try {
                  await unfavorite(it.id);
                  toast('已取消收藏', { icon: 'success' });
                  void listingList.reload();
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
            const location = it.regionCode ? regionNameByCode(it.regionCode) || '' : '';
            const publisher = it.publisher?.displayName || '';
            const budgetValue = demandBudgetValue(it);
            const visibleIndustryTags = sanitizeIndustryTagNames(it.industryTags || []);
            const primaryTag = it.cooperationModes?.[0]
              ? cooperationModeLabel(it.cooperationModes[0])
              : visibleIndustryTags[0] || '技术需求';

            return (
              <View
                key={it.id}
                className="demand-card-target"
                onClick={() => {
                  Taro.navigateTo({ url: `/subpackages/demand/detail/index?demandId=${it.id}` });
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
                      void demandList.reload();
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
            const location = it.regionCode ? regionNameByCode(it.regionCode) || '' : '';
            const maturityText = maturityLabelShort(it.maturity || '');
            const tags: { label: string; tone: 'green' | 'slate' }[] = [];
            const visibleIndustryTags = sanitizeIndustryTagNames(it.industryTags || []);
            it.cooperationModes?.slice(0, 2).forEach((m) => tags.push({ label: cooperationModeLabel(m), tone: 'green' }));
            visibleIndustryTags.slice(0, 2).forEach((t) => tags.push({ label: t, tone: 'slate' }));
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
                  Taro.navigateTo({ url: `/subpackages/achievement/detail/index?achievementId=${it.id}` });
                }}
                onLongPress={async () => {
                  if (!ensureApproved()) return;
                  try {
                    await unfavoriteAchievement(it.id);
                    toast('已取消收藏', { icon: 'success' });
                    void achievementList.reload();
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
          <View key={it.id} className="artwork-favorite-item">
            <ArtworkCard
              item={it}
              onClick={() => {
                Taro.navigateTo({ url: `/subpackages/artwork/detail/index?artworkId=${it.id}` });
              }}
            />
            <View className="artwork-favorite-actions">
              <Button
                size="small"
                variant="ghost"
                onClick={async () => {
                  if (!ensureApproved()) return;
                  try {
                    await unfavoriteArtwork(it.id);
                    toast('已取消收藏', { icon: 'success' });
                    void artworkList.reload();
                  } catch (e: any) {
                    toast(e?.message || '操作失败');
                  }
                }}
              >
                取消收藏
              </Button>
              <Button size="small" variant="primary" onClick={() => void startArtworkConsult(it.id)}>
                咨询
              </Button>
            </View>
          </View>
        ))}
      </Surface>
    );
  };

  const activeList =
    tab === 'LISTING'
      ? listingList
      : tab === 'DEMAND'
        ? demandList
        : tab === 'ACHIEVEMENT'
          ? achievementList
          : artworkList;

  const activeCount =
    tab === 'LISTING'
      ? listingItems.length
      : tab === 'DEMAND'
        ? demandItems.length
        : tab === 'ACHIEVEMENT'
          ? achievementItems.length
          : artworkItems.length;

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
        loading={activeList.loading}
        error={activeList.error}
        onRetry={activeList.reload}
        empty={!activeList.loading && !activeList.error && activeCount === 0}
        emptyTitle="暂无收藏"
        emptyMessage="看到心仪内容，点“收藏”即可保存。"
        emptyActionText="刷新"
        emptyImage={emptyFavorites}
        onEmptyAction={activeList.reload}
      >
        <PullToRefresh type="primary" disabled={activeList.loading || activeList.refreshing} onRefresh={activeList.refresh}>
          {renderContent()}
          {!activeList.loading && activeCount ? (
            <ListFooter
              loadingMore={activeList.loadingMore}
              hasMore={activeList.hasMore}
              onLoadMore={activeList.loadMore}
              showNoMore
            />
          ) : null}
        </PullToRefresh>
      </PageState>
    </View>
  );
}
