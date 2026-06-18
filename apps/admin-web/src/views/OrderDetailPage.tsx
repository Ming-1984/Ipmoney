import { Button, Card, Descriptions, Form, Input, InputNumber, Modal, Space, Tag, Typography, message } from 'antd';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { apiGet, apiPost } from '../lib/api';
import { fenToYuan, formatTimeSmart } from '../lib/format';
import { normalizeUserFacingText } from '../lib/userFacingText';
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

type MilestoneStatus = 'PENDING' | 'DONE' | 'SKIPPED' | 'IN_PROGRESS' | 'FAILED';

type OrderDetail = {
  id: string;
  listingId?: string | null;
  buyerUserId?: string | null;
  buyerDisplayName?: string | null;
  sellerUserId?: string | null;
  sellerDisplayName?: string | null;
  status: OrderStatus;
  depositAmountFen?: number;
  dealAmountFen?: number | null;
  finalAmountFen?: number | null;
  createdAt?: string;
  updatedAt?: string;
  listingTitle?: string | null;
  applicationNoDisplay?: string | null;
  milestones?: Array<{
    id: string;
    name: string;
    status: MilestoneStatus;
    createdAt: string;
  }>;
};

type ContractFormValues = {
  dealAmountYuan?: number;
  remark?: string;
};

