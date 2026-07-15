import { Text, View } from '@tarojs/components';
import Taro, { useDidHide, useDidShow } from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './index.scss';

import { apiGet, apiPost } from '../../lib/api';
import { normalizeDisplayText } from '../../lib/displayText';
import { formatTimeSmart } from '../../lib/format';
import { usePageAccess } from '../../lib/guard';
import { useRouteStringParam, useRouteUuidParam } from '../../lib/routeParams';
import { usePagedList } from '../../lib/usePagedList';
import { ListFooter } from '../../ui/ListFooter';
import { AccessGate } from '../../ui/PageState';
import { PageHeader, Spacer, Surface, TipBanner } from '../../ui/layout';
import { PullToRefresh, toast } from '../../ui/nutui';
import { EmptyCard, ErrorCard, LoadingCard } from '../../ui/StateCards';

type PatentMaintenanceStatus = 'DUE' | 'PAID' | 'OVERDUE' | 'WAIVED';
type PatentMaintenanceOrderStatus =
  | 'REQUESTED'
  | 'QUOTED'
  | 'AWAITING_PAYMENT'
  | 'PAID'
  | 'EXECUTING'
  | 'RECEIPT_UPLOADED'
  | 'RECONCILED'
  | 'CLOSED'
  | 'CANCELLED';
type MaintenanceUrgency = 'OVERDUE' | 'DUE_SOON' | 'UPCOMING' | 'NORMAL' | 'SETTLED';

type Conversation = { id: string };

type PatentMaintenanceSchedule = {
  id: string;
  patentId: string;
  yearNo: number;
  dueDate: string;
  gracePeriodEnd?: string | null;
  status: PatentMaintenanceStatus;
  createdAt: string;
  updatedAt?: string;
  patentTitle?: string;
  applicationNoDisplay?: string;
  urgency?: MaintenanceUrgency;
  canContactSupport?: boolean;
};

type PatentMaintenanceScheduleGroup = {
  key: string;
  patentTitle?: string;
  applicationNoDisplay?: string;
  items: PatentMaintenanceSchedule[];
};

type PatentMaintenanceOrder = {
  id: string;
  scheduleId: string;
  applicantUserId: string;
  applicantDisplayName?: string | null;
  assignedCsUserId?: string | null;
  assignedCsDisplayName?: string | null;
  status: PatentMaintenanceOrderStatus;
  officialFeeFen: number;
  lateFeeFen: number;
  serviceFeeFen: number;
  totalAmountFen: number;
  paymentDeadline?: string;
  paidAt?: string;
  executedAt?: string;
  receiptIssuedAt?: string;
  officialSubmissionNo?: string;
  officialReceiptNo?: string;
  paymentTxnNo?: string;
  officialReceiptFileId?: string;
  reconcileStatus?: 'PENDING' | 'MATCHED' | 'MISMATCHED';
  reconcileNote?: string;
  closeNote?: string;
  patentTitle?: string;
  applicationNoDisplay?: string;
  scheduleYearNo?: number;
  scheduleDueDate?: string;
  createdAt: string;
  updatedAt?: string;
  canContactSupport?: boolean;
};

type PatentMaintenanceOrderEvent = {
  id: string;
  orderId: string;
  actorDisplayName?: string | null;
  actorNickname?: string;
  actorUserId?: string;
  eventType: string;
  fromStatus?: string;
  toStatus: string;
  note?: string;
  createdAt: string;
};

type Paged<T> = {
  items: T[];
  page: { page: number; pageSize: number; total: number };
};
type MaintenanceSummary = {
  overdue: number;
  dueSoon: number;
  activeOrders: number;
  historyOrders: number;
};

type ScheduleFilter = '' | PatentMaintenanceStatus;
type OrderFilter = '' | PatentMaintenanceOrderStatus;
type MaintenanceTab = 'schedules' | 'progress' | 'history';

const MAINTENANCE_REQUEST_CREATED_EVENT = 'maintenance-request-created';

const SCHEDULE_FILTER_OPTIONS: Array<{ value: ScheduleFilter; label: string }> = [
  { value: '', label: '全部年度' },
  { value: 'DUE', label: '待缴年度' },
  { value: 'OVERDUE', label: '逾期年度' },
  { value: 'PAID', label: '已缴年度' },
  { value: 'WAIVED', label: '豁免年度' },
];

const ACTIVE_ORDER_STATUSES = new Set<PatentMaintenanceOrderStatus>([
  'REQUESTED',
  'QUOTED',
  'AWAITING_PAYMENT',
  'PAID',
  'EXECUTING',
  'RECEIPT_UPLOADED',
  'RECONCILED',
]);

const HISTORY_ORDER_STATUSES = new Set<PatentMaintenanceOrderStatus>(['CLOSED', 'CANCELLED']);

const PROGRESS_FILTER_OPTIONS: Array<{ value: OrderFilter; label: string }> = [
  { value: '', label: '全部进度' },
  { value: 'REQUESTED', label: '已申请' },
  { value: 'QUOTED', label: '已报价' },
  { value: 'AWAITING_PAYMENT', label: '待联系付款' },
  { value: 'PAID', label: '已确认到账' },
  { value: 'EXECUTING', label: '办理中' },
  { value: 'RECEIPT_UPLOADED', label: '回执已上传' },
  { value: 'RECONCILED', label: '已核对' },
];

const HISTORY_FILTER_OPTIONS: Array<{ value: OrderFilter; label: string }> = [
  { value: '', label: '全部记录' },
  { value: 'CLOSED', label: '已完成' },
  { value: 'CANCELLED', label: '已取消' },
];

const ORDER_FILTER_OPTIONS: Array<{ value: OrderFilter; label: string }> = [
  ...PROGRESS_FILTER_OPTIONS,
  ...HISTORY_FILTER_OPTIONS.filter((item): item is { value: PatentMaintenanceOrderStatus; label: string } => Boolean(item.value)),
];

