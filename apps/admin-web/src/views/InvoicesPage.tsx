import { Button, Card, Descriptions, Input, Space, Typography, Upload, message } from 'antd';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { apiDelete, apiGet, apiPost, apiPut, apiUploadFile, type FileObject } from '../lib/api';
import { fenToYuan, formatTimeSmart } from '../lib/format';
import { displayAdminInfo, normalizeUserFacingText } from '../lib/userFacingText';
import { AuditHint, RequestErrorAlert } from '../ui/RequestState';
import { confirmActionWithReason } from '../ui/confirm';

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

type InvoiceIssueResponse = {
  orderId: string;
  invoiceNo: string;
};

const TEXT = {
  title: '\u53d1\u7968\u7ba1\u7406',
  subtitle:
    '\u7ebf\u4e0b\u5f00\u7968\u5b8c\u6210\u540e\u5728\u540e\u53f0\u4e0a\u4f20\u6216\u66ff\u6362\u7535\u5b50\u53d1\u7968\uff0c\u5e76\u5173\u8054\u5230\u5bf9\u5e94\u8ba2\u5355\u3002',
  orderIdPlaceholder: '\u8bf7\u8f93\u5165\u8ba2\u5355\u53f7',
  loadInvoice: '\u52a0\u8f7d\u53d1\u7968',
  issueInvoice: '\u4e0b\u53d1\u5f00\u7968',
  missingOrderId: '\u8bf7\u5148\u8f93\u5165\u8ba2\u5355\u53f7',
  issueTitle: '\u786e\u8ba4\u4e0b\u53d1\u5f00\u7968\uff1f',
  issueContent: '\u8be5\u64cd\u4f5c\u4f1a\u751f\u6210\u53d1\u7968\u53f7\u5e76\u901a\u77e5\u4e70\u5bb6\uff0c\u5b9e\u9645\u7535\u5b50\u53d1\u7968\u6587\u4ef6\u4ecd\u9700\u4e0a\u4f20\u3002',
  issueOk: '\u4e0b\u53d1',
  reasonLabel: '\u539f\u56e0/\u5907\u6ce8',
  issueSuccessPrefix: '\u5df2\u4e0b\u53d1\u5f00\u7968\uff1a',
  issueFailed: '\u4e0b\u53d1\u5931\u8d25',
  auditHint:
    '\u7ebf\u4e0b\u5f00\u7968\u5b8c\u6210\u540e\u518d\u56de\u586b\u7535\u5b50\u53d1\u7968\u6587\u4ef6\uff1b\u4e0a\u4f20\u3001\u66ff\u6362\u548c\u5220\u9664\u90fd\u5e94\u4fdd\u7559\u64cd\u4f5c\u4f9d\u636e\u3002',
  recentIssue: '\u6700\u8fd1\u4e0b\u53d1\uff1a',
  orderId: '\u8ba2\u5355\u53f7',
  amount: '\u5f00\u7968\u91d1\u989d',
  itemName: '\u9879\u76ee\u540d\u79f0',
  defaultItemName: '\u5e73\u53f0\u670d\u52a1\u8d39/\u4f63\u91d1',
  invoiceNo: '\u53d1\u7968\u53f7',
  issuedAt: '\u5f00\u7968\u65f6\u95f4',
  fileId: '\u9644\u4ef6\u72b6\u6001',
  fileUrl: '\u9644\u4ef6\u94fe\u63a5',
  noInvoiceYet: '\u8be5\u8ba2\u5355\u5f53\u524d\u8fd8\u6ca1\u6709\u53d1\u7968\uff0c\u53ef\u5728\u4e0b\u65b9\u4e0a\u4f20\u5e76\u4fdd\u5b58\u3002',
  loadPrompt: '\u8bf7\u8f93\u5165\u8ba2\u5355\u53f7\u540e\u52a0\u8f7d\u53d1\u7968\u4fe1\u606f\u3002',
  uploadCardTitle: '\u4e0a\u4f20/\u66ff\u6362\u53d1\u7968',
  uploadFile: '\u4e0a\u4f20\u53d1\u7968\u6587\u4ef6',
  uploadFailed: '\u4e0a\u4f20\u5931\u8d25',
  uploadedPrefix: '\u5df2\u4e0a\u4f20\u53d1\u7968\u6587\u4ef6',
  currentFilePrefix: '\u5df2\u6709\u53d1\u7968\u9644\u4ef6',
  noFile: '\u672a\u4e0a\u4f20\u6587\u4ef6',
  invoiceNoPlaceholder: '\u53d1\u7968\u53f7\uff08\u53ef\u9009\uff09',
  issuedAtPlaceholder: '\u5f00\u7968\u65f6\u95f4\uff08\u53ef\u9009\uff09',
  saveInvoice: '\u4fdd\u5b58\u53d1\u7968',
  saveTitle: '\u786e\u8ba4\u4fdd\u5b58\u53d1\u7968\uff1f',
  saveContent: '\u4fdd\u5b58\u540e\u4e70\u5bb6\u53ef\u5728\u53d1\u7968\u4e2d\u5fc3\u67e5\u770b\u6216\u4e0b\u8f7d\u8be5\u53d1\u7968\u3002',
  saveReasonPlaceholder: '\u4f8b\u5982\uff1a\u7ebf\u4e0b\u5f00\u7968\u5b8c\u6210\u3001\u66ff\u6362\u9644\u4ef6\u3001\u8865\u5f55\u53d1\u7968\u53f7\u7b49\u3002',
  uploadFirst: '\u8bf7\u5148\u4e0a\u4f20\u53d1\u7968\u6587\u4ef6',
  saveSuccess: '\u53d1\u7968\u5df2\u4fdd\u5b58',
  saveFailed: '\u4fdd\u5b58\u5931\u8d25',
  deleteInvoice: '\u5220\u9664\u53d1\u7968',
  deleteTitle: '\u786e\u8ba4\u5220\u9664\u53d1\u7968\uff1f',
  deleteContent:
    '\u5220\u9664\u540e\u8ba2\u5355\u5c06\u4e0d\u518d\u5c55\u793a\u8be5\u53d1\u7968\u9644\u4ef6\uff0c\u8bf7\u786e\u8ba4\u5df2\u7ecf\u7559\u5b58\u66ff\u6362\u6216\u64a4\u9500\u4f9d\u636e\u3002',
  deleteReasonPlaceholder: '\u4f8b\u5982\uff1a\u9644\u4ef6\u4e0a\u4f20\u9519\u8bef\u3001\u9700\u8981\u66ff\u6362\u3001\u8ba2\u5355\u53d6\u6d88\u7b49\u3002',
  deleteSuccess: '\u53d1\u7968\u5df2\u5220\u9664',
  deleteFailed: '\u5220\u9664\u5931\u8d25',
  loadFailed: '\u52a0\u8f7d\u5931\u8d25',
} as const;

