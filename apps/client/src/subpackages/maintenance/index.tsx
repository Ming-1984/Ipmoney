import { Text, View } from '@tarojs/components';
import Taro, { useDidHide, useDidShow } from '@tarojs/taro';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import './index.scss';

import { apiGet, apiPost } from '../../lib/api';
import { normalizeDisplayText } from '../../lib/displayText';
import { formatTimeSmart } from '../../lib/format';
import { usePageAccess } from '../../lib/guard';
import { useRouteStringParam, useRouteUuidParam } from '../../lib/routeParams';
import { usePagedList } from '../../lib/usePagedList';
import { CategoryControl } from '../../ui/filters/TabsControl';
import { ListFooter } from '../../ui/ListFooter';
import { AccessGate } from '../../ui/PageState';
import { PageHeader, Spacer, Surface, TipBanner } from '../../ui/layout';
import { Button, PullToRefresh, toast } from '../../ui/nutui';
import { EmptyCard, ErrorCard, LoadingCard } from '../../ui/StateCards';

type PatentMaintenanceStatus = 'DUE' | 'PAID' | 'OVERDUE' | 'WAIVED';
type PatentMaintenanceTaskStatus = 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
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

type PatentMaintenanceTask = {
  id: string;
  scheduleId: string;
  assignedCsUserId?: string | null;
  status: PatentMaintenanceTaskStatus;
  note?: string | null;
  evidenceFileId?: string | null;
  createdAt: string;
  updatedAt?: string;
  patentId?: string;
  patentTitle?: string;
  applicationNoDisplay?: string;
  scheduleYearNo?: number;
  scheduleDueDate?: string;
  scheduleStatus?: PatentMaintenanceStatus;
  urgency?: MaintenanceUrgency;
  canContactSupport?: boolean;
};

type PatentMaintenanceOrder = {
  id: string;
  scheduleId: string;
  applicantUserId: string;
  assignedCsUserId?: string | null;
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
  openTasks: number;
  openOrders: number;
};

type ScheduleFilter = '' | PatentMaintenanceStatus;
type TaskFilter = '' | PatentMaintenanceTaskStatus;
type OrderFilter = '' | PatentMaintenanceOrderStatus;

const SCHEDULE_FILTER_OPTIONS: Array<{ value: ScheduleFilter; label: string }> = [
  { value: '', label: '全部计划' },
  { value: 'DUE', label: '待缴费' },
  { value: 'OVERDUE', label: '已逾期' },
  { value: 'PAID', label: '已缴费' },
  { value: 'WAIVED', label: '已豁免' },
];

const TASK_FILTER_OPTIONS: Array<{ value: TaskFilter; label: string }> = [
  { value: '', label: '全部任务' },
  { value: 'OPEN', label: '待处理' },
  { value: 'IN_PROGRESS', label: '处理中' },
  { value: 'DONE', label: '已完成' },
  { value: 'CANCELLED', label: '已取消' },
];

const ORDER_FILTER_OPTIONS: Array<{ value: OrderFilter; label: string }> = [
  { value: '', label: '全部订单' },
  { value: 'REQUESTED', label: '已创建' },
  { value: 'AWAITING_PAYMENT', label: '待支付' },
  { value: 'PAID', label: '已支付' },
  { value: 'EXECUTING', label: '执行中' },
  { value: 'RECEIPT_UPLOADED', label: '回执已上传' },
  { value: 'RECONCILED', label: '已对账' },
  { value: 'CLOSED', label: '已关闭' },
  { value: 'CANCELLED', label: '已取消' },
];

function scheduleStatusLabel(status?: PatentMaintenanceStatus): string {
  if (status === 'DUE') return '待缴费';
  if (status === 'PAID') return '已缴费';
  if (status === 'OVERDUE') return '已逾期';
  if (status === 'WAIVED') return '已豁免';
  return '待确认';
}

function taskStatusLabel(status?: PatentMaintenanceTaskStatus): string {
  if (status === 'OPEN') return '待处理';
  if (status === 'IN_PROGRESS') return '处理中';
  if (status === 'DONE') return '已完成';
  if (status === 'CANCELLED') return '已取消';
  return '待确认';
}

