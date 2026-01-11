import { View, Text } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { apiGet, apiPost } from '../../../lib/api';
import { requireLogin } from '../../../lib/guard';
import { ErrorCard, LoadingCard } from '../../../ui/StateCards';

type Order = {
  id: string;
  status: string;
  depositAmountFen: number;
  dealAmountFen?: number;
  finalAmountFen?: number;
  createdAt: string;
};

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

export default function FinalPayPage() {
  const router = useRouter();
  const orderId = useMemo(() => router?.params?.orderId || '', [router?.params?.orderId]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [paying, setPaying] = useState(false);

  const load = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    setError(null);
    try {
      const d = await apiGet<Order>(`/orders/${orderId}`);
      setOrder(d);
    } catch (e: any) {
      setError(e?.message || '加载失败');
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  const onPay = useCallback(async () => {
    if (!requireLogin()) return;
    if (!orderId) return;
    setPaying(true);
    try {
      const intent = await apiPost<PaymentIntentResponse>(
        `/orders/${orderId}/payment-intents`,
        { payType: 'FINAL' },
        { idempotencyKey: `demo-final-${orderId}` },
      );
      Taro.navigateTo({
        url: `/pages/checkout/final-success/index?orderId=${orderId}&paymentId=${intent.paymentId}`,
      });
    } catch (e: any) {
      Taro.showToast({ title: e?.message || '支付失败', icon: 'none' });
    } finally {
      setPaying(false);
    }
  }, [orderId]);

  if (!orderId) {
    return (
      <View className="container">
        <ErrorCard
          title="参数缺失"
          message="缺少 orderId（演示）"
          onRetry={() => Taro.navigateBack()}
        />
      </View>
    );
  }

  return (
    <View className="container">
      {loading ? (
        <LoadingCard />
      ) : error ? (
        <ErrorCard message={error} onRetry={load} />
      ) : order ? (
        <View>
          <View className="card">
            <Text style={{ fontSize: '34rpx', fontWeight: 800 }}>尾款支付（演示）</Text>
            <View style={{ height: '8rpx' }} />
            <Text className="muted">订单号：{order.id}</Text>
            <View style={{ height: '6rpx' }} />
            <Text className="muted">状态：{order.status}</Text>
          </View>

          <View style={{ height: '16rpx' }} />

          <View className="card">
            <Text style={{ fontWeight: 700 }}>金额信息</Text>
            <View style={{ height: '8rpx' }} />
            <Text className="muted">订金：¥{fenToYuan(order.depositAmountFen)}</Text>
            <View style={{ height: '4rpx' }} />
            <Text className="muted">
              成交价：{order.dealAmountFen ? `¥${fenToYuan(order.dealAmountFen)}` : '（待确认）'}
            </Text>
            <View style={{ height: '4rpx' }} />
            <Text className="muted">
              尾款：{order.finalAmountFen ? `¥${fenToYuan(order.finalAmountFen)}` : '（待确认）'}
            </Text>
          </View>

          <View style={{ height: '16rpx' }} />

          <View
            className={`card ${paying ? '' : 'btn-primary'}`}
            onClick={paying ? undefined : onPay}
          >
            <Text>{paying ? '处理中…' : '生成支付意图（尾款）'}</Text>
          </View>

          <View style={{ height: '12rpx' }} />

          <View className="card">
            <Text className="muted">
              说明：P0 尾款仅小程序发起；H5
              端可展示“去小程序支付”（二维码/链接）。本页为演示链路占位。
            </Text>
          </View>
        </View>
      ) : (
        <ErrorCard title="无数据" message="订单不存在或不可见（演示）" />
      )}
    </View>
  );
}
