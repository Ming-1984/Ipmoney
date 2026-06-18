import { Button, Card, Form, Input, InputNumber, Modal, Space, Table, Typography, message } from 'antd';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

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

type Order = {
  id: string;
  listingId?: string | null;
  buyerUserId?: string | null;
  buyerDisplayName?: string | null;
  sellerUserId?: string | null;
  sellerDisplayName?: string | null;
  status: OrderStatus;
  depositAmountFen: number;
  dealAmountFen?: number | null;
  finalAmountFen?: number | null;
  createdAt: string;
  updatedAt?: string;
  listingTitle?: string | null;
  applicationNoDisplay?: string | null;
};

type PagedOrder = {
  items: Order[];
  page: { page: number; pageSize: number; total: number };
};

type ContractFormValues = {
  dealAmountYuan?: number;
  remark?: string;
};

const TEXT = {
  loadFailed: '\u52a0\u8f7d\u5931\u8d25',
  title: '\u8ba2\u5355\u7ba1\u7406',
  subtitle: '\u5904\u7406\u8ba2\u5355\u72b6\u6001\u6d41\u8f6c\u3001\u5408\u540c\u786e\u8ba4\u4e0e\u6743\u5c5e\u53d8\u66f4\u5b8c\u6210\u7b49\u5173\u952e\u8282\u70b9\u3002',
  auditHint:
    '\u5408\u540c\u786e\u8ba4\u548c\u6743\u5c5e\u53d8\u66f4\u5b8c\u6210\u4f1a\u76f4\u63a5\u5f71\u54cd\u8ba2\u5355\u72b6\u6001\u4e0e\u540e\u7eed\u7ed3\u7b97\uff0c\u8bf7\u6838\u9a8c\u4f9d\u636e\u540e\u518d\u64cd\u4f5c\u3002',
  orderId: '\u8ba2\u5355\u53f7',
  listing: '\u6807\u7684',
  status: '\u72b6\u6001',
  deposit: '\u8ba2\u91d1',
  dealAmount: '\u6210\u4ea4\u4ef7',
  recordId: '\u6302\u724c\u8bb0\u5f55',
  createdAt: '\u521b\u5efa\u65f6\u95f4',
  actions: '\u64cd\u4f5c',
  detail: '\u8be6\u60c5',
  contractConfirm: '\u5408\u540c\u786e\u8ba4',
  transferCompleted: '\u53d8\u66f4\u5b8c\u6210',
  transferTitle: '\u786e\u8ba4\u6743\u5c5e\u53d8\u66f4\u5df2\u5b8c\u6210\uff1f',
  transferContent:
    '\u786e\u8ba4\u540e\u8ba2\u5355\u4f1a\u8fdb\u5165\u5f85\u7ed3\u7b97\u9636\u6bb5\uff0c\u8bf7\u786e\u4fdd\u5df2\u6838\u9a8c\u5b8c\u6210\u51ed\u8bc1\u5e76\u4fdd\u7559\u8bb0\u5f55\u3002',
  transferOk: '\u786e\u8ba4\u5b8c\u6210',
  transferDefaultReason: '\u6743\u5c5e\u53d8\u66f4\u5df2\u5b8c\u6210',
  transferReasonLabel: '\u5907\u6ce8/\u4f9d\u636e',
  transferReasonHint:
    '\u5efa\u8bae\u586b\u5199\u53d8\u66f4\u5b8c\u6210\u51ed\u8bc1\u3001\u767b\u8bb0\u4fe1\u606f\u3001\u6838\u9a8c\u6e20\u9053\u4e0e\u65f6\u95f4\u3002',
  transferSuccess: '\u5df2\u786e\u8ba4\u6743\u5c5e\u53d8\u66f4\u5b8c\u6210',
  actionFailed: '\u64cd\u4f5c\u5931\u8d25',
  refresh: '\u5237\u65b0',
  contractModalTitle: '\u5408\u540c\u786e\u8ba4',
  contractOk: '\u786e\u8ba4\u5408\u540c',
  amountRequired: '\u6210\u4ea4\u4ef7\u5fc5\u987b\u5927\u4e8e 0',
  contractSuccess: '\u5408\u540c\u786e\u8ba4\u6210\u529f',
  dealAmountYuan: '\u6210\u4ea4\u4ef7\uff08\u5143\uff09',
  dealAmountPlaceholder: '\u4f8b\u5982 288000',
  dealAmountRule: '\u8bf7\u8f93\u5165\u6210\u4ea4\u4ef7',
  remark: '\u5907\u6ce8/\u4f9d\u636e',
  remarkPlaceholder:
    '\u5efa\u8bae\u586b\u5199\u5408\u540c\u7f16\u53f7\u3001\u7b7e\u7f72\u65b9\u3001\u7b7e\u7f72\u65f6\u95f4\u3001\u5f52\u6863\u4f4d\u7f6e\u7b49\u4fe1\u606f\u3002',
  currentDepositPrefix: '\u5f53\u524d\u8ba2\u5355\u8ba2\u91d1\uff1a',
  contractSignedDefault: '\u5408\u540c\u5df2\u7b7e\u7f72',
} as const;

