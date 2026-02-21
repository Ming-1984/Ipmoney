import { Button, Card, Form, Input, InputNumber, Modal, Select, Space, Table, Tabs, Typography, message } from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { apiGet, apiPatch, apiPost } from '../lib/api';
import { formatTimeSmart } from '../lib/format';
import { RequestErrorAlert } from '../ui/RequestState';
import { confirmActionWithReason } from '../ui/confirm';

type Schedule = {
  id: string;
  patentId: string;
  yearNo: number;
  dueDate: string;
  gracePeriodEnd?: string | null;
  status: 'DUE' | 'PAID' | 'OVERDUE' | 'WAIVED';
  createdAt: string;
  updatedAt?: string;
};

type Task = {
  id: string;
  scheduleId: string;
  assignedCsUserId?: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
  note?: string;
  evidenceFileId?: string;
  createdAt: string;
  updatedAt?: string;
};

type Paged<T> = {
  items: T[];
  page: { page: number; pageSize: number; total: number };
};

const SCHEDULE_STATUS_OPTIONS = [
  { value: 'DUE', label: '待缴' },
  { value: 'PAID', label: '已缴' },
  { value: 'OVERDUE', label: '逾期' },
  { value: 'WAIVED', label: '豁免' },
];

const TASK_STATUS_OPTIONS = [
  { value: 'OPEN', label: '待处理' },
  { value: 'IN_PROGRESS', label: '处理中' },
  { value: 'DONE', label: '已完成' },
  { value: 'CANCELLED', label: '已取消' },
];

