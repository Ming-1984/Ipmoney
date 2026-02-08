import { View, Text } from '@tarojs/components';
import Taro, { usePullDownRefresh } from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './index.scss';

import type { components } from '@ipmoney/api-types';

import { apiGet, apiPost } from '../../lib/api';
import { ensureApproved, usePageAccess } from '../../lib/guard';
import { formatTimeSmart } from '../../lib/format';
import { fenToYuan } from '../../lib/money';
import { useRouteStringParam } from '../../lib/routeParams';
import { PageState } from '../../ui/PageState';
import { PageHeader, Spacer, Surface } from '../../ui/layout';
import { Button, toast } from '../../ui/nutui';
import emptyInvoices from '../../assets/illustrations/empty-invoices.svg';

type Order = components['schemas']['Order'];

type InvoiceStatus = 'WAIT_APPLY' | 'APPLYING' | 'ISSUED';

type InvoiceItem = Order & {
  invoiceStatus: InvoiceStatus;
  listingTitle?: string | null;
  applicationNoDisplay?: string | null;
  amountFen?: number | null;
  itemName?: string | null;
  invoiceNo?: string | null;
  issuedAt?: string | null;
  invoiceFileUrl?: string | null;
  requestedAt?: string | null;
};

type InvoiceListResponse = {
  items: InvoiceItem[];
  page: { page: number; pageSize: number; total: number };
};

const TABS: { id: InvoiceStatus; label: string }[] = [
  { id: 'WAIT_APPLY', label: '待申请' },
  { id: 'APPLYING', label: '申请中' },
  { id: 'ISSUED', label: '可下载' },
];

function invoiceStatusLabel(status: InvoiceStatus): string {
  if (status === 'WAIT_APPLY') return '待申请';
  if (status === 'APPLYING') return '申请中';
  return '可下载';
}

function invoiceStatusClass(status: InvoiceStatus): string {
  if (status === 'WAIT_APPLY') return 'is-wait';
  if (status === 'APPLYING') return 'is-applying';
  return 'is-issued';
}

export default function InvoiceCenterPage() {
  const tabParam = useRouteStringParam('tab');
  const [activeTab, setActiveTab] = useState<InvoiceStatus>('WAIT_APPLY');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<InvoiceListResponse | null>(null);

  useEffect(() => {
    if (tabParam && TABS.some((tab) => tab.id === tabParam)) {
      setActiveTab(tabParam as InvoiceStatus);
    }
  }, [tabParam]);

  const access = usePageAccess('approved-required', (a) => {
    if (a.state === 'ok') return;
    setLoading(false);
    setError(null);
    setData(null);
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<InvoiceListResponse>('/invoices', { status: activeTab, page: 1, pageSize: 20 });
      setData(res);
    } catch (e: any) {
      setError(e?.message || '加载失败');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    if (access.state !== 'ok') return;
    void load();
  }, [access.state, load, activeTab]);

  usePullDownRefresh(() => {
    if (access.state !== 'ok') {
      Taro.stopPullDownRefresh();
      return;
    }
    load().finally(() => Taro.stopPullDownRefresh());
  });

  const items = useMemo(() => {
    const list = data?.items || [];
    return list.filter((it) => it.invoiceStatus === activeTab);
  }, [data?.items, activeTab]);

  const applyInvoice = useCallback(
    async (orderId: string) => {
      if (!ensureApproved()) return;
      try {
        await apiPost(`/orders/${orderId}/invoice-requests`, {}, { idempotencyKey: `invoice-${orderId}` });
        toast('已提交开票申请', { icon: 'success' });
        void load();
      } catch (e: any) {
        toast(e?.message || '提交失败');
      }
    },
    [load],
  );

  const issueInvoice = useCallback(
    async (orderId: string) => {
      if (!ensureApproved()) return;
      try {
        await apiPost(`/admin/orders/${orderId}/invoice`, {}, { idempotencyKey: `invoice-issue-${orderId}` });
        toast('已模拟开票', { icon: 'success' });
        void load();
      } catch (e: any) {
        toast(e?.message || '模拟失败');
      }
    },
    [load],
  );

  const copyInvoiceLink = useCallback((item: InvoiceItem) => {
    const url = item.invoiceFileUrl || '';
    if (!url) {
      toast('暂无可用下载链接');
      return;
    }
    Taro.setClipboardData({ data: url });
    toast('已复制下载链接', { icon: 'success' });
  }, []);

  return (
    <View className="container invoices-page">
      <PageHeader weapp title="发票管理中心" subtitle="待申请、申请中、可下载发票集中管理" />
      <Spacer />

      <View className="invoice-tabs">
        {TABS.map((tab) => (
          <View
            key={tab.id}
            className={`invoice-tab ${activeTab === tab.id ? 'is-active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <Text>{tab.label}</Text>
            {activeTab === tab.id ? <View className="invoice-tab-underline" /> : null}
          </View>
        ))}
      </View>

      <PageState
        access={access}
        loading={loading}
        error={error}
        empty={!loading && !error && items.length === 0}
        emptyTitle="暂无发票"
        emptyMessage="当前分类下暂无发票记录。"
        emptyImage={emptyInvoices}
        onRetry={load}
      >
        <View className="invoice-list">
          {items.map((item) => (
            <Surface key={item.id} className="invoice-card" padding="none">
              <View className="row-between" style={{ gap: '12rpx' }}>
                <Text className="text-card-title">订单 {item.id.slice(0, 8)}...</Text>
                <Text className={`invoice-status ${invoiceStatusClass(item.invoiceStatus)}`}>
                  {invoiceStatusLabel(item.invoiceStatus)}
                </Text>
              </View>
              <View className="invoice-meta">
                {item.listingTitle ? <Text className="muted clamp-1">交易标的：{item.listingTitle}</Text> : null}
                {item.applicationNoDisplay ? <Text className="muted">申请号：{item.applicationNoDisplay}</Text> : null}
                <Text className="muted">开票金额：￥{fenToYuan(item.amountFen || 0)}</Text>
                <Text className="muted">订单时间：{formatTimeSmart(item.createdAt)}</Text>
                {item.invoiceNo ? <Text className="muted">发票号：{item.invoiceNo}</Text> : null}
                {item.issuedAt ? <Text className="muted">开票时间：{formatTimeSmart(item.issuedAt)}</Text> : null}
              </View>
              <View className="invoice-actions">
                <Button
                  size="small"
                  variant="ghost"
                  onClick={() => Taro.navigateTo({ url: `/pages/orders/detail/index?orderId=${item.id}` })}
                >
                  订单详情
                </Button>
                {item.invoiceStatus === 'WAIT_APPLY' ? (
                  <Button size="small" variant="primary" onClick={() => void applyInvoice(item.id)}>
                    申请开票（模拟）
                  </Button>
                ) : item.invoiceStatus === 'APPLYING' ? (
                  <>
                    <Button size="small" variant="ghost" onClick={() => toast('开票处理中，请耐心等待')}>查看进度</Button>
                    <Button size="small" variant="primary" onClick={() => void issueInvoice(item.id)}>
                      模拟开票
                    </Button>
                  </>
                ) : (
                  <Button size="small" variant="primary" onClick={() => copyInvoiceLink(item)}>
                    复制下载链接
                  </Button>
                )}
              </View>
            </Surface>
          ))}
        </View>
      </PageState>
    </View>
  );
}
