import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import type { components } from '@ipmoney/api-types';

import {
  listFavoriteAchievements,
  listFavoriteDemands,
  listFavorites,
  unfavorite,
  unfavoriteAchievement,
  unfavoriteDemand,
} from '../../lib/favorites';
import { apiPost } from '../../lib/api';
import { ensureApproved, usePageAccess } from '../../lib/guard';
import { CategoryControl } from '../../ui/filters';
import { ListingCard } from '../../ui/ListingCard';
import { PageState } from '../../ui/PageState';
import { PageHeader, Spacer, Surface } from '../../ui/layout';
import { Button, toast } from '../../ui/nutui';

type PagedListingSummary = components['schemas']['PagedListingSummary'];
type ListingSummary = components['schemas']['ListingSummary'];
type PagedDemandSummary = components['schemas']['PagedDemandSummary'];
type DemandSummary = components['schemas']['DemandSummary'];
type PagedAchievementSummary = components['schemas']['PagedAchievementSummary'];
type AchievementSummary = components['schemas']['AchievementSummary'];

type Conversation = { id: string };

type FavoriteTab = 'LISTING' | 'DEMAND' | 'ACHIEVEMENT';

export default function FavoritesPage() {
  const [tab, setTab] = useState<FavoriteTab>('LISTING');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [listingData, setListingData] = useState<PagedListingSummary | null>(null);
  const [demandData, setDemandData] = useState<PagedDemandSummary | null>(null);
  const [achievementData, setAchievementData] = useState<PagedAchievementSummary | null>(null);

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
      const d = await listFavoriteAchievements(1, 20);
      setAchievementData(d);
    } catch (e: any) {
      setError(e?.message || '加载失败');
      setListingData(null);
      setDemandData(null);
      setAchievementData(null);
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
  });

  useEffect(() => {
    if (access.state !== 'ok') return;
    void load();
  }, [access.state, load, tab]);

  const listingItems = useMemo(() => listingData?.items || [], [listingData?.items]);
  const demandItems = useMemo(() => demandData?.items || [], [demandData?.items]);
  const achievementItems = useMemo(() => achievementData?.items || [], [achievementData?.items]);

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
              : achievementItems.length === 0)
        }
        emptyMessage="暂无收藏"
        emptyActionText="刷新"
        onEmptyAction={load}
      >
        {tab === 'LISTING' ? (
          <Surface padding="none" className="listing-list">
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
          </Surface>
        ) : tab === 'DEMAND' ? (
          <View>
            {demandItems.map((it: DemandSummary) => (
              <Surface key={it.id} style={{ marginBottom: '16rpx' }}>
                <Text className="text-title clamp-2">{it.title || '未命名需求'}</Text>
                <View style={{ height: '8rpx' }} />
                <Text className="muted">发布方：{it.publisher?.displayName || '-'}</Text>
                <View style={{ height: '12rpx' }} />
                <View className="row" style={{ gap: '12rpx' }}>
                  <View style={{ flex: 1 }}>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        Taro.navigateTo({ url: `/pages/demand/detail/index?demandId=${it.id}` });
                      }}
                    >
                      查看
                    </Button>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button
                      variant="danger"
                      fill="outline"
                      onClick={async () => {
                        if (!ensureApproved()) return;
                        try {
                          await unfavoriteDemand(it.id);
                          toast('已取消收藏', { icon: 'success' });
                          void load();
                        } catch (e: any) {
                          toast(e?.message || '操作失败');
                        }
                      }}
                    >
                      取消收藏
                    </Button>
                  </View>
                </View>
              </Surface>
            ))}
          </View>
        ) : (
          <View>
            {achievementItems.map((it: AchievementSummary) => (
              <Surface key={it.id} style={{ marginBottom: '16rpx' }}>
                <Text className="text-title clamp-2">{it.title || '未命名成果'}</Text>
                <View style={{ height: '8rpx' }} />
                <Text className="muted">发布方：{it.publisher?.displayName || '-'}</Text>
                <View style={{ height: '12rpx' }} />
                <View className="row" style={{ gap: '12rpx' }}>
                  <View style={{ flex: 1 }}>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        Taro.navigateTo({ url: `/pages/achievement/detail/index?achievementId=${it.id}` });
                      }}
                    >
                      查看
                    </Button>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button
                      variant="danger"
                      fill="outline"
                      onClick={async () => {
                        if (!ensureApproved()) return;
                        try {
                          await unfavoriteAchievement(it.id);
                          toast('已取消收藏', { icon: 'success' });
                          void load();
                        } catch (e: any) {
                          toast(e?.message || '操作失败');
                        }
                      }}
                    >
                      取消收藏
                    </Button>
                  </View>
                </View>
              </Surface>
            ))}
          </View>
        )}
      </PageState>
    </View>
  );
}
