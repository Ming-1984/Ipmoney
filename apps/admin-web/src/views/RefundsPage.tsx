import { ExportOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Input, Select, Space, Table, Tag, Typography, message } from 'antd';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { apiGet, apiPost } from '../lib/api';
import { fenToYuan, formatTimeSmart } from '../lib/format';
import { orderStatusLabel } from '../lib/labels';
import { displayAdminInfo } from '../lib/userFacingText';
import { AuditHint, RequestErrorAlert } from '../ui/RequestState';
import { confirmActionWithReason } from '../ui/confirm';

type RefundRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'REFUNDING' | 'REFUNDED';
type RefundStatusFilter = RefundRequestStatus | 'ACTIVE' | 'ALL';

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

type RefundRequest = {
  id: string;
  orderId: string;
  reasonCode?: string;
  reasonText?: string;
  status: RefundRequestStatus;
  createdAt: string;
  updatedAt?: string;
  order?: OrderContext | null;
};

type PagedRefundRequest = {
  items: RefundRequest[];
  page: { page: number; pageSize: number; total: number };
};

const WECHAT_PAY_MERCHANT_URL = 'https://pay.weixin.qq.com/';

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: '待处理' },
  { value: 'PENDING', label: '待审核' },
  { value: 'REFUNDING', label: '退款中' },
  { value: 'REFUNDED', label: '已退款' },
  { value: 'REJECTED', label: '已驳回' },
  { value: 'ALL', label: '全部退款' },
];

const TEXT = {
  title: '退款管理',
  subtitle: '集中处理退款申请；默认展示待审核和退款中的退款，支持按订单号直达。',
  orderIdPlaceholder: '订单号（可选）',
  loadFailed: '加载失败',
  actionFailed: '操作失败',
  auditHint: '退款审批涉及资金处理，建议补充审批依据、商户平台退款截图或流水信息。',
  manualNoticeTitle: '当前为人工退款流程',
  manualNotice:
    '通过退款申请只会把系统状态改为“退款中”，不代表已执行资金退款。请复制订单号，到微信支付商户平台按订单号完成原路退款；商户平台退款完成后，再回到这里点击“完成退款”。',
  merchantPlatform: '打开微信支付商户平台',
  copyOrderId: '复制订单号',
  approve: '通过',
  reject: '驳回',
  complete: '完成退款',
  approveTitle: '确认通过退款？',
  approveContent:
    '通过后系统只会进入“退款中”，不会自动执行资金退款。请随后复制订单号，到微信支付商户平台按订单号完成原路退款。',
  approveOk: '确认通过，稍后手动退款',
  approveReason: '同意退款',
  approveReasonLabel: '审批备注',
  approveReasonHint: '建议填写核验依据、责任判断和后续商户平台退款操作人。',
  approveSuccess: '已通过退款申请，已进入退款中',
  rejectTitle: '确认驳回退款？',
  rejectContent: '驳回原因将用于通知和后续争议处理。',
  rejectOk: '确认驳回',
  rejectReasonLabel: '驳回原因',
  rejectReasonPlaceholder: '例如：不符合退款条件，或证据材料不足。',
  rejectFallbackReason: '不符合退款条件',
  rejectSuccess: '已驳回退款申请',
  completeTitle: '确认退款已完成？',
  completeContent: '仅在微信支付商户平台或实际支付渠道已完成退款后点击，否则会导致系统状态与真实资金状态不一致。',
  completeOk: '确认完成',
  completeReason: '退款完成确认',
  completeReasonLabel: '完成备注',
  completeReasonHint: '建议填写退款渠道、商户平台退款单号或截图编号、完成时间。',
  completeSuccess: '退款已完成',
} as const;

function statusTag(status: RefundRequestStatus) {
  if (status === 'APPROVED') return <Tag color="green">已通过</Tag>;
  if (status === 'REJECTED') return <Tag color="red">已驳回</Tag>;
  if (status === 'REFUNDING') return <Tag color="orange">退款中</Tag>;
  if (status === 'REFUNDED') return <Tag color="blue">已退款</Tag>;
  return <Tag color="gold">待处理</Tag>;
}

