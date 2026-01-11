import { View, Text } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { apiGet, apiPost } from '../../../lib/api';
import { requireLogin } from '../../../lib/guard';

type ListingPublic = {
  id: string;
  title: string;
  depositAmountFen: number;
  priceType: 'FIXED' | 'NEGOTIABLE';
  priceAmountFen?: number;
};

type Order = { id: string; status: string; depositAmountFen: number; createdAt: string };
type PaymentIntentResponse = {
  paymentId: string;
  payType: 'DEPOSIT' | 'FINAL';
  channel: 'WECHAT';
  amountFen: number;
  wechatPayParams: {
    timeStamp: string;
    nonceStr: string;
    package: string;
    signType: string;
    paySign: string;
  };
};

function fenToYuan(fen?: number): string {
  if (fen === undefined || fen === null) return '-';
  return (fen / 100).toFixed(2);
}

export default function DepositPayPage() {
  const router = useRouter();
  const listingId = useMemo(() => router?.params?.listingId || '', [router?.params?.listingId]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [listing, setListing] = useState<ListingPublic | null>(null);
  const [paying, setPaying] = useState(false);

  const load = useCallback(async () => {
    if (!listingId) return;
    setLoading(true);
    setError(null);
    try {
      const d = await apiGet<ListingPublic>(`/public/listings/${listingId}`);
      setListing(d);
    } catch (e: any) {
      setError(e?.message || '加载失败');
      setListing(null);
    } finally {
      setLoading(false);
    }
  }, [listingId]);

  useEffect(() => {
    void load();
  }, [load]);

  const onPay = useCallback(async () => {
    if (!requireLogin()) return;
    if (!listingId) return;
    setPaying(true);
    try {
      const order = await apiPost<Order>('/orders', { listingId });
      const intent = await apiPost<PaymentIntentResponse>(
        `/orders/${order.id}/payment-intents`,
        { payType: 'DEPOSIT' },
        { idempotencyKey: `demo-deposit-${order.id}` },
      );

      Taro.navigateTo({
        url: `/pages/checkout/deposit-success/index?orderId=${order.id}&paymentId=${intent.paymentId}`,
      });
    } catch (e: any) {
      Taro.showToast({ title: e?.message || '支付失败', icon: 'none' });
    } finally {
      setPaying(false);
    }
  }, [listingId]);

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
      ) : listing ? (
        <View>
          <View className="card">
            <Text style={{ fontSize: '34rpx', fontWeight: 800 }}>{listing.title}</Text>
            <View style={{ height: '10rpx' }} />
            <Text className="muted">
              订金：¥{fenToYuan(listing.depositAmountFen)} · 价格：
              {listing.priceType === 'NEGOTIABLE'
                ? '面议'
                : `¥${fenToYuan(listing.priceAmountFen)}`}
            </Text>
          </View>

          <View style={{ height: '16rpx' }} />

          <View className="card">
            <Text style={{ fontWeight: 700 }}>说明（演示）</Text>
            <View style={{ height: '8rpx' }} />
            <Text className="muted">
              本页会调用：创建订单 → 创建支付意图（订金）。H5
              不做真实微信支付，仅用于展示对接流程与异常场景。
            </Text>
          </View>

          <View style={{ height: '16rpx' }} />

          <View
            className={`card ${paying ? '' : 'btn-primary'}`}
            onClick={paying ? undefined : onPay}
          >
            <Text>{paying ? '处理中…' : '生成支付意图（订金）'}</Text>
          </View>

          <View style={{ height: '16rpx' }} />

          <View
            className="card btn-ghost"
            onClick={() => {
              Taro.showToast({ title: '切换场景：在「我的」页设置 Mock 场景', icon: 'none' });
            }}
          >
            <Text>如何演示“幂等冲突/重放”？</Text>
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
