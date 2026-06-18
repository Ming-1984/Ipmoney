import { Button, Card, Descriptions, Input, Space, Typography, Upload, message } from 'antd';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { apiGet, apiPost, apiUploadFile, type FileObject } from '../lib/api';
import { fenToYuan, formatTimeSmart } from '../lib/format';
import { displayAdminInfo } from '../lib/userFacingText';
import { AuditHint, RequestErrorAlert } from '../ui/RequestState';
import { confirmActionWithReason } from '../ui/confirm';

type Settlement = {
  id: string;
  orderId: string;
  grossAmountFen: number;
  commissionAmountFen: number;
  payoutAmountFen: number;
  payoutMethod?: 'MANUAL' | 'WECHAT';
  payoutStatus: 'PENDING' | 'SUCCEEDED' | 'FAILED';
  payoutRef?: string;
  payoutEvidenceFileId?: string;
  payoutAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

function payoutMethodLabel(value?: Settlement['payoutMethod']): string {
  if (value === 'MANUAL') return '线下打款';
  if (value === 'WECHAT') return '微信打款';
  return '待确认';
}

function payoutStatusLabel(value?: Settlement['payoutStatus']): string {
  if (value === 'PENDING') return '待放款';
  if (value === 'SUCCEEDED') return '已放款';
  if (value === 'FAILED') return '放款失败';
  return '待确认';
}

function settlementSummaryText(settlement?: Settlement | null): string {
  if (!settlement) return '结算信息待确认';
  return `订单号：${displayAdminInfo(settlement.orderId)} · 应放款：¥${fenToYuan(settlement.payoutAmountFen)}`;
}

const TEXT = {
  title: '\u653e\u6b3e/\u7ed3\u7b97',
  subtitle: '\u8d22\u52a1\u7ebf\u4e0b\u6253\u6b3e\uff0c\u5e73\u53f0\u5185\u786e\u8ba4\u5e76\u4e0a\u4f20\u51ed\u8bc1\u7559\u75d5\u3002',
  orderIdPlaceholder: '\u8bf7\u8f93\u5165\u8ba2\u5355\u53f7',
  loadSettlement: '\u52a0\u8f7d\u7ed3\u7b97\u53f0\u8d26',
  noSettlement: '\u6682\u65e0\u7ed3\u7b97\u53f0\u8d26',
  loadFailed: '\u52a0\u8f7d\u5931\u8d25',
  auditHint:
    '\u653e\u6b3e\u786e\u8ba4\u6d89\u53ca\u8d44\u91d1\u51fa\u8d26\uff0c\u5efa\u8bae\u4e8c\u6b21\u786e\u8ba4\u5e76\u4e0a\u4f20\u51ed\u8bc1\u7559\u75d5\u3002',
  settlementId: '\u7ed3\u7b97\u5355\u53f7',
  orderId: '\u8ba2\u5355\u53f7',
  grossAmount: '\u6210\u4ea4\u4ef7',
  commissionAmount: '\u4f63\u91d1',
  payoutAmount: '\u5e94\u653e\u6b3e',
  payoutMethod: '\u653e\u6b3e\u65b9\u5f0f',
  payoutStatus: '\u653e\u6b3e\u72b6\u6001',
  payoutEvidenceFileId: '\u653e\u6b3e\u51ed\u8bc1\u72b6\u6001',
  payoutRef: '\u653e\u6b3e\u6d41\u6c34\u53f7/\u5907\u6ce8',
  payoutAt: '\u653e\u6b3e\u65f6\u95f4',
  emptyPrompt: '\u6682\u65e0\u53f0\u8d26\u6570\u636e\uff0c\u8bf7\u8f93\u5165\u8ba2\u5355\u53f7\u540e\u52a0\u8f7d\u3002',
  payoutCardTitle: '\u8d22\u52a1\u653e\u6b3e\u786e\u8ba4',
  uploadEvidence: '\u4e0a\u4f20\u653e\u6b3e\u51ed\u8bc1',
  uploadFailed: '\u4e0a\u4f20\u5931\u8d25',
  uploadedPrefix: '\u5df2\u4e0a\u4f20\u653e\u6b3e\u51ed\u8bc1',
  noUploadedFile: '\u672a\u4e0a\u4f20',
  payoutRefPlaceholder: '\u653e\u6b3e\u6d41\u6c34\u53f7\uff08\u53ef\u9009\uff09',
  remarkPlaceholder: '\u5907\u6ce8\uff08\u53ef\u9009\uff09',
  uploadFirst: '\u8bf7\u5148\u4e0a\u4f20\u653e\u6b3e\u51ed\u8bc1',
  payoutTitle: '\u786e\u8ba4\u5df2\u7ebf\u4e0b\u653e\u6b3e\uff1f',
  payoutContent:
    '\u8be5\u64cd\u4f5c\u5c06\u8bb0\u5f55\u51ed\u8bc1\u6587\u4ef6\u4e0e\u653e\u6b3e\u4fe1\u606f\uff0c\u8bf7\u786e\u4fdd\u5df2\u6838\u9a8c\u8ba2\u5355\u72b6\u6001\u4e0e\u653e\u6b3e\u51ed\u8bc1\u3002',
  payoutOk: '\u786e\u8ba4\u653e\u6b3e',
  payoutReasonLabel: '\u653e\u6b3e\u5907\u6ce8/\u4f9d\u636e',
  payoutReasonHint:
    '\u5efa\u8bae\u5199\u660e\u653e\u6b3e\u51ed\u8bc1\u8981\u70b9\u3001\u6838\u9a8c\u9879\u4e0e\u64cd\u4f5c\u4eba\u4fe1\u606f\uff0c\u4fbf\u4e8e\u540e\u7eed\u5bf9\u8d26\u4e0e\u4e89\u8bae\u5904\u7406\u3002',
  payoutSuccess: '\u5df2\u786e\u8ba4\u653e\u6b3e',
  actionFailed: '\u64cd\u4f5c\u5931\u8d25',
  payoutButton: '\u786e\u8ba4\u653e\u6b3e',
  hint:
    '\u63d0\u793a\uff1a\u653e\u6b3e\u6761\u4ef6\u56fa\u5b9a\u4e3a\u201c\u53d8\u66f4\u5b8c\u6210\u786e\u8ba4\u540e\u201d\u624d\u5141\u8bb8\u653e\u6b3e\uff0c\u907f\u514d\u4e89\u8bae\u3002',
} as const;

export function SettlementsPage() {
  const [orderId, setOrderId] = useState('');
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown | null>(null);
  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [payoutEvidenceFile, setPayoutEvidenceFile] = useState<FileObject | null>(null);
  const [payoutRef, setPayoutRef] = useState('');
  const [remark, setRemark] = useState('');
  const orderIdRef = useRef(orderId);
  const loadSeqRef = useRef(0);
  const payoutSeqRef = useRef(0);
  const uploadSeqRef = useRef(0);

  useEffect(() => {
    orderIdRef.current = orderId;
    payoutSeqRef.current += 1;
    uploadSeqRef.current += 1;
  }, [orderId]);

  const load = useCallback(async (targetOrderId?: string) => {
    const normalizedOrderId = String(targetOrderId ?? orderId).trim();
    const requestSeq = ++loadSeqRef.current;
    if (!normalizedOrderId) {
      setLoading(false);
      setError(null);
      setSettlement(null);
      setPayoutEvidenceFile(null);
      setPayoutRef('');
      setRemark('');
      return;
    }
    setLoading(true);
    setError(null);
    setPayoutEvidenceFile(null);
    setPayoutRef('');
    setRemark('');
    try {
      const next = await apiGet<Settlement>(`/admin/orders/${normalizedOrderId}/settlement`);
      if (loadSeqRef.current !== requestSeq || orderIdRef.current !== normalizedOrderId) return;
      setSettlement(next);
    } catch (e: any) {
      if (loadSeqRef.current !== requestSeq || orderIdRef.current !== normalizedOrderId) return;
      const statusCode = Number(e?.status || e?.statusCode || 0);
      if (statusCode === 404) {
        setSettlement(null);
        message.info(TEXT.noSettlement);
      } else {
        setError(e);
        setSettlement(null);
        message.error(e?.message || TEXT.loadFailed);
      }
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
  }, [searchParams]);

  const payoutDisabled = useMemo(() => {
    if (!settlement) return true;
    if (settlement.payoutStatus === 'SUCCEEDED') return true;
    return !payoutEvidenceFile?.id;
  }, [payoutEvidenceFile?.id, settlement]);

  return (
    <Card className="admin-settlements-page">
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <div>
          <Typography.Title level={3} style={{ marginTop: 0 }}>
            {TEXT.title}
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            {TEXT.subtitle}
          </Typography.Paragraph>
        </div>

        <Space wrap>
          <Input
            value={orderId}
            onChange={(e) => {
              setOrderId(e.target.value);
              setLoading(false);
              setError(null);
              setSettlement(null);
              setPayoutEvidenceFile(null);
              setPayoutRef('');
              setRemark('');
            }}
            style={{ width: 420 }}
            placeholder={TEXT.orderIdPlaceholder}
          />
          <Button loading={loading} onClick={() => void load()}>
            {TEXT.loadSettlement}
          </Button>
        </Space>

        {error ? <RequestErrorAlert error={error} onRetry={() => void load()} /> : <AuditHint text={TEXT.auditHint} />}

        {settlement ? (
          <Descriptions bordered size="small" column={2}>
            <Descriptions.Item label="结算摘要" span={2}>
              <Space direction="vertical" size={2}>
                <Typography.Text strong>{settlementSummaryText(settlement)}</Typography.Text>
                <Typography.Text type="secondary">
                  放款方式：{payoutMethodLabel(settlement.payoutMethod)} · 放款状态：{payoutStatusLabel(settlement.payoutStatus)}
                </Typography.Text>
                <Typography.Text type="secondary" copyable={{ text: settlement.id }}>
                  结算单号：{settlement.id}
                </Typography.Text>
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label={TEXT.grossAmount}>\u00a5{fenToYuan(settlement.grossAmountFen)}</Descriptions.Item>
            <Descriptions.Item label={TEXT.commissionAmount}>\u00a5{fenToYuan(settlement.commissionAmountFen)}</Descriptions.Item>
            <Descriptions.Item label={TEXT.payoutAmount}>\u00a5{fenToYuan(settlement.payoutAmountFen)}</Descriptions.Item>
            <Descriptions.Item label={TEXT.payoutMethod}>{payoutMethodLabel(settlement.payoutMethod)}</Descriptions.Item>
            <Descriptions.Item label={TEXT.payoutStatus}>{payoutStatusLabel(settlement.payoutStatus)}</Descriptions.Item>
            <Descriptions.Item label={TEXT.payoutEvidenceFileId}>
              {settlement.payoutEvidenceFileId ? TEXT.uploadedPrefix : TEXT.noUploadedFile}
            </Descriptions.Item>
            <Descriptions.Item label={TEXT.payoutRef}>{displayAdminInfo(settlement.payoutRef)}</Descriptions.Item>
            <Descriptions.Item label={TEXT.payoutAt}>{settlement.payoutAt ? formatTimeSmart(settlement.payoutAt) : '-'}</Descriptions.Item>
          </Descriptions>
        ) : (
          <Typography.Text type="secondary">{TEXT.emptyPrompt}</Typography.Text>
        )}

        <Card size="small" style={{ background: '#fff7ed' }}>
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Typography.Text strong>{TEXT.payoutCardTitle}</Typography.Text>

            <Space wrap>
              <Upload
                maxCount={1}
                showUploadList={false}
                customRequest={async (options) => {
                  const targetOrderId = orderIdRef.current;
                  const requestSeq = ++uploadSeqRef.current;
                  try {
                    const uploaded = await apiUploadFile(options.file as File, 'PAYOUT_EVIDENCE');
                    if (uploadSeqRef.current !== requestSeq || orderIdRef.current !== targetOrderId) return;
                    setPayoutEvidenceFile(uploaded);
                    options.onSuccess?.(uploaded as any);
                  } catch (e: any) {
                    if (uploadSeqRef.current !== requestSeq || orderIdRef.current !== targetOrderId) return;
                    options.onError?.(e);
                    message.error(e?.message || TEXT.uploadFailed);
                  }
                }}
              >
                <Button>{TEXT.uploadEvidence}</Button>
              </Upload>

              <Typography.Text type="secondary">{payoutEvidenceFile ? TEXT.uploadedPrefix : TEXT.noUploadedFile}</Typography.Text>
            </Space>

            <Space wrap>
              <Input value={payoutRef} onChange={(e) => setPayoutRef(e.target.value)} style={{ width: 320 }} placeholder={TEXT.payoutRefPlaceholder} />
              <Input value={remark} onChange={(e) => setRemark(e.target.value)} style={{ width: 420 }} placeholder={TEXT.remarkPlaceholder} />
              <Button
                type="primary"
                disabled={payoutDisabled}
                onClick={async () => {
                  if (!settlement) return;
                  const targetOrderId = String(settlement.orderId || orderId).trim();
                  if (!payoutEvidenceFile?.id) {
                    message.warning(TEXT.uploadFirst);
                    return;
                  }
                  const { ok, reason } = await confirmActionWithReason({
                    title: TEXT.payoutTitle,
                    content: TEXT.payoutContent,
                    okText: TEXT.payoutOk,
                    defaultReason: remark || '',
                    reasonLabel: TEXT.payoutReasonLabel,
                    reasonHint: TEXT.payoutReasonHint,
                  });
                  if (!ok) return;
                  const requestSeq = ++payoutSeqRef.current;
                  try {
                    const finalRemark = (remark || reason || '').trim() || undefined;
                    await apiPost<Settlement>(
                      `/admin/orders/${targetOrderId}/payouts/manual`,
                      {
                        payoutEvidenceFileId: payoutEvidenceFile.id,
                        payoutRef: payoutRef || undefined,
                        payoutAt: new Date().toISOString(),
                        remark: finalRemark,
                      },
                      { idempotencyKey: `payout-${targetOrderId}` },
                    );
                    if (payoutSeqRef.current !== requestSeq || orderIdRef.current !== targetOrderId) return;
                    message.success(TEXT.payoutSuccess);
                    void load(targetOrderId);
                  } catch (e: any) {
                    if (payoutSeqRef.current !== requestSeq || orderIdRef.current !== targetOrderId) return;
                    message.error(e?.message || TEXT.actionFailed);
                  }
                }}
              >
                {TEXT.payoutButton}
              </Button>
            </Space>

            <Typography.Text type="secondary">{TEXT.hint}</Typography.Text>
          </Space>
        </Card>
      </Space>
    </Card>
  );
}
