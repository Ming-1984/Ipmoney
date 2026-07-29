import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './index.scss';

import type { components } from '@ipmoney/api-types';

import { apiGet, apiPost } from '../../../lib/api';
import { getDetailCache, setDetailCache } from '../../../lib/detailCache';
import { normalizeDisplayText } from '../../../lib/displayText';
import { ensureApproved, usePageAccess } from '../../../lib/guard';
import { formatTimeSmart } from '../../../lib/format';
import { orderStatusLabel } from '../../../lib/labels';
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
  { label: '权利方材料', value: 'SELLER_MISSING_MATERIALS' },
  { label: '协商一致', value: 'MUTUAL_AGREEMENT' },
  { label: '风控', value: 'RISK_CONTROL' },
  { label: '其他', value: 'OTHER' },
];

function reasonLabel(code: RefundReasonCode): string {
  if (code === 'BUYER_CHANGED_MIND') return '意向方改变主意';
  if (code === 'SELLER_MISSING_MATERIALS') return '权利方无法提供材料';
  if (code === 'MUTUAL_AGREEMENT') return '双方协商一致';
  if (code === 'RISK_CONTROL') return '风控/合规原因';
  return '其他';
}

function milestoneNameLabel(name?: string | null): string {
  if (!name) return '关键节点';
  if (name === 'CONTRACT_SIGNED') return '合同签署';
  if (name === 'TRANSFER_SUBMITTED') return '权属提交';
  if (name === 'TRANSFER_COMPLETED') return '权属变更完成';
  if (name === 'SETTLEMENT_READY') return '结算准备';
  if (name === 'SETTLEMENT_PAID') return '款项处理完成';
  return '里程碑待确认';
}

function milestoneStatusLabel(status?: string | null): string {
  if (!status) return '待处理';
  if (status === 'DONE') return '已完成';
  if (status === 'PENDING') return '待处理';
  if (status === 'SKIPPED') return '已跳过';
  if (status === 'IN_PROGRESS') return '进行中';
  if (status === 'FAILED') return '失败';
  return '处理中';
}

function refundStatusLabel(status?: string | null): string {
  if (!status) return '待处理';
  if (status === 'PENDING') return '待处理';
  if (status === 'APPROVED') return '已同意';
  if (status === 'REJECTED') return '已拒绝';
  if (status === 'REFUNDING') return '退款中';
  if (status === 'REFUNDED') return '已退款';
  return '处理中';
}

function displayOrderInfo(value: unknown, fallback = '待确认'): string {
  return normalizeDisplayText(value) || fallback;
}

function shortOrderId(id?: string | null): string {
  const compact = String(id || '').replace(/-/g, '').trim().toUpperCase();
  if (!compact) return '待确认';
  return compact.slice(0, 8);
}

function moneyDisplay(fen?: number | null): string {
  if (fen === undefined || fen === null) return '待确认';
  const yuan = fenToYuan(fen);
  const [integer, decimal] = yuan.split('.');
  const formatted = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `¥${decimal ? `${formatted}.${decimal}` : formatted}`;
}

function orderStatusToneClass(status: OrderBase['status']): string {
  if (status === 'DEPOSIT_PENDING') return 'is-deposit-pending';
  if (status === 'DEPOSIT_PAID') return 'is-deposit-paid';
  if (status === 'WAIT_FINAL_PAYMENT') return 'is-wait-final';
  if (status === 'FINAL_PAID_ESCROW') return 'is-final-escrow';
  if (status === 'READY_TO_SETTLE') return 'is-ready-settle';
  if (status === 'COMPLETED') return 'is-completed';
  if (status === 'CANCELLED') return 'is-cancelled';
  if (status === 'REFUNDING') return 'is-refunding';
  if (status === 'REFUNDED') return 'is-refunded';
  return 'is-unknown';
}

function orderProgressHint(order: OrderDetail): string {
  if (order.status === 'DEPOSIT_PENDING') return '等待支付订金';
  if (order.status === 'DEPOSIT_PAID') return '订金已支付，平台客服将介入跟单';
  if (order.status === 'WAIT_FINAL_PAYMENT') return '合同已确认，可支付尾款';
  if (order.status === 'FINAL_PAID_ESCROW') return '尾款已托管，等待权属变更';
  if (order.status === 'READY_TO_SETTLE') return '权属变更完成，等待款项处理';
  if (order.status === 'COMPLETED') return '订单已完成';
  if (order.status === 'CANCELLED') return '订单已取消';
  if (order.status === 'REFUNDING') return '退款处理中';
  if (order.status === 'REFUNDED') return '退款已完成';
  return '订单状态待确认';
}

