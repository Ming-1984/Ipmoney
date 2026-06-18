import { Button, Card, Drawer, Input, Space, Table, Tag, Typography, message } from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { apiGet } from '../lib/api';
import { formatTimeSmart } from '../lib/format';
import { displayAdminInfo, normalizeUserFacingText } from '../lib/userFacingText';
import { RequestErrorAlert } from '../ui/RequestState';

type AuditLog = {
  id: string;
  actorUserId: string;
  actorDisplayName?: string;
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

function auditActionLabel(value: string): string {
  const text = String(value || '').trim().toUpperCase();
  if (text === 'ORDER_UPDATE') return '订单更新';
  if (text === 'ORDER_CREATE') return '创建订单';
  if (text === 'ORDER_REFUND') return '退款处理';
  if (text === 'LISTING_UPDATE') return '挂牌更新';
  if (text === 'LISTING_CREATE') return '创建挂牌';
  if (text === 'USER_UPDATE') return '用户更新';
  if (text === 'TECH_MANAGER_UPDATE') return '技术经理人更新';
  if (text === 'PATENT_UPDATE') return '专利更新';
  if (text === 'CONFIG_UPDATE') return '配置更新';
  return text || '操作待确认';
}

function auditTargetTypeLabel(value: string): string {
  const text = String(value || '').trim().toUpperCase();
  if (text === 'ORDER') return '订单';
  if (text === 'LISTING') return '挂牌';
  if (text === 'USER') return '用户';
  if (text === 'TECH_MANAGER') return '技术经理人';
  if (text === 'PATENT') return '专利';
  if (text === 'CONFIG') return '配置';
  if (text === 'CONVERSATION') return '会话';
  return text || '对象待确认';
}

function safeJson(value: unknown): string {
  if (value === undefined) return '';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function operatorDisplayName(name?: string, userId?: string): string {
  return normalizeUserFacingText(name) || normalizeUserFacingText(userId) || '平台成员';
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
    <Card className="admin-audit-logs-page">
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
            placeholder="操作类型（如 订单更新）"
            allowClear
            onChange={(e) => setAction(e.target.value)}
            onPressEnter={() => void load()}
          />
          <Input
            value={targetType}
            style={{ width: 200 }}
            placeholder="对象类型（如 订单）"
            allowClear
            onChange={(e) => setTargetType(e.target.value)}
            onPressEnter={() => void load()}
          />
          <Input
            value={targetId}
            style={{ width: 240 }}
            placeholder="对象编号（如订单号）"
            allowClear
            onChange={(e) => setTargetId(e.target.value)}
            onPressEnter={() => void load()}
          />
          <Input
            value={actorUserId}
            style={{ width: 240 }}
            placeholder="操作人标识"
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
              title: '操作类型',
              dataIndex: 'action',
              width: 220,
              render: (v: string) => <Tag>{auditActionLabel(v)}</Tag>,
            },
            {
              title: '对象类型',
              dataIndex: 'targetType',
              width: 180,
              render: (v: string) => <span>{auditTargetTypeLabel(v)}</span>,
            },
            { title: '对象编号', dataIndex: 'targetId', ellipsis: true },
            {
              title: '操作人',
              ellipsis: true,
              render: (_, row) => operatorDisplayName(row.actorDisplayName, row.actorUserId),
            },
            {
              title: '请求流水',
              dataIndex: 'requestId',
              ellipsis: true,
              render: (v?: string) => displayAdminInfo(v),
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
        title={active ? `审计详情：${auditActionLabel(active.action)}` : '审计详情'}
        destroyOnClose
      >
        {active ? (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Card size="small">
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                <Typography.Text type="secondary">时间：{formatTimeSmart(active.createdAt)}</Typography.Text>
                <Typography.Text type="secondary">操作类型：{auditActionLabel(active.action)}</Typography.Text>
                <Typography.Text type="secondary">操作人：{operatorDisplayName(active.actorDisplayName, active.actorUserId)}</Typography.Text>
                <Typography.Text type="secondary">
                  操作对象：{auditTargetTypeLabel(active.targetType)} / 编号 {active.targetId}
                </Typography.Text>
                <Typography.Text type="secondary">请求流水：{displayAdminInfo(active.requestId)}</Typography.Text>
                <Typography.Text type="secondary">IP：{displayAdminInfo(active.ip)}</Typography.Text>
                <Typography.Text type="secondary">User-Agent：{displayAdminInfo(active.userAgent)}</Typography.Text>
              </Space>
            </Card>

            <Card size="small" title="变更前">
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{displayAdminInfo(safeJson(active.beforeJson))}</pre>
            </Card>

            <Card size="small" title="变更后">
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{displayAdminInfo(safeJson(active.afterJson))}</pre>
            </Card>
          </Space>
        ) : null}
      </Drawer>
    </Card>
  );
}
