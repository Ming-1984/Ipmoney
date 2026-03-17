import { Button, Card, Form, Input, Modal, Select, Space, Table, Tag, Typography, message } from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { apiDelete, apiGet, apiPatch, apiPost } from '../lib/api';
import { formatTimeSmart } from '../lib/format';
import { RequestErrorAlert } from '../ui/RequestState';
import { confirmActionWithReason } from '../ui/confirm';

type AnnouncementStatus = 'DRAFT' | 'PUBLISHED' | 'OFF_SHELF';
type RelatedPatent = { name: string; patentNo: string };

type Announcement = {
  id: string;
  title: string;
  summary?: string | null;
  content?: string | null;
  publisherName?: string | null;
  issueNo?: string | null;
  sourceUrl?: string | null;
  tags?: string[];
  relatedPatents?: RelatedPatent[];
  status?: AnnouncementStatus;
  createdAt: string;
  publishedAt?: string | null;
  updatedAt?: string | null;
};

type PagedAnnouncement = {
  items: Announcement[];
  page: { page: number; pageSize: number; total: number };
};

function statusTag(status?: AnnouncementStatus | null) {
  const value = status || 'DRAFT';
  if (value === 'PUBLISHED') return <Tag color="green">已发布</Tag>;
  if (value === 'OFF_SHELF') return <Tag color="default">已下架</Tag>;
  return <Tag color="orange">草稿</Tag>;
}

function toTagInput(tags?: string[] | null) {
  return (tags || []).join(', ');
}

function toRelatedInput(related?: RelatedPatent[] | null) {
  return (related || []).map((item) => `${item.name || ''}|${item.patentNo || ''}`.trim()).join('\n');
}

function parseTags(input?: string): string[] {
  return String(input || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseRelated(input?: string): RelatedPatent[] {
  return String(input || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, patentNo] = line.split('|');
      return { name: String(name || '').trim(), patentNo: String(patentNo || '').trim() };
    })
    .filter((item) => item.name || item.patentNo);
}

