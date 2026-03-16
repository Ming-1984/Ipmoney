import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import './index.scss';

import { apiGet, apiPost } from '../../../lib/api';
import { getDetailCache, setDetailCache } from '../../../lib/detailCache';
import { ensureApproved } from '../../../lib/guard';
import { fenToYuan } from '../../../lib/money';
import { safeNavigateBack } from '../../../lib/navigation';
import { useRouteUuidParam } from '../../../lib/routeParams';
import { PageHeader, Spacer, StickyBar, Surface } from '../../../ui/layout';
import { Button, toast } from '../../../ui/nutui';
import { EmptyCard, ErrorCard, LoadingCard, MissingParamCard } from '../../../ui/StateCards';
import type { MiniProgramPayGuideProps } from '../components/MiniProgramPayGuide';

type PayTarget = {
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

type MiniProgramPayGuideComponent = React.ComponentType<MiniProgramPayGuideProps>;
const CHECKOUT_TARGET_CACHE_SCOPE = 'checkout-target';

function checkoutTargetCacheKey(listingId: string, artworkId: string): string {
  if (listingId) return `listing:${listingId}`;
  if (artworkId) return `artwork:${artworkId}`;
  return '';
}

function toPayTarget(raw: unknown): PayTarget | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  const id = String(value.id || '').trim();
  if (!id) return null;
  const depositAmountFen = Number(value.depositAmountFen);
  if (!Number.isFinite(depositAmountFen)) return null;
  const priceType = value.priceType === 'NEGOTIABLE' ? 'NEGOTIABLE' : 'FIXED';
  const priceAmountFen =
    typeof value.priceAmountFen === 'number' && Number.isFinite(value.priceAmountFen)
      ? value.priceAmountFen
      : undefined;
  return {
    id,
    title: String(value.title || '').trim() || '未命名内容',
    depositAmountFen,
    priceType,
    priceAmountFen,
  };
}

function readCachedPayTarget(listingId: string, artworkId: string): PayTarget | null {
  const targetCacheKey = checkoutTargetCacheKey(listingId, artworkId);
  if (targetCacheKey) {
    const cached = getDetailCache<PayTarget>(CHECKOUT_TARGET_CACHE_SCOPE, targetCacheKey);
    if (cached) return cached;
  }
  if (listingId) return toPayTarget(getDetailCache<unknown>('listing-public', listingId));
  if (artworkId) return toPayTarget(getDetailCache<unknown>('artwork-public', artworkId));
  return null;
}

