import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useMemo, useState } from 'react';
import './index.scss';

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

type OrderBase = components['schemas']['Order'];
type OrderDetail = OrderBase & {
  listingTitle?: string | null;
  applicationNoDisplay?: string | null;
};
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

function milestoneNameLabel(name?: string | null): string {
  if (!name) return '里程碑';
  if (name === 'CONTRACT_SIGNED') return '合同签署';
  if (name === 'TRANSFER_SUBMITTED') return '权属提交';
  if (name === 'TRANSFER_COMPLETED') return '权属变更完成';
  if (name === 'SETTLEMENT_READY') return '结算准备';
  if (name === 'SETTLEMENT_PAID') return '结算放款';
  return name;
}

function milestoneStatusLabel(status?: string | null): string {
  if (!status) return '待处理';
  if (status === 'DONE') return '已完成';
  if (status === 'PENDING') return '待处理';
  if (status === 'IN_PROGRESS') return '进行中';
  if (status === 'FAILED') return '失败';
  return status;
}

function refundStatusLabel(status?: string | null): string {
  if (!status) return '待处理';
  if (status === 'PENDING') return '待处理';
  if (status === 'APPROVED') return '已同意';
  if (status === 'REJECTED') return '已拒绝';
  if (status === 'REFUNDING') return '退款中';
  if (status === 'REFUNDED') return '已退款';
  return status;
}

