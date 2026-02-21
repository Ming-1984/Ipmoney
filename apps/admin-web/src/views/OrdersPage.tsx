import { Button, Card, Form, Input, InputNumber, Modal, Space, Table, Typography, message } from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

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
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown | null>(null);
  const [data, setData] = useState<PagedOrder | null>(null);
  const [contractModalOpen, setContractModalOpen] = useState(false);
  const [contractSubmitting, setContractSubmitting] = useState(false);
  const [contractTarget, setContractTarget] = useState<Order | null>(null);
  const [contractForm] = Form.useForm();

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
                  <Button onClick={() => navigate(`/orders/${r.id}`)}>详情</Button>
                  <Button
                    type="primary"
                    disabled={r.status !== 'DEPOSIT_PAID'}
                    onClick={() => {
                      setContractTarget(r);
                      contractForm.resetFields();
                      contractForm.setFieldsValue({
                        dealAmountYuan: r.dealAmountFen != null ? r.dealAmountFen / 100 : undefined,
                        remark: '合同已签署',
                      });
                      setContractModalOpen(true);
                    }}
                  >
                    合同确认
                  </Button>
                  <Button
                    disabled={r.status !== 'FINAL_PAID_ESCROW'}
                    onClick={async () => {
                      const { ok, reason } = await confirmActionWithReason({
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
                            remark: reason || undefined,
                          },
                          { idempotencyKey: `transfer-completed-${r.id}` },
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
      <Modal
        open={contractModalOpen}
        title="合同确认"
        okText="确认合同"
        okButtonProps={{ loading: contractSubmitting }}
        onCancel={() => {
          setContractModalOpen(false);
          setContractTarget(null);
        }}
        onOk={async () => {
          if (!contractTarget) {
            setContractModalOpen(false);
            return;
          }
          try {
            const values = await contractForm.validateFields();
            const dealAmountYuan = Number(values?.dealAmountYuan || 0);
            if (!Number.isFinite(dealAmountYuan) || dealAmountYuan <= 0) {
              message.error('成交价需大于 0');
              return;
            }
            const dealAmountFen = Math.round(dealAmountYuan * 100);
            setContractSubmitting(true);
            await apiPost<Order>(
              `/admin/orders/${contractTarget.id}/milestones/contract-signed`,
              {
                dealAmountFen,
                signedAt: new Date().toISOString(),
                remark: values?.remark ? String(values.remark).trim() : undefined,
              },
              { idempotencyKey: `contract-signed-${contractTarget.id}` },
            );
            message.success('合同确认成功');
            setContractModalOpen(false);
            setContractTarget(null);
            contractForm.resetFields();
            void load();
          } catch (e: any) {
            if (e?.errorFields) return;
            message.error(e?.message || '操作失败');
          } finally {
            setContractSubmitting(false);
          }
        }}
      >
        <Form form={contractForm} layout="vertical">
          <Form.Item
            label="成交价（元）"
            name="dealAmountYuan"
            rules={[{ required: true, message: '请输入成交价' }]}
          >
            <InputNumber min={0} precision={2} style={{ width: '100%' }} placeholder="例如 288000" />
          </Form.Item>
          <Form.Item label="备注/依据（建议填写）" name="remark">
            <Input.TextArea
              rows={3}
              placeholder="建议填写：合同编号/签署方/签署时间/证据归档位置等。"
            />
          </Form.Item>
          {contractTarget ? (
            <Typography.Text type="secondary">
              当前订单订金：¥{fenToYuan(contractTarget.depositAmountFen)}
            </Typography.Text>
          ) : null}
        </Form>
      </Modal>
    </Card>
  );
}