export function InvoicesPage() {
  const [orderId, setOrderId] = useState('');
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown | null>(null);
  const [invoice, setInvoice] = useState<OrderInvoice | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [invoiceFile, setInvoiceFile] = useState<FileObject | null>(null);
  const [invoiceNo, setInvoiceNo] = useState('');
  const [issuedAt, setIssuedAt] = useState('');
  const [issuing, setIssuing] = useState(false);
  const [issueResult, setIssueResult] = useState<InvoiceIssueResponse | null>(null);
  const orderIdRef = useRef(orderId);
  const loadSeqRef = useRef(0);
  const issueSeqRef = useRef(0);
  const saveSeqRef = useRef(0);
  const deleteSeqRef = useRef(0);
  const uploadSeqRef = useRef(0);

  useEffect(() => {
    orderIdRef.current = orderId;
    issueSeqRef.current += 1;
    saveSeqRef.current += 1;
    deleteSeqRef.current += 1;
    uploadSeqRef.current += 1;
  }, [orderId]);

  const load = useCallback(async (targetOrderId?: string) => {
    const normalizedOrderId = String(targetOrderId ?? orderId).trim();
    const requestSeq = ++loadSeqRef.current;
    if (!normalizedOrderId) {
      setLoading(false);
      setNotFound(false);
      setError(null);
      setInvoice(null);
      setInvoiceFile(null);
      setInvoiceNo('');
      setIssuedAt('');
      setIssueResult(null);
      return;
    }
    setLoading(true);
    setNotFound(false);
    setError(null);
    try {
      const next = await apiGet<OrderInvoice>(`/admin/orders/${normalizedOrderId}/invoice`);
      if (loadSeqRef.current !== requestSeq || orderIdRef.current !== normalizedOrderId) return;
      setInvoice(next);
      setInvoiceNo(next.invoiceNo || '');
      setIssuedAt(next.issuedAt || '');
      setInvoiceFile(null);
      setIssueResult(null);
    } catch (e: any) {
      if (loadSeqRef.current !== requestSeq || orderIdRef.current !== normalizedOrderId) return;
      const status = Number(e?.status || 0);
      if (status === 404) {
        setInvoice(null);
        setNotFound(true);
        setInvoiceNo('');
        setIssuedAt('');
        setInvoiceFile(null);
        setIssueResult(null);
      } else {
        setInvoice(null);
        setError(e);
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

  const canSave = useMemo(() => Boolean(orderId && (invoiceFile?.id || invoice?.invoiceFile?.id)), [invoice?.invoiceFile?.id, invoiceFile?.id, orderId]);

  return (
    <Card className="admin-invoices-page">
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
              setNotFound(false);
              setError(null);
              setInvoice(null);
              setInvoiceFile(null);
              setInvoiceNo('');
              setIssuedAt('');
              setIssueResult(null);
            }}
            style={{ width: 420 }}
            placeholder={TEXT.orderIdPlaceholder}
          />
          <Button loading={loading} onClick={() => void load()}>
            {TEXT.loadInvoice}
          </Button>
          <Button
            loading={issuing}
            disabled={!orderId}
            onClick={async () => {
              const targetOrderId = orderId.trim();
              if (!targetOrderId) {
                message.warning(TEXT.missingOrderId);
                return;
              }
              const { ok } = await confirmActionWithReason({
                title: TEXT.issueTitle,
                content: TEXT.issueContent,
                okText: TEXT.issueOk,
                reasonLabel: TEXT.reasonLabel,
              });
              if (!ok) return;
              const requestSeq = ++issueSeqRef.current;
              setIssuing(true);
              try {
                const res = await apiPost<InvoiceIssueResponse>(
                  `/admin/orders/${targetOrderId}/invoice`,
                  {},
                  { idempotencyKey: `invoice-issue-${targetOrderId}` },
                );
                if (issueSeqRef.current !== requestSeq || orderIdRef.current !== targetOrderId) return;
                setIssueResult(res);
                message.success(`${TEXT.issueSuccessPrefix}${res.invoiceNo}`);
                void load(targetOrderId);
              } catch (e: any) {
                if (issueSeqRef.current !== requestSeq || orderIdRef.current !== targetOrderId) return;
                message.error(e?.message || TEXT.issueFailed);
              } finally {
                if (issueSeqRef.current !== requestSeq || orderIdRef.current !== targetOrderId) return;
                setIssuing(false);
              }
            }}
          >
            {TEXT.issueInvoice}
          </Button>
        </Space>

        {error ? <RequestErrorAlert error={error} onRetry={() => void load()} /> : <AuditHint text={TEXT.auditHint} />}

        {issueResult ? <Typography.Text type="secondary">{TEXT.recentIssue}{issueResult.invoiceNo}</Typography.Text> : null}

        {invoice ? (
          <Descriptions bordered size="small" column={2}>
            <Descriptions.Item label={TEXT.orderId}>{invoice.orderId}</Descriptions.Item>
            <Descriptions.Item label={TEXT.amount}>\u00a5{fenToYuan(invoice.amountFen ?? 0)}</Descriptions.Item>
            <Descriptions.Item label={TEXT.itemName}>{normalizeUserFacingText(invoice.itemName) || TEXT.defaultItemName}</Descriptions.Item>
            <Descriptions.Item label={TEXT.invoiceNo}>{displayAdminInfo(invoice.invoiceNo)}</Descriptions.Item>
            <Descriptions.Item label={TEXT.issuedAt}>{invoice.issuedAt ? formatTimeSmart(invoice.issuedAt) : '-'}</Descriptions.Item>
            <Descriptions.Item label={TEXT.fileId}>
              {normalizeUserFacingText(invoice.invoiceFile?.url) ? TEXT.currentFilePrefix : TEXT.noFile}
            </Descriptions.Item>
            <Descriptions.Item label={TEXT.fileUrl} span={2}>
              {normalizeUserFacingText(invoice.invoiceFile?.url) ? (
                <a href={invoice.invoiceFile?.url} target="_blank" rel="noreferrer">
                  {invoice.invoiceFile?.url}
                </a>
              ) : (
                '-'
              )}
            </Descriptions.Item>
          </Descriptions>
        ) : notFound ? (
          <Typography.Text type="secondary">{TEXT.noInvoiceYet}</Typography.Text>
        ) : (
          <Typography.Text type="secondary">{TEXT.loadPrompt}</Typography.Text>
        )}

        <Card size="small" style={{ background: '#fff7ed' }}>
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Typography.Text strong>{TEXT.uploadCardTitle}</Typography.Text>

            <Space wrap>
              <Upload
                maxCount={1}
                showUploadList={false}
                customRequest={async (options) => {
                  const targetOrderId = orderIdRef.current;
                  const requestSeq = ++uploadSeqRef.current;
                  try {
                    const uploaded = await apiUploadFile(options.file as File, 'INVOICE');
                    if (uploadSeqRef.current !== requestSeq || orderIdRef.current !== targetOrderId) return;
                    setInvoiceFile(uploaded);
                    options.onSuccess?.(uploaded as any);
                  } catch (e: any) {
                    if (uploadSeqRef.current !== requestSeq || orderIdRef.current !== targetOrderId) return;
                    options.onError?.(e);
                    message.error(e?.message || TEXT.uploadFailed);
                  }
                }}
              >
                <Button>{TEXT.uploadFile}</Button>
              </Upload>
              <Typography.Text type="secondary">
                {invoiceFile
                  ? TEXT.uploadedPrefix
                  : invoice?.invoiceFile?.id
                    ? TEXT.currentFilePrefix
                    : TEXT.noFile}
              </Typography.Text>
            </Space>

            <Space wrap>
              <Input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} style={{ width: 260 }} placeholder={TEXT.invoiceNoPlaceholder} />
              <Input value={issuedAt} onChange={(e) => setIssuedAt(e.target.value)} style={{ width: 320 }} placeholder={TEXT.issuedAtPlaceholder} />
              <Button
                type="primary"
                disabled={!canSave}
                onClick={async () => {
                  const targetOrderId = orderId.trim();
                  const fileId = invoiceFile?.id || invoice?.invoiceFile?.id;
                  if (!targetOrderId || !fileId) {
                    message.warning(TEXT.uploadFirst);
                    return;
                  }
                  const { ok } = await confirmActionWithReason({
                    title: TEXT.saveTitle,
                    content: TEXT.saveContent,
                    okText: TEXT.saveInvoice,
                    reasonLabel: TEXT.reasonLabel,
                    reasonPlaceholder: TEXT.saveReasonPlaceholder,
                  });
                  if (!ok) return;
                  const requestSeq = ++saveSeqRef.current;
                  try {
                    const next = await apiPut<OrderInvoice>(
                      `/admin/orders/${targetOrderId}/invoice`,
                      {
                        invoiceFileId: fileId,
                        invoiceNo: invoiceNo || undefined,
                        issuedAt: issuedAt || undefined,
                      },
                      { idempotencyKey: `invoice-${targetOrderId}` },
                    );
                    if (saveSeqRef.current !== requestSeq || orderIdRef.current !== targetOrderId) return;
                    setInvoice(next);
                    setNotFound(false);
                    setInvoiceFile(null);
                    message.success(TEXT.saveSuccess);
                  } catch (e: any) {
                    if (saveSeqRef.current !== requestSeq || orderIdRef.current !== targetOrderId) return;
                    message.error(e?.message || TEXT.saveFailed);
                  }
                }}
              >
                {TEXT.saveInvoice}
              </Button>
              <Button
                danger
                disabled={!invoice}
                onClick={async () => {
                  const targetOrderId = orderId.trim();
                  const { ok } = await confirmActionWithReason({
                    title: TEXT.deleteTitle,
                    content: TEXT.deleteContent,
                    okText: TEXT.deleteInvoice,
                    danger: true,
                    reasonLabel: TEXT.reasonLabel,
                    reasonPlaceholder: TEXT.deleteReasonPlaceholder,
                    reasonRequired: true,
                  });
                  if (!ok) return;
                  const requestSeq = ++deleteSeqRef.current;
                  try {
                    await apiDelete(`/admin/orders/${targetOrderId}/invoice`, {
                      idempotencyKey: `invoice-del-${targetOrderId}`,
                    });
                    if (deleteSeqRef.current !== requestSeq || orderIdRef.current !== targetOrderId) return;
                    setInvoice(null);
                    setNotFound(true);
                    setInvoiceFile(null);
                    setInvoiceNo('');
                    setIssuedAt('');
                    message.success(TEXT.deleteSuccess);
                  } catch (e: any) {
                    if (deleteSeqRef.current !== requestSeq || orderIdRef.current !== targetOrderId) return;
                    message.error(e?.message || TEXT.deleteFailed);
                  }
                }}
              >
                {TEXT.deleteInvoice}
              </Button>
            </Space>
          </Space>
        </Card>
      </Space>
    </Card>
  );
}
