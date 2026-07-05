import { Button, Card, Input, Select, Space, Table, Tag, Typography, Upload, message } from 'antd';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { apiGet, apiPost, apiUploadFile, type FileObject } from '../lib/api';
import { fenToYuan, formatTimeSmart } from '../lib/format';
import { orderStatusLabel } from '../lib/labels';
import { displayAdminInfo } from '../lib/userFacingText';
import { AuditHint, RequestErrorAlert } from '../ui/RequestState';
import { confirmActionWithReason } from '../ui/confirm';

type PayoutStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED';

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

type Settlement = {
  id?: string | null;
  orderId: string;
  grossAmountFen: number;
  commissionAmountFen: number;
  payoutAmountFen: number;
  payoutMethod?: 'MANUAL' | 'WECHAT' | string | null;
  payoutStatus: PayoutStatus;
  payoutRef?: string | null;
  payoutEvidenceFileId?: string | null;
  payoutAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  order?: OrderContext | null;
};

type PagedSettlement = {
  items: Settlement[];
  page: { page: number; pageSize: number; total: number };
};

const STATUS_OPTIONS = [
  { value: 'PENDING', label: '待放款' },
  { value: 'FAILED', label: '放款失败' },
  { value: 'SUCCEEDED', label: '已放款' },
  { value: '', label: '全部结算' },
];

const TEXT = {
  title: '放款/结算',
  subtitle: '默认展示待放款订单；财务上传凭证后确认线下放款。',
  orderIdPlaceholder: '订单号（可选）',
  loadFailed: '加载失败',
  auditHint: '放款确认涉及资金出账，建议二次确认并上传凭证留痕。',
  uploadEvidence: '上传放款凭证',
  uploadFailed: '上传失败',
  uploadedPrefix: '已上传放款凭证',
  noUploadedFile: '未上传',
  payoutRefPlaceholder: '放款流水号（可选）',
  remarkPlaceholder: '备注（可选）',
  uploadFirst: '请先上传放款凭证',
  payoutTitle: '确认已线下放款？',
  payoutContent: '该操作将记录凭证文件与放款信息，请确保已核验订单状态与放款凭证。',
  payoutOk: '确认放款',
  payoutReasonLabel: '放款备注/依据',
  payoutReasonHint: '建议写明放款凭证要点、核验项与操作人信息，便于后续对账与争议处理。',
  payoutSuccess: '已确认放款',
  actionFailed: '操作失败',
} as const;

function payoutMethodLabel(value?: Settlement['payoutMethod']): string {
  if (value === 'MANUAL') return '线下打款';
  if (value === 'WECHAT') return '微信打款';
  return '待确认';
}

function payoutStatusTag(value?: PayoutStatus) {
  if (value === 'SUCCEEDED') return <Tag color="green">已放款</Tag>;
  if (value === 'FAILED') return <Tag color="red">放款失败</Tag>;
  return <Tag color="gold">待放款</Tag>;
}

function moneyText(value?: number | null): string {
  return value == null ? '-' : `¥${fenToYuan(value)}`;
}

