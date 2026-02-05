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
import type { ChipOption } from '../../ui/filters';
import { ChipGroup, FilterSheet } from '../../ui/filters';
import { Segmented } from '../../ui/nutui';
import { AuditPendingCard, EmptyCard, ErrorCard, LoadingCard, PermissionCard } from '../../ui/StateCards';
import { PageHeader, Spacer, Surface } from '../../ui/layout';

type PagedOrder = components['schemas']['PagedOrder'];
type Order = components['schemas']['Order'];
type OrderListRole = components['schemas']['OrderListRole'];
type OrderStatus = components['schemas']['OrderStatus'];

type OrderStatusFilter = OrderStatus | '';

const ORDER_STATUS_OPTIONS: ChipOption<OrderStatusFilter>[] = [
  { value: '', label: '全部状态' },
  { value: 'DEPOSIT_PENDING', label: '待付订金' },
  { value: 'DEPOSIT_PAID', label: '订金已付' },
  { value: 'WAIT_FINAL_PAYMENT', label: '待付尾款' },
  { value: 'FINAL_PAID_ESCROW', label: '尾款托管中' },
  { value: 'READY_TO_SETTLE', label: '待结算' },
  { value: 'COMPLETED', label: '已完成' },
  { value: 'REFUNDING', label: '退款中' },
  { value: 'REFUNDED', label: '已退款' },
  { value: 'CANCELLED', label: '已取消' },
];

export default function OrdersPage() {
  const routeRole = useRouteStringParam('role');
  const routeStatus = useRouteStringParam('status');
  const normalizeRole = useCallback((value?: string | null): OrderListRole => {
    if (value === 'SELLER') return 'SELLER';
    return 'BUYER';
  }, []);
  const normalizeStatus = useCallback((value?: string | null): OrderStatusFilter => {
    if (!value) return '';
    if (ORDER_STATUS_OPTIONS.some((opt) => opt.value === value)) return value as OrderStatus;
    return '';
  }, []);

  const [asRole, setAsRole] = useState<OrderListRole>(() => normalizeRole(routeRole));
  const [status, setStatus] = useState<OrderStatusFilter>(() => normalizeStatus(routeStatus));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PagedOrder | null>(null);

  useEffect(() => {
    if (routeRole) setAsRole(normalizeRole(routeRole));
  }, [normalizeRole, routeRole]);

  useEffect(() => {
    if (routeStatus !== null) setStatus(normalizeStatus(routeStatus));
  }, [normalizeStatus, routeStatus]);

  const statusFilterLabels = useMemo(() => {
    if (!status) return [];
    return [orderStatusLabel(status)];
  }, [status]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await apiGet<PagedOrder>('/orders', { asRole, status: status || undefined, page: 1, pageSize: 20 });
      setData(d);
    } catch (e: any) {
      setError(e?.message || '加载失败');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [asRole, status]);

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

      <Surface>
        <Text className="text-strong">身份视角</Text>
        <View style={{ height: '10rpx' }} />
        <Segmented
          value={asRole}
          options={[
            { label: '我是买家', value: 'BUYER' },
            { label: '我是卖家', value: 'SELLER' },
          ]}
          onChange={(v) => setAsRole(v as OrderListRole)}
        />

        <View style={{ height: '14rpx' }} />
        <View className="search-sort-row">
          <View className="search-sort-options">
            <Text className="search-sort-option is-active">综合排序</Text>
          </View>
          <View className="search-filter-btn" onClick={() => setFiltersOpen(true)}>
            <Text>筛选</Text>
          </View>
        </View>
        {statusFilterLabels.length ? (
          <View className="search-toolbar-row search-toolbar-compact">
            <View className="search-selected-scroll">
              {statusFilterLabels.map((txt, idx) => (
                <View key={`${txt}-${idx}`} className="pill">
                  <Text>{txt}</Text>
                </View>
              ))}
              <View className="pill pill-strong" onClick={() => setStatus('')}>
                <Text>清空</Text>
              </View>
            </View>
          </View>
        ) : null}
      </Surface>

      <View style={{ height: '16rpx' }} />

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
        <EmptyCard message="暂无订单" actionText="刷新" onAction={load} />
      )}

      <FilterSheet<OrderStatusFilter>
        open={filtersOpen}
        title="筛选（订单）"
        value={status}
        defaultValue=""
        onClose={() => setFiltersOpen(false)}
        onApply={(next) => setStatus(next)}
      >
        {({ draft, setDraft }) => (
          <Surface>
            <Text className="text-strong">订单状态</Text>
            <View style={{ height: '10rpx' }} />
            <ChipGroup<OrderStatusFilter> value={draft} options={ORDER_STATUS_OPTIONS} onChange={(v) => setDraft(v)} />
          </Surface>
        )}
      </FilterSheet>
    </View>
  );
}
