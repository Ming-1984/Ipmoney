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
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { apiGet, apiPatch, apiPost, apiUploadFile, type FileObject } from '../lib/api';
import { formatTimeSmart } from '../lib/format';
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
  { value: 'DUE', label: 'Due' },
  { value: 'PAID', label: 'Paid' },
  { value: 'OVERDUE', label: 'Overdue' },
  { value: 'WAIVED', label: 'Waived' },
];

const TASK_STATUS_OPTIONS: Array<{ value: TaskStatus; label: string }> = [
  { value: 'OPEN', label: 'Open' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'DONE', label: 'Done' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const ORDER_STATUS_OPTIONS: Array<{ value: OrderStatus; label: string }> = [
  { value: 'REQUESTED', label: 'Requested' },
  { value: 'QUOTED', label: 'Quoted' },
  { value: 'AWAITING_PAYMENT', label: 'Awaiting Payment' },
  { value: 'PAID', label: 'Paid' },
  { value: 'EXECUTING', label: 'Executing' },
  { value: 'RECEIPT_UPLOADED', label: 'Receipt Uploaded' },
  { value: 'RECONCILED', label: 'Reconciled' },
  { value: 'CLOSED', label: 'Closed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const RECONCILE_STATUS_OPTIONS: Array<{ value: ReconcileStatus; label: string }> = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'MATCHED', label: 'Matched' },
  { value: 'MISMATCHED', label: 'Mismatched' },
];

const PAYMENT_CHANNEL_OPTIONS: Array<{ value: PaymentChannel; label: string }> = [
  { value: 'WECHAT', label: 'Wechat Pay' },
  { value: 'OFFLINE_BANK', label: 'Offline Bank' },
  { value: 'OFFLINE_OTHER', label: 'Offline Other' },
];

function formatMoneyFen(value?: number): string {
  return `¥${((Number(value) || 0) / 100).toFixed(2)}`;
}

function formatDateTime(value?: string | null): string {
  if (!value) return '-';
  return formatTimeSmart(value);
}

function statusLabel<T extends string>(value: T | undefined, options: Array<{ value: T; label: string }>): string {
  if (!value) return '-';
  return options.find((it) => it.value === value)?.label || value;
}

function scheduleStatusTag(status: ScheduleStatus) {
  if (status === 'PAID') return <Tag color="green">Paid</Tag>;
  if (status === 'OVERDUE') return <Tag color="red">Overdue</Tag>;
  if (status === 'WAIVED') return <Tag color="default">Waived</Tag>;
  return <Tag color="gold">Due</Tag>;
}

function taskStatusTag(status: TaskStatus) {
  if (status === 'DONE') return <Tag color="green">Done</Tag>;
  if (status === 'IN_PROGRESS') return <Tag color="blue">In Progress</Tag>;
  if (status === 'CANCELLED') return <Tag color="default">Cancelled</Tag>;
  return <Tag color="gold">Open</Tag>;
}

function orderStatusTag(status: OrderStatus) {
  if (status === 'CLOSED') return <Tag color="green">Closed</Tag>;
  if (status === 'CANCELLED') return <Tag color="default">Cancelled</Tag>;
  if (status === 'RECONCILED') return <Tag color="cyan">Reconciled</Tag>;
  if (status === 'RECEIPT_UPLOADED') return <Tag color="blue">Receipt Uploaded</Tag>;
  if (status === 'EXECUTING') return <Tag color="processing">Executing</Tag>;
  if (status === 'PAID') return <Tag color="geekblue">Paid</Tag>;
  if (status === 'AWAITING_PAYMENT') return <Tag color="orange">Awaiting Payment</Tag>;
  if (status === 'QUOTED') return <Tag color="purple">Quoted</Tag>;
  return <Tag color="gold">Requested</Tag>;
}

function reconcileStatusTag(status: ReconcileStatus) {
  if (status === 'MATCHED') return <Tag color="green">Matched</Tag>;
  if (status === 'MISMATCHED') return <Tag color="red">Mismatched</Tag>;
  return <Tag color="default">Pending</Tag>;
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
  if (value === 'OVERDUE') return <Tag color="red">Overdue</Tag>;
  if (value === 'DUE_SOON') return <Tag color="orange">Within 7 days</Tag>;
  if (value === 'UPCOMING') return <Tag color="blue">Within 30 days</Tag>;
  if (value === 'SETTLED') return <Tag color="green">Settled</Tag>;
  return <Tag color="default">Normal</Tag>;
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
  if (action === 'QUOTE') return 'Quote';
  if (action === 'PAY') return 'Mark Paid';
  if (action === 'EXECUTE') return 'Submit Execution';
  if (action === 'RECEIPT') return 'Upload Receipt';
  if (action === 'RECONCILE') return 'Reconcile';
  if (action === 'CLOSE') return 'Close';
  return 'Cancel';
}

function MaintenanceSchedules() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown | null>(null);
  const [data, setData] = useState<Paged<Schedule> | null>(null);
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Schedule | null>(null);
  const [form] = Form.useForm();

  const emptyFilters = useMemo<ScheduleFilters>(() => ({ patentId: '', status: undefined, dueFrom: '', dueTo: '' }), []);
  const [filters, setFilters] = useState<ScheduleFilters>(emptyFilters);
  const [draftFilters, setDraftFilters] = useState<ScheduleFilters>(emptyFilters);

  const load = useCallback(async () => {
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
      setData(res);
    } catch (e: any) {
      setError(e);
      setData(null);
      message.error(e?.message || 'Failed to load schedules');
    } finally {
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
          New Schedule
        </Button>
        <Input
          style={{ width: 240 }}
          placeholder="Patent ID"
          value={draftFilters.patentId}
          onChange={(e) => setDraftFilters((prev) => ({ ...prev, patentId: e.target.value.trim() }))}
        />
        <Select
          allowClear
          style={{ width: 180 }}
          placeholder="Status"
          value={draftFilters.status}
          options={SCHEDULE_STATUS_OPTIONS}
          onChange={(value) => setDraftFilters((prev) => ({ ...prev, status: value as ScheduleStatus | undefined }))}
        />
        <Input
          style={{ width: 180 }}
          placeholder="Due from (YYYY-MM-DD)"
          value={draftFilters.dueFrom}
          onChange={(e) => setDraftFilters((prev) => ({ ...prev, dueFrom: e.target.value.trim() }))}
        />
        <Input
          style={{ width: 180 }}
          placeholder="Due to (YYYY-MM-DD)"
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
          Apply
        </Button>
        <Button
          onClick={() => {
            setPage(1);
            setDraftFilters(emptyFilters);
            setFilters(emptyFilters);
          }}
        >
          Reset
        </Button>
        <Button onClick={() => void load()}>Refresh</Button>
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
          { title: 'Patent ID', dataIndex: 'patentId', width: 250, ellipsis: true },
          { title: 'Year', dataIndex: 'yearNo', width: 90 },
          { title: 'Due Date', dataIndex: 'dueDate', width: 130 },
          { title: 'Grace End', dataIndex: 'gracePeriodEnd', width: 130, render: (v) => v || '-' },
          {
            title: 'Status',
            key: 'status',
            width: 220,
            render: (_, row) => (
              <Space size={4}>
                {scheduleStatusTag(row.status)}
                {urgencyTag(calcScheduleUrgency(row))}
              </Space>
            ),
          },
          { title: 'Updated At', dataIndex: 'updatedAt', width: 180, render: (v: string) => (v ? formatTimeSmart(v) : '-') },
          {
            title: 'Actions',
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
                Edit
              </Button>
            ),
          },
        ]}
      />

      <Modal
        open={modalOpen}
        title={editing ? 'Edit Schedule' : 'New Schedule'}
        destroyOnClose
        onCancel={() => setModalOpen(false)}
        onOk={async () => {
          try {
            const values = await form.validateFields();
            const { ok } = await confirmActionWithReason({
              title: editing ? 'Confirm schedule update?' : 'Confirm schedule creation?',
              content: 'This operation will update maintenance schedule data.',
              okText: 'Confirm',
              reasonLabel: 'Note (optional)',
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
            message.success('Saved');
            setModalOpen(false);
            void load();
          } catch (e: any) {
            if (e?.errorFields) return;
            message.error(e?.message || 'Failed to save schedule');
          }
        }}
      >
        <Form form={form} layout="vertical">
          <Form.Item label="Patent ID" name="patentId" rules={[{ required: true, message: 'Patent ID is required' }]}>
            <Input disabled={Boolean(editing)} />
          </Form.Item>
          <Form.Item label="Year No" name="yearNo" rules={[{ required: true, message: 'Year No is required' }]}>
            <InputNumber min={1} style={{ width: '100%' }} disabled={Boolean(editing)} />
          </Form.Item>
          <Form.Item label="Due Date" name="dueDate" rules={[{ required: true, message: 'Due date is required' }]}>
            <Input placeholder="YYYY-MM-DD" />
          </Form.Item>
          <Form.Item label="Grace Period End" name="gracePeriodEnd">
            <Input placeholder="YYYY-MM-DD" />
          </Form.Item>
          <Form.Item label="Status" name="status" rules={[{ required: true, message: 'Status is required' }]}>
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

  const emptyFilters = useMemo<TaskFilters>(() => ({ scheduleId: '', assignedCsUserId: '', status: undefined }), []);
  const [filters, setFilters] = useState<TaskFilters>(emptyFilters);
  const [draftFilters, setDraftFilters] = useState<TaskFilters>(emptyFilters);

  const load = useCallback(async () => {
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
      setData(res);
    } catch (e: any) {
      setError(e);
      setData(null);
      message.error(e?.message || 'Failed to load tasks');
    } finally {
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
          New Task
        </Button>
        <Input
          style={{ width: 250 }}
          placeholder="Schedule ID"
          value={draftFilters.scheduleId}
          onChange={(e) => setDraftFilters((prev) => ({ ...prev, scheduleId: e.target.value.trim() }))}
        />
        <Input
          style={{ width: 230 }}
          placeholder="Assigned CS User ID"
          value={draftFilters.assignedCsUserId}
          onChange={(e) => setDraftFilters((prev) => ({ ...prev, assignedCsUserId: e.target.value.trim() }))}
        />
        <Select
          allowClear
          style={{ width: 180 }}
          placeholder="Task status"
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
          Apply
        </Button>
        <Button
          onClick={() => {
            setPage(1);
            setDraftFilters(emptyFilters);
            setFilters(emptyFilters);
          }}
        >
          Reset
        </Button>
        <Button onClick={() => void load()}>Refresh</Button>
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
          { title: 'Task ID', dataIndex: 'id', width: 230, ellipsis: true },
          { title: 'Schedule ID', dataIndex: 'scheduleId', width: 220, ellipsis: true },
          { title: 'Assigned CS', dataIndex: 'assignedCsUserId', width: 220, render: (v) => v || '-' },
          { title: 'Status', dataIndex: 'status', width: 130, render: (v: TaskStatus) => taskStatusTag(v) },
          { title: 'Note', dataIndex: 'note', ellipsis: true, render: (v) => v || '-' },
          { title: 'Evidence File', dataIndex: 'evidenceFileId', width: 230, ellipsis: true, render: (v) => v || '-' },
          { title: 'Updated At', dataIndex: 'updatedAt', width: 180, render: (v: string) => (v ? formatTimeSmart(v) : '-') },
          {
            title: 'Actions',
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
                    assignedCsUserId: row.assignedCsUserId || '',
                    status: row.status,
                    note: row.note || '',
                    evidenceFileId: row.evidenceFileId || '',
                  });
                  setModalOpen(true);
                }}
              >
                Edit
              </Button>
            ),
          },
        ]}
      />

      <Modal
        open={modalOpen}
        title={editing ? 'Edit Task' : 'New Task'}
        destroyOnClose
        onCancel={() => setModalOpen(false)}
        onOk={async () => {
          try {
            const values = await form.validateFields();
            const { ok } = await confirmActionWithReason({
              title: editing ? 'Confirm task update?' : 'Confirm task creation?',
              content: 'This operation will update maintenance task data.',
              okText: 'Confirm',
              reasonLabel: 'Note (optional)',
            });
            if (!ok) return;

            const payload = {
              ...(editing ? {} : { scheduleId: values.scheduleId }),
              assignedCsUserId: values.assignedCsUserId || null,
              status: values.status,
              note: values.note || undefined,
              evidenceFileId: values.evidenceFileId || undefined,
            };

            if (editing) {
              await apiPatch(`/admin/patent-maintenance/tasks/${editing.id}`, payload);
            } else {
              await apiPost('/admin/patent-maintenance/tasks', payload);
            }
            message.success('Saved');
            setModalOpen(false);
            void load();
          } catch (e: any) {
            if (e?.errorFields) return;
            message.error(e?.message || 'Failed to save task');
          }
        }}
      >
        <Form form={form} layout="vertical">
          <Form.Item label="Schedule ID" name="scheduleId" rules={[{ required: true, message: 'Schedule ID is required' }]}>
            <Input disabled={Boolean(editing)} />
          </Form.Item>
          <Form.Item label="Assigned CS User ID" name="assignedCsUserId">
            <Input />
          </Form.Item>
          <Form.Item label="Status" name="status" rules={[{ required: true, message: 'Status is required' }]}>
            <Select options={TASK_STATUS_OPTIONS} />
          </Form.Item>
          <Form.Item label="Note" name="note">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item label="Evidence File ID" name="evidenceFileId">
            <Space style={{ width: '100%' }} direction="vertical" size={8}>
              <Input placeholder="Input existing file ID or upload below" />
              <Space wrap>
                <Upload
                  maxCount={1}
                  showUploadList={false}
                  customRequest={async (options: any) => {
                    try {
                      const uploaded = await apiUploadFile(options.file as File, 'MAINTENANCE_EVIDENCE');
                      setEvidenceFile(uploaded);
                      form.setFieldsValue({ evidenceFileId: uploaded.id });
                      message.success('Evidence file uploaded');
                      options.onSuccess?.(uploaded);
                    } catch (e: any) {
                      options.onError?.(e);
                      message.error(e?.message || 'Evidence upload failed');
                    }
                  }}
                >
                  <Button>Upload Evidence</Button>
                </Upload>
                <Button
                  onClick={() => {
                    setEvidenceFile(null);
                    form.setFieldsValue({ evidenceFileId: '' });
                  }}
                >
                  Clear
                </Button>
              </Space>
              {evidenceFile?.id ? <Typography.Text type="secondary">Uploaded: {evidenceFile.id}</Typography.Text> : null}
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

  const emptyFilters = useMemo<OrderFilters>(
    () => ({ scheduleId: '', applicantUserId: '', assignedCsUserId: '', status: undefined, reconcileStatus: undefined }),
    [],
  );
  const [filters, setFilters] = useState<OrderFilters>(emptyFilters);
  const [draftFilters, setDraftFilters] = useState<OrderFilters>(emptyFilters);

  const load = useCallback(async () => {
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
      setData(res);
    } catch (e: any) {
      setError(e);
      setData(null);
      message.error(e?.message || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const openEvents = useCallback(async (order: MaintenanceOrder) => {
    setActiveOrder(order);
    setEventsOpen(true);
    setEventLoading(true);
    setEvents([]);
    try {
      const res = await apiGet<{ items: MaintenanceOrderEvent[] }>(`/admin/patent-maintenance/orders/${order.id}/events`);
      setEvents(res?.items || []);
    } catch (e: any) {
      message.error(e?.message || 'Failed to load order events');
    } finally {
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
          assignedCsUserId: order.assignedCsUserId || '',
        });
      } else if (action === 'PAY') {
        actionForm.setFieldsValue({
          paymentChannel: order.paymentChannel || 'WECHAT',
          paymentTxnNo: order.paymentTxnNo || '',
          paidAt: order.paidAt || '',
        });
      } else if (action === 'EXECUTE') {
        actionForm.setFieldsValue({
          officialSubmissionNo: order.officialSubmissionNo || '',
          executedAt: order.executedAt || '',
        });
      } else if (action === 'RECEIPT') {
        actionForm.setFieldsValue({
          officialReceiptNo: order.officialReceiptNo || '',
          officialReceiptFileId: order.officialReceiptFileId || '',
          receiptIssuedAt: order.receiptIssuedAt || '',
        });
      } else if (action === 'RECONCILE') {
        actionForm.setFieldsValue({
          reconcileStatus: order.reconcileStatus || 'MATCHED',
          reconcileNote: order.reconcileNote || '',
        });
      } else if (action === 'CLOSE') {
        actionForm.setFieldsValue({ closeNote: order.closeNote || '' });
      } else if (action === 'CANCEL') {
        actionForm.setFieldsValue({ closeNote: order.closeNote || '' });
      }

      setActionOpen(true);
    },
    [actionForm],
  );

  const submitAction = useCallback(async () => {
    if (!activeOrder) return;
    try {
      setActionSubmitting(true);
      const values = await actionForm.validateFields();
      const { ok, reason } = await confirmActionWithReason({
        title: `Confirm ${actionLabel(activeAction)}?`,
        content: `Order ${activeOrder.id} will enter the next lifecycle state.`,
        okText: 'Confirm',
        reasonLabel: 'Operation note (optional)',
      });
      if (!ok) return;

      let path = '';
      let payload: Record<string, any> = {};

      if (activeAction === 'QUOTE') {
        path = `/admin/patent-maintenance/orders/${activeOrder.id}/quote`;
        payload = {
          officialFeeFen: values.officialFeeFen,
          lateFeeFen: values.lateFeeFen ?? 0,
          serviceFeeFen: values.serviceFeeFen,
          paymentDeadline: values.paymentDeadline,
          ...(values.assignedCsUserId ? { assignedCsUserId: values.assignedCsUserId } : {}),
        };
      } else if (activeAction === 'PAY') {
        path = `/admin/patent-maintenance/orders/${activeOrder.id}/payment-confirm`;
        payload = {
          paymentChannel: values.paymentChannel,
          paymentTxnNo: values.paymentTxnNo,
          ...(values.paidAt ? { paidAt: values.paidAt } : {}),
        };
      } else if (activeAction === 'EXECUTE') {
        path = `/admin/patent-maintenance/orders/${activeOrder.id}/execution`;
        payload = {
          officialSubmissionNo: values.officialSubmissionNo,
          ...(values.executedAt ? { executedAt: values.executedAt } : {}),
        };
      } else if (activeAction === 'RECEIPT') {
        path = `/admin/patent-maintenance/orders/${activeOrder.id}/receipt`;
        payload = {
          officialReceiptNo: values.officialReceiptNo,
          officialReceiptFileId: values.officialReceiptFileId,
          ...(values.receiptIssuedAt ? { receiptIssuedAt: values.receiptIssuedAt } : {}),
        };
      } else if (activeAction === 'RECONCILE') {
        path = `/admin/patent-maintenance/orders/${activeOrder.id}/reconcile`;
        payload = {
          reconcileStatus: values.reconcileStatus,
          reconcileNote: values.reconcileNote || reason || undefined,
        };
      } else if (activeAction === 'CLOSE') {
        path = `/admin/patent-maintenance/orders/${activeOrder.id}/close`;
        payload = {
          closeNote: values.closeNote || reason || undefined,
        };
      } else if (activeAction === 'CANCEL') {
        path = `/admin/patent-maintenance/orders/${activeOrder.id}/cancel`;
        payload = {
          closeNote: values.closeNote || reason,
        };
      }

      await apiPost(path, payload);
      message.success(`${actionLabel(activeAction)} success`);
      setActionOpen(false);
      void load();
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error(e?.message || `${actionLabel(activeAction)} failed`);
    } finally {
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
          New Order
        </Button>
        <Input
          style={{ width: 230 }}
          placeholder="Schedule ID"
          value={draftFilters.scheduleId}
          onChange={(e) => setDraftFilters((prev) => ({ ...prev, scheduleId: e.target.value.trim() }))}
        />
        <Input
          style={{ width: 220 }}
          placeholder="Applicant User ID"
          value={draftFilters.applicantUserId}
          onChange={(e) => setDraftFilters((prev) => ({ ...prev, applicantUserId: e.target.value.trim() }))}
        />
        <Input
          style={{ width: 220 }}
          placeholder="Assigned CS User ID"
          value={draftFilters.assignedCsUserId}
          onChange={(e) => setDraftFilters((prev) => ({ ...prev, assignedCsUserId: e.target.value.trim() }))}
        />
        <Select
          allowClear
          style={{ width: 180 }}
          placeholder="Order status"
          value={draftFilters.status}
          options={ORDER_STATUS_OPTIONS}
          onChange={(value) => setDraftFilters((prev) => ({ ...prev, status: value as OrderStatus | undefined }))}
        />
        <Select
          allowClear
          style={{ width: 180 }}
          placeholder="Reconcile status"
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
          Apply
        </Button>
        <Button
          onClick={() => {
            setPage(1);
            setDraftFilters(emptyFilters);
            setFilters(emptyFilters);
          }}
        >
          Reset
        </Button>
        <Button onClick={() => void load()}>Refresh</Button>
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
          { title: 'Order ID', dataIndex: 'id', width: 230, ellipsis: true },
          {
            title: 'Patent',
            width: 260,
            render: (_, row) => (
              <Space direction="vertical" size={2}>
                <Typography.Text ellipsis style={{ maxWidth: 240 }}>
                  {row.patentTitle || '-'}
                </Typography.Text>
                <Typography.Text type="secondary">{row.applicationNoDisplay || '-'}</Typography.Text>
              </Space>
            ),
          },
          { title: 'Schedule', dataIndex: 'scheduleId', width: 220, ellipsis: true },
          { title: 'Year', dataIndex: 'scheduleYearNo', width: 70, render: (v) => v || '-' },
          { title: 'Due Date', dataIndex: 'scheduleDueDate', width: 130, render: (v) => v || '-' },
          { title: 'Applicant', dataIndex: 'applicantUserId', width: 220, ellipsis: true },
          { title: 'Assigned CS', dataIndex: 'assignedCsUserId', width: 220, ellipsis: true, render: (v) => v || '-' },
          { title: 'Status', dataIndex: 'status', width: 150, render: (v: OrderStatus) => orderStatusTag(v) },
          { title: 'Reconcile', dataIndex: 'reconcileStatus', width: 130, render: (v: ReconcileStatus) => reconcileStatusTag(v) },
          { title: 'Total Amount', dataIndex: 'totalAmountFen', width: 120, render: (v: number) => formatMoneyFen(v) },
          { title: 'Payment Channel', dataIndex: 'paymentChannel', width: 130, render: (v: PaymentChannel) => statusLabel(v, PAYMENT_CHANNEL_OPTIONS) },
          { title: 'Payment Txn', dataIndex: 'paymentTxnNo', width: 200, ellipsis: true, render: (v) => v || '-' },
          { title: 'Payment Deadline', dataIndex: 'paymentDeadline', width: 180, render: (v: string) => formatDateTime(v) },
          { title: 'Paid At', dataIndex: 'paidAt', width: 180, render: (v: string) => formatDateTime(v) },
          { title: 'Executed At', dataIndex: 'executedAt', width: 180, render: (v: string) => formatDateTime(v) },
          { title: 'Updated At', dataIndex: 'updatedAt', width: 180, render: (v: string) => formatDateTime(v) },
          {
            title: 'Actions',
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
                  Timeline
                </Button>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        open={createOpen}
        title="Create Maintenance Order"
        destroyOnClose
        onCancel={() => setCreateOpen(false)}
        onOk={async () => {
          try {
            const values = await createForm.validateFields();
            const { ok } = await confirmActionWithReason({
              title: 'Confirm maintenance order creation?',
              content: 'A new order will be created in REQUESTED status.',
              okText: 'Confirm',
              reasonLabel: 'Note (optional)',
            });
            if (!ok) return;
            await apiPost('/admin/patent-maintenance/orders', {
              scheduleId: values.scheduleId,
              ...(values.applicantUserId ? { applicantUserId: values.applicantUserId } : {}),
              ...(values.assignedCsUserId ? { assignedCsUserId: values.assignedCsUserId } : {}),
            });
            message.success('Order created');
            setCreateOpen(false);
            void load();
          } catch (e: any) {
            if (e?.errorFields) return;
            message.error(e?.message || 'Create order failed');
          }
        }}
      >
        <Form form={createForm} layout="vertical">
          <Form.Item label="Schedule ID" name="scheduleId" rules={[{ required: true, message: 'Schedule ID is required' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Applicant User ID (optional)" name="applicantUserId">
            <Input />
          </Form.Item>
          <Form.Item label="Assigned CS User ID (optional)" name="assignedCsUserId">
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={actionOpen}
        title={`${actionLabel(activeAction)}${activeOrder ? ` - ${activeOrder.id}` : ''}`}
        destroyOnClose
        onCancel={() => setActionOpen(false)}
        onOk={() => void submitAction()}
        confirmLoading={actionSubmitting}
      >
        <Form form={actionForm} layout="vertical">
          {activeAction === 'QUOTE' ? (
            <>
              <Form.Item label="Official Fee (fen)" name="officialFeeFen" rules={[{ required: true, message: 'Required' }]}>
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item label="Late Fee (fen)" name="lateFeeFen">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item label="Service Fee (fen)" name="serviceFeeFen" rules={[{ required: true, message: 'Required' }]}>
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item label="Payment Deadline (ISO8601)" name="paymentDeadline" rules={[{ required: true, message: 'Required' }]}>
                <Input placeholder="2026-03-31T23:59:59.000Z" />
              </Form.Item>
              <Form.Item label="Assigned CS User ID" name="assignedCsUserId">
                <Input />
              </Form.Item>
            </>
          ) : null}

          {activeAction === 'PAY' ? (
            <>
              <Form.Item label="Payment Channel" name="paymentChannel" rules={[{ required: true, message: 'Required' }]}>
                <Select options={PAYMENT_CHANNEL_OPTIONS} />
              </Form.Item>
              <Form.Item label="Payment Transaction No" name="paymentTxnNo" rules={[{ required: true, message: 'Required' }]}>
                <Input />
              </Form.Item>
              <Form.Item label="Paid At (ISO8601, optional)" name="paidAt">
                <Input placeholder="2026-03-31T23:59:59.000Z" />
              </Form.Item>
            </>
          ) : null}

          {activeAction === 'EXECUTE' ? (
            <>
              <Form.Item label="Official Submission No" name="officialSubmissionNo" rules={[{ required: true, message: 'Required' }]}>
                <Input />
              </Form.Item>
              <Form.Item label="Executed At (ISO8601, optional)" name="executedAt">
                <Input placeholder="2026-03-31T23:59:59.000Z" />
              </Form.Item>
            </>
          ) : null}

          {activeAction === 'RECEIPT' ? (
            <>
              <Form.Item label="Official Receipt No" name="officialReceiptNo" rules={[{ required: true, message: 'Required' }]}>
                <Input />
              </Form.Item>
              <Form.Item label="Receipt File ID" name="officialReceiptFileId" rules={[{ required: true, message: 'Required' }]}>
                <Space style={{ width: '100%' }} direction="vertical" size={8}>
                  <Input placeholder="Input existing file ID or upload below" />
                  <Space wrap>
                    <Upload
                      maxCount={1}
                      showUploadList={false}
                      customRequest={async (options: any) => {
                        try {
                          const uploaded = await apiUploadFile(options.file as File, 'MAINTENANCE_RECEIPT');
                          setReceiptFile(uploaded);
                          actionForm.setFieldsValue({ officialReceiptFileId: uploaded.id });
                          message.success('Receipt file uploaded');
                          options.onSuccess?.(uploaded);
                        } catch (e: any) {
                          options.onError?.(e);
                          message.error(e?.message || 'Receipt upload failed');
                        }
                      }}
                    >
                      <Button>Upload Receipt</Button>
                    </Upload>
                    <Button
                      onClick={() => {
                        setReceiptFile(null);
                        actionForm.setFieldsValue({ officialReceiptFileId: '' });
                      }}
                    >
                      Clear
                    </Button>
                  </Space>
                  {receiptFile?.id ? <Typography.Text type="secondary">Uploaded: {receiptFile.id}</Typography.Text> : null}
                </Space>
              </Form.Item>
              <Form.Item label="Receipt Issued At (ISO8601, optional)" name="receiptIssuedAt">
                <Input placeholder="2026-03-31T23:59:59.000Z" />
              </Form.Item>
            </>
          ) : null}

          {activeAction === 'RECONCILE' ? (
            <>
              <Form.Item label="Reconcile Status" name="reconcileStatus" rules={[{ required: true, message: 'Required' }]}>
                <Select options={RECONCILE_STATUS_OPTIONS} />
              </Form.Item>
              <Form.Item label="Reconcile Note (optional)" name="reconcileNote">
                <Input.TextArea rows={3} />
              </Form.Item>
            </>
          ) : null}

          {activeAction === 'CLOSE' ? (
            <Form.Item label="Close Note (optional)" name="closeNote">
              <Input.TextArea rows={3} />
            </Form.Item>
          ) : null}

          {activeAction === 'CANCEL' ? (
            <Form.Item label="Cancel Reason" name="closeNote" rules={[{ required: true, message: 'Cancel reason is required' }]}>
              <Input.TextArea rows={3} />
            </Form.Item>
          ) : null}
        </Form>
      </Modal>

      <Modal
        open={eventsOpen}
        title={`Order Timeline${activeOrder ? ` - ${activeOrder.id}` : ''}`}
        footer={null}
        width={860}
        onCancel={() => setEventsOpen(false)}
      >
        {eventLoading ? (
          <Typography.Text>Loading...</Typography.Text>
        ) : events.length ? (
          <Timeline
            items={events.map((evt) => ({
              color: evt.toStatus === 'CANCELLED' ? 'gray' : evt.toStatus === 'CLOSED' ? 'green' : 'blue',
              children: (
                <Space direction="vertical" size={4} style={{ width: '100%' }}>
                  <Space size={8} wrap>
                    <Tag color="default">{evt.eventType}</Tag>
                    <Typography.Text strong>{evt.fromStatus ? `${evt.fromStatus} -> ${evt.toStatus}` : evt.toStatus}</Typography.Text>
                    <Typography.Text type="secondary">{formatTimeSmart(evt.createdAt)}</Typography.Text>
                  </Space>
                  <Typography.Text type="secondary">
                    Actor: {evt.actorNickname || evt.actorUserId || 'System'}
                    {evt.actorRole ? ` (${evt.actorRole})` : ''}
                  </Typography.Text>
                  {evt.note ? <Typography.Text>Note: {evt.note}</Typography.Text> : null}
                  {evt.payloadJson ? <Typography.Text type="secondary">Payload: {JSON.stringify(evt.payloadJson)}</Typography.Text> : null}
                </Space>
              ),
            }))}
          />
        ) : (
          <Typography.Text type="secondary">No timeline events.</Typography.Text>
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
          Patent Maintenance Operations
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
          Unified management for schedules, tasks, and payment-execution-reconciliation lifecycle orders.
        </Typography.Paragraph>
        <Tabs
          defaultActiveKey="schedules"
          items={[
            {
              key: 'schedules',
              label: 'Schedules',
              children: <MaintenanceSchedules />,
            },
            {
              key: 'tasks',
              label: 'Tasks',
              children: <MaintenanceTasks />,
            },
            {
              key: 'orders',
              label: 'Orders',
              children: <MaintenanceOrders />,
            },
          ]}
        />
      </Space>
    </Card>
  );
}
