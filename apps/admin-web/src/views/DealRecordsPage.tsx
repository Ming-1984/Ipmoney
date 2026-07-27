import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  Upload,
  message,
} from 'antd';
import {
  DownloadOutlined,
  ReloadOutlined,
  StopOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { apiGet, apiPatch, apiPost, apiUploadFile } from '../lib/api';
import { fenToYuan, formatTimeSmart } from '../lib/format';
import { confirmActionWithReason } from '../ui/confirm';

type DealRecordSource = 'ONLINE_ORDER' | 'ADMIN_IMPORT';
type DealRecordStatus = 'ACTIVE' | 'VOIDED';
type DealTradeType = 'LICENSE' | 'TRANSFER' | 'UNKNOWN';
type DuplicatePolicy = 'SKIP' | 'UPSERT';

type DealRecord = {
  id: string;
  source: DealRecordSource;
  status: DealRecordStatus;
  sourceOrderId?: string | null;
  importJobId?: string | null;
  patentNoDisplay: string;
  patentTitle: string;
  tradeType: DealTradeType;
  sellerPartyName: string;
  buyerPartyName: string;
  dealAt: string;
  priceFen: number;
  voidReason?: string | null;
  createdAt: string;
};

type PagedDealRecords = {
  items: DealRecord[];
  page: { page: number; pageSize: number; total: number };
};

type DealRecordSummary = {
  activeTotal: number;
  onlineTotal: number;
  importedTotal: number;
  activeAmountFen: number;
};

type PreviewResult = {
  summary: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
    duplicateRows: number;
    warningRows: number;
  };
  sampleErrors?: Array<{ rowNo: number; code?: string; message?: string }>;
  sampleWarnings?: Array<{ rowNo: number; code?: string; message?: string; existingDealRecordId?: string | null }>;
};

type ImportJob = {
  id: string;
  status: string;
  duplicatePolicy: DuplicatePolicy;
  totalCount: number;
  validCount: number;
  invalidCount: number;
  successCount: number;
  skippedCount: number;
  failedCount: number;
  createdAt: string;
  finishedAt?: string | null;
};

type ImportExecuteResult = {
  job: ImportJob;
  summary: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
    successCount: number;
    skippedCount: number;
    failedCount: number;
  };
};

type FilterValues = {
  q?: string;
  source?: DealRecordSource;
  status?: DealRecordStatus;
  tradeType?: DealTradeType;
  dealFrom?: string;
  dealTo?: string;
};

const SOURCE_LABELS: Record<DealRecordSource, string> = {
  ONLINE_ORDER: '线上订单',
  ADMIN_IMPORT: '后台导入',
};

const STATUS_LABELS: Record<DealRecordStatus, string> = {
  ACTIVE: '有效',
  VOIDED: '已作废',
};

const TRADE_TYPE_LABELS: Record<DealTradeType, string> = {
  LICENSE: '许可',
  TRANSFER: '转让',
  UNKNOWN: '未知',
};

function sourceTag(source: DealRecordSource) {
  return <Tag color={source === 'ONLINE_ORDER' ? 'green' : 'blue'}>{SOURCE_LABELS[source] || source}</Tag>;
}

function statusTag(status: DealRecordStatus) {
  return <Tag color={status === 'ACTIVE' ? 'success' : 'default'}>{STATUS_LABELS[status] || status}</Tag>;
}

function downloadTemplate() {
  const headers = ['专利号', '专利名称', '交易类型', '许可方/转让方', '被许可方/受让方', '成交时间', '价格', '备注'];
  const sample = ['CN202410000000.1', '高效储能控制方法', '转让', '广东某科技有限公司', '深圳某产业集团有限公司', '2026-07-27', '100000', '示例行'];
  const csv = `\uFEFF${headers.join(',')}\n${sample.join(',')}\n`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'deal-record-import-template.csv';
  anchor.click();
  URL.revokeObjectURL(url);
}