const TEXT = {
  title: '\u8ba2\u5355\u8be6\u60c5',
  subtitle:
    '\u8ba2\u5355\u5173\u952e\u8282\u70b9\u4f1a\u76f4\u63a5\u5f71\u54cd\u6536\u6b3e\u3001\u8fc7\u6237\u4e0e\u7ed3\u7b97\uff0c\u8bf7\u5728\u6838\u9a8c\u4f9d\u636e\u540e\u64cd\u4f5c\u3002',
  back: '\u8fd4\u56de',
  auditHint:
    '\u8ba2\u91d1\u786e\u8ba4\u3001\u5c3e\u6b3e\u786e\u8ba4\u3001\u5408\u540c\u786e\u8ba4\u548c\u6743\u5c5e\u53d8\u66f4\u5b8c\u6210\u90fd\u4f1a\u5199\u5165\u5ba1\u8ba1\u65e5\u5fd7\uff0c\u8bf7\u8865\u5145\u5fc5\u8981\u5907\u6ce8\u3002',
  orderId: '\u8ba2\u5355\u53f7',
  status: '\u72b6\u6001',
  deposit: '\u8ba2\u91d1',
  dealAmount: '\u6210\u4ea4\u4ef7',
  finalAmount: '\u5c3e\u6b3e',
  listingId: '\u6302\u724c\u8bb0\u5f55\u7f16\u53f7',
  listingTitle: '\u6807\u7684\u6807\u9898',
  applicationNo: '\u7533\u8bf7\u53f7',
  buyerId: '\u4e70\u65b9\u4e3b\u4f53',
  sellerId: '\u5356\u65b9\u4e3b\u4f53',
  createdAt: '\u521b\u5efa\u65f6\u95f4',
  updatedAt: '\u66f4\u65b0\u65f6\u95f4',
  milestones: '\u5173\u952e\u91cc\u7a0b\u7891',
  recordTime: '\u8bb0\u5f55\u65f6\u95f4\uff1a',
  noMilestones: '\u6682\u65e0\u91cc\u7a0b\u7891\u8bb0\u5f55\u3002',
  refresh: '\u5237\u65b0',
  loadFailed: '\u52a0\u8f7d\u5931\u8d25',
  actionFailed: '\u64cd\u4f5c\u5931\u8d25',
  depositConfirm: '\u786e\u8ba4\u8ba2\u91d1',
  finalConfirm: '\u786e\u8ba4\u5c3e\u6b3e',
  contractConfirm: '\u5408\u540c\u786e\u8ba4',
  transferCompleted: '\u6743\u5c5e\u53d8\u66f4\u5b8c\u6210',
  depositTitle: '\u786e\u8ba4\u8ba2\u91d1\u5df2\u5230\u8d26\uff1f',
  depositContent: '\u786e\u8ba4\u540e\u4f1a\u63a8\u8fdb\u8ba2\u5355\u72b6\u6001\uff0c\u5e76\u901a\u77e5\u4e70\u5356\u53cc\u65b9\u3002',
  depositOk: '\u786e\u8ba4\u8ba2\u91d1',
  depositReason: '\u8ba2\u91d1\u5230\u8d26\u786e\u8ba4',
  depositSuccess: '\u8ba2\u91d1\u786e\u8ba4\u6210\u529f',
  finalTitle: '\u786e\u8ba4\u5c3e\u6b3e\u5df2\u5230\u8d26\uff1f',
  finalContent: '\u786e\u8ba4\u540e\u4f1a\u63a8\u8fdb\u8ba2\u5355\u72b6\u6001\uff0c\u5e76\u901a\u77e5\u4e70\u5356\u53cc\u65b9\u3002',
  finalOk: '\u786e\u8ba4\u5c3e\u6b3e',
  finalReason: '\u5c3e\u6b3e\u5230\u8d26\u786e\u8ba4',
  finalSuccess: '\u5c3e\u6b3e\u786e\u8ba4\u6210\u529f',
  confirmReasonLabel: '\u786e\u8ba4\u5907\u6ce8/\u4f9d\u636e',
  confirmReasonHint: '\u5efa\u8bae\u586b\u5199\u5230\u8d26\u51ed\u8bc1\u3001\u6838\u9a8c\u65f6\u95f4\u3001\u64cd\u4f5c\u4eba\u7b49\u4fe1\u606f\u3002',
  transferTitle: '\u786e\u8ba4\u6743\u5c5e\u53d8\u66f4\u5df2\u5b8c\u6210\uff1f',
  transferContent:
    '\u786e\u8ba4\u540e\u8ba2\u5355\u4f1a\u8fdb\u5165\u5f85\u7ed3\u7b97\u9636\u6bb5\uff0c\u8bf7\u786e\u4fdd\u5df2\u7559\u5b58\u53d8\u66f4\u5b8c\u6210\u51ed\u8bc1\u3002',
  transferOk: '\u786e\u8ba4\u5b8c\u6210',
  transferReason: '\u6743\u5c5e\u53d8\u66f4\u5df2\u5b8c\u6210',
  transferLabel: '\u5907\u6ce8/\u4f9d\u636e',
  transferHint: '\u5efa\u8bae\u586b\u5199\u53d8\u66f4\u5b8c\u6210\u51ed\u8bc1\u3001\u767b\u8bb0\u7f16\u53f7\u3001\u6838\u9a8c\u6e20\u9053\u4e0e\u65f6\u95f4\u3002',
  transferSuccess: '\u5df2\u786e\u8ba4\u6743\u5c5e\u53d8\u66f4\u5b8c\u6210',
  contractModalTitle: '\u5408\u540c\u786e\u8ba4',
  contractOk: '\u786e\u8ba4\u5408\u540c',
  amountRequired: '\u6210\u4ea4\u4ef7\u5fc5\u987b\u5927\u4e8e 0',
  contractSuccess: '\u5408\u540c\u786e\u8ba4\u6210\u529f',
  dealAmountYuan: '\u6210\u4ea4\u4ef7\uff08\u5143\uff09',
  dealAmountRule: '\u8bf7\u8f93\u5165\u6210\u4ea4\u4ef7',
  amountPlaceholder: '\u4f8b\u5982 288000',
  remark: '\u5907\u6ce8/\u4f9d\u636e',
  remarkPlaceholder:
    '\u5efa\u8bae\u586b\u5199\u5408\u540c\u7f16\u53f7\u3001\u7b7e\u7f72\u65b9\u3001\u7b7e\u7f72\u65f6\u95f4\u3001\u5f52\u6863\u4f4d\u7f6e\u7b49\u4fe1\u606f\u3002',
  currentDepositPrefix: '\u5f53\u524d\u8ba2\u5355\u8ba2\u91d1\uff1a',
  contractSignedDefault: '\u5408\u540c\u5df2\u7b7e\u7f72',
  contractSigned: '\u5408\u540c\u7b7e\u7f72',
  transferSubmitted: '\u6743\u5c5e\u63d0\u4ea4',
  settlementReady: '\u7ed3\u7b97\u51c6\u5907',
  settlementPaid: '\u7ed3\u7b97\u653e\u6b3e',
  done: '\u5df2\u5b8c\u6210',
  skipped: '\u5df2\u8df3\u8fc7',
  inProgress: '\u8fdb\u884c\u4e2d',
  failed: '\u5931\u8d25',
  pending: '\u5f85\u5904\u7406',
} as const;

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