export function AnnouncementsPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown | null>(null);
  const [data, setData] = useState<PagedAnnouncement | null>(null);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<AnnouncementStatus | ''>('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await apiGet<PagedAnnouncement>('/admin/announcements', {
        q: q.trim() || undefined,
        status: status || undefined,
        page,
        pageSize: 20,
      });
      setData(d);
    } catch (e: any) {
      setError(e);
      message.error(e?.message || '加载失败');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [page, q, status]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [q, status]);

  const rows = useMemo(() => data?.items || [], [data?.items]);

  const openCreate = useCallback(() => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ status: 'DRAFT' });
    setModalOpen(true);
  }, [form]);

  const openEdit = useCallback(
    (item: Announcement) => {
      setEditing(item);
      form.setFieldsValue({
        title: item.title,
        summary: item.summary,
        content: item.content,
        publisherName: item.publisherName,
        issueNo: item.issueNo,
        sourceUrl: item.sourceUrl,
        tags: toTagInput(item.tags),
        relatedPatents: toRelatedInput(item.relatedPatents),
        status: item.status || 'DRAFT',
      });
      setModalOpen(true);
    },
    [form],
  );

  const handleSubmit = useCallback(async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        title: values.title,
        summary: values.summary || undefined,
        content: values.content || undefined,
        publisherName: values.publisherName || undefined,
        issueNo: values.issueNo || undefined,
        sourceUrl: values.sourceUrl || undefined,
        tags: parseTags(values.tags),
        relatedPatents: parseRelated(values.relatedPatents),
        status: values.status,
      };
      if (editing) {
        await apiPatch(`/admin/announcements/${editing.id}`, payload, { idempotencyKey: `announcement-${editing.id}` });
        message.success('已更新公告');
      } else {
        await apiPost('/admin/announcements', payload, { idempotencyKey: `announcement-create-${Date.now()}` });
        message.success('已创建公告');
      }
      setModalOpen(false);
      void load();
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error(e?.message || '保存失败');
    }
  }, [editing, form, load]);

  const handlePublish = useCallback(
    async (item: Announcement) => {
      const { ok, reason } = await confirmActionWithReason({
        title: '确认发布该公告？',
        content: '发布后将对外展示，请确认内容无误。',
        okText: '发布',
        reasonLabel: '发布备注（建议填写）',
      });
      if (!ok) return;
      try {
        await apiPost(`/admin/announcements/${item.id}/publish`, { reason: reason || undefined }, { idempotencyKey: `announcement-publish-${item.id}` });
        message.success('已发布');
        void load();
      } catch (e: any) {
        message.error(e?.message || '发布失败');
      }
    },
    [load],
  );

  const handleOffShelf = useCallback(
    async (item: Announcement) => {
      const { ok, reason } = await confirmActionWithReason({
        title: '确认下架该公告？',
        content: '下架后将不再对外展示。',
        okText: '下架',
        reasonLabel: '下架原因（建议填写）',
      });
      if (!ok) return;
      try {
        await apiPost(`/admin/announcements/${item.id}/off-shelf`, { reason: reason || undefined }, { idempotencyKey: `announcement-off-${item.id}` });
        message.success('已下架');
        void load();
      } catch (e: any) {
        message.error(e?.message || '下架失败');
      }
    },
    [load],
  );

  const handleDelete = useCallback(
    async (item: Announcement) => {
      const { ok } = await confirmActionWithReason({
        title: '确认删除该公告？',
        content: '删除后不可恢复，建议仅删除草稿。',
        okText: '删除',
        danger: true,
      });
      if (!ok) return;
      try {
        await apiDelete(`/admin/announcements/${item.id}`, { idempotencyKey: `announcement-del-${item.id}` });
        message.success('已删除');
        void load();
      } catch (e: any) {
        message.error(e?.message || '删除失败');
      }
    },
    [load],
  );

  return (
    <Card className="admin-announcements-page">
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <div>
          <Typography.Title level={3} style={{ marginTop: 0 }}>
            公告管理
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            维护平台公告内容与发布状态，支持草稿、发布与下架。
          </Typography.Paragraph>
        </div>

        {error ? <RequestErrorAlert error={error} onRetry={load} /> : null}

        <Space wrap size={12}>
          <Input
            value={q}
            style={{ width: 240 }}
            placeholder="标题/摘要关键词"
            allowClear
            onChange={(e) => setQ(e.target.value)}
            onPressEnter={() => void load()}
          />
          <Select
            value={status}
            style={{ width: 160 }}
            placeholder="状态"
            onChange={(v) => setStatus((v as AnnouncementStatus) || '')}
            options={[
              { value: '', label: '全部状态' },
              { value: 'DRAFT', label: '草稿' },
              { value: 'PUBLISHED', label: '已发布' },
              { value: 'OFF_SHELF', label: '已下架' },
            ]}
          />
          <Button onClick={() => void load()}>查询</Button>
          <Button type="primary" onClick={openCreate}>
            新建公告
          </Button>
        </Space>

        <Table<Announcement>
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
            { title: '标题', dataIndex: 'title', ellipsis: true },
            { title: '状态', dataIndex: 'status', render: (v) => statusTag(v) },
            { title: '发布单位', dataIndex: 'publisherName', ellipsis: true },
            { title: '发布时间', dataIndex: 'publishedAt', render: (v) => (v ? formatTimeSmart(v) : '-') },
            { title: '更新时间', dataIndex: 'updatedAt', render: (v) => (v ? formatTimeSmart(v) : '-') },
            {
              title: '操作',
              key: 'actions',
              render: (_, r) => (
                <Space>
                  <Button onClick={() => openEdit(r)}>编辑</Button>
                  <Button disabled={r.status === 'PUBLISHED'} onClick={() => void handlePublish(r)}>
                    发布
                  </Button>
                  <Button disabled={r.status !== 'PUBLISHED'} onClick={() => void handleOffShelf(r)}>
                    下架
                  </Button>
                  <Button danger onClick={() => void handleDelete(r)}>
                    删除
                  </Button>
                </Space>
              ),
            },
          ]}
        />
      </Space>

      <Modal
        title={editing ? '编辑公告' : '新建公告'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSubmit}
        okText="保存"
      >
        <Form form={form} layout="vertical">
          <Form.Item label="标题" name="title" rules={[{ required: true, message: '请输入标题' }]}>
            <Input placeholder="公告标题" />
          </Form.Item>
          <Form.Item label="摘要" name="summary">
            <Input placeholder="摘要（可选）" />
          </Form.Item>
          <Form.Item label="正文" name="content">
            <Input.TextArea rows={5} placeholder="正文内容（可选）" />
          </Form.Item>
          <Form.Item label="发布单位" name="publisherName">
            <Input placeholder="发布单位（可选）" />
          </Form.Item>
          <Form.Item label="期次/编号" name="issueNo">
            <Input placeholder="如 2025-10（可选）" />
          </Form.Item>
          <Form.Item label="来源链接" name="sourceUrl">
            <Input placeholder="请输入来源链接（可选）" />
          </Form.Item>
          <Form.Item label="标签（逗号分隔）" name="tags">
            <Input placeholder="政策公告, 专利清单" />
          </Form.Item>
          <Form.Item label="关联专利（每行：名称|专利号）" name="relatedPatents">
            <Input.TextArea rows={3} placeholder="一种装置|CN202310000001" />
          </Form.Item>
          <Form.Item label="状态" name="status">
            <Select
              options={[
                { value: 'DRAFT', label: '草稿' },
                { value: 'PUBLISHED', label: '已发布' },
                { value: 'OFF_SHELF', label: '已下架' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
