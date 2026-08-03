import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './index.scss';

import type { components } from '@ipmoney/api-types';

import { apiGet, apiPost } from '../../lib/api';
import {
  displayInfoOrPlaceholder,
  displayTitleWithSecondary,
  normalizeDisplayText,
} from '../../lib/displayText';
import { ensureApproved, usePageAccess } from '../../lib/guard';
import { formatTimeSmart } from '../../lib/format';
import { fenToYuan } from '../../lib/money';
import { useRouteStringParam } from '../../lib/routeParams';
import { normalizeInvoiceItemName } from '../../lib/userFacingText';
import { usePagedList } from '../../lib/usePagedList';
import { PageState } from '../../ui/PageState';
import { ListFooter } from '../../ui/ListFooter';
import { PageHeader, PopupSheet, Surface } from '../../ui/layout';
import { Button, Input, Popup, PullToRefresh, TextArea, toast } from '../../ui/nutui';
import emptyInvoices from '../../assets/illustrations/empty-invoices.svg';

type Order = components['schemas']['Order'];

type InvoiceStatus = 'WAIT_APPLY' | 'APPLYING' | 'ISSUED';
type InvoiceTitleType = 'PERSONAL' | 'ENTERPRISE';
type InvoiceRequestInfo = {
  id: string;
  orderId: string;
  titleType: InvoiceTitleType;
  titleName: string;
  taxNo?: string | null;
  email?: string | null;
  phone?: string | null;
  remark?: string | null;
  status: 'APPLYING' | 'ISSUED' | 'CANCELLED';
  createdAt: string;
  updatedAt?: string | null;
};
type InvoiceRequestCreatePayload = {
  titleType: InvoiceTitleType;
  titleName: string;
  taxNo?: string | null;
  email?: string | null;
  phone?: string | null;
  remark?: string | null;
};

type InvoiceItem = Order & {
  invoiceStatus: InvoiceStatus;
  listingTitle?: string | null;
  applicationNoDisplay?: string | null;
  amountFen?: number | null;
  itemName?: string | null;
  invoiceRequest?: InvoiceRequestInfo | null;
  invoiceNo?: string | null;
  issuedAt?: string | null;
  invoiceFileUrl?: string | null;
  requestedAt?: string | null;
};

type InvoiceListResponse = {
  items: InvoiceItem[];
  page: { page: number; pageSize: number; total: number };
};

const TAX_NO_RE = /^[0-9A-Z]{8,32}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CN_MOBILE_RE = /^1[3-9]\d{9}$/;

const TABS: { id: InvoiceStatus; label: string }[] = [
  { id: 'WAIT_APPLY', label: '待开票' },
  { id: 'ISSUED', label: '可下载' },
];

function invoiceStatusLabel(status: InvoiceStatus): string {
  if (status === 'WAIT_APPLY') return '待申请';
  if (status === 'APPLYING') return '处理中';
  return '可下载';
}

function invoiceStatusClass(status: InvoiceStatus): string {
  if (status === 'WAIT_APPLY') return 'is-wait';
  if (status === 'APPLYING') return 'is-applying';
  return 'is-issued';
}

function invoiceTitleTypeLabel(type?: string | null): string {
  if (type === 'ENTERPRISE') return '企业';
  return '个人';
}

function normalizeLegacyInvoiceNo(value?: string | null): string {
  const raw = normalizeDisplayText(value) || '';
  return /^REQ-/i.test(raw) ? '' : raw;
}

function invoiceProcessLabel(status: InvoiceStatus, orderStatus?: Order['status']): string {
  if (status === 'ISSUED') return '平台财务已开具';
  if (status === 'APPLYING') return '已提交，平台财务线下处理';
  if (orderStatus !== 'COMPLETED') return '订单完成后可提交开票抬头';
  return '填写开票抬头后由平台财务线下处理';
}

