import { Button, Card, Descriptions, Input, Space, Typography, Upload, message } from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { apiDelete, apiGet, apiPut, apiUploadFile, type FileObject } from '../lib/api';
import { AuditHint, RequestErrorAlert } from '../ui/RequestState';
import { confirmAction } from '../ui/confirm';

type OrderInvoice = {
  orderId: string;
  amountFen?: number;
  itemName?: string;
  invoiceNo?: string;
  issuedAt?: string;
  invoiceFile: FileObject;
  attachedAt?: string;
  updatedAt?: string;
};

function fenToYuan(fen?: number): string {
  if (fen === undefined || fen === null) return '-';
  return (fen / 100).toFixed(2);
}

export function InvoicesPage() {
  const [orderId, setOrderId] = useState('dddddddd-dddd-dddd-dddd-dddddddddddd');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invoice, setInvoice] = useState<OrderInvoice | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [invoiceFile, setInvoiceFile] = useState<FileObject | null>(null);
  const [invoiceNo, setInvoiceNo] = useState('');
  const [issuedAt, setIssuedAt] = useState('');

  const load = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    setNotFound(false);
    setError(null);
    try {
      const d = await apiGet<OrderInvoice>(`/orders/${orderId}/invoice`);
      setInvoice(d);
      setInvoiceNo(d.invoiceNo || '');
      setIssuedAt(d.issuedAt || '');
      setInvoiceFile(null);
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (msg.includes('404')) {
        setInvoice(null);
        setNotFound(true);
        setInvoiceNo('');
        setIssuedAt('');
        setInvoiceFile(null);
      } else {
        const errMsg = e?.message || '加载失败';
        setError(errMsg);
        message.error(errMsg);
        setInvoice(null);
      }
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  const canSave = useMemo(
    () => Boolean(orderId && (invoiceFile?.id || invoice?.invoiceFile?.id)),
    [invoice?.invoiceFile?.id, invoiceFile?.id, orderId],
  );

  return (
    <Card>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <div>
          <Typography.Title level={3} style={{ marginTop: 0 }}>
            发票管理（演示）
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            P0：交易完成后线下人工开票；平台内仅做“上传/替换/删除 + 下载”。
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
            加载发票
          </Button>
        </Space>

        {error ? (
          <RequestErrorAlert error={error} onRetry={load} />
        ) : (
          <AuditHint text="P0：线下人工开票后回平台上传；上传/删除需留痕，便于对账与审计。" />
        )}

        {invoice ? (
          <Descriptions bordered size="small" column={2}>
            <Descriptions.Item label="订单号">{invoice.orderId}</Descriptions.Item>
            <Descriptions.Item label="开票金额">¥{fenToYuan(invoice.amountFen)}</Descriptions.Item>
            <Descriptions.Item label="项目名称">
              {invoice.itemName || '居间服务费'}
            </Descriptions.Item>
            <Descriptions.Item label="发票号">{invoice.invoiceNo || '-'}</Descriptions.Item>
            <Descriptions.Item label="开票时间">{invoice.issuedAt || '-'}</Descriptions.Item>
            <Descriptions.Item label="附件文件ID">{invoice.invoiceFile?.id}</Descriptions.Item>
            <Descriptions.Item label="附件URL" span={2}>
              <a href={invoice.invoiceFile?.url} target="_blank" rel="noreferrer">
                {invoice.invoiceFile?.url}
              </a>
            </Descriptions.Item>
          </Descriptions>
        ) : notFound ? (
          <Typography.Text type="secondary">该订单暂无发票（演示：可上传）。</Typography.Text>
        ) : (
          <Typography.Text type="secondary">
            暂无数据（可输入演示订单号或切换 Mock 场景）。
          </Typography.Text>
        )}

        <Card size="small" style={{ background: '#fff7ed' }}>
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Typography.Text strong>上传/替换发票</Typography.Text>

            <Space wrap>
              <Upload
                maxCount={1}
                showUploadList={false}
                customRequest={async (options) => {
                  try {
                    const fo = await apiUploadFile(options.file as File, 'INVOICE');
                    setInvoiceFile(fo);
                    options.onSuccess?.(fo as any);
                  } catch (e: any) {
                    options.onError?.(e);
                    message.error(e?.message || '上传失败');
                  }
                }}
              >
                <Button>上传发票文件</Button>
              </Upload>
              <Typography.Text type="secondary">
                {invoiceFile
                  ? `已上传：${invoiceFile.id}`
                  : invoice?.invoiceFile?.id
                    ? `当前：${invoice.invoiceFile.id}`
                    : '未上传'}
              </Typography.Text>
            </Space>

            <Space wrap>
              <Input
                value={invoiceNo}
                onChange={(e) => setInvoiceNo(e.target.value)}
                style={{ width: 260 }}
                placeholder="发票号（可选）"
              />
              <Input
                value={issuedAt}
                onChange={(e) => setIssuedAt(e.target.value)}
                style={{ width: 320 }}
                placeholder="开票时间 ISO（可选）"
              />
              <Button
                type="primary"
                disabled={!canSave}
                onClick={async () => {
                  const fileId = invoiceFile?.id || invoice?.invoiceFile?.id;
                  if (!fileId) {
                    message.warning('请先上传发票文件');
                    return;
                  }
                  const ok = await confirmAction({
                    title: '确认保存发票？',
                    content: '该操作会把发票文件关联到订单，并记录更新留痕。',
                    okText: '保存',
                  });
                  if (!ok) return;
                  try {
                    const next = await apiPut<OrderInvoice>(
                      `/admin/orders/${orderId}/invoice`,
                      {
                        invoiceFileId: fileId,
                        invoiceNo: invoiceNo || undefined,
                        issuedAt: issuedAt || undefined,
                      },
                      { idempotencyKey: `demo-invoice-${orderId}` },
                    );
                    message.success('已保存');
                    setInvoice(next);
                    setNotFound(false);
                    setInvoiceFile(null);
                  } catch (e: any) {
                    message.error(e?.message || '保存失败');
                  }
                }}
              >
                保存发票
              </Button>

              <Button
                danger
                disabled={!invoice}
                onClick={async () => {
                  const ok = await confirmAction({
                    title: '确认删除发票？',
                    content: '删除后订单将不再展示发票附件；该操作应记录审计留痕。',
                    okText: '删除',
                    danger: true,
                  });
                  if (!ok) return;
                  try {
                    await apiDelete(`/admin/orders/${orderId}/invoice`, {
                      idempotencyKey: `demo-invoice-del-${orderId}`,
                    });
                    message.success('已删除');
                    setInvoice(null);
                    setNotFound(true);
                    setInvoiceFile(null);
                    setInvoiceNo('');
                    setIssuedAt('');
                  } catch (e: any) {
                    message.error(e?.message || '删除失败');
                  }
                }}
              >
                删除发票
              </Button>
            </Space>
          </Space>
        </Card>
      </Space>
    </Card>
  );
}
