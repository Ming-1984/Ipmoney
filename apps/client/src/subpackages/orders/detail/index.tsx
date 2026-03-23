import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './index.scss';

import type { components } from '@ipmoney/api-types';

import { apiGet, apiPost } from '../../../lib/api';
import { getDetailCache, setDetailCache } from '../../../lib/detailCache';
import { ensureApproved, usePageAccess } from '../../../lib/guard';
import { formatTimeSmart } from '../../../lib/format';
import { orderStatusLabel, orderStatusTagClass } from '../../../lib/labels';
import { fenToYuan } from '../../../lib/money';
import { safeNavigateBack } from '../../../lib/navigation';
import { useRouteStringParam } from '../../../lib/routeParams';
import { AccessGate } from '../../../ui/PageState';
import { Button, Popup, TextArea, toast } from '../../../ui/nutui';
import { EmptyCard, ErrorCard, LoadingCard, MissingParamCard } from '../../../ui/StateCards';
import { PageHeader, PopupSheet, Spacer, Surface } from '../../../ui/layout';

type OrderBase = components['schemas']['Order'];
type OrderDetail = OrderBase & {
  listingTitle?: string | null;
  applicationNoDisplay?: string | null;
  invoiceNo?: string | null;
  invoiceFileId?: string | null;
  invoiceIssuedAt?: string | null;
};
type CaseWithMilestones = components['schemas']['CaseWithMilestones'];
type RefundRequest = components['schemas']['RefundRequest'];
type RefundReasonCode = components['schemas']['RefundReasonCode'];
type RefundRequestCreate = components['schemas']['RefundRequestCreate'];
type OrderInvoice = components['schemas']['OrderInvoice'];
type Conversation = components['schemas']['Conversation'];

