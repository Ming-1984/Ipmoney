import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import './index.scss';

import { apiGet, apiPost } from '../../../lib/api';
import { getDetailCache, setDetailCache } from '../../../lib/detailCache';
import { normalizeDisplayText } from '../../../lib/displayText';
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

function checkoutTargetCacheKey(listingId: string): string {
  if (listingId) return `listing:${listingId}`;
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
    title: normalizeDisplayText(value.title) || '交易标的待确认',
    depositAmountFen,
    priceType,
    priceAmountFen,
  };
}

function readCachedPayTarget(listingId: string): PayTarget | null {
  const targetCacheKey = checkoutTargetCacheKey(listingId);
  if (targetCacheKey) {
    const cached = getDetailCache<PayTarget>(CHECKOUT_TARGET_CACHE_SCOPE, targetCacheKey);
    if (cached) return cached;
  }
  if (listingId) return toPayTarget(getDetailCache<unknown>('listing-public', listingId));
  return null;
}

export default function DepositPayPage() {
  const listingId = useRouteUuidParam('listingId') || '';
  const env = useMemo(() => Taro.getEnv(), []);
  const isH5 = env === Taro.ENV_TYPE.WEB;
  const initialCachedTarget = readCachedPayTarget(listingId);

  const [loading, setLoading] = useState(!initialCachedTarget);
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<PayTarget | null>(initialCachedTarget);
  const [paying, setPaying] = useState(false);
  const [PayGuide, setPayGuide] = useState<MiniProgramPayGuideComponent | null>(null);
  const listingIdRef = useRef(listingId);
  const loadSeqRef = useRef(0);
  const paySeqRef = useRef(0);

  useEffect(() => {
    listingIdRef.current = listingId;
    loadSeqRef.current += 1;
    paySeqRef.current += 1;
    if (!listingId) {
      setTarget(null);
      setLoading(false);
      setError(null);
      setPaying(false);
      return;
    }
    const cached = readCachedPayTarget(listingId);
    setTarget(cached);
    setLoading(!cached);
    setError(null);
  }, [listingId]);

  const load = useCallback(async () => {
    const currentListingId = listingId;
    listingIdRef.current = currentListingId;
    if (!currentListingId) return;
    const seq = ++loadSeqRef.current;
    const currentTargetCacheKey = checkoutTargetCacheKey(currentListingId);
    const cached = readCachedPayTarget(currentListingId);
    if (cached) {
      setTarget(cached);
      setLoading(false);
      setError(null);
    } else {
      setLoading(true);
      setError(null);
    }
    try {
      const d = await apiGet<PayTarget>(`/public/listings/${currentListingId}`);
      if (seq !== loadSeqRef.current || listingIdRef.current !== currentListingId) return;
      setTarget(d);
      if (currentTargetCacheKey) setDetailCache(CHECKOUT_TARGET_CACHE_SCOPE, currentTargetCacheKey, d);
    } catch (e: any) {
      if (seq !== loadSeqRef.current || listingIdRef.current !== currentListingId) return;
      setError(e?.message || '加载失败');
      if (!cached) setTarget(null);
    } finally {
      if (seq === loadSeqRef.current && listingIdRef.current === currentListingId) {
        setLoading(false);
      }
    }
  }, [listingId]);

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
    const targetListingId = listingId;
    if (!targetListingId) return;
    if (isH5) {
      toast('H5 端不发起支付，请到小程序完成支付');
      return;
    }
    const seq = ++paySeqRef.current;
    setPaying(true);
    try {
      const order = await apiPost<Order>('/orders', { listingId: targetListingId });
      const intent = await apiPost<PaymentIntentResponse>(
        `/orders/${order.id}/payment-intents`,
        { payType: 'DEPOSIT' },
        { idempotencyKey: `pay-deposit-${order.id}` },
      );

      const payParams = intent?.wechatPayParams;
      const isDemoIntent =
        String(payParams?.package || '').includes('prepay_id=demo-') || String(payParams?.paySign || '').trim() === 'demo-sign';
      if (!isDemoIntent) {
        try {
          await Taro.requestPayment({
            timeStamp: String(payParams?.timeStamp || ''),
            nonceStr: String(payParams?.nonceStr || ''),
            package: String(payParams?.package || ''),
            signType: 'RSA',
            paySign: String(payParams?.paySign || ''),
          });
        } catch (paymentError: any) {
          const rawMessage = String(paymentError?.errMsg || paymentError?.message || '').toLowerCase();
          if (rawMessage.includes('cancel')) {
            toast('已取消支付');
            return;
          }
          throw paymentError;
        }
      }

      Taro.navigateTo({
        url: `/subpackages/checkout/deposit-success/index?orderId=${order.id}&paymentId=${intent.paymentId}`,
      });
    } catch (e: any) {
      if (seq !== paySeqRef.current || listingIdRef.current !== targetListingId) return;
      toast(e?.message || '支付失败');
    } finally {
      if (seq === paySeqRef.current && listingIdRef.current === targetListingId) {
        setPaying(false);
      }
    }
  }, [isH5, listingId]);

  if (!listingId) {
    return (
      <View className="container">
        <MissingParamCard onAction={() => void safeNavigateBack()} />
      </View>
    );
  }

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
            <Text className="pay-summary-title clamp-2">{normalizeDisplayText(target.title) || '交易标的待确认'}</Text>
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
                  miniProgramPath={`subpackages/checkout/deposit-pay/index?listingId=${listingId}`}
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
        <EmptyCard title="无数据" message="该专利不存在或不可见。" actionText="返回" onAction={() => Taro.navigateBack()} />
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
