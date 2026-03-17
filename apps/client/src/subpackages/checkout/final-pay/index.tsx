import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './index.scss';

import { apiGet, apiPost } from '../../../lib/api';
import { getDetailCache, setDetailCache } from '../../../lib/detailCache';
import { ensureApproved } from '../../../lib/guard';
import { fenToYuan } from '../../../lib/money';
import { safeNavigateBack } from '../../../lib/navigation';
import { useRouteStringParam } from '../../../lib/routeParams';
import { PageHeader, Spacer, StickyBar, Surface } from '../../../ui/layout';
import { Button, toast } from '../../../ui/nutui';
import { ErrorCard, LoadingCard, MissingParamCard } from '../../../ui/StateCards';
import type { MiniProgramPayGuideProps } from '../components/MiniProgramPayGuide';

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

type MiniProgramPayGuideComponent = React.ComponentType<MiniProgramPayGuideProps>;
const ORDER_DETAIL_CACHE_SCOPE = 'order-detail';

export default function FinalPayPage() {
  const orderId = useRouteStringParam('orderId') || '';
  const env = useMemo(() => Taro.getEnv(), []);
  const isH5 = env === Taro.ENV_TYPE.WEB;
  const initialCachedOrder = orderId ? getDetailCache<Order>(ORDER_DETAIL_CACHE_SCOPE, orderId) : null;

  const [loading, setLoading] = useState(!initialCachedOrder);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<Order | null>(initialCachedOrder);
  const [paying, setPaying] = useState(false);
  const [PayGuide, setPayGuide] = useState<MiniProgramPayGuideComponent | null>(null);
  const canPayFinal = order?.status === 'WAIT_FINAL_PAYMENT';

  useEffect(() => {
    if (!orderId) {
      setOrder(null);
      setLoading(false);
      setError(null);
      return;
    }
    const cached = getDetailCache<Order>(ORDER_DETAIL_CACHE_SCOPE, orderId);
    setOrder(cached || null);
    setLoading(!cached);
    setError(null);
  }, [orderId]);

  const load = useCallback(async () => {
    if (!orderId) return;
    const cached = getDetailCache<Order>(ORDER_DETAIL_CACHE_SCOPE, orderId);
    const hasCached = Boolean(cached);
    if (cached) {
      setOrder(cached);
      setLoading(false);
      setError(null);
    } else {
      setLoading(true);
      setError(null);
    }
    try {
      const d = await apiGet<Order>(`/orders/${orderId}`);
      setOrder(d);
      setDetailCache(ORDER_DETAIL_CACHE_SCOPE, orderId, d);
    } catch (e: any) {
      if (!hasCached) {
        setError(e?.message || '加载失败');
        setOrder(null);
      }
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!isH5) {
      setPayGuide(null);
      return;
    }
    let alive = true;
    /* #ifdef H5 */
    import('../components/MiniProgramPayGuide')
      .then((mod) => {
        if (!alive) return;
        setPayGuide(() => mod.MiniProgramPayGuide);
      })
      .catch(() => {
        if (!alive) return;
        setPayGuide(null);
      });
    /* #endif */
    return () => {
      alive = false;
    };
  }, [isH5]);

  const onPay = useCallback(async () => {
    if (!ensureApproved()) return;
    if (!orderId) return;
    if (!canPayFinal) {
      toast('当前订单状态不可支付尾款');
      return;
    }
    if (isH5) {
      toast('H5 端不发起支付，请到小程序完成支付');
      return;
    }
    setPaying(true);
    try {
      const intent = await apiPost<PaymentIntentResponse>(
        `/orders/${orderId}/payment-intents`,
        { payType: 'FINAL' },
        { idempotencyKey: `pay-final-${orderId}` },
      );
      Taro.navigateTo({
        url: `/subpackages/checkout/final-success/index?orderId=${orderId}&paymentId=${intent.paymentId}`,
      });
    } catch (e: any) {
      toast(e?.message || '支付失败');
    } finally {
      setPaying(false);
    }
  }, [canPayFinal, isH5, orderId]);

  if (!orderId) {
    return (
      <View className="container">
        <PageHeader title="支付尾款" />
        <Spacer />
        <MissingParamCard onAction={() => void safeNavigateBack()} />
      </View>
    );
  }

  return (
    <View className="container has-sticky pay-page">
      <PageHeader title="支付尾款" subtitle={order ? `订单号：${order.id}` : `订单号：${orderId.slice(0, 8)}…`} />
      <Spacer />

      {loading ? (
        <LoadingCard />
      ) : error ? (
        <ErrorCard message={error} onRetry={load} />
      ) : order ? (
        <View>
          <Surface className="pay-card" padding="md">
            <Text className="pay-section-title">金额信息</Text>
            <View className="pay-row">
              <Text className="pay-row-label">成交总价</Text>
              <Text className="pay-row-value">{order.dealAmountFen ? `¥${fenToYuan(order.dealAmountFen)}` : '待确认'}</Text>
            </View>
            <View className="pay-row">
              <Text className="pay-row-label">已付订金</Text>
              <Text className="pay-row-value">- ¥{fenToYuan(order.depositAmountFen)}</Text>
            </View>
            <View className="pay-row pay-row-strong">
              <Text className="pay-row-label">应付尾款</Text>
              <Text className="pay-row-value">
                {order.finalAmountFen ? `¥${fenToYuan(order.finalAmountFen)}` : '待确认'}
              </Text>
            </View>
          </Surface>

          <Spacer size={12} />

          <Surface className="pay-card" padding="md">
            <Text className="pay-section-title">支付说明</Text>
            <Text className="pay-note">
              尾款支付后资金进入平台托管账户，待权属变更完成并确认无误后进行结算。
            </Text>
          </Surface>

          {isH5 ? (
            <>
              <Spacer size={12} />
              {PayGuide ? (
                <PayGuide
                  miniProgramPath={`pages/checkout/final-pay/index?orderId=${orderId}`}
                  description="H5 端不发起支付。微信内可一键跳转小程序；微信外/桌面可复制链接或扫码在微信打开。"
                />
              ) : (
                <Surface className="pay-card" padding="md">
                  <Text className="muted">支付引导加载中…</Text>
                </Surface>
              )}
            </>
          ) : null}
        </View>
      ) : (
        <ErrorCard title="无数据" message="订单不存在或不可见。" />
      )}

      {order && !loading && !error && !isH5 ? (
        <StickyBar>
          <View className="flex-1">
            <Button variant="ghost" onClick={() => Taro.navigateBack()}>
              返回
            </Button>
          </View>
          <View style={{ flex: 2, minWidth: 0 }}>
            <Button variant="primary" loading={paying} disabled={paying || !canPayFinal} onClick={onPay}>
              {paying ? '处理中…' : !canPayFinal ? '当前不可支付' : `支付尾款${order.finalAmountFen ? ` ¥${fenToYuan(order.finalAmountFen)}` : ''}`}
            </Button>
          </View>
        </StickyBar>
      ) : null}
    </View>
  );
}