function canApplyInvoice(item: InvoiceItem, status: InvoiceStatus): boolean {
  if (status !== 'WAIT_APPLY') return false;
  if (item.status !== 'COMPLETED') return false;
  if (item.invoiceFileId || item.invoiceFileUrl) return false;
  if (item.invoiceRequest) return false;
  if (normalizeDisplayText(item.invoiceNo)) return false;
  return true;
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
  const invoiceActionSeqRef = useRef(0);
  const [submittedInvoiceOrderIds, setSubmittedInvoiceOrderIds] = useState<string[]>([]);
  const [invoiceFormItem, setInvoiceFormItem] = useState<InvoiceItem | null>(null);
  const [invoiceRequesting, setInvoiceRequesting] = useState(false);
  const [invoiceTitleType, setInvoiceTitleType] = useState<InvoiceTitleType>('ENTERPRISE');
  const [invoiceTitleName, setInvoiceTitleName] = useState('');
  const [invoiceTaxNo, setInvoiceTaxNo] = useState('');
  const [invoiceEmail, setInvoiceEmail] = useState('');
  const [invoicePhone, setInvoicePhone] = useState('');
  const [invoiceRemark, setInvoiceRemark] = useState('');

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
    ? '查看当前订单的开票进度、提交开票抬头与下载信息'
    : '未申请订单可提交开票抬头，开具后可下载';
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

  const openInvoiceForm = useCallback((item: InvoiceItem, status: InvoiceStatus) => {
    if (!ensureApproved()) return;
    if (status !== 'WAIT_APPLY') {
      toast('该订单已进入开票处理');
      return;
    }
    if (item.status !== 'COMPLETED') {
      toast('订单完成后可申请开票');
      return;
    }
    if (!canApplyInvoice(item, status)) {
      toast('该订单已提交开票申请');
      return;
    }
    const defaultTitle = normalizeDisplayText(item.buyerDisplayName) || '';
    setInvoiceFormItem(item);
    setInvoiceTitleType('ENTERPRISE');
    setInvoiceTitleName(defaultTitle);
    setInvoiceTaxNo('');
    setInvoiceEmail('');
    setInvoicePhone('');
    setInvoiceRemark('');
  }, []);

  const closeInvoiceForm = useCallback(() => {
    if (invoiceRequesting) return;
    setInvoiceFormItem(null);
  }, [invoiceRequesting]);

  const requestInvoice = useCallback(async () => {
    if (!ensureApproved()) return;
    const targetOrderId = invoiceFormItem?.id;
    if (!targetOrderId || invoiceRequesting) return;
    const titleName = invoiceTitleName.trim();
    const taxNo = invoiceTaxNo.trim().toUpperCase();
    const email = invoiceEmail.trim();
    const phone = invoicePhone.trim();
    const remark = invoiceRemark.trim();
    if (titleName.length < 2) {
      toast('请填写发票抬头');
      return;
    }
    if (invoiceTitleType === 'ENTERPRISE' && !TAX_NO_RE.test(taxNo)) {
      toast('请填写正确的纳税人识别号');
      return;
    }
    if (email && !EMAIL_RE.test(email)) {
      toast('请填写正确的接收邮箱');
      return;
    }
    if (phone && !CN_MOBILE_RE.test(phone)) {
      toast('请填写正确的联系手机号');
      return;
    }
    const payload: InvoiceRequestCreatePayload = {
      titleType: invoiceTitleType,
      titleName,
      ...(invoiceTitleType === 'ENTERPRISE' ? { taxNo } : {}),
      ...(email ? { email } : {}),
      ...(phone ? { phone } : {}),
      ...(remark ? { remark } : {}),
    };
    const seq = ++invoiceActionSeqRef.current;
    setInvoiceRequesting(true);
    try {
      await apiPost(`/orders/${targetOrderId}/invoice-requests`, payload, {
        idempotencyKey: `invoice-${targetOrderId}`,
      });
      if (seq !== invoiceActionSeqRef.current) return;
      setSubmittedInvoiceOrderIds((prev) =>
        prev.includes(targetOrderId) ? prev : [...prev, targetOrderId],
      );
      setInvoiceFormItem(null);
      toast('已提交开票申请，财务将按填写信息处理', { icon: 'success' });
      void reload();
    } catch (e: any) {
      if (seq !== invoiceActionSeqRef.current) return;
      toast(e?.message || '申请开票失败', { icon: 'fail' });
    } finally {
      if (seq === invoiceActionSeqRef.current) {
        setInvoiceRequesting(false);
      }
    }
  }, [
    invoiceEmail,
    invoiceFormItem?.id,
    invoicePhone,
    invoiceRemark,
    invoiceRequesting,
    invoiceTaxNo,
    invoiceTitleName,
    invoiceTitleType,
    reload,
  ]);

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
            {items.map((item) => {
              const request = item.invoiceRequest;
              const displayInvoiceNo = normalizeLegacyInvoiceNo(item.invoiceNo);
              const effectiveInvoiceStatus =
                item.invoiceStatus === 'WAIT_APPLY' && submittedInvoiceOrderIds.includes(item.id)
                  ? 'APPLYING'
                  : item.invoiceStatus;
              const allowApplyInvoice = canApplyInvoice(item, effectiveInvoiceStatus);
              return (
                <Surface key={item.id} className="invoice-card" padding="none">
                  <View className="invoice-accent-strip" />

                  <View className="invoice-card-head">
                    <View className="invoice-card-title-wrap">
                      <Text className="invoice-card-kicker">交易标的</Text>
                      <Text className="invoice-card-title clamp-2">
                        {resolveInvoiceCardTitle(item)}
                      </Text>
                    </View>
                    <View className={`invoice-status ${invoiceStatusClass(effectiveInvoiceStatus)}`}>
                      <View className="invoice-status-dot" />
                      <Text>{invoiceStatusLabel(effectiveInvoiceStatus)}</Text>
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
                      value={invoiceProcessLabel(effectiveInvoiceStatus, item.status)}
                      span2
                    />
                    {request ? (
                      <InvoiceInfoField
                        label="开票抬头"
                        value={`${invoiceTitleTypeLabel(request.titleType)} · ${displayInfoOrPlaceholder(request.titleName, '待确认')}`}
                        span2
                      />
                    ) : effectiveInvoiceStatus === 'APPLYING' ? (
                      <InvoiceInfoField label="开票抬头" value="历史申请，需联系客服补充" span2 dimmed />
                    ) : null}
                    {request?.titleType === 'ENTERPRISE' ? (
                      <InvoiceInfoField
                        label="纳税人识别号"
                        value={displayInfoOrPlaceholder(request.taxNo, '待确认')}
                        span2
                        mono
                      />
                    ) : null}
                    {request?.email ? (
                      <InvoiceInfoField label="接收邮箱" value={displayInfoOrPlaceholder(request.email, '待确认')} span2 />
                    ) : null}
                    <InvoiceInfoField
                      label="发票号"
                      value={displayInfoOrPlaceholder(displayInvoiceNo, '待确认')}
                      span2
                      dimmed={!displayInvoiceNo}
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
                    {effectiveInvoiceStatus === 'ISSUED' ? (
                      <Button
                        className="invoice-action-btn invoice-action-btn-primary"
                        size="small"
                        variant="primary"
                        onClick={() => copyInvoiceLink(item)}
                      >
                        复制下载链接
                      </Button>
                    ) : allowApplyInvoice ? (
                      <Button
                        className="invoice-action-btn invoice-action-btn-primary"
                        size="small"
                        variant="primary"
                        onClick={() => openInvoiceForm(item, effectiveInvoiceStatus)}
                      >
                        申请开票
                      </Button>
                    ) : (
                      <Button
                        className="invoice-action-btn invoice-action-btn-primary"
                        size="small"
                        variant="primary"
                        disabled
                      >
                        {effectiveInvoiceStatus === 'APPLYING' ? '财务处理中' : '完成后申请'}
                      </Button>
                    )}
                  </View>
                </Surface>
              );
            })}
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

      <Popup
        visible={Boolean(invoiceFormItem)}
        position="bottom"
        round
        closeable={!invoiceRequesting}
        title="填写开票信息"
        onClose={closeInvoiceForm}
        onOverlayClick={closeInvoiceForm}
      >
        <PopupSheet scrollRatio={0.72}>
          <Surface className="invoice-popup-card">
            <Text className="text-strong">抬头类型</Text>
            <View className="invoice-popup-gap-sm" />
            <View className="invoice-title-type-grid">
              {(['ENTERPRISE', 'PERSONAL'] as InvoiceTitleType[]).map((type) => (
                <View
                  key={type}
                  className={`invoice-title-type-item ${invoiceTitleType === type ? 'is-active' : ''}`}
                  onClick={() => setInvoiceTitleType(type)}
                >
                  <Text>{invoiceTitleTypeLabel(type)}</Text>
                </View>
              ))}
            </View>

            <View className="invoice-popup-gap" />
            <View className="invoice-form-field">
              <Text className="invoice-form-label">发票抬头</Text>
              <View className="invoice-input-wrap">
                <Input
                  value={invoiceTitleName}
                  onChange={setInvoiceTitleName}
                  placeholder={invoiceTitleType === 'ENTERPRISE' ? '企业名称' : '个人姓名'}
                  clearable
                />
              </View>
            </View>

            {invoiceTitleType === 'ENTERPRISE' ? (
              <View className="invoice-form-field">
                <Text className="invoice-form-label">纳税人识别号</Text>
                <View className="invoice-input-wrap">
                  <Input
                    value={invoiceTaxNo}
                    onChange={(value) => setInvoiceTaxNo(String(value || '').toUpperCase())}
                    placeholder="统一社会信用代码/税号"
                    clearable
                  />
                </View>
              </View>
            ) : null}

            <View className="invoice-form-field">
              <Text className="invoice-form-label">接收邮箱（可选）</Text>
              <View className="invoice-input-wrap">
                <Input value={invoiceEmail} onChange={setInvoiceEmail} placeholder="用于接收电子发票" clearable />
              </View>
            </View>

            <View className="invoice-form-field">
              <Text className="invoice-form-label">联系手机号（可选）</Text>
              <View className="invoice-input-wrap">
                <Input value={invoicePhone} onChange={setInvoicePhone} placeholder="便于财务核对" type="digit" clearable />
              </View>
            </View>

            <View className="invoice-form-field">
              <Text className="invoice-form-label">备注（可选）</Text>
              <View className="invoice-textarea-wrap">
                <TextArea value={invoiceRemark} onChange={setInvoiceRemark} placeholder="特殊开票要求" maxLength={500} />
              </View>
            </View>

            <Text className="invoice-popup-note">开票信息提交后如需修改，请联系客服处理。</Text>

            <View className="invoice-popup-gap-lg" />
            <Button loading={invoiceRequesting} disabled={invoiceRequesting} onClick={() => void requestInvoice()}>
              提交开票申请
            </Button>
          </Surface>
        </PopupSheet>
      </Popup>
    </View>
  );
}
