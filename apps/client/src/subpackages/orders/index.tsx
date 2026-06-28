import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './index.scss';

import type { components } from '@ipmoney/api-types';

import { apiGet } from '../../lib/api';
import { displayInfoOrPlaceholder, displayTitleWithSecondary, normalizeDisplayText } from '../../lib/displayText';
import { usePagedList } from '../../lib/usePagedList';
import { goLogin, goOnboarding, usePageAccess } from '../../lib/guard';
import { formatTimeSmart } from '../../lib/format';
import { orderStatusLabel, orderStatusTagClass } from '../../lib/labels';
import { fenToYuan } from '../../lib/money';
import { useRouteStringParam } from '../../lib/routeParams';

import { AuditPendingCard, EmptyCard, ErrorCard, LoadingCard, PermissionCard } from '../../ui/StateCards';
import { ListFooter } from '../../ui/ListFooter';
import { PageHeader, Spacer, Surface } from '../../ui/layout';
import { Button, PullToRefresh, toast } from '../../ui/nutui';
import emptyOrders from '../../assets/illustrations/empty-orders.svg';

type PagedOrder = components['schemas']['PagedOrder'];
type Order = components['schemas']['Order'] & {
  listingTitle?: string | null;
  applicationNoDisplay?: string | null;
  buyerDisplayName?: string | null;
  sellerDisplayName?: string | null;
};
type OrderListRole = components['schemas']['OrderListRole'];
type OrderStatus = components['schemas']['OrderStatus'];

type OrderListTab = 'all' | 'pay' | 'progress' | 'refund' | 'done';
type OrderStatusGroup = 'PAYMENT_PENDING' | 'IN_PROGRESS' | 'REFUND' | 'DONE';
type OrderStatusFilter = OrderStatus | '';

function normalizeTab(input?: string | null): OrderListTab {
  const v = String(input || '').toLowerCase();
  if (v === 'pay' || v === 'progress' || v === 'refund' || v === 'done') return v;
  return 'all';
}

function groupByTab(tab: OrderListTab): OrderStatusGroup | null {
  if (tab === 'pay') return 'PAYMENT_PENDING';
  if (tab === 'progress') return 'IN_PROGRESS';
  if (tab === 'refund') return 'REFUND';
  if (tab === 'done') return 'DONE';
  return null;
}

const TABS: Array<{ id: OrderListTab; label: string }> = [
  { id: 'all', label: '全部' },
  { id: 'pay', label: '待付款' },
  { id: 'progress', label: '进行中' },
  { id: 'refund', label: '退款/售后' },
  { id: 'done', label: '已结束' },
];

type OrderCardAction = {
  label: string;
  variant: 'primary' | 'ghost';
  target: 'detail' | 'deposit' | 'final';
};

function shortOrderId(id?: string | null): string {
  const compact = String(id || '').replace(/-/g, '').trim().toUpperCase();
  if (!compact) return '待确认';
  return compact.slice(0, 8);
}

function counterpartyName(order: Order, asRole: OrderListRole): string {
  const raw = asRole === 'SELLER' ? order.buyerDisplayName : order.sellerDisplayName;
  return normalizeDisplayText(raw) || '待确认';
}

function orderProgressHint(order: Order): string {
  if (order.status === 'DEPOSIT_PENDING') return '等待支付订金';
  if (order.status === 'DEPOSIT_PAID') return '订金已支付，平台客服将介入跟单';
  if (order.status === 'WAIT_FINAL_PAYMENT') return '合同已确认，可支付尾款';
  if (order.status === 'FINAL_PAID_ESCROW') return '尾款已托管，等待权属变更';
  if (order.status === 'READY_TO_SETTLE') return '权属变更完成，等待结算放款';
  if (order.status === 'COMPLETED') return '订单已完成';
  if (order.status === 'CANCELLED') {
    if (order.dealAmountFen == null && order.finalAmountFen == null) return '订单已取消，交易金额尚未确认';
    return '订单已取消';
  }
  if (order.status === 'REFUNDING') return '退款处理中';
  if (order.status === 'REFUNDED') return '退款已完成';
  return '订单状态待确认';
}

