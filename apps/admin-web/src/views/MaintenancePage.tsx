import {
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Timeline,
  Typography,
  Upload,
  message,
} from 'antd';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { apiGet, apiPatch, apiPost, apiUploadFile, type FileObject } from '../lib/api';
import { formatTimeSmart } from '../lib/format';
import { normalizeUserFacingText } from '../lib/userFacingText';
import { RequestErrorAlert } from '../ui/RequestState';
import { confirmActionWithReason } from '../ui/confirm';

type Paged<T> = {
  items: T[];
  page: { page: number; pageSize: number; total: number };
};

type ScheduleStatus = 'DUE' | 'PAID' | 'OVERDUE' | 'WAIVED';
type TaskStatus = 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
type OrderStatus =
  | 'REQUESTED'
  | 'QUOTED'
  | 'AWAITING_PAYMENT'
  | 'PAID'
  | 'EXECUTING'
  | 'RECEIPT_UPLOADED'
  | 'RECONCILED'
  | 'CLOSED'
  | 'CANCELLED';
type PaymentChannel = 'WECHAT' | 'OFFLINE_BANK' | 'OFFLINE_OTHER';
type ReconcileStatus = 'PENDING' | 'MATCHED' | 'MISMATCHED';

type Schedule = {
  id: string;
  patentId: string;
  yearNo: number;
  dueDate: string;
  gracePeriodEnd?: string | null;
  status: ScheduleStatus;
  createdAt: string;
  updatedAt?: string;
};

type Task = {
  id: string;
  scheduleId: string;
  assignedCsUserId?: string | null;
  status: TaskStatus;
  note?: string | null;
  evidenceFileId?: string | null;
  createdAt: string;
  updatedAt?: string;
};

type MaintenanceOrder = {
  id: string;
  scheduleId: string;
  applicantUserId: string;
  assignedCsUserId?: string | null;
  status: OrderStatus;
  paymentChannel?: PaymentChannel | null;
  officialFeeFen: number;
  lateFeeFen: number;
  serviceFeeFen: number;
  totalAmountFen: number;
  paymentDeadline?: string;
  paidAt?: string;
  executedAt?: string;
  receiptIssuedAt?: string;
  officialSubmissionNo?: string;
  officialReceiptNo?: string;
  paymentTxnNo?: string;
  officialReceiptFileId?: string;
  reconcileStatus: ReconcileStatus;
  reconcileNote?: string;
  closeNote?: string;
  patentTitle?: string;
  applicationNoDisplay?: string;
  scheduleYearNo?: number;
  scheduleDueDate?: string;
  createdAt: string;
  updatedAt?: string;
};

type MaintenanceOrderEvent = {
  id: string;
  orderId: string;
  actorUserId?: string;
  actorNickname?: string;
  actorRole?: string;
  eventType: string;
  fromStatus?: string;
  toStatus: string;
  note?: string;
  payloadJson?: unknown;
  createdAt: string;
};

type ScheduleFilters = {
  patentId: string;
  status?: ScheduleStatus;
  dueFrom: string;
  dueTo: string;
};

type TaskFilters = {
  scheduleId: string;
  assignedCsUserId: string;
  status?: TaskStatus;
};

type OrderFilters = {
  scheduleId: string;
  applicantUserId: string;
  assignedCsUserId: string;
  status?: OrderStatus;
  reconcileStatus?: ReconcileStatus;
};

type ActionType = 'QUOTE' | 'PAY' | 'EXECUTE' | 'RECEIPT' | 'RECONCILE' | 'CLOSE' | 'CANCEL';

const SCHEDULE_STATUS_OPTIONS: Array<{ value: ScheduleStatus; label: string }> = [
  { value: 'DUE', label: '应缴' },
  { value: 'PAID', label: '已缴' },
  { value: 'OVERDUE', label: '逾期' },
  { value: 'WAIVED', label: '豁免' },
];

const TASK_STATUS_OPTIONS: Array<{ value: TaskStatus; label: string }> = [
  { value: 'OPEN', label: '待处理' },
  { value: 'IN_PROGRESS', label: '处理中' },
  { value: 'DONE', label: '已完成' },
  { value: 'CANCELLED', label: '已取消' },
];

const ORDER_STATUS_OPTIONS: Array<{ value: OrderStatus; label: string }> = [
  { value: 'REQUESTED', label: '已发起' },
  { value: 'QUOTED', label: '已报价' },
  { value: 'AWAITING_PAYMENT', label: '待支付' },
  { value: 'PAID', label: '已支付' },
  { value: 'EXECUTING', label: '办理中' },
  { value: 'RECEIPT_UPLOADED', label: '回执已上传' },
  { value: 'RECONCILED', label: '已对账' },
  { value: 'CLOSED', label: '已关闭' },
  { value: 'CANCELLED', label: '已取消' },
];

const RECONCILE_STATUS_OPTIONS: Array<{ value: ReconcileStatus; label: string }> = [
  { value: 'PENDING', label: '待对账' },
  { value: 'MATCHED', label: '已匹配' },
  { value: 'MISMATCHED', label: '不一致' },
];

const PAYMENT_CHANNEL_OPTIONS: Array<{ value: PaymentChannel; label: string }> = [
  { value: 'WECHAT', label: '微信支付' },
  { value: 'OFFLINE_BANK', label: '线下银行转账' },
  { value: 'OFFLINE_OTHER', label: '线下其他' },
];

function formatMoneyFen(value?: number): string {
  return `¥${((Number(value ?? 0)) / 100).toFixed(2)}`;
}

function formatDateTime(value?: string | null): string {
  if (!value) return '待确认';
  return formatTimeSmart(value);
}

function displayUserFacingText(value: unknown, fallback = '待补充'): string {
  return normalizeUserFacingText(value) || fallback;
}

function statusLabel<T extends string>(value: T | undefined, options: Array<{ value: T; label: string }>): string {
  if (!value) return '待确认';
  return options.find((it) => it.value === value)?.label || '待确认';
}

function scheduleStatusTag(status: ScheduleStatus) {
  if (status === 'PAID') return <Tag color="green">已缴</Tag>;
  if (status === 'OVERDUE') return <Tag color="red">逾期</Tag>;
  if (status === 'WAIVED') return <Tag color="default">豁免</Tag>;
  return <Tag color="gold">应缴</Tag>;
}

function taskStatusTag(status: TaskStatus) {
  if (status === 'DONE') return <Tag color="green">已完成</Tag>;
  if (status === 'IN_PROGRESS') return <Tag color="blue">处理中</Tag>;
  if (status === 'CANCELLED') return <Tag color="default">已取消</Tag>;
  return <Tag color="gold">待处理</Tag>;
}

