import { Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './index.scss';

import { apiGet, apiPost } from '../../lib/api';
import { usePageAccess } from '../../lib/guard';
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

type ScheduleFilter = '' | PatentMaintenanceStatus;
type TaskFilter = '' | PatentMaintenanceTaskStatus;
type OrderFilter = '' | PatentMaintenanceOrderStatus;

const SCHEDULE_FILTER_OPTIONS: Array<{ value: ScheduleFilter; label: string }> = [
  { value: '', label: 'All schedules' },
  { value: 'DUE', label: 'Due' },
  { value: 'OVERDUE', label: 'Overdue' },
  { value: 'PAID', label: 'Paid' },
  { value: 'WAIVED', label: 'Waived' },
];

const TASK_FILTER_OPTIONS: Array<{ value: TaskFilter; label: string }> = [
  { value: '', label: 'All tasks' },
  { value: 'OPEN', label: 'Open' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'DONE', label: 'Done' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const ORDER_FILTER_OPTIONS: Array<{ value: OrderFilter; label: string }> = [
  { value: '', label: 'All orders' },
  { value: 'REQUESTED', label: 'Requested' },
  { value: 'AWAITING_PAYMENT', label: 'Awaiting payment' },
  { value: 'PAID', label: 'Paid' },
  { value: 'EXECUTING', label: 'Executing' },
  { value: 'RECEIPT_UPLOADED', label: 'Receipt uploaded' },
  { value: 'RECONCILED', label: 'Reconciled' },
  { value: 'CLOSED', label: 'Closed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

function scheduleStatusLabel(status?: PatentMaintenanceStatus): string {
  if (status === 'DUE') return 'Due';
  if (status === 'PAID') return 'Paid';
  if (status === 'OVERDUE') return 'Overdue';
  if (status === 'WAIVED') return 'Waived';
  return '-';
}

function taskStatusLabel(status?: PatentMaintenanceTaskStatus): string {
  if (status === 'OPEN') return 'Open';
  if (status === 'IN_PROGRESS') return 'In progress';
  if (status === 'DONE') return 'Done';
  if (status === 'CANCELLED') return 'Cancelled';
  return '-';
}

function orderStatusLabel(status?: PatentMaintenanceOrderStatus): string {
  if (!status) return '-';
  const option = ORDER_FILTER_OPTIONS.find((it) => it.value === status);
  return option?.label || status;
}

function urgencyLabel(value?: MaintenanceUrgency): string {
  if (value === 'OVERDUE') return 'Overdue';
  if (value === 'DUE_SOON') return 'Due in 7 days';
  if (value === 'UPCOMING') return 'Due in 30 days';
  if (value === 'SETTLED') return 'Settled';
  if (value === 'NORMAL') return 'Normal';
  return '-';
}

function urgencyClass(value?: MaintenanceUrgency): string {
  if (value === 'OVERDUE') return 'is-overdue';
  if (value === 'DUE_SOON') return 'is-soon';
  if (value === 'UPCOMING') return 'is-upcoming';
  if (value === 'SETTLED') return 'is-settled';
  return 'is-normal';
}

function formatFen(value?: number): string {
  return `¥${((Number(value) || 0) / 100).toFixed(2)}`;
}

function shouldCreateOrderButtonShow(schedule: PatentMaintenanceSchedule): boolean {
  return schedule.status === 'DUE' || schedule.status === 'OVERDUE';
}

export default function MaintenancePage() {
  const loadedOnceRef = useRef(false);
  const scheduleFilterMountedRef = useRef(false);
  const taskFilterMountedRef = useRef(false);
  const orderFilterMountedRef = useRef(false);

  const [tab, setTab] = useState<'schedules' | 'tasks' | 'orders'>('orders');
  const [scheduleFilter, setScheduleFilter] = useState<ScheduleFilter>('');
  const [taskFilter, setTaskFilter] = useState<TaskFilter>('');
  const [orderFilter, setOrderFilter] = useState<OrderFilter>('');

  const [openingConversationOrderId, setOpeningConversationOrderId] = useState('');
  const [creatingOrderScheduleId, setCreatingOrderScheduleId] = useState('');
  const [expandedTimelineOrderId, setExpandedTimelineOrderId] = useState('');
  const [loadingTimelineOrderId, setLoadingTimelineOrderId] = useState('');
  const [orderEventsById, setOrderEventsById] = useState<Record<string, PatentMaintenanceOrderEvent[]>>({});

  const access = usePageAccess('approved-required', (next) => {
    if (next.state !== 'ok') {
      loadedOnceRef.current = false;
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
        ...(orderFilter ? { status: orderFilter } : {}),
      }),
    [orderFilter],
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

  const reloadAll = useCallback(async () => {
    await Promise.all([schedules.reload(), tasks.reload(), orders.reload()]);
  }, [orders.reload, schedules.reload, tasks.reload]);

  const refreshAll = useCallback(async () => {
    await Promise.all([schedules.refresh(), tasks.refresh(), orders.refresh()]);
  }, [orders.refresh, schedules.refresh, tasks.refresh]);

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

  const openOrderConversation = useCallback(async (orderId: string) => {
    if (!orderId || openingConversationOrderId) return;
    setOpeningConversationOrderId(orderId);
    try {
      const conversation = await apiPost<Conversation>(
        `/patent-maintenance/orders/${orderId}/conversations`,
        {},
        { idempotencyKey: `maintenance-conversation-${orderId}-${Date.now()}` },
      );
      Taro.navigateTo({ url: `/subpackages/messages/chat/index?conversationId=${conversation.id}` });
    } catch (e: any) {
      toast(e?.message || 'Failed to open maintenance conversation');
    } finally {
      setOpeningConversationOrderId('');
    }
  }, [openingConversationOrderId]);

  const createOrderFromSchedule = useCallback(async (scheduleId: string) => {
    if (!scheduleId || creatingOrderScheduleId) return;
    setCreatingOrderScheduleId(scheduleId);
    try {
      const order = await apiPost<PatentMaintenanceOrder>(
        '/me/patent-maintenance/orders',
        { scheduleId },
        { idempotencyKey: `maintenance-order-${scheduleId}-${Date.now()}` },
      );
      toast('Maintenance order created');
      setTab('orders');
      await orders.reload();
      await openOrderConversation(order.id);
    } catch (e: any) {
      toast(e?.message || 'Failed to create maintenance order');
    } finally {
      setCreatingOrderScheduleId('');
    }
  }, [creatingOrderScheduleId, openOrderConversation, orders.reload]);

  const toggleOrderTimeline = useCallback(async (orderId: string) => {
    if (!orderId) return;
    if (expandedTimelineOrderId === orderId) {
      setExpandedTimelineOrderId('');
      return;
    }

    setExpandedTimelineOrderId(orderId);

    if (orderEventsById[orderId]) return;
    setLoadingTimelineOrderId(orderId);
    try {
      const res = await apiGet<{ items: PatentMaintenanceOrderEvent[] }>(`/me/patent-maintenance/orders/${orderId}/events`);
      setOrderEventsById((prev) => ({ ...prev, [orderId]: res?.items || [] }));
    } catch (e: any) {
      toast(e?.message || 'Failed to load order timeline');
    } finally {
      setLoadingTimelineOrderId('');
    }
  }, [expandedTimelineOrderId, orderEventsById]);

  const summary = useMemo(() => {
    const overdue = schedules.items.filter((it) => it.urgency === 'OVERDUE').length;
    const dueSoon = schedules.items.filter((it) => it.urgency === 'DUE_SOON').length;
    const openTasks = tasks.items.filter((it) => it.status === 'OPEN' || it.status === 'IN_PROGRESS').length;
    const openOrders = orders.items.filter((it) => it.status !== 'CLOSED' && it.status !== 'CANCELLED').length;
    return { overdue, dueSoon, openTasks, openOrders };
  }, [orders.items, schedules.items, tasks.items]);

  const refreshing = schedules.refreshing || tasks.refreshing || orders.refreshing;

  return (
    <PullToRefresh type="primary" disabled={refreshing} onRefresh={refreshAll}>
      <View className="container maintenance-page">
        <PageHeader
          title="Patent Maintenance"
          subtitle="Manage annual-fee schedules, execution tasks, and service orders in one place"
        />
        <Spacer />

        {access.state !== 'ok' ? (
          <AccessGate access={access} />
        ) : (
          <>
            <TipBanner tone="info" title="Workflow rule">
              Start support conversations from maintenance orders to keep a single continuous history for payment,
              execution, receipt, and reconciliation.
            </TipBanner>

            <Spacer size={12} />

            <View className="maintenance-summary-grid">
              <Surface className="maintenance-summary-card">
                <Text className="maintenance-summary-label">Overdue schedules</Text>
                <Text className="maintenance-summary-value is-danger">{summary.overdue}</Text>
              </Surface>
              <Surface className="maintenance-summary-card">
                <Text className="maintenance-summary-label">Due in 7 days</Text>
                <Text className="maintenance-summary-value is-warn">{summary.dueSoon}</Text>
              </Surface>
              <Surface className="maintenance-summary-card">
                <Text className="maintenance-summary-label">Open tasks</Text>
                <Text className="maintenance-summary-value">{summary.openTasks}</Text>
              </Surface>
              <Surface className="maintenance-summary-card">
                <Text className="maintenance-summary-label">Open orders</Text>
                <Text className="maintenance-summary-value">{summary.openOrders}</Text>
              </Surface>
            </View>

            <Spacer size={12} />

            <View className="maintenance-tabs">
              <View className={`maintenance-tab ${tab === 'schedules' ? 'is-active' : ''}`} onClick={() => setTab('schedules')}>
                <Text>Schedules</Text>
              </View>
              <View className={`maintenance-tab ${tab === 'tasks' ? 'is-active' : ''}`} onClick={() => setTab('tasks')}>
                <Text>Tasks</Text>
              </View>
              <View className={`maintenance-tab ${tab === 'orders' ? 'is-active' : ''}`} onClick={() => setTab('orders')}>
                <Text>Orders</Text>
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
                  <LoadingCard text="Loading schedules..." />
                ) : schedules.error ? (
                  <ErrorCard message={schedules.error} onRetry={() => void schedules.reload()} />
                ) : schedules.items.length === 0 ? (
                  <EmptyCard title="No schedules" message="No maintenance schedules found for your claimed patents." />
                ) : (
                  <View className="maintenance-list">
                    {schedules.items.map((item) => (
                      <Surface key={item.id} className="maintenance-card">
                        <View className="maintenance-card-head">
                          <Text className="maintenance-card-title clamp-2">{item.patentTitle || item.patentId}</Text>
                          <Text className="maintenance-status">{scheduleStatusLabel(item.status)}</Text>
                        </View>
                        <View className="maintenance-row">
                          <Text className="maintenance-label">Application No</Text>
                          <Text className="maintenance-value">{item.applicationNoDisplay || '-'}</Text>
                        </View>
                        <View className="maintenance-row">
                          <Text className="maintenance-label">Fee Year</Text>
                          <Text className="maintenance-value">Year {item.yearNo}</Text>
                        </View>
                        <View className="maintenance-row">
                          <Text className="maintenance-label">Due Date</Text>
                          <Text className="maintenance-value">{item.dueDate}</Text>
                        </View>
                        <View className="maintenance-row">
                          <Text className="maintenance-label">Grace End</Text>
                          <Text className="maintenance-value">{item.gracePeriodEnd || '-'}</Text>
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
                              Create Order
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
                  <LoadingCard text="Loading tasks..." />
                ) : tasks.error ? (
                  <ErrorCard message={tasks.error} onRetry={() => void tasks.reload()} />
                ) : tasks.items.length === 0 ? (
                  <EmptyCard title="No tasks" message="No maintenance task is assigned right now." />
                ) : (
                  <View className="maintenance-list">
                    {tasks.items.map((item) => (
                      <Surface key={item.id} className="maintenance-card">
                        <View className="maintenance-card-head">
                          <Text className="maintenance-card-title clamp-2">{item.patentTitle || item.patentId || item.scheduleId}</Text>
                          <Text className="maintenance-status">{taskStatusLabel(item.status)}</Text>
                        </View>
                        <View className="maintenance-row">
                          <Text className="maintenance-label">Application No</Text>
                          <Text className="maintenance-value">{item.applicationNoDisplay || '-'}</Text>
                        </View>
                        <View className="maintenance-row">
                          <Text className="maintenance-label">Related Year</Text>
                          <Text className="maintenance-value">{item.scheduleYearNo ? `Year ${item.scheduleYearNo}` : '-'}</Text>
                        </View>
                        <View className="maintenance-row">
                          <Text className="maintenance-label">Schedule Due</Text>
                          <Text className="maintenance-value">{item.scheduleDueDate || '-'}</Text>
                        </View>
                        <View className="maintenance-row">
                          <Text className="maintenance-label">Task Note</Text>
                          <Text className="maintenance-value">{item.note || '-'}</Text>
                        </View>
                        <View className="maintenance-foot">
                          <Text className={`maintenance-urgency ${urgencyClass(item.urgency)}`}>{urgencyLabel(item.urgency)}</Text>
                          <Button variant="ghost" size="small" block={false} onClick={() => setTab('orders')}>
                            View Orders
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
                <Surface className="maintenance-filter-card" padding="sm">
                  <CategoryControl value={orderFilter} options={ORDER_FILTER_OPTIONS} onChange={setOrderFilter} />
                </Surface>

                <Spacer size={12} />

                {orders.loading && orders.items.length === 0 ? (
                  <LoadingCard text="Loading orders..." />
                ) : orders.error ? (
                  <ErrorCard message={orders.error} onRetry={() => void orders.reload()} />
                ) : orders.items.length === 0 ? (
                  <EmptyCard
                    title="No maintenance orders"
                    message="Create an order from schedules first, then keep communication in order conversation."
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
                            <Text className="maintenance-card-title clamp-2">{item.patentTitle || item.scheduleId}</Text>
                            <Text className="maintenance-status">{orderStatusLabel(item.status)}</Text>
                          </View>

                          <View className="maintenance-row">
                            <Text className="maintenance-label">Application No</Text>
                            <Text className="maintenance-value">{item.applicationNoDisplay || '-'}</Text>
                          </View>
                          <View className="maintenance-row">
                            <Text className="maintenance-label">Order ID</Text>
                            <Text className="maintenance-value">{item.id}</Text>
                          </View>
                          <View className="maintenance-row">
                            <Text className="maintenance-label">Fee Year</Text>
                            <Text className="maintenance-value">{item.scheduleYearNo ? `Year ${item.scheduleYearNo}` : '-'}</Text>
                          </View>
                          <View className="maintenance-row">
                            <Text className="maintenance-label">Due Date</Text>
                            <Text className="maintenance-value">{item.scheduleDueDate || '-'}</Text>
                          </View>
                          <View className="maintenance-row">
                            <Text className="maintenance-label">Amount</Text>
                            <Text className="maintenance-value">{formatFen(item.totalAmountFen)}</Text>
                          </View>
                          <View className="maintenance-row">
                            <Text className="maintenance-label">Payment Deadline</Text>
                            <Text className="maintenance-value">{item.paymentDeadline || '-'}</Text>
                          </View>
                          <View className="maintenance-row">
                            <Text className="maintenance-label">Reconcile</Text>
                            <Text className="maintenance-value">{item.reconcileStatus || '-'}</Text>
                          </View>

                          <View className="maintenance-foot">
                            <Button variant="ghost" size="small" block={false} onClick={() => void toggleOrderTimeline(item.id)}>
                              {isTimelineOpen ? 'Hide Timeline' : 'View Timeline'}
                            </Button>
                            {item.canContactSupport ? (
                              <Button
                                variant="primary"
                                size="small"
                                block={false}
                                loading={openingConversationOrderId === item.id}
                                onClick={() => void openOrderConversation(item.id)}
                              >
                                Contact Support
                              </Button>
                            ) : null}
                          </View>

                          {isTimelineOpen ? (
                            <View className="maintenance-timeline">
                              {timelineLoading ? (
                                <Text className="maintenance-timeline-empty">Loading timeline...</Text>
                              ) : timelineItems.length ? (
                                timelineItems.map((event) => (
                                  <View key={event.id} className="maintenance-timeline-item">
                                    <Text className="maintenance-timeline-title">
                                      {event.fromStatus ? `${event.fromStatus} -> ${event.toStatus}` : event.toStatus}
                                    </Text>
                                    <Text className="maintenance-timeline-meta">
                                      {event.eventType} · {event.actorNickname || event.actorUserId || 'System'} · {event.createdAt}
                                    </Text>
                                    {event.note ? <Text className="maintenance-timeline-note">{event.note}</Text> : null}
                                  </View>
                                ))
                              ) : (
                                <Text className="maintenance-timeline-empty">No timeline records</Text>
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
