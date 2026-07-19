import {
  Button,
  Card,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { EyeOutlined, FileDoneOutlined, ReloadOutlined } from '@ant-design/icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { apiGet, apiPost } from '../lib/api';
import { fenToYuan, formatTimeSmart, yuanToFen } from '../lib/format';
import { orderStatusLabel } from '../lib/labels';
import { normalizeUserFacingText } from '../lib/userFacingText';
import { AuditHint, RequestErrorAlert } from '../ui/RequestState';

type OrderStatus =
  | 'DEPOSIT_PENDING'
  | 'DEPOSIT_PAID'
  | 'WAIT_FINAL_PAYMENT'
  | 'FINAL_PAID_ESCROW'
  | 'READY_TO_SETTLE'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REFUNDING'
  | 'REFUNDED';

type MilestoneStatus = 'PENDING' | 'DONE' | 'SKIPPED' | 'IN_PROGRESS' | 'FAILED';

type AssignedOrder = {
  id: string;
  listingId?: string | null;
  buyerUserId?: string | null;
  buyerDisplayName?: string | null;
  sellerUserId?: string | null;
  sellerDisplayName?: string | null;
  status: OrderStatus;
  depositAmountFen: number;
  dealAmountFen?: number | null;
  finalAmountFen?: number | null;
  createdAt: string;
  updatedAt?: string;
  listingTitle?: string | null;
  applicationNoDisplay?: string | null;
};

type AssignedOrderDetail = AssignedOrder & {
  milestones?: Array<{
    id: string;
    name: string;
    status: MilestoneStatus;
    createdAt: string;
  }>;
};

type PagedAssignedOrder = {
  items: AssignedOrder[];
  page: { page: number; pageSize: number; total: number };
};

type ContractFormValues = {
  dealAmountYuan?: number;
  remark?: string;
};

const TEXT = {
  title: '我的订单跟进',
  subtitle: '只显示当前账号负责的订单。',
  auditHint: '合同确认会推进订单状态并写入审计日志，请先确认合同签署与成交金额。',
  loadFailed: '加载失败',
  actionFailed: '操作失败',
  refresh: '刷新',
  statusFilter: '订单状态',
  allStatuses: '全部状态',
  orderSummary: '订单摘要',
  status: '状态',
  deposit: '订金',
  dealAmount: '成交额',
  finalAmount: '尾款',
  updatedAt: '更新时间',
  actions: '操作',
  detail: '详情',
  contractConfirm: '确认合同',
  contractModalTitle: '确认合同并填写成交金额',
  contractOk: '确认合同',
  amountRequired: '成交金额必须大于 0',
  dealAmountYuan: '成交金额（元）',
  dealAmountRule: '请输入成交金额',
  amountPlaceholder: '例如 288000',
  remark: '备注/依据',
  remarkPlaceholder: '可填写合同编号、签署时间、归档位置等信息。',
  currentDepositPrefix: '当前订单订金：',
  contractSignedDefault: '合同已签署，成交金额已核对',
  contractSuccess: '合同确认成功',
  detailTitle: '订单详情',
  orderId: '订单号',
  listingTitle: '标的名称',
  applicationNo: '申请号',
  buyer: '买方',
  seller: '卖方',
  createdAt: '创建时间',
  milestones: '关键里程碑',
  noMilestones: '暂无里程碑记录',
  recordTime: '记录时间：',
  empty: '暂无负责订单',
  contractSigned: '合同签署',
  transferSubmitted: '权属提交',
  transferCompleted: '权属变更完成',
  settlementReady: '结算准备',
  settlementPaid: '结算放款',
  done: '已完成',
  skipped: '已跳过',
  inProgress: '进行中',
  failed: '失败',
  pending: '待处理',
} as const;

const STATUS_OPTIONS: Array<{ value: '' | OrderStatus; label: string }> = [
  { value: '', label: TEXT.allStatuses },
  { value: 'DEPOSIT_PENDING', label: orderStatusLabel('DEPOSIT_PENDING') },
  { value: 'DEPOSIT_PAID', label: orderStatusLabel('DEPOSIT_PAID') },
  { value: 'WAIT_FINAL_PAYMENT', label: orderStatusLabel('WAIT_FINAL_PAYMENT') },
  { value: 'FINAL_PAID_ESCROW', label: orderStatusLabel('FINAL_PAID_ESCROW') },
  { value: 'READY_TO_SETTLE', label: orderStatusLabel('READY_TO_SETTLE') },
  { value: 'COMPLETED', label: orderStatusLabel('COMPLETED') },
  { value: 'CANCELLED', label: orderStatusLabel('CANCELLED') },
  { value: 'REFUNDING', label: orderStatusLabel('REFUNDING') },
  { value: 'REFUNDED', label: orderStatusLabel('REFUNDED') },
];

function displayText(value: unknown, fallback = '-'): string {
  return normalizeUserFacingText(value) || fallback;
}

function formatMoney(value?: number | null): string {
  return value == null ? '-' : `¥${fenToYuan(value)}`;
}

function statusTag(status?: OrderStatus | null) {
  if (!status) return '-';
  const color =
    status === 'COMPLETED'
      ? 'green'
      : status === 'CANCELLED' || status === 'REFUNDED'
        ? 'red'
        : status === 'FINAL_PAID_ESCROW' || status === 'READY_TO_SETTLE'
          ? 'blue'
          : 'gold';
  return <Tag color={color}>{orderStatusLabel(status)}</Tag>;
}

function milestoneNameLabel(name?: string | null): string {
  if (name === 'CONTRACT_SIGNED') return TEXT.contractSigned;
  if (name === 'TRANSFER_SUBMITTED') return TEXT.transferSubmitted;
  if (name === 'TRANSFER_COMPLETED') return TEXT.transferCompleted;
  if (name === 'SETTLEMENT_READY') return TEXT.settlementReady;
  if (name === 'SETTLEMENT_PAID') return TEXT.settlementPaid;
  return displayText(name);
}

function milestoneStatusLabel(status?: string | null): string {
  if (status === 'DONE') return TEXT.done;
  if (status === 'SKIPPED') return TEXT.skipped;
  if (status === 'IN_PROGRESS') return TEXT.inProgress;
  if (status === 'FAILED') return TEXT.failed;
  return TEXT.pending;
}

function milestoneStatusColor(status?: string | null): string {
  if (status === 'DONE') return 'green';
  if (status === 'SKIPPED') return 'default';
  if (status === 'IN_PROGRESS') return 'blue';
  if (status === 'FAILED') return 'red';
  return 'gold';
}

export function AssignedOrdersPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown | null>(null);
  const [data, setData] = useState<PagedAssignedOrder | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [status, setStatus] = useState<'' | OrderStatus>('');
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<unknown | null>(null);
  const [detail, setDetail] = useState<AssignedOrderDetail | null>(null);
  const [contractModalOpen, setContractModalOpen] = useState(false);
  const [contractSubmitting, setContractSubmitting] = useState(false);
  const [contractTarget, setContractTarget] = useState<AssignedOrder | null>(null);
  const [contractForm] = Form.useForm<ContractFormValues>();
  const loadSeqRef = useRef(0);
  const detailSeqRef = useRef(0);
  const contractSeqRef = useRef(0);

  const load = useCallback(
    async (opts?: { page?: number; pageSize?: number; status?: '' | OrderStatus }) => {
      const nextPage = opts?.page ?? page;
      const nextPageSize = opts?.pageSize ?? pageSize;
      const nextStatus = opts?.status ?? status;
      const requestSeq = ++loadSeqRef.current;
      setLoading(true);
      setError(null);
      try {
        const next = await apiGet<PagedAssignedOrder>('/admin/orders/assigned', {
          page: nextPage,
          pageSize: nextPageSize,
          status: nextStatus || undefined,
        });
        if (requestSeq !== loadSeqRef.current) return;
        setData(next);
      } catch (e: any) {
        if (requestSeq !== loadSeqRef.current) return;
        setError(e);
        setData(null);
        message.error(e?.message || TEXT.loadFailed);
      } finally {
        if (requestSeq !== loadSeqRef.current) return;
        setLoading(false);
      }
    },
    [page, pageSize, status],
  );

  const loadDetail = useCallback(async (orderId: string) => {
    if (!orderId) return;
    const requestSeq = ++detailSeqRef.current;
    setDetailLoading(true);
    setDetailError(null);
    try {
      const next = await apiGet<AssignedOrderDetail>(`/admin/orders/assigned/${orderId}`);
      if (requestSeq !== detailSeqRef.current) return;
      setDetail(next);
      setDetailOpen(true);
    } catch (e: any) {
      if (requestSeq !== detailSeqRef.current) return;
      setDetailError(e);
      setDetail(null);
      setDetailOpen(true);
      message.error(e?.message || TEXT.loadFailed);
    } finally {
      if (requestSeq !== detailSeqRef.current) return;
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openContractModal = useCallback(
    (order: AssignedOrder) => {
      setContractTarget(order);
      contractForm.resetFields();
      contractForm.setFieldsValue({
        dealAmountYuan: order.dealAmountFen != null ? order.dealAmountFen / 100 : undefined,
        remark: TEXT.contractSignedDefault,
      });
      setContractModalOpen(true);
    },
    [contractForm],
  );

  const submitContract = useCallback(async () => {
    if (!contractTarget) {
      setContractModalOpen(false);
      return;
    }
    const targetOrderId = contractTarget.id;
    const requestSeq = ++contractSeqRef.current;
    try {
      const values = await contractForm.validateFields();
      const dealAmountYuan = Number(values?.dealAmountYuan || 0);
      if (!Number.isFinite(dealAmountYuan) || dealAmountYuan <= 0) {
        message.error(TEXT.amountRequired);
        return;
      }
      setContractSubmitting(true);
      await apiPost(
        `/admin/orders/assigned/${targetOrderId}/milestones/contract-signed`,
        {
          dealAmountFen: yuanToFen(dealAmountYuan),
          signedAt: new Date().toISOString(),
          remark: values?.remark ? String(values.remark).trim() : undefined,
        },
        { idempotencyKey: `assigned-contract-signed-${targetOrderId}` },
      );
      if (requestSeq !== contractSeqRef.current) return;
      message.success(TEXT.contractSuccess);
      setContractModalOpen(false);
      setContractTarget(null);
      contractForm.resetFields();
      await load();
      if (detailOpen && detail?.id === targetOrderId) {
        await loadDetail(targetOrderId);
      }
    } catch (e: any) {
      if (e?.errorFields) return;
      if (requestSeq !== contractSeqRef.current) return;
      message.error(e?.message || TEXT.actionFailed);
    } finally {
      if (requestSeq === contractSeqRef.current) setContractSubmitting(false);
    }
  }, [contractForm, contractTarget, detail?.id, detailOpen, load, loadDetail]);

  const rows = useMemo(() => data?.items || [], [data?.items]);
  const milestones = useMemo(() => detail?.milestones || [], [detail?.milestones]);

  const columns = useMemo<ColumnsType<AssignedOrder>>(
    () => [
      {
        title: TEXT.orderSummary,
        key: 'summary',
        width: 360,
        render: (_, row) => (
          <Space direction="vertical" size={2}>
            <Typography.Text strong>{displayText(row.listingTitle, '交易标的待确认')}</Typography.Text>
            <Typography.Text type="secondary">
              {row.applicationNoDisplay ? `申请号：${displayText(row.applicationNoDisplay)}` : '申请号待确认'}
            </Typography.Text>
            <Typography.Text type="secondary">
              买方：{displayText(row.buyerDisplayName, '买方待确认')} · 卖方：{displayText(row.sellerDisplayName, '卖方待确认')}
            </Typography.Text>
            <Typography.Text type="secondary" copyable={{ text: row.id }}>
              {TEXT.orderId}：{row.id}
            </Typography.Text>
          </Space>
        ),
      },
      {
        title: TEXT.status,
        dataIndex: 'status',
        width: 140,
        render: (value: OrderStatus) => statusTag(value),
      },
      {
        title: TEXT.deposit,
        dataIndex: 'depositAmountFen',
        width: 120,
        render: (value?: number | null) => formatMoney(value),
      },
      {
        title: TEXT.dealAmount,
        dataIndex: 'dealAmountFen',
        width: 120,
        render: (value?: number | null) => formatMoney(value),
      },
      {
        title: TEXT.finalAmount,
        dataIndex: 'finalAmountFen',
        width: 120,
        render: (value?: number | null) => formatMoney(value),
      },
      {
        title: TEXT.updatedAt,
        dataIndex: 'updatedAt',
        width: 150,
        render: (value?: string | null, row?: AssignedOrder) => formatTimeSmart(value || row?.createdAt),
      },
      {
        title: TEXT.actions,
        key: 'actions',
        width: 220,
        fixed: 'right',
        render: (_, row) => (
          <Space wrap>
            <Button icon={<EyeOutlined />} onClick={() => void loadDetail(row.id)}>
              {TEXT.detail}
            </Button>
            <Button
              type="primary"
              icon={<FileDoneOutlined />}
              disabled={row.status !== 'DEPOSIT_PAID'}
              onClick={() => openContractModal(row)}
            >
              {TEXT.contractConfirm}
            </Button>
          </Space>
        ),
      },
    ],
    [loadDetail, openContractModal],
  );

  return (
    <Card className="admin-assigned-orders-page">
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Space align="start" style={{ width: '100%', justifyContent: 'space-between' }} wrap>
          <div>
            <Typography.Title level={3} style={{ marginTop: 0 }}>
              {TEXT.title}
            </Typography.Title>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
              {TEXT.subtitle}
            </Typography.Paragraph>
          </div>
          <Space wrap>
            <Select
              aria-label={TEXT.statusFilter}
              value={status}
              options={STATUS_OPTIONS}
              style={{ width: 180 }}
              onChange={(nextStatus) => {
                setStatus(nextStatus);
                setPage(1);
              }}
            />
            <Button icon={<ReloadOutlined />} onClick={() => void load()}>
              {TEXT.refresh}
            </Button>
          </Space>
        </Space>

        {error ? <RequestErrorAlert error={error} onRetry={() => void load()} /> : <AuditHint text={TEXT.auditHint} />}

        <Table<AssignedOrder>
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={rows}
          locale={{ emptyText: <Empty description={TEXT.empty} /> }}
          scroll={{ x: 1240 }}
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
        />
      </Space>

      <Drawer
        open={detailOpen}
        title={TEXT.detailTitle}
        width={720}
        onClose={() => {
          setDetailOpen(false);
          setDetail(null);
          setDetailError(null);
        }}
        extra={
          detail ? (
            <Button icon={<ReloadOutlined />} onClick={() => void loadDetail(detail.id)}>
              {TEXT.refresh}
            </Button>
          ) : null
        }
      >
        {detailError ? <RequestErrorAlert error={detailError} onRetry={() => detail?.id && void loadDetail(detail.id)} /> : null}
        <Card loading={detailLoading} size="small">
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label={TEXT.orderId}>
              <Typography.Text copyable={{ text: displayText(detail?.id, '') }}>{displayText(detail?.id)}</Typography.Text>
            </Descriptions.Item>
            <Descriptions.Item label={TEXT.status}>{statusTag(detail?.status)}</Descriptions.Item>
            <Descriptions.Item label={TEXT.listingTitle}>{displayText(detail?.listingTitle, '交易标的待确认')}</Descriptions.Item>
            <Descriptions.Item label={TEXT.applicationNo}>{displayText(detail?.applicationNoDisplay)}</Descriptions.Item>
            <Descriptions.Item label={TEXT.buyer}>{displayText(detail?.buyerDisplayName, '买方待确认')}</Descriptions.Item>
            <Descriptions.Item label={TEXT.seller}>{displayText(detail?.sellerDisplayName, '卖方待确认')}</Descriptions.Item>
            <Descriptions.Item label={TEXT.deposit}>{formatMoney(detail?.depositAmountFen)}</Descriptions.Item>
            <Descriptions.Item label={TEXT.dealAmount}>{formatMoney(detail?.dealAmountFen)}</Descriptions.Item>
            <Descriptions.Item label={TEXT.finalAmount}>{formatMoney(detail?.finalAmountFen)}</Descriptions.Item>
            <Descriptions.Item label={TEXT.createdAt}>{formatTimeSmart(detail?.createdAt)}</Descriptions.Item>
            <Descriptions.Item label={TEXT.updatedAt}>{formatTimeSmart(detail?.updatedAt)}</Descriptions.Item>
          </Descriptions>

          <Space style={{ marginTop: 16 }} wrap>
            <Button
              type="primary"
              icon={<FileDoneOutlined />}
              disabled={detail?.status !== 'DEPOSIT_PAID'}
              onClick={() => detail && openContractModal(detail)}
            >
              {TEXT.contractConfirm}
            </Button>
          </Space>
        </Card>

        <Card title={TEXT.milestones} size="small" style={{ marginTop: 16 }}>
          {milestones.length ? (
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              {milestones.map((milestone) => (
                <Card key={milestone.id} size="small">
                  <Space direction="vertical" size={4} style={{ width: '100%' }}>
                    <Space align="center" style={{ justifyContent: 'space-between', width: '100%' }}>
                      <Typography.Text strong>{milestoneNameLabel(milestone.name)}</Typography.Text>
                      <Tag color={milestoneStatusColor(milestone.status)}>{milestoneStatusLabel(milestone.status)}</Tag>
                    </Space>
                    <Typography.Text type="secondary">
                      {TEXT.recordTime}
                      {formatTimeSmart(milestone.createdAt)}
                    </Typography.Text>
                  </Space>
                </Card>
              ))}
            </Space>
          ) : (
            <Typography.Text type="secondary">{TEXT.noMilestones}</Typography.Text>
          )}
        </Card>
      </Drawer>

      <Modal
        open={contractModalOpen}
        title={TEXT.contractModalTitle}
        okText={TEXT.contractOk}
        okButtonProps={{ loading: contractSubmitting }}
        onCancel={() => {
          setContractModalOpen(false);
          setContractTarget(null);
          contractForm.resetFields();
        }}
        onOk={() => void submitContract()}
      >
        <Form form={contractForm} layout="vertical">
          <Form.Item
            label={TEXT.dealAmountYuan}
            name="dealAmountYuan"
            rules={[{ required: true, message: TEXT.dealAmountRule }]}
          >
            <InputNumber min={0} precision={2} style={{ width: '100%' }} placeholder={TEXT.amountPlaceholder} />
          </Form.Item>
          <Form.Item label={TEXT.remark} name="remark">
            <Input.TextArea rows={3} placeholder={TEXT.remarkPlaceholder} />
          </Form.Item>
          {contractTarget ? (
            <Typography.Text type="secondary">
              {TEXT.currentDepositPrefix}
              {formatMoney(contractTarget.depositAmountFen)}
            </Typography.Text>
          ) : null}
        </Form>
      </Modal>
    </Card>
  );
}
