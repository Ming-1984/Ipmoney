import { Button, Card, Input, Space, Table, Tag, Typography, message } from 'antd';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { apiGet, apiPost } from '../lib/api';
import { formatTimeSmart } from '../lib/format';
import { displayAdminInfo } from '../lib/userFacingText';
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

const TEXT = {
  title: '\u9000\u6b3e\u7ba1\u7406',
  subtitle: '\u7528\u4e8e\u5904\u7406\u9000\u6b3e\u7533\u8bf7\u3001\u9a73\u56de\u8bf4\u660e\u4e0e\u9000\u6b3e\u5b8c\u6210\u786e\u8ba4\u3002',
  orderIdPlaceholder: '\u8bf7\u8f93\u5165\u8ba2\u5355\u53f7',
  load: '\u52a0\u8f7d',
  loadFailed: '\u52a0\u8f7d\u5931\u8d25',
  actionFailed: '\u64cd\u4f5c\u5931\u8d25',
  auditHint: '\u9000\u6b3e\u5ba1\u6279\u6d89\u53ca\u8d44\u91d1\u5904\u7406\uff0c\u5efa\u8bae\u8865\u5145\u5ba1\u6279\u4f9d\u636e\u5e76\u4fdd\u7559\u76f8\u5173\u8bc1\u636e\u6750\u6599\u3002',
  refundId: '\u9000\u6b3e\u5355\u53f7',
  orderId: '\u8ba2\u5355\u53f7',
  status: '\u72b6\u6001',
  reason: '\u539f\u56e0',
  createdAt: '\u521b\u5efa\u65f6\u95f4',
  actions: '\u64cd\u4f5c',
  approve: '\u901a\u8fc7',
  reject: '\u9a73\u56de',
  complete: '\u5b8c\u6210\u9000\u6b3e',
  approveTitle: '\u786e\u8ba4\u901a\u8fc7\u9000\u6b3e\uff1f',
  approveContent: '\u901a\u8fc7\u540e\u4f1a\u8fdb\u5165\u9000\u6b3e\u6d41\u7a0b\uff0c\u8bf7\u786e\u8ba4\u5df2\u6838\u9a8c\u9000\u6b3e\u4f9d\u636e\u3002',
  approveOk: '\u786e\u8ba4\u901a\u8fc7',
  approveReason: '\u540c\u610f\u9000\u6b3e',
  approveReasonLabel: '\u5ba1\u6279\u5907\u6ce8',
  approveReasonHint: '\u5efa\u8bae\u586b\u5199\u6838\u9a8c\u4f9d\u636e\u3001\u8d23\u4efb\u5224\u65ad\u548c\u64cd\u4f5c\u4eba\u4fe1\u606f\u3002',
  approveSuccess: '\u5df2\u901a\u8fc7\u9000\u6b3e\u7533\u8bf7',
  rejectTitle: '\u786e\u8ba4\u9a73\u56de\u9000\u6b3e\uff1f',
  rejectContent: '\u9a73\u56de\u539f\u56e0\u5c06\u7528\u4e8e\u901a\u77e5\u548c\u540e\u7eed\u4e89\u8bae\u5904\u7406\u3002',
  rejectOk: '\u786e\u8ba4\u9a73\u56de',
  rejectReasonLabel: '\u9a73\u56de\u539f\u56e0',
  rejectReasonPlaceholder: '\u4f8b\u5982\uff1a\u4e0d\u7b26\u5408\u9000\u6b3e\u6761\u4ef6\uff0c\u6216\u8bc1\u636e\u6750\u6599\u4e0d\u8db3\u3002',
  rejectFallbackReason: '\u4e0d\u7b26\u5408\u9000\u6b3e\u6761\u4ef6',
  rejectSuccess: '\u5df2\u9a73\u56de\u9000\u6b3e\u7533\u8bf7',
  completeTitle: '\u786e\u8ba4\u9000\u6b3e\u5df2\u5b8c\u6210\uff1f',
  completeContent: '\u786e\u8ba4\u540e\u5c06\u7ed3\u675f\u9000\u6b3e\u6d41\u7a0b\uff0c\u8bf7\u786e\u4fdd\u9000\u6b3e\u5df2\u7ecf\u5b9e\u9645\u5b8c\u6210\u3002',
  completeOk: '\u786e\u8ba4\u5b8c\u6210',
  completeReason: '\u9000\u6b3e\u5b8c\u6210\u786e\u8ba4',
  completeReasonLabel: '\u5b8c\u6210\u5907\u6ce8',
  completeReasonHint: '\u5efa\u8bae\u586b\u5199\u9000\u6b3e\u6e20\u9053\u3001\u6d41\u6c34\u53f7\u548c\u5b8c\u6210\u65f6\u95f4\u3002',
  completeSuccess: '\u9000\u6b3e\u5df2\u5b8c\u6210',
  approved: '\u5df2\u901a\u8fc7',
  rejected: '\u5df2\u9a73\u56de',
  refunding: '\u9000\u6b3e\u4e2d',
  refunded: '\u5df2\u9000\u6b3e',
  pending: '\u5f85\u5904\u7406',
} as const;