function orderStatusTag(status: OrderStatus) {
  if (status === 'CLOSED') return <Tag color="green">已关闭</Tag>;
  if (status === 'CANCELLED') return <Tag color="default">已取消</Tag>;
  if (status === 'RECONCILED') return <Tag color="cyan">已对账</Tag>;
  if (status === 'RECEIPT_UPLOADED') return <Tag color="blue">回执已上传</Tag>;
  if (status === 'EXECUTING') return <Tag color="processing">办理中</Tag>;
  if (status === 'PAID') return <Tag color="geekblue">已支付</Tag>;
  if (status === 'AWAITING_PAYMENT') return <Tag color="orange">待支付</Tag>;
  if (status === 'QUOTED') return <Tag color="purple">已报价</Tag>;
  return <Tag color="gold">已发起</Tag>;
}

function reconcileStatusTag(status: ReconcileStatus) {
  if (status === 'MATCHED') return <Tag color="green">已匹配</Tag>;
  if (status === 'MISMATCHED') return <Tag color="red">不一致</Tag>;
  return <Tag color="default">待对账</Tag>;
}

function calcScheduleUrgency(row: Schedule): 'OVERDUE' | 'DUE_SOON' | 'UPCOMING' | 'NORMAL' | 'SETTLED' {
  if (row.status === 'PAID' || row.status === 'WAIVED') return 'SETTLED';
  const due = new Date(`${row.dueDate}T00:00:00`);
  if (Number.isNaN(due.getTime())) return 'NORMAL';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((due.getTime() - today.getTime()) / 86400000);
  if (diffDays < 0) return 'OVERDUE';
  if (diffDays <= 7) return 'DUE_SOON';
  if (diffDays <= 30) return 'UPCOMING';
  return 'NORMAL';
}

function urgencyTag(value: 'OVERDUE' | 'DUE_SOON' | 'UPCOMING' | 'NORMAL' | 'SETTLED') {
  if (value === 'OVERDUE') return <Tag color="red">已逾期</Tag>;
  if (value === 'DUE_SOON') return <Tag color="orange">7天内到期</Tag>;
  if (value === 'UPCOMING') return <Tag color="blue">30天内到期</Tag>;
  if (value === 'SETTLED') return <Tag color="green">已结清</Tag>;
  return <Tag color="default">正常</Tag>;
}

function getOrderActionCandidates(order: MaintenanceOrder): ActionType[] {
  const actions: ActionType[] = [];
  if (['REQUESTED', 'QUOTED', 'AWAITING_PAYMENT'].includes(order.status)) actions.push('QUOTE');
  if (order.status === 'AWAITING_PAYMENT') actions.push('PAY');
  if (order.status === 'PAID') actions.push('EXECUTE');
  if (order.status === 'EXECUTING') actions.push('RECEIPT');
  if (order.status === 'RECEIPT_UPLOADED' || order.status === 'RECONCILED') actions.push('RECONCILE');
  if (order.status === 'RECONCILED' && order.reconcileStatus === 'MATCHED') actions.push('CLOSE');
  if (['REQUESTED', 'QUOTED', 'AWAITING_PAYMENT', 'PAID'].includes(order.status)) actions.push('CANCEL');
  return actions;
}

function actionLabel(action: ActionType): string {
  if (action === 'QUOTE') return '报价';
  if (action === 'PAY') return '标记已支付';
  if (action === 'EXECUTE') return '提交办理';
  if (action === 'RECEIPT') return '上传回执';
  if (action === 'RECONCILE') return '对账';
  if (action === 'CLOSE') return '关闭订单';
  return '取消订单';
}

function orderStatusCn(status?: string): string {
  if (!status) return '状态待确认';
  return ORDER_STATUS_OPTIONS.find((it) => it.value === status)?.label || '状态待确认';
}

function orderEventTypeCn(eventType?: string): string {
  if (!eventType) return '状态更新';
  if (eventType === 'CREATED') return '已创建';
  if (eventType === 'QUOTE_UPDATED') return '报价更新';
  if (eventType === 'PAYMENT_CONFIRMED') return '支付已确认';
  if (eventType === 'EXECUTION_SUBMITTED') return '办理已提交';
  if (eventType === 'RECEIPT_UPLOADED') return '回执已上传';
  if (eventType === 'RECONCILED') return '已对账';
  if (eventType === 'CLOSED') return '已关闭';
  if (eventType === 'CANCELLED') return '已取消';
  return '状态更新';
}

function actorRoleCn(role?: string): string {
  const normalized = String(role || '')
    .trim()
    .toLowerCase();
  if (normalized === 'admin') return '管理员';
  if (normalized === 'cs') return '客服';
  if (normalized === 'operator') return '运营';
  if (normalized === 'finance') return '财务';
  return '平台';
}

function readPayloadField(payload: unknown, key: string): unknown {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return undefined;
  return (payload as Record<string, unknown>)[key];
}

function formatPayloadMoney(value: unknown): string {
  const amount = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(amount)) return '';
  return formatMoneyFen(amount);
}

function formatPayloadDateTime(value: unknown): string {
  if (typeof value !== 'string') return '';
  return formatDateTime(value);
}

function summarizeOrderEventPayload(event: MaintenanceOrderEvent): string[] {
  const lines: string[] = [];
  if (event.eventType === 'QUOTE_UPDATED') {
    const officialFee = formatPayloadMoney(readPayloadField(event.payloadJson, 'officialFeeFen'));
    const lateFee = formatPayloadMoney(readPayloadField(event.payloadJson, 'lateFeeFen'));
    const serviceFee = formatPayloadMoney(readPayloadField(event.payloadJson, 'serviceFeeFen'));
    const totalAmount = formatPayloadMoney(readPayloadField(event.payloadJson, 'totalAmountFen'));
    const paymentDeadline = formatPayloadDateTime(readPayloadField(event.payloadJson, 'paymentDeadline'));
    if (officialFee) lines.push(`官费：${officialFee}`);
    if (lateFee) lines.push(`滞纳金：${lateFee}`);
    if (serviceFee) lines.push(`服务费：${serviceFee}`);
    if (totalAmount) lines.push(`总金额：${totalAmount}`);
    if (paymentDeadline) lines.push(`支付截止：${paymentDeadline}`);
    return lines;
  }

  if (event.eventType === 'PAYMENT_CONFIRMED') {
    const paymentChannel = statusLabel(readPayloadField(event.payloadJson, 'paymentChannel') as PaymentChannel | undefined, PAYMENT_CHANNEL_OPTIONS);
    const paymentTxnNo = displayUserFacingText(readPayloadField(event.payloadJson, 'paymentTxnNo'), '');
    const paidAt = formatPayloadDateTime(readPayloadField(event.payloadJson, 'paidAt'));
    if (paymentChannel && paymentChannel !== '待确认') lines.push(`支付渠道：${paymentChannel}`);
    if (paymentTxnNo) lines.push(`支付流水号：${paymentTxnNo}`);
    if (paidAt) lines.push(`支付时间：${paidAt}`);
    return lines;
  }

  if (event.eventType === 'EXECUTION_SUBMITTED') {
    const officialSubmissionNo = displayUserFacingText(readPayloadField(event.payloadJson, 'officialSubmissionNo'), '');
    const executedAt = formatPayloadDateTime(readPayloadField(event.payloadJson, 'executedAt'));
    if (officialSubmissionNo) lines.push(`官方提交编号：${officialSubmissionNo}`);
    if (executedAt) lines.push(`办理时间：${executedAt}`);
    return lines;
  }

  if (event.eventType === 'RECEIPT_UPLOADED') {
    const officialReceiptNo = displayUserFacingText(readPayloadField(event.payloadJson, 'officialReceiptNo'), '');
    const officialReceiptFileId = displayUserFacingText(readPayloadField(event.payloadJson, 'officialReceiptFileId'), '');
    const receiptIssuedAt = formatPayloadDateTime(readPayloadField(event.payloadJson, 'receiptIssuedAt'));
    if (officialReceiptNo) lines.push(`官方回执编号：${officialReceiptNo}`);
    if (officialReceiptFileId) lines.push('回执文件：已上传');
    if (receiptIssuedAt) lines.push(`回执时间：${receiptIssuedAt}`);
    return lines;
  }

  if (event.eventType === 'RECONCILED') {
    const reconcileStatus = statusLabel(
      readPayloadField(event.payloadJson, 'reconcileStatus') as ReconcileStatus | undefined,
      RECONCILE_STATUS_OPTIONS,
    );
    const reconcileNote = displayUserFacingText(readPayloadField(event.payloadJson, 'reconcileNote'), '');
    if (reconcileStatus) lines.push(`对账结果：${reconcileStatus}`);
    if (reconcileNote) lines.push(`对账备注：${reconcileNote}`);
  }
  return lines;
}