const REFUNDABLE_STATUSES = new Set<OrderBase['status']>(['DEPOSIT_PAID', 'WAIT_FINAL_PAYMENT', 'FINAL_PAID_ESCROW']);
const BLOCKING_REFUND_REQUEST_STATUSES = new Set<RefundRequest['status']>(['PENDING', 'APPROVED', 'REFUNDING']);
const ORDER_DETAIL_CACHE_SCOPE = 'order-detail';
const ORDER_CASE_CACHE_SCOPE = 'order-case';
const ORDER_REFUNDS_CACHE_SCOPE = 'order-refunds';
const REFUND_REASON_OPTIONS: Array<{ label: string; value: RefundReasonCode }> = [
  { label: '改主意', value: 'BUYER_CHANGED_MIND' },
  { label: '卖家材料', value: 'SELLER_MISSING_MATERIALS' },
  { label: '协商一致', value: 'MUTUAL_AGREEMENT' },
  { label: '风控', value: 'RISK_CONTROL' },
  { label: '其他', value: 'OTHER' },
];

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
  const orderId = useRouteStringParam('orderId') || '';
  const loadedOnceRef = useRef(false);
  const initialCachedOrder = orderId ? getDetailCache<OrderDetail>(ORDER_DETAIL_CACHE_SCOPE, orderId) : null;
  const initialCachedCase = orderId ? getDetailCache<CaseWithMilestones>(ORDER_CASE_CACHE_SCOPE, orderId) : null;
  const initialCachedRefunds = orderId ? getDetailCache<RefundRequest[]>(ORDER_REFUNDS_CACHE_SCOPE, orderId) : null;

  const [loading, setLoading] = useState(!initialCachedOrder);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<OrderDetail | null>(initialCachedOrder);
  const [activeTab, setActiveTab] = useState('order-overview');

  const [caseLoading, setCaseLoading] = useState(false);
  const [caseError, setCaseError] = useState<string | null>(null);
  const [caseData, setCaseData] = useState<CaseWithMilestones | null>(initialCachedCase);

  const [refundsLoading, setRefundsLoading] = useState(false);
  const [refundsError, setRefundsError] = useState<string | null>(null);
  const [refunds, setRefunds] = useState<RefundRequest[]>(Array.isArray(initialCachedRefunds) ? initialCachedRefunds : []);
  const [refundsReady, setRefundsReady] = useState(Array.isArray(initialCachedRefunds));
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);
  const [invoice, setInvoice] = useState<OrderInvoice | null>(null);
  const [invoiceRequesting, setInvoiceRequesting] = useState(false);
  const [invoiceRequested, setInvoiceRequested] = useState(false);

  const [refundOpen, setRefundOpen] = useState(false);
  const [refundSubmitting, setRefundSubmitting] = useState(false);
  const [openingDisputeChat, setOpeningDisputeChat] = useState(false);
  const [reasonCode, setReasonCode] = useState<RefundReasonCode>('BUYER_CHANGED_MIND');
  const [reasonText, setReasonText] = useState('');

  const canFetchInvoiceDetail = Boolean(order?.invoiceFileId && (order?.invoiceNo || order?.invoiceIssuedAt));

  const load = useCallback(async (options?: { silent?: boolean }): Promise<OrderDetail | null> => {
    const silent = Boolean(options?.silent);
    if (!orderId) return null;
    const cached = silent ? null : getDetailCache<OrderDetail>(ORDER_DETAIL_CACHE_SCOPE, orderId);
    if (cached) {
      setOrder(cached);
      setLoading(false);
      setError(null);
    } else if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const d = await apiGet<OrderDetail>(`/orders/${orderId}`);
      setOrder(d);
      setDetailCache(ORDER_DETAIL_CACHE_SCOPE, orderId, d);
      return d;
    } catch (e: any) {
      if (!silent && !cached) {
        setError(e?.message || '加载失败');
        setOrder(null);
      }
      return null;
    } finally {
      if (!silent) setLoading(false);
    }
  }, [orderId]);

  const loadCase = useCallback(async (options?: { silent?: boolean }) => {
    if (!orderId) return;
    const silent = Boolean(options?.silent);
    const cached = getDetailCache<CaseWithMilestones>(ORDER_CASE_CACHE_SCOPE, orderId);
    const hasCached = Boolean(cached);
    if (cached) {
      setCaseData(cached);
      if (!silent) setCaseError(null);
    }
    if (!hasCached) {
      setCaseLoading(true);
      setCaseError(null);
    }
    try {
      const d = await apiGet<CaseWithMilestones>(`/orders/${orderId}/case`);
      setCaseData(d);
      setCaseError(null);
      setDetailCache(ORDER_CASE_CACHE_SCOPE, orderId, d);
    } catch (e: any) {
      if (!hasCached) {
        setCaseError(e?.message || '加载失败');
        setCaseData(null);
      }
    } finally {
      if (!hasCached) setCaseLoading(false);
    }
  }, [orderId]);

  const loadRefunds = useCallback(async (options?: { silent?: boolean }) => {
    if (!orderId) return;
    const silent = Boolean(options?.silent);
    const cached = getDetailCache<RefundRequest[]>(ORDER_REFUNDS_CACHE_SCOPE, orderId);
    const hasCached = Array.isArray(cached);
    if (hasCached) {
      setRefunds(cached);
      setRefundsReady(true);
      if (!silent) setRefundsError(null);
    } else {
      setRefundsLoading(true);
      setRefundsError(null);
    }
    try {
      const d = await apiGet<RefundRequest[]>(`/orders/${orderId}/refund-requests`);
      const normalized = Array.isArray(d) ? d : [];
      setRefunds(normalized);
      setRefundsError(null);
      setDetailCache(ORDER_REFUNDS_CACHE_SCOPE, orderId, normalized);
    } catch (e: any) {
      if (!hasCached) {
        setRefundsError(e?.message || '加载失败');
        setRefunds([]);
      }
    } finally {
      if (!hasCached) setRefundsLoading(false);
      setRefundsReady(true);
    }
  }, [orderId]);

  const loadInvoice = useCallback(async () => {
    if (!orderId) return;
    if (!canFetchInvoiceDetail) {
      setInvoiceLoading(false);
      setInvoiceError(null);
      setInvoice(null);
      return;
    }
    setInvoiceLoading(true);
    setInvoiceError(null);
    try {
      const inv = await apiGet<OrderInvoice>(`/orders/${orderId}/invoice`);
      setInvoice(inv);
    } catch (e: any) {
      const statusCode = Number(e?.statusCode || 0);
      if (statusCode === 404) {
        setInvoice(null);
        setInvoiceError(null);
      } else {
        setInvoiceError(e?.message || '加载失败');
        setInvoice(null);
      }
    } finally {
      setInvoiceLoading(false);
    }
  }, [canFetchInvoiceDetail, orderId]);

  const refreshAll = useCallback((options?: { silent?: boolean }) => {
    void load({ silent: options?.silent });
    void loadCase({ silent: options?.silent });
    void loadRefunds({ silent: options?.silent });
  }, [load, loadCase, loadRefunds]);

  useEffect(() => {
    loadedOnceRef.current = false;
    setInvoiceRequested(false);
    setError(null);
    if (!orderId) {
      setOrder(null);
      setLoading(false);
      setCaseLoading(false);
      setCaseError(null);
      setCaseData(null);
      setRefundsLoading(false);
      setRefundsError(null);
      setRefunds([]);
      setRefundsReady(false);
      return;
    }
    const cachedOrder = getDetailCache<OrderDetail>(ORDER_DETAIL_CACHE_SCOPE, orderId);
    const cachedCase = getDetailCache<CaseWithMilestones>(ORDER_CASE_CACHE_SCOPE, orderId);
    const cachedRefunds = getDetailCache<RefundRequest[]>(ORDER_REFUNDS_CACHE_SCOPE, orderId);
    setOrder(cachedOrder || null);
    setLoading(!cachedOrder);
    setCaseLoading(false);
    setCaseError(null);
    setCaseData(cachedCase || null);
    setRefundsLoading(false);
    setRefundsError(null);
    if (Array.isArray(cachedRefunds)) {
      setRefunds(cachedRefunds);
      setRefundsReady(true);
    } else {
      setRefunds([]);
      setRefundsReady(false);
    }
  }, [orderId]);

  useEffect(() => {
    setInvoice(null);
    setInvoiceError(null);
  }, [order?.invoiceFileId, order?.invoiceNo, order?.invoiceIssuedAt, orderId]);

  // Avoid auto-fetch on tab switch to reduce noisy 404 logs when invoice file is not ready yet.

  const access = usePageAccess('approved-required', (a) => {
    if (a.state === 'ok') {
      if (orderId) {
        if (loadedOnceRef.current) {
          void refreshAll({ silent: true });
        } else {
          loadedOnceRef.current = true;
          void refreshAll();
        }
      }
      return;
    }
    loadedOnceRef.current = false;
    setLoading(false);
    setError(null);
    setOrder(null);
    setCaseLoading(false);
    setCaseError(null);
    setCaseData(null);
    setRefundsLoading(false);
    setRefundsError(null);
    setRefunds([]);
    setRefundsReady(false);
    setInvoiceLoading(false);
    setInvoiceError(null);
    setInvoice(null);
    setRefundOpen(false);
  });

  const requestInvoice = useCallback(async () => {
    if (!ensureApproved()) return;
    if (!orderId) return;
    if (invoiceRequesting) return;
    setInvoiceRequesting(true);
    try {
      await apiPost(`/orders/${orderId}/invoice-requests`, {}, { idempotencyKey: `invoice-${orderId}` });
      setInvoiceRequested(true);
      toast('已提交开票申请', { icon: 'success' });
      void load();
    } catch (e: any) {
      toast(e?.message || '申请开票失败', { icon: 'fail' });
    } finally {
      setInvoiceRequesting(false);
    }
  }, [orderId, invoiceRequesting, load]);

  const refundableByStatus = Boolean(order?.status && REFUNDABLE_STATUSES.has(order.status));
  const hasBlockingRefund = refunds.some((r) => BLOCKING_REFUND_REQUEST_STATUSES.has(r.status));
  const canSubmitRefund = refundsReady && !refundsLoading && refundableByStatus && !hasBlockingRefund;
  const refundBlockedHint = !refundsReady || refundsLoading
    ? '退款状态同步中，请稍后'
    : !refundableByStatus
    ? '当前订单状态不支持退款'
    : hasBlockingRefund
      ? '已有退款流程处理中'
      : '';

  const submitRefund = useCallback(async () => {
    if (!ensureApproved()) return;
    if (!orderId) return;
    if (refundSubmitting) return;
    if (!canSubmitRefund) {
      toast(refundBlockedHint || '当前不可申请退款');
      return;
    }
    const payload: RefundRequestCreate = {
      reasonCode,
      ...(reasonText.trim() ? { reasonText: reasonText.trim() } : {}),
    };
    setRefundSubmitting(true);
    try {
      await apiPost<RefundRequest>(`/orders/${orderId}/refund-requests`, payload, {
        idempotencyKey: `refund-${orderId}-${reasonCode}`,
      });
      toast('已提交退款申请', { icon: 'success' });
      setRefundOpen(false);
      setReasonText('');
      void loadRefunds();
      void load();
    } catch (e: any) {
      const statusCode = Number(e?.statusCode || 0);
      const code = String(e?.code || '').toUpperCase();
      if (statusCode === 409 || code === 'CONFLICT') {
        toast('退款申请已存在或正在处理');
        setRefundOpen(false);
        void loadRefunds();
        void load({ silent: true });
      } else {
        toast(e?.message || '提交失败');
      }
    } finally {
      setRefundSubmitting(false);
    }
  }, [orderId, refundSubmitting, canSubmitRefund, refundBlockedHint, reasonCode, reasonText, load, loadRefunds]);

  const openDisputeConversation = useCallback(async () => {
    if (!ensureApproved()) return;
    if (!orderId) return;
    if (openingDisputeChat) return;
    setOpeningDisputeChat(true);
    try {
      const conversation = await apiPost<Conversation>(
        `/orders/${orderId}/dispute-conversations`,
        {},
        { idempotencyKey: `order-dispute-conv-${orderId}` },
      );
      Taro.navigateTo({ url: `/subpackages/messages/chat/index?conversationId=${conversation.id}` });
    } catch (e: any) {
      toast(e?.message || '打开争议会话失败');
    } finally {
      setOpeningDisputeChat(false);
    }
  }, [openingDisputeChat, orderId]);

  const hasInvoiceFile = Boolean(order?.invoiceFileId || invoice?.invoiceFile?.url);
  const hasInvoiceRequest = Boolean(order?.invoiceNo || invoiceRequested);

  const openInvoiceCenter = useCallback(() => {
    const tab = hasInvoiceFile ? 'ISSUED' : hasInvoiceRequest ? 'APPLYING' : 'WAIT_APPLY';
    Taro.navigateTo({ url: `/subpackages/invoices/index?tab=${tab}&orderId=${orderId}` });
  }, [hasInvoiceFile, hasInvoiceRequest, orderId]);

  const canRequestInvoice = order?.status === 'COMPLETED' && !hasInvoiceFile && !hasInvoiceRequest;
  const invoiceHint = hasInvoiceFile
    ? canFetchInvoiceDetail
      ? '电子发票已上传，可复制下载链接'
      : '电子发票处理中，请到发票中心查看'
    : hasInvoiceRequest
    ? '已提交开票申请，财务处理中'
    : order?.status === 'COMPLETED'
      ? '订单已完成，可申请开票'
      : '订单完成后由财务上传';

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
  const showInitialLoading = loading && !order;

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
      ) : showInitialLoading ? (
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
                    Taro.navigateTo({ url: `/subpackages/checkout/final-pay/index?orderId=${orderId}` });
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
              <View style={{ display: 'flex', gap: '8rpx' }}>
                <Button variant="ghost" size="small" loading={openingDisputeChat} onClick={() => void openDisputeConversation()}>
                  争议沟通
                </Button>
                <Button
                  variant="danger"
                  size="small"
                  disabled={!canSubmitRefund || refundSubmitting}
                  onClick={() => {
                    if (!ensureApproved()) return;
                    if (!canSubmitRefund) {
                      toast(refundBlockedHint || '当前不可申请退款');
                      return;
                    }
                    setRefundOpen(true);
                  }}
                >
                  申请退款
                </Button>
              </View>
            </View>
            <View style={{ height: '10rpx' }} />
            {!canSubmitRefund && refundBlockedHint ? <Text className="muted">{refundBlockedHint}</Text> : null}
            {!canSubmitRefund && refundBlockedHint ? <View style={{ height: '10rpx' }} /> : null}
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
            <View className="row-between" style={{ gap: '12rpx' }}>
              <Text className="text-card-title">发票</Text>
              <Button variant="ghost" size="small" disabled={invoiceLoading || !canFetchInvoiceDetail} onClick={() => void loadInvoice()}>
                刷新
              </Button>
            </View>
            <View style={{ height: '10rpx' }} />
            <View id="order-invoice" />
            {invoiceLoading ? (
              <Text className="muted">加载中…</Text>
            ) : invoiceError ? (
              <ErrorCard title="发票信息加载失败" message={invoiceError} onRetry={loadInvoice} />
            ) : hasInvoiceFile && invoice?.invoiceFile?.url ? (
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
              <View className="row-between" style={{ gap: '12rpx' }}>
                <Text className="muted">{invoiceHint}</Text>
                {canRequestInvoice ? (
                  <Button variant="primary" size="small" loading={invoiceRequesting} onClick={() => void requestInvoice()}>
                    申请开票
                  </Button>
                ) : null}
              </View>
            )}
          </Surface>
          <View style={{ height: '16rpx' }} />
          <Surface>
            <View className="row-between" style={{ gap: '12rpx' }}>
              <Text className="text-card-title">发票管理</Text>
              <Button variant="ghost" size="small" onClick={openInvoiceCenter}>
                发票中心
              </Button>
            </View>
            <View style={{ height: '10rpx' }} />
            <Text className="muted">发票由平台财务线下开具（仅平台服务费/佣金）；开具后可在发票中心下载。</Text>
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
        <PopupSheet scrollable={false}>
          <Surface>
            <Text className="text-strong">原因类型</Text>
            <View style={{ height: '10rpx' }} />
            <View className="refund-reason-grid">
              {REFUND_REASON_OPTIONS.map((option) => (
                <View
                  key={option.value}
                  className={`refund-reason-item ${reasonCode === option.value ? 'is-active' : ''}`}
                  onClick={() => setReasonCode(option.value)}
                >
                  <Text>{option.label}</Text>
                </View>
              ))}
            </View>

            <View style={{ height: '12rpx' }} />
            <Text className="muted">说明（可选）</Text>
            <View style={{ height: '8rpx' }} />
            <TextArea value={reasonText} onChange={setReasonText} placeholder={`原因：${reasonLabel(reasonCode)}`} maxLength={500} />

            <View style={{ height: '14rpx' }} />
            <Button loading={refundSubmitting} disabled={refundSubmitting} onClick={() => void submitRefund()}>
              提交
            </Button>
          </Surface>
        </PopupSheet>
      </Popup>
    </View>
  );
}
