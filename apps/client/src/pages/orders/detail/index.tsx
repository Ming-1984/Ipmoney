import { View, Text } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import React, { useCallback, useMemo, useState } from 'react';

import type { components } from '@ipmoney/api-types';

import { apiGet, apiPost } from '../../../lib/api';
import { ensureApproved, usePageAccess } from '../../../lib/guard';
import { orderStatusLabel, orderStatusTagClass } from '../../../lib/labels';
import { AccessGate } from '../../../ui/PageState';
import { Button, Popup, Segmented, TextArea } from '../../../ui/nutui';
import { EmptyCard, ErrorCard, LoadingCard } from '../../../ui/StateCards';
import { PageHeader, Spacer, Surface } from '../../../ui/layout';

type Order = components['schemas']['Order'];
type CaseWithMilestones = components['schemas']['CaseWithMilestones'];
type RefundRequest = components['schemas']['RefundRequest'];
type RefundReasonCode = components['schemas']['RefundReasonCode'];
type RefundRequestCreate = components['schemas']['RefundRequestCreate'];
type OrderInvoice = components['schemas']['OrderInvoice'];

function fenToYuan(fen?: number): string {
  if (fen === undefined || fen === null) return '-';
  return (fen / 100).toFixed(2);
}

function reasonLabel(code: RefundReasonCode): string {
  if (code === 'BUYER_CHANGED_MIND') return '买家改变主意';
  if (code === 'SELLER_MISSING_MATERIALS') return '卖家无法提供材料';
  if (code === 'MUTUAL_AGREEMENT') return '双方协商一致';
  if (code === 'RISK_CONTROL') return '风控/合规原因';
  return '其他';
}

export default function OrderDetailPage() {
  const router = useRouter();
  const orderId = useMemo(() => router?.params?.orderId || '', [router?.params?.orderId]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<Order | null>(null);

  const [caseLoading, setCaseLoading] = useState(false);
  const [caseData, setCaseData] = useState<CaseWithMilestones | null>(null);

  const [refunds, setRefunds] = useState<RefundRequest[]>([]);
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
    try {
      const d = await apiGet<CaseWithMilestones>(`/orders/${orderId}/case`);
      setCaseData(d);
    } catch (_) {
      setCaseData(null);
    } finally {
      setCaseLoading(false);
    }
  }, [orderId]);

  const loadRefundsAndInvoice = useCallback(async () => {
    if (!orderId) return;
    try {
      const d = await apiGet<RefundRequest[]>(`/orders/${orderId}/refund-requests`);
      setRefunds(Array.isArray(d) ? d : []);
    } catch (_) {
      setRefunds([]);
    }
    try {
      const inv = await apiGet<OrderInvoice>(`/orders/${orderId}/invoice`);
      setInvoice(inv);
    } catch (_) {
      setInvoice(null);
    }
  }, [orderId]);

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
    setCaseData(null);
    setRefunds([]);
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
      Taro.showToast({ title: '已提交退款申请', icon: 'success' });
      setRefundOpen(false);
      setReasonText('');
      void loadRefundsAndInvoice();
    } catch (e: any) {
      Taro.showToast({ title: e?.message || '提交失败', icon: 'none' });
    }
  }, [orderId, reasonCode, reasonText, loadRefundsAndInvoice]);

  if (!orderId) {
    return (
      <View className="container">
        <ErrorCard title="参数缺失" message="缺少 orderId" onRetry={() => Taro.navigateBack()} />
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
            {refunds.length ? (
              refunds.map((r) => (
                <View key={r.id} className="list-item">
                  <Text className="text-strong">{r.status}</Text>
                  <Text className="muted">{r.createdAt}</Text>
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
            {invoice?.invoiceFile?.url ? (
              <View className="row-between" style={{ gap: '12rpx' }}>
                <Text className="muted clamp-1">电子发票已上传</Text>
                <Button
                  variant="ghost"
                  size="small"
                  onClick={() => {
                    Taro.setClipboardData({ data: invoice.invoiceFile.url });
                    Taro.showToast({ title: '已复制下载链接', icon: 'success' });
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
        <View className="container">
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
        </View>
      </Popup>
    </View>
  );
}
