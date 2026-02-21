import { Button, Card, Input, Select, Space, Table, Tag, Typography, message } from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { apiGet, apiPost } from '../lib/api';
import { formatTimeSmart } from '../lib/format';
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
  { value: 'DEMAND', label: '需求' },
  { value: 'ACHIEVEMENT', label: '成果' },
  { value: 'ARTWORK', label: '书画' },
  { value: 'PATENT', label: '专利' },
  { value: 'AI_PARSE', label: 'AI 解析' },
  { value: 'SYSTEM', label: '系统' },
];

export function AlertsPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown | null>(null);
  const [data, setData] = useState<PagedAlertEvent | null>(null);
  const [page, setPage] = useState(1);

  const [status, setStatus] = useState('');
  const [severity, setSeverity] = useState('');
  const [channel, setChannel] = useState('');
  const [targetType, setTargetType] = useState('');
  const [type, setType] = useState('');
  const [targetId, setTargetId] = useState('');

  const load = useCallback(async () => {
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
      setData(d);
    } catch (e: any) {
      setError(e);
      setData(null);
      message.error(e?.message || '加载失败');
    } finally {
      setLoading(false);
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
    <Card>
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
            placeholder="类型（如 order.refund）"
            allowClear
            onChange={(e) => setType(e.target.value)}
            onPressEnter={() => void load()}
          />
          <Input
            value={targetId}
            style={{ width: 240 }}
            placeholder="targetId（UUID）"
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
              render: (v: string) => <Tag>{v}</Tag>,
            },
            { title: '级别', dataIndex: 'severity', width: 100 },
            { title: '通道', dataIndex: 'channel', width: 100 },
            { title: '状态', dataIndex: 'status', width: 120 },
            { title: '对象', dataIndex: 'targetType', width: 120, render: (v) => v || '-' },
            { title: '对象ID', dataIndex: 'targetId', ellipsis: true, render: (v) => v || '-' },
            { title: '内容', dataIndex: 'message', ellipsis: true, render: (v) => v || '-' },
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
                      try {
                        await apiPost(`/admin/alerts/${r.id}/ack`, { reason: reason || undefined });
                        message.success('已确认');
                        void load();
                      } catch (e: any) {
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
