import { View, Text } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { apiGet } from '../../../lib/api';
import { LoadingCard } from '../../../ui/StateCards';

type Order = {
  id: string;
  status: string;
  depositAmountFen: number;
  finalAmountFen?: number;
  createdAt: string;
};

function fenToYuan(fen?: number): string {
  if (fen === undefined || fen === null) return '-';
  return (fen / 100).toFixed(2);
}

export default function FinalSuccessPage() {
  const router = useRouter();
  const orderId = useMemo(() => router?.params?.orderId || '', [router?.params?.orderId]);
  const paymentId = useMemo(() => router?.params?.paymentId || '', [router?.params?.paymentId]);

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<Order | null>(null);

  const load = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    try {
      const d = await apiGet<Order>(`/orders/${orderId}`);
      setOrder(d);
    } catch (_) {
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <View className="container">
      <View className="card">
        <Text style={{ fontSize: '34rpx', fontWeight: 800 }}>尾款支付成功（演示）</Text>
        <View style={{ height: '8rpx' }} />
        <Text className="muted">支付单号：{paymentId || '-'}</Text>
      </View>

      <View style={{ height: '16rpx' }} />

      {loading ? (
        <LoadingCard text="加载订单中…" />
      ) : order ? (
        <View className="card">
          <Text style={{ fontWeight: 700 }}>订单信息</Text>
          <View style={{ height: '8rpx' }} />
          <Text className="muted">订单号：{order.id}</Text>
          <View style={{ height: '4rpx' }} />
          <Text className="muted">状态：{order.status}</Text>
          <View style={{ height: '4rpx' }} />
          <Text className="muted">订金：¥{fenToYuan(order.depositAmountFen)}</Text>
          <View style={{ height: '4rpx' }} />
          <Text className="muted">
            尾款：{order.finalAmountFen ? `¥${fenToYuan(order.finalAmountFen)}` : '（待确认）'}
          </Text>
        </View>
      ) : (
        <View className="card">
          <Text className="muted">订单信息暂不可用（演示）</Text>
        </View>
      )}

      <View style={{ height: '16rpx' }} />

      <View
        className="card btn-primary"
        onClick={() => {
          Taro.switchTab({ url: '/pages/messages/index' });
        }}
      >
        <Text>进入咨询/跟单（演示）</Text>
      </View>

      <View style={{ height: '12rpx' }} />

      <View
        className="card btn-ghost"
        onClick={() => {
          Taro.switchTab({ url: '/pages/home/index' });
        }}
      >
        <Text>返回首页</Text>
      </View>
    </View>
  );
}