function displayOrderText(value: unknown, fallback = '-'): string {
  return normalizeUserFacingText(value) || fallback;
}

export function OrdersPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown | null>(null);
  const [data, setData] = useState<PagedOrder | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [contractModalOpen, setContractModalOpen] = useState(false);
  const [contractSubmitting, setContractSubmitting] = useState(false);
  const [contractTarget, setContractTarget] = useState<Order | null>(null);
  const [contractForm] = Form.useForm<ContractFormValues>();
  const loadSeqRef = useRef(0);
  const transferActionSeqRef = useRef(0);
  const contractActionSeqRef = useRef(0);
  const contractTargetIdRef = useRef<string | null>(null);

  useEffect(() => {
    contractTargetIdRef.current = contractTarget?.id || null;
  }, [contractTarget?.id]);

  const load = useCallback(
    async (opts?: { page?: number; pageSize?: number }) => {
      const nextPage = opts?.page ?? page;
      const nextPageSize = opts?.pageSize ?? pageSize;
      const seq = ++loadSeqRef.current;
      setLoading(true);
      setError(null);
      try {
        const next = await apiGet<PagedOrder>('/admin/orders', { page: nextPage, pageSize: nextPageSize });
        if (seq !== loadSeqRef.current) return;
        setData(next);
      } catch (e: any) {
        if (seq !== loadSeqRef.current) return;
        setError(e);
        setData(null);
        message.error(e?.message || TEXT.loadFailed);
      } finally {
        if (seq !== loadSeqRef.current) return;
        setLoading(false);
      }
    },
    [page, pageSize],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(() => data?.items || [], [data?.items]);

  return (
    <Card className="admin-orders-page">
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <div>
          <Typography.Title level={3} style={{ marginTop: 0 }}>
            {TEXT.title}
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            {TEXT.subtitle}
          </Typography.Paragraph>
        </div>

        {error ? (
          <RequestErrorAlert error={error} onRetry={() => void load()} />
        ) : (
          <AuditHint text={TEXT.auditHint} />
        )}

        <Table<Order>
          rowKey="id"
          loading={loading}
          dataSource={rows}
          pagination={{
            current: data?.page.page || page,
            pageSize: data?.page.pageSize || pageSize,
            total: data?.page.total || 0,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50'],
            onChange: (nextPage, nextPageSize) => {
              const normalizedPageSize = nextPageSize || pageSize;
              if (normalizedPageSize !== pageSize) {
                setPageSize(normalizedPageSize);
                setPage(1);
                return;
              }
              setPage(nextPage);
            },
          }}
          columns={[
            {
              title: '订单摘要',
              key: 'order',
              width: 340,
              render: (_, row) => (
                <Space direction="vertical" size={2}>
                  <Typography.Text>{displayOrderText(row.listingTitle, '交易标的待确认')}</Typography.Text>
                  <Typography.Text type="secondary">
                    {row.applicationNoDisplay
                      ? `申请号：${displayOrderText(row.applicationNoDisplay)}`
                      : '挂牌信息待确认'}
                  </Typography.Text>
                  <Typography.Text type="secondary">
                    买方：{displayOrderText(row.buyerDisplayName, '买方待确认')} · 卖方：{displayOrderText(row.sellerDisplayName, '卖方待确认')}
                  </Typography.Text>
                  <Typography.Text type="secondary" copyable={{ text: row.id }}>
                    订单号：{row.id}
                  </Typography.Text>
                </Space>
              ),
            },
            { title: TEXT.status, dataIndex: 'status', render: (value: OrderStatus) => orderStatusLabel(value) },
            {
              title: TEXT.deposit,
              dataIndex: 'depositAmountFen',
              render: (value: number) => `\u00a5${fenToYuan(value)}`,
            },
            {
              title: TEXT.dealAmount,
              dataIndex: 'dealAmountFen',
              render: (value?: number | null) => (value != null ? `\u00a5${fenToYuan(value)}` : '-'),
            },
            {
              title: TEXT.createdAt,
              dataIndex: 'createdAt',
              render: (value: string) => formatTimeSmart(value),
            },
            {
              title: TEXT.actions,
              key: 'actions',
              render: (_, row) => (
                <Space wrap>
                  <Button onClick={() => navigate(`/orders/${row.id}`)}>{TEXT.detail}</Button>
                  <Button
                    type="primary"
                    disabled={row.status !== 'DEPOSIT_PAID'}
                    onClick={() => {
                      setContractTarget(row);
                      contractForm.resetFields();
                      contractForm.setFieldsValue({
                        dealAmountYuan: row.dealAmountFen != null ? row.dealAmountFen / 100 : undefined,
                        remark: TEXT.contractSignedDefault,
                      });
                      setContractModalOpen(true);
                    }}
                  >
                    {TEXT.contractConfirm}
                  </Button>
                  <Button
                    disabled={row.status !== 'FINAL_PAID_ESCROW'}
                    onClick={async () => {
                      const targetOrderId = row.id;
                      const { ok, reason } = await confirmActionWithReason({
                        title: TEXT.transferTitle,
                        content: TEXT.transferContent,
                        okText: TEXT.transferOk,
                        defaultReason: TEXT.transferDefaultReason,
                        reasonLabel: TEXT.transferReasonLabel,
                        reasonHint: TEXT.transferReasonHint,
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
                        if (transferActionSeqRef.current !== requestSeq) return;
                        message.success(TEXT.transferSuccess);
                        void load();
                      } catch (e: any) {
                        if (transferActionSeqRef.current !== requestSeq) return;
                        message.error(e?.message || TEXT.actionFailed);
                      }
                    }}
                  >
                    {TEXT.transferCompleted}
                  </Button>
                </Space>
              ),
            },
          ]}
        />

        <Button onClick={() => void load()}>{TEXT.refresh}</Button>
      </Space>

      <Modal
        open={contractModalOpen}
        title={TEXT.contractModalTitle}
        okText={TEXT.contractOk}
        okButtonProps={{ loading: contractSubmitting }}
        onCancel={() => {
          setContractModalOpen(false);
          setContractTarget(null);
          contractForm.resetFields();
        }}
        onOk={async () => {
          if (!contractTarget) {
            setContractModalOpen(false);
            return;
          }
          const targetOrderId = contractTarget.id;
          const requestSeq = ++contractActionSeqRef.current;
          try {
            const values = await contractForm.validateFields();
            const dealAmountYuan = Number(values?.dealAmountYuan || 0);
            if (!Number.isFinite(dealAmountYuan) || dealAmountYuan <= 0) {
              if (contractActionSeqRef.current !== requestSeq || contractTargetIdRef.current !== targetOrderId) return;
              message.error(TEXT.amountRequired);
              return;
            }
            if (contractActionSeqRef.current !== requestSeq || contractTargetIdRef.current !== targetOrderId) return;
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
            if (contractActionSeqRef.current !== requestSeq || contractTargetIdRef.current !== targetOrderId) return;
            message.success(TEXT.contractSuccess);
            setContractModalOpen(false);
            setContractTarget(null);
            contractForm.resetFields();
            void load();
          } catch (e: any) {
            if (e?.errorFields) return;
            if (contractActionSeqRef.current !== requestSeq || contractTargetIdRef.current !== targetOrderId) return;
            message.error(e?.message || TEXT.actionFailed);
          } finally {
            if (contractActionSeqRef.current !== requestSeq || contractTargetIdRef.current !== targetOrderId) return;
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
            <InputNumber min={0} precision={2} style={{ width: '100%' }} placeholder={TEXT.dealAmountPlaceholder} />
          </Form.Item>
          <Form.Item label={TEXT.remark} name="remark">
            <Input.TextArea rows={3} placeholder={TEXT.remarkPlaceholder} />
          </Form.Item>
          {contractTarget ? (
            <Typography.Text type="secondary">{TEXT.currentDepositPrefix}\u00a5{fenToYuan(contractTarget.depositAmountFen)}</Typography.Text>
          ) : null}
        </Form>
      </Modal>
    </Card>
  );
}
