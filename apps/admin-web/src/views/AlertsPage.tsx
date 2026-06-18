import { Button, Card, Input, Select, Space, Table, Tag, Typography, message } from 'antd';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { apiGet, apiPost } from '../lib/api';
import { formatTimeSmart } from '../lib/format';
import { displayAdminInfo } from '../lib/userFacingText';
import { RequestErrorAlert } from '../ui/RequestState';
import { confirmActionWithReason } from '../ui/confirm';

type AlertEvent = {
  id: string;
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  channel: 'SMS' | 'EMAIL' | 'IN_APP';
  status: 'PENDING' | 'SENT' | 'ACKED' | 'SUPPRESSED';
  targetType?: string;
  targetId?: string;
  message?: string;
  triggeredAt: string;
  sentAt?: string | null;
};

type PagedAlertEvent = {
  items: AlertEvent[];
  page: { page: number; pageSize: number; total: number };
};

const STATUS_OPTIONS = [
  { value: '', label: '全部状态' },
  { value: 'PENDING', label: '待处理' },
  { value: 'SENT', label: '已发送' },
  { value: 'ACKED', label: '已确认' },
  { value: 'SUPPRESSED', label: '已抑制' },
];

const SEVERITY_OPTIONS = [
  { value: '', label: '全部级别' },
  { value: 'LOW', label: '低' },
  { value: 'MEDIUM', label: '中' },
  { value: 'HIGH', label: '高' },
];

const CHANNEL_OPTIONS = [
  { value: '', label: '全部通道' },
  { value: 'IN_APP', label: '站内' },
  { value: 'SMS', label: '短信' },
  { value: 'EMAIL', label: '邮件' },
];

const TARGET_OPTIONS = [
  { value: '', label: '全部对象' },
  { value: 'ORDER', label: '订单' },
  { value: 'PAYMENT', label: '支付' },
  { value: 'REFUND', label: '退款' },
  { value: 'LISTING', label: '上架' },
  { value: 'PATENT', label: '专利' },
  { value: 'AI_PARSE', label: 'AI 解析' },
  { value: 'SYSTEM', label: '系统' },
];

function alertSeverityTag(value: AlertEvent['severity']) {
  if (value === 'HIGH') return <Tag color="red">高</Tag>;
  if (value === 'MEDIUM') return <Tag color="orange">中</Tag>;
  return <Tag>低</Tag>;
}

function alertChannelLabel(value?: AlertEvent['channel']): string {
  if (value === 'SMS') return '短信';
  if (value === 'EMAIL') return '邮件';
  if (value === 'IN_APP') return '站内';
  return '待确认';
}

function alertStatusTag(value: AlertEvent['status']) {
  if (value === 'ACKED') return <Tag color="green">已确认</Tag>;
  if (value === 'SENT') return <Tag color="blue">已发送</Tag>;
  if (value === 'SUPPRESSED') return <Tag color="default">已抑制</Tag>;
  return <Tag color="orange">待处理</Tag>;
}

function alertTargetTypeLabel(value?: string): string {
  if (value === 'ORDER') return '订单';
  if (value === 'PAYMENT') return '支付';
  if (value === 'REFUND') return '退款';
  if (value === 'LISTING') return '挂牌';
  if (value === 'PATENT') return '专利';
  if (value === 'AI_PARSE') return 'AI 解析';
  if (value === 'SYSTEM') return '系统';
  return displayAdminInfo(value, '对象待确认');
}

