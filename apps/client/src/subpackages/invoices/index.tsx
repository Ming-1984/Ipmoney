import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './index.scss';

import type { components } from '@ipmoney/api-types';

import { apiGet } from '../../lib/api';
import {
  displayInfoOrPlaceholder,
  displayTitleWithSecondary,
  normalizeDisplayText,
} from '../../lib/displayText';
import { usePageAccess } from '../../lib/guard';
import { formatTimeSmart } from '../../lib/format';
import { fenToYuan } from '../../lib/money';
import { useRouteStringParam } from '../../lib/routeParams';
import { normalizeInvoiceItemName } from '../../lib/userFacingText';
import { usePagedList } from '../../lib/usePagedList';
import { PageState } from '../../ui/PageState';
import { ListFooter } from '../../ui/ListFooter';
import { PageHeader, Surface } from '../../ui/layout';
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

function resolveInvoiceCardTitle(
  item: Pick<InvoiceItem, 'listingTitle' | 'applicationNoDisplay'>,
): string {
  return displayTitleWithSecondary(item.listingTitle, '发票信息待确认', {
    secondary: item.applicationNoDisplay,
    secondaryPrefix: '专利申请号 ',
  });
}

function InvoiceInfoField(props: {
  label: string;
  value: string;
  mono?: boolean;
  accent?: boolean;
  dimmed?: boolean;
  span2?: boolean;
}) {
  const classes = [
    'invoice-info-field',
    props.span2 ? 'is-span-2' : '',
    props.mono ? 'is-mono' : '',
    props.accent ? 'is-accent' : '',
    props.dimmed ? 'is-dimmed' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <View className={classes}>
      <Text className="invoice-info-label">{props.label}</Text>
      <Text className="invoice-info-value clamp-1">{props.value}</Text>
    </View>
  );
}

