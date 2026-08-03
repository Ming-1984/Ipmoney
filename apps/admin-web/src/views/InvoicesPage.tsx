import { Button, Card, Input, Select, Space, Table, Tag, Typography, Upload, message } from 'antd';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { apiDelete, apiGet, apiPost, apiPut, apiUploadFile, type FileObject } from '../lib/api';
import { fenToYuan, formatTimeSmart } from '../lib/format';
import { orderStatusLabel } from '../lib/labels';
import { displayAdminInfo, normalizeUserFacingText } from '../lib/userFacingText';
import { AuditHint, RequestErrorAlert } from '../ui/RequestState';
import { confirmActionWithReason } from '../ui/confirm';

type InvoiceStatus = 'WAIT_APPLY' | 'APPLYING' | 'ISSUED';
type InvoiceStatusFilter = InvoiceStatus | 'ALL';
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

type OrderContext = {
  orderId: string;
  orderStatus: string;
  listingTitle?: string | null;
  applicationNoDisplay?: string | null;
  buyerDisplayName?: string | null;
  sellerDisplayName?: string | null;
  depositAmountFen?: number | null;
  dealAmountFen?: number | null;
  finalAmountFen?: number | null;
};

type InvoiceItem = {
  id?: string;
  orderId?: string;
  status?: string;
  listingTitle?: string | null;
  applicationNoDisplay?: string | null;
  buyerDisplayName?: string | null;
  sellerDisplayName?: string | null;
  invoiceStatus: InvoiceStatus;
  amountFen?: number | null;
  itemName?: string | null;
  invoiceRequest?: InvoiceRequestInfo | null;
  invoiceNo?: string | null;
  issuedAt?: string | null;
  invoiceFileUrl?: string | null;
  requestedAt?: string | null;
  order?: OrderContext | null;
};

type OrderInvoice = {
  orderId: string;
  amountFen?: number;
  itemName?: string;
  invoiceNo?: string;
  issuedAt?: string;
  invoiceFile: FileObject;
  attachedAt?: string;
  updatedAt?: string;
};

type InvoiceIssueResponse = {
  orderId: string;
  invoiceNo: string;
};

type PagedInvoice = {
  items: InvoiceItem[];
  page: { page: number; pageSize: number; total: number };
};

const STATUS_OPTIONS = [
  { value: 'APPLYING', label: '待上传发票' },
  { value: 'ISSUED', label: '已开票' },
  { value: 'WAIT_APPLY', label: '未申请' },
  { value: 'ALL', label: '全部状态' },
];

const TEXT = {
  title: '发票管理',
  subtitle: '集中处理已申请开票但尚未上传电子发票的订单。',
  orderIdPlaceholder: '订单号（可选）',
  loadFailed: '加载失败',
  issueInvoice: '下发开票',
  missingOrderId: '请先选择或输入订单号',
  issueTitle: '确认下发开票？',
  issueContent: '该操作会生成发票号并通知买家，实际电子发票文件仍需上传。',
  issueOk: '下发',
  reasonLabel: '原因/备注',
  issueSuccessPrefix: '已下发开票：',
  issueFailed: '下发失败',
  auditHint: '线下开票完成后再回填电子发票文件；上传、替换和删除都应保留操作依据。',
  uploadFile: '上传发票文件',
  uploadFailed: '上传失败',
  uploadedPrefix: '已上传发票文件',
  currentFilePrefix: '已有发票附件',
  noFile: '未上传文件',
  previewInvoice: '预览发票',
  previewOpening: '打开中...',
  previewNoFile: '暂无发票文件',
  previewFailed: '预览发票失败',
  invoiceNoPlaceholder: '发票号（可选）',
  issuedAtPlaceholder: '开票时间（可选）',
  saveInvoice: '保存发票',
  saveTitle: '确认保存发票？',
  saveContent: '保存后买家可在发票中心查看或下载该发票。',
  saveReasonPlaceholder: '例如：线下开票完成、替换附件、补录发票号等。',
  uploadFirst: '请先上传发票文件',
  saveSuccess: '发票已保存',
  saveFailed: '保存失败',
  deleteInvoice: '删除发票',
  deleteTitle: '确认删除发票？',
  deleteContent: '删除后订单将不再展示该发票附件，请确认已经留存替换或撤销依据。',
  deleteReasonPlaceholder: '例如：附件上传错误、需要替换、订单取消等。',
  deleteSuccess: '发票已删除',
  deleteFailed: '删除失败',
} as const;