const ORDER_PROGRESS_STEPS: Array<{
  status: PatentMaintenanceOrderStatus;
  title: string;
  desc: string;
  eventTypes: string[];
}> = [
  {
    status: 'REQUESTED',
    title: '已申请',
    desc: '已收到你的年费代缴申请',
    eventTypes: ['CREATED'],
  },
  {
    status: 'QUOTED',
    title: '已报价',
    desc: '客服核验年度和费用后给出报价',
    eventTypes: ['QUOTE_UPDATED'],
  },
  {
    status: 'AWAITING_PAYMENT',
    title: '待联系付款',
    desc: '等待确认付款方式和付款安排',
    eventTypes: [],
  },
  {
    status: 'PAID',
    title: '已确认到账',
    desc: '平台确认款项后开始办理',
    eventTypes: ['PAYMENT_CONFIRMED'],
  },
  {
    status: 'EXECUTING',
    title: '办理中',
    desc: '正在提交或处理官方年费缴纳',
    eventTypes: ['EXECUTION_SUBMITTED'],
  },
  {
    status: 'RECEIPT_UPLOADED',
    title: '回执已上传',
    desc: '官方回执或相关材料已留存',
    eventTypes: ['RECEIPT_UPLOADED'],
  },
  {
    status: 'RECONCILED',
    title: '已核对',
    desc: '回执和费用信息已完成核对',
    eventTypes: ['RECONCILED'],
  },
  {
    status: 'CLOSED',
    title: '已完成',
    desc: '本次代缴服务已完成归档',
    eventTypes: ['CLOSED'],
  },
];
function scheduleStatusLabel(status?: PatentMaintenanceStatus): string {
  if (status === 'DUE') return '待缴费';
  if (status === 'PAID') return '已缴费';
  if (status === 'OVERDUE') return '已逾期';
  if (status === 'WAIVED') return '已豁免';
  return '待确认';
}

function isPastDate(value?: string | null): boolean {
  const date = String(value || '').trim();
  if (!date) return false;
  return date < localDateKey(new Date());
}

function scheduleActionText(schedule: PatentMaintenanceSchedule): string {
  if (schedule.status === 'OVERDUE') {
    return isPastDate(schedule.gracePeriodEnd) ? '申请核验' : '申请补缴';
  }
  return '申请代缴';
}

function scheduleStatusText(schedule: PatentMaintenanceSchedule): string {
  if (schedule.status !== 'OVERDUE') return scheduleStatusLabel(schedule.status);
  return isPastDate(schedule.gracePeriodEnd) ? '逾期需核验' : '逾期可补缴';
}

function scheduleActionHint(schedule: PatentMaintenanceSchedule): string {
  if (schedule.status === 'OVERDUE') {
    return isPastDate(schedule.gracePeriodEnd)
      ? '已超过宽限截止，提交后由客服核验是否可恢复或补办。'
      : '已过缴费日，提交后会核验滞纳金并协助补缴。';
  }
  return '';
}

function scheduleStatusClass(status?: PatentMaintenanceStatus): string {
  if (status === 'DUE') return 'is-due';
  if (status === 'PAID') return 'is-paid';
  if (status === 'OVERDUE') return 'is-overdue';
  if (status === 'WAIVED') return 'is-waived';
  return 'is-unknown';
}

function scheduleStatusSummary(items: PatentMaintenanceSchedule[]): Array<{ status: PatentMaintenanceStatus; count: number }> {
  const counts = new Map<PatentMaintenanceStatus, number>();
  for (const item of items) counts.set(item.status, (counts.get(item.status) || 0) + 1);
  return (['OVERDUE', 'DUE', 'PAID', 'WAIVED'] as PatentMaintenanceStatus[])
    .map((status) => ({ status, count: counts.get(status) || 0 }))
    .filter((item) => item.count > 0);
}

function orderStatusLabel(status?: PatentMaintenanceOrderStatus): string {
  if (!status) return '待确认';
  const option = ORDER_FILTER_OPTIONS.find((it) => it.value === status);
  return option?.label || '状态待确认';
}

function orderEventTypeLabel(value?: string): string {
  const type = String(value || '').trim().toUpperCase();
  if (!type) return '状态更新';
  if (type === 'CREATED') return '已申请';
  if (type === 'QUOTE_UPDATED') return '报价已更新';
  if (type === 'PAYMENT_CONFIRMED') return '已确认到账';
  if (type === 'EXECUTION_SUBMITTED') return '办理已提交';
  if (type === 'RECEIPT_UPLOADED') return '已上传回执';
  if (type === 'RECONCILED') return '已完成核对';
  if (type === 'CLOSED') return '已完成';
  if (type === 'CANCELLED') return '已取消';
  return '状态更新';
}

function orderProgressIndex(status?: PatentMaintenanceOrderStatus): number {
  const index = ORDER_PROGRESS_STEPS.findIndex((step) => step.status === status);
  if (index >= 0) return index;
  return 0;
}

function orderStepEvent(
  step: (typeof ORDER_PROGRESS_STEPS)[number],
  events: PatentMaintenanceOrderEvent[],
): PatentMaintenanceOrderEvent | undefined {
  const statusEvent = [...events].reverse().find((event) => event.toStatus === step.status);
  if (statusEvent) return statusEvent;
  return [...events].reverse().find((event) => step.eventTypes.includes(String(event.eventType || '').toUpperCase()));
}

function timelineNoteText(value: unknown): string {
  const note = normalizeDisplayText(value);
  if (!note) return '';
  if (!/[\u4e00-\u9fff]/.test(note)) return '';
  return note;
}

