import { Button, Card, Space, Table, Typography, message } from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { apiGet, apiPost } from '../lib/api';
import { fenToYuan, formatTimeSmart } from '../lib/format';
import { orderStatusLabel } from '../lib/labels';
import { AuditHint, RequestErrorAlert } from '../ui/RequestState';
import { confirmActionWithReason } from '../ui/confirm';

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

export function OrdersPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown | null>(null);
  const [data, setData] = useState<PagedOrder | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await apiGet<PagedOrder>('/orders', { asRole: 'BUYER', page: 1, pageSize: 10 });
      setData(d);
    } catch (e: any) {
      setError(e);
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
            订单管理
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            用于处理订单状态流转、里程碑确认与履约信息归档。
          </Typography.Paragraph>
        </div>

        {error ? (
          <RequestErrorAlert error={error} onRetry={load} />
        ) : (
          <AuditHint text="合同确认/变更完成将影响订单状态与放款条件；建议二次确认并归档证据材料。" />
        )}

        <Table<Order>
          rowKey="id"
          loading={loading}
          dataSource={rows}
          pagination={false}
          columns={[
            { title: '订单号', dataIndex: 'id' },
            { title: '状态', dataIndex: 'status', render: (v) => orderStatusLabel(v) },
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
            { title: '创建时间', dataIndex: 'createdAt', render: (v) => formatTimeSmart(v) },
            {
              title: '操作',
              key: 'actions',
              render: (_, r) => (
                <Space>
                  <Button
                    type="primary"
                    onClick={async () => {
                      const { ok } = await confirmActionWithReason({
                        title: '确认合同已签署？',
                        content: '确认后将推进订单里程碑（可能触发状态机冲突 409）；该操作应记录审计留痕。',
                        okText: '确认合同',
                        defaultReason: '合同已签署',
                        reasonLabel: '备注/依据（建议填写）',
                        reasonHint: '建议填写：合同编号/签署方/签署时间/证据归档位置等。',
                      });
                      if (!ok) return;
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
                      const { ok } = await confirmActionWithReason({
                        title: '确认权属变更已完成？',
                        content: '确认后订单将进入可放款/结算阶段；请确保已核验变更完成凭证并留痕。',
                        okText: '确认变更完成',
                        defaultReason: '权属变更已完成',
                        reasonLabel: '备注/依据（建议填写）',
                        reasonHint: '建议填写：变更完成凭证/登记号/核验渠道与时间等。',
                      });
                      if (!ok) return;
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