function invoiceStatusTag(value?: InvoiceStatus) {
  if (value === 'ISSUED') return <Tag color="green">已开票</Tag>;
  if (value === 'APPLYING') return <Tag color="gold">待上传发票</Tag>;
  return <Tag>未申请</Tag>;
}

function moneyText(value?: number | null): string {
  return value == null ? '-' : `¥${fenToYuan(value)}`;
}

function invoiceTitleTypeLabel(value?: string | null): string {
  if (value === 'ENTERPRISE') return '企业';
  return '个人';
}

function normalizeLegacyInvoiceNo(value?: string | null): string {
  const raw = normalizeUserFacingText(value);
  return /^REQ-/i.test(raw) ? '' : raw;
}

function canProcessInvoice(item?: InvoiceItem | null): item is InvoiceItem {
  return Boolean(item && item.invoiceStatus !== 'WAIT_APPLY');
}

function getInvoiceOrderId(item?: InvoiceItem | null): string {
  return String(item?.orderId || item?.id || item?.order?.orderId || '').trim();
}

function isActiveInvoice(row: InvoiceItem, active?: InvoiceItem | null): boolean {
  const rowOrderId = getInvoiceOrderId(row);
  const activeOrderId = getInvoiceOrderId(active);
  return Boolean(rowOrderId && activeOrderId && rowOrderId === activeOrderId);
}

function extractFileIdFromFileUrl(rawUrl?: string | null): string | null {
  const input = String(rawUrl || '').trim();
  if (!input) return null;
  let pathname = input;
  try {
    pathname = new URL(input).pathname || input;
  } catch {
    pathname = input.split('?')[0] || input;
  }
  const match = pathname.match(/\/files\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:$|\/)/i);
  return match?.[1] || null;
}

