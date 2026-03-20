import { View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import './index.scss';

import type { components } from '@ipmoney/api-types';

import { listFavorites, unfavorite } from '../../lib/favorites';
import { apiPost } from '../../lib/api';
import { ensureApproved, usePageAccess } from '../../lib/guard';
import { usePagedList } from '../../lib/usePagedList';
import { ListingCard } from '../../ui/ListingCard';
import { PageState } from '../../ui/PageState';
import { ListFooter } from '../../ui/ListFooter';
import { PageHeader, Spacer } from '../../ui/layout';
import { PullToRefresh, toast } from '../../ui/nutui';
import emptyFavorites from '../../assets/illustrations/empty-favorites.svg';

type ListingSummary = components['schemas']['ListingSummary'];

type Conversation = { id: string };

export default function FavoritesPage() {
  const loadedOnceRef = useRef(false);
  const listingList = usePagedList<ListingSummary>(
    useCallback(async ({ page, pageSize }: { page: number; pageSize: number }) => listFavorites(page, pageSize), []),
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
      }
      return;
    }
    loadedOnceRef.current = false;
    listingList.reset();
  });

  useEffect(() => {
    if (access.state !== 'ok') return;
    loadedOnceRef.current = true;
    if (!listingList.items.length && !listingList.loading) {
      void listingList.reload();
    }
  }, [
    access.state,
    listingList.items.length,
    listingList.loading,
    listingList.reload,
  ]);

  const listingItems = useMemo(() => listingList.items, [listingList.items]);

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

  const showInitialLoading = listingList.loading && listingItems.length === 0;

  return (
    <View className="container favorites-page">
      <PageHeader title="我的收藏" subtitle="收藏后可快速回访；取消收藏后将不再显示" />
      <Spacer />

      <PageState
        access={access}
        loading={showInitialLoading}
        error={listingList.error}
        onRetry={listingList.reload}
        empty={!showInitialLoading && !listingList.error && listingItems.length === 0}
        emptyTitle="暂无收藏"
        emptyMessage="看到心仪内容，点击“收藏”即可保存。"
        emptyActionText="刷新"
        emptyImage={emptyFavorites}
        onEmptyAction={listingList.reload}
      >
        <PullToRefresh type="primary" disabled={showInitialLoading || listingList.refreshing} onRefresh={listingList.refresh}>
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
          {!showInitialLoading && listingItems.length ? (
            <ListFooter
              loadingMore={listingList.loadingMore}
              hasMore={listingList.hasMore}
              onLoadMore={listingList.loadMore}
              showNoMore
            />
          ) : null}
        </PullToRefresh>
      </PageState>
    </View>
  );
}
