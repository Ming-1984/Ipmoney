import { Button, Card, Space, Table, Typography, message } from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { apiGet, apiPost } from '../lib/api';

type OrderStatus =
  | 'DEPOSIT_PENDING'
  | 'DEPOSIT_PAID'
  | 'WAIT_FINAL_PAYMENT'
  | 'FINAL_PAID_ESCROW'
  | 'READY_TO_SETTLE'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REFUNDING'
  | 'REFUNDED';

type Order = {
  id: string;
  listingId: string;
  buyerUserId: string;
  sellerUserId?: string;
  status: OrderStatus;
  depositAmountFen: number;
  dealAmountFen?: number;
  finalAmountFen?: number;
  createdAt: string;
  updatedAt?: string;
};

type PagedOrder = {
  items: Order[];
  page: { page: number; pageSize: number; total: number };
};

function fenToYuan(fen?: number): string {
  if (fen === undefined || fen === null) return '-';
  return (fen / 100).toFixed(2);
}

export function OrdersPage() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PagedOrder | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await apiGet<PagedOrder>('/orders', { asRole: 'BUYER', page: 1, pageSize: 10 });
      setData(d);
    } catch (e: any) {
      message.error(e?.message || '加载失败');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(() => data?.items || [], [data?.items]);

  return (
    <Card>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <div>
          <Typography.Title level={3} style={{ marginTop: 0 }}>
            订单管理（演示）
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            用于演示里程碑确认与状态机冲突（切换 `order_conflict` 场景可触发 409）。
          </Typography.Paragraph>
        </div>

        <Table<Order>
          rowKey="id"
          loading={loading}
          dataSource={rows}
          pagination={false}
          columns={[
            { title: '订单号', dataIndex: 'id' },
            { title: '状态', dataIndex: 'status' },
            {
              title: '订金',
              dataIndex: 'depositAmountFen',
              render: (v) => `¥${fenToYuan(v)}`,
            },
            {
              title: '成交价',
              dataIndex: 'dealAmountFen',
              render: (v) => (v ? `¥${fenToYuan(v)}` : '-'),
            },
            { title: '创建时间', dataIndex: 'createdAt' },
            {
              title: '操作',
              key: 'actions',
              render: (_, r) => (
                <Space>
                  <Button
                    type="primary"
                    onClick={async () => {
                      try {
                        await apiPost<Order>(`/admin/orders/${r.id}/milestones/contract-signed`, {
                          dealAmountFen: 28800000,
                          signedAt: new Date().toISOString(),
                        });
                        message.success('合同确认成功');
                        void load();
                      } catch (e: any) {
                        message.error(e?.message || '操作失败');
                      }
                    }}
                  >
                    合同确认
                  </Button>
                  <Button
                    onClick={async () => {
                      try {
                        await apiPost<Order>(
                          `/admin/orders/${r.id}/milestones/transfer-completed`,
                          {
                            completedAt: new Date().toISOString(),
                          },
                        );
                        message.success('变更完成确认成功');
                        void load();
                      } catch (e: any) {
                        message.error(e?.message || '操作失败');
                      }
                    }}
                  >
                    变更完成
                  </Button>
                </Space>
              ),
            },
          ]}
        />

        <Button onClick={load}>刷新</Button>
      </Space>
    </Card>
  );
}