export function AlertsPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown | null>(null);
  const [data, setData] = useState<PagedAlertEvent | null>(null);
  const [page, setPage] = useState(1);
  const loadSeqRef = useRef(0);
  const ackSeqRef = useRef(0);

  const [status, setStatus] = useState('');
  const [severity, setSeverity] = useState('');
  const [channel, setChannel] = useState('');
  const [targetType, setTargetType] = useState('');
  const [type, setType] = useState('');
  const [targetId, setTargetId] = useState('');

  const load = useCallback(async () => {
    const seq = ++loadSeqRef.current;
    setLoading(true);
    setError(null);
    try {
      const d = await apiGet<PagedAlertEvent>('/admin/alerts', {
        status: status || undefined,
        severity: severity || undefined,
        channel: channel || undefined,
        targetType: targetType || undefined,
        type: type.trim() || undefined,
        targetId: targetId.trim() || undefined,
        page,
        pageSize: 20,
      });
      if (seq !== loadSeqRef.current) return;
      setData(d);
    } catch (e: any) {
      if (seq !== loadSeqRef.current) return;
      setError(e);
      setData(null);
      message.error(e?.message || '加载失败');
    } finally {
      if (seq === loadSeqRef.current) {
        setLoading(false);
      }
    }
  }, [channel, page, severity, status, targetId, targetType, type]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [status, severity, channel, targetType, type, targetId]);

  const rows = useMemo(() => data?.items || [], [data?.items]);

  return (
    <Card className="admin-alerts-page">
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <div>
          <Typography.Title level={3} style={{ marginTop: 0 }}>
            告警中心
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            监控关键事件告警与处理状态。
          </Typography.Paragraph>
        </div>

        {error ? <RequestErrorAlert error={error} onRetry={load} /> : null}

        <Space wrap size={12}>
          <Select value={status} options={STATUS_OPTIONS} style={{ width: 150 }} onChange={setStatus} />
          <Select value={severity} options={SEVERITY_OPTIONS} style={{ width: 150 }} onChange={setSeverity} />
          <Select value={channel} options={CHANNEL_OPTIONS} style={{ width: 150 }} onChange={setChannel} />
          <Select value={targetType} options={TARGET_OPTIONS} style={{ width: 160 }} onChange={setTargetType} />
          <Input
            value={type}
            style={{ width: 200 }}
            placeholder="类型关键词（如 退款告警）"
            allowClear
            onChange={(e) => setType(e.target.value)}
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
          <Button onClick={() => void load()}>查询</Button>
        </Space>

        <Table<AlertEvent>
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
              title: '触发时间',
              dataIndex: 'triggeredAt',
              width: 150,
              render: (v: string) => formatTimeSmart(v),
            },
            {
              title: '类型',
              dataIndex: 'type',
              width: 180,
              render: (v: string) => <Tag>{displayAdminInfo(v, '告警类型待确认')}</Tag>,
            },
            { title: '级别', dataIndex: 'severity', width: 100, render: (v: AlertEvent['severity']) => alertSeverityTag(v) },
            { title: '通道', dataIndex: 'channel', width: 100, render: (v: AlertEvent['channel']) => alertChannelLabel(v) },
            { title: '状态', dataIndex: 'status', width: 120, render: (v: AlertEvent['status']) => alertStatusTag(v) },
            { title: '对象', dataIndex: 'targetType', width: 120, render: (v) => alertTargetTypeLabel(v) },
            { title: '对象编号', dataIndex: 'targetId', ellipsis: true, render: (v) => displayAdminInfo(v, '未设置') },
            { title: '内容', dataIndex: 'message', ellipsis: true, render: (v) => displayAdminInfo(v, '告警内容待确认') },
            {
              title: '操作',
              key: 'actions',
              width: 120,
              render: (_, r) => (
                <Space>
                  <Button
                    size="small"
                    disabled={r.status === 'ACKED'}
                    onClick={async () => {
                      const { ok, reason } = await confirmActionWithReason({
                        title: '确认告警已处理？',
                        content: '确认后将更新告警状态为已确认。',
                        okText: '确认',
                        reasonLabel: '备注（建议填写）',
                      });
                      if (!ok) return;
                      const seq = ++ackSeqRef.current;
                      try {
                        await apiPost(`/admin/alerts/${r.id}/ack`, { reason: reason || undefined });
                        if (seq !== ackSeqRef.current) return;
                        message.success('已确认');
                        void load();
                      } catch (e: any) {
                        if (seq !== ackSeqRef.current) return;
                        message.error(e?.message || '操作失败');
                      }
                    }}
                  >
                    确认
                  </Button>
                </Space>
              ),
            },
          ]}
        />
      </Space>
    </Card>
  );
}
