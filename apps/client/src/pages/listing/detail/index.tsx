import { View, Text } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import type { components } from '@ipmoney/api-types';

import { apiGet, apiPost } from '../../../lib/api';
import { getToken } from '../../../lib/auth';
import { favorite, isFavorited, syncFavorites, unfavorite } from '../../../lib/favorites';
import { ensureApproved } from '../../../lib/guard';
import { StickyBar, Surface } from '../../../ui/layout';
import { Button } from '../../../ui/nutui';
import { ErrorCard, LoadingCard } from '../../../ui/StateCards';

type ListingPublic = components['schemas']['ListingPublic'];

type Conversation = { id: string };

function fenToYuan(fen?: number): string {
  if (fen === undefined || fen === null) return '-';
  return (fen / 100).toFixed(2);
}

function patentTypeLabel(t?: ListingPublic['patentType']): string {
  if (!t) return '-';
  if (t === 'INVENTION') return '发明';
  if (t === 'UTILITY_MODEL') return '实用新型';
  if (t === 'DESIGN') return '外观设计';
  return String(t);
}

function tradeModeLabel(t: ListingPublic['tradeMode']): string {
  return t === 'ASSIGNMENT' ? '转让' : '许可';
}

function priceTypeLabel(t: ListingPublic['priceType']): string {
  return t === 'NEGOTIABLE' ? '面议' : '一口价';
}

function featuredLabel(level?: ListingPublic['featuredLevel']): string | null {
  if (!level || level === 'NONE') return null;
  if (level === 'PROVINCE') return '省级特色';
  if (level === 'CITY') return '市级特色';
  return String(level);
}

