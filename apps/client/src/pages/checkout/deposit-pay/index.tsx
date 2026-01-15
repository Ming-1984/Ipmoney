import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { apiGet, apiPost } from '../../../lib/api';
import { ensureApproved } from '../../../lib/guard';
import { fenToYuan } from '../../../lib/money';
import { safeNavigateBack } from '../../../lib/navigation';
import { useRouteUuidParam } from '../../../lib/routeParams';
import { PageHeader, StickyBar } from '../../../ui/layout';
import { Button, toast } from '../../../ui/nutui';
import { EmptyCard, ErrorCard, LoadingCard, MissingParamCard } from '../../../ui/StateCards';
import { MiniProgramPayGuide } from '../components/MiniProgramPayGuide';

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
export default function DepositPayPage() {
  const listingId = useRouteUuidParam('listingId') || '';
  const env = useMemo(() => Taro.getEnv(), []);
  const isH5 = env === Taro.ENV_TYPE.WEB;

  if (!listingId) {
    return (
      <View className="container">
        <MissingParamCard onAction={() => void safeNavigateBack()} />
      </View>
    );
  }

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [listing, setListing] = useState<ListingPublic | null>(null);
  const [paying, setPaying] = useState(false);

  const load = useCallback(async () => {
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
    if (!ensureApproved()) return;
    if (!listingId) return;
    if (isH5) {
      toast('H5 端不发起支付，请到小程序完成支付');
      return;
    }
    setPaying(true);
    try {
      const order = await apiPost<Order>('/orders', { listingId });
      const intent = await apiPost<PaymentIntentResponse>(
        `/orders/${order.id}/payment-intents`,
        { payType: 'DEPOSIT' },
        { idempotencyKey: `pay-deposit-${order.id}` },
      );

      Taro.navigateTo({
        url: `/pages/checkout/deposit-success/index?orderId=${order.id}&paymentId=${intent.paymentId}`,
      });
    } catch (e: any) {
      toast(e?.message || '支付失败');
    } finally {
      setPaying(false);
    }
  }, [isH5, listingId]);

  return (
    <View className="container has-sticky">
      <PageHeader title="支付订金" subtitle="订金用于锁定交易并启动跟单流程。" />

      <View style={{ height: '16rpx' }} />

      {loading ? (
        <LoadingCard text="加载交易信息…" />
      ) : error ? (
        <ErrorCard message={error} onRetry={load} />
      ) : listing ? (
        <View>
          <View className="card">
            <Text className="muted">交易摘要</Text>
            <View style={{ height: '8rpx' }} />
            <Text className="text-title clamp-2">{listing.title}</Text>
            <View style={{ height: '10rpx' }} />
            <Text className="muted">
              订金：
              <Text className="text-strong" style={{ color: 'var(--c-primary)' }}>
                ¥{fenToYuan(listing.depositAmountFen)}
              </Text>
              {'  '}· 价格：
              <Text className="text-strong" style={{ color: 'var(--c-primary)' }}>
                {listing.priceType === 'NEGOTIABLE' ? '面议' : `¥${fenToYuan(listing.priceAmountFen)}`}
              </Text>
            </Text>
          </View>

          <View style={{ height: '16rpx' }} />

          <View className="card">
            <Text className="text-card-title">订金说明</Text>
            <View style={{ height: '8rpx' }} />
            <Text className="muted">
              订金支付后平台将启动合同/材料核验与权属变更等流程。退款与争议处理以平台规则与人工审核为准。
            </Text>
          </View>

          <View style={{ height: '16rpx' }} />

          {isH5 ? (
            <>
              <MiniProgramPayGuide
                miniProgramPath={`pages/checkout/deposit-pay/index?listingId=${listingId}`}
                description="H5 端不发起支付。微信内可一键跳转小程序；微信外/桌面可复制链接或扫码在微信打开。"
              />
              <View style={{ height: '16rpx' }} />
            </>
          ) : null}
        </View>
      ) : (
        <EmptyCard title="无数据" message="该专利不存在或不可见。" actionText="返回" onAction={() => Taro.navigateBack()} />
      )}

      {listing && !loading && !error && !isH5 ? (
        <StickyBar>
          <View className="flex-1">
            <Button variant="ghost" onClick={() => Taro.navigateBack()}>
              返回
            </Button>
          </View>
          <View style={{ flex: 2, minWidth: 0 }}>
            <Button variant="primary" loading={paying} disabled={paying} onClick={onPay}>
              {paying ? '处理中…' : `支付订金 ¥${fenToYuan(listing.depositAmountFen)}`}
            </Button>
          </View>
        </StickyBar>
      ) : null}
    </View>
  );
}
