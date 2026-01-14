import { View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useMemo, useState } from 'react';

import type { components } from '@ipmoney/api-types';

import { listFavorites, unfavorite } from '../../lib/favorites';
import { apiPost } from '../../lib/api';
import { ensureApproved, usePageAccess } from '../../lib/guard';
import { ListingCard } from '../../ui/ListingCard';
import { PageState } from '../../ui/PageState';
import { PageHeader, Spacer, Surface } from '../../ui/layout';

type PagedListingSummary = components['schemas']['PagedListingSummary'];
type ListingSummary = components['schemas']['ListingSummary'];

type Conversation = { id: string };

export default function FavoritesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PagedListingSummary | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await listFavorites(1, 20);
      setData(d);
    } catch (e: any) {
      setError(e?.message || '加载失败');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const access = usePageAccess('approved-required', (a) => {
    if (a.state === 'ok') {
      void load();
      return;
    }
    setLoading(false);
    setError(null);
    setData(null);
  });

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

  return (
    <View className="container">
      <PageHeader title="我的收藏" subtitle="收藏后可快速回访；取消收藏后将不再显示" />
      <Spacer />

      <PageState
        access={access}
        loading={loading}
        error={error}
        onRetry={load}
        empty={!loading && !error && items.length === 0}
        emptyMessage="暂无收藏"
        emptyActionText="刷新"
        onEmptyAction={load}
      >
        <Surface padding="none" className="listing-list">
          {items.map((it: ListingSummary) => (
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
                  Taro.showToast({ title: '已取消收藏', icon: 'success' });
                  void load();
                } catch (e: any) {
                  Taro.showToast({ title: e?.message || '操作失败', icon: 'none' });
                }
              }}
              onConsult={() => {
                void startConsult(it.id);
              }}
            />
          ))}
        </Surface>
      </PageState>
    </View>
  );
}