function milestoneNameLabel(name?: string | null): string {
  if (name === 'CONTRACT_SIGNED') return TEXT.contractSigned;
  if (name === 'TRANSFER_SUBMITTED') return TEXT.transferSubmitted;
  if (name === 'TRANSFER_COMPLETED') return TEXT.transferCompleted;
  if (name === 'SETTLEMENT_READY') return TEXT.settlementReady;
  if (name === 'SETTLEMENT_PAID') return TEXT.settlementPaid;
  return displayDetailText(name);
}

function milestoneStatusLabel(status?: string | null): string {
  if (status === 'DONE') return TEXT.done;
  if (status === 'SKIPPED') return TEXT.skipped;
  if (status === 'IN_PROGRESS') return TEXT.inProgress;
  if (status === 'FAILED') return TEXT.failed;
  return TEXT.pending;
}

function displayDetailText(value: unknown, fallback = '-'): string {
  return normalizeUserFacingText(value) || fallback;
}

function orderSummaryText(order?: Pick<OrderDetail, 'listingTitle' | 'applicationNoDisplay' | 'id'> | null): string {
  const title = displayDetailText(order?.listingTitle, '交易标的待确认');
  const applicationNo = normalizeUserFacingText(order?.applicationNoDisplay);
  return applicationNo ? `${title} · 申请号：${applicationNo}` : title;
}

