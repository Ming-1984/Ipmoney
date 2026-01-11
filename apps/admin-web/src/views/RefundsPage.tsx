import { Button, Card, Input, Space, Table, Tag, Typography, message } from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { apiGet, apiPost } from '../lib/api';

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
  const [orderId, setOrderId] = useState('dddddddd-dddd-dddd-dddd-dddddddddddd');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<RefundRequest[] | null>(null);

  const load = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    try {
      const d = await apiGet<RefundRequest[]>(`/orders/${orderId}/refund-requests`);
      setData(d);
    } catch (e: any) {
      message.error(e?.message || '加载失败');
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
            退款管理（演示）
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            切换 `refund_failed` 场景可演示“退款审批通过失败”的提示。
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
            { title: '创建时间', dataIndex: 'createdAt' },
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
                        try {
                          await apiPost<RefundRequest>(`/admin/refund-requests/${r.id}/approve`, {});
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
                        try {
                          await apiPost<RefundRequest>(`/admin/refund-requests/${r.id}/reject`, {
                            reason: '不符合退款条件（演示）',
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

