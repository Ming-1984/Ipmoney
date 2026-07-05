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
  orderId: string;
  id?: string;
  invoiceStatus: InvoiceStatus;
  amountFen?: number | null;
  itemName?: string | null;
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

function canProcessInvoice(item?: InvoiceItem | null): item is InvoiceItem {
  return Boolean(item && item.invoiceStatus !== 'WAIT_APPLY');
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
    setInvoiceNo(item?.invoiceNo || '');
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
        const currentItem = current ? next.items.find((it) => it.orderId === current.orderId) : null;
        const selected = canProcessInvoice(currentItem) ? currentItem : next.items.find(canProcessInvoice);
        resetInvoiceForm(selected || null);
        return selected || null;
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
  const canSave = Boolean(active?.orderId && (invoiceFile?.id || active?.invoiceFileUrl));

  const refreshCurrentPage = useCallback(() => {
    void load({ page: data?.page.page || page, pageSize: data?.page.pageSize || pageSize });
  }, [data?.page.page, data?.page.pageSize, load, page, pageSize]);

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
            disabled={!active?.orderId && !orderId.trim()}
            onClick={async () => {
              const targetOrderId = active?.orderId || orderId.trim();
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
          rowKey="orderId"
          loading={loading}
          dataSource={rows}
          rowClassName={(row) => (row.orderId === active?.orderId ? 'ant-table-row-selected' : '')}
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
              width: 430,
              render: (_, row) => (
                <Space direction="vertical" size={2}>
                  <Typography.Text>{displayAdminInfo(row.order?.listingTitle, '交易标的待确认')}</Typography.Text>
                  <Typography.Text type="secondary">
                    买方：{displayAdminInfo(row.order?.buyerDisplayName, '买方待确认')} · 卖方：{displayAdminInfo(row.order?.sellerDisplayName, '卖方待确认')}
                  </Typography.Text>
                  <Typography.Text type="secondary" copyable={{ text: row.orderId }}>
                    订单号：{row.orderId}
                  </Typography.Text>
                </Space>
              ),
            },
            { title: '订单状态', key: 'orderStatus', render: (_, row) => orderStatusLabel(row.order?.orderStatus as any) },
            { title: '开票状态', dataIndex: 'invoiceStatus', render: (v: InvoiceStatus) => invoiceStatusTag(v) },
            { title: '开票金额', dataIndex: 'amountFen', render: (v?: number | null) => moneyText(v) },
            {
              title: '发票信息',
              key: 'invoice',
              render: (_, row) => (
                <Space direction="vertical" size={0}>
                  <Typography.Text>{displayAdminInfo(row.invoiceNo, '发票号待生成')}</Typography.Text>
                  <Typography.Text type="secondary">{row.issuedAt ? formatTimeSmart(row.issuedAt) : '开票时间待确认'}</Typography.Text>
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
              width: 210,
              render: (_, row) => (
                <Space wrap>
                  <Button onClick={() => navigate(`/orders/${row.orderId}`)}>查看订单</Button>
                  {canProcessInvoice(row) ? (
                    <Button
                      type={row.orderId === active?.orderId ? 'primary' : 'default'}
                      onClick={() => {
                        setActive(row);
                        resetInvoiceForm(row);
                      }}
                    >
                      处理发票
                    </Button>
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

            <Space wrap>
              <Upload
                maxCount={1}
                showUploadList={false}
                disabled={!active}
                customRequest={async (options) => {
                  const targetOrderId = active?.orderId || '';
                  const seq = ++uploadSeqRef.current;
                  try {
                    const uploaded = await apiUploadFile(options.file as File, 'INVOICE');
                    if (seq !== uploadSeqRef.current || active?.orderId !== targetOrderId) return;
                    setInvoiceFile(uploaded);
                    options.onSuccess?.(uploaded as any);
                  } catch (e: any) {
                    if (seq !== uploadSeqRef.current || active?.orderId !== targetOrderId) return;
                    options.onError?.(e);
                    message.error(e?.message || TEXT.uploadFailed);
                  }
                }}
              >
                <Button disabled={!active}>{TEXT.uploadFile}</Button>
              </Upload>
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
                  if (!active?.orderId) return;
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
                      `/admin/orders/${active.orderId}/invoice`,
                      {
                        invoiceFileId: fileId,
                        invoiceNo: invoiceNo || undefined,
                        issuedAt: issuedAt || undefined,
                      },
                      { idempotencyKey: `invoice-${active.orderId}` },
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
                disabled={!active?.invoiceFileUrl}
                onClick={async () => {
                  if (!active?.orderId) return;
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
                    await apiDelete(`/admin/orders/${active.orderId}/invoice`, {
                      idempotencyKey: `invoice-del-${active.orderId}`,
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
