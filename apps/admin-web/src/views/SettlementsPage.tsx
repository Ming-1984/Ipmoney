import { Button, Card, Descriptions, Input, Space, Typography, Upload, message } from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { apiGet, apiPost, apiUploadFile, type FileObject } from '../lib/api';
import { AuditHint, RequestErrorAlert } from '../ui/RequestState';
import { confirmAction } from '../ui/confirm';

type Settlement = {
  id: string;
  orderId: string;
  grossAmountFen: number;
  commissionAmountFen: number;
  payoutAmountFen: number;
  payoutMethod: 'MANUAL' | 'WECHAT';
  payoutStatus: 'PENDING' | 'SUCCEEDED' | 'FAILED';
  payoutRef?: string;
  payoutEvidenceFileId?: string;
  payoutAt?: string;
  createdAt: string;
  updatedAt?: string;
};

function fenToYuan(fen?: number): string {
  if (fen === undefined || fen === null) return '-';
  return (fen / 100).toFixed(2);
}

export function SettlementsPage() {
  const [orderId, setOrderId] = useState('dddddddd-dddd-dddd-dddd-dddddddddddd');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settlement, setSettlement] = useState<Settlement | null>(null);

  const [payoutEvidenceFile, setPayoutEvidenceFile] = useState<FileObject | null>(null);
  const [payoutRef, setPayoutRef] = useState('');
  const [remark, setRemark] = useState('');

  const load = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    setError(null);
    try {
      const d = await apiGet<Settlement>(`/admin/orders/${orderId}/settlement`);
      setSettlement(d);
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (msg.includes('404')) {
        setSettlement(null);
        message.info('暂无结算台账（演示）');
      } else {
        const errMsg = e?.message || '加载失败';
        setError(errMsg);
        message.error(errMsg);
        setSettlement(null);
      }
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  const payoutDisabled = useMemo(() => {
    if (!settlement) return true;
    if (settlement.payoutStatus === 'SUCCEEDED') return true;
    return !payoutEvidenceFile?.id;
  }, [payoutEvidenceFile?.id, settlement]);

  return (
    <Card>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <div>
          <Typography.Title level={3} style={{ marginTop: 0 }}>
            放款/结算（演示）
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            P0 默认：财务线下打款，平台内确认并上传凭证留痕。
          </Typography.Paragraph>
        </div>

        <Space>
          <Input
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            style={{ width: 420 }}
            placeholder="订单号"
          />
          <Button loading={loading} onClick={load}>
            加载结算台账
          </Button>
        </Space>

        {error ? (
          <RequestErrorAlert error={error} onRetry={load} />
        ) : (
          <AuditHint text="放款确认涉及资金出账；P0 为财务线下打款后回平台确认并上传凭证，建议二次确认并留痕。" />
        )}

        {settlement ? (
          <Descriptions bordered size="small" column={2}>
            <Descriptions.Item label="结算单号">{settlement.id}</Descriptions.Item>
            <Descriptions.Item label="订单号">{settlement.orderId}</Descriptions.Item>
            <Descriptions.Item label="成交价">
              ¥{fenToYuan(settlement.grossAmountFen)}
            </Descriptions.Item>
            <Descriptions.Item label="佣金">
              ¥{fenToYuan(settlement.commissionAmountFen)}
            </Descriptions.Item>
            <Descriptions.Item label="应放款">
              ¥{fenToYuan(settlement.payoutAmountFen)}
            </Descriptions.Item>
            <Descriptions.Item label="放款方式">{settlement.payoutMethod}</Descriptions.Item>
            <Descriptions.Item label="放款状态">{settlement.payoutStatus}</Descriptions.Item>
            <Descriptions.Item label="放款凭证文件ID">
              {settlement.payoutEvidenceFileId || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="放款流水号/备注">
              {settlement.payoutRef || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="放款时间">{settlement.payoutAt || '-'}</Descriptions.Item>
          </Descriptions>
        ) : (
          <Typography.Text type="secondary">
            暂无台账数据（可切换 Mock 场景或输入演示订单号）。
          </Typography.Text>
        )}

        <Card size="small" style={{ background: '#fff7ed' }}>
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Typography.Text strong>财务人工放款确认（P0）</Typography.Text>

            <Space wrap>
              <Upload
                maxCount={1}
                showUploadList={false}
                customRequest={async (options) => {
                  try {
                    const fo = await apiUploadFile(options.file as File, 'PAYOUT_EVIDENCE');
                    setPayoutEvidenceFile(fo);
                    options.onSuccess?.(fo as any);
                  } catch (e: any) {
                    options.onError?.(e);
                    message.error(e?.message || '上传失败');
                  }
                }}
              >
                <Button>上传放款凭证</Button>
              </Upload>

              <Typography.Text type="secondary">
                {payoutEvidenceFile ? `已上传：${payoutEvidenceFile.id}` : '未上传'}
              </Typography.Text>
            </Space>

            <Space wrap>
              <Input
                value={payoutRef}
                onChange={(e) => setPayoutRef(e.target.value)}
                style={{ width: 320 }}
                placeholder="放款流水号（可选）"
              />
              <Input
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                style={{ width: 420 }}
                placeholder="备注（可选）"
              />
              <Button
                type="primary"
                disabled={payoutDisabled}
                onClick={async () => {
                  if (!settlement) return;
                  if (!payoutEvidenceFile?.id) {
                    message.warning('请先上传放款凭证');
                    return;
                  }
                  const ok = await confirmAction({
                    title: '确认已线下放款？',
                    content: '该操作将记录凭证文件与放款信息；请确保已核验订单状态与放款凭证。',
                    okText: '确认放款',
                  });
                  if (!ok) return;
                  try {
                    const next = await apiPost<Settlement>(
                      `/admin/orders/${orderId}/payouts/manual`,
                      {
                        payoutEvidenceFileId: payoutEvidenceFile.id,
                        payoutRef: payoutRef || undefined,
                        payoutAt: new Date().toISOString(),
                        remark: remark || undefined,
                      },
                      { idempotencyKey: `demo-payout-${orderId}` },
                    );
                    message.success('已确认放款');
                    setSettlement(next);
                  } catch (e: any) {
                    message.error(e?.message || '操作失败');
                  }
                }}
              >
                确认放款
              </Button>
            </Space>

            <Typography.Text type="secondary">
              提示：放款条件固定为“变更完成确认后”才允许放款（P0 默认，避免争议）。
            </Typography.Text>
          </Space>
        </Card>
      </Space>
    </Card>
  );
}