export function SettlementsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [orderId, setOrderId] = useState('');
  const [payoutStatus, setPayoutStatus] = useState<PayoutStatus | ''>('PENDING');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown | null>(null);
  const [data, setData] = useState<PagedSettlement | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [active, setActive] = useState<Settlement | null>(null);
  const [payoutEvidenceFile, setPayoutEvidenceFile] = useState<FileObject | null>(null);
  const [payoutRef, setPayoutRef] = useState('');
  const [remark, setRemark] = useState('');
  const loadSeqRef = useRef(0);
  const payoutSeqRef = useRef(0);
  const uploadSeqRef = useRef(0);

  useEffect(() => {
    const preset = String(searchParams.get('orderId') || '').trim();
    if (!preset) return;
    setOrderId(preset);
    setPayoutStatus('');
    setPage(1);
  }, [searchParams]);

  const resetPayoutForm = useCallback(() => {
    setPayoutEvidenceFile(null);
    setPayoutRef('');
    setRemark('');
  }, []);

  const load = useCallback(async (opts?: { page?: number; pageSize?: number }) => {
    const nextPage = opts?.page ?? page;
    const nextPageSize = opts?.pageSize ?? pageSize;
    const seq = ++loadSeqRef.current;
    setLoading(true);
    setError(null);
    try {
      const next = await apiGet<PagedSettlement>('/admin/settlements', {
        payoutStatus: payoutStatus || undefined,
        orderId: orderId.trim() || undefined,
        page: nextPage,
        pageSize: nextPageSize,
      });
      if (seq !== loadSeqRef.current) return;
      setData(next);
      setActive((current) => {
        if (!current) return next.items[0] || null;
        return next.items.find((it) => it.orderId === current.orderId) || next.items[0] || null;
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
  }, [orderId, page, pageSize, payoutStatus]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [orderId, payoutStatus]);

  const rows = useMemo(() => data?.items || [], [data?.items]);
  const payoutDisabled = !active || active.payoutStatus === 'SUCCEEDED' || !payoutEvidenceFile?.id;

  return (
    <Card className="admin-settlements-page">
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
          <Select value={payoutStatus} options={STATUS_OPTIONS} style={{ width: 150 }} onChange={(v) => setPayoutStatus(v as PayoutStatus | '')} />
          <Input
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            onPressEnter={() => void load({ page: 1 })}
            allowClear
            style={{ width: 360 }}
            placeholder={TEXT.orderIdPlaceholder}
          />
          <Button onClick={() => void load({ page: 1 })}>查询</Button>
        </Space>

        {error ? <RequestErrorAlert error={error} onRetry={() => void load()} /> : <AuditHint text={TEXT.auditHint} />}

        <Table<Settlement>
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
            {
              title: '结算金额',
              key: 'amounts',
              render: (_, row) => (
                <Space direction="vertical" size={0}>
                  <Typography.Text>应放款：{moneyText(row.payoutAmountFen)}</Typography.Text>
                  <Typography.Text type="secondary">佣金：{moneyText(row.commissionAmountFen)}</Typography.Text>
                </Space>
              ),
            },
            { title: '放款方式', dataIndex: 'payoutMethod', render: (v) => payoutMethodLabel(v) },
            { title: '状态', dataIndex: 'payoutStatus', render: (v: PayoutStatus) => payoutStatusTag(v) },
            { title: '更新时间', dataIndex: 'updatedAt', render: (v?: string | null) => formatTimeSmart(v) },
            {
              title: '操作',
              key: 'actions',
              width: 210,
              render: (_, row) => (
                <Space wrap>
                  <Button onClick={() => navigate(`/orders/${row.orderId}`)}>查看订单</Button>
                  <Button
                    type={row.orderId === active?.orderId ? 'primary' : 'default'}
                    disabled={row.payoutStatus === 'SUCCEEDED'}
                    onClick={() => {
                      setActive(row);
                      resetPayoutForm();
                    }}
                  >
                    处理放款
                  </Button>
                </Space>
              ),
            },
          ]}
        />

        <Card size="small" style={{ background: '#fff7ed' }}>
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Typography.Text strong>
              财务放款确认：{active ? `${displayAdminInfo(active.order?.listingTitle, '交易标的待确认')} / ${moneyText(active.payoutAmountFen)}` : '请选择待放款订单'}
            </Typography.Text>

            <Space wrap>
              <Upload
                maxCount={1}
                showUploadList={false}
                disabled={!active || active.payoutStatus === 'SUCCEEDED'}
                customRequest={async (options) => {
                  const targetOrderId = active?.orderId || '';
                  const requestSeq = ++uploadSeqRef.current;
                  try {
                    const uploaded = await apiUploadFile(options.file as File, 'PAYOUT_EVIDENCE');
                    if (uploadSeqRef.current !== requestSeq || active?.orderId !== targetOrderId) return;
                    setPayoutEvidenceFile(uploaded);
                    options.onSuccess?.(uploaded as any);
                  } catch (e: any) {
                    if (uploadSeqRef.current !== requestSeq || active?.orderId !== targetOrderId) return;
                    options.onError?.(e);
                    message.error(e?.message || TEXT.uploadFailed);
                  }
                }}
              >
                <Button disabled={!active || active.payoutStatus === 'SUCCEEDED'}>{TEXT.uploadEvidence}</Button>
              </Upload>
              <Typography.Text type="secondary">{payoutEvidenceFile ? TEXT.uploadedPrefix : TEXT.noUploadedFile}</Typography.Text>
            </Space>

            <Space wrap>
              <Input value={payoutRef} onChange={(e) => setPayoutRef(e.target.value)} style={{ width: 320 }} placeholder={TEXT.payoutRefPlaceholder} />
              <Input value={remark} onChange={(e) => setRemark(e.target.value)} style={{ width: 420 }} placeholder={TEXT.remarkPlaceholder} />
              <Button
                type="primary"
                disabled={payoutDisabled}
                onClick={async () => {
                  if (!active) return;
                  if (!payoutEvidenceFile?.id) {
                    message.warning(TEXT.uploadFirst);
                    return;
                  }
                  const { ok, reason } = await confirmActionWithReason({
                    title: TEXT.payoutTitle,
                    content: TEXT.payoutContent,
                    okText: TEXT.payoutOk,
                    defaultReason: remark || '',
                    reasonLabel: TEXT.payoutReasonLabel,
                    reasonHint: TEXT.payoutReasonHint,
                  });
                  if (!ok) return;
                  const seq = ++payoutSeqRef.current;
                  try {
                    const finalRemark = (remark || reason || '').trim() || undefined;
                    await apiPost<Settlement>(
                      `/admin/orders/${active.orderId}/payouts/manual`,
                      {
                        payoutEvidenceFileId: payoutEvidenceFile.id,
                        payoutRef: payoutRef || undefined,
                        payoutAt: new Date().toISOString(),
                        remark: finalRemark,
                      },
                      { idempotencyKey: `payout-${active.orderId}` },
                    );
                    if (seq !== payoutSeqRef.current) return;
                    message.success(TEXT.payoutSuccess);
                    resetPayoutForm();
                    void load({ page: data?.page.page || page, pageSize: data?.page.pageSize || pageSize });
                  } catch (e: any) {
                    if (seq !== payoutSeqRef.current) return;
                    message.error(e?.message || TEXT.actionFailed);
                  }
                }}
              >
                确认放款
              </Button>
            </Space>
          </Space>
        </Card>
      </Space>
    </Card>
  );
}