export function InvoicesPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [orderId, setOrderId] = useState('');
  const [status, setStatus] = useState<InvoiceStatusFilter>('APPLYING');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown | null>(null);
  const [data, setData] = useState<PagedInvoice | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [active, setActive] = useState<InvoiceItem | null>(null);
  const [invoiceFile, setInvoiceFile] = useState<FileObject | null>(null);
  const [invoiceNo, setInvoiceNo] = useState('');
  const [issuedAt, setIssuedAt] = useState('');
  const [issuing, setIssuing] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const loadSeqRef = useRef(0);
  const issueSeqRef = useRef(0);
  const saveSeqRef = useRef(0);
  const deleteSeqRef = useRef(0);
  const uploadSeqRef = useRef(0);

  useEffect(() => {
    const preset = String(searchParams.get('orderId') || '').trim();
    if (!preset) return;
    setOrderId(preset);
    setStatus('ALL');
    setPage(1);
  }, [searchParams]);

  const resetInvoiceForm = useCallback((item?: InvoiceItem | null) => {
    setInvoiceFile(null);
    setInvoiceNo(normalizeLegacyInvoiceNo(item?.invoiceNo));
    setIssuedAt(item?.issuedAt || '');
  }, []);

  const load = useCallback(async (opts?: { page?: number; pageSize?: number }) => {
    const nextPage = opts?.page ?? page;
    const nextPageSize = opts?.pageSize ?? pageSize;
    const seq = ++loadSeqRef.current;
    setLoading(true);
    setError(null);
    try {
      const next = await apiGet<PagedInvoice>('/admin/invoices', {
        status,
        orderId: orderId.trim() || undefined,
        page: nextPage,
        pageSize: nextPageSize,
      });
      if (seq !== loadSeqRef.current) return;
      setData(next);
      setActive((current) => {
        const currentOrderId = getInvoiceOrderId(current);
        const currentItem = currentOrderId ? next.items.find((it) => getInvoiceOrderId(it) === currentOrderId) : null;
        const selected = canProcessInvoice(currentItem) ? currentItem : null;
        resetInvoiceForm(selected);
        return selected;
      });
    } catch (e: any) {
      if (seq !== loadSeqRef.current) return;
      setError(e);
      setData(null);
      setActive(null);
      message.error(e?.message || TEXT.loadFailed);
    } finally {
      if (seq !== loadSeqRef.current) return;
      setLoading(false);
    }
  }, [orderId, page, pageSize, resetInvoiceForm, status]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [orderId, status]);

  const rows = useMemo(() => data?.items || [], [data?.items]);
  const activeOrderId = getInvoiceOrderId(active);
  const canSave = Boolean(activeOrderId && (invoiceFile?.id || active?.invoiceFileUrl));
  const invoicePreviewUrl = useMemo(
    () => normalizeUserFacingText(invoiceFile?.url) || normalizeUserFacingText(active?.invoiceFileUrl),
    [active?.invoiceFileUrl, invoiceFile?.url],
  );

  const refreshCurrentPage = useCallback(() => {
    void load({ page: data?.page.page || page, pageSize: data?.page.pageSize || pageSize });
  }, [data?.page.page, data?.page.pageSize, load, page, pageSize]);

  const openInvoicePreview = useCallback(async () => {
    if (!invoicePreviewUrl) {
      message.warning(TEXT.previewNoFile);
      return;
    }

    const previewWindow = window.open('about:blank', '_blank');
    if (previewWindow) previewWindow.opener = null;

    setPreviewing(true);
    try {
      const fileId = extractFileIdFromFileUrl(invoicePreviewUrl);
      let previewUrl = invoicePreviewUrl;
      if (fileId) {
        const temp = await apiPost<{ url: string }>(`/files/${fileId}/temporary-access`, {
          scope: 'preview',
          ttlSeconds: 300,
        });
        if (!temp?.url) throw new Error('empty preview url');
        previewUrl = temp.url;
      }

      if (previewWindow) {
        previewWindow.location.href = previewUrl;
      } else {
        window.open(previewUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (e: any) {
      if (previewWindow) previewWindow.close();
      message.error(e?.message || TEXT.previewFailed);
    } finally {
      setPreviewing(false);
    }
  }, [invoicePreviewUrl]);

  return (
    <Card className="admin-invoices-page">
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <div>
          <Typography.Title level={3} style={{ marginTop: 0 }}>
            {TEXT.title}
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            {TEXT.subtitle}
          </Typography.Paragraph>
        </div>

        <Space wrap>
          <Select value={status} options={STATUS_OPTIONS} style={{ width: 160 }} onChange={(v) => setStatus(v as InvoiceStatusFilter)} />
          <Input
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            onPressEnter={() => void load({ page: 1 })}
            allowClear
            style={{ width: 360 }}
            placeholder={TEXT.orderIdPlaceholder}
          />
          <Button onClick={() => void load({ page: 1 })}>查询</Button>
          <Button
            loading={issuing}
            disabled={!activeOrderId && !orderId.trim()}
            onClick={async () => {
              const targetOrderId = activeOrderId || orderId.trim();
              if (!targetOrderId) {
                message.warning(TEXT.missingOrderId);
                return;
              }
              const { ok } = await confirmActionWithReason({
                title: TEXT.issueTitle,
                content: TEXT.issueContent,
                okText: TEXT.issueOk,
                reasonLabel: TEXT.reasonLabel,
              });
              if (!ok) return;
              const seq = ++issueSeqRef.current;
              setIssuing(true);
              try {
                const res = await apiPost<InvoiceIssueResponse>(
                  `/admin/orders/${targetOrderId}/invoice`,
                  {},
                  { idempotencyKey: `invoice-issue-${targetOrderId}` },
                );
                if (seq !== issueSeqRef.current) return;
                message.success(`${TEXT.issueSuccessPrefix}${res.invoiceNo}`);
                refreshCurrentPage();
              } catch (e: any) {
                if (seq !== issueSeqRef.current) return;
                message.error(e?.message || TEXT.issueFailed);
              } finally {
                if (seq !== issueSeqRef.current) return;
                setIssuing(false);
              }
            }}
          >
            {TEXT.issueInvoice}
          </Button>
        </Space>

        {error ? <RequestErrorAlert error={error} onRetry={() => void load()} /> : <AuditHint text={TEXT.auditHint} />}

        <Table<InvoiceItem>
          rowKey={(row) => getInvoiceOrderId(row) || row.invoiceNo || row.requestedAt || row.issuedAt || 'invoice-row'}
          loading={loading}
          dataSource={rows}
          tableLayout="fixed"
          scroll={{ x: 1540 }}
          rowClassName={(row) => (isActiveInvoice(row, active) ? 'ant-table-row-selected' : '')}
          pagination={{
            current: data?.page.page || page,
            pageSize: data?.page.pageSize || pageSize,
            total: data?.page.total || 0,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50'],
            onChange: (nextPage, nextPageSize) => {
              const normalizedPageSize = nextPageSize || pageSize;
              if (normalizedPageSize !== pageSize) {
                setPageSize(normalizedPageSize);
                setPage(1);
                return;
              }
              setPage(nextPage);
            },
          }}
          columns={[
            {
              title: '订单摘要',
              key: 'summary',
              width: 460,
              render: (_, row) => (
                <Space direction="vertical" size={2}>
                  <Typography.Text>{displayAdminInfo(row.order?.listingTitle ?? row.listingTitle, '交易标的待确认')}</Typography.Text>
                  <Typography.Text type="secondary">
                    买方：{displayAdminInfo(row.order?.buyerDisplayName ?? row.buyerDisplayName, '买方待确认')} · 卖方：
                    {displayAdminInfo(row.order?.sellerDisplayName ?? row.sellerDisplayName, '卖方待确认')}
                  </Typography.Text>
                  <Typography.Text type="secondary" copyable={{ text: getInvoiceOrderId(row) }}>
                    订单号：{displayAdminInfo(getInvoiceOrderId(row), '待确认')}
                  </Typography.Text>
                </Space>
              ),
            },
            {
              title: '订单状态',
              key: 'orderStatus',
              width: 96,
              render: (_, row) => (
                <Typography.Text style={{ whiteSpace: 'nowrap' }}>
                  {orderStatusLabel((row.order?.orderStatus ?? row.status) as any)}
                </Typography.Text>
              ),
            },
            { title: '开票状态', dataIndex: 'invoiceStatus', width: 120, render: (v: InvoiceStatus) => invoiceStatusTag(v) },
            {
              title: '开票金额',
              dataIndex: 'amountFen',
              width: 120,
              render: (v?: number | null) => <Typography.Text style={{ whiteSpace: 'nowrap' }}>{moneyText(v)}</Typography.Text>,
            },
            {
              title: '开票抬头',
              key: 'invoiceRequest',
              width: 330,
              render: (_, row) => {
                const request = row.invoiceRequest;
                if (!request) {
                  return row.invoiceStatus === 'APPLYING' ? <Typography.Text type="secondary">历史申请，需联系客服补充</Typography.Text> : '-';
                }
                return (
                  <Space direction="vertical" size={0}>
                    <Typography.Text>
                      {invoiceTitleTypeLabel(request.titleType)} · {displayAdminInfo(request.titleName, '抬头待确认')}
                    </Typography.Text>
                    {request.titleType === 'ENTERPRISE' ? (
                      <Typography.Text type="secondary" copyable={request.taxNo ? { text: request.taxNo } : false}>
                        税号：{displayAdminInfo(request.taxNo, '待确认')}
                      </Typography.Text>
                    ) : null}
                    {normalizeUserFacingText(request.email) ? (
                      <Typography.Text type="secondary" copyable={{ text: request.email || '' }}>
                        邮箱：{request.email}
                      </Typography.Text>
                    ) : null}
                    {normalizeUserFacingText(request.phone) ? (
                      <Typography.Text type="secondary" copyable={{ text: request.phone || '' }}>
                        手机：{request.phone}
                      </Typography.Text>
                    ) : null}
                    {normalizeUserFacingText(request.remark) ? (
                      <Typography.Text type="secondary">备注：{request.remark}</Typography.Text>
                    ) : null}
                  </Space>
                );
              },
            },
            {
              title: '发票信息',
              key: 'invoice',
              width: 180,
              render: (_, row) => (
                <Space direction="vertical" size={0} style={{ minWidth: 150 }}>
                  <Typography.Text style={{ whiteSpace: 'nowrap' }}>
                    {displayAdminInfo(normalizeLegacyInvoiceNo(row.invoiceNo), '发票号待生成')}
                  </Typography.Text>
                  <Typography.Text type="secondary" style={{ whiteSpace: 'nowrap' }}>
                    {row.issuedAt ? formatTimeSmart(row.issuedAt) : '开票时间待确认'}
                  </Typography.Text>
                  {normalizeUserFacingText(row.invoiceFileUrl) ? (
                    <a href={row.invoiceFileUrl || ''} target="_blank" rel="noreferrer">
                      查看附件
                    </a>
                  ) : null}
                </Space>
              ),
            },
            {
              title: '操作',
              key: 'actions',
              width: 150,
              render: (_, row) => (
                <Space wrap>
                  <Button disabled={!getInvoiceOrderId(row)} onClick={() => navigate(`/orders/${getInvoiceOrderId(row)}`)}>
                    查看订单
                  </Button>
                  {canProcessInvoice(row) ? (
                    (() => {
                      const selected = isActiveInvoice(row, active);
                      return (
                        <Button
                          type={selected ? 'primary' : 'default'}
                          onClick={() => {
                            setActive(row);
                            resetInvoiceForm(row);
                          }}
                        >
                          {selected ? '已选中' : '处理发票'}
                        </Button>
                      );
                    })()
                  ) : null}
                </Space>
              ),
            },
          ]}
        />

        <Card size="small" style={{ background: '#fff7ed' }}>
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Typography.Text strong>
              上传/替换发票：{active ? `${displayAdminInfo(active.order?.listingTitle, '交易标的待确认')} / ${moneyText(active.amountFen)}` : '请选择订单'}
            </Typography.Text>
            {active ? (
              <Space direction="vertical" size={2}>
                <Typography.Text type="secondary">
                  开票抬头：
                  {active.invoiceRequest
                    ? `${invoiceTitleTypeLabel(active.invoiceRequest.titleType)} · ${displayAdminInfo(active.invoiceRequest.titleName, '抬头待确认')}`
                    : active.invoiceStatus === 'APPLYING'
                      ? '历史申请，需联系客服补充'
                      : '未申请'}
                </Typography.Text>
                {active.invoiceRequest?.titleType === 'ENTERPRISE' ? (
                  <Typography.Text type="secondary" copyable={active.invoiceRequest.taxNo ? { text: active.invoiceRequest.taxNo } : false}>
                    纳税人识别号：{displayAdminInfo(active.invoiceRequest.taxNo, '待确认')}
                  </Typography.Text>
                ) : null}
                {normalizeUserFacingText(active.invoiceRequest?.email) ? (
                  <Typography.Text type="secondary" copyable={{ text: active.invoiceRequest?.email || '' }}>
                    接收邮箱：{active.invoiceRequest?.email}
                  </Typography.Text>
                ) : null}
                {normalizeUserFacingText(active.invoiceRequest?.phone) ? (
                  <Typography.Text type="secondary" copyable={{ text: active.invoiceRequest?.phone || '' }}>
                    联系手机号：{active.invoiceRequest?.phone}
                  </Typography.Text>
                ) : null}
                {normalizeUserFacingText(active.invoiceRequest?.remark) ? (
                  <Typography.Text type="secondary">备注：{active.invoiceRequest?.remark}</Typography.Text>
                ) : null}
              </Space>
            ) : null}

            <Space wrap>
              <Upload
                maxCount={1}
                showUploadList={false}
                disabled={!activeOrderId}
                customRequest={async (options) => {
                  const targetOrderId = getInvoiceOrderId(active);
                  const seq = ++uploadSeqRef.current;
                  try {
                    const uploaded = await apiUploadFile(options.file as File, 'INVOICE');
                    if (seq !== uploadSeqRef.current || getInvoiceOrderId(active) !== targetOrderId) return;
                    setInvoiceFile(uploaded);
                    options.onSuccess?.(uploaded as any);
                  } catch (e: any) {
                    if (seq !== uploadSeqRef.current || getInvoiceOrderId(active) !== targetOrderId) return;
                    options.onError?.(e);
                    message.error(e?.message || TEXT.uploadFailed);
                  }
                }}
              >
                <Button disabled={!activeOrderId}>{TEXT.uploadFile}</Button>
              </Upload>
              <Button disabled={!invoicePreviewUrl} loading={previewing} onClick={() => void openInvoicePreview()}>
                {previewing ? TEXT.previewOpening : TEXT.previewInvoice}
              </Button>
              <Typography.Text type="secondary">
                {invoiceFile ? TEXT.uploadedPrefix : active?.invoiceFileUrl ? TEXT.currentFilePrefix : TEXT.noFile}
              </Typography.Text>
            </Space>

            <Space wrap>
              <Input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} style={{ width: 260 }} placeholder={TEXT.invoiceNoPlaceholder} />
              <Input value={issuedAt} onChange={(e) => setIssuedAt(e.target.value)} style={{ width: 320 }} placeholder={TEXT.issuedAtPlaceholder} />
              <Button
                type="primary"
                disabled={!canSave}
                onClick={async () => {
                  const targetOrderId = getInvoiceOrderId(active);
                  if (!active || !targetOrderId) return;
                  const fileId = invoiceFile?.id;
                  if (!fileId && !active.invoiceFileUrl) {
                    message.warning(TEXT.uploadFirst);
                    return;
                  }
                  if (!fileId) {
                    message.warning('替换或新开发票时请重新上传发票文件');
                    return;
                  }
                  const { ok } = await confirmActionWithReason({
                    title: TEXT.saveTitle,
                    content: TEXT.saveContent,
                    okText: TEXT.saveInvoice,
                    reasonLabel: TEXT.reasonLabel,
                    reasonPlaceholder: TEXT.saveReasonPlaceholder,
                  });
                  if (!ok) return;
                  const seq = ++saveSeqRef.current;
                  try {
                    await apiPut<OrderInvoice>(
                      `/admin/orders/${targetOrderId}/invoice`,
                      {
                        invoiceFileId: fileId,
                        invoiceNo: invoiceNo || undefined,
                        issuedAt: issuedAt || undefined,
                      },
                      { idempotencyKey: `invoice-${targetOrderId}` },
                    );
                    if (seq !== saveSeqRef.current) return;
                    message.success(TEXT.saveSuccess);
                    refreshCurrentPage();
                  } catch (e: any) {
                    if (seq !== saveSeqRef.current) return;
                    message.error(e?.message || TEXT.saveFailed);
                  }
                }}
              >
                {TEXT.saveInvoice}
              </Button>
              <Button
                danger
                disabled={!activeOrderId || !active?.invoiceFileUrl}
                onClick={async () => {
                  const targetOrderId = getInvoiceOrderId(active);
                  if (!active || !targetOrderId) return;
                  const { ok } = await confirmActionWithReason({
                    title: TEXT.deleteTitle,
                    content: TEXT.deleteContent,
                    okText: TEXT.deleteInvoice,
                    danger: true,
                    reasonLabel: TEXT.reasonLabel,
                    reasonPlaceholder: TEXT.deleteReasonPlaceholder,
                    reasonRequired: true,
                  });
                  if (!ok) return;
                  const seq = ++deleteSeqRef.current;
                  try {
                    await apiDelete(`/admin/orders/${targetOrderId}/invoice`, {
                      idempotencyKey: `invoice-del-${targetOrderId}`,
                    });
                    if (seq !== deleteSeqRef.current) return;
                    message.success(TEXT.deleteSuccess);
                    refreshCurrentPage();
                  } catch (e: any) {
                    if (seq !== deleteSeqRef.current) return;
                    message.error(e?.message || TEXT.deleteFailed);
                  }
                }}
              >
                {TEXT.deleteInvoice}
              </Button>
            </Space>
          </Space>
        </Card>
      </Space>
    </Card>
  );
}
