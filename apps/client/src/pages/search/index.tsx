import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useState } from 'react';

import { apiGet, apiPost } from '../../lib/api';
import { requireLogin } from '../../lib/guard';
import { EmptyCard, ErrorCard, LoadingCard } from '../../ui/StateCards';

type PagedListingSummary = {
  items: Array<{
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
  }>;
  page: { page: number; pageSize: number; total: number };
};

type Conversation = { id: string };

function fenToYuan(fen?: number): string {
  if (fen === undefined || fen === null) return '-';
  return (fen / 100).toFixed(2);
}

export default function SearchPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PagedListingSummary | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await apiGet<PagedListingSummary>('/search/listings', { page: 1, pageSize: 10 });
      setData(d);
    } catch (e: any) {
      setError(e?.message || '加载失败');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

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

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <View className="container">
      <View className="card">
        <Text style={{ fontSize: '34rpx', fontWeight: 700 }}>专利交易检索</Text>
        <View style={{ height: '8rpx' }} />
        <Text className="muted">游客可搜索/看列表/看详情；收藏/咨询/下单需登录。</Text>
      </View>

      <View style={{ height: '16rpx' }} />

      <View
        className="card btn-ghost"
        onClick={() => {
          Taro.navigateTo({ url: '/pages/inventors/index' });
        }}
      >
        <Text>发明人榜</Text>
      </View>

      <View style={{ height: '12rpx' }} />

      <View
        className="card btn-ghost"
        onClick={() => {
          Taro.navigateTo({ url: '/pages/patent-map/index' });
        }}
      >
        <Text>专利地图</Text>
      </View>

      <View style={{ height: '16rpx' }} />

      {loading ? (
        <LoadingCard />
      ) : error ? (
        <ErrorCard message={error} onRetry={load} />
      ) : data?.items?.length ? (
        <View>
          {data.items.map((it) => (
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
              </Text>
              <View style={{ height: '6rpx' }} />
              <Text className="muted">
                价格：{it.priceType === 'NEGOTIABLE' ? '面议' : `¥${fenToYuan(it.priceAmountFen)}`}{' '}
                · 订金：¥
                {fenToYuan(it.depositAmountFen)}
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
          message="可切换 Mock 场景为 happy / empty / error / edge 进行演示。"
          actionText="刷新"
          onAction={load}
        />
      )}

      <View style={{ height: '16rpx' }} />

      <View
        className="card btn-ghost"
        onClick={() => {
          if (!requireLogin()) return;
          Taro.showToast({ title: '收藏/咨询入口（待接 IM/工单）', icon: 'none' });
        }}
      >
        <Text>收藏/咨询（需登录）</Text>
      </View>
    </View>
  );
}
