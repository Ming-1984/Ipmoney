import { View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import './index.scss';

import type { components } from '@ipmoney/api-types';

import { listAchievementFavorites, listFavorites, unfavorite } from '../../lib/favorites';
import { apiPost } from '../../lib/api';
import { ensureApproved, usePageAccess } from '../../lib/guard';
import { usePagedList } from '../../lib/usePagedList';
import { CategoryControl } from '../../ui/filters';
import { AchievementCard } from '../../ui/AchievementCard';
import { ListingCard } from '../../ui/ListingCard';
import { PageState } from '../../ui/PageState';
import { ListFooter } from '../../ui/ListFooter';
import { PageHeader, Spacer } from '../../ui/layout';
import { PullToRefresh, toast } from '../../ui/nutui';
import emptyFavorites from '../../assets/illustrations/empty-favorites.svg';

type ListingSummary = components['schemas']['ListingSummary'];
type AchievementSummary = components['schemas']['AchievementSummary'];

type Conversation = { id: string };

export default function FavoritesPage() {
  const loadedOnceRef = useRef(false);
  const [tab, setTab] = useState<'LISTING' | 'ACHIEVEMENT'>('LISTING');
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
    useCallback(async ({ page, pageSize }: { page: number; pageSize: number }) => listAchievementFavorites(page, pageSize), []),
    {
      pageSize: 20,
      onError: (message, ctx) => {
        if (ctx === 'loadMore') toast(message);
      },
    },
  );

  const access = usePageAccess('approved-required', (a) => {
    if (a.state === 'ok') {
      if (loadedOnceRef.current) {
        void listingList.refresh();
        void achievementList.refresh();
      }
      return;
    }
    loadedOnceRef.current = false;
    listingList.reset();
    achievementList.reset();
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
    listingList.items.length,
    listingList.loading,
    listingList.reload,
    achievementList.items.length,
    achievementList.loading,
    achievementList.reload,
    tab,
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

  const showInitialLoading =
    tab === 'LISTING'
      ? listingList.loading && listingItems.length === 0
      : achievementList.loading && achievementItems.length === 0;
  const activeError = tab === 'LISTING' ? listingList.error : achievementList.error;
  const activeRefreshing = tab === 'LISTING' ? listingList.refreshing : achievementList.refreshing;
  const activeHasMore = tab === 'LISTING' ? listingList.hasMore : achievementList.hasMore;
  const activeLoadingMore = tab === 'LISTING' ? listingList.loadingMore : achievementList.loadingMore;
  const activeLoadMore = tab === 'LISTING' ? listingList.loadMore : achievementList.loadMore;
  const activeReload = tab === 'LISTING' ? listingList.reload : achievementList.reload;
  const activeRefresh = tab === 'LISTING' ? listingList.refresh : achievementList.refresh;

  return (
    <View className="container favorites-page">
      <PageHeader title="我的收藏" subtitle="收藏后可快速回访；取消收藏后将不再显示" />
      <Spacer />

      <CategoryControl
        value={tab}
        options={[
          { label: '专利交易', value: 'LISTING' },
          { label: '专利成果', value: 'ACHIEVEMENT' },
        ]}
        onChange={(value) => setTab(value as 'LISTING' | 'ACHIEVEMENT')}
      />
      <View style={{ height: '12rpx' }} />

      <PageState
        access={access}
        loading={showInitialLoading}
        error={activeError}
        onRetry={activeReload}
        empty={
          !showInitialLoading &&
          !activeError &&
          (tab === 'LISTING' ? listingItems.length === 0 : achievementItems.length === 0)
        }
        emptyTitle="暂无收藏"
        emptyMessage="看到心仪内容，点击“收藏”即可保存。"
        emptyActionText="刷新"
        emptyImage={emptyFavorites}
        onEmptyAction={activeReload}
      >
        <PullToRefresh type="primary" disabled={showInitialLoading || activeRefreshing} onRefresh={activeRefresh}>
          <View className="search-card-list listing-card-list">
            {tab === 'LISTING'
              ? listingItems.map((it: ListingSummary) => (
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
                ))
              : achievementItems.map((it: AchievementSummary) => (
                  <AchievementCard
                    key={it.id}
                    item={it}
                    onClick={() => {
                      Taro.navigateTo({ url: `/subpackages/achievement/detail/index?achievementId=${it.id}` });
                    }}
                  />
                ))}
          </View>
          {!showInitialLoading && (tab === 'LISTING' ? listingItems.length : achievementItems.length) ? (
            <ListFooter loadingMore={activeLoadingMore} hasMore={activeHasMore} onLoadMore={activeLoadMore} showNoMore />
          ) : null}
        </PullToRefresh>
      </PageState>
    </View>
  );
}