function moneyText(value?: number | null): string {
  return value == null ? '-' : `¥${fenToYuan(value)}`;
}

export function RefundsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [orderId, setOrderId] = useState('');
  const [status, setStatus] = useState<RefundStatusFilter>('ACTIVE');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown | null>(null);
  const [data, setData] = useState<PagedRefundRequest | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const loadSeqRef = useRef(0);
  const actionSeqRef = useRef(0);

  useEffect(() => {
    const preset = String(searchParams.get('orderId') || '').trim();
    if (!preset) return;
    setOrderId(preset);
    setStatus('ALL');
    setPage(1);
  }, [searchParams]);

  const load = useCallback(async (opts?: { page?: number; pageSize?: number }) => {
    const nextPage = opts?.page ?? page;
    const nextPageSize = opts?.pageSize ?? pageSize;
    const seq = ++loadSeqRef.current;
    setLoading(true);
    setError(null);
    try {
      const next = await apiGet<PagedRefundRequest>('/admin/refund-requests', {
        status,
        orderId: orderId.trim() || undefined,
        page: nextPage,
        pageSize: nextPageSize,
      });
      if (seq !== loadSeqRef.current) return;
      setData(next);
    } catch (e: any) {
      if (seq !== loadSeqRef.current) return;
      setError(e);
      setData(null);
      message.error(e?.message || TEXT.loadFailed);
    } finally {
      if (seq !== loadSeqRef.current) return;
      setLoading(false);
    }
  }, [orderId, page, pageSize, status]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [orderId, status]);

  const rows = useMemo(() => data?.items || [], [data?.items]);

  const refreshAfterAction = useCallback(() => {
    void load({ page: data?.page.page || page, pageSize: data?.page.pageSize || pageSize });
  }, [data?.page.page, data?.page.pageSize, load, page, pageSize]);

  return (
    <Card className="admin-refunds-page">
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <div>
          <Typography.Title level={3} style={{ marginTop: 0 }}>
            {TEXT.title}
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            {TEXT.subtitle}
          </Typography.Paragraph>
        </div>

        <Alert
          type="warning"
          showIcon
          message={TEXT.manualNoticeTitle}
          description={
            <Space direction="vertical" size={8}>
              <Typography.Text>{TEXT.manualNotice}</Typography.Text>
              <Button href={WECHAT_PAY_MERCHANT_URL} target="_blank" rel="noreferrer" icon={<ExportOutlined />}>
                {TEXT.merchantPlatform}
              </Button>
            </Space>
          }
        />

        <Space wrap>
          <Select value={status} options={STATUS_OPTIONS} style={{ width: 150 }} onChange={(v) => setStatus(v as RefundStatusFilter)} />
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

        <Table<RefundRequest>
          rowKey="id"
          loading={loading}
          dataSource={rows}
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
              title: '退款/订单摘要',
              key: 'summary',
              width: 420,
              render: (_, record) => {
                const order = record.order;
                return (
                  <Space direction="vertical" size={2}>
                    <Typography.Text>{displayAdminInfo(order?.listingTitle, '交易标的待确认')}</Typography.Text>
                    <Typography.Text type="secondary">{displayAdminInfo(record.reasonText, '退款原因待确认')}</Typography.Text>
                    <Typography.Text type="secondary">
                      买方：{displayAdminInfo(order?.buyerDisplayName, '买方待确认')} · 卖方：{displayAdminInfo(order?.sellerDisplayName, '卖方待确认')}
                    </Typography.Text>
                    <Typography.Text type="secondary" copyable={{ text: record.orderId, tooltips: [TEXT.copyOrderId, '已复制'] }}>
                      订单号：{record.orderId}
                    </Typography.Text>
                  </Space>
                );
              },
            },
            {
              title: '订单状态',
              key: 'orderStatus',
              render: (_, record) => orderStatusLabel(record.order?.orderStatus as any),
            },
            {
              title: '金额',
              key: 'amount',
              render: (_, record) => (
                <Space direction="vertical" size={0}>
                  <Typography.Text>订金：{moneyText(record.order?.depositAmountFen)}</Typography.Text>
                  <Typography.Text type="secondary">成交：{moneyText(record.order?.dealAmountFen)}</Typography.Text>
                </Space>
              ),
            },
            { title: '退款状态', dataIndex: 'status', render: (value: RefundRequestStatus) => statusTag(value) },
            { title: '申请时间', dataIndex: 'createdAt', render: (value: string) => formatTimeSmart(value) },
            {
              title: '操作',
              key: 'actions',
              width: 310,
              render: (_, record) => {
                const canReview = record.status === 'PENDING';
                const canComplete = record.status === 'REFUNDING';
                return (
                  <Space wrap>
                    <Button onClick={() => navigate(`/orders/${record.orderId}`)}>查看订单</Button>
                    <Button href={WECHAT_PAY_MERCHANT_URL} target="_blank" rel="noreferrer" icon={<ExportOutlined />}>
                      商户平台
                    </Button>
                    <Button
                      type="primary"
                      disabled={!canReview}
                      onClick={async () => {
                        const { ok } = await confirmActionWithReason({
                          title: TEXT.approveTitle,
                          content: TEXT.approveContent,
                          okText: TEXT.approveOk,
                          defaultReason: TEXT.approveReason,
                          reasonLabel: TEXT.approveReasonLabel,
                          reasonHint: TEXT.approveReasonHint,
                        });
                        if (!ok) return;
                        const seq = ++actionSeqRef.current;
                        try {
                          await apiPost<RefundRequest>(`/admin/refund-requests/${record.id}/approve`, {});
                          if (seq !== actionSeqRef.current) return;
                          message.success(TEXT.approveSuccess);
                          refreshAfterAction();
                        } catch (e: any) {
                          if (seq !== actionSeqRef.current) return;
                          message.error(e?.message || TEXT.actionFailed);
                        }
                      }}
                    >
                      {TEXT.approve}
                    </Button>
                    <Button
                      danger
                      disabled={!canReview}
                      onClick={async () => {
                        const { ok, reason } = await confirmActionWithReason({
                          title: TEXT.rejectTitle,
                          content: TEXT.rejectContent,
                          okText: TEXT.rejectOk,
                          danger: true,
                          reasonLabel: TEXT.rejectReasonLabel,
                          reasonPlaceholder: TEXT.rejectReasonPlaceholder,
                          reasonRequired: true,
                        });
                        if (!ok) return;
                        const seq = ++actionSeqRef.current;
                        try {
                          await apiPost<RefundRequest>(`/admin/refund-requests/${record.id}/reject`, {
                            reason: reason || TEXT.rejectFallbackReason,
                          });
                          if (seq !== actionSeqRef.current) return;
                          message.success(TEXT.rejectSuccess);
                          refreshAfterAction();
                        } catch (e: any) {
                          if (seq !== actionSeqRef.current) return;
                          message.error(e?.message || TEXT.actionFailed);
                        }
                      }}
                    >
                      {TEXT.reject}
                    </Button>
                    <Button
                      disabled={!canComplete}
                      onClick={async () => {
                        const { ok, reason } = await confirmActionWithReason({
                          title: TEXT.completeTitle,
                          content: TEXT.completeContent,
                          okText: TEXT.completeOk,
                          defaultReason: TEXT.completeReason,
                          reasonLabel: TEXT.completeReasonLabel,
                          reasonHint: TEXT.completeReasonHint,
                        });
                        if (!ok) return;
                        const seq = ++actionSeqRef.current;
                        try {
                          await apiPost<RefundRequest>(`/admin/refund-requests/${record.id}/complete`, {
                            remark: reason || undefined,
                          });
                          if (seq !== actionSeqRef.current) return;
                          message.success(TEXT.completeSuccess);
                          refreshAfterAction();
                        } catch (e: any) {
                          if (seq !== actionSeqRef.current) return;
                          message.error(e?.message || TEXT.actionFailed);
                        }
                      }}
                    >
                      {TEXT.complete}
                    </Button>
                  </Space>
                );
              },
            },
          ]}
        />
      </Space>
    </Card>
  );
}
