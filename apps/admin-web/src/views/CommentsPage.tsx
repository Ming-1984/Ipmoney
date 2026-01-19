import { Button, Card, Input, Select, Space, Table, Tag, Typography, message } from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { apiGet, apiPatch } from '../lib/api';
import { formatTimeSmart } from '../lib/format';
import { RequestErrorAlert } from '../ui/RequestState';
import { confirmAction } from '../ui/confirm';

type CommentStatus = 'VISIBLE' | 'HIDDEN' | 'DELETED';
type CommentContentType = 'LISTING' | 'DEMAND' | 'ACHIEVEMENT' | 'ARTWORK';

type Comment = {
  id: string;
  contentType: CommentContentType;
  contentId: string;
  parentCommentId?: string | null;
  status?: CommentStatus;
  text: string;
  createdAt: string;
  updatedAt?: string | null;
  user: {
    id: string;
    nickname?: string;
    role?: string;
    verificationStatus?: string;
    verificationType?: string;
    avatarUrl?: string;
  };
};

type PagedComment = {
  items: Comment[];
  page: { page: number; pageSize: number; total: number };
};

function contentTypeLabel(type?: CommentContentType | null): string {
  if (!type) return '-';
  if (type === 'LISTING') return '专利';
  if (type === 'DEMAND') return '需求';
  if (type === 'ARTWORK') return '书画';
  return '成果';
}

function statusTag(status?: CommentStatus | null) {
  const value = status || 'VISIBLE';
  if (value === 'VISIBLE') return <Tag color="green">可见</Tag>;
  if (value === 'HIDDEN') return <Tag color="orange">已隐藏</Tag>;
  return <Tag color="red">已删除</Tag>;
}

export function CommentsPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown | null>(null);
  const [data, setData] = useState<PagedComment | null>(null);
  const [q, setQ] = useState('');
  const [contentType, setContentType] = useState<CommentContentType | ''>('');
  const [contentId, setContentId] = useState('');
  const [status, setStatus] = useState<CommentStatus | ''>('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await apiGet<PagedComment>('/admin/comments', {
        q: q.trim() || undefined,
        contentType: contentType || undefined,
        contentId: contentId.trim() || undefined,
        status: status || undefined,
        page: 1,
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
  }, [contentId, contentType, q, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(() => data?.items || [], [data?.items]);

  const updateStatus = useCallback(
    async (comment: Comment, nextStatus: CommentStatus) => {
      const actionLabel =
        nextStatus === 'HIDDEN' ? '隐藏' : nextStatus === 'VISIBLE' ? '恢复' : '删除';
      if (nextStatus !== 'VISIBLE') {
        const ok = await confirmAction({
          title: `确认${actionLabel}该留言？`,
          content: nextStatus === 'DELETED' ? '删除后将不可恢复。' : '隐藏后用户端将显示为已隐藏。',
          okText: actionLabel,
          danger: nextStatus === 'DELETED',
        });
        if (!ok) return;
      }
      try {
        await apiPatch(`/admin/comments/${comment.id}`, { status: nextStatus }, { idempotencyKey: `comment-${comment.id}-${nextStatus}` });
        message.success(`已${actionLabel}`);
        void load();
      } catch (e: any) {
        message.error(e?.message || '操作失败');
      }
    },
    [load],
  );

  return (
    <Card>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <div>
          <Typography.Title level={3} style={{ marginTop: 0 }}>
            留言管理
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            支持按内容类型、内容 ID、状态与关键词检索；可隐藏/恢复/删除留言。
          </Typography.Paragraph>
        </div>

        {error ? <RequestErrorAlert error={error} onRetry={load} /> : null}

        <Space wrap size={12}>
          <Input
            value={q}
            style={{ width: 220 }}
            placeholder="关键词（留言内容/用户）"
            allowClear
            onChange={(e) => setQ(e.target.value)}
            onPressEnter={() => void load()}
          />
          <Select
            value={contentType}
            style={{ width: 160 }}
            placeholder="内容类型"
            onChange={(v) => setContentType((v as CommentContentType) || '')}
            options={[
              { value: '', label: '全部类型' },
              { value: 'LISTING', label: '专利' },
              { value: 'DEMAND', label: '需求' },
              { value: 'ACHIEVEMENT', label: '成果' },
              { value: 'ARTWORK', label: '书画' },
            ]}
          />
          <Input
            value={contentId}
            style={{ width: 260 }}
            placeholder="内容 ID"
            allowClear
            onChange={(e) => setContentId(e.target.value)}
            onPressEnter={() => void load()}
          />
          <Select
            value={status}
            style={{ width: 160 }}
            placeholder="留言状态"
            onChange={(v) => setStatus((v as CommentStatus) || '')}
            options={[
              { value: '', label: '全部状态' },
              { value: 'VISIBLE', label: '可见' },
              { value: 'HIDDEN', label: '已隐藏' },
              { value: 'DELETED', label: '已删除' },
            ]}
          />
          <Button onClick={load}>查询</Button>
        </Space>

        <Table<Comment>
          rowKey="id"
          loading={loading}
          dataSource={rows}
          pagination={false}
          columns={[
            { title: '内容类型', dataIndex: 'contentType', render: (v) => contentTypeLabel(v) },
            { title: '内容 ID', dataIndex: 'contentId', ellipsis: true },
            {
              title: '留言内容',
              dataIndex: 'text',
              render: (v: string, r) => (
                <Space direction="vertical" size={2}>
                  {r.parentCommentId ? <Tag>回复</Tag> : <Tag color="blue">根留言</Tag>}
                  <Typography.Paragraph style={{ marginBottom: 0 }} ellipsis={{ rows: 2 }}>
                    {v || '-'}
                  </Typography.Paragraph>
                </Space>
              ),
            },
            {
              title: '用户',
              key: 'user',
              render: (_, r) => (
                <Space direction="vertical" size={0}>
                  <Typography.Text>{r.user?.nickname || r.user?.id || '-'}</Typography.Text>
                  {r.user?.id ? <Typography.Text type="secondary">{r.user.id}</Typography.Text> : null}
                </Space>
              ),
            },
            { title: '状态', dataIndex: 'status', render: (v) => statusTag(v) },
            { title: '创建时间', dataIndex: 'createdAt', render: (v) => formatTimeSmart(v) },
            {
              title: '操作',
              key: 'actions',
              render: (_, r) => {
                const currentStatus = (r.status || 'VISIBLE') as CommentStatus;
                return (
                  <Space>
                    <Button disabled={currentStatus !== 'VISIBLE'} onClick={() => void updateStatus(r, 'HIDDEN')}>
                      隐藏
                    </Button>
                    <Button disabled={currentStatus !== 'HIDDEN'} onClick={() => void updateStatus(r, 'VISIBLE')}>
                      恢复
                    </Button>
                    <Button danger disabled={currentStatus === 'DELETED'} onClick={() => void updateStatus(r, 'DELETED')}>
                      删除
                    </Button>
                  </Space>
                );
              },
            },
          ]}
        />

        <Button onClick={load}>刷新</Button>
      </Space>
    </Card>
  );
}