function statusTag(status: RefundRequestStatus) {
  if (status === 'APPROVED') return <Tag color="green">{TEXT.approved}</Tag>;
  if (status === 'REJECTED') return <Tag color="red">{TEXT.rejected}</Tag>;
  if (status === 'REFUNDING') return <Tag color="orange">{TEXT.refunding}</Tag>;
  if (status === 'REFUNDED') return <Tag color="blue">{TEXT.refunded}</Tag>;
  return <Tag color="gold">{TEXT.pending}</Tag>;
}

export function RefundsPage() {
  const [orderId, setOrderId] = useState('');
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown | null>(null);
  const [data, setData] = useState<RefundRequest[] | null>(null);
  const [tablePage, setTablePage] = useState(1);
  const [tablePageSize, setTablePageSize] = useState(20);
  const orderIdRef = useRef(orderId);
  const loadSeqRef = useRef(0);
  const actionSeqRef = useRef(0);

  useEffect(() => {
    orderIdRef.current = orderId;
    actionSeqRef.current += 1;
  }, [orderId]);

  const load = useCallback(async (targetOrderId?: string) => {
    const normalizedOrderId = String(targetOrderId ?? orderId).trim();
    const requestSeq = ++loadSeqRef.current;
    if (!normalizedOrderId) {
      setLoading(false);
      setError(null);
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const next = await apiGet<RefundRequest[]>(`/orders/${normalizedOrderId}/refund-requests`);
      if (loadSeqRef.current !== requestSeq || orderIdRef.current !== normalizedOrderId) return;
      setData(next);
    } catch (e: any) {
      if (loadSeqRef.current !== requestSeq || orderIdRef.current !== normalizedOrderId) return;
      setError(e);
      setData(null);
      message.error(e?.message || TEXT.loadFailed);
    } finally {
      if (loadSeqRef.current !== requestSeq || orderIdRef.current !== normalizedOrderId) return;
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    const preset = String(searchParams.get('orderId') || '').trim();
    if (!preset) return;
    orderIdRef.current = preset;
    setOrderId(preset);
    void load(preset);
  }, [load, searchParams]);

  const rows = useMemo(() => data || [], [data]);

  return (
    <Card className="admin-refunds-page">
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <div>
          <Typography.Title level={3} style={{ marginTop: 0 }}>
            {TEXT.title}
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            {TEXT.subtitle}
          </Typography.Paragraph>
        </div>

        <Space>
          <Input
            value={orderId}
            onChange={(e) => {
              setOrderId(e.target.value);
              setLoading(false);
              setError(null);
              setData(null);
            }}
            style={{ width: 420 }}
            placeholder={TEXT.orderIdPlaceholder}
          />
          <Button onClick={() => void load()}>{TEXT.load}</Button>
        </Space>

        {error ? <RequestErrorAlert error={error} onRetry={() => void load()} /> : <AuditHint text={TEXT.auditHint} />}

        <Table<RefundRequest>
          rowKey="id"
          loading={loading}
          dataSource={rows}
          pagination={{
            current: tablePage,
            pageSize: tablePageSize,
            total: rows.length,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50'],
            onChange: (nextPage, nextPageSize) => {
              setTablePage(nextPage);
              if (nextPageSize && nextPageSize !== tablePageSize) {
                setTablePageSize(nextPageSize);
                setTablePage(1);
              }
            },
          }}
          columns={[
            {
              title: '退款摘要',
              key: 'summary',
              width: 360,
              render: (_, record) => (
                <Space direction="vertical" size={2}>
                  <Typography.Text>{displayAdminInfo(record.reasonText, '退款原因待确认')}</Typography.Text>
                  <Typography.Text type="secondary">订单号：{displayAdminInfo(record.orderId)}</Typography.Text>
                  <Typography.Text type="secondary" copyable={{ text: record.id }}>
                    退款单号：{record.id}
                  </Typography.Text>
                </Space>
              ),
            },
            {
              title: TEXT.status,
              dataIndex: 'status',
              render: (_, record) => statusTag(record.status),
            },
            { title: TEXT.createdAt, dataIndex: 'createdAt', render: (value) => formatTimeSmart(value) },
            {
              title: TEXT.actions,
              key: 'actions',
              render: (_, record) => {
                const disabled = record.status !== 'PENDING';
                const canComplete = record.status === 'REFUNDING';
                return (
                  <Space>
                    <Button
                      type="primary"
                      disabled={disabled}
                      onClick={async () => {
                        const targetOrderId = String(record.orderId || orderIdRef.current || '').trim();
                        const { ok } = await confirmActionWithReason({
                          title: TEXT.approveTitle,
                          content: TEXT.approveContent,
                          okText: TEXT.approveOk,
                          defaultReason: TEXT.approveReason,
                          reasonLabel: TEXT.approveReasonLabel,
                          reasonHint: TEXT.approveReasonHint,
                        });
                        if (!ok) return;
                        const requestSeq = ++actionSeqRef.current;
                        try {
                          await apiPost<RefundRequest>(`/admin/refund-requests/${record.id}/approve`, {});
                          if (actionSeqRef.current !== requestSeq || orderIdRef.current !== targetOrderId) return;
                          message.success(TEXT.approveSuccess);
                          void load(targetOrderId);
                        } catch (e: any) {
                          if (actionSeqRef.current !== requestSeq || orderIdRef.current !== targetOrderId) return;
                          message.error(e?.message || TEXT.actionFailed);
                        }
                      }}
                    >
                      {TEXT.approve}
                    </Button>
                    <Button
                      danger
                      disabled={disabled}
                      onClick={async () => {
                        const targetOrderId = String(record.orderId || orderIdRef.current || '').trim();
                        const { ok, reason } = await confirmActionWithReason({
                          title: TEXT.rejectTitle,
                          content: TEXT.rejectContent,
                          okText: TEXT.rejectOk,
                          danger: true,
                          reasonLabel: TEXT.rejectReasonLabel,
                          reasonPlaceholder: TEXT.rejectReasonPlaceholder,
                          reasonRequired: true,
                        });
                        if (!ok) return;
                        const requestSeq = ++actionSeqRef.current;
                        try {
                          await apiPost<RefundRequest>(`/admin/refund-requests/${record.id}/reject`, {
                            reason: reason || TEXT.rejectFallbackReason,
                          });
                          if (actionSeqRef.current !== requestSeq || orderIdRef.current !== targetOrderId) return;
                          message.success(TEXT.rejectSuccess);
                          void load(targetOrderId);
                        } catch (e: any) {
                          if (actionSeqRef.current !== requestSeq || orderIdRef.current !== targetOrderId) return;
                          message.error(e?.message || TEXT.actionFailed);
                        }
                      }}
                    >
                      {TEXT.reject}
                    </Button>
                    <Button
                      disabled={!canComplete}
                      onClick={async () => {
                        const targetOrderId = String(record.orderId || orderIdRef.current || '').trim();
                        const { ok, reason } = await confirmActionWithReason({
                          title: TEXT.completeTitle,
                          content: TEXT.completeContent,
                          okText: TEXT.completeOk,
                          defaultReason: TEXT.completeReason,
                          reasonLabel: TEXT.completeReasonLabel,
                          reasonHint: TEXT.completeReasonHint,
                        });
                        if (!ok) return;
                        const requestSeq = ++actionSeqRef.current;
                        try {
                          await apiPost<RefundRequest>(`/admin/refund-requests/${record.id}/complete`, {
                            remark: reason || undefined,
                          });
                          if (actionSeqRef.current !== requestSeq || orderIdRef.current !== targetOrderId) return;
                          message.success(TEXT.completeSuccess);
                          void load(targetOrderId);
                        } catch (e: any) {
                          if (actionSeqRef.current !== requestSeq || orderIdRef.current !== targetOrderId) return;
                          message.error(e?.message || TEXT.actionFailed);
                        }
                      }}
                    >
                      {TEXT.complete}
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