function orderStatusLabel(status?: PatentMaintenanceOrderStatus): string {
  if (!status) return '待确认';
  const option = ORDER_FILTER_OPTIONS.find((it) => it.value === status);
  return option?.label || '状态待确认';
}

function orderStatusText(status?: string): string {
  if (!status) return '待确认';
  return orderStatusLabel(status as PatentMaintenanceOrderStatus);
}

function orderEventTypeLabel(value?: string): string {
  const type = String(value || '').trim().toUpperCase();
  if (!type) return '状态更新';
  if (type === 'CREATED') return '已创建';
  if (type === 'QUOTE_UPDATED') return '报价已更新';
  if (type === 'PAYMENT_CONFIRMED') return '已确认支付';
  if (type === 'EXECUTION_SUBMITTED') return '已提交办理';
  if (type === 'RECEIPT_UPLOADED') return '已上传回执';
  if (type === 'RECONCILED') return '已完成对账';
  if (type === 'CLOSED') return '已关闭';
  if (type === 'CANCELLED') return '已取消';
  return '状态更新';
}

function reconcileStatusLabel(value?: string): string {
  const status = String(value || '').trim().toUpperCase();
  if (!status) return '待确认';
  if (status === 'PENDING') return '待对账';
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

function displayText(value: unknown, fallback = '待补充'): string {
  return normalizeDisplayText(value) || fallback;
}

function shouldCreateOrderButtonShow(schedule: PatentMaintenanceSchedule): boolean {
  return schedule.status === 'DUE' || schedule.status === 'OVERDUE';
}

export default function MaintenancePage() {
  const routeOrderId = useRouteUuidParam('orderId') || '';
  const routeTab = useRouteStringParam('tab');
  const loadedOnceRef = useRef(false);
  const scheduleFilterMountedRef = useRef(false);
  const taskFilterMountedRef = useRef(false);
  const orderFilterMountedRef = useRef(false);
  const scheduleFilterKeyRef = useRef('');
  const taskFilterKeyRef = useRef('');
  const orderRouteKeyRef = useRef('');
  const timelineRequestOrderIdRef = useRef('');
  const conversationRequestOrderIdRef = useRef('');
  const createOrderSeqRef = useRef(0);
  const pageVisibleRef = useRef(true);

  const [tab, setTab] = useState<'schedules' | 'tasks' | 'orders'>(() => {
    if (routeTab === 'schedules' || routeTab === 'tasks' || routeTab === 'orders') return routeTab;
    return 'orders';
  });
  const [scheduleFilter, setScheduleFilter] = useState<ScheduleFilter>('');
  const [taskFilter, setTaskFilter] = useState<TaskFilter>('');
  const [orderFilter, setOrderFilter] = useState<OrderFilter>('');

  const [openingConversationOrderId, setOpeningConversationOrderId] = useState('');
  const [creatingOrderScheduleId, setCreatingOrderScheduleId] = useState('');
  const [expandedTimelineOrderId, setExpandedTimelineOrderId] = useState('');
  const [loadingTimelineOrderId, setLoadingTimelineOrderId] = useState('');
  const [orderEventsById, setOrderEventsById] = useState<Record<string, PatentMaintenanceOrderEvent[]>>({});
  const [summary, setSummary] = useState<MaintenanceSummary>({
    overdue: 0,
    dueSoon: 0,
    openTasks: 0,
    openOrders: 0,
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
        ...(scheduleFilter ? { status: scheduleFilter } : {}),
      }),
    [scheduleFilter],
  );

  const taskFetcher = useCallback(
    async ({ page, pageSize }: { page: number; pageSize: number }) =>
      await apiGet<Paged<PatentMaintenanceTask>>('/me/patent-maintenance/tasks', {
        page,
        pageSize,
        ...(taskFilter ? { status: taskFilter } : {}),
      }),
    [taskFilter],
  );

  const orderFetcher = useCallback(
    async ({ page, pageSize }: { page: number; pageSize: number }) =>
      await apiGet<Paged<PatentMaintenanceOrder>>('/me/patent-maintenance/orders', {
        page,
        pageSize,
        ...(routeOrderId ? { orderId: routeOrderId } : {}),
        ...(orderFilter ? { status: orderFilter } : {}),
      }),
    [orderFilter, routeOrderId],
  );

  const schedules = usePagedList<PatentMaintenanceSchedule>(scheduleFetcher, {
    pageSize: 20,
    onError: (msg, ctx) => {
      if (ctx === 'loadMore') toast(msg);
    },
  });

  const tasks = usePagedList<PatentMaintenanceTask>(taskFetcher, {
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

  const loadSummary = useCallback(async () => {
    const next = await apiGet<MaintenanceSummary>('/me/patent-maintenance/summary');
    setSummary({
      overdue: Number(next?.overdue) || 0,
      dueSoon: Number(next?.dueSoon) || 0,
      openTasks: Number(next?.openTasks) || 0,
      openOrders: Number(next?.openOrders) || 0,
    });
  }, []);

  const reloadAll = useCallback(async () => {
    await Promise.all([schedules.reload(), tasks.reload(), orders.reload(), loadSummary()]);
  }, [loadSummary, orders.reload, schedules.reload, tasks.reload]);

  const refreshAll = useCallback(async () => {
    await Promise.all([schedules.refresh(), tasks.refresh(), orders.refresh(), loadSummary()]);
  }, [loadSummary, orders.refresh, schedules.refresh, tasks.refresh]);

  useEffect(() => {
    if (access.state !== 'ok') return;
    loadedOnceRef.current = true;
    void reloadAll();
  }, [access.state, reloadAll]);

  useEffect(() => {
    if (access.state !== 'ok') return;
    if (!scheduleFilterMountedRef.current) {
      scheduleFilterMountedRef.current = true;
      return;
    }
    void schedules.reload();
  }, [access.state, scheduleFilter, schedules.reload]);

  useEffect(() => {
    if (access.state !== 'ok') return;
    if (!taskFilterMountedRef.current) {
      taskFilterMountedRef.current = true;
      return;
    }
    void tasks.reload();
  }, [access.state, taskFilter, tasks.reload]);

  useEffect(() => {
    if (access.state !== 'ok') return;
    if (!orderFilterMountedRef.current) {
      orderFilterMountedRef.current = true;
      return;
    }
    void orders.reload();
  }, [access.state, orderFilter, orders.reload]);

  useEffect(() => {
    const nextKey = scheduleFilter;
    if (scheduleFilterKeyRef.current === nextKey) return;
    scheduleFilterKeyRef.current = nextKey;
    schedules.reset();
  }, [scheduleFilter, schedules.reset]);

  useEffect(() => {
    const nextKey = taskFilter;
    if (taskFilterKeyRef.current === nextKey) return;
    taskFilterKeyRef.current = nextKey;
    tasks.reset();
  }, [taskFilter, tasks.reset]);

  useEffect(() => {
    const nextKey = `${routeOrderId}:${orderFilter}`;
    if (orderRouteKeyRef.current === nextKey) return;
    orderRouteKeyRef.current = nextKey;
    setExpandedTimelineOrderId('');
    setLoadingTimelineOrderId('');
    setOrderEventsById({});
    orders.reset();
  }, [orderFilter, orders.reset, routeOrderId]);

  useEffect(() => {
    if (!routeOrderId) return;
    if (tab !== 'orders') setTab('orders');
  }, [routeOrderId, tab]);

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
      toast('年费托管订单已创建');
      setTab('orders');
      await orders.reload();
      if (createOrderSeqRef.current !== requestSeq || !pageVisibleRef.current) return;
      await openOrderConversation(order.id);
    } catch (e: any) {
      if (createOrderSeqRef.current !== requestSeq || !pageVisibleRef.current) return;
      toast(e?.message || '创建订单失败');
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
      toast(e?.message || '加载时间线失败');
    } finally {
      if (timelineRequestOrderIdRef.current !== orderId) return;
      setLoadingTimelineOrderId('');
    }
  }, [expandedTimelineOrderId, orderEventsById]);

  const refreshing = schedules.refreshing || tasks.refreshing || orders.refreshing;

  return (
    <PullToRefresh type="primary" disabled={refreshing} onRefresh={refreshAll}>
      <View className="container maintenance-page">
        <PageHeader
          title="年费托管"
          subtitle="统一管理年费计划、执行任务与服务订单"
        />
        <Spacer />

        {access.state !== 'ok' ? (
          <AccessGate access={access} />
        ) : (
          <>
            <TipBanner tone="info" title="流程说明">
              建议从托管订单发起咨询，确保支付、执行、回执与对账记录在同一会话中连续留痕。
            </TipBanner>

            <Spacer size={12} />

            <View className="maintenance-summary-grid">
              <Surface className="maintenance-summary-card">
                <Text className="maintenance-summary-label">逾期计划</Text>
                <Text className="maintenance-summary-value is-danger">{summary.overdue}</Text>
              </Surface>
              <Surface className="maintenance-summary-card">
                <Text className="maintenance-summary-label">7天内到期</Text>
                <Text className="maintenance-summary-value is-warn">{summary.dueSoon}</Text>
              </Surface>
              <Surface className="maintenance-summary-card">
                <Text className="maintenance-summary-label">待办任务</Text>
                <Text className="maintenance-summary-value">{summary.openTasks}</Text>
              </Surface>
              <Surface className="maintenance-summary-card">
                <Text className="maintenance-summary-label">未关闭订单</Text>
                <Text className="maintenance-summary-value">{summary.openOrders}</Text>
              </Surface>
            </View>

            <Spacer size={12} />

            <View className="maintenance-tabs">
              <View className={`maintenance-tab ${tab === 'schedules' ? 'is-active' : ''}`} onClick={() => setTab('schedules')}>
                <Text>缴费计划</Text>
              </View>
              <View className={`maintenance-tab ${tab === 'tasks' ? 'is-active' : ''}`} onClick={() => setTab('tasks')}>
                <Text>执行任务</Text>
              </View>
              <View className={`maintenance-tab ${tab === 'orders' ? 'is-active' : ''}`} onClick={() => setTab('orders')}>
                <Text>托管订单</Text>
              </View>
            </View>

            <Spacer size={10} />

            {tab === 'schedules' ? (
              <>
                <Surface className="maintenance-filter-card" padding="sm">
                  <CategoryControl value={scheduleFilter} options={SCHEDULE_FILTER_OPTIONS} onChange={setScheduleFilter} />
                </Surface>

                <Spacer size={12} />

                {schedules.loading && schedules.items.length === 0 ? (
                  <LoadingCard text="加载缴费计划中..." />
                ) : schedules.error ? (
                  <ErrorCard message={schedules.error} onRetry={() => void schedules.reload()} />
                ) : schedules.items.length === 0 ? (
                  <EmptyCard title="暂无缴费计划" message="当前暂无可处理的年费缴费计划。" />
                ) : (
                  <View className="maintenance-list">
                    {schedules.items.map((item) => (
                      <Surface key={item.id} className="maintenance-card">
                        <View className="maintenance-card-head">
                          <Text className="maintenance-card-title clamp-2">
                            {displayText(item.patentTitle, '') || displayText(item.patentId)}
                          </Text>
                          <Text className="maintenance-status">{scheduleStatusLabel(item.status)}</Text>
                        </View>
                        <View className="maintenance-row">
                          <Text className="maintenance-label">申请号</Text>
                          <Text className="maintenance-value">{displayText(item.applicationNoDisplay)}</Text>
                        </View>
                        <View className="maintenance-row">
                          <Text className="maintenance-label">缴费年度</Text>
                          <Text className="maintenance-value">第{item.yearNo}年</Text>
                        </View>
                        <View className="maintenance-row">
                          <Text className="maintenance-label">到期日</Text>
                          <Text className="maintenance-value">{item.dueDate}</Text>
                        </View>
                        <View className="maintenance-row">
                          <Text className="maintenance-label">宽限截止</Text>
                          <Text className="maintenance-value">{displayText(item.gracePeriodEnd)}</Text>
                        </View>
                        <View className="maintenance-foot">
                          <Text className={`maintenance-urgency ${urgencyClass(item.urgency)}`}>{urgencyLabel(item.urgency)}</Text>
                          {shouldCreateOrderButtonShow(item) ? (
                            <Button
                              variant="primary"
                              size="small"
                              block={false}
                              loading={creatingOrderScheduleId === item.id}
                              onClick={() => void createOrderFromSchedule(item.id)}
                            >
                              创建订单
                            </Button>
                          ) : null}
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

            {tab === 'tasks' ? (
              <>
                <Surface className="maintenance-filter-card" padding="sm">
                  <CategoryControl value={taskFilter} options={TASK_FILTER_OPTIONS} onChange={setTaskFilter} />
                </Surface>

                <Spacer size={12} />

                {tasks.loading && tasks.items.length === 0 ? (
                  <LoadingCard text="加载任务中..." />
                ) : tasks.error ? (
                  <ErrorCard message={tasks.error} onRetry={() => void tasks.reload()} />
                ) : tasks.items.length === 0 ? (
                  <EmptyCard title="暂无任务" message="当前暂无待处理的年费托管任务。" />
                ) : (
                  <View className="maintenance-list">
                    {tasks.items.map((item) => (
                      <Surface key={item.id} className="maintenance-card">
                        <View className="maintenance-card-head">
                          <Text className="maintenance-card-title clamp-2">
                            {displayText(item.patentTitle, '') || displayText(item.patentId, '') || displayText(item.scheduleId)}
                          </Text>
                          <Text className="maintenance-status">{taskStatusLabel(item.status)}</Text>
                        </View>
                        <View className="maintenance-row">
                          <Text className="maintenance-label">申请号</Text>
                          <Text className="maintenance-value">{displayText(item.applicationNoDisplay)}</Text>
                        </View>
                        <View className="maintenance-row">
                          <Text className="maintenance-label">关联年度</Text>
                          <Text className="maintenance-value">{item.scheduleYearNo ? `第${item.scheduleYearNo}年` : '待补充'}</Text>
                        </View>
                        <View className="maintenance-row">
                          <Text className="maintenance-label">计划到期</Text>
                          <Text className="maintenance-value">{displayText(item.scheduleDueDate)}</Text>
                        </View>
                        <View className="maintenance-row">
                          <Text className="maintenance-label">任务备注</Text>
                          <Text className="maintenance-value">{displayText(item.note)}</Text>
                        </View>
                        <View className="maintenance-foot">
                          <Text className={`maintenance-urgency ${urgencyClass(item.urgency)}`}>{urgencyLabel(item.urgency)}</Text>
                          <Button variant="ghost" size="small" block={false} onClick={() => setTab('orders')}>
                            查看订单
                          </Button>
                        </View>
                      </Surface>
                    ))}
                    <ListFooter loadingMore={tasks.loadingMore} hasMore={tasks.hasMore} onLoadMore={() => void tasks.loadMore()} />
                  </View>
                )}
              </>
            ) : null}

            {tab === 'orders' ? (
              <>
                {routeOrderId ? (
                  <>
                    <TipBanner tone="info" title="会话上下文">
                      当前展示会话关联订单：{routeOrderId.slice(0, 8)}…
                      <Text
                        className="maintenance-link"
                        onClick={() => {
                          Taro.redirectTo({ url: '/subpackages/maintenance/index?tab=orders' });
                        }}
                      >
                        查看全部订单
                      </Text>
                    </TipBanner>
                    <Spacer size={10} />
                  </>
                ) : null}
                <Surface className="maintenance-filter-card" padding="sm">
                  <CategoryControl value={orderFilter} options={ORDER_FILTER_OPTIONS} onChange={setOrderFilter} />
                </Surface>

                <Spacer size={12} />

                {orders.loading && orders.items.length === 0 ? (
                  <LoadingCard text="加载订单中..." />
                ) : orders.error ? (
                  <ErrorCard message={orders.error} onRetry={() => void orders.reload()} />
                ) : orders.items.length === 0 ? (
                  <EmptyCard
                    title="暂无托管订单"
                    message="请先从缴费计划创建订单，再在订单会话中保持沟通记录连续。"
                  />
                ) : (
                  <View className="maintenance-list">
                    {orders.items.map((item) => {
                      const isTimelineOpen = expandedTimelineOrderId === item.id;
                      const timelineLoading = loadingTimelineOrderId === item.id;
                      const timelineItems = orderEventsById[item.id] || [];
                      return (
                        <Surface key={item.id} className="maintenance-card">
                          <View className="maintenance-card-head">
                            <Text className="maintenance-card-title clamp-2">
                              {displayText(item.patentTitle, '') || displayText(item.scheduleId)}
                            </Text>
                            <Text className="maintenance-status">{orderStatusLabel(item.status)}</Text>
                          </View>

                          <View className="maintenance-row">
                            <Text className="maintenance-label">申请号</Text>
                            <Text className="maintenance-value">{displayText(item.applicationNoDisplay)}</Text>
                          </View>
                          <View className="maintenance-row">
                            <Text className="maintenance-label">订单号</Text>
                            <Text className="maintenance-value">{item.id}</Text>
                          </View>
                          <View className="maintenance-row">
                            <Text className="maintenance-label">缴费年度</Text>
                            <Text className="maintenance-value">
                              {typeof item.scheduleYearNo === 'number' ? `第${item.scheduleYearNo}年` : '待补充'}
                            </Text>
                          </View>
                          <View className="maintenance-row">
                            <Text className="maintenance-label">到期日</Text>
                            <Text className="maintenance-value">{displayText(item.scheduleDueDate)}</Text>
                          </View>
                          <View className="maintenance-row">
                            <Text className="maintenance-label">订单金额</Text>
                            <Text className="maintenance-value">{formatFen(item.totalAmountFen)}</Text>
                          </View>
                          <View className="maintenance-row">
                            <Text className="maintenance-label">支付截止</Text>
                            <Text className="maintenance-value">
                              {item.paymentDeadline ? formatTimeSmart(item.paymentDeadline) : '待确认'}
                            </Text>
                          </View>
                          <View className="maintenance-row">
                            <Text className="maintenance-label">对账状态</Text>
                            <Text className="maintenance-value">{reconcileStatusLabel(item.reconcileStatus)}</Text>
                          </View>

                          <View className="maintenance-foot">
                            <Button variant="ghost" size="small" block={false} onClick={() => void toggleOrderTimeline(item.id)}>
                              {isTimelineOpen ? '收起时间线' : '查看时间线'}
                            </Button>
                            {item.canContactSupport ? (
                              <Button
                                variant="primary"
                                size="small"
                                block={false}
                                loading={openingConversationOrderId === item.id}
                                onClick={() => void openOrderConversation(item.id)}
                              >
                                联系客服
                              </Button>
                            ) : null}
                          </View>

                          {isTimelineOpen ? (
                            <View className="maintenance-timeline">
                              {timelineLoading ? (
                                <Text className="maintenance-timeline-empty">加载时间线中...</Text>
                              ) : timelineItems.length ? (
                                timelineItems.map((event) => (
                                  <View key={event.id} className="maintenance-timeline-item">
                                    <Text className="maintenance-timeline-title">
                                      {event.fromStatus
                                        ? `${orderStatusText(event.fromStatus)} → ${orderStatusText(event.toStatus)}`
                                        : orderStatusText(event.toStatus)}
                                    </Text>
                                    <Text className="maintenance-timeline-meta">
                                      {orderEventTypeLabel(event.eventType)} ·{' '}
                                      {displayText(event.actorNickname, '') || displayText(event.actorUserId, '操作方待补充')} ·{' '}
                                      {formatTimeSmart(event.createdAt)}
                                    </Text>
                                    {normalizeDisplayText(event.note) ? (
                                      <Text className="maintenance-timeline-note">{normalizeDisplayText(event.note)}</Text>
                                    ) : null}
                                  </View>
                                ))
                              ) : (
                                <Text className="maintenance-timeline-empty">暂无时间线记录</Text>
                              )}
                            </View>
                          ) : null}
                        </Surface>
                      );
                    })}

                    <ListFooter loadingMore={orders.loadingMore} hasMore={orders.hasMore} onLoadMore={() => void orders.loadMore()} />
                  </View>
                )}
              </>
            ) : null}
          </>
        )}
      </View>
    </PullToRefresh>
  );
}
