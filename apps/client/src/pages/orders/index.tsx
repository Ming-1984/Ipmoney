import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useMemo, useState } from 'react';

import type { components } from '@ipmoney/api-types';

import { apiGet } from '../../lib/api';
import { goLogin, goOnboarding, usePageAccess } from '../../lib/guard';
import { orderStatusLabel, orderStatusTagClass } from '../../lib/labels';
import { Segmented } from '../../ui/nutui';
import { AuditPendingCard, EmptyCard, ErrorCard, LoadingCard, PermissionCard } from '../../ui/StateCards';
import { PageHeader, Spacer, Surface } from '../../ui/layout';

type PagedOrder = components['schemas']['PagedOrder'];
type Order = components['schemas']['Order'];
type OrderListRole = components['schemas']['OrderListRole'];

function fenToYuan(fen?: number): string {
  if (fen === undefined || fen === null) return '-';
  return (fen / 100).toFixed(2);
}

export default function OrdersPage() {
  const [asRole, setAsRole] = useState<OrderListRole>('BUYER');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PagedOrder | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await apiGet<PagedOrder>('/orders', { asRole, page: 1, pageSize: 20 });
      setData(d);
    } catch (e: any) {
      setError(e?.message || '加载失败');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [asRole]);

  const access = usePageAccess('approved-required', (a) => {
    if (a.state === 'ok') {
      void load();
      return;
    }
    setLoading(false);
    setError(null);
    setData(null);
  });

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
              <Text className="muted">创建时间：{it.createdAt}</Text>
            </Surface>
          ))}
        </View>
      ) : (
        <EmptyCard message="暂无订单" actionText="刷新" onAction={load} />
      )}
    </View>
  );
}
