import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useState } from 'react';

import type { components } from '@ipmoney/api-types';

import { apiGet, apiPost } from '../../../lib/api';
import { ensureApproved, usePageAccess } from '../../../lib/guard';
import { formatTimeSmart } from '../../../lib/format';
import { orderStatusLabel, orderStatusTagClass } from '../../../lib/labels';
import { fenToYuan } from '../../../lib/money';
import { safeNavigateBack } from '../../../lib/navigation';
import { useRouteUuidParam } from '../../../lib/routeParams';
import { AccessGate } from '../../../ui/PageState';
import { Button, Popup, Segmented, TextArea, toast } from '../../../ui/nutui';
import { EmptyCard, ErrorCard, LoadingCard, MissingParamCard } from '../../../ui/StateCards';
import { PageHeader, PopupSheet, Spacer, Surface } from '../../../ui/layout';

type Order = components['schemas']['Order'];
type CaseWithMilestones = components['schemas']['CaseWithMilestones'];
type RefundRequest = components['schemas']['RefundRequest'];
type RefundReasonCode = components['schemas']['RefundReasonCode'];
type RefundRequestCreate = components['schemas']['RefundRequestCreate'];
type OrderInvoice = components['schemas']['OrderInvoice'];

function reasonLabel(code: RefundReasonCode): string {
  if (code === 'BUYER_CHANGED_MIND') return '买家改变主意';
  if (code === 'SELLER_MISSING_MATERIALS') return '卖家无法提供材料';
  if (code === 'MUTUAL_AGREEMENT') return '双方协商一致';
  if (code === 'RISK_CONTROL') return '风控/合规原因';
  return '其他';
}