export default function DepositPayPage() {
  const listingId = useRouteUuidParam('listingId') || '';
  const artworkId = useRouteUuidParam('artworkId') || '';
  const env = useMemo(() => Taro.getEnv(), []);
  const isH5 = env === Taro.ENV_TYPE.WEB;
  const targetCacheKey = checkoutTargetCacheKey(listingId, artworkId);
  const initialCachedTarget = readCachedPayTarget(listingId, artworkId);

  if (!listingId && !artworkId) {
    return (
      <View className="container">
        <MissingParamCard onAction={() => void safeNavigateBack()} />
      </View>
    );
  }

  const [loading, setLoading] = useState(!initialCachedTarget);
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<PayTarget | null>(initialCachedTarget);
  const [paying, setPaying] = useState(false);
  const [PayGuide, setPayGuide] = useState<MiniProgramPayGuideComponent | null>(null);

  useEffect(() => {
    const cached = readCachedPayTarget(listingId, artworkId);
    setTarget(cached);
    setLoading(!cached);
    setError(null);
  }, [artworkId, listingId]);

  const load = useCallback(async () => {
    const cached = readCachedPayTarget(listingId, artworkId);
    if (cached) {
      setTarget(cached);
      setLoading(false);
      setError(null);
    } else {
      setLoading(true);
      setError(null);
    }
    try {
      const endpoint = listingId ? `/public/listings/${listingId}` : `/public/artworks/${artworkId}`;
      const d = await apiGet<PayTarget>(endpoint);
      setTarget(d);
      if (targetCacheKey) setDetailCache(CHECKOUT_TARGET_CACHE_SCOPE, targetCacheKey, d);
    } catch (e: any) {
      setError(e?.message || '加载失败');
      if (!cached) setTarget(null);
    } finally {
      setLoading(false);
    }
  }, [artworkId, listingId, targetCacheKey]);

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
    if (!listingId && !artworkId) return;
    if (isH5) {
      toast('H5 端不发起支付，请到小程序完成支付');
      return;
    }
    setPaying(true);
    try {
      const payload = listingId ? { listingId } : { artworkId };
      const order = await apiPost<Order>('/orders', payload);
      const intent = await apiPost<PaymentIntentResponse>(
        `/orders/${order.id}/payment-intents`,
        { payType: 'DEPOSIT' },
        { idempotencyKey: `pay-deposit-${order.id}` },
      );

      Taro.navigateTo({
        url: `/subpackages/checkout/deposit-success/index?orderId=${order.id}&paymentId=${intent.paymentId}`,
      });
    } catch (e: any) {
      toast(e?.message || '支付失败');
    } finally {
      setPaying(false);
    }
  }, [artworkId, isH5, listingId]);

  return (
    <View className="container has-sticky pay-page">
      <PageHeader title="支付订金" subtitle="订金用于锁定交易并启动跟单流程" />
      <Spacer size={12} />

      {loading ? (
        <LoadingCard text="加载交易信息…" />
      ) : error ? (
        <ErrorCard message={error} onRetry={load} />
      ) : target ? (
        <View>
          <Surface className="pay-card pay-summary-card" padding="md">
            <Text className="pay-section-title">交易摘要</Text>
            <Text className="pay-summary-title clamp-2">{target.title || '未命名内容'}</Text>
            <View className="pay-summary-tags">
              <Text className="pay-chip">{target.priceType === 'NEGOTIABLE' ? '面议' : '明码标价'}</Text>
              <Text className="pay-chip">订金支付</Text>
            </View>
            <View className="pay-divider" />
            <View className="pay-row">
              <Text className="pay-row-label">商品总价</Text>
              <Text className="pay-row-value">
                {target.priceType === 'NEGOTIABLE' ? '面议' : `¥${fenToYuan(target.priceAmountFen)}`}
              </Text>
            </View>
            <View className="pay-row pay-row-strong">
              <Text className="pay-row-label">应付订金</Text>
              <Text className="pay-row-value">¥{fenToYuan(target.depositAmountFen)}</Text>
            </View>
          </Surface>

          <Spacer size={12} />

          <Surface className="pay-card" padding="md">
            <Text className="pay-section-title">订金说明</Text>
            <Text className="pay-note">
              订金支付后平台将启动合同/材料核验与权属变更流程。退款与争议处理以平台规则与人工审核为准。
            </Text>
          </Surface>

          {isH5 ? (
            <>
              <Spacer size={12} />
              {PayGuide ? (
                <PayGuide
                  miniProgramPath={`pages/checkout/deposit-pay/index?${listingId ? `listingId=${listingId}` : `artworkId=${artworkId}`}`}
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
        <EmptyCard title="无数据" message="该专利/书画不存在或不可见。" actionText="返回" onAction={() => Taro.navigateBack()} />
      )}

      {target && !loading && !error && !isH5 ? (
        <StickyBar>
          <View className="flex-1">
            <Button variant="ghost" onClick={() => Taro.navigateBack()}>
              返回
            </Button>
          </View>
          <View style={{ flex: 2, minWidth: 0 }}>
            <Button variant="primary" loading={paying} disabled={paying} onClick={onPay}>
              {paying ? '处理中…' : `支付订金 ¥${fenToYuan(target.depositAmountFen)}`}
            </Button>
          </View>
        </StickyBar>
      ) : null}
    </View>
  );
}