function MaintenanceSchedules() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown | null>(null);
  const [data, setData] = useState<Paged<Schedule> | null>(null);
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Schedule | null>(null);
  const [form] = Form.useForm();
  const loadSeqRef = useRef(0);

  const emptyFilters = useMemo<ScheduleFilters>(() => ({ patentId: '', status: undefined, dueFrom: '', dueTo: '' }), []);
  const [filters, setFilters] = useState<ScheduleFilters>(emptyFilters);
  const [draftFilters, setDraftFilters] = useState<ScheduleFilters>(emptyFilters);

  const load = useCallback(async () => {
    const seq = ++loadSeqRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<Paged<Schedule>>('/admin/patent-maintenance/schedules', {
        page,
        pageSize: 20,
        ...(filters.patentId ? { patentId: filters.patentId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.dueFrom ? { dueFrom: filters.dueFrom } : {}),
        ...(filters.dueTo ? { dueTo: filters.dueTo } : {}),
      });
      if (seq !== loadSeqRef.current) return;
      setData(res);
    } catch (e: any) {
      if (seq !== loadSeqRef.current) return;
      setError(e);
      setData(null);
      message.error(e?.message || '加载缴费计划失败');
    } finally {
      if (seq !== loadSeqRef.current) return;
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      {error ? <RequestErrorAlert error={error} onRetry={load} /> : null}

      <Space wrap>
        <Button
          type="primary"
          onClick={() => {
            setEditing(null);
            form.resetFields();
            form.setFieldsValue({ status: 'DUE' });
            setModalOpen(true);
          }}
        >
          新建计划
        </Button>
        <Input
          style={{ width: 240 }}
          placeholder="专利ID"
          value={draftFilters.patentId}
          onChange={(e) => setDraftFilters((prev) => ({ ...prev, patentId: e.target.value.trim() }))}
        />
        <Select
          allowClear
          style={{ width: 180 }}
          placeholder="状态"
          value={draftFilters.status}
          options={SCHEDULE_STATUS_OPTIONS}
          onChange={(value) => setDraftFilters((prev) => ({ ...prev, status: value as ScheduleStatus | undefined }))}
        />
        <Input
          style={{ width: 180 }}
          placeholder="到期开始（YYYY-MM-DD）"
          value={draftFilters.dueFrom}
          onChange={(e) => setDraftFilters((prev) => ({ ...prev, dueFrom: e.target.value.trim() }))}
        />
        <Input
          style={{ width: 180 }}
          placeholder="到期结束（YYYY-MM-DD）"
          value={draftFilters.dueTo}
          onChange={(e) => setDraftFilters((prev) => ({ ...prev, dueTo: e.target.value.trim() }))}
        />
        <Button
          type="primary"
          onClick={() => {
            setPage(1);
            setFilters(draftFilters);
          }}
        >
          应用
        </Button>
        <Button
          onClick={() => {
            setPage(1);
            setDraftFilters(emptyFilters);
            setFilters(emptyFilters);
          }}
        >
          重置
        </Button>
        <Button onClick={() => void load()}>刷新</Button>
      </Space>

      <Table<Schedule>
        rowKey="id"
        loading={loading}
        dataSource={data?.items || []}
        pagination={{
          current: data?.page.page || page,
          pageSize: data?.page.pageSize || 20,
          total: data?.page.total || 0,
          onChange: (next) => setPage(next),
        }}
        columns={[
          { title: '专利ID', dataIndex: 'patentId', width: 250, ellipsis: true },
          { title: '年次', dataIndex: 'yearNo', width: 90 },
          { title: '到期日', dataIndex: 'dueDate', width: 130 },
          { title: '宽限期结束', dataIndex: 'gracePeriodEnd', width: 130, render: (v) => displayUserFacingText(v) },
          {
            title: '状态',
            key: 'status',
            width: 220,
            render: (_, row) => (
              <Space size={4}>
                {scheduleStatusTag(row.status)}
                {urgencyTag(calcScheduleUrgency(row))}
              </Space>
            ),
          },
          { title: '更新时间', dataIndex: 'updatedAt', width: 180, render: (v: string) => formatDateTime(v) },
          {
            title: '操作',
            key: 'actions',
            width: 90,
            render: (_, row) => (
              <Button
                size="small"
                onClick={() => {
                  setEditing(row);
                  form.setFieldsValue({
                    patentId: row.patentId,
                    yearNo: row.yearNo,
                    dueDate: row.dueDate,
                    gracePeriodEnd: row.gracePeriodEnd || '',
                    status: row.status,
                  });
                  setModalOpen(true);
                }}
              >
                编辑
              </Button>
            ),
          },
        ]}
      />

      <Modal
        open={modalOpen}
        title={editing ? '编辑计划' : '新建计划'}
        destroyOnClose
        onCancel={() => setModalOpen(false)}
        onOk={async () => {
          try {
            const values = await form.validateFields();
            const { ok } = await confirmActionWithReason({
              title: editing ? '确认更新缴费计划？' : '确认创建缴费计划？',
              content: '该操作将更新年费托管缴费计划数据。',
              okText: '确认',
              reasonLabel: '备注（选填）',
            });
            if (!ok) return;

            if (editing) {
              await apiPatch(`/admin/patent-maintenance/schedules/${editing.id}`, {
                dueDate: values.dueDate,
                gracePeriodEnd: values.gracePeriodEnd || undefined,
                status: values.status,
              });
            } else {
              await apiPost('/admin/patent-maintenance/schedules', {
                patentId: values.patentId,
                yearNo: values.yearNo,
                dueDate: values.dueDate,
                gracePeriodEnd: values.gracePeriodEnd || undefined,
                status: values.status,
              });
            }
            message.success('保存成功');
            setModalOpen(false);
            void load();
          } catch (e: any) {
            if (e?.errorFields) return;
            message.error(e?.message || '保存缴费计划失败');
          }
        }}
      >
        <Form form={form} layout="vertical">
          <Form.Item label="专利ID" name="patentId" rules={[{ required: true, message: '请输入专利ID' }]}>
            <Input disabled={Boolean(editing)} />
          </Form.Item>
          <Form.Item label="年次" name="yearNo" rules={[{ required: true, message: '请输入年次' }]}>
            <InputNumber min={1} style={{ width: '100%' }} disabled={Boolean(editing)} />
          </Form.Item>
          <Form.Item label="到期日" name="dueDate" rules={[{ required: true, message: '请输入到期日' }]}>
            <Input placeholder="YYYY-MM-DD" />
          </Form.Item>
          <Form.Item label="宽限期结束" name="gracePeriodEnd">
            <Input placeholder="YYYY-MM-DD" />
          </Form.Item>
          <Form.Item label="状态" name="status" rules={[{ required: true, message: '请选择状态' }]}>
            <Select options={SCHEDULE_STATUS_OPTIONS} />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}

function MaintenanceTasks() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown | null>(null);
  const [data, setData] = useState<Paged<Task> | null>(null);
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [evidenceFile, setEvidenceFile] = useState<FileObject | null>(null);
  const [form] = Form.useForm();
  const loadSeqRef = useRef(0);
  const editingTargetKeyRef = useRef('__closed__');
  const submitSeqRef = useRef(0);
  const uploadSeqRef = useRef(0);

  useEffect(() => {
    editingTargetKeyRef.current = modalOpen ? editing?.id || '__new__' : '__closed__';
    submitSeqRef.current += 1;
    uploadSeqRef.current += 1;
  }, [editing?.id, modalOpen]);

  const emptyFilters = useMemo<TaskFilters>(() => ({ scheduleId: '', assignedCsUserId: '', status: undefined }), []);
  const [filters, setFilters] = useState<TaskFilters>(emptyFilters);
  const [draftFilters, setDraftFilters] = useState<TaskFilters>(emptyFilters);

  const load = useCallback(async () => {
    const seq = ++loadSeqRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<Paged<Task>>('/admin/patent-maintenance/tasks', {
        page,
        pageSize: 20,
        ...(filters.scheduleId ? { scheduleId: filters.scheduleId } : {}),
        ...(filters.assignedCsUserId ? { assignedCsUserId: filters.assignedCsUserId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
      });
      if (seq !== loadSeqRef.current) return;
      setData(res);
    } catch (e: any) {
      if (seq !== loadSeqRef.current) return;
      setError(e);
      setData(null);
      message.error(e?.message || '加载任务失败');
    } finally {
      if (seq !== loadSeqRef.current) return;
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      {error ? <RequestErrorAlert error={error} onRetry={load} /> : null}

      <Space wrap>
        <Button
          type="primary"
          onClick={() => {
            setEditing(null);
            setEvidenceFile(null);
            form.resetFields();
            form.setFieldsValue({ status: 'OPEN' });
            setModalOpen(true);
          }}
        >
          新建任务
        </Button>
        <Input
          style={{ width: 250 }}
          placeholder="计划ID"
          value={draftFilters.scheduleId}
          onChange={(e) => setDraftFilters((prev) => ({ ...prev, scheduleId: e.target.value.trim() }))}
        />
        <Input
          style={{ width: 230 }}
          placeholder="分配客服用户ID"
          value={draftFilters.assignedCsUserId}
          onChange={(e) => setDraftFilters((prev) => ({ ...prev, assignedCsUserId: e.target.value.trim() }))}
        />
        <Select
          allowClear
          style={{ width: 180 }}
          placeholder="任务状态"
          value={draftFilters.status}
          options={TASK_STATUS_OPTIONS}
          onChange={(value) => setDraftFilters((prev) => ({ ...prev, status: value as TaskStatus | undefined }))}
        />
        <Button
          type="primary"
          onClick={() => {
            setPage(1);
            setFilters(draftFilters);
          }}
        >
          应用
        </Button>
        <Button
          onClick={() => {
            setPage(1);
            setDraftFilters(emptyFilters);
            setFilters(emptyFilters);
          }}
        >
          重置
        </Button>
        <Button onClick={() => void load()}>刷新</Button>
      </Space>

      <Table<Task>
        rowKey="id"
        loading={loading}
        dataSource={data?.items || []}
        pagination={{
          current: data?.page.page || page,
          pageSize: data?.page.pageSize || 20,
          total: data?.page.total || 0,
          onChange: (next) => setPage(next),
        }}
        columns={[
          { title: '任务ID', dataIndex: 'id', width: 230, ellipsis: true },
          { title: '计划ID', dataIndex: 'scheduleId', width: 220, ellipsis: true },
          { title: '分配客服', dataIndex: 'assignedCsUserId', width: 220, render: (v) => displayUserFacingText(v) },
          { title: '状态', dataIndex: 'status', width: 130, render: (v: TaskStatus) => taskStatusTag(v) },
          { title: '备注', dataIndex: 'note', ellipsis: true, render: (v) => displayUserFacingText(v) },
          { title: '证据文件', dataIndex: 'evidenceFileId', width: 230, ellipsis: true, render: (v) => displayUserFacingText(v) },
          { title: '更新时间', dataIndex: 'updatedAt', width: 180, render: (v: string) => formatDateTime(v) },
          {
            title: '操作',
            key: 'actions',
            width: 90,
            render: (_, row) => (
              <Button
                size="small"
                onClick={() => {
                  setEditing(row);
                  setEvidenceFile(null);
                  form.setFieldsValue({
                    scheduleId: row.scheduleId,
                    assignedCsUserId: normalizeUserFacingText(row.assignedCsUserId),
                    status: row.status,
                    note: normalizeUserFacingText(row.note),
                    evidenceFileId: row.evidenceFileId || '',
                  });
                  setModalOpen(true);
                }}
              >
                编辑
              </Button>
            ),
          },
        ]}
      />

      <Modal
        open={modalOpen}
        title={editing ? '编辑任务' : '新建任务'}
        destroyOnClose
        onCancel={() => {
          setModalOpen(false);
          setEditing(null);
          setEvidenceFile(null);
          form.resetFields();
        }}
        onOk={async () => {
          const editingId = editing?.id || '';
          const targetKey = editingId || '__new__';
          const requestSeq = ++submitSeqRef.current;
          try {
            const values = await form.validateFields();
            if (submitSeqRef.current !== requestSeq || editingTargetKeyRef.current !== targetKey) return;
            const { ok } = await confirmActionWithReason({
              title: editing ? '确认更新任务？' : '确认创建任务？',
              content: '该操作将更新年费托管任务数据。',
              okText: '确认',
              reasonLabel: '备注（选填）',
            });
            if (!ok) return;
            if (submitSeqRef.current !== requestSeq || editingTargetKeyRef.current !== targetKey) return;

            const payload = {
              ...(editingId ? {} : { scheduleId: values.scheduleId }),
              assignedCsUserId: values.assignedCsUserId || null,
              status: values.status,
              note: values.note || undefined,
              evidenceFileId: values.evidenceFileId || undefined,
            };

            if (editingId) {
              await apiPatch(`/admin/patent-maintenance/tasks/${editingId}`, payload);
            } else {
              await apiPost('/admin/patent-maintenance/tasks', payload);
            }
            if (submitSeqRef.current !== requestSeq || editingTargetKeyRef.current !== targetKey) return;
            message.success('保存成功');
            setModalOpen(false);
            setEditing(null);
            setEvidenceFile(null);
            form.resetFields();
            void load();
          } catch (e: any) {
            if (e?.errorFields) return;
            if (submitSeqRef.current !== requestSeq || editingTargetKeyRef.current !== targetKey) return;
            message.error(e?.message || '保存任务失败');
          }
        }}
      >
        <Form form={form} layout="vertical">
          <Form.Item label="计划ID" name="scheduleId" rules={[{ required: true, message: '请输入计划ID' }]}>
            <Input disabled={Boolean(editing)} />
          </Form.Item>
          <Form.Item label="分配客服用户ID" name="assignedCsUserId">
            <Input />
          </Form.Item>
          <Form.Item label="状态" name="status" rules={[{ required: true, message: '请选择状态' }]}>
            <Select options={TASK_STATUS_OPTIONS} />
          </Form.Item>
          <Form.Item label="备注" name="note">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item label="证据文件ID" name="evidenceFileId">
            <Space style={{ width: '100%' }} direction="vertical" size={8}>
              <Input placeholder="输入已有文件ID，或在下方上传" />
              <Space wrap>
                <Upload
                  maxCount={1}
                  showUploadList={false}
                  customRequest={async (options: any) => {
                    const targetKey = editingTargetKeyRef.current;
                    const requestSeq = ++uploadSeqRef.current;
                    try {
                      const uploaded = await apiUploadFile(options.file as File, 'MAINTENANCE_EVIDENCE');
                      if (uploadSeqRef.current !== requestSeq || editingTargetKeyRef.current !== targetKey) return;
                      setEvidenceFile(uploaded);
                      form.setFieldsValue({ evidenceFileId: uploaded.id });
                      message.success('证据文件上传成功');
                      options.onSuccess?.(uploaded);
                    } catch (e: any) {
                      if (uploadSeqRef.current !== requestSeq || editingTargetKeyRef.current !== targetKey) return;
                      options.onError?.(e);
                      message.error(e?.message || '证据文件上传失败');
                    }
                  }}
                >
                  <Button>上传证据</Button>
                </Upload>
                <Button
                  onClick={() => {
                    setEvidenceFile(null);
                    form.setFieldsValue({ evidenceFileId: '' });
                  }}
                >
                  清空
                </Button>
              </Space>
              {evidenceFile?.id ? <Typography.Text type="secondary">已上传：{evidenceFile.id}</Typography.Text> : null}
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}

function MaintenanceOrders() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown | null>(null);
  const [data, setData] = useState<Paged<MaintenanceOrder> | null>(null);
  const [page, setPage] = useState(1);

  const [createOpen, setCreateOpen] = useState(false);
  const [actionOpen, setActionOpen] = useState(false);
  const [eventsOpen, setEventsOpen] = useState(false);
  const [eventLoading, setEventLoading] = useState(false);
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [events, setEvents] = useState<MaintenanceOrderEvent[]>([]);
  const [activeOrder, setActiveOrder] = useState<MaintenanceOrder | null>(null);
  const [activeAction, setActiveAction] = useState<ActionType>('QUOTE');
  const [receiptFile, setReceiptFile] = useState<FileObject | null>(null);

  const [createForm] = Form.useForm();
  const [actionForm] = Form.useForm();
  const loadSeqRef = useRef(0);
  const eventsSeqRef = useRef(0);
  const eventsOrderIdRef = useRef<string | null>(null);
  const activeOrderIdRef = useRef<string | null>(null);
  const createOrderSeqRef = useRef(0);
  const actionSeqRef = useRef(0);
  const receiptUploadSeqRef = useRef(0);

  useEffect(() => {
    activeOrderIdRef.current = activeOrder?.id || null;
  }, [activeOrder?.id]);

  useEffect(() => {
    createOrderSeqRef.current += 1;
  }, [createOpen]);

  useEffect(() => {
    actionSeqRef.current += 1;
    receiptUploadSeqRef.current += 1;
  }, [actionOpen, activeAction, activeOrder?.id]);

  const emptyFilters = useMemo<OrderFilters>(
    () => ({ scheduleId: '', applicantUserId: '', assignedCsUserId: '', status: undefined, reconcileStatus: undefined }),
    [],
  );
  const [filters, setFilters] = useState<OrderFilters>(emptyFilters);
  const [draftFilters, setDraftFilters] = useState<OrderFilters>(emptyFilters);

  const load = useCallback(async () => {
    const seq = ++loadSeqRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<Paged<MaintenanceOrder>>('/admin/patent-maintenance/orders', {
        page,
        pageSize: 20,
        ...(filters.scheduleId ? { scheduleId: filters.scheduleId } : {}),
        ...(filters.applicantUserId ? { applicantUserId: filters.applicantUserId } : {}),
        ...(filters.assignedCsUserId ? { assignedCsUserId: filters.assignedCsUserId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.reconcileStatus ? { reconcileStatus: filters.reconcileStatus } : {}),
      });
      if (seq !== loadSeqRef.current) return;
      setData(res);
    } catch (e: any) {
      if (seq !== loadSeqRef.current) return;
      setError(e);
      setData(null);
      message.error(e?.message || '加载订单失败');
    } finally {
      if (seq !== loadSeqRef.current) return;
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const openEvents = useCallback(async (order: MaintenanceOrder) => {
    const seq = ++eventsSeqRef.current;
    eventsOrderIdRef.current = order.id;
    setActiveOrder(order);
    setEventsOpen(true);
    setEventLoading(true);
    setEvents([]);
    try {
      const res = await apiGet<{ items: MaintenanceOrderEvent[] }>(`/admin/patent-maintenance/orders/${order.id}/events`);
      if (seq !== eventsSeqRef.current || eventsOrderIdRef.current !== order.id) return;
      setEvents(res?.items || []);
    } catch (e: any) {
      if (seq !== eventsSeqRef.current || eventsOrderIdRef.current !== order.id) return;
      message.error(e?.message || '加载订单时间线失败');
    } finally {
      if (seq !== eventsSeqRef.current || eventsOrderIdRef.current !== order.id) return;
      setEventLoading(false);
    }
  }, []);

  const openActionModal = useCallback(
    (order: MaintenanceOrder, action: ActionType) => {
      setActiveOrder(order);
      setActiveAction(action);
      setReceiptFile(null);
      actionForm.resetFields();

      if (action === 'QUOTE') {
        actionForm.setFieldsValue({
          officialFeeFen: order.officialFeeFen || 0,
          lateFeeFen: order.lateFeeFen || 0,
          serviceFeeFen: order.serviceFeeFen || 0,
          paymentDeadline: order.paymentDeadline || '',
          assignedCsUserId: normalizeUserFacingText(order.assignedCsUserId),
        });
      } else if (action === 'PAY') {
        actionForm.setFieldsValue({
          paymentChannel: order.paymentChannel || 'WECHAT',
          paymentTxnNo: normalizeUserFacingText(order.paymentTxnNo),
          paidAt: order.paidAt || '',
        });
      } else if (action === 'EXECUTE') {
        actionForm.setFieldsValue({
          officialSubmissionNo: normalizeUserFacingText(order.officialSubmissionNo),
          executedAt: order.executedAt || '',
        });
      } else if (action === 'RECEIPT') {
        actionForm.setFieldsValue({
          officialReceiptNo: normalizeUserFacingText(order.officialReceiptNo),
          officialReceiptFileId: order.officialReceiptFileId || '',
          receiptIssuedAt: order.receiptIssuedAt || '',
        });
      } else if (action === 'RECONCILE') {
        actionForm.setFieldsValue({
          reconcileStatus: order.reconcileStatus || 'MATCHED',
          reconcileNote: normalizeUserFacingText(order.reconcileNote),
        });
      } else if (action === 'CLOSE') {
        actionForm.setFieldsValue({ closeNote: normalizeUserFacingText(order.closeNote) });
      } else if (action === 'CANCEL') {
        actionForm.setFieldsValue({ closeNote: normalizeUserFacingText(order.closeNote) });
      }

      setActionOpen(true);
    },
    [actionForm],
  );

  const submitAction = useCallback(async () => {
    if (!activeOrder) return;
    const targetOrderId = activeOrder.id;
    const targetAction = activeAction;
    const requestSeq = ++actionSeqRef.current;
    try {
      setActionSubmitting(true);
      const values = await actionForm.validateFields();
      if (actionSeqRef.current !== requestSeq || activeOrderIdRef.current !== targetOrderId || activeAction !== targetAction) return;
      const { ok, reason } = await confirmActionWithReason({
        title: `确认执行「${actionLabel(targetAction)}」？`,
        content: `订单 ${targetOrderId} 将流转到下一状态。`,
        okText: '确认',
        reasonLabel: '操作备注（选填）',
      });
      if (!ok) return;
      if (actionSeqRef.current !== requestSeq || activeOrderIdRef.current !== targetOrderId || activeAction !== targetAction) return;

      let path = '';
      let payload: Record<string, any> = {};

      if (targetAction === 'QUOTE') {
        path = `/admin/patent-maintenance/orders/${targetOrderId}/quote`;
        payload = {
          officialFeeFen: values.officialFeeFen,
          lateFeeFen: values.lateFeeFen ?? 0,
          serviceFeeFen: values.serviceFeeFen,
          paymentDeadline: values.paymentDeadline,
          ...(values.assignedCsUserId ? { assignedCsUserId: values.assignedCsUserId } : {}),
        };
      } else if (targetAction === 'PAY') {
        path = `/admin/patent-maintenance/orders/${targetOrderId}/payment-confirm`;
        payload = {
          paymentChannel: values.paymentChannel,
          paymentTxnNo: values.paymentTxnNo,
          ...(values.paidAt ? { paidAt: values.paidAt } : {}),
        };
      } else if (targetAction === 'EXECUTE') {
        path = `/admin/patent-maintenance/orders/${targetOrderId}/execution`;
        payload = {
          officialSubmissionNo: values.officialSubmissionNo,
          ...(values.executedAt ? { executedAt: values.executedAt } : {}),
        };
      } else if (targetAction === 'RECEIPT') {
        path = `/admin/patent-maintenance/orders/${targetOrderId}/receipt`;
        payload = {
          officialReceiptNo: values.officialReceiptNo,
          officialReceiptFileId: values.officialReceiptFileId,
          ...(values.receiptIssuedAt ? { receiptIssuedAt: values.receiptIssuedAt } : {}),
        };
      } else if (targetAction === 'RECONCILE') {
        path = `/admin/patent-maintenance/orders/${targetOrderId}/reconcile`;
        payload = {
          reconcileStatus: values.reconcileStatus,
          reconcileNote: values.reconcileNote || reason || undefined,
        };
      } else if (targetAction === 'CLOSE') {
        path = `/admin/patent-maintenance/orders/${targetOrderId}/close`;
        payload = {
          closeNote: values.closeNote || reason || undefined,
        };
      } else if (targetAction === 'CANCEL') {
        path = `/admin/patent-maintenance/orders/${targetOrderId}/cancel`;
        payload = {
          closeNote: values.closeNote || reason,
        };
      }

      await apiPost(path, payload);
      if (actionSeqRef.current !== requestSeq || activeOrderIdRef.current !== targetOrderId || activeAction !== targetAction) return;
      message.success(`${actionLabel(targetAction)}成功`);
      setActionOpen(false);
      setActiveOrder(null);
      setReceiptFile(null);
      actionForm.resetFields();
      void load();
    } catch (e: any) {
      if (e?.errorFields) return;
      if (actionSeqRef.current !== requestSeq || activeOrderIdRef.current !== targetOrderId || activeAction !== targetAction) return;
      message.error(e?.message || `${actionLabel(targetAction)}失败`);
    } finally {
      if (actionSeqRef.current !== requestSeq || activeOrderIdRef.current !== targetOrderId || activeAction !== targetAction) return;
      setActionSubmitting(false);
    }
  }, [actionForm, activeAction, activeOrder, load]);

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      {error ? <RequestErrorAlert error={error} onRetry={load} /> : null}

      <Space wrap>
        <Button
          type="primary"
          onClick={() => {
            createForm.resetFields();
            setCreateOpen(true);
          }}
        >
          新建订单
        </Button>
        <Input
          style={{ width: 230 }}
          placeholder="计划ID"
          value={draftFilters.scheduleId}
          onChange={(e) => setDraftFilters((prev) => ({ ...prev, scheduleId: e.target.value.trim() }))}
        />
        <Input
          style={{ width: 220 }}
          placeholder="申请人用户ID"
          value={draftFilters.applicantUserId}
          onChange={(e) => setDraftFilters((prev) => ({ ...prev, applicantUserId: e.target.value.trim() }))}
        />
        <Input
          style={{ width: 220 }}
          placeholder="分配客服用户ID"
          value={draftFilters.assignedCsUserId}
          onChange={(e) => setDraftFilters((prev) => ({ ...prev, assignedCsUserId: e.target.value.trim() }))}
        />
        <Select
          allowClear
          style={{ width: 180 }}
          placeholder="订单状态"
          value={draftFilters.status}
          options={ORDER_STATUS_OPTIONS}
          onChange={(value) => setDraftFilters((prev) => ({ ...prev, status: value as OrderStatus | undefined }))}
        />
        <Select
          allowClear
          style={{ width: 180 }}
          placeholder="对账状态"
          value={draftFilters.reconcileStatus}
          options={RECONCILE_STATUS_OPTIONS}
          onChange={(value) => setDraftFilters((prev) => ({ ...prev, reconcileStatus: value as ReconcileStatus | undefined }))}
        />
        <Button
          type="primary"
          onClick={() => {
            setPage(1);
            setFilters(draftFilters);
          }}
        >
          应用
        </Button>
        <Button
          onClick={() => {
            setPage(1);
            setDraftFilters(emptyFilters);
            setFilters(emptyFilters);
          }}
        >
          重置
        </Button>
        <Button onClick={() => void load()}>刷新</Button>
      </Space>

      <Table<MaintenanceOrder>
        rowKey="id"
        loading={loading}
        dataSource={data?.items || []}
        scroll={{ x: 1680 }}
        pagination={{
          current: data?.page.page || page,
          pageSize: data?.page.pageSize || 20,
          total: data?.page.total || 0,
          onChange: (next) => setPage(next),
        }}
        columns={[
          { title: '订单ID', dataIndex: 'id', width: 230, ellipsis: true },
          {
            title: '专利',
            width: 260,
            render: (_, row) => (
              <Space direction="vertical" size={2}>
                <Typography.Text ellipsis style={{ maxWidth: 240 }}>
                  {displayUserFacingText(row.patentTitle)}
                </Typography.Text>
                <Typography.Text type="secondary">{displayUserFacingText(row.applicationNoDisplay)}</Typography.Text>
              </Space>
            ),
          },
          { title: '计划ID', dataIndex: 'scheduleId', width: 220, ellipsis: true },
          { title: '年次', dataIndex: 'scheduleYearNo', width: 70, render: (v) => (typeof v === 'number' ? v : '待补充') },
          { title: '到期日', dataIndex: 'scheduleDueDate', width: 130, render: (v) => displayUserFacingText(v) },
          { title: '申请人', dataIndex: 'applicantUserId', width: 220, ellipsis: true, render: (v) => displayUserFacingText(v) },
          { title: '分配客服', dataIndex: 'assignedCsUserId', width: 220, ellipsis: true, render: (v) => displayUserFacingText(v) },
          { title: '状态', dataIndex: 'status', width: 150, render: (v: OrderStatus) => orderStatusTag(v) },
          { title: '对账', dataIndex: 'reconcileStatus', width: 130, render: (v: ReconcileStatus) => reconcileStatusTag(v) },
          { title: '总金额', dataIndex: 'totalAmountFen', width: 120, render: (v: number) => formatMoneyFen(v) },
          { title: '支付渠道', dataIndex: 'paymentChannel', width: 130, render: (v: PaymentChannel) => statusLabel(v, PAYMENT_CHANNEL_OPTIONS) },
          { title: '支付流水号', dataIndex: 'paymentTxnNo', width: 200, ellipsis: true, render: (v) => displayUserFacingText(v) },
          { title: '支付截止', dataIndex: 'paymentDeadline', width: 180, render: (v: string) => formatDateTime(v) },
          { title: '支付时间', dataIndex: 'paidAt', width: 180, render: (v: string) => formatDateTime(v) },
          { title: '办理时间', dataIndex: 'executedAt', width: 180, render: (v: string) => formatDateTime(v) },
          { title: '更新时间', dataIndex: 'updatedAt', width: 180, render: (v: string) => formatDateTime(v) },
          {
            title: '操作',
            key: 'actions',
            width: 360,
            fixed: 'right',
            render: (_, row) => (
              <Space wrap size={[6, 6]}>
                {getOrderActionCandidates(row).map((action) => (
                  <Button key={action} size="small" onClick={() => openActionModal(row, action)}>
                    {actionLabel(action)}
                  </Button>
                ))}
                <Button size="small" onClick={() => void openEvents(row)}>
                  时间线
                </Button>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        open={createOpen}
        title="创建年费托管订单"
        destroyOnClose
        onCancel={() => {
          setCreateOpen(false);
          createForm.resetFields();
        }}
        onOk={async () => {
          const requestSeq = ++createOrderSeqRef.current;
          try {
            const values = await createForm.validateFields();
            if (createOrderSeqRef.current !== requestSeq || !createOpen) return;
            const { ok } = await confirmActionWithReason({
              title: '确认创建年费托管订单？',
              content: '将创建一笔状态为“已发起”的新订单。',
              okText: '确认',
              reasonLabel: '备注（选填）',
            });
            if (!ok) return;
            if (createOrderSeqRef.current !== requestSeq || !createOpen) return;
            await apiPost('/admin/patent-maintenance/orders', {
              scheduleId: values.scheduleId,
              ...(values.applicantUserId ? { applicantUserId: values.applicantUserId } : {}),
              ...(values.assignedCsUserId ? { assignedCsUserId: values.assignedCsUserId } : {}),
            });
            if (createOrderSeqRef.current !== requestSeq || !createOpen) return;
            message.success('订单创建成功');
            setCreateOpen(false);
            createForm.resetFields();
            void load();
          } catch (e: any) {
            if (e?.errorFields) return;
            if (createOrderSeqRef.current !== requestSeq || !createOpen) return;
            message.error(e?.message || '创建订单失败');
          }
        }}
      >
        <Form form={createForm} layout="vertical">
          <Form.Item label="计划ID" name="scheduleId" rules={[{ required: true, message: '请输入计划ID' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="申请人用户ID（选填）" name="applicantUserId">
            <Input />
          </Form.Item>
          <Form.Item label="分配客服用户ID（选填）" name="assignedCsUserId">
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={actionOpen}
        title={`${actionLabel(activeAction)}${activeOrder ? ` - ${activeOrder.id}` : ''}`}
        destroyOnClose
        onCancel={() => {
          setActionOpen(false);
          setActiveOrder(null);
          setReceiptFile(null);
          setActionSubmitting(false);
          actionForm.resetFields();
        }}
        onOk={() => void submitAction()}
        confirmLoading={actionSubmitting}
      >
        <Form form={actionForm} layout="vertical">
          {activeAction === 'QUOTE' ? (
            <>
              <Form.Item label="官费（分）" name="officialFeeFen" rules={[{ required: true, message: '必填' }]}>
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item label="滞纳金（分）" name="lateFeeFen">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item label="服务费（分）" name="serviceFeeFen" rules={[{ required: true, message: '必填' }]}>
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item label="支付截止时间（ISO8601）" name="paymentDeadline" rules={[{ required: true, message: '必填' }]}>
                <Input placeholder="2026-03-31T23:59:59.000Z" />
              </Form.Item>
              <Form.Item label="分配客服用户ID" name="assignedCsUserId">
                <Input />
              </Form.Item>
            </>
          ) : null}

          {activeAction === 'PAY' ? (
            <>
              <Form.Item label="支付渠道" name="paymentChannel" rules={[{ required: true, message: '必填' }]}>
                <Select options={PAYMENT_CHANNEL_OPTIONS} />
              </Form.Item>
              <Form.Item label="支付流水号" name="paymentTxnNo" rules={[{ required: true, message: '必填' }]}>
                <Input />
              </Form.Item>
              <Form.Item label="支付时间（ISO8601，可选）" name="paidAt">
                <Input placeholder="2026-03-31T23:59:59.000Z" />
              </Form.Item>
            </>
          ) : null}

          {activeAction === 'EXECUTE' ? (
            <>
              <Form.Item label="官方提交编号" name="officialSubmissionNo" rules={[{ required: true, message: '必填' }]}>
                <Input />
              </Form.Item>
              <Form.Item label="办理时间（ISO8601，可选）" name="executedAt">
                <Input placeholder="2026-03-31T23:59:59.000Z" />
              </Form.Item>
            </>
          ) : null}

          {activeAction === 'RECEIPT' ? (
            <>
              <Form.Item label="官方回执编号" name="officialReceiptNo" rules={[{ required: true, message: '必填' }]}>
                <Input />
              </Form.Item>
              <Form.Item label="回执文件ID" name="officialReceiptFileId" rules={[{ required: true, message: '必填' }]}>
                <Space style={{ width: '100%' }} direction="vertical" size={8}>
                  <Input placeholder="输入已有文件ID，或在下方上传" />
                  <Space wrap>
                    <Upload
                      maxCount={1}
                      showUploadList={false}
                      customRequest={async (options: any) => {
                        const targetOrderId = activeOrderIdRef.current;
                        const targetAction = activeAction;
                        const requestSeq = ++receiptUploadSeqRef.current;
                        try {
                          const uploaded = await apiUploadFile(options.file as File, 'MAINTENANCE_RECEIPT');
                          if (
                            receiptUploadSeqRef.current !== requestSeq ||
                            activeOrderIdRef.current !== targetOrderId ||
                            activeAction !== targetAction
                          ) {
                            return;
                          }
                          setReceiptFile(uploaded);
                          actionForm.setFieldsValue({ officialReceiptFileId: uploaded.id });
                          message.success('回执文件上传成功');
                          options.onSuccess?.(uploaded);
                        } catch (e: any) {
                          if (
                            receiptUploadSeqRef.current !== requestSeq ||
                            activeOrderIdRef.current !== targetOrderId ||
                            activeAction !== targetAction
                          ) {
                            return;
                          }
                          options.onError?.(e);
                          message.error(e?.message || '回执文件上传失败');
                        }
                      }}
                    >
                      <Button>上传回执</Button>
                    </Upload>
                    <Button
                      onClick={() => {
                        setReceiptFile(null);
                        actionForm.setFieldsValue({ officialReceiptFileId: '' });
                      }}
                    >
                      清空
                    </Button>
                  </Space>
                  {receiptFile?.id ? <Typography.Text type="secondary">已上传：{receiptFile.id}</Typography.Text> : null}
                </Space>
              </Form.Item>
              <Form.Item label="回执出具时间（ISO8601，可选）" name="receiptIssuedAt">
                <Input placeholder="2026-03-31T23:59:59.000Z" />
              </Form.Item>
            </>
          ) : null}

          {activeAction === 'RECONCILE' ? (
            <>
              <Form.Item label="对账状态" name="reconcileStatus" rules={[{ required: true, message: '必填' }]}>
                <Select options={RECONCILE_STATUS_OPTIONS} />
              </Form.Item>
              <Form.Item label="对账备注（选填）" name="reconcileNote">
                <Input.TextArea rows={3} />
              </Form.Item>
            </>
          ) : null}

          {activeAction === 'CLOSE' ? (
            <Form.Item label="关闭备注（选填）" name="closeNote">
              <Input.TextArea rows={3} />
            </Form.Item>
          ) : null}

          {activeAction === 'CANCEL' ? (
            <Form.Item label="取消原因" name="closeNote" rules={[{ required: true, message: '请输入取消原因' }]}>
              <Input.TextArea rows={3} />
            </Form.Item>
          ) : null}
        </Form>
      </Modal>

      <Modal
        open={eventsOpen}
        title={`订单时间线${activeOrder ? ` - ${activeOrder.id}` : ''}`}
        footer={null}
        width={860}
        onCancel={() => {
          eventsSeqRef.current += 1;
          eventsOrderIdRef.current = null;
          setEventsOpen(false);
          setActiveOrder(null);
          setEvents([]);
          setEventLoading(false);
        }}
      >
        {eventLoading ? (
          <Typography.Text>加载中...</Typography.Text>
        ) : events.length ? (
          <Timeline
            items={events.map((evt) => {
              const actorName = displayUserFacingText(evt.actorNickname || evt.actorUserId, '系统');
              const actorRole = normalizeUserFacingText(evt.actorRole);
              const payloadLines = summarizeOrderEventPayload(evt);
              return {
                color: evt.toStatus === 'CANCELLED' ? 'gray' : evt.toStatus === 'CLOSED' ? 'green' : 'blue',
                children: (
                  <Space direction="vertical" size={4} style={{ width: '100%' }}>
                    <Space size={8} wrap>
                      <Tag color="default">{orderEventTypeCn(evt.eventType)}</Tag>
                      <Typography.Text strong>
                        {evt.fromStatus ? `${orderStatusCn(evt.fromStatus)} -> ${orderStatusCn(evt.toStatus)}` : orderStatusCn(evt.toStatus)}
                      </Typography.Text>
                      <Typography.Text type="secondary">{formatTimeSmart(evt.createdAt)}</Typography.Text>
                    </Space>
                    <Typography.Text type="secondary">
                      操作人：{actorName}
                      {actorRole ? `（${actorRoleCn(actorRole)}）` : ''}
                    </Typography.Text>
                    {normalizeUserFacingText(evt.note) ? <Typography.Text>备注：{normalizeUserFacingText(evt.note)}</Typography.Text> : null}
                    {payloadLines.map((line) => (
                      <Typography.Text key={`${evt.id}-${line}`} type="secondary">
                        {line}
                      </Typography.Text>
                    ))}
                  </Space>
                ),
              };
            })}
          />
        ) : (
          <Typography.Text type="secondary">暂无时间线记录。</Typography.Text>
        )}
      </Modal>
    </Space>
  );
}

export function MaintenancePage() {
  return (
    <Card>
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          年费托管运营
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
          统一管理缴费计划、执行任务，以及支付-办理-回执-对账全流程订单。
        </Typography.Paragraph>
        <Tabs
          defaultActiveKey="schedules"
          items={[
            {
              key: 'schedules',
              label: '缴费计划',
              children: <MaintenanceSchedules />,
            },
            {
              key: 'tasks',
              label: '执行任务',
              children: <MaintenanceTasks />,
            },
            {
              key: 'orders',
              label: '托管订单',
              children: <MaintenanceOrders />,
            },
          ]}
        />
      </Space>
    </Card>
  );
}
