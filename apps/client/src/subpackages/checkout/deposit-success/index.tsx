import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import './index.scss';

import type { components } from '@ipmoney/api-types';

import { getToken } from '../../../lib/auth';
import { apiGet } from '../../../lib/api';
import { getDetailCache, setDetailCache } from '../../../lib/detailCache';
import { displayInfoOrPlaceholder } from '../../../lib/displayText';
import { orderStatusLabel } from '../../../lib/labels';
import { fenToYuan } from '../../../lib/money';
import { safeNavigateBack } from '../../../lib/navigation';
import { useRouteStringParam } from '../../../lib/routeParams';
import { Button } from '../../../ui/nutui';
import { PageHeader, Spacer, Surface } from '../../../ui/layout';
import { LoadingCard, MissingParamCard, PermissionCard } from '../../../ui/StateCards';

type Order = components['schemas']['Order'];
const ORDER_DETAIL_CACHE_SCOPE = 'order-detail';
const DEPOSIT_PAYMENT_SUCCESS_STATUS_VALUES = [
  'DEPOSIT_PAID',
  'WAIT_FINAL_PAYMENT',
  'FINAL_PAID_ESCROW',
  'READY_TO_SETTLE',
  'COMPLETED',
  'REFUNDING',
  'REFUNDED',
] as const;
const DEPOSIT_PAYMENT_SUCCESS_STATUSES = new Set<string>(DEPOSIT_PAYMENT_SUCCESS_STATUS_VALUES);

export default function DepositSuccessPage() {
  const orderId = useRouteStringParam('orderId') || '';
  const paymentId = useRouteStringParam('paymentId') || '';
  const orderIdRef = useRef(orderId);
  const loadSeqRef = useRef(0);
  const token = getToken();
  const initialCachedOrder = orderId ? getDetailCache<Order>(ORDER_DETAIL_CACHE_SCOPE, orderId) : null;

  const [loading, setLoading] = useState(!initialCachedOrder);
  const [order, setOrder] = useState<Order | null>(initialCachedOrder);

  useEffect(() => {
    orderIdRef.current = orderId;
    loadSeqRef.current += 1;
    if (!orderId) {
      setOrder(null);
      setLoading(false);
      return;
    }
    const cached = getDetailCache<Order>(ORDER_DETAIL_CACHE_SCOPE, orderId);
    setOrder(cached || null);
    setLoading(!cached);
  }, [orderId]);

  const load = useCallback(async () => {
    const targetOrderId = orderId;
    if (!targetOrderId) return;
    const seq = ++loadSeqRef.current;
    const cached = getDetailCache<Order>(ORDER_DETAIL_CACHE_SCOPE, targetOrderId);
    if (cached) {
      setOrder(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }
    try {
      const d = await apiGet<Order>(`/orders/${targetOrderId}`);
      if (seq !== loadSeqRef.current || orderIdRef.current !== targetOrderId) return;
      setOrder(d);
      setDetailCache(ORDER_DETAIL_CACHE_SCOPE, targetOrderId, d);
    } catch (_) {
      if (seq !== loadSeqRef.current || orderIdRef.current !== targetOrderId) return;
      if (!cached) setOrder(null);
    } finally {
      if (seq === loadSeqRef.current && orderIdRef.current === targetOrderId) setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    if (!token) return;
    void load();
  }, [load, token]);

  const paymentConfirmed = Boolean(order?.status && DEPOSIT_PAYMENT_SUCCESS_STATUSES.has(order.status));

  if (!orderId) {
    return (
      <View className="container">
        <MissingParamCard onAction={() => void safeNavigateBack()} />
      </View>
    );
  }

  return (
    <View className="container pay-page pay-result-page">
      <PageHeader title="支付结果" />
      <Spacer />

      {!token ? (
        <PermissionCard
          title="需要登录"
          message="登录后查看订单信息。"
          actionText="去登录"
          onAction={() => Taro.navigateTo({ url: '/subpackages/login/index' })}
        />
      ) : loading ? (
        <LoadingCard text="加载订单中…" />
      ) : (
        <View className="pay-result">
          <View className="pay-result-icon">{paymentConfirmed ? '✓' : '⏳'}</View>
          <Text className="pay-result-title">
            {paymentConfirmed ? '订金支付成功' : '订金支付待确认'}
          </Text>
          <Text className="pay-result-subtitle">
            {paymentConfirmed ? '支付单号' : '支付申请单号'}：{displayInfoOrPlaceholder(paymentId, '待补充')}
          </Text>

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
              {paymentConfirmed ? (
                <>
                  <View className="pay-result-bullet">
                    <View className="pay-result-dot" />
                    <Text>平台专属客服将在 15 分钟内联系您确认交易细节。</Text>
                  </View>
                  <View className="pay-result-bullet">
                    <View className="pay-result-dot" />
                    <Text>双方线下签署协议后，可在平台支付剩余尾款。</Text>
                  </View>
                </>
              ) : (
                <>
                  <View className="pay-result-bullet">
                    <View className="pay-result-dot" />
                    <Text>支付已提交，平台财务确认到账后将推进订单状态。</Text>
                  </View>
                  <View className="pay-result-bullet">
                    <View className="pay-result-dot" />
                    <Text>如需加急处理，请联系平台客服协助确认。</Text>
                  </View>
                </>
              )}
            </View>
          </Surface>

          <View className="pay-result-actions">
            <Button
              variant="default"
              onClick={() => {
                if (!orderId) return;
                Taro.navigateTo({ url: `/subpackages/orders/detail/index?orderId=${orderId}` });
              }}
            >
              查看订单
            </Button>
            <Button variant="primary" onClick={() => Taro.navigateTo({ url: '/subpackages/support/contact/index' })}>
              联系客服
            </Button>
          </View>
        </View>
      )}
    </View>
  );
}
