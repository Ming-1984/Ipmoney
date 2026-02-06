import { Button, Card, Descriptions, Space, Tag, Typography, message } from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

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

type OrderDetail = {
  id: string;
  listingId?: string;
  buyerUserId?: string;
  sellerUserId?: string;
  status: OrderStatus;
  depositAmountFen?: number;
  dealAmountFen?: number;
  finalAmountFen?: number;
  createdAt?: string;
  updatedAt?: string;
  milestones?: Array<{
    key: string;
    label: string;
    status: 'PENDING' | 'DONE' | 'SKIPPED';
    at?: string;
    note?: string;
  }>;
};

function statusTag(status: OrderStatus) {
  const color =
    status === 'COMPLETED'
      ? 'green'
      : status === 'CANCELLED' || status === 'REFUNDED'
        ? 'red'
        : status === 'FINAL_PAID_ESCROW' || status === 'READY_TO_SETTLE'
          ? 'blue'
          : 'gold';
  return <Tag color={color}>{orderStatusLabel(status)}</Tag>;
}

export function OrderDetailPage() {
  const navigate = useNavigate();
  const params = useParams();
  const orderId = params.orderId || '';
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown | null>(null);
  const [data, setData] = useState<OrderDetail | null>(null);

  const load = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    setError(null);
    try {
      const d = await apiGet<OrderDetail>(`/admin/orders/${orderId}`);
      setData(d);
    } catch (e: any) {
      setError(e);
      message.error(e?.message || '加载失败');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  const milestones = useMemo(() => data?.milestones || [], [data?.milestones]);

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card>
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Space align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
            <div>
              <Typography.Title level={3} style={{ margin: 0 }}>
                订单详情
              </Typography.Title>
              <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                里程碑确认会影响结算与放款，请确保资料归档后再操作。
              </Typography.Paragraph>
            </div>
            <Button onClick={() => navigate(-1)}>返回</Button>
          </Space>

          {error ? (
            <RequestErrorAlert error={error} onRetry={load} />
          ) : (
            <AuditHint text="合同签署/变更完成操作将记录审计日志，请填写依据与备注。" />
          )}
        </Space>
      </Card>

      <Card loading={loading}>
        <Descriptions column={2} bordered size="small">
          <Descriptions.Item label="订单号">{data?.id || '-'}</Descriptions.Item>
          <Descriptions.Item label="状态">{data?.status ? statusTag(data.status) : '-'}</Descriptions.Item>
          <Descriptions.Item label="订金">
            {data?.depositAmountFen != null ? `¥${fenToYuan(data.depositAmountFen)}` : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="成交价">
            {data?.dealAmountFen != null ? `¥${fenToYuan(data.dealAmountFen)}` : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="尾款">
            {data?.finalAmountFen != null ? `¥${fenToYuan(data.finalAmountFen)}` : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="挂牌ID">{data?.listingId || '-'}</Descriptions.Item>
          <Descriptions.Item label="买家ID">{data?.buyerUserId || '-'}</Descriptions.Item>
          <Descriptions.Item label="卖家ID">{data?.sellerUserId || '-'}</Descriptions.Item>
          <Descriptions.Item label="创建时间">{data?.createdAt ? formatTimeSmart(data.createdAt) : '-'}</Descriptions.Item>
          <Descriptions.Item label="更新时间">{data?.updatedAt ? formatTimeSmart(data.updatedAt) : '-'}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="关键里程碑" loading={loading}>
        {milestones.length ? (
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            {milestones.map((m) => (
              <Card key={m.key} size="small">
                <Space direction="vertical" size={4} style={{ width: '100%' }}>
                  <Space align="center" style={{ justifyContent: 'space-between', width: '100%' }}>
                    <Typography.Text strong>{m.label}</Typography.Text>
                    <Tag color={m.status === 'DONE' ? 'green' : m.status === 'SKIPPED' ? 'default' : 'gold'}>
                      {m.status === 'DONE' ? '已完成' : m.status === 'SKIPPED' ? '跳过' : '待处理'}
                    </Tag>
                  </Space>
                  <Typography.Text type="secondary">
                    {m.at ? `时间：${formatTimeSmart(m.at)}` : '时间：-'}
                  </Typography.Text>
                  {m.note ? <Typography.Text type="secondary">备注：{m.note}</Typography.Text> : null}
                </Space>
              </Card>
            ))}
          </Space>
        ) : (
          <Typography.Text type="secondary">暂无里程碑记录。</Typography.Text>
        )}

        <Space style={{ marginTop: 16 }}>
          <Button
            type="primary"
            onClick={async () => {
              if (!orderId) return;
              const { ok } = await confirmActionWithReason({
                title: '确认合同已签署？',
                content: '确认后将推进订单里程碑，请确保合同已签署并归档。',
                okText: '确认合同',
                defaultReason: '合同已签署',
                reasonLabel: '备注/依据（建议填写）',
                reasonHint: '合同编号/签署方/签署时间/证据归档位置等。',
              });
              if (!ok) return;
              try {
                await apiPost(`/admin/orders/${orderId}/milestones/contract-signed`, {
                  dealAmountFen: data?.dealAmountFen ?? 0,
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
              if (!orderId) return;
              const { ok } = await confirmActionWithReason({
                title: '确认权属变更已完成？',
                content: '确认后订单将进入可结算/放款阶段，请确保凭证归档。',
                okText: '确认变更完成',
                defaultReason: '权属变更已完成',
                reasonLabel: '备注/依据（建议填写）',
                reasonHint: '变更完成凭证/登记号/核验渠道与时间等。',
              });
              if (!ok) return;
              try {
                await apiPost(`/admin/orders/${orderId}/milestones/transfer-completed`, {
                  completedAt: new Date().toISOString(),
                });
                message.success('变更完成确认成功');
                void load();
              } catch (e: any) {
                message.error(e?.message || '操作失败');
              }
            }}
          >
            变更完成
          </Button>
          <Button onClick={load}>刷新</Button>
        </Space>
      </Card>
    </Space>
  );
}