export default function OrderDetailPage() {
  const orderId = useRouteUuidParam('orderId') || '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<Order | null>(null);

  const [caseLoading, setCaseLoading] = useState(false);
  const [caseError, setCaseError] = useState<string | null>(null);
  const [caseData, setCaseData] = useState<CaseWithMilestones | null>(null);

  const [refundsLoading, setRefundsLoading] = useState(false);
  const [refundsError, setRefundsError] = useState<string | null>(null);
  const [refunds, setRefunds] = useState<RefundRequest[]>([]);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);
  const [invoice, setInvoice] = useState<OrderInvoice | null>(null);

  const [refundOpen, setRefundOpen] = useState(false);
  const [reasonCode, setReasonCode] = useState<RefundReasonCode>('BUYER_CHANGED_MIND');
  const [reasonText, setReasonText] = useState('');

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

  const loadCase = useCallback(async () => {
    if (!orderId) return;
    setCaseLoading(true);
    setCaseError(null);
    try {
      const d = await apiGet<CaseWithMilestones>(`/orders/${orderId}/case`);
      setCaseData(d);
    } catch (e: any) {
      setCaseError(e?.message || '加载失败');
      setCaseData(null);
    } finally {
      setCaseLoading(false);
    }
  }, [orderId]);

  const loadRefunds = useCallback(async () => {
    if (!orderId) return;
    setRefundsLoading(true);
    setRefundsError(null);
    try {
      const d = await apiGet<RefundRequest[]>(`/orders/${orderId}/refund-requests`);
      setRefunds(Array.isArray(d) ? d : []);
    } catch (e: any) {
      setRefundsError(e?.message || '加载失败');
      setRefunds([]);
    } finally {
      setRefundsLoading(false);
    }
  }, [orderId]);

  const loadInvoice = useCallback(async () => {
    if (!orderId) return;
    setInvoiceLoading(true);
    setInvoiceError(null);
    try {
      const inv = await apiGet<OrderInvoice>(`/orders/${orderId}/invoice`);
      setInvoice(inv);
    } catch (e: any) {
      setInvoiceError(e?.message || '加载失败');
      setInvoice(null);
    } finally {
      setInvoiceLoading(false);
    }
  }, [orderId]);

  const loadRefundsAndInvoice = useCallback(() => {
    void loadRefunds();
    void loadInvoice();
  }, [loadInvoice, loadRefunds]);

  const refreshAll = useCallback(() => {
    void load();
    void loadCase();
    void loadRefundsAndInvoice();
  }, [load, loadCase, loadRefundsAndInvoice]);

  const access = usePageAccess('approved-required', (a) => {
    if (a.state === 'ok') {
      if (orderId) void refreshAll();
      return;
    }
    setLoading(false);
    setError(null);
    setOrder(null);
    setCaseLoading(false);
    setCaseError(null);
    setCaseData(null);
    setRefundsLoading(false);
    setRefundsError(null);
    setRefunds([]);
    setInvoiceLoading(false);
    setInvoiceError(null);
    setInvoice(null);
    setRefundOpen(false);
  });

  const submitRefund = useCallback(async () => {
    if (!ensureApproved()) return;
    const payload: RefundRequestCreate = {
      reasonCode,
      ...(reasonText.trim() ? { reasonText: reasonText.trim() } : {}),
    };
    try {
      await apiPost<RefundRequest>(`/orders/${orderId}/refund-requests`, payload, {
        idempotencyKey: `refund-${orderId}-${reasonCode}`,
      });
      toast('已提交退款申请', { icon: 'success' });
      setRefundOpen(false);
      setReasonText('');
      void loadRefundsAndInvoice();
    } catch (e: any) {
      toast(e?.message || '提交失败');
    }
  }, [orderId, reasonCode, reasonText, loadRefundsAndInvoice]);

  if (!orderId) {
    return (
      <View className="container">
        <MissingParamCard onAction={() => void safeNavigateBack()} />
      </View>
    );
  }

  return (
    <View className="container">
      <PageHeader title="订单详情" subtitle={`订单号：${orderId.slice(0, 8)}…`} />
      <Spacer />

      {access.state !== 'ok' ? (
        <AccessGate access={access} />
      ) : loading ? (
        <LoadingCard />
      ) : error ? (
        <ErrorCard message={error} onRetry={load} />
      ) : order ? (
        <View>
          <Surface>
            <View className="row-between" style={{ gap: '12rpx' }}>
              <Text className="text-card-title">状态</Text>
              <Text className={orderStatusTagClass(order.status)}>{orderStatusLabel(order.status)}</Text>
            </View>
            <View style={{ height: '10rpx' }} />
            <Text className="muted">订金：¥{fenToYuan(order.depositAmountFen)}</Text>
            <View style={{ height: '6rpx' }} />
            <Text className="muted">成交总价：¥{fenToYuan(order.dealAmountFen)}</Text>
            <View style={{ height: '6rpx' }} />
            <Text className="muted">尾款：¥{fenToYuan(order.finalAmountFen)}</Text>
          </Surface>

          <View style={{ height: '16rpx' }} />

          {order.status === 'WAIT_FINAL_PAYMENT' ? (
            <>
              <Surface>
                <Text className="text-card-title">下一步</Text>
                <View style={{ height: '10rpx' }} />
                <Text className="muted">合同已确认，可在平台托管支付尾款。</Text>
                <View style={{ height: '12rpx' }} />
                <Button
                  variant="primary"
                  onClick={() => {
                    if (!ensureApproved()) return;
                    Taro.navigateTo({ url: `/pages/checkout/final-pay/index?orderId=${orderId}` });
                  }}
                >
                  支付尾款{order.finalAmountFen ? ` ¥${fenToYuan(order.finalAmountFen)}` : ''}
                </Button>
              </Surface>
              <View style={{ height: '16rpx' }} />
            </>
          ) : null}

          <Surface>
            <View className="row-between" style={{ gap: '12rpx' }}>
              <Text className="text-card-title">跟单与里程碑</Text>
              <Button variant="ghost" size="small" onClick={() => void loadCase()}>
                刷新
              </Button>
            </View>
            <View style={{ height: '10rpx' }} />
            {caseLoading ? (
              <Text className="muted">加载中…</Text>
            ) : caseData?.milestones?.length ? (
              caseData.milestones.map((m, idx) => (
                <View key={`${m.name}-${idx}`} className="list-item">
                  <Text className="text-strong">{m.name}</Text>
                  <Text className="muted">{m.status}</Text>
                </View>
              ))
            ) : caseError ? (
              <ErrorCard title="里程碑加载失败" message={caseError} onRetry={loadCase} />
            ) : (
              <Text className="muted">（暂无里程碑数据）</Text>
            )}
          </Surface>

          <View style={{ height: '16rpx' }} />

          <Surface>
            <View className="row-between" style={{ gap: '12rpx' }}>
              <Text className="text-card-title">退款申请</Text>
              <Button
                variant="danger"
                size="small"
                onClick={() => {
                  if (!ensureApproved()) return;
                  setRefundOpen(true);
                }}
              >
                申请退款
              </Button>
            </View>
            <View style={{ height: '10rpx' }} />
            {refundsLoading ? (
              <Text className="muted">加载中…</Text>
            ) : refundsError ? (
              <ErrorCard title="退款申请加载失败" message={refundsError} onRetry={loadRefunds} />
            ) : refunds.length ? (
              refunds.map((r) => (
                <View key={r.id} className="list-item">
                  <Text className="text-strong">{r.status}</Text>
                  <Text className="muted">{formatTimeSmart(r.createdAt)}</Text>
                </View>
              ))
            ) : (
              <Text className="muted">（暂无退款申请）</Text>
            )}
          </Surface>

          <View style={{ height: '16rpx' }} />

          <Surface>
            <Text className="text-card-title">发票</Text>
            <View style={{ height: '10rpx' }} />
            {invoiceLoading ? (
              <Text className="muted">加载中…</Text>
            ) : invoiceError ? (
              <ErrorCard title="发票信息加载失败" message={invoiceError} onRetry={loadInvoice} />
            ) : invoice?.invoiceFile?.url ? (
              <View className="row-between" style={{ gap: '12rpx' }}>
                <Text className="muted clamp-1">电子发票已上传</Text>
                <Button
                  variant="ghost"
                  size="small"
                  onClick={() => {
                    Taro.setClipboardData({ data: invoice.invoiceFile.url });
                    toast('已复制下载链接', { icon: 'success' });
                  }}
                >
                  复制链接
                </Button>
              </View>
            ) : (
              <Text className="muted">（订单完成后由财务上传）</Text>
            )}
          </Surface>
        </View>
      ) : (
        <EmptyCard message="无数据" actionText="返回" onAction={() => Taro.navigateBack()} />
      )}

      <Popup
        visible={refundOpen}
        position="bottom"
        round
        closeable
        title="申请退款"
        onClose={() => setRefundOpen(false)}
        onOverlayClick={() => setRefundOpen(false)}
      >
        <PopupSheet>
          <Surface>
            <Text className="text-strong">原因类型</Text>
            <View style={{ height: '10rpx' }} />
            <Segmented
              value={reasonCode}
              options={[
                { label: '改主意', value: 'BUYER_CHANGED_MIND' },
                { label: '卖家材料', value: 'SELLER_MISSING_MATERIALS' },
                { label: '协商一致', value: 'MUTUAL_AGREEMENT' },
                { label: '风控', value: 'RISK_CONTROL' },
                { label: '其他', value: 'OTHER' },
              ]}
              onChange={(v) => setReasonCode(v as RefundReasonCode)}
            />

            <View style={{ height: '12rpx' }} />
            <Text className="muted">说明（可选）</Text>
            <View style={{ height: '8rpx' }} />
            <TextArea value={reasonText} onChange={setReasonText} placeholder={`原因：${reasonLabel(reasonCode)}`} maxLength={500} />

            <View style={{ height: '14rpx' }} />
            <Button onClick={() => void submitRefund()}>提交</Button>
          </Surface>
        </PopupSheet>
      </Popup>
    </View>
  );
}