export function OrderDetailPage() {
  const navigate = useNavigate();
  const params = useParams();
  const orderId = params.orderId || '';
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown | null>(null);
  const [data, setData] = useState<OrderDetail | null>(null);
  const [contractModalOpen, setContractModalOpen] = useState(false);
  const [contractSubmitting, setContractSubmitting] = useState(false);
  const [contractForm] = Form.useForm<ContractFormValues>();
  const orderIdRef = useRef(orderId);
  const loadSeqRef = useRef(0);
  const paymentActionSeqRef = useRef(0);
  const transferActionSeqRef = useRef(0);
  const contractActionSeqRef = useRef(0);

  useEffect(() => {
    orderIdRef.current = orderId;
    paymentActionSeqRef.current += 1;
    transferActionSeqRef.current += 1;
    contractActionSeqRef.current += 1;
    setContractModalOpen(false);
    setContractSubmitting(false);
    contractForm.resetFields();
  }, [contractForm, orderId]);

  const load = useCallback(async () => {
    if (!orderId) return;
    const requestSeq = ++loadSeqRef.current;
    const targetOrderId = orderId;
    setLoading(true);
    setError(null);
    try {
      const next = await apiGet<OrderDetail>(`/admin/orders/${targetOrderId}`);
      if (loadSeqRef.current !== requestSeq || orderIdRef.current !== targetOrderId) return;
      setData(next);
    } catch (e: any) {
      if (loadSeqRef.current !== requestSeq || orderIdRef.current !== targetOrderId) return;
      setError(e);
      setData(null);
      message.error(e?.message || TEXT.loadFailed);
    } finally {
      if (loadSeqRef.current !== requestSeq || orderIdRef.current !== targetOrderId) return;
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  const milestones = useMemo(() => data?.milestones || [], [data?.milestones]);
  const canConfirmDeposit = data?.status === 'DEPOSIT_PENDING';
  const canConfirmFinal = data?.status === 'WAIT_FINAL_PAYMENT';
  const canConfirmContract = data?.status === 'DEPOSIT_PAID';
  const canConfirmTransfer = data?.status === 'FINAL_PAID_ESCROW';

  return (
    <Space className="admin-order-detail-page" direction="vertical" size={16} style={{ width: '100%' }}>
      <Card>
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Space align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
            <div>
              <Typography.Title level={3} style={{ margin: 0 }}>
                {TEXT.title}
              </Typography.Title>
              <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                {TEXT.subtitle}
              </Typography.Paragraph>
            </div>
            <Button onClick={() => navigate(-1)}>{TEXT.back}</Button>
          </Space>

          {error ? <RequestErrorAlert error={error} onRetry={() => void load()} /> : <AuditHint text={TEXT.auditHint} />}
        </Space>
      </Card>

      <Card loading={loading}>
        <Descriptions column={2} bordered size="small">
          <Descriptions.Item label="订单摘要" span={2}>
            <Space direction="vertical" size={2}>
              <Typography.Text strong>{orderSummaryText(data)}</Typography.Text>
              <Typography.Text type="secondary">
                买方：{displayDetailText(data?.buyerDisplayName, '买方待确认')} · 卖方：{displayDetailText(data?.sellerDisplayName, '卖方待确认')}
              </Typography.Text>
              <Typography.Text type="secondary" copyable={{ text: displayDetailText(data?.id, '') }}>
                订单号：{displayDetailText(data?.id)}
                {normalizeUserFacingText(data?.listingId) ? ` · 挂牌记录编号：${displayDetailText(data?.listingId)}` : ''}
              </Typography.Text>
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label={TEXT.status}>{data?.status ? statusTag(data.status) : '-'}</Descriptions.Item>
          <Descriptions.Item label={TEXT.deposit}>
            {data?.depositAmountFen != null ? `\u00a5${fenToYuan(data.depositAmountFen)}` : '-'}
          </Descriptions.Item>
          <Descriptions.Item label={TEXT.dealAmount}>
            {data?.dealAmountFen != null ? `\u00a5${fenToYuan(data.dealAmountFen)}` : '-'}
          </Descriptions.Item>
          <Descriptions.Item label={TEXT.finalAmount}>
            {data?.finalAmountFen != null ? `\u00a5${fenToYuan(data.finalAmountFen)}` : '-'}
          </Descriptions.Item>
          <Descriptions.Item label={TEXT.listingTitle}>{displayDetailText(data?.listingTitle, '交易标的待确认')}</Descriptions.Item>
          <Descriptions.Item label={TEXT.applicationNo}>{displayDetailText(data?.applicationNoDisplay)}</Descriptions.Item>
          <Descriptions.Item label={TEXT.buyerId}>{displayDetailText(data?.buyerDisplayName, '买方待确认')}</Descriptions.Item>
          <Descriptions.Item label={TEXT.sellerId}>{displayDetailText(data?.sellerDisplayName, '卖方待确认')}</Descriptions.Item>
          <Descriptions.Item label={TEXT.createdAt}>{data?.createdAt ? formatTimeSmart(data.createdAt) : '-'}</Descriptions.Item>
          <Descriptions.Item label={TEXT.updatedAt}>{data?.updatedAt ? formatTimeSmart(data.updatedAt) : '-'}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title={TEXT.milestones} loading={loading}>
        {milestones.length ? (
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            {milestones.map((milestone) => (
              <Card key={milestone.id} size="small">
                <Space direction="vertical" size={4} style={{ width: '100%' }}>
                  <Space align="center" style={{ justifyContent: 'space-between', width: '100%' }}>
                    <Typography.Text strong>{milestoneNameLabel(milestone.name)}</Typography.Text>
                    <Tag
                      color={
                        milestone.status === 'DONE'
                          ? 'green'
                          : milestone.status === 'SKIPPED'
                            ? 'default'
                            : milestone.status === 'FAILED'
                              ? 'red'
                              : milestone.status === 'IN_PROGRESS'
                                ? 'blue'
                                : 'gold'
                      }
                    >
                      {milestoneStatusLabel(milestone.status)}
                    </Tag>
                  </Space>
                  <Typography.Text type="secondary">
                    {TEXT.recordTime}
                    {formatTimeSmart(milestone.createdAt)}
                  </Typography.Text>
                </Space>
              </Card>
            ))}
          </Space>
        ) : (
          <Typography.Text type="secondary">{TEXT.noMilestones}</Typography.Text>
        )}

        <Space style={{ marginTop: 16 }} wrap>
          <Button
            type="primary"
            disabled={!canConfirmDeposit}
            onClick={async () => {
              if (!orderId) return;
              const targetOrderId = orderId;
              const { ok, reason } = await confirmActionWithReason({
                title: TEXT.depositTitle,
                content: TEXT.depositContent,
                okText: TEXT.depositOk,
                defaultReason: TEXT.depositReason,
                reasonLabel: TEXT.confirmReasonLabel,
                reasonHint: TEXT.confirmReasonHint,
              });
              if (!ok) return;
              const requestSeq = ++paymentActionSeqRef.current;
              try {
                await apiPost(
                  `/admin/orders/${targetOrderId}/payments/manual`,
                  {
                    payType: 'DEPOSIT',
                    amountFen: data?.depositAmountFen ?? undefined,
                    paidAt: new Date().toISOString(),
                    remark: reason || undefined,
                  },
                  { idempotencyKey: `manual-pay-deposit-${targetOrderId}` },
                );
                if (paymentActionSeqRef.current !== requestSeq || orderIdRef.current !== targetOrderId) return;
                message.success(TEXT.depositSuccess);
                void load();
              } catch (e: any) {
                if (paymentActionSeqRef.current !== requestSeq || orderIdRef.current !== targetOrderId) return;
                message.error(e?.message || TEXT.actionFailed);
              }
            }}
          >
            {TEXT.depositConfirm}
          </Button>

          <Button
            type="primary"
            disabled={!canConfirmFinal}
            onClick={async () => {
              if (!orderId) return;
              const targetOrderId = orderId;
              const { ok, reason } = await confirmActionWithReason({
                title: TEXT.finalTitle,
                content: TEXT.finalContent,
                okText: TEXT.finalOk,
                defaultReason: TEXT.finalReason,
                reasonLabel: TEXT.confirmReasonLabel,
                reasonHint: TEXT.confirmReasonHint,
              });
              if (!ok) return;
              const requestSeq = ++paymentActionSeqRef.current;
              try {
                await apiPost(
                  `/admin/orders/${targetOrderId}/payments/manual`,
                  {
                    payType: 'FINAL',
                    amountFen: data?.finalAmountFen ?? undefined,
                    paidAt: new Date().toISOString(),
                    remark: reason || undefined,
                  },
                  { idempotencyKey: `manual-pay-final-${targetOrderId}` },
                );
                if (paymentActionSeqRef.current !== requestSeq || orderIdRef.current !== targetOrderId) return;
                message.success(TEXT.finalSuccess);
                void load();
              } catch (e: any) {
                if (paymentActionSeqRef.current !== requestSeq || orderIdRef.current !== targetOrderId) return;
                message.error(e?.message || TEXT.actionFailed);
              }
            }}
          >
            {TEXT.finalConfirm}
          </Button>

          <Button
            type="primary"
            disabled={!canConfirmContract}
            onClick={() => {
              contractForm.resetFields();
              contractForm.setFieldsValue({
                dealAmountYuan: data?.dealAmountFen != null ? data.dealAmountFen / 100 : undefined,
                remark: TEXT.contractSignedDefault,
              });
              setContractModalOpen(true);
            }}
          >
            {TEXT.contractConfirm}
          </Button>

          <Button
            disabled={!canConfirmTransfer}
            onClick={async () => {
              if (!orderId) return;
              const targetOrderId = orderId;
              const { ok, reason } = await confirmActionWithReason({
                title: TEXT.transferTitle,
                content: TEXT.transferContent,
                okText: TEXT.transferOk,
                defaultReason: TEXT.transferReason,
                reasonLabel: TEXT.transferLabel,
                reasonHint: TEXT.transferHint,
              });
              if (!ok) return;
              const requestSeq = ++transferActionSeqRef.current;
              try {
                await apiPost(
                  `/admin/orders/${targetOrderId}/milestones/transfer-completed`,
                  {
                    completedAt: new Date().toISOString(),
                    remark: reason || undefined,
                  },
                  { idempotencyKey: `transfer-completed-${targetOrderId}` },
                );
                if (transferActionSeqRef.current !== requestSeq || orderIdRef.current !== targetOrderId) return;
                message.success(TEXT.transferSuccess);
                void load();
              } catch (e: any) {
                if (transferActionSeqRef.current !== requestSeq || orderIdRef.current !== targetOrderId) return;
                message.error(e?.message || TEXT.actionFailed);
              }
            }}
          >
            {TEXT.transferCompleted}
          </Button>

          <Button onClick={() => void load()}>{TEXT.refresh}</Button>
        </Space>
      </Card>

      <Modal
        open={contractModalOpen}
        title={TEXT.contractModalTitle}
        okText={TEXT.contractOk}
        okButtonProps={{ loading: contractSubmitting }}
        onCancel={() => {
          setContractModalOpen(false);
          contractForm.resetFields();
        }}
        onOk={async () => {
          if (!orderId) {
            setContractModalOpen(false);
            return;
          }
          const targetOrderId = orderId;
          const requestSeq = ++contractActionSeqRef.current;
          try {
            const values = await contractForm.validateFields();
            const dealAmountYuan = Number(values?.dealAmountYuan || 0);
            if (!Number.isFinite(dealAmountYuan) || dealAmountYuan <= 0) {
              if (contractActionSeqRef.current !== requestSeq || orderIdRef.current !== targetOrderId) return;
              message.error(TEXT.amountRequired);
              return;
            }
            if (contractActionSeqRef.current !== requestSeq || orderIdRef.current !== targetOrderId) return;
            setContractSubmitting(true);
            await apiPost(
              `/admin/orders/${targetOrderId}/milestones/contract-signed`,
              {
                dealAmountFen: Math.round(dealAmountYuan * 100),
                signedAt: new Date().toISOString(),
                remark: values?.remark ? String(values.remark).trim() : undefined,
              },
              { idempotencyKey: `contract-signed-${targetOrderId}` },
            );
            if (contractActionSeqRef.current !== requestSeq || orderIdRef.current !== targetOrderId) return;
            message.success(TEXT.contractSuccess);
            setContractModalOpen(false);
            contractForm.resetFields();
            void load();
          } catch (e: any) {
            if (e?.errorFields) return;
            if (contractActionSeqRef.current !== requestSeq || orderIdRef.current !== targetOrderId) return;
            message.error(e?.message || TEXT.actionFailed);
          } finally {
            if (contractActionSeqRef.current !== requestSeq || orderIdRef.current !== targetOrderId) return;
            setContractSubmitting(false);
          }
        }}
      >
        <Form form={contractForm} layout="vertical">
          <Form.Item
            label={TEXT.dealAmountYuan}
            name="dealAmountYuan"
            rules={[{ required: true, message: TEXT.dealAmountRule }]}
          >
            <InputNumber min={0} precision={2} style={{ width: '100%' }} placeholder={TEXT.amountPlaceholder} />
          </Form.Item>
          <Form.Item label={TEXT.remark} name="remark">
            <Input.TextArea rows={3} placeholder={TEXT.remarkPlaceholder} />
          </Form.Item>
          {data ? <Typography.Text type="secondary">{TEXT.currentDepositPrefix}\u00a5{fenToYuan(data.depositAmountFen || 0)}</Typography.Text> : null}
        </Form>
      </Modal>
    </Space>
  );
}