function primaryOrderAction(order: Order): OrderCardAction {
  if (order.status === 'DEPOSIT_PENDING' && order.listingId) {
    return { label: '支付订金', variant: 'primary', target: 'deposit' };
  }
  if (order.status === 'WAIT_FINAL_PAYMENT') {
    return { label: '支付尾款', variant: 'primary', target: 'final' };
  }
  if (order.status === 'DEPOSIT_PAID' || order.status === 'FINAL_PAID_ESCROW' || order.status === 'READY_TO_SETTLE') {
    return { label: '查看跟单', variant: 'ghost', target: 'detail' };
  }
  if (order.status === 'REFUNDING' || order.status === 'REFUNDED') {
    return { label: '查看退款', variant: 'ghost', target: 'detail' };
  }
  return { label: '查看详情', variant: 'ghost', target: 'detail' };
}

export default function OrdersPage() {
  const loadedOnceRef = useRef(false);
  const filterKeyRef = useRef('');
  const routeRole = useRouteStringParam('role');
  const routeStatus = useRouteStringParam('status');
  const routeTab = useRouteStringParam('tab');
  const normalizeRole = useCallback((value?: string | null): OrderListRole => {
    if (value === 'SELLER') return 'SELLER';
    return 'BUYER';
  }, []);
  const normalizeStatus = useCallback((value?: string | null): OrderStatusFilter => {
    if (!value) return '';
    // Allow exact status filter via query param for compatibility with existing links.
    const allowed = [
      'DEPOSIT_PENDING',
      'DEPOSIT_PAID',
      'WAIT_FINAL_PAYMENT',
      'FINAL_PAID_ESCROW',
      'READY_TO_SETTLE',
      'COMPLETED',
      'REFUNDING',
      'REFUNDED',
      'CANCELLED',
    ];
    if (allowed.includes(value)) return value as OrderStatus;
    return '';
  }, []);

  const [asRole, setAsRole] = useState<OrderListRole>(() => normalizeRole(routeRole));
  const [tab, setTab] = useState<OrderListTab>(() => normalizeTab(routeTab));
  const [status, setStatus] = useState<OrderStatusFilter>(() => normalizeStatus(routeStatus));

  useEffect(() => {
    setAsRole(normalizeRole(routeRole));
  }, [normalizeRole, routeRole]);

  useEffect(() => {
    setStatus(normalizeStatus(routeStatus));
  }, [normalizeStatus, routeStatus]);

  useEffect(() => {
    setTab(normalizeTab(routeTab));
  }, [routeTab]);

  const statusFilterLabels = useMemo(() => {
    if (!status) return [];
    return [orderStatusLabel(status)];
  }, [status]);

  const goToTab = useCallback(
    (nextTab: OrderListTab) => {
      if (nextTab === tab) return;
      // Changing the group tab clears any exact status filter.
      setTab(nextTab);
      setStatus('');
    },
    [tab],
  );

  const fetcher = useCallback(
    async ({ page, pageSize }: { page: number; pageSize: number }) => {
      const group = !status ? groupByTab(tab) : null;
      return apiGet<PagedOrder>('/orders', {
        asRole,
        ...(status ? { status } : {}),
        ...(group ? { statusGroup: group } : {}),
        page,
        pageSize,
      });
    },
    [asRole, status, tab],
  );

  const { items, loading, error, refreshing, loadingMore, hasMore, reload, refresh, loadMore, reset } =
    usePagedList<Order>(fetcher, {
      pageSize: 20,
      onError: (message, ctx) => {
        if (ctx === 'loadMore') toast(message);
      },
    });

  const access = usePageAccess('approved-required', (a) => {
    if (a.state === 'ok') {
      if (loadedOnceRef.current) {
        void refresh();
      }
      return;
    }
    loadedOnceRef.current = false;
    reset();
  });

  useEffect(() => {
    const nextKey = `${asRole}:${status}:${tab}`;
    if (filterKeyRef.current === nextKey) return;
    filterKeyRef.current = nextKey;
    reset();
  }, [asRole, reset, status, tab]);

  useEffect(() => {
    if (access.state !== 'ok') return;
    loadedOnceRef.current = true;
    void reload();
  }, [access.state, asRole, reload, status, tab]);

  const showInitialLoading = loading && items.length === 0;
  const showBlockingError = Boolean(error && items.length === 0);
  const navigateToOrderDetail = useCallback((orderId: string) => {
    Taro.navigateTo({ url: `/subpackages/orders/detail/index?orderId=${orderId}` });
  }, []);

  const handleOrderAction = useCallback(
    (order: Order, action: OrderCardAction) => {
      if (action.target === 'deposit' && order.listingId) {
        Taro.navigateTo({ url: `/subpackages/checkout/deposit-pay/index?listingId=${order.listingId}` });
        return;
      }
      if (action.target === 'final') {
        Taro.navigateTo({ url: `/subpackages/checkout/final-pay/index?orderId=${order.id}` });
        return;
      }
      navigateToOrderDetail(order.id);
    },
    [navigateToOrderDetail],
  );

  if (access.state === 'need-login') {
    return (
      <View className="container orders-page">
        <PageHeader title="我的订单" subtitle="订金/尾款都在平台托管；可查看状态与发起退款申请" />
        <Spacer />
        <PermissionCard title="需要登录" message="登录后才能查看订单。" actionText="去登录" onAction={goLogin} />
      </View>
    );
  }
  if (access.state === 'need-onboarding') {
    return (
      <View className="container orders-page">
        <PageHeader title="我的订单" subtitle="订金/尾款都在平台托管；可查看状态与发起退款申请" />
        <Spacer />
        <PermissionCard title="需要选择身份" message="完成身份选择后才能继续。" actionText="去选择" onAction={goOnboarding} />
      </View>
    );
  }
  if (access.state === 'audit-pending') {
    return (
      <View className="container orders-page">
        <PageHeader title="我的订单" subtitle="订金/尾款都在平台托管；可查看状态与发起退款申请" />
        <Spacer />
        <AuditPendingCard title="资料审核中" message="审核通过后才能交易与查看订单。" actionText="查看进度" onAction={goOnboarding} />
      </View>
    );
  }
  if (access.state === 'audit-rejected') {
    return (
      <View className="container orders-page">
        <PageHeader title="我的订单" subtitle="订金/尾款都在平台托管；可查看状态与发起退款申请" />
        <Spacer />
        <AuditPendingCard title="资料已驳回" message="请重新提交资料，审核通过后才能继续。" actionText="重新提交" onAction={goOnboarding} />
      </View>
    );
  }
  if (access.state === 'audit-required') {
    return (
      <View className="container orders-page">
        <PageHeader title="我的订单" subtitle="订金/尾款都在平台托管；可查看状态与发起退款申请" />
        <Spacer />
        <AuditPendingCard title="需要认证" message="完成认证并审核通过后才能继续。" actionText="去认证" onAction={goOnboarding} />
      </View>
    );
  }

  return (
    <View className="container orders-page">
      <PageHeader title="我的订单" subtitle="订金/尾款都在平台托管；可查看状态与发起退款申请" />
      <Spacer />

      <View className="detail-tabs">
        <View className="detail-tabs-scroll">
          {TABS.map((t) => (
            <Text key={t.id} className={`detail-tab ${tab === t.id ? 'is-active' : ''}`} onClick={() => goToTab(t.id)}>
              {t.label}
            </Text>
          ))}
        </View>
      </View>

      {statusFilterLabels.length ? (
        <View className="search-toolbar-row search-toolbar-compact" style={{ marginTop: '8rpx' }}>
          <View className="search-selected-scroll">
            {statusFilterLabels.map((txt, idx) => (
              <View key={`${txt}-${idx}`} className="pill">
                <Text>{txt}</Text>
              </View>
            ))}
            <View
              className="pill pill-strong"
              onClick={() => {
                setStatus('');
              }}
            >
              <Text>清空</Text>
            </View>
          </View>
        </View>
      ) : null}

      <View style={{ height: '12rpx' }} />

      <PullToRefresh type="primary" disabled={showInitialLoading || refreshing} onRefresh={refresh}>
        {showInitialLoading ? (
          <LoadingCard />
        ) : showBlockingError ? (
          <ErrorCard message={error || undefined} onRetry={reload} />
        ) : items.length ? (
          <View>
            {loading ? (
              <>
                <Text className="muted">加载中…</Text>
                <View style={{ height: '8rpx' }} />
              </>
            ) : null}
            {items.map((it: Order) => (
              (() => {
                const title = displayTitleWithSecondary(it.listingTitle, '订单信息待确认', {
                  secondary: it.applicationNoDisplay,
                  secondaryPrefix: '专利申请号 ',
                });
                const applicationNo = normalizeDisplayText(it.applicationNoDisplay);
                const action = primaryOrderAction(it);
                return (
                  <Surface
                    key={it.id}
                    className="order-list-card"
                    style={{ marginBottom: '16rpx' }}
                    onClick={() => navigateToOrderDetail(it.id)}
                  >
                    <View className="row-between order-card-head">
                      <Text className="text-card-title clamp-1">{title}</Text>
                      <Text className={orderStatusTagClass(it.status)}>{orderStatusLabel(it.status)}</Text>
                    </View>

                    <View className="order-card-meta">
                      {applicationNo ? <Text>申请号：{displayInfoOrPlaceholder(applicationNo, '待确认')}</Text> : null}
                      {applicationNo ? <Text className="order-card-dot">·</Text> : null}
                      <Text>订单：{shortOrderId(it.id)}</Text>
                    </View>

                    <View className="order-card-amount">
                      <Text>成交总价：{it.dealAmountFen == null ? '待确认' : `¥${fenToYuan(it.dealAmountFen)}`}</Text>
                    </View>

                    <View className="order-card-money-row">
                      <Text>订金：¥{fenToYuan(it.depositAmountFen, { empty: '待确认' })}</Text>
                      <Text>尾款：{it.finalAmountFen == null ? '待确认' : `¥${fenToYuan(it.finalAmountFen)}`}</Text>
                    </View>

                    <Text className="muted">对方：{counterpartyName(it, asRole)}</Text>
                    <View style={{ height: '6rpx' }} />
                    <Text className="order-card-hint">{orderProgressHint(it)}</Text>
                    <View style={{ height: '6rpx' }} />
                    <Text className="muted">更新时间：{formatTimeSmart(it.updatedAt || it.createdAt)}</Text>

                    <View className="order-card-actions">
                      <Button
                        variant={action.variant}
                        size="small"
                        onClick={(event) => {
                          event?.stopPropagation?.();
                          handleOrderAction(it, action);
                        }}
                      >
                        {action.label}
                      </Button>
                      {action.label !== '查看详情' ? (
                        <Button
                          variant="ghost"
                          size="small"
                          onClick={(event) => {
                            event?.stopPropagation?.();
                            navigateToOrderDetail(it.id);
                          }}
                        >
                          查看详情
                        </Button>
                      ) : null}
                    </View>
                  </Surface>
                );
              })()
            ))}
          </View>
        ) : (
          <EmptyCard title="暂无订单" message="完成下单后订单会出现在这里。" actionText="刷新" onAction={reload} image={emptyOrders} />
        )}

        {!showInitialLoading && items.length ? (
          <ListFooter loadingMore={loadingMore} hasMore={hasMore} onLoadMore={loadMore} showNoMore />
        ) : null}
      </PullToRefresh>
    </View>
  );
}