function MaintenanceSchedules() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown | null>(null);
  const [data, setData] = useState<Paged<Schedule> | null>(null);
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Schedule | null>(null);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await apiGet<Paged<Schedule>>('/admin/patent-maintenance/schedules', {
        page,
        pageSize: 20,
      });
      setData(d);
    } catch (e: any) {
      setError(e);
      setData(null);
      message.error(e?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(() => data?.items || [], [data?.items]);

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      {error ? <RequestErrorAlert error={error} onRetry={load} /> : null}

      <Space>
        <Button
          type="primary"
          onClick={() => {
            setEditing(null);
            form.resetFields();
            setModalOpen(true);
          }}
        >
          新建年费计划
        </Button>
        <Button onClick={() => void load()}>刷新</Button>
      </Space>

      <Table<Schedule>
        rowKey="id"
        loading={loading}
        dataSource={rows}
        pagination={{
          current: data?.page.page || page,
          pageSize: data?.page.pageSize || 20,
          total: data?.page.total || 0,
          onChange: (next) => setPage(next),
        }}
        columns={[
          { title: '专利ID', dataIndex: 'patentId', ellipsis: true },
          { title: '年次', dataIndex: 'yearNo', width: 80 },
          { title: '到期日', dataIndex: 'dueDate', width: 120 },
          { title: '宽限期', dataIndex: 'gracePeriodEnd', width: 120, render: (v) => v || '-' },
          { title: '状态', dataIndex: 'status', width: 90 },
          {
            title: '更新时间',
            dataIndex: 'updatedAt',
            width: 150,
            render: (v: string) => (v ? formatTimeSmart(v) : '-'),
          },
          {
            title: '操作',
            key: 'actions',
            width: 100,
            render: (_, r) => (
              <Button
                size="small"
                onClick={() => {
                  setEditing(r);
                  form.setFieldsValue({
                    patentId: r.patentId,
                    yearNo: r.yearNo,
                    dueDate: r.dueDate,
                    gracePeriodEnd: r.gracePeriodEnd || '',
                    status: r.status,
                  });
                  setModalOpen(true);
                  apiGet<Schedule>(`/admin/patent-maintenance/schedules/${r.id}`)
                    .then((detail) => {
                      setEditing(detail);
                      form.setFieldsValue({
                        patentId: detail.patentId,
                        yearNo: detail.yearNo,
                        dueDate: detail.dueDate,
                        gracePeriodEnd: detail.gracePeriodEnd || '',
                        status: detail.status,
                      });
                    })
                    .catch((e: any) => {
                      message.error(e?.message || '加载详情失败');
                    });
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
        title={editing ? '编辑年费计划' : '新建年费计划'}
        destroyOnClose
        onCancel={() => setModalOpen(false)}
        onOk={async () => {
          try {
            const v = await form.validateFields();
            const { ok } = await confirmActionWithReason({
              title: editing ? '确认更新年费计划？' : '确认创建年费计划？',
              content: '该操作将更新年费计划数据。',
              okText: '确认',
              reasonLabel: '备注（建议填写）',
            });
            if (!ok) return;
            if (editing) {
              await apiPatch(`/admin/patent-maintenance/schedules/${editing.id}`, {
                dueDate: v.dueDate,
                gracePeriodEnd: v.gracePeriodEnd || undefined,
                status: v.status,
              });
            } else {
              await apiPost('/admin/patent-maintenance/schedules', {
                patentId: v.patentId,
                yearNo: v.yearNo,
                dueDate: v.dueDate,
                gracePeriodEnd: v.gracePeriodEnd || undefined,
                status: v.status,
              });
            }
            message.success('已保存');
            setModalOpen(false);
            void load();
          } catch (e: any) {
            if (e?.errorFields) return;
            message.error(e?.message || '保存失败');
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
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await apiGet<Paged<Task>>('/admin/patent-maintenance/tasks', {
        page,
        pageSize: 20,
      });
      setData(d);
    } catch (e: any) {
      setError(e);
      setData(null);
      message.error(e?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(() => data?.items || [], [data?.items]);

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      {error ? <RequestErrorAlert error={error} onRetry={load} /> : null}

      <Space>
        <Button
          type="primary"
          onClick={() => {
            setEditing(null);
            form.resetFields();
            setModalOpen(true);
          }}
        >
          新建任务
        </Button>
        <Button onClick={() => void load()}>刷新</Button>
      </Space>

      <Table<Task>
        rowKey="id"
        loading={loading}
        dataSource={rows}
        pagination={{
          current: data?.page.page || page,
          pageSize: data?.page.pageSize || 20,
          total: data?.page.total || 0,
          onChange: (next) => setPage(next),
        }}
        columns={[
          { title: '计划ID', dataIndex: 'scheduleId', ellipsis: true },
          { title: '负责人', dataIndex: 'assignedCsUserId', ellipsis: true, render: (v) => v || '-' },
          { title: '状态', dataIndex: 'status', width: 110 },
          { title: '备注', dataIndex: 'note', ellipsis: true, render: (v) => v || '-' },
          { title: '证据文件', dataIndex: 'evidenceFileId', ellipsis: true, render: (v) => v || '-' },
          {
            title: '更新时间',
            dataIndex: 'updatedAt',
            width: 150,
            render: (v: string) => (v ? formatTimeSmart(v) : '-'),
          },
          {
            title: '操作',
            key: 'actions',
            width: 100,
            render: (_, r) => (
              <Button
                size="small"
                onClick={() => {
                  setEditing(r);
                  form.setFieldsValue({
                    scheduleId: r.scheduleId,
                    assignedCsUserId: r.assignedCsUserId || '',
                    status: r.status,
                    note: r.note || '',
                    evidenceFileId: r.evidenceFileId || '',
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
        onCancel={() => setModalOpen(false)}
        onOk={async () => {
          try {
            const v = await form.validateFields();
            const { ok } = await confirmActionWithReason({
              title: editing ? '确认更新任务？' : '确认创建任务？',
              content: '该操作将更新托管任务数据。',
              okText: '确认',
              reasonLabel: '备注（建议填写）',
            });
            if (!ok) return;
            if (editing) {
              await apiPatch(`/admin/patent-maintenance/tasks/${editing.id}`, {
                assignedCsUserId: v.assignedCsUserId || undefined,
                status: v.status,
                note: v.note || undefined,
                evidenceFileId: v.evidenceFileId || undefined,
              });
            } else {
              await apiPost('/admin/patent-maintenance/tasks', {
                scheduleId: v.scheduleId,
                assignedCsUserId: v.assignedCsUserId || undefined,
                status: v.status,
                note: v.note || undefined,
              });
            }
            message.success('已保存');
            setModalOpen(false);
            void load();
          } catch (e: any) {
            if (e?.errorFields) return;
            message.error(e?.message || '保存失败');
          }
        }}
      >
        <Form form={form} layout="vertical">
          <Form.Item label="计划ID" name="scheduleId" rules={[{ required: true, message: '请输入计划ID' }]}>
            <Input disabled={Boolean(editing)} />
          </Form.Item>
          <Form.Item label="负责人ID" name="assignedCsUserId">
            <Input placeholder="用户ID" />
          </Form.Item>
          <Form.Item label="状态" name="status" rules={[{ required: true, message: '请选择状态' }]}>
            <Select options={TASK_STATUS_OPTIONS} />
          </Form.Item>
          <Form.Item label="备注" name="note">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item label="证据文件ID" name="evidenceFileId">
            <Input placeholder="文件ID" />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}

export function MaintenancePage() {
  return (
    <Card>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <div>
          <Typography.Title level={3} style={{ marginTop: 0 }}>
            专利年费托管
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            维护年费计划与托管任务。
          </Typography.Paragraph>
        </div>

        <Tabs
          items={[
            {
              key: 'schedules',
              label: '年费计划',
              children: <MaintenanceSchedules />,
            },
            {
              key: 'tasks',
              label: '托管任务',
              children: <MaintenanceTasks />,
            },
          ]}
        />
      </Space>
    </Card>
  );
}
