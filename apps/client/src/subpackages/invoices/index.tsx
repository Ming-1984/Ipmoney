import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './index.scss';

import type { components } from '@ipmoney/api-types';

import { apiGet } from '../../lib/api';
import { usePageAccess } from '../../lib/guard';
import { formatTimeSmart } from '../../lib/format';
import { fenToYuan } from '../../lib/money';
import { useRouteStringParam } from '../../lib/routeParams';
import { usePagedList } from '../../lib/usePagedList';
import { PageState } from '../../ui/PageState';
import { ListFooter } from '../../ui/ListFooter';
import { PageHeader, Spacer, Surface } from '../../ui/layout';
import { Button, PullToRefresh, toast } from '../../ui/nutui';
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
  { id: 'WAIT_APPLY', label: '待开票' },
  { id: 'ISSUED', label: '可下载' },
];

function invoiceStatusLabel(status: InvoiceStatus): string {
  if (status === 'WAIT_APPLY') return '待开票';
  if (status === 'APPLYING') return '处理中';
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

  useEffect(() => {
    if (tabParam && TABS.some((tab) => tab.id === tabParam)) {
      setActiveTab(tabParam as InvoiceStatus);
    }
  }, [tabParam]);

  const fetcher = useCallback(
    async ({ page, pageSize }: { page: number; pageSize: number }) =>
      apiGet<InvoiceListResponse>('/invoices', { status: activeTab, page, pageSize }),
    [activeTab],
  );

  const { items: rawItems, loading, error, refreshing, loadingMore, hasMore, reload, refresh, loadMore, reset } =
    usePagedList<InvoiceItem>(fetcher, {
      pageSize: 20,
      onError: (message, ctx) => {
        if (ctx === 'loadMore') toast(message);
      },
    });

  const access = usePageAccess('approved-required', (a) => {
    if (a.state === 'ok') return;
    reset();
  });

  useEffect(() => {
    if (access.state !== 'ok') return;
    void reload();
  }, [access.state, reload, activeTab]);

  const items = useMemo(() => {
    const list = rawItems || [];
    if (activeTab === 'WAIT_APPLY') {
      return list.filter((it) => it.invoiceStatus === 'WAIT_APPLY' || it.invoiceStatus === 'APPLYING');
    }
    return list.filter((it) => it.invoiceStatus === activeTab);
  }, [rawItems, activeTab]);

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
      <PageHeader weapp title="发票管理中心" subtitle="发票由平台财务线下开具，开具后可下载" />
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
        onRetry={reload}
      >
        <PullToRefresh type="primary" disabled={loading || refreshing} onRefresh={refresh}>
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
                  {item.invoiceStatus !== 'ISSUED' ? <Text className="muted">开票方式：平台财务线下处理</Text> : null}
                  {item.invoiceNo ? <Text className="muted">发票号：{item.invoiceNo}</Text> : null}
                  {item.issuedAt ? <Text className="muted">开票时间：{formatTimeSmart(item.issuedAt)}</Text> : null}
                </View>
                <View className="invoice-actions">
                  <Button
                    size="small"
                    variant="ghost"
                    onClick={() => Taro.navigateTo({ url: `/subpackages/orders/detail/index?orderId=${item.id}` })}
                  >
                    订单详情
                  </Button>
                  {item.invoiceStatus === 'ISSUED' ? (
                    <Button size="small" variant="primary" onClick={() => copyInvoiceLink(item)}>
                      复制下载链接
                    </Button>
                  ) : (
                    <Button size="small" variant="ghost" disabled>
                      线下开票
                    </Button>
                  )}
                </View>
              </Surface>
            ))}
          </View>

          {!loading && items.length ? (
            <ListFooter loadingMore={loadingMore} hasMore={hasMore} onLoadMore={loadMore} showNoMore />
          ) : null}
        </PullToRefresh>
      </PageState>
    </View>
  );
}
