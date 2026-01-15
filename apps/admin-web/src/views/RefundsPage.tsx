import { Button, Card, Input, Space, Table, Tag, Typography, message } from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { apiGet, apiPost } from '../lib/api';
import { formatTimeSmart } from '../lib/format';
import { AuditHint, RequestErrorAlert } from '../ui/RequestState';
import { confirmActionWithReason } from '../ui/confirm';

type RefundRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'REFUNDING' | 'REFUNDED';

type RefundRequest = {
  id: string;
  orderId: string;
  reasonCode?: string;
  reasonText?: string;
  status: RefundRequestStatus;
  createdAt: string;
  updatedAt?: string;
};

function statusTag(status: RefundRequestStatus) {
  if (status === 'APPROVED') return <Tag color="green">已通过</Tag>;
  if (status === 'REJECTED') return <Tag color="red">已驳回</Tag>;
  if (status === 'REFUNDING') return <Tag color="orange">退款中</Tag>;
  if (status === 'REFUNDED') return <Tag color="blue">已退款</Tag>;
  return <Tag color="gold">待审批</Tag>;
}

export function RefundsPage() {
  const [orderId, setOrderId] = useState('e9032d03-9b23-40ba-84a3-ac681f21c41b');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown | null>(null);
  const [data, setData] = useState<RefundRequest[] | null>(null);

  const load = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    setError(null);
    try {
      const d = await apiGet<RefundRequest[]>(`/orders/${orderId}/refund-requests`);
      setData(d);
    } catch (e: any) {
      const msg = e?.message || '加载失败';
      setError(e);
      message.error(msg);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(() => data || [], [data]);

  return (
    <Card>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <div>
          <Typography.Title level={3} style={{ marginTop: 0 }}>
            退款管理
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            用于处理退款申请与争议材料归档。
          </Typography.Paragraph>
        </div>

        <Space>
          <Input
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            style={{ width: 420 }}
            placeholder="订单号"
          />
          <Button onClick={load}>加载</Button>
        </Space>

        {error ? (
          <RequestErrorAlert error={error} onRetry={load} />
        ) : (
          <AuditHint text="退款审批涉及资金出入账；建议二次确认并归档证据材料（聊天记录/合同/快递单等）。" />
        )}

        <Table<RefundRequest>
          rowKey="id"
          loading={loading}
          dataSource={rows}
          pagination={false}
          columns={[
            { title: '退款单号', dataIndex: 'id' },
            { title: '订单号', dataIndex: 'orderId' },
            {
              title: '状态',
              dataIndex: 'status',
              render: (_, r) => statusTag(r.status),
            },
            { title: '原因', dataIndex: 'reasonText' },
            { title: '创建时间', dataIndex: 'createdAt', render: (v) => formatTimeSmart(v) },
            {
              title: '操作',
              key: 'actions',
              render: (_, r) => {
                const disabled = r.status !== 'PENDING';
                return (
                  <Space>
                    <Button
                      type="primary"
                      disabled={disabled}
                      onClick={async () => {
                        const { ok } = await confirmActionWithReason({
                          title: '确认通过退款？',
                          content: '通过后将触发退款（可能失败并提示）；该操作应记录审计留痕。',
                          okText: '通过退款',
                          defaultReason: '同意退款',
                          reasonLabel: '审批备注（建议填写）',
                          reasonHint: '建议写明依据：时间窗/材料缺失/违约责任等；并确认已归档证据材料。',
                        });
                        if (!ok) return;
                        try {
                          await apiPost<RefundRequest>(
                            `/admin/refund-requests/${r.id}/approve`,
                            {},
                          );
                          message.success('已通过');
                          void load();
                        } catch (e: any) {
                          message.error(e?.message || '操作失败');
                        }
                      }}
                    >
                      通过
                    </Button>
                    <Button
                      danger
                      disabled={disabled}
                      onClick={async () => {
                        const { ok, reason } = await confirmActionWithReason({
                          title: '确认驳回退款？',
                          content: '驳回后订单将继续推进；驳回原因将用于审计与争议处理。',
                          okText: '驳回退款',
                          danger: true,
                          reasonLabel: '驳回原因',
                          reasonPlaceholder: '例：不满足可退条件；已提供尽调材料；买家单方违约等。',
                          reasonRequired: true,
                        });
                        if (!ok) return;
                        try {
                          await apiPost<RefundRequest>(`/admin/refund-requests/${r.id}/reject`, {
                            reason: reason || '不符合退款条件',
                          });
                          message.success('已驳回');
                          void load();
                        } catch (e: any) {
                          message.error(e?.message || '操作失败');
                        }
                      }}
                    >
                      驳回
                    </Button>
                  </Space>
                );
              },
            },
          ]}
        />
      </Space>
    </Card>
  );
}