export default function InvoiceCenterPage() {
  const loadedOnceRef = useRef(false);
  const filterKeyRef = useRef('');
  const tabParam = useRouteStringParam('tab');
  const orderIdParam = useRouteStringParam('orderId') || '';
  const [activeTab, setActiveTab] = useState<InvoiceStatus>('WAIT_APPLY');

  useEffect(() => {
    const nextTab = TABS.some((tab) => tab.id === tabParam)
      ? (tabParam as InvoiceStatus)
      : 'WAIT_APPLY';
    setActiveTab(nextTab);
  }, [tabParam]);

  const fetcher = useCallback(
    async ({ page, pageSize }: { page: number; pageSize: number }) =>
      apiGet<InvoiceListResponse>('/invoices', {
        status: activeTab,
        orderId: orderIdParam || undefined,
        page,
        pageSize,
      }),
    [activeTab, orderIdParam],
  );

  const {
    items: rawItems,
    loading,
    error,
    refreshing,
    loadingMore,
    hasMore,
    reload,
    refresh,
    loadMore,
    reset,
  } = usePagedList<InvoiceItem>(fetcher, {
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
    const nextKey = `${activeTab}:${orderIdParam}`;
    if (filterKeyRef.current === nextKey) return;
    filterKeyRef.current = nextKey;
    reset();
  }, [activeTab, orderIdParam, reset]);

  useEffect(() => {
    if (access.state !== 'ok') return;
    loadedOnceRef.current = true;
    void reload();
  }, [access.state, reload, activeTab, orderIdParam]);

  const items = useMemo(() => {
    const list = rawItems || [];
    if (activeTab === 'WAIT_APPLY') {
      return list.filter(
        (it) => it.invoiceStatus === 'WAIT_APPLY' || it.invoiceStatus === 'APPLYING',
      );
    }
    return list.filter((it) => it.invoiceStatus === activeTab);
  }, [rawItems, activeTab]);
  const showInitialLoading = loading && items.length === 0;
  const pageTitle = orderIdParam ? '当前订单发票' : '发票管理中心';
  const pageSubtitle = orderIdParam
    ? '查看当前订单的开票进度与下载信息'
    : '发票由平台财务线下开具，开具后可下载';
  const emptyMessage = orderIdParam
    ? '当前订单在该分类下暂无发票记录。'
    : '当前分类下暂无发票记录。';

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
      <PageHeader weapp title={pageTitle} subtitle={pageSubtitle} />

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
        loading={showInitialLoading}
        error={error}
        empty={!showInitialLoading && !error && items.length === 0}
        emptyTitle="暂无发票"
        emptyMessage={emptyMessage}
        emptyImage={emptyInvoices}
        onRetry={reload}
      >
        <PullToRefresh
          type="primary"
          disabled={showInitialLoading || refreshing}
          onRefresh={refresh}
        >
          <View className="invoice-list">
            {items.map((item) => (
              <Surface key={item.id} className="invoice-card" padding="none">
                <View className="invoice-accent-strip" />

                <View className="invoice-card-head">
                  <View className="invoice-card-title-wrap">
                    <Text className="invoice-card-kicker">交易标的</Text>
                    <Text className="invoice-card-title clamp-2">
                      {resolveInvoiceCardTitle(item)}
                    </Text>
                  </View>
                  <View className={`invoice-status ${invoiceStatusClass(item.invoiceStatus)}`}>
                    <View className="invoice-status-dot" />
                    <Text>{invoiceStatusLabel(item.invoiceStatus)}</Text>
                  </View>
                </View>

                <View className="invoice-divider" />

                <View className="invoice-info-grid">
                  <InvoiceInfoField
                    label="申请号"
                    value={displayInfoOrPlaceholder(item.applicationNoDisplay, '待确认')}
                    mono
                  />
                  <InvoiceInfoField
                    label="项目名称"
                    value={normalizeInvoiceItemName(item.itemName)}
                  />
                  <InvoiceInfoField
                    label="开票金额"
                    value={item.amountFen != null ? `¥ ${fenToYuan(item.amountFen)}` : '待确认'}
                    accent
                  />
                  <InvoiceInfoField label="订单时间" value={formatTimeSmart(item.createdAt)} />
                  <InvoiceInfoField
                    label="开票方式"
                    value={item.invoiceStatus === 'ISSUED' ? '平台财务已开具' : '平台财务线下处理'}
                    span2
                  />
                  <InvoiceInfoField
                    label="发票号"
                    value={displayInfoOrPlaceholder(item.invoiceNo, '待确认')}
                    span2
                    dimmed={!normalizeDisplayText(item.invoiceNo)}
                  />
                  {item.issuedAt ? (
                    <InvoiceInfoField
                      label="开票时间"
                      value={formatTimeSmart(item.issuedAt)}
                      span2
                    />
                  ) : null}
                </View>

                <View className="invoice-divider" />

                <View className="invoice-actions">
                  <Button
                    className="invoice-action-btn invoice-action-btn-outline"
                    size="small"
                    variant="ghost"
                    onClick={() =>
                      Taro.navigateTo({
                        url: `/subpackages/orders/detail/index?orderId=${item.id}`,
                      })
                    }
                  >
                    订单详情
                  </Button>
                  {item.invoiceStatus === 'ISSUED' ? (
                    <Button
                      className="invoice-action-btn invoice-action-btn-primary"
                      size="small"
                      variant="primary"
                      onClick={() => copyInvoiceLink(item)}
                    >
                      复制下载链接
                    </Button>
                  ) : (
                    <Button
                      className="invoice-action-btn invoice-action-btn-primary"
                      size="small"
                      variant="primary"
                      disabled
                    >
                      线下开票
                    </Button>
                  )}
                </View>
              </Surface>
            ))}
          </View>

          {!showInitialLoading && items.length ? (
            <ListFooter
              loadingMore={loadingMore}
              hasMore={hasMore}
              onLoadMore={loadMore}
              showNoMore
            />
          ) : null}
        </PullToRefresh>
      </PageState>
    </View>
  );
}