function orderProgressSteps(order: PatentMaintenanceOrder, events: PatentMaintenanceOrderEvent[]) {
  if (order.status === 'CANCELLED') {
    const cancelEvent = [...events].reverse().find((event) => event.toStatus === 'CANCELLED' || event.eventType === 'CANCELLED');
    const lastKnownStatus = cancelEvent?.fromStatus || [...events].reverse().find((event) => event.toStatus !== 'CANCELLED')?.toStatus;
    const lastKnownIndex = Math.max(0, orderProgressIndex(lastKnownStatus as PatentMaintenanceOrderStatus | undefined));
    return [
      ...ORDER_PROGRESS_STEPS.slice(0, lastKnownIndex + 1).map((step) => ({
        ...step,
        event: orderStepEvent(step, events),
        state: 'done',
      })),
      {
        status: 'CANCELLED' as PatentMaintenanceOrderStatus,
        title: '已取消',
        desc: '本次代缴服务已取消',
        eventTypes: ['CANCELLED'],
        event: cancelEvent,
        state: 'cancelled',
      },
    ];
  }

  const currentIndex = orderProgressIndex(order.status);
  const endIndex = order.status === 'CLOSED' ? ORDER_PROGRESS_STEPS.length - 1 : ORDER_PROGRESS_STEPS.length - 2;
  return ORDER_PROGRESS_STEPS.slice(0, endIndex + 1).map((step, index) => ({
    ...step,
    event: orderStepEvent(step, events),
    state: index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'pending',
  }));
}

function reconcileStatusLabel(value?: string): string {
  const status = String(value || '').trim().toUpperCase();
  if (!status) return '待确认';
  if (status === 'PENDING') return '待核对';
  if (status === 'MATCHED') return '已匹配';
  if (status === 'MISMATCHED') return '不一致';
  return '待确认';
}

function urgencyLabel(value?: MaintenanceUrgency): string {
  if (value === 'OVERDUE') return '已逾期';
  if (value === 'DUE_SOON') return '7天内到期';
  if (value === 'UPCOMING') return '30天内到期';
  if (value === 'SETTLED') return '已结清';
  if (value === 'NORMAL') return '正常';
  return '待确认';
}

function urgencyClass(value?: MaintenanceUrgency): string {
  if (value === 'OVERDUE') return 'is-overdue';
  if (value === 'DUE_SOON') return 'is-soon';
  if (value === 'UPCOMING') return 'is-upcoming';
  if (value === 'SETTLED') return 'is-settled';
  return 'is-normal';
}

function formatFen(value?: number): string {
  if (value === undefined || value === null || !Number.isFinite(Number(value))) return '待确认';
  return `¥${((Number(value) || 0) / 100).toFixed(2)}`;
}

function formatOrderAmount(order: PatentMaintenanceOrder): string {
  if (Number(order.totalAmountFen) > 0) return formatFen(order.totalAmountFen);
  if (order.status === 'REQUESTED' || order.status === 'QUOTED') return '待客服报价';
  return formatFen(order.totalAmountFen);
}

function orderAmountLabel(status?: PatentMaintenanceOrderStatus): string {
  if (status === 'AWAITING_PAYMENT') return '待付款合计';
  if (status === 'PAID' || status === 'EXECUTING' || status === 'RECEIPT_UPLOADED' || status === 'RECONCILED' || status === 'CLOSED') {
    return '已确认金额';
  }
  return '费用合计';
}

function orderFeeBreakdownItems(order: PatentMaintenanceOrder): Array<{ label: string; value: string }> {
  if (Number(order.totalAmountFen) <= 0) return [];
  const items = [
    { label: '官方年费', value: Number(order.officialFeeFen) || 0 },
    { label: '滞纳/宽限费用', value: Number(order.lateFeeFen) || 0 },
    { label: '平台服务费', value: Number(order.serviceFeeFen) || 0 },
  ];
  return items.filter((item) => item.value > 0).map((item) => ({ label: item.label, value: formatFen(item.value) }));
}

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function deriveSummaryFromLoadedItems(
  scheduleItems: PatentMaintenanceSchedule[],
  orderItems: PatentMaintenanceOrder[],
): MaintenanceSummary {
  const today = new Date();
  const dueSoonEnd = new Date(today);
  dueSoonEnd.setDate(dueSoonEnd.getDate() + 7);
  const todayKey = localDateKey(today);
  const dueSoonEndKey = localDateKey(dueSoonEnd);
  const activeScheduleStatuses = new Set<PatentMaintenanceStatus>(['DUE', 'OVERDUE']);

  return {
    overdue: scheduleItems.filter((item) => activeScheduleStatuses.has(item.status) && String(item.dueDate || '') < todayKey).length,
    dueSoon: scheduleItems.filter((item) => {
      const dueDate = String(item.dueDate || '');
      return activeScheduleStatuses.has(item.status) && dueDate >= todayKey && dueDate <= dueSoonEndKey;
    }).length,
    activeOrders: orderItems.filter((item) => ACTIVE_ORDER_STATUSES.has(item.status)).length,
    historyOrders: orderItems.filter((item) => HISTORY_ORDER_STATUSES.has(item.status)).length,
  };
}

function displayText(value: unknown, fallback = '待确认'): string {
  return normalizeDisplayText(value) || fallback;
}

function resolveMaintenanceTitle(title: unknown, applicationNoDisplay?: string | null): string {
  return normalizeDisplayText(title) || normalizeDisplayText(applicationNoDisplay) || '专利信息待确认';
}

function timelineActorText(actorDisplayName?: string | null, actorNickname?: string): string {
  return normalizeDisplayText(actorDisplayName) || normalizeDisplayText(actorNickname) || '平台服务';
}

function shouldCreateOrderButtonShow(schedule: PatentMaintenanceSchedule): boolean {
  return schedule.status === 'DUE' || schedule.status === 'OVERDUE';
}

function scheduleGroupKey(item: PatentMaintenanceSchedule): string {
  return item.patentId || normalizeDisplayText(item.applicationNoDisplay) || item.id;
}

function normalizeRouteTab(value?: string | null): MaintenanceTab | undefined {
  const tab = String(value || '').trim();
  if (tab === 'schedules' || tab === 'due') return 'schedules';
  if (tab === 'progress' || tab === 'tasks' || tab === 'processing') return 'progress';
  if (tab === 'history' || tab === 'orders' || tab === 'records') return 'history';
  return undefined;
}

