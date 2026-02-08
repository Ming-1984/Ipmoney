import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './index.scss';

import type { components } from '@ipmoney/api-types';

import { apiGet } from '../../lib/api';
import { goLogin, goOnboarding, usePageAccess } from '../../lib/guard';
import { formatTimeSmart } from '../../lib/format';
import { orderStatusLabel, orderStatusTagClass } from '../../lib/labels';
import { fenToYuan } from '../../lib/money';
import { useRouteStringParam } from '../../lib/routeParams';

import { AuditPendingCard, EmptyCard, ErrorCard, LoadingCard, PermissionCard } from '../../ui/StateCards';
import { PageHeader, Spacer, Surface } from '../../ui/layout';
import emptyOrders from '../../assets/illustrations/empty-orders.svg';

type PagedOrder = components['schemas']['PagedOrder'];
type Order = components['schemas']['Order'];
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

export default function OrdersPage() {
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PagedOrder | null>(null);

  useEffect(() => {
    if (routeRole) setAsRole(normalizeRole(routeRole));
  }, [normalizeRole, routeRole]);

  useEffect(() => {
    if (routeStatus !== null) setStatus(normalizeStatus(routeStatus));
  }, [normalizeStatus, routeStatus]);

  useEffect(() => {
    if (routeTab !== null) setTab(normalizeTab(routeTab));
  }, [routeTab]);

  const statusFilterLabels = useMemo(() => {
    if (!status) return [];
    return [orderStatusLabel(status)];
  }, [status]);

  const buildUrl = useCallback(
    (next: { role?: OrderListRole; tab?: OrderListTab; status?: string | null }) => {
      const r = next.role || asRole;
      const t = next.tab || tab;
      const s = next.status === undefined ? routeStatus : next.status;
      const parts: string[] = [];
      parts.push(`role=${encodeURIComponent(r)}`);
      if (t && t !== 'all') parts.push(`tab=${encodeURIComponent(t)}`);
      if (s) parts.push(`status=${encodeURIComponent(s)}`);
      return `/pages/orders/index?${parts.join('&')}`;
    },
    [asRole, routeStatus, tab],
  );

  const goToTab = useCallback(
    (nextTab: OrderListTab) => {
      if (nextTab === tab) return;
      // Changing the group tab clears any exact status filter.
      Taro.redirectTo({ url: buildUrl({ tab: nextTab, status: null }) });
    },
    [buildUrl, tab],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const group = !status ? groupByTab(tab) : null;
      const d = await apiGet<PagedOrder>('/orders', {
        asRole,
        ...(status ? { status } : {}),
        ...(group ? { statusGroup: group } : {}),
        page: 1,
        pageSize: 20,
      });
      setData(d);
    } catch (e: any) {
      setError(e?.message || '加载失败');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [asRole, status, tab]);

  const access = usePageAccess('approved-required', (a) => {
    if (a.state === 'ok') return;
    setLoading(false);
    setError(null);
    setData(null);
  });

  useEffect(() => {
    if (access.state !== 'ok') return;
    void load();
  }, [access.state, load]);

  const items = useMemo(() => data?.items || [], [data?.items]);

  if (access.state === 'need-login') {
    return (
      <View className="container">
        <PageHeader title="我的订单" subtitle="订金/尾款都在平台托管；可查看状态与发起退款申请" />
        <Spacer />
        <PermissionCard title="需要登录" message="登录后才能查看订单。" actionText="去登录" onAction={goLogin} />
      </View>
    );
  }
  if (access.state === 'need-onboarding') {
    return (
      <View className="container">
        <PageHeader title="我的订单" subtitle="订金/尾款都在平台托管；可查看状态与发起退款申请" />
        <Spacer />
        <PermissionCard title="需要选择身份" message="完成身份选择后才能继续。" actionText="去选择" onAction={goOnboarding} />
      </View>
    );
  }
  if (access.state === 'audit-pending') {
    return (
      <View className="container">
        <PageHeader title="我的订单" subtitle="订金/尾款都在平台托管；可查看状态与发起退款申请" />
        <Spacer />
        <AuditPendingCard title="资料审核中" message="审核通过后才能交易与查看订单。" actionText="查看进度" onAction={goOnboarding} />
      </View>
    );
  }
  if (access.state === 'audit-rejected') {
    return (
      <View className="container">
        <PageHeader title="我的订单" subtitle="订金/尾款都在平台托管；可查看状态与发起退款申请" />
        <Spacer />
        <AuditPendingCard title="资料已驳回" message="请重新提交资料，审核通过后才能继续。" actionText="重新提交" onAction={goOnboarding} />
      </View>
    );
  }
  if (access.state === 'audit-required') {
    return (
      <View className="container">
        <PageHeader title="我的订单" subtitle="订金/尾款都在平台托管；可查看状态与发起退款申请" />
        <Spacer />
        <AuditPendingCard title="需要认证" message="完成认证并审核通过后才能继续。" actionText="去认证" onAction={goOnboarding} />
      </View>
    );
  }

  return (
    <View className="container">
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
                Taro.redirectTo({ url: buildUrl({ status: null }) });
              }}
            >
              <Text>清空</Text>
            </View>
          </View>
        </View>
      ) : null}

      <View style={{ height: '12rpx' }} />

      {loading ? (
        <LoadingCard />
      ) : error ? (
        <ErrorCard message={error} onRetry={load} />
      ) : items.length ? (
        <View>
          {items.map((it: Order) => (
            <Surface
              key={it.id}
              style={{ marginBottom: '16rpx' }}
              onClick={() => {
                Taro.navigateTo({ url: `/pages/orders/detail/index?orderId=${it.id}` });
              }}
            >
              <View className="row-between" style={{ gap: '12rpx' }}>
                <Text className="text-card-title clamp-1">订单 {it.id.slice(0, 8)}…</Text>
                <Text className={orderStatusTagClass(it.status)}>{orderStatusLabel(it.status)}</Text>
              </View>
               <View style={{ height: '8rpx' }} />
               <Text className="muted">订金：¥{fenToYuan(it.depositAmountFen)} · 尾款：¥{fenToYuan(it.finalAmountFen)}</Text>
               <View style={{ height: '6rpx' }} />
               <Text className="muted">创建时间：{formatTimeSmart(it.createdAt)}</Text>
             </Surface>
           ))}
          </View>
       ) : (
         <EmptyCard
           title="暂无订单"
           message="完成下单后订单会出现在这里。"
           actionText="刷新"
           onAction={load}
           image={emptyOrders}
         />
       )}
    </View>
  );
}