export function DealRecordsPage() {
  const [form] = Form.useForm<FilterValues>();
  const [items, setItems] = useState<DealRecord[]>([]);
  const [summary, setSummary] = useState<DealRecordSummary | null>(null);
  const [page, setPage] = useState({ page: 1, pageSize: 20, total: 0 });
  const [filters, setFilters] = useState<FilterValues>({});
  const [loading, setLoading] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [duplicatePolicy, setDuplicatePolicy] = useState<DuplicatePolicy>('SKIP');
  const [uploadedFileId, setUploadedFileId] = useState<string>('');
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [lastImport, setLastImport] = useState<ImportExecuteResult | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = { ...filters, page: page.page, pageSize: page.pageSize };
      const [listRes, summaryRes] = await Promise.all([
        apiGet<PagedDealRecords>('/admin/deal-records', params),
        apiGet<DealRecordSummary>('/admin/deal-records/summary', filters),
      ]);
      setItems(listRes.items || []);
      setPage((prev) => ({ ...prev, total: listRes.page?.total || 0 }));
      setSummary(summaryRes);
    } catch (e: any) {
      message.error(e?.message || '加载成交记录失败');
    } finally {
      setLoading(false);
    }
  }, [filters, page.page, page.pageSize]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const importPayload = useMemo(
    () => ({ fileId: uploadedFileId, duplicatePolicy }),
    [duplicatePolicy, uploadedFileId],
  );

  const ensureUploadedFile = useCallback(async () => {
    if (uploadedFileId) return uploadedFileId;
    if (!importFile) {
      message.warning('请先选择导入文件');
      return '';
    }
    const uploaded = await apiUploadFile(importFile, 'deal-record-import');
    setUploadedFileId(uploaded.id);
    return uploaded.id;
  }, [importFile, uploadedFileId]);

  const handlePreview = useCallback(async () => {
    setImporting(true);
    try {
      const fileId = await ensureUploadedFile();
      if (!fileId) return;
      const result = await apiPost<PreviewResult>('/admin/deal-records/import/preview', { fileId, duplicatePolicy });
      setPreview(result);
      setLastImport(null);
      message.success('预览完成');
    } catch (e: any) {
      message.error(e?.message || '预览失败');
    } finally {
      setImporting(false);
    }
  }, [duplicatePolicy, ensureUploadedFile]);

  const handleExecute = useCallback(async () => {
    setImporting(true);
    try {
      const fileId = await ensureUploadedFile();
      if (!fileId) return;
      const result = await apiPost<ImportExecuteResult>(
        '/admin/deal-records/import/execute',
        { ...importPayload, fileId },
        { idempotencyKey: `deal-record-import-${Date.now()}` },
      );
      setLastImport(result);
      setPreview(null);
      message.success('导入完成');
      void loadData();
    } catch (e: any) {
      message.error(e?.message || '导入失败');
    } finally {
      setImporting(false);
    }
  }, [ensureUploadedFile, importPayload, loadData]);

  const handleVoid = useCallback(
    async (record: DealRecord) => {
      const confirmed = await confirmActionWithReason({
        title: '作废成交记录',
        content: `作废后不会计入首页累计成交量：${record.patentTitle}`,
        okText: '确认作废',
        danger: true,
        reasonRequired: true,
        defaultReason: record.source === 'ADMIN_IMPORT' ? '导入数据作废' : '成交记录作废',
      });
      if (!confirmed.ok) return;
      try {
        await apiPatch(`/admin/deal-records/${record.id}/void`, { reason: confirmed.reason });
        message.success('已作废成交记录');
        void loadData();
      } catch (e: any) {
        message.error(e?.message || '作废失败');
      }
    },
    [loadData],
  );

  const columns = [
    {
      title: '专利',
      dataIndex: 'patentTitle',
      render: (_: unknown, row: DealRecord) => (
        <Space direction="vertical" size={2}>
          <Typography.Text strong>{row.patentTitle}</Typography.Text>
          <Typography.Text type="secondary">{row.patentNoDisplay}</Typography.Text>
        </Space>
      ),
    },
    {
      title: '交易双方',
      render: (_: unknown, row: DealRecord) => (
        <Space direction="vertical" size={2}>
          <span>出让：{row.sellerPartyName}</span>
          <span>受让：{row.buyerPartyName}</span>
        </Space>
      ),
    },
    {
      title: '类型',
      dataIndex: 'tradeType',
      width: 90,
      render: (value: DealTradeType) => TRADE_TYPE_LABELS[value] || value,
    },
    {
      title: '价格',
      dataIndex: 'priceFen',
      width: 120,
      render: (value: number) => `¥${fenToYuan(value)}`,
    },
    {
      title: '成交时间',
      dataIndex: 'dealAt',
      width: 150,
      render: (value: string) => formatTimeSmart(value),
    },
    {
      title: '来源',
      dataIndex: 'source',
      width: 110,
      render: (value: DealRecordSource) => sourceTag(value),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (value: DealRecordStatus) => statusTag(value),
    },
    {
      title: '操作',
      width: 100,
      render: (_: unknown, row: DealRecord) =>
        row.status === 'ACTIVE' ? (
          <Button danger icon={<StopOutlined />} size="small" onClick={() => void handleVoid(row)}>
            作废
          </Button>
        ) : (
          <Typography.Text type="secondary">-</Typography.Text>
        ),
    },
  ];

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Space align="start" style={{ width: '100%', justifyContent: 'space-between' }}>
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>
            成交记录
          </Typography.Title>
          <Typography.Text type="secondary">统一管理后台导入成交与线上完成订单的成交事实。</Typography.Text>
        </div>
        <Space>
          <Button icon={<DownloadOutlined />} onClick={downloadTemplate}>
            下载模板
          </Button>
          <Button icon={<ReloadOutlined />} onClick={() => void loadData()}>
            刷新
          </Button>
        </Space>
      </Space>

      <Space size={16} wrap>
        <Card>
          <Statistic title="累计成交量" value={summary?.activeTotal ?? 0} />
        </Card>
        <Card>
          <Statistic title="线上成交" value={summary?.onlineTotal ?? 0} />
        </Card>
        <Card>
          <Statistic title="导入成交" value={summary?.importedTotal ?? 0} />
        </Card>
        <Card>
          <Statistic title="累计成交额" prefix="¥" value={fenToYuan(summary?.activeAmountFen ?? 0)} />
        </Card>
      </Space>

      <Card>
        <Form
          form={form}
          layout="inline"
          onFinish={(values) => {
            setFilters(values);
            setPage((prev) => ({ ...prev, page: 1 }));
          }}
        >
          <Form.Item name="q">
            <Input allowClear placeholder="专利号/名称/交易方" style={{ width: 220 }} />
          </Form.Item>
          <Form.Item name="source">
            <Select
              allowClear
              placeholder="来源"
              style={{ width: 130 }}
              options={[
                { value: 'ONLINE_ORDER', label: '线上订单' },
                { value: 'ADMIN_IMPORT', label: '后台导入' },
              ]}
            />
          </Form.Item>
          <Form.Item name="status">
            <Select
              allowClear
              placeholder="状态"
              style={{ width: 120 }}
              options={[
                { value: 'ACTIVE', label: '有效' },
                { value: 'VOIDED', label: '已作废' },
              ]}
            />
          </Form.Item>
          <Form.Item name="tradeType">
            <Select
              allowClear
              placeholder="交易类型"
              style={{ width: 120 }}
              options={[
                { value: 'LICENSE', label: '许可' },
                { value: 'TRANSFER', label: '转让' },
              ]}
            />
          </Form.Item>
          <Form.Item name="dealFrom">
            <Input allowClear placeholder="开始日期 YYYY-MM-DD" style={{ width: 170 }} />
          </Form.Item>
          <Form.Item name="dealTo">
            <Input allowClear placeholder="结束日期 YYYY-MM-DD" style={{ width: 170 }} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                查询
              </Button>
              <Button
                onClick={() => {
                  form.resetFields();
                  setFilters({});
                  setPage((prev) => ({ ...prev, page: 1 }));
                }}
              >
                重置
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Card title="成交数据导入">
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Space wrap>
            <Upload
              maxCount={1}
              beforeUpload={(file) => {
                setImportFile(file);
                setUploadedFileId('');
                setPreview(null);
                setLastImport(null);
                return false;
              }}
              onRemove={() => {
                setImportFile(null);
                setUploadedFileId('');
                setPreview(null);
                setLastImport(null);
              }}
            >
              <Button icon={<UploadOutlined />}>选择文件</Button>
            </Upload>
            <Select
              value={duplicatePolicy}
              style={{ width: 190 }}
              onChange={(value) => setDuplicatePolicy(value)}
              options={[
                { value: 'SKIP', label: '重复跳过' },
                { value: 'UPSERT', label: '重复更新' },
              ]}
            />
            <Button loading={importing} onClick={() => void handlePreview()}>
              预览
            </Button>
            <Button type="primary" loading={importing} onClick={() => void handleExecute()}>
              执行导入
            </Button>
          </Space>

          {preview ? (
            <Alert
              type={preview.summary.invalidRows > 0 ? 'warning' : 'success'}
              showIcon
              message={`预览：总 ${preview.summary.totalRows} 行，有效 ${preview.summary.validRows} 行，无效 ${preview.summary.invalidRows} 行，重复 ${preview.summary.duplicateRows} 行`}
              description={
                <Space direction="vertical" size={4}>
                  {(preview.sampleErrors || []).map((item) => (
                    <Typography.Text key={`e-${item.rowNo}`} type="danger">
                      第 {item.rowNo} 行：{item.message || item.code}
                    </Typography.Text>
                  ))}
                  {(preview.sampleWarnings || []).map((item) => (
                    <Typography.Text key={`w-${item.rowNo}`} type="secondary">
                      第 {item.rowNo} 行：{item.message || item.code}
                    </Typography.Text>
                  ))}
                </Space>
              }
            />
          ) : null}

          {lastImport ? (
            <Alert
              type={lastImport.summary.failedCount > 0 ? 'warning' : 'success'}
              showIcon
              message={`导入批次 ${lastImport.job.id}`}
              description={`成功 ${lastImport.summary.successCount} 行，跳过 ${lastImport.summary.skippedCount} 行，失败 ${lastImport.summary.failedCount} 行`}
            />
          ) : null}
        </Space>
      </Card>

      <Card>
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={items}
          pagination={{
            current: page.page,
            pageSize: page.pageSize,
            total: page.total,
            showSizeChanger: true,
          }}
          onChange={(pagination) => {
            setPage({
              page: pagination.current || 1,
              pageSize: pagination.pageSize || 20,
              total: pagination.total || 0,
            });
          }}
        />
      </Card>
    </Space>
  );
}
