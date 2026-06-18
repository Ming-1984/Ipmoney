import { Button, Card, Input, Select, Space, Table, Tag, Typography, message } from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { apiGet, apiPatch } from '../lib/api';
import { formatTimeSmart } from '../lib/format';
import { displayUserName, normalizeUserFacingText } from '../lib/userFacingText';
import { RequestErrorAlert } from '../ui/RequestState';
import { confirmAction } from '../ui/confirm';

type CommentStatus = 'VISIBLE' | 'HIDDEN' | 'DELETED';
type CommentContentType = 'LISTING' | 'ACHIEVEMENT';

type Comment = {
  id: string;
  contentType: CommentContentType;
  contentId: string;
  contentTitle?: string | null;
  parentCommentId?: string | null;
  status?: CommentStatus;
  text: string;
  createdAt: string;
  updatedAt?: string | null;
  user: {
    id: string;
    displayName?: string;
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
  if (type === 'ACHIEVEMENT') return '成果内容';
  return '挂牌内容';
}

function statusTag(status?: CommentStatus | null) {
  const value = status || 'VISIBLE';
  if (value === 'VISIBLE') return <Tag color="green">可见</Tag>;
  if (value === 'HIDDEN') return <Tag color="orange">已隐藏</Tag>;
  return <Tag color="red">已删除</Tag>;
}

function displayCommentText(value: unknown, fallback = '-'): string {
  return normalizeUserFacingText(value) || fallback;
}

function userRoleLabel(value: unknown): string {
  const role = normalizeUserFacingText(value)?.toUpperCase();
  if (!role) return '';
  if (role === 'ADMIN') return '管理员';
  if (role === 'CS') return '客服';
  if (role === 'OPERATOR') return '运营';
  if (role === 'SELLER') return '卖方';
  if (role === 'BUYER') return '买方';
  return role;
}

export function CommentsPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown | null>(null);
  const [data, setData] = useState<PagedComment | null>(null);
  const [q, setQ] = useState('');
  const [contentType, setContentType] = useState<CommentContentType | ''>('');
  const [contentId, setContentId] = useState('');
  const [status, setStatus] = useState<CommentStatus | ''>('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const load = useCallback(async (opts?: { page?: number; pageSize?: number }) => {
    const nextPage = opts?.page ?? page;
    const nextPageSize = opts?.pageSize ?? pageSize;
    setLoading(true);
    setError(null);
    try {
      const d = await apiGet<PagedComment>('/admin/comments', {
        q: q.trim() || undefined,
        contentType: contentType || undefined,
        contentId: contentId.trim() || undefined,
        status: status || undefined,
        page: nextPage,
        pageSize: nextPageSize,
      });
      setData(d);
    } catch (e: any) {
      setError(e);
      message.error(e?.message || '加载失败');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [contentId, contentType, page, pageSize, q, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSearch = useCallback(() => {
    setPage(1);
    void load({ page: 1 });
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
    <Card className="admin-comments-page">
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <div>
          <Typography.Title level={3} style={{ marginTop: 0 }}>
            留言管理
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            支持按内容类型、关联内容编号、状态与关键词检索；可隐藏/恢复/删除留言。
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
            onPressEnter={handleSearch}
          />
          <Select
            value={contentType}
            style={{ width: 160 }}
            placeholder="内容类型"
            onChange={(v) => setContentType((v as CommentContentType) || '')}
            options={[
              { value: '', label: '全部类型' },
              { value: 'LISTING', label: '挂牌内容' },
              { value: 'ACHIEVEMENT', label: '成果内容' },
            ]}
          />
          <Input
            value={contentId}
            style={{ width: 260 }}
            placeholder="关联内容编号"
            allowClear
            onChange={(e) => setContentId(e.target.value)}
            onPressEnter={handleSearch}
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
          <Button onClick={handleSearch}>查询</Button>
        </Space>

        <Table<Comment>
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
            { title: '内容类型', dataIndex: 'contentType', render: (v) => contentTypeLabel(v) },
            {
              title: '关联内容',
              key: 'content',
              render: (_, r) => (
                <Space direction="vertical" size={0}>
                  <Typography.Text>{displayCommentText(r.contentTitle, '内容信息待确认')}</Typography.Text>
                  <Typography.Text type="secondary">{displayCommentText(r.contentId)}</Typography.Text>
                </Space>
              ),
            },
            {
              title: '留言内容',
              dataIndex: 'text',
              render: (v: string, r) => (
                <Space direction="vertical" size={2}>
                  {r.parentCommentId ? <Tag>回复</Tag> : <Tag color="blue">根留言</Tag>}
                  <Typography.Paragraph style={{ marginBottom: 0 }} ellipsis={{ rows: 2 }}>
                    {displayCommentText(v)}
                  </Typography.Paragraph>
                </Space>
              ),
            },
            {
              title: '用户',
              key: 'user',
              render: (_, r) => {
                const nickname = displayUserName(r.user, '平台用户');
                return (
                  <Space direction="vertical" size={0}>
                    <Typography.Text>{nickname}</Typography.Text>
                    {userRoleLabel(r.user?.role) ? <Typography.Text type="secondary">{userRoleLabel(r.user?.role)}</Typography.Text> : null}
                  </Space>
                );
              },
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

        <Button onClick={() => void load()}>刷新</Button>
      </Space>
    </Card>
  );
}
