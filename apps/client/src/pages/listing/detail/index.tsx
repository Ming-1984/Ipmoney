import { View, Text } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { apiGet } from '../../../lib/api';
import { requireLogin } from '../../../lib/guard';

type ListingPublic = {
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
  summary?: string;
  seller?: { id: string; nickname?: string };
  stats?: { viewCount: number; favoriteCount: number; consultCount: number };
};

function fenToYuan(fen?: number): string {
  if (fen === undefined || fen === null) return '-';
  return (fen / 100).toFixed(2);
}

export default function ListingDetailPage() {
  const router = useRouter();
  const listingId = useMemo(() => router?.params?.listingId || '', [router?.params?.listingId]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ListingPublic | null>(null);

  const load = useCallback(async () => {
    if (!listingId) return;
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

  return (
    <View className="container">
      {loading ? (
        <View className="card">
          <Text className="muted">加载中…</Text>
        </View>
      ) : error ? (
        <View className="card">
          <Text style={{ fontWeight: 700 }}>加载失败</Text>
          <View style={{ height: '8rpx' }} />
          <Text className="muted">{error}</Text>
          <View style={{ height: '12rpx' }} />
          <View className="btn-primary" onClick={load}>
            <Text>重试</Text>
          </View>
        </View>
      ) : data ? (
        <View>
          <View className="card">
            <Text style={{ fontSize: '34rpx', fontWeight: 800 }}>{data.title}</Text>
            <View style={{ height: '8rpx' }} />
            <Text className="muted">
              {data.patentType || '-'} · {data.tradeMode} · {data.priceType}
            </Text>
            <View style={{ height: '6rpx' }} />
            <Text className="muted">
              价格：{data.priceType === 'NEGOTIABLE' ? '面议' : `¥${fenToYuan(data.priceAmountFen)}`} · 订金：¥
              {fenToYuan(data.depositAmountFen)}
            </Text>
            <View style={{ height: '8rpx' }} />
            <Text className="muted">卖家：{data.seller?.nickname || '-'}</Text>
          </View>

          <View style={{ height: '16rpx' }} />

          <View className="card">
            <Text style={{ fontWeight: 700 }}>摘要</Text>
            <View style={{ height: '8rpx' }} />
            <Text className="muted">{data.summary || '（暂无）'}</Text>
          </View>

          <View style={{ height: '16rpx' }} />

          <View
            className="card btn-primary"
            onClick={() => {
              if (!requireLogin()) return;
              Taro.navigateTo({ url: `/pages/checkout/deposit-pay/index?listingId=${listingId}` });
            }}
          >
            <Text>支付订金（需登录）</Text>
          </View>

          <View style={{ height: '12rpx' }} />

          <View
            className="card btn-ghost"
            onClick={() => {
              if (!requireLogin()) return;
              Taro.showToast({ title: '进入咨询（演示）', icon: 'none' });
            }}
          >
            <Text>咨询（需登录）</Text>
          </View>
        </View>
      ) : (
        <View className="card">
          <Text className="muted">无数据</Text>
        </View>
      )}
    </View>
  );
}