function milestoneToneClass(status?: string | null): string {
  if (status === 'DONE') return 'is-done';
  if (status === 'IN_PROGRESS') return 'is-active';
  if (status === 'FAILED') return 'is-danger';
  if (status === 'SKIPPED') return 'is-muted';
  return 'is-pending';
}

export default function OrderDetailPage() {
  const orderId = useRouteStringParam('orderId') || '';
  const loadedOnceRef = useRef(false);
  const orderIdRef = useRef(orderId);
  const orderLoadSeqRef = useRef(0);
  const caseLoadSeqRef = useRef(0);
  const refundLoadSeqRef = useRef(0);
  const invoiceLoadSeqRef = useRef(0);
  const invoiceActionSeqRef = useRef(0);
  const refundActionSeqRef = useRef(0);
  const disputeActionSeqRef = useRef(0);
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
    const targetOrderId = orderId;
    if (!targetOrderId) return null;
    const seq = ++orderLoadSeqRef.current;
    const cached = silent ? null : getDetailCache<OrderDetail>(ORDER_DETAIL_CACHE_SCOPE, targetOrderId);
    if (cached) {
      setOrder(cached);
      setLoading(false);
      setError(null);
    } else if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const d = await apiGet<OrderDetail>(`/orders/${targetOrderId}`);
      if (seq !== orderLoadSeqRef.current || orderIdRef.current !== targetOrderId) return null;
      setOrder(d);
      setDetailCache(ORDER_DETAIL_CACHE_SCOPE, targetOrderId, d);
      return d;
    } catch (e: any) {
      if (seq !== orderLoadSeqRef.current || orderIdRef.current !== targetOrderId) return null;
      if (!silent && !cached) {
        setError(e?.message || '加载失败');
        setOrder(null);
      }
      return null;
    } finally {
      if (!silent && seq === orderLoadSeqRef.current && orderIdRef.current === targetOrderId) setLoading(false);
    }
  }, [orderId]);

  const loadCase = useCallback(async (options?: { silent?: boolean }) => {
    const targetOrderId = orderId;
    if (!targetOrderId) return;
    const seq = ++caseLoadSeqRef.current;
    const silent = Boolean(options?.silent);
    const cached = getDetailCache<CaseWithMilestones>(ORDER_CASE_CACHE_SCOPE, targetOrderId);
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
      const d = await apiGet<CaseWithMilestones>(`/orders/${targetOrderId}/case`);
      if (seq !== caseLoadSeqRef.current || orderIdRef.current !== targetOrderId) return;
      setCaseData(d);
      setCaseError(null);
      setDetailCache(ORDER_CASE_CACHE_SCOPE, targetOrderId, d);
    } catch (e: any) {
      if (seq !== caseLoadSeqRef.current || orderIdRef.current !== targetOrderId) return;
      if (!hasCached) {
        setCaseError(e?.message || '加载失败');
        setCaseData(null);
      }
    } finally {
      if (!hasCached && seq === caseLoadSeqRef.current && orderIdRef.current === targetOrderId) setCaseLoading(false);
    }
  }, [orderId]);

  const loadRefunds = useCallback(async (options?: { silent?: boolean }) => {
    const targetOrderId = orderId;
    if (!targetOrderId) return;
    const seq = ++refundLoadSeqRef.current;
    const silent = Boolean(options?.silent);
    const cached = getDetailCache<RefundRequest[]>(ORDER_REFUNDS_CACHE_SCOPE, targetOrderId);
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
      const d = await apiGet<RefundRequest[]>(`/orders/${targetOrderId}/refund-requests`);
      if (seq !== refundLoadSeqRef.current || orderIdRef.current !== targetOrderId) return;
      const normalized = Array.isArray(d) ? d : [];
      setRefunds(normalized);
      setRefundsError(null);
      setDetailCache(ORDER_REFUNDS_CACHE_SCOPE, targetOrderId, normalized);
    } catch (e: any) {
      if (seq !== refundLoadSeqRef.current || orderIdRef.current !== targetOrderId) return;
      if (!hasCached) {
        setRefundsError(e?.message || '加载失败');
        setRefunds([]);
      }
    } finally {
      if (!hasCached && seq === refundLoadSeqRef.current && orderIdRef.current === targetOrderId) setRefundsLoading(false);
      if (seq === refundLoadSeqRef.current && orderIdRef.current === targetOrderId) setRefundsReady(true);
    }
  }, [orderId]);

  const loadInvoice = useCallback(async () => {
    const targetOrderId = orderId;
    if (!targetOrderId) return;
    const seq = ++invoiceLoadSeqRef.current;
    if (!canFetchInvoiceDetail) {
      setInvoiceLoading(false);
      setInvoiceError(null);
      setInvoice(null);
      return;
    }
    setInvoiceLoading(true);
    setInvoiceError(null);
    try {
      const inv = await apiGet<OrderInvoice>(`/orders/${targetOrderId}/invoice`);
      if (seq !== invoiceLoadSeqRef.current || orderIdRef.current !== targetOrderId) return;
      setInvoice(inv);
    } catch (e: any) {
      if (seq !== invoiceLoadSeqRef.current || orderIdRef.current !== targetOrderId) return;
      const statusCode = Number(e?.statusCode || 0);
      if (statusCode === 404) {
        setInvoice(null);
        setInvoiceError(null);
      } else {
        setInvoiceError(e?.message || '加载失败');
        setInvoice(null);
      }
    } finally {
      if (seq === invoiceLoadSeqRef.current && orderIdRef.current === targetOrderId) {
        setInvoiceLoading(false);
      }
    }
  }, [canFetchInvoiceDetail, orderId]);

  const refreshAll = useCallback((options?: { silent?: boolean }) => {
    void load({ silent: options?.silent });
    void loadCase({ silent: options?.silent });
    void loadRefunds({ silent: options?.silent });
  }, [load, loadCase, loadRefunds]);

  useEffect(() => {
    orderIdRef.current = orderId;
    loadedOnceRef.current = false;
    orderLoadSeqRef.current += 1;
    caseLoadSeqRef.current += 1;
    refundLoadSeqRef.current += 1;
    invoiceLoadSeqRef.current += 1;
    invoiceActionSeqRef.current += 1;
    refundActionSeqRef.current += 1;
    disputeActionSeqRef.current += 1;
    setActiveTab('order-overview');
    setInvoiceRequested(false);
    setInvoiceRequesting(false);
    setInvoiceLoading(false);
    setInvoiceError(null);
    setInvoice(null);
    setRefundOpen(false);
    setRefundSubmitting(false);
    setOpeningDisputeChat(false);
    setReasonCode('BUYER_CHANGED_MIND');
    setReasonText('');
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
      setInvoiceRequested(false);
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
        if (loadedOnceRef.current && !loading) {
          void refreshAll({ silent: true });
        }
      }
      return;
    }
    loadedOnceRef.current = false;
    orderLoadSeqRef.current += 1;
    caseLoadSeqRef.current += 1;
    refundLoadSeqRef.current += 1;
    invoiceLoadSeqRef.current += 1;
    invoiceActionSeqRef.current += 1;
    refundActionSeqRef.current += 1;
    disputeActionSeqRef.current += 1;
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

  useEffect(() => {
    if (access.state !== 'ok' || !orderId || loadedOnceRef.current) return;
    loadedOnceRef.current = true;
    void refreshAll();
  }, [access.state, orderId, refreshAll]);

  const requestInvoice = useCallback(async () => {
    if (!ensureApproved()) return;
    const targetOrderId = orderId;
    if (!targetOrderId) return;
    if (invoiceRequesting) return;
    const seq = ++invoiceActionSeqRef.current;
    setInvoiceRequesting(true);
    try {
      await apiPost(`/orders/${targetOrderId}/invoice-requests`, {}, { idempotencyKey: `invoice-${targetOrderId}` });
      if (seq !== invoiceActionSeqRef.current || orderIdRef.current !== targetOrderId) return;
      setInvoiceRequested(true);
      toast('已提交开票申请', { icon: 'success' });
      void load();
    } catch (e: any) {
      if (seq !== invoiceActionSeqRef.current || orderIdRef.current !== targetOrderId) return;
      toast(e?.message || '申请开票失败', { icon: 'fail' });
    } finally {
      if (seq === invoiceActionSeqRef.current && orderIdRef.current === targetOrderId) {
        setInvoiceRequesting(false);
      }
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
    const targetOrderId = orderId;
    if (!targetOrderId) return;
    if (refundSubmitting) return;
    const seq = ++refundActionSeqRef.current;
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
      await apiPost<RefundRequest>(`/orders/${targetOrderId}/refund-requests`, payload, {
        idempotencyKey: `refund-${targetOrderId}-${reasonCode}`,
      });
      if (seq !== refundActionSeqRef.current || orderIdRef.current !== targetOrderId) return;
      toast('已提交退款申请', { icon: 'success' });
      setRefundOpen(false);
      setReasonText('');
      void loadRefunds();
      void load();
    } catch (e: any) {
      if (seq !== refundActionSeqRef.current || orderIdRef.current !== targetOrderId) return;
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
      if (seq === refundActionSeqRef.current && orderIdRef.current === targetOrderId) {
        setRefundSubmitting(false);
      }
    }
  }, [orderId, refundSubmitting, canSubmitRefund, refundBlockedHint, reasonCode, reasonText, load, loadRefunds]);

  const openDisputeConversation = useCallback(async () => {
    if (!ensureApproved()) return;
    const targetOrderId = orderId;
    if (!targetOrderId) return;
    if (openingDisputeChat) return;
    const seq = ++disputeActionSeqRef.current;
    setOpeningDisputeChat(true);
    try {
      const conversation = await apiPost<Conversation>(
        `/orders/${targetOrderId}/dispute-conversations`,
        {},
        { idempotencyKey: `order-dispute-conv-${targetOrderId}` },
      );
      if (seq !== disputeActionSeqRef.current || orderIdRef.current !== targetOrderId) return;
      Taro.navigateTo({ url: `/subpackages/messages/chat/index?conversationId=${conversation.id}` });
    } catch (e: any) {
      if (seq !== disputeActionSeqRef.current || orderIdRef.current !== targetOrderId) return;
      toast(e?.message || '打开争议会话失败');
    } finally {
      if (seq === disputeActionSeqRef.current && orderIdRef.current === targetOrderId) {
        setOpeningDisputeChat(false);
      }
    }
  }, [openingDisputeChat, orderId]);

  const hasInvoiceFile = Boolean(order?.invoiceFileId || invoice?.invoiceFile?.url);
  const hasInvoiceRequest = Boolean(order?.invoiceNo || invoiceRequested);
  const hasInvoiceDownloadUrl = Boolean(invoice?.invoiceFile?.url);

  const openInvoiceCenter = useCallback(() => {
    const tab = hasInvoiceFile ? 'ISSUED' : 'WAIT_APPLY';
    Taro.navigateTo({ url: `/subpackages/invoices/index?tab=${tab}&orderId=${orderId}` });
  }, [hasInvoiceFile, orderId]);

  const canRequestInvoice = order?.status === 'COMPLETED' && !hasInvoiceFile && !hasInvoiceRequest;
  const invoiceHint = hasInvoiceDownloadUrl
    ? '电子发票已上传，可复制下载链接'
    : hasInvoiceFile
      ? '电子发票已上传，请点击刷新或前往发票中心查看'
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
    <View className="container detail-page-compact order-detail-page">
      <PageHeader weapp title="订单详情" subtitle="查看交易进度、退款与发票信息" />
      <Spacer />

      {access.state !== 'ok' ? (
        <AccessGate access={access} />
      ) : showInitialLoading ? (
        <LoadingCard />
      ) : error ? (
        <ErrorCard message={error} onRetry={load} />
      ) : order ? (
        <View className="order-detail-content">
          <Surface className={`order-detail-hero ${orderStatusToneClass(order.status)}`} id="order-overview" padding="none">
            <View className="order-detail-hero-accent" />
            <View className="order-detail-hero-body">
              <View className="order-detail-status-row">
                <View className="order-detail-title-group">
                  <Text className="order-detail-eyebrow">当前进度</Text>
                  <Text className="order-detail-headline">{orderProgressHint(order)}</Text>
                  <Text className="order-detail-updated">更新于 {formatTimeSmart(order.updatedAt || order.createdAt)}</Text>
                </View>
                <Text className="order-detail-status-pill">{orderStatusLabel(order.status)}</Text>
              </View>

              <View className="order-detail-target">
                <Text className="order-detail-target-label">交易标的</Text>
                <Text className="order-detail-target-title clamp-2">{displayOrderInfo(order.listingTitle, '交易标的待确认')}</Text>
                <View className="order-detail-target-meta">
                  <Text>订单号 {shortOrderId(order.id)}</Text>
                  {normalizeDisplayText(order.applicationNoDisplay) ? <Text>申请号 {displayOrderInfo(order.applicationNoDisplay)}</Text> : null}
                </View>
              </View>

              <View className="order-detail-money-grid">
                <View className="order-detail-money-cell is-total">
                  <Text className="order-detail-money-label">成交总价</Text>
                  <Text className={order.dealAmountFen == null ? 'order-detail-money-value is-empty' : 'order-detail-money-value'}>
                    {moneyDisplay(order.dealAmountFen)}
                  </Text>
                </View>
                <View className="order-detail-money-cell">
                  <Text className="order-detail-money-label">订金</Text>
                  <Text className={order.depositAmountFen == null ? 'order-detail-money-value is-empty' : 'order-detail-money-value'}>
                    {moneyDisplay(order.depositAmountFen)}
                  </Text>
                </View>
                <View className="order-detail-money-cell">
                  <Text className="order-detail-money-label">尾款</Text>
                  <Text className={order.finalAmountFen == null ? 'order-detail-money-value is-empty' : 'order-detail-money-value'}>
                    {moneyDisplay(order.finalAmountFen)}
                  </Text>
                </View>
              </View>

              <View className="order-detail-party-grid">
                <View className="order-detail-party-card">
                  <Text className="order-detail-party-label">意向方</Text>
                  <Text className="order-detail-party-name clamp-1">{displayOrderInfo(order.buyerDisplayName)}</Text>
                </View>
                <View className="order-detail-party-card">
                  <Text className="order-detail-party-label">权利方</Text>
                  <Text className="order-detail-party-name clamp-1">{displayOrderInfo(order.sellerDisplayName)}</Text>
                </View>
              </View>
            </View>
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

          {order.status === 'WAIT_FINAL_PAYMENT' ? (
            <Surface className="order-detail-action-card">
              <View className="order-detail-action-copy">
                <Text className="order-detail-action-title">下一步：支付尾款</Text>
                <Text className="order-detail-action-desc">合同已确认，可在平台托管支付尾款。</Text>
              </View>
              <View className="order-detail-action-button">
                <Button
                  variant="primary"
                  onClick={() => {
                    if (!ensureApproved()) return;
                    Taro.navigateTo({ url: `/subpackages/checkout/final-pay/index?orderId=${orderId}` });
                  }}
                >
                  支付尾款{order.finalAmountFen != null ? ` ¥${fenToYuan(order.finalAmountFen)}` : ''}
                </Button>
              </View>
            </Surface>
          ) : null}

          <Surface className="order-detail-card" id="order-case" padding="none">
            <View className="order-detail-card-head">
              <View className="order-detail-card-title-group">
                <Text className="order-detail-card-title">跟单与里程碑</Text>
                <Text className="order-detail-card-subtitle">平台跟单节点与履约进度</Text>
              </View>
              <Button variant="ghost" size="small" onClick={() => void loadCase()}>
                刷新
              </Button>
            </View>
            <View className="order-detail-card-body">
              {caseLoading ? (
                <Text className="order-detail-empty">加载中…</Text>
              ) : caseData?.milestones?.length ? (
                <View className="order-timeline">
                  {caseData.milestones.map((m, idx) => (
                    <View key={`${m.name}-${idx}`} className={`order-timeline-item ${milestoneToneClass(m.status)}`}>
                      <View className="order-timeline-rail">
                        <View className="order-timeline-dot" />
                      </View>
                      <View className="order-timeline-body">
                        <View className="order-timeline-main">
                          <Text className="order-timeline-title">{milestoneNameLabel(m.name)}</Text>
                          <Text className="order-timeline-status">{milestoneStatusLabel(m.status)}</Text>
                        </View>
                        <Text className="order-timeline-time">{m.occurredAt ? formatTimeSmart(m.occurredAt) : '时间待确认'}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : caseError ? (
                <ErrorCard title="里程碑加载失败" message={caseError} onRetry={loadCase} />
              ) : (
                <Text className="order-detail-empty">暂无里程碑数据</Text>
              )}
            </View>
          </Surface>

          <Surface className="order-detail-card" id="order-refund" padding="none">
            <View className="order-detail-card-head order-detail-card-head-dual">
              <View className="order-detail-card-title-group">
                <Text className="order-detail-card-title">退款与争议</Text>
                <Text className="order-detail-card-subtitle">退款申请、争议沟通记录</Text>
              </View>
              <View className="order-detail-card-actions order-detail-card-actions-dual">
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
            <View className="order-detail-card-body">
              {!canSubmitRefund && refundBlockedHint ? <Text className="order-detail-hint">{refundBlockedHint}</Text> : null}
              {refundsLoading ? (
                <Text className="order-detail-empty">加载中…</Text>
              ) : refundsError ? (
                <ErrorCard title="退款申请加载失败" message={refundsError} onRetry={loadRefunds} />
              ) : refunds.length ? (
                <View className="order-record-list">
                  {refunds.map((r) => (
                    <View key={r.id} className="order-record-item">
                      <View className="order-record-main">
                        <Text className="order-record-title">{refundStatusLabel(r.status)}</Text>
                        <Text className="order-record-subtitle">{formatTimeSmart(r.createdAt)}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <Text className="order-detail-empty">暂无退款申请</Text>
              )}
            </View>
          </Surface>

          <Surface className="order-detail-card" id="order-invoice" padding="none">
            <View className="order-detail-card-head order-detail-card-head-dual">
              <View className="order-detail-card-title-group">
                <Text className="order-detail-card-title">发票与开票</Text>
                <Text className="order-detail-card-subtitle">平台服务费发票与下载入口</Text>
              </View>
              <View className="order-detail-card-actions order-detail-card-actions-dual">
                <Button variant="ghost" size="small" disabled={invoiceLoading || !canFetchInvoiceDetail} onClick={() => void loadInvoice()}>
                  刷新
                </Button>
                <Button variant="ghost" size="small" onClick={openInvoiceCenter}>
                  发票中心
                </Button>
              </View>
            </View>
            <View className="order-detail-card-body">
              {invoiceLoading ? (
                <Text className="order-detail-empty">加载中…</Text>
              ) : invoiceError ? (
                <ErrorCard title="发票信息加载失败" message={invoiceError} onRetry={loadInvoice} />
              ) : hasInvoiceFile && invoice?.invoiceFile?.url ? (
                <View className="order-invoice-ready">
                  <View className="order-record-main">
                    <Text className="order-record-title">电子发票已上传</Text>
                    <Text className="order-record-subtitle">{displayOrderInfo(invoice.invoiceNo || order.invoiceNo, '发票号待确认')}</Text>
                  </View>
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
                <View className="order-invoice-pending">
                  <Text className="order-detail-hint">{invoiceHint}</Text>
                  {canRequestInvoice ? (
                    <Button variant="primary" size="small" loading={invoiceRequesting} onClick={() => void requestInvoice()}>
                      申请开票
                    </Button>
                  ) : null}
                </View>
              )}
              <Text className="order-detail-note">发票由平台财务线下开具（仅平台服务费）；开具后可在发票中心下载。</Text>
            </View>
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
        <PopupSheet scrollable={false}>
          <Surface className="refund-popup-card">
            <Text className="text-strong">原因类型</Text>
            <View className="refund-popup-gap-sm" />
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

            <View className="refund-popup-gap" />
            <Text className="muted">说明（可选）</Text>
            <View className="refund-popup-gap-xs" />
            <TextArea value={reasonText} onChange={setReasonText} placeholder={`原因：${reasonLabel(reasonCode)}`} maxLength={500} />

            <View className="refund-popup-gap-lg" />
            <Button loading={refundSubmitting} disabled={refundSubmitting} onClick={() => void submitRefund()}>
              提交
            </Button>
          </Surface>
        </PopupSheet>
      </Popup>
    </View>
  );
}
