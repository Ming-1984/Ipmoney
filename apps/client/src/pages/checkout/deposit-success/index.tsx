import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useState } from 'react';
import './index.scss';

import type { components } from '@ipmoney/api-types';

import { getToken } from '../../../lib/auth';
import { apiGet } from '../../../lib/api';
import { orderStatusLabel } from '../../../lib/labels';
import { fenToYuan } from '../../../lib/money';
import { safeNavigateBack } from '../../../lib/navigation';
import { useRouteUuidParam } from '../../../lib/routeParams';
import { Button } from '../../../ui/nutui';
import { PageHeader, Spacer, Surface } from '../../../ui/layout';
import { LoadingCard, MissingParamCard, PermissionCard } from '../../../ui/StateCards';

type Order = components['schemas']['Order'];

export default function DepositSuccessPage() {
  const orderId = useRouteUuidParam('orderId') || '';
  const paymentId = useRouteUuidParam('paymentId') || '';
  const token = getToken();

  if (!orderId) {
    return (
      <View className="container">
        <MissingParamCard onAction={() => void safeNavigateBack()} />
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
    <View className="container pay-page pay-result-page">
      <PageHeader title="支付结果" />
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
      ) : (
        <View className="pay-result">
          <View className="pay-result-icon">✓</View>
          <Text className="pay-result-title">订金支付成功</Text>
          <Text className="pay-result-subtitle">支付单号：{paymentId || '-'}</Text>

          {order ? (
            <Surface className="pay-result-card" padding="md">
              <Text className="pay-section-title">订单摘要</Text>
              <View className="pay-summary-list">
                <View className="pay-summary-item">
                  <Text className="pay-summary-label">订单号</Text>
                  <Text className="pay-summary-value">{order.id}</Text>
                </View>
                <View className="pay-summary-item">
                  <Text className="pay-summary-label">状态</Text>
                  <Text className="pay-summary-value">{order.status ? orderStatusLabel(order.status) : '未知'}</Text>
                </View>
                <View className="pay-summary-item">
                  <Text className="pay-summary-label">订金</Text>
                  <Text className="pay-summary-value">¥{fenToYuan(order.depositAmountFen)}</Text>
                </View>
              </View>
            </Surface>
          ) : null}

          <Surface className="pay-result-card" padding="md">
            <View className="pay-result-bullets">
              <View className="pay-result-bullet">
                <View className="pay-result-dot" />
                <Text>平台专属客服将在 15 分钟内联系您确认交易细节。</Text>
              </View>
              <View className="pay-result-bullet">
                <View className="pay-result-dot" />
                <Text>双方线下签署协议后，可在平台支付剩余尾款。</Text>
              </View>
            </View>
          </Surface>

          <View className="pay-result-actions">
            <Button
              variant="default"
              onClick={() => {
                if (!orderId) return;
                Taro.navigateTo({ url: `/pages/orders/detail/index?orderId=${orderId}` });
              }}
            >
              查看订单
            </Button>
            <Button variant="primary" onClick={() => Taro.navigateTo({ url: '/pages/support/contact/index' })}>
              联系客服
            </Button>
          </View>
        </View>
      )}
    </View>
  );
}