export default function MaintenancePage() {
  const routeOrderId = useRouteUuidParam('orderId') || '';
  const routePatentId = useRouteUuidParam('patentId') || '';
  const routeTab = useRouteStringParam('tab');
  const loadedOnceRef = useRef(false);
  const focusedOrderIdRef = useRef(routeOrderId);
  const timelineRequestOrderIdRef = useRef('');
  const conversationRequestOrderIdRef = useRef('');
  const createOrderSeqRef = useRef(0);
  const pageVisibleRef = useRef(true);

  const [tab, setTab] = useState<MaintenanceTab>(() => normalizeRouteTab(routeTab) || 'schedules');
  const [scheduleFilter, setScheduleFilter] = useState<ScheduleFilter>('');
  const [progressFilter, setProgressFilter] = useState<OrderFilter>('');
  const [historyFilter, setHistoryFilter] = useState<OrderFilter>('');
  const [flowGuideOpen, setFlowGuideOpen] = useState(false);

  const [openingConversationOrderId, setOpeningConversationOrderId] = useState('');
  const [creatingOrderScheduleId, setCreatingOrderScheduleId] = useState('');
  const [expandedTimelineOrderId, setExpandedTimelineOrderId] = useState('');
  const [loadingTimelineOrderId, setLoadingTimelineOrderId] = useState('');
  const [orderEventsById, setOrderEventsById] = useState<Record<string, PatentMaintenanceOrderEvent[]>>({});
  const [summary, setSummary] = useState<MaintenanceSummary>({
    overdue: 0,
    dueSoon: 0,
    activeOrders: 0,
    historyOrders: 0,
  });

  useDidShow(() => {
    pageVisibleRef.current = true;
  });

  useDidHide(() => {
    pageVisibleRef.current = false;
    conversationRequestOrderIdRef.current = '';
    createOrderSeqRef.current += 1;
    setOpeningConversationOrderId('');
    setCreatingOrderScheduleId('');
  });

  const access = usePageAccess('approved-required', (next) => {
    if (next.state !== 'ok') {
      loadedOnceRef.current = false;
      setOpeningConversationOrderId('');
      setCreatingOrderScheduleId('');
      setExpandedTimelineOrderId('');
      setLoadingTimelineOrderId('');
      setOrderEventsById({});
      return;
    }
    if (loadedOnceRef.current) {
      void refreshAll();
    }
  });

  const scheduleFetcher = useCallback(
    async ({ page, pageSize }: { page: number; pageSize: number }) =>
      await apiGet<Paged<PatentMaintenanceSchedule>>('/me/patent-maintenance/schedules', {
        page,
        pageSize,
        ...(routePatentId ? { patentId: routePatentId } : {}),
      }),
    [routePatentId],
  );

  const orderFetcher = useCallback(
    async ({ page, pageSize }: { page: number; pageSize: number }) =>
      await apiGet<Paged<PatentMaintenanceOrder>>('/me/patent-maintenance/orders', {
        page,
        pageSize,
      }),
    [],
  );

  const schedules = usePagedList<PatentMaintenanceSchedule>(scheduleFetcher, {
    pageSize: 20,
    onError: (msg, ctx) => {
      if (ctx === 'loadMore') toast(msg);
    },
  });

  const orders = usePagedList<PatentMaintenanceOrder>(orderFetcher, {
    pageSize: 20,
    onError: (msg, ctx) => {
      if (ctx === 'loadMore') toast(msg);
    },
  });

  const reloadAll = useCallback(async () => {
    await Promise.all([schedules.reload(), orders.reload()]);
  }, [orders.reload, schedules.reload]);

  const refreshAll = useCallback(async () => {
    await Promise.all([schedules.refresh(), orders.refresh()]);
  }, [orders.refresh, schedules.refresh]);

  useEffect(() => {
    if (access.state !== 'ok') return;
    loadedOnceRef.current = true;
    void reloadAll();
  }, [access.state, reloadAll]);

  useEffect(() => {
    if (access.state !== 'ok') return;
    if (routePatentId) return;
    setSummary(deriveSummaryFromLoadedItems(schedules.items, orders.items));
  }, [access.state, orders.items, routePatentId, schedules.items]);

  useEffect(() => {
    if (!routeOrderId || access.state !== 'ok') return;
    focusedOrderIdRef.current = routeOrderId;
    setTab('progress');
  }, [access.state, routeOrderId]);

  const openOrderConversation = useCallback(async (orderId: string) => {
    if (!orderId || openingConversationOrderId) return;
    conversationRequestOrderIdRef.current = orderId;
    setOpeningConversationOrderId(orderId);
    try {
      const conversation = await apiPost<Conversation>(
        `/patent-maintenance/orders/${orderId}/conversations`,
        {},
        { idempotencyKey: `maintenance-conversation-${orderId}-${Date.now()}` },
      );
      if (conversationRequestOrderIdRef.current !== orderId || !pageVisibleRef.current) return;
      Taro.navigateTo({ url: `/subpackages/messages/chat/index?conversationId=${conversation.id}` });
    } catch (e: any) {
      if (conversationRequestOrderIdRef.current !== orderId || !pageVisibleRef.current) return;
      toast(e?.message || '打开会话失败');
    } finally {
      if (conversationRequestOrderIdRef.current !== orderId || !pageVisibleRef.current) return;
      setOpeningConversationOrderId('');
    }
  }, [openingConversationOrderId]);

  const createOrderFromSchedule = useCallback(async (scheduleId: string) => {
    if (!scheduleId || creatingOrderScheduleId) return;
    const requestSeq = ++createOrderSeqRef.current;
    setCreatingOrderScheduleId(scheduleId);
    try {
      const order = await apiPost<PatentMaintenanceOrder>(
        '/me/patent-maintenance/orders',
        { scheduleId },
        { idempotencyKey: `maintenance-order-${scheduleId}-${Date.now()}` },
      );
      if (createOrderSeqRef.current !== requestSeq || !pageVisibleRef.current) return;
      toast('代缴申请已提交');
      setTab('progress');
      await orders.reload();
      if (createOrderSeqRef.current !== requestSeq || !pageVisibleRef.current) return;
      await openOrderConversation(order.id);
    } catch (e: any) {
      if (createOrderSeqRef.current !== requestSeq || !pageVisibleRef.current) return;
      toast(e?.message || '申请代缴失败');
    } finally {
      if (createOrderSeqRef.current !== requestSeq || !pageVisibleRef.current) return;
      setCreatingOrderScheduleId('');
    }
  }, [creatingOrderScheduleId, openOrderConversation, orders.reload]);

  const toggleOrderTimeline = useCallback(async (orderId: string) => {
    if (!orderId) return;
    if (expandedTimelineOrderId === orderId) {
      setExpandedTimelineOrderId('');
      setLoadingTimelineOrderId('');
      return;
    }

    setExpandedTimelineOrderId(orderId);

    if (orderEventsById[orderId]) return;
    timelineRequestOrderIdRef.current = orderId;
    setLoadingTimelineOrderId(orderId);
    try {
      const res = await apiGet<{ items: PatentMaintenanceOrderEvent[] }>(`/me/patent-maintenance/orders/${orderId}/events`);
      if (timelineRequestOrderIdRef.current !== orderId) return;
      setOrderEventsById((prev) => ({ ...prev, [orderId]: res?.items || [] }));
    } catch (e: any) {
      if (timelineRequestOrderIdRef.current !== orderId) return;
      toast(e?.message || '加载办理进度失败');
    } finally {
      if (timelineRequestOrderIdRef.current !== orderId) return;
      setLoadingTimelineOrderId('');
    }
  }, [expandedTimelineOrderId, orderEventsById]);

  useEffect(() => {
    const handleCreated = (payload?: { orderId?: string }) => {
      focusedOrderIdRef.current = payload?.orderId || '';
      setTab('progress');
      setProgressFilter('');
      setHistoryFilter('');
      void refreshAll();
    };

    Taro.eventCenter.on(MAINTENANCE_REQUEST_CREATED_EVENT, handleCreated);
    return () => {
      Taro.eventCenter.off(MAINTENANCE_REQUEST_CREATED_EVENT, handleCreated);
    };
  }, [refreshAll]);

  useEffect(() => {
    const focusedOrderId = focusedOrderIdRef.current;
    if (!focusedOrderId) return;
    const targetOrder = orders.items.find((item) => item.id === focusedOrderId);
    if (!targetOrder) return;
    const nextTab: MaintenanceTab = HISTORY_ORDER_STATUSES.has(targetOrder.status) ? 'history' : 'progress';
    if (tab !== nextTab) setTab(nextTab);
    if (expandedTimelineOrderId !== focusedOrderId) {
      void toggleOrderTimeline(focusedOrderId);
    }
    focusedOrderIdRef.current = '';
  }, [expandedTimelineOrderId, orders.items, tab, toggleOrderTimeline]);

  const refreshing = schedules.refreshing || orders.refreshing;

  const activeOrderItems = useMemo(
    () => orders.items.filter((item) => ACTIVE_ORDER_STATUSES.has(item.status) && (!progressFilter || item.status === progressFilter)),
    [orders.items, progressFilter],
  );

  const historyOrderItems = useMemo(
    () => orders.items.filter((item) => HISTORY_ORDER_STATUSES.has(item.status) && (!historyFilter || item.status === historyFilter)),
    [historyFilter, orders.items],
  );

  const openOrderByScheduleId = useMemo(() => {
    const result = new Map<string, PatentMaintenanceOrder>();
    for (const item of orders.items) {
      if (!ACTIVE_ORDER_STATUSES.has(item.status)) continue;
      if (!item.scheduleId || result.has(item.scheduleId)) continue;
      result.set(item.scheduleId, item);
    }
    return result;
  }, [orders.items]);

  const filteredScheduleItems = useMemo(() => {
    if (!scheduleFilter) return schedules.items;
    return schedules.items.filter((item) => item.status === scheduleFilter);
  }, [scheduleFilter, schedules.items]);

  const scheduleGroups = useMemo<PatentMaintenanceScheduleGroup[]>(() => {
    const groups: PatentMaintenanceScheduleGroup[] = [];
    const groupByKey = new Map<string, PatentMaintenanceScheduleGroup>();
    for (const item of filteredScheduleItems) {
      const key = scheduleGroupKey(item);
      let group = groupByKey.get(key);
      if (!group) {
        group = {
          key,
          patentTitle: item.patentTitle,
          applicationNoDisplay: item.applicationNoDisplay,
          items: [],
        };
        groupByKey.set(key, group);
        groups.push(group);
      }
      group.items.push(item);
      if (!group.patentTitle && item.patentTitle) group.patentTitle = item.patentTitle;
      if (!group.applicationNoDisplay && item.applicationNoDisplay) group.applicationNoDisplay = item.applicationNoDisplay;
    }
    return groups.map((group) => ({
      ...group,
      items: [...group.items].sort((a, b) => {
        const dueCompare = String(a.dueDate || '').localeCompare(String(b.dueDate || ''));
        if (dueCompare !== 0) return dueCompare;
        return a.yearNo - b.yearNo;
      }),
    }));
  }, [filteredScheduleItems]);

  const renderOrderCard = (item: PatentMaintenanceOrder) => {
    const isTimelineOpen = expandedTimelineOrderId === item.id;
    const timelineLoading = loadingTimelineOrderId === item.id;
    const timelineItems = orderEventsById[item.id] || [];
    const timelineSteps = orderProgressSteps(item, timelineItems);
    const isAwaitingOfflinePayment = item.status === 'AWAITING_PAYMENT';
    const feeBreakdownItems = orderFeeBreakdownItems(item);
    return (
      <Surface key={item.id} className="maintenance-card">
        <View className="maintenance-card-head">
          <Text className="maintenance-card-title clamp-2">
            {resolveMaintenanceTitle(item.patentTitle, item.applicationNoDisplay)}
          </Text>
          <Text className={`maintenance-status maintenance-order-status is-${String(item.status).toLowerCase()}`}>
            {orderStatusLabel(item.status)}
          </Text>
        </View>

        <View className="maintenance-row">
          <Text className="maintenance-label">申请号</Text>
          <Text className="maintenance-value">{displayText(item.applicationNoDisplay)}</Text>
        </View>
        <View className="maintenance-row">
          <Text className="maintenance-label">办理进度</Text>
          <Text className="maintenance-value">
            {HISTORY_ORDER_STATUSES.has(item.status) ? '该代缴服务已归档，可查看完整办理过程' : '已生成服务记录，可继续跟进沟通与处理结果'}
          </Text>
        </View>
        <View className="maintenance-row">
          <Text className="maintenance-label">缴费年度</Text>
          <Text className="maintenance-value">
            {typeof item.scheduleYearNo === 'number' ? `第${item.scheduleYearNo}年` : '待确认'}
          </Text>
        </View>
        <View className="maintenance-row">
          <Text className="maintenance-label">到期日</Text>
          <Text className="maintenance-value">{displayText(item.scheduleDueDate)}</Text>
        </View>
        <View className="maintenance-row">
          <Text className="maintenance-label">{orderAmountLabel(item.status)}</Text>
          <Text className="maintenance-value">{formatOrderAmount(item)}</Text>
        </View>
        {feeBreakdownItems.length ? (
          <View className="maintenance-fee-breakdown">
            {feeBreakdownItems.map((fee) => (
              <View key={fee.label} className="maintenance-fee-row">
                <Text className="maintenance-fee-label">{fee.label}</Text>
                <Text className="maintenance-fee-value">{fee.value}</Text>
              </View>
            ))}
          </View>
        ) : null}
        <View className="maintenance-row">
          <Text className="maintenance-label">付款截止</Text>
          <Text className="maintenance-value">
            {item.paymentDeadline ? formatTimeSmart(item.paymentDeadline) : '待确认'}
          </Text>
        </View>
        <View className="maintenance-row">
          <Text className="maintenance-label">核对状态</Text>
          <Text className="maintenance-value">{reconcileStatusLabel(item.reconcileStatus)}</Text>
        </View>

        {isAwaitingOfflinePayment ? (
          <View className="maintenance-payment-note">
            <Text>
              客服会联系你确认付款方式；也可主动联系客服。平台确认到账后，状态会更新为“已确认到账”并开始办理。
            </Text>
          </View>
        ) : null}

        <View className="maintenance-foot">
          <View className="maintenance-outline-btn" onClick={() => void toggleOrderTimeline(item.id)}>
            <Text>{isTimelineOpen ? '收起进度' : '查看进度'}</Text>
          </View>
          {item.canContactSupport ? (
            <View
              className={`maintenance-contact-btn ${openingConversationOrderId === item.id ? 'is-loading' : ''}`}
              onClick={() => {
                if (openingConversationOrderId === item.id) return;
                void openOrderConversation(item.id);
              }}
            >
              <Text>
                {openingConversationOrderId === item.id
                  ? '打开中'
                  : isAwaitingOfflinePayment
                    ? '联系客服付款'
                    : '联系客服'}
              </Text>
            </View>
          ) : null}
        </View>

        {isTimelineOpen ? (
          <View className="maintenance-timeline">
            {timelineLoading ? (
              <Text className="maintenance-timeline-empty">加载办理进度中...</Text>
            ) : timelineSteps.length ? (
              timelineSteps.map((step, index) => {
                const event = step.event;
                const eventNote = timelineNoteText(event?.note);
                return (
                  <View
                    key={`${item.id}-${step.status}-${index}`}
                    className={`maintenance-timeline-step is-${step.state} ${index === timelineSteps.length - 1 ? 'is-last' : ''}`}
                  >
                    <View className="maintenance-timeline-rail">
                      <View className="maintenance-timeline-dot" />
                      {index === timelineSteps.length - 1 ? null : <View className="maintenance-timeline-line" />}
                    </View>
                    <View className="maintenance-timeline-content">
                      <View className="maintenance-timeline-head">
                        <Text className="maintenance-timeline-title">{step.title}</Text>
                        <Text className="maintenance-timeline-status">
                          {step.state === 'pending' ? '未开始' : step.state === 'current' ? '当前' : '已完成'}
                        </Text>
                      </View>
                      <Text className="maintenance-timeline-desc">{eventNote || step.desc}</Text>
                      {event ? (
                        <Text className="maintenance-timeline-meta">
                          {orderEventTypeLabel(event.eventType)} ·{' '}
                          {timelineActorText(event.actorDisplayName, event.actorNickname)} ·{' '}
                          {formatTimeSmart(event.createdAt)}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                );
              })
            ) : (
              <Text className="maintenance-timeline-empty">暂无办理进度</Text>
            )}
          </View>
        ) : null}
      </Surface>
    );
  };

  return (
    <PullToRefresh type="primary" disabled={refreshing} onRefresh={refreshAll}>
      <View className="container maintenance-page">
        <PageHeader
          title="专利年费代缴"
          subtitle="这里处理的是缴给专利局、用于维持专利有效的官方年费"
        />
        <Spacer />

        {access.state !== 'ok' ? (
          <AccessGate access={access} />
        ) : (
          <>
            <Surface className="maintenance-direct-card">
              <View className="maintenance-direct-head">
                <View className="maintenance-direct-main">
                  <Text className="maintenance-apply-kicker">未展示专利也可申请</Text>
                  <Text className="maintenance-direct-title">添加专利申请年费代缴</Text>
                  <Text className="maintenance-direct-desc">
                    仅用于后台核验和年费代缴服务，不会发布到市场，也不会公开展示或售卖。
                  </Text>
                </View>
                <View
                  className="maintenance-direct-btn"
                  onClick={() => {
                    Taro.navigateTo({ url: '/subpackages/maintenance-apply/index' });
                  }}
                >
                  <Text>添加专利</Text>
                </View>
              </View>
            </Surface>

            <View className={`maintenance-flow-guide ${flowGuideOpen ? 'is-open' : ''}`}>
              <View className="maintenance-flow-guide-toggle" onClick={() => setFlowGuideOpen((next) => !next)}>
                <View className="maintenance-flow-guide-title-wrap">
                  <Text className="maintenance-flow-guide-icon">i</Text>
                  <Text className="maintenance-flow-guide-title">流程说明</Text>
                </View>
                <Text className="maintenance-flow-guide-arrow">{flowGuideOpen ? '⌄' : '›'}</Text>
              </View>
              {flowGuideOpen ? (
                <View className="maintenance-flow-guide-body">
                  <Text>
                    这里按“待缴年费 → 提交申请 → 代缴进度 → 历史记录”展示。年费不是平台售卖服务费，是专利为保持有效需要缴给官方机构的费用。同一专利可能有多个年度要处理；选择具体年度申请代缴后，会生成服务记录并可在代缴进度中继续跟进。
                  </Text>
                </View>
              ) : null}
            </View>

            <Spacer size={12} />

            <View className="maintenance-summary-grid">
              <Surface className="maintenance-summary-card">
                <Text className="maintenance-summary-label">逾期年费</Text>
                <Text className="maintenance-summary-value is-danger">{summary.overdue}</Text>
              </Surface>
              <Surface className="maintenance-summary-card">
                <Text className="maintenance-summary-label">7天内到期</Text>
                <Text className="maintenance-summary-value is-warn">{summary.dueSoon}</Text>
              </Surface>
              <Surface className="maintenance-summary-card">
                <Text className="maintenance-summary-label">进行中申请</Text>
                <Text className="maintenance-summary-value">{summary.activeOrders}</Text>
              </Surface>
              <Surface className="maintenance-summary-card">
                <Text className="maintenance-summary-label">历史记录</Text>
                <Text className="maintenance-summary-value">{summary.historyOrders}</Text>
              </Surface>
            </View>

            <Spacer size={12} />

            <View className="maintenance-content-panel">
              <View className="maintenance-tabs">
                <View className={`maintenance-tab ${tab === 'schedules' ? 'is-active' : ''}`} onClick={() => setTab('schedules')}>
                  <Text>待缴年费</Text>
                </View>
                <View className={`maintenance-tab ${tab === 'progress' ? 'is-active' : ''}`} onClick={() => setTab('progress')}>
                  <Text>代缴进度</Text>
                </View>
                <View className={`maintenance-tab ${tab === 'history' ? 'is-active' : ''}`} onClick={() => setTab('history')}>
                  <Text>历史记录</Text>
                </View>
              </View>

              {tab === 'schedules' ? (
                <>
                <View className="maintenance-filter-card maintenance-schedule-filter-card">
                  <View className="maintenance-filter-head">
                    <Text className="maintenance-filter-title">年度筛选</Text>
                    <Text
                      className="maintenance-filter-info"
                      onClick={() => {
                        Taro.showModal({
                          title: '年度筛选说明',
                          content: '这里按具体年费年度筛选。同一专利可能同时包含待缴、逾期、已缴等不同年度状态。',
                          showCancel: false,
                          confirmText: '知道了',
                        });
                      }}
                    >
                      i
                    </Text>
                    <Text className="maintenance-filter-desc">按具体年费年度筛选，同一专利可能同时包含多个状态</Text>
                  </View>
                  <View className="maintenance-filter-pills">
                    {SCHEDULE_FILTER_OPTIONS.map((option) => (
                      <View
                        key={option.value || 'all'}
                        className={`maintenance-filter-pill ${scheduleFilter === option.value ? 'is-active' : ''}`}
                        onClick={() => setScheduleFilter(option.value)}
                      >
                        <Text>{option.label}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                <Spacer size={12} />

                {schedules.loading && schedules.items.length === 0 ? (
                  <LoadingCard text="加载待缴年费中..." />
                ) : schedules.error ? (
                  <ErrorCard message={schedules.error} onRetry={() => void schedules.reload()} />
                ) : schedules.items.length === 0 ? (
                  <EmptyCard title="暂无待缴年费" message="当前暂无需要处理的专利年费。" />
                ) : filteredScheduleItems.length === 0 ? (
                  <EmptyCard title="暂无匹配年度" message="当前没有符合该状态的年费年度。" />
                ) : (
                  <View className="maintenance-list">
                    {scheduleGroups.map((group) => (
                      <Surface key={group.key} className="maintenance-card">
                        <View className="maintenance-card-head">
                          <Text className="maintenance-card-title clamp-2">
                            {resolveMaintenanceTitle(group.patentTitle, group.applicationNoDisplay)}
                          </Text>
                          <Text className="maintenance-year-count">{group.items.length}个年度</Text>
                        </View>
                        <View className="maintenance-row">
                          <Text className="maintenance-label">申请号</Text>
                          <Text className="maintenance-value">{displayText(group.applicationNoDisplay)}</Text>
                        </View>
                        <View className="maintenance-year-summary">
                          {scheduleStatusSummary(group.items).map((summary) => (
                            <Text
                              key={summary.status}
                              className={`maintenance-status maintenance-status-summary ${scheduleStatusClass(summary.status)}`}
                            >
                              {scheduleStatusLabel(summary.status)} {summary.count}
                            </Text>
                          ))}
                        </View>

                        <View className="maintenance-year-list">
                          {group.items.map((item) => {
                            const openOrder = openOrderByScheduleId.get(item.id);
                            return (
                            <View key={item.id} className="maintenance-year-item">
                              <View className="maintenance-year-head">
                                <Text className="maintenance-year-title">第{item.yearNo}年年费</Text>
                                <Text className={`maintenance-status ${scheduleStatusClass(item.status)}`}>
                                  {scheduleStatusText(item)}
                                </Text>
                              </View>
                              <View className="maintenance-row maintenance-year-meta maintenance-year-due">
                                <Text className="maintenance-label">到期日</Text>
                                <Text className="maintenance-value">{item.dueDate}</Text>
                              </View>
                              <View className="maintenance-row maintenance-year-meta maintenance-year-grace">
                                <Text className="maintenance-label">宽限截止</Text>
                                <Text className="maintenance-value">{displayText(item.gracePeriodEnd)}</Text>
                              </View>
                              {scheduleActionHint(item) ? (
                                <Text className="maintenance-year-hint">{scheduleActionHint(item)}</Text>
                              ) : null}
                              <View className="maintenance-foot">
                                <Text className={`maintenance-urgency ${urgencyClass(item.urgency)}`}>
                                  {urgencyLabel(item.urgency)}
                                </Text>
                                {openOrder ? (
                                  <View
                                    className="maintenance-apply-btn"
                                    onClick={() => {
                                      setProgressFilter('');
                                      setTab('progress');
                                      if (expandedTimelineOrderId !== openOrder.id) {
                                        void toggleOrderTimeline(openOrder.id);
                                      }
                                    }}
                                  >
                                    <Text>查看进度</Text>
                                  </View>
                                ) : shouldCreateOrderButtonShow(item) ? (
                                  <View
                                    className={`maintenance-apply-btn ${creatingOrderScheduleId === item.id ? 'is-loading' : ''}`}
                                    onClick={() => {
                                      if (creatingOrderScheduleId === item.id) return;
                                      void createOrderFromSchedule(item.id);
                                    }}
                                  >
                                    <Text>{creatingOrderScheduleId === item.id ? '提交中' : scheduleActionText(item)}</Text>
                                  </View>
                                ) : null}
                              </View>
                            </View>
                          );
                          })}
                        </View>
                      </Surface>
                    ))}
                    <ListFooter
                      loadingMore={schedules.loadingMore}
                      hasMore={schedules.hasMore}
                      onLoadMore={() => void schedules.loadMore()}
                    />
                  </View>
                )}
                </>
              ) : null}

              {tab === 'progress' ? (
                <>
                {routeOrderId ? (
                  <>
                    <TipBanner tone="info" title="会话上下文">
                      当前展示的是本次会话关联的代缴进度
                      <Text
                        className="maintenance-link"
                        onClick={() => {
                          Taro.redirectTo({ url: '/subpackages/maintenance/index?tab=progress' });
                        }}
                      >
                        查看全部进度
                      </Text>
                    </TipBanner>
                    <Spacer size={10} />
                  </>
                ) : null}
                <View className="maintenance-filter-card maintenance-schedule-filter-card">
                  <View className="maintenance-filter-head">
                    <Text className="maintenance-filter-title">进度筛选</Text>
                    <Text
                      className="maintenance-filter-info"
                      onClick={() => {
                        Taro.showModal({
                          title: '进度筛选说明',
                          content: '这里展示已经提交但尚未归档的代缴申请。客服报价、付款确认、官方办理、回执上传和核对都会在这里更新。',
                          showCancel: false,
                          confirmText: '知道了',
                        });
                      }}
                    >
                      i
                    </Text>
                  </View>
                  <View className="maintenance-filter-pills maintenance-filter-pills-dense">
                    {PROGRESS_FILTER_OPTIONS.map((option) => (
                      <View
                        key={option.value || 'all'}
                        className={`maintenance-filter-pill ${progressFilter === option.value ? 'is-active' : ''}`}
                        onClick={() => setProgressFilter(option.value)}
                      >
                        <Text>{option.label}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                <Spacer size={12} />

                {orders.loading && orders.items.length === 0 ? (
                  <LoadingCard text="加载代缴进度中..." />
                ) : orders.error ? (
                  <ErrorCard message={orders.error} onRetry={() => void orders.reload()} />
                ) : activeOrderItems.length === 0 ? (
                  <EmptyCard
                    title="暂无代缴进度"
                    message="请先从待缴年费中申请代缴；已完成或已取消的服务会进入历史记录。"
                  />
                ) : (
                  <View className="maintenance-list">
                    {activeOrderItems.map((item) => renderOrderCard(item))}

                    <ListFooter loadingMore={orders.loadingMore} hasMore={orders.hasMore} onLoadMore={() => void orders.loadMore()} />
                  </View>
                )}
                </>
              ) : null}

              {tab === 'history' ? (
                <>
                <View className="maintenance-filter-card maintenance-schedule-filter-card">
                  <View className="maintenance-filter-head">
                    <Text className="maintenance-filter-title">记录筛选</Text>
                    <Text
                      className="maintenance-filter-info"
                      onClick={() => {
                        Taro.showModal({
                          title: '历史记录说明',
                          content: '这里展示已经完成或取消的代缴服务。仍可展开查看完整办理进度和状态更新时间。',
                          showCancel: false,
                          confirmText: '知道了',
                        });
                      }}
                    >
                      i
                    </Text>
                  </View>
                  <View className="maintenance-filter-pills">
                    {HISTORY_FILTER_OPTIONS.map((option) => (
                      <View
                        key={option.value || 'all'}
                        className={`maintenance-filter-pill ${historyFilter === option.value ? 'is-active' : ''}`}
                        onClick={() => setHistoryFilter(option.value)}
                      >
                        <Text>{option.label}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                <Spacer size={12} />

                {orders.loading && orders.items.length === 0 ? (
                  <LoadingCard text="加载历史记录中..." />
                ) : orders.error ? (
                  <ErrorCard message={orders.error} onRetry={() => void orders.reload()} />
                ) : historyOrderItems.length === 0 ? (
                  <EmptyCard
                    title="暂无历史记录"
                    message="已完成或已取消的代缴服务会保存在这里。"
                  />
                ) : (
                  <View className="maintenance-list">
                    {historyOrderItems.map((item) => renderOrderCard(item))}

                    <ListFooter loadingMore={orders.loadingMore} hasMore={orders.hasMore} onLoadMore={() => void orders.loadMore()} />
                  </View>
                )}
                </>
              ) : null}
            </View>
          </>
        )}
      </View>
    </PullToRefresh>
  );
}