export default function ListingDetailPage() {
  const router = useRouter();
  const listingId = useMemo(() => router?.params?.listingId || '', [router?.params?.listingId]);

  if (!listingId) {
    return (
      <View className="container">
        <ErrorCard title="参数缺失" message="缺少 listingId" onRetry={() => Taro.navigateBack()} />
      </View>
    );
  }

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ListingPublic | null>(null);
  const [favoritedState, setFavoritedState] = useState(false);

  useEffect(() => {
    setFavoritedState(isFavorited(listingId));
  }, [listingId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await apiGet<ListingPublic>(`/public/listings/${listingId}`);
      setData(d);
    } catch (e: any) {
      setError(e?.message || '加载失败');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [listingId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!listingId) return;
    if (!getToken()) return;
    syncFavorites()
      .then((ids) => setFavoritedState(ids.includes(listingId)))
      .catch(() => {});
  }, [listingId]);

  const startConsult = useCallback(async () => {
    if (!ensureApproved()) return;
    try {
      await apiPost<void>(
        `/listings/${listingId}/consultations`,
        { channel: 'FORM' },
        { idempotencyKey: `c-${listingId}` },
      );
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
  }, [listingId]);

  const toggleFavorite = useCallback(async () => {
    if (!ensureApproved()) return;
    try {
      if (favoritedState) {
        await unfavorite(listingId);
        setFavoritedState(false);
        Taro.showToast({ title: '已取消收藏', icon: 'success' });
        return;
      }
      await favorite(listingId);
      setFavoritedState(true);
      Taro.showToast({ title: '已收藏', icon: 'success' });
    } catch (e: any) {
      Taro.showToast({ title: e?.message || '操作失败', icon: 'none' });
    }
  }, [favoritedState, listingId]);

  return (
    <View className="container has-sticky">
      {loading ? (
        <LoadingCard />
      ) : error ? (
        <ErrorCard message={error} onRetry={load} />
      ) : data ? (
        <View>
          <Surface className="card-header">
            <Text className="text-title clamp-2">{data.title}</Text>
            <View style={{ height: '8rpx' }} />
            <View style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap' }}>
              {data.patentType ? (
                <View style={{ marginRight: '8rpx', marginBottom: '8rpx' }}>
                  <Text className="tag tag-gold">{patentTypeLabel(data.patentType)}</Text>
                </View>
              ) : null}
              <View style={{ marginRight: '8rpx', marginBottom: '8rpx' }}>
                <Text className="tag">{tradeModeLabel(data.tradeMode)}</Text>
              </View>
              <View style={{ marginRight: '8rpx', marginBottom: '8rpx' }}>
                <Text className="tag">{priceTypeLabel(data.priceType)}</Text>
              </View>
              {featuredLabel(data.featuredLevel) ? (
                <View style={{ marginRight: '8rpx', marginBottom: '8rpx' }}>
                  <Text className="tag tag-gold">{featuredLabel(data.featuredLevel)}</Text>
                </View>
              ) : null}
            </View>
            <Text className="muted">
              价格：
              <Text className="text-strong" style={{ color: 'var(--c-primary)' }}>
                {data.priceType === 'NEGOTIABLE' ? '面议' : `¥${fenToYuan(data.priceAmountFen)}`}
              </Text>
              {'  '}· 订金：
              <Text className="text-strong" style={{ color: 'var(--c-primary)' }}>
                ¥{fenToYuan(data.depositAmountFen)}
              </Text>
            </Text>
            <View style={{ height: '8rpx' }} />
            <Text className="muted">卖家：{data.seller?.nickname || '-'}</Text>
            <View style={{ height: '6rpx' }} />
            <Text className="muted">
              热度：浏览 {data.stats?.viewCount ?? 0} / 收藏 {data.stats?.favoriteCount ?? 0} / 咨询{' '}
              {data.stats?.consultCount ?? 0}
            </Text>
          </Surface>

          <View style={{ height: '16rpx' }} />

          <Surface>
            <Text className="text-card-title">摘要</Text>
            <View style={{ height: '8rpx' }} />
            <Text className="muted">{data.summary || '（暂无）'}</Text>
          </Surface>

          <View style={{ height: '16rpx' }} />

          <Surface>
            <Text className="text-card-title">专利信息</Text>
            <View style={{ height: '8rpx' }} />
            <Text className="muted">申请号：{data.applicationNoDisplay || '-'}</Text>
            <View style={{ height: '6rpx' }} />
            <Text className="muted">
              发明人：{data.inventorNames?.length ? data.inventorNames.join(' / ') : '（暂无）'}
            </Text>
            <View style={{ height: '6rpx' }} />
            <Text className="muted">IPC：{data.ipcCodes?.length ? data.ipcCodes.join('；') : '（暂无）'}</Text>
            <View style={{ height: '6rpx' }} />
            <Text className="muted">Locarno：{data.locCodes?.length ? data.locCodes.join('；') : '（暂无）'}</Text>
            {data.patentId ? (
              <>
                <View style={{ height: '12rpx' }} />
                <Button
                  variant="ghost"
                  size="small"
                  onClick={() => {
                    Taro.navigateTo({ url: `/pages/patent/detail/index?patentId=${data.patentId}` });
                  }}
                >
                  查看专利详情
                </Button>
              </>
            ) : null}
          </Surface>

          <View style={{ height: '16rpx' }} />

          <Surface>
            <Text className="text-card-title">关键说明</Text>
            <View style={{ height: '8rpx' }} />
            <Text className="muted">合同线下签署；尾款在平台支付；权属变更完成后再放款（默认）。</Text>
            <View style={{ height: '12rpx' }} />
            <Button
              variant="ghost"
              size="small"
              onClick={() => {
                Taro.navigateTo({ url: '/pages/trade-rules/index' });
              }}
            >
              查看交易规则
            </Button>
          </Surface>
        </View>
      ) : (
        <Surface>
          <Text className="muted">无数据</Text>
        </Surface>
      )}

      {data ? (
        <StickyBar>
          <View className="flex-1">
            <Button
              variant={favoritedState ? 'primary' : 'ghost'}
              onClick={() => {
                void toggleFavorite();
              }}
            >
              {favoritedState ? '已收藏' : '收藏'}
            </Button>
          </View>
          <View className="flex-1">
            <Button
              variant="ghost"
              onClick={() => {
                void startConsult();
              }}
            >
              咨询
            </Button>
          </View>
          <View className="flex-1">
            <Button
              variant="primary"
              onClick={() => {
                if (!ensureApproved()) return;
                Taro.navigateTo({ url: `/pages/checkout/deposit-pay/index?listingId=${listingId}` });
              }}
            >
              {`支付订金 ¥${fenToYuan(data.depositAmountFen)}`}
            </Button>
          </View>
        </StickyBar>
      ) : null}
    </View>
  );
}
