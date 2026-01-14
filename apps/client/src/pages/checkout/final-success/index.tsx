import { View, Text } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { getToken } from '../../../lib/auth';
import { apiGet } from '../../../lib/api';
import { Button, Step, Steps } from '../../../ui/nutui';
import { PageHeader, Spacer } from '../../../ui/layout';
import { ErrorCard, LoadingCard, PermissionCard } from '../../../ui/StateCards';

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
  const token = getToken();

  if (!orderId) {
    return (
      <View className="container">
        <ErrorCard title="参数缺失" message="缺少 orderId" onRetry={() => Taro.navigateBack()} />
      </View>
    );
  }

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<Order | null>(null);

  const load = useCallback(async () => {
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
    if (!token) return;
    void load();
  }, [load, token]);

  return (
    <View className="container">
      <PageHeader title="尾款支付成功" subtitle={`支付单号：${paymentId || '-'}`} />
      <Spacer />

      {!token ? (
        <PermissionCard
          title="需要登录"
          message="登录后查看订单信息。"
          actionText="去登录"
          onAction={() => Taro.navigateTo({ url: '/pages/login/index' })}
        />
      ) : loading ? (
        <LoadingCard text="加载订单中…" />
      ) : order ? (
        <View className="card">
          <Text className="text-card-title">订单信息</Text>
          <View style={{ height: '8rpx' }} />
          <Text className="muted">订单号：{order.id}</Text>
          <View style={{ height: '4rpx' }} />
          <Text className="muted">状态：{order.status}</Text>
          <View style={{ height: '4rpx' }} />
          <Text className="muted">
            订金：
            <Text className="text-strong" style={{ color: 'var(--c-primary)' }}>
              {`¥${fenToYuan(order.depositAmountFen)}`}
            </Text>
          </Text>
          <View style={{ height: '4rpx' }} />
          <Text className="muted">
            尾款：
            <Text className="text-strong" style={{ color: 'var(--c-primary)' }}>
              {order.finalAmountFen ? `¥${fenToYuan(order.finalAmountFen)}` : '（待确认）'}
            </Text>
          </Text>
        </View>
      ) : (
        <View className="card">
          <Text className="muted">订单信息暂不可用</Text>
        </View>
      )}

      <Spacer />

      <View className="card">
        <Text className="text-card-title">下一步</Text>
        <View style={{ height: '10rpx' }} />
        <Steps direction="vertical" value={1} type="text">
          {[
            '提交/跟进权属变更',
            '变更完成后平台确认放款/结算',
            '可在消息中与客服/对方沟通并留痕',
          ].map((t, idx) => (
            <Step key={t} value={idx + 1} title={t} />
          ))}
        </Steps>
      </View>

      <Spacer />

      <View className="card">
        <Button
          onClick={() => {
            Taro.switchTab({ url: '/pages/messages/index' });
          }}
        >
          进入咨询/跟单
        </Button>
      </View>

      <Spacer size={12} />

      <View className="card">
        <Button
          variant="ghost"
          onClick={() => {
            Taro.switchTab({ url: '/pages/home/index' });
          }}
        >
          返回首页
        </Button>
      </View>
    </View>
  );
}
