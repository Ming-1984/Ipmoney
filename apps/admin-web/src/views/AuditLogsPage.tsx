import { Button, Card, Drawer, Input, Space, Table, Tag, Typography, message } from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { apiGet } from '../lib/api';
import { formatTimeSmart } from '../lib/format';
import { RequestErrorAlert } from '../ui/RequestState';

type AuditLog = {
  id: string;
  actorUserId: string;
  action: string;
  targetType: string;
  targetId: string;
  beforeJson?: unknown;
  afterJson?: unknown;
  requestId?: string;
  ip?: string;
  userAgent?: string;
  createdAt: string;
};

type PagedAuditLog = {
  items: AuditLog[];
  page: { page: number; pageSize: number; total: number };
};

function safeJson(value: unknown): string {
  if (value === undefined) return '';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function AuditLogsPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown | null>(null);
  const [data, setData] = useState<PagedAuditLog | null>(null);

  const [page, setPage] = useState(1);

  const [targetType, setTargetType] = useState('');
  const [targetId, setTargetId] = useState('');
  const [actorUserId, setActorUserId] = useState('');
  const [action, setAction] = useState('');

  const [detailOpen, setDetailOpen] = useState(false);
  const [active, setActive] = useState<AuditLog | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await apiGet<PagedAuditLog>('/admin/audit-logs', {
        targetType: targetType.trim() || undefined,
        targetId: targetId.trim() || undefined,
        actorUserId: actorUserId.trim() || undefined,
        action: action.trim() || undefined,
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
  }, [action, actorUserId, page, targetId, targetType]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [action, actorUserId, targetId, targetType]);

  const rows = useMemo(() => data?.items || [], [data?.items]);

  return (
    <Card>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <div>
          <Typography.Title level={3} style={{ marginTop: 0 }}>
            审计日志
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            查询关键操作留痕（who/what/when/before/after），用于排障与对账。
          </Typography.Paragraph>
        </div>

        {error ? <RequestErrorAlert error={error} onRetry={load} /> : null}

        <Space wrap size={12}>
          <Input
            value={action}
            style={{ width: 200 }}
            placeholder="action（如 ORDER_UPDATE）"
            allowClear
            onChange={(e) => setAction(e.target.value)}
            onPressEnter={() => void load()}
          />
          <Input
            value={targetType}
            style={{ width: 200 }}
            placeholder="targetType（如 ORDER）"
            allowClear
            onChange={(e) => setTargetType(e.target.value)}
            onPressEnter={() => void load()}
          />
          <Input
            value={targetId}
            style={{ width: 240 }}
            placeholder="targetId（UUID/订单号等）"
            allowClear
            onChange={(e) => setTargetId(e.target.value)}
            onPressEnter={() => void load()}
          />
          <Input
            value={actorUserId}
            style={{ width: 240 }}
            placeholder="actorUserId（UUID）"
            allowClear
            onChange={(e) => setActorUserId(e.target.value)}
            onPressEnter={() => void load()}
          />
          <Button onClick={() => void load()}>查询</Button>
        </Space>

        <Table<AuditLog>
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
            {
              title: '时间',
              dataIndex: 'createdAt',
              width: 150,
              render: (v: string) => formatTimeSmart(v),
            },
            {
              title: 'action',
              dataIndex: 'action',
              width: 160,
              render: (v: string) => <Tag>{v}</Tag>,
            },
            { title: 'targetType', dataIndex: 'targetType', width: 140 },
            { title: 'targetId', dataIndex: 'targetId', ellipsis: true },
            { title: 'actorUserId', dataIndex: 'actorUserId', ellipsis: true },
            {
              title: 'requestId',
              dataIndex: 'requestId',
              ellipsis: true,
              render: (v?: string) => v || '-',
            },
            {
              title: '操作',
              key: 'actions',
              width: 90,
              render: (_, r) => (
                <Button
                  onClick={() => {
                    setActive(r);
                    setDetailOpen(true);
                  }}
                >
                  详情
                </Button>
              ),
            },
          ]}
        />
      </Space>

      <Drawer
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        width={760}
        title={active ? `审计详情：${active.action}` : '审计详情'}
        destroyOnClose
      >
        {active ? (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Card size="small">
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                <Typography.Text type="secondary">时间：{formatTimeSmart(active.createdAt)}</Typography.Text>
                <Typography.Text type="secondary">actorUserId：{active.actorUserId}</Typography.Text>
                <Typography.Text type="secondary">
                  target：{active.targetType} / {active.targetId}
                </Typography.Text>
                <Typography.Text type="secondary">requestId：{active.requestId || '-'}</Typography.Text>
                <Typography.Text type="secondary">ip：{active.ip || '-'}</Typography.Text>
                <Typography.Text type="secondary">ua：{active.userAgent || '-'}</Typography.Text>
              </Space>
            </Card>

            <Card size="small" title="beforeJson">
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{safeJson(active.beforeJson) || '-'}</pre>
            </Card>

            <Card size="small" title="afterJson">
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{safeJson(active.afterJson) || '-'}</pre>
            </Card>
          </Space>
        ) : null}
      </Drawer>
    </Card>
  );
}
