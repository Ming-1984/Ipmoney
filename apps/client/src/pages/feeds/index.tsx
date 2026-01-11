import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { getToken } from '../../lib/auth';
import { apiGet, apiPost } from '../../lib/api';
import { requireLogin } from '../../lib/guard';
import { EmptyCard, ErrorCard, LoadingCard } from '../../ui/StateCards';

type ListingSummary = {
  id: string;
  title: string;
  tradeMode: 'ASSIGNMENT' | 'LICENSE';
  priceType: 'FIXED' | 'NEGOTIABLE';
  priceAmountFen?: number;
  depositAmountFen: number;
  auditStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  status: 'DRAFT' | 'ACTIVE' | 'OFF_SHELF' | 'SOLD';
  createdAt: string;
  patentType?: 'INVENTION' | 'UTILITY_MODEL' | 'DESIGN';
  applicationNoDisplay?: string;
  inventorNames?: string[];
  regionCode?: string;
  industryTags?: string[];
  featuredLevel?: 'NONE' | 'PROVINCE' | 'CITY';
  featuredRegionCode?: string;
  featuredRank?: number;
  stats?: { viewCount: number; favoriteCount: number; consultCount: number };
  recommendationScore?: number;
};

type PagedListingSummary = {
  items: ListingSummary[];
  page: { page: number; pageSize: number; total: number };
};

type Conversation = { id: string };

function fenToYuan(fen?: number): string {
  if (fen === undefined || fen === null) return '-';
  return (fen / 100).toFixed(2);
}

export default function FeedsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PagedListingSummary | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getToken();
      const d = token
        ? await apiGet<PagedListingSummary>('/me/recommendations/listings', {
            page: 1,
            pageSize: 10,
          })
        : await apiGet<PagedListingSummary>('/search/listings', {
            sortBy: 'RECOMMENDED',
            page: 1,
            pageSize: 10,
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

  const items = useMemo(() => data?.items || [], [data?.items]);

  const startConsult = useCallback(async (listingId: string) => {
    if (!requireLogin()) return;
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
      <View className="card">
        <Text style={{ fontSize: '34rpx', fontWeight: 700 }}>信息流（猜你喜欢）</Text>
        <View style={{ height: '8rpx' }} />
        <Text className="muted">登录用户：个性化推荐；游客：默认推荐排序。</Text>
      </View>

      <View style={{ height: '16rpx' }} />

      <View
        className="card btn-ghost"
        onClick={() => {
          Taro.navigateTo({ url: '/pages/inventors/index' });
        }}
      >
        <Text>查看发明人榜</Text>
      </View>

      <View style={{ height: '12rpx' }} />

      <View
        className="card btn-ghost"
        onClick={() => {
          Taro.navigateTo({ url: '/pages/organizations/index' });
        }}
      >
        <Text>查看机构展示</Text>
      </View>

      <View style={{ height: '16rpx' }} />

      {loading ? (
        <LoadingCard />
      ) : error ? (
        <ErrorCard message={error} onRetry={load} />
      ) : items.length ? (
        <View>
          {items.map((it) => (
            <View
              key={it.id}
              className="card"
              style={{ marginBottom: '16rpx' }}
              onClick={() => {
                Taro.navigateTo({ url: `/pages/listing/detail/index?listingId=${it.id}` });
              }}
            >
              <Text style={{ fontWeight: 700 }}>{it.title}</Text>
              <View style={{ height: '6rpx' }} />
              <Text className="muted">
                {it.patentType || '-'} · {it.tradeMode} · {it.priceType}
                {it.featuredLevel && it.featuredLevel !== 'NONE'
                  ? ` · 特色：${it.featuredLevel}`
                  : ''}
              </Text>
              <View style={{ height: '6rpx' }} />
              <Text className="muted">
                价格：{it.priceType === 'NEGOTIABLE' ? '面议' : `¥${fenToYuan(it.priceAmountFen)}`}{' '}
                · 订金：¥
                {fenToYuan(it.depositAmountFen)}
              </Text>
              <View style={{ height: '6rpx' }} />
              <Text className="muted">
                热度：浏览 {it.stats?.viewCount ?? 0} / 收藏 {it.stats?.favoriteCount ?? 0} / 咨询{' '}
                {it.stats?.consultCount ?? 0} · 推荐分 {it.recommendationScore ?? '-'}
              </Text>

              <View style={{ height: '12rpx' }} />

              <View
                className="btn-ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!requireLogin()) return;
                  Taro.showToast({ title: '收藏成功（演示）', icon: 'success' });
                }}
              >
                <Text>收藏（需登录）</Text>
              </View>

              <View style={{ height: '10rpx' }} />

              <View
                className="btn-primary"
                onClick={(e) => {
                  e.stopPropagation();
                  void startConsult(it.id);
                }}
              >
                <Text>咨询（需登录）</Text>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <EmptyCard
          message="可切换 Mock 场景为 happy/empty/error/edge 进行演示。"
          actionText="刷新"
          onAction={load}
        />
      )}
    </View>
  );
}