export default function OrderDetailPage() {
  const orderId = useRouteUuidParam('orderId') || '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [activeTab, setActiveTab] = useState('order-overview');

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
      const d = await apiGet<OrderDetail>(`/orders/${orderId}`);
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

  const applyInvoiceRequest = useCallback(async () => {
    if (!ensureApproved()) return;
    try {
      await apiPost(`/orders/${orderId}/invoice-requests`, {}, { idempotencyKey: `invoice-${orderId}` });
      toast('已提交开票申请', { icon: 'success' });
      void loadInvoice();
    } catch (e: any) {
      toast(e?.message || '提交失败');
    }
  }, [orderId, loadInvoice]);

  const openInvoiceCenter = useCallback(() => {
    const tab = invoice?.invoiceFile?.url ? 'ISSUED' : 'WAIT_APPLY';
    Taro.navigateTo({ url: `/pages/invoices/index?tab=${tab}&orderId=${orderId}` });
  }, [invoice?.invoiceFile?.url, orderId]);

  const simulateContractSigned = useCallback(async () => {
    if (!ensureApproved()) return;
    try {
      await apiPost(`/admin/orders/${orderId}/milestones/contract-signed`, {}, { idempotencyKey: `contract-${orderId}` });
      toast('已模拟合同签署', { icon: 'success' });
      refreshAll();
    } catch (e: any) {
      toast(e?.message || '模拟失败');
    }
  }, [orderId, refreshAll]);

  const simulateTransferCompleted = useCallback(async () => {
    if (!ensureApproved()) return;
    try {
      await apiPost(`/admin/orders/${orderId}/milestones/transfer-completed`, {}, { idempotencyKey: `transfer-${orderId}` });
      toast('已模拟权属变更', { icon: 'success' });
      refreshAll();
    } catch (e: any) {
      toast(e?.message || '模拟失败');
    }
  }, [orderId, refreshAll]);

  const simulatePayout = useCallback(async () => {
    if (!ensureApproved()) return;
    try {
      await apiPost(`/admin/orders/${orderId}/payouts/manual`, {}, { idempotencyKey: `payout-${orderId}` });
      toast('已模拟结算放款', { icon: 'success' });
      refreshAll();
    } catch (e: any) {
      toast(e?.message || '模拟失败');
    }
  }, [orderId, refreshAll]);

  /*
  const tabs = useMemo(
    () => [
      { id: 'order-overview', label: '订单' },
      { id: 'order-case', label: '里程碑' },
      { id: 'order-refund', label: '退款' },
      { id: 'order-invoice', label: '发票' },
    ],
    [],
  );
  /*
  const tabs = useMemo(
    () => [
      { id: 'order-overview', label: '订单' },
      { id: 'order-case', label: '里程碑' },
      { id: 'order-refund', label: '退款' },
      { id: 'order-invoice', label: '发票' },
    ],
    [],
  );

  */
  const detailTabs = useMemo(
    () => [
      { id: 'order-overview', label: '\u8BA2\u5355' },
      { id: 'order-case', label: '\u91CC\u7A0B\u7891' },
      { id: 'order-refund', label: '\u9000\u6B3E' },
      { id: 'order-invoice', label: '\u53D1\u7968' },
    ],
    [],
  );

  const scrollToTab = useCallback((id: string) => {
    setActiveTab(id);
    Taro.pageScrollTo({ selector: `#${id}`, duration: 300 });
  }, []);

  if (!orderId) {
    return (
      <View className="container">
        <MissingParamCard onAction={() => void safeNavigateBack()} />
      </View>
    );
  }

  return (
    <View className="container detail-page-compact">
      <PageHeader weapp title="订单详情" subtitle={`订单号：${orderId.slice(0, 8)}…`} />
      <Spacer />

      {access.state !== 'ok' ? (
        <AccessGate access={access} />
      ) : loading ? (
        <LoadingCard />
      ) : error ? (
        <ErrorCard message={error} onRetry={load} />
      ) : order ? (
        <View>
          <Surface className="detail-compact-header" id="order-overview">
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
            {order.listingTitle ? (
              <>
                <View style={{ height: '6rpx' }} />
                <Text className="muted">交易标的：{order.listingTitle}</Text>
              </>
            ) : null}
            {order.applicationNoDisplay ? (
              <>
                <View style={{ height: '6rpx' }} />
                <Text className="muted">申请号：{order.applicationNoDisplay}</Text>
              </>
            ) : null}
          </Surface>

          <View className="detail-tabs">
            <View className="detail-tabs-scroll">
              {detailTabs.map((tab) => (
                <Text
                  key={tab.id}
                  className={`detail-tab ${activeTab === tab.id ? 'is-active' : ''}`}
                  onClick={() => scrollToTab(tab.id)}
                >
                  {tab.label}
                </Text>
              ))}
            </View>
          </View>

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

          <Surface id="order-case">
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
                  <Text className="text-strong">{milestoneNameLabel(m.name)}</Text>
                  <Text className="muted">{milestoneStatusLabel(m.status)}</Text>
                </View>
              ))
            ) : caseError ? (
              <ErrorCard title="里程碑加载失败" message={caseError} onRetry={loadCase} />
            ) : (
              <Text className="muted">（暂无里程碑数据）</Text>
            )}
          </Surface>

          <View style={{ height: '16rpx' }} />

          <Surface id="order-refund">
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
                  <Text className="text-strong">{refundStatusLabel(r.status)}</Text>
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
            <View id="order-invoice" />
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
          <View style={{ height: '16rpx' }} />
          <Surface>
            <View className="row-between" style={{ gap: '12rpx' }}>
              <Text className="text-card-title">发票操作</Text>
              <Button variant="ghost" size="small" onClick={openInvoiceCenter}>
                发票管理中心
              </Button>
            </View>
            <View style={{ height: '10rpx' }} />
            <Text className="muted">可在发票中心查看申请进度与下载记录。</Text>
            <View style={{ height: '12rpx' }} />
            <View style={{ display: 'flex', flexWrap: 'wrap', gap: '12rpx' }}>
              <Button size="small" variant="primary" onClick={() => void applyInvoiceRequest()}>
                申请开票（模拟）
              </Button>
              <Button size="small" variant="ghost" onClick={openInvoiceCenter}>
                查看发票中心
              </Button>
            </View>
          </Surface>
          <View style={{ height: '16rpx' }} />
          <Surface>
            <Text className="text-card-title">模拟流程</Text>
            <View style={{ height: '10rpx' }} />
            <Text className="muted">仅用于演示，点击后更新订单状态与里程碑。</Text>
            <View style={{ height: '12rpx' }} />
            <View style={{ display: 'flex', flexWrap: 'wrap', gap: '12rpx' }}>
              <Button size="small" variant="ghost" onClick={() => void simulateContractSigned()}>
                模拟合同签署
              </Button>
              <Button size="small" variant="ghost" onClick={() => void simulateTransferCompleted()}>
                模拟权属变更
              </Button>
              <Button size="small" variant="ghost" onClick={() => void simulatePayout()}>
                模拟结算放款
              </Button>
            </View>
          </Surface>
          <View style={{ height: '16rpx' }} />
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
