import { View, Text, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './index.scss';

import type { components } from '@ipmoney/api-types';

import { listFavoriteAchievements, listFavorites, unfavorite, unfavoriteAchievement } from '../../lib/favorites';
import { apiPost } from '../../lib/api';
import { sanitizeIndustryTagNames } from '../../lib/industryTags';
import { resolveLocalAsset } from '../../lib/localAssets';
import { regionNameByCode } from '../../lib/regions';
import { ensureApproved, usePageAccess } from '../../lib/guard';
import { usePagedList } from '../../lib/usePagedList';
import { CategoryControl } from '../../ui/filters';
import { ListingCard } from '../../ui/ListingCard';
import { PageState } from '../../ui/PageState';
import { ListFooter } from '../../ui/ListFooter';
import { PageHeader, Spacer, Surface } from '../../ui/layout';
import { PullToRefresh, toast } from '../../ui/nutui';
import iconAward from '../../assets/icons/icon-award-teal.svg';
import emptyFavorites from '../../assets/illustrations/empty-favorites.svg';

type ListingSummary = components['schemas']['ListingSummary'];
type AchievementSummary = components['schemas']['AchievementSummary'];

type Conversation = { id: string };

type FavoriteTab = 'LISTING' | 'ACHIEVEMENT';

type CooperationMode = components['schemas']['CooperationMode'];
type AchievementMaturity = components['schemas']['AchievementMaturity'];

function cooperationModeLabel(mode: CooperationMode): string {
  if (mode === 'TRANSFER') return '专利转让';
  if (mode === 'TECH_CONSULTING') return '技术咨询';
  if (mode === 'COMMISSIONED_DEV') return '委托开发';
  if (mode === 'PLATFORM_CO_BUILD') return '平台共建';
  return '其他';
}

function maturityLabelShort(m?: AchievementMaturity | ''): string | null {
  if (!m) return null;
  if (m === 'CONCEPT') return '概念';
  if (m === 'PROTOTYPE') return '样机/原型';
  if (m === 'PILOT') return '中试';
  if (m === 'MASS_PRODUCTION') return '量产';
  if (m === 'COMMERCIALIZED') return '产业化';
  return '其他';
}

export default function FavoritesPage() {
  const loadedOnceRef = useRef(false);
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

  const achievementList = usePagedList<AchievementSummary>(
    useCallback(async ({ page, pageSize }: { page: number; pageSize: number }) => listFavoriteAchievements(page, pageSize), []),
    {
      pageSize: 20,
      onError: (message, ctx) => {
        if (ctx === 'loadMore') toast(message);
      },
    },
  );

  const resetAll = useCallback(() => {
    listingList.reset();
    achievementList.reset();
  }, [achievementList.reset, listingList.reset]);

  const access = usePageAccess('approved-required', (a) => {
    if (a.state === 'ok') {
      if (loadedOnceRef.current) {
        if (tab === 'LISTING') {
          void listingList.refresh();
          return;
        }
        void achievementList.refresh();
      }
      return;
    }
    loadedOnceRef.current = false;
    resetAll();
  });

  useEffect(() => {
    if (access.state !== 'ok') return;
    loadedOnceRef.current = true;
    if (tab === 'LISTING') {
      if (!listingList.items.length && !listingList.loading) {
        void listingList.reload();
      }
      return;
    }
    if (!achievementList.items.length && !achievementList.loading) {
      void achievementList.reload();
    }
  }, [
    access.state,
    tab,
    listingList.items.length,
    listingList.loading,
    listingList.reload,
    achievementList.items.length,
    achievementList.loading,
    achievementList.reload,
  ]);

  const listingItems = useMemo(() => listingList.items, [listingList.items]);
  const achievementItems = useMemo(() => achievementList.items, [achievementList.items]);

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
                          <Text key={`${it.id}-tag-${idx}`} className={`listing-tag listing-tag--${tag.tone} listing-tag--small`}>
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
  };

  const activeList = tab === 'LISTING' ? listingList : achievementList;
  const activeCount = tab === 'LISTING' ? listingItems.length : achievementItems.length;
  const showActiveInitialLoading = activeList.loading && activeCount === 0;

  return (
    <View className="container favorites-page">
      <PageHeader title="我的收藏" subtitle="收藏后可快速回看，取消收藏将不再显示" />
      <Spacer />

      <Surface>
        <Text className="text-strong">类型</Text>
        <View style={{ height: '10rpx' }} />
        <CategoryControl
          value={tab}
          options={[
            { label: '专利交易', value: 'LISTING' },
            { label: '专利成果', value: 'ACHIEVEMENT' },
          ]}
          onChange={(v) => {
            setTab(v as FavoriteTab);
          }}
        />
      </Surface>

      <View style={{ height: '16rpx' }} />

      <PageState
        access={access}
        loading={showActiveInitialLoading}
        error={activeList.error}
        onRetry={activeList.reload}
        empty={!showActiveInitialLoading && !activeList.error && activeCount === 0}
        emptyTitle="暂无收藏"
        emptyMessage="看到心仪内容，点收藏即可保存。"
        emptyActionText="刷新"
        emptyImage={emptyFavorites}
        onEmptyAction={activeList.reload}
      >
        <PullToRefresh type="primary" disabled={showActiveInitialLoading || activeList.refreshing} onRefresh={activeList.refresh}>
          {renderContent()}
          {!showActiveInitialLoading && activeCount ? (
            <ListFooter loadingMore={activeList.loadingMore} hasMore={activeList.hasMore} onLoadMore={activeList.loadMore} showNoMore />
          ) : null}
        </PullToRefresh>
      </PageState>
    </View>
  );
}
