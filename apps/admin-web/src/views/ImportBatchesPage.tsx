import {
  Alert,
  Button,
  Card,
  Descriptions,
  Drawer,
  Form,
  Input,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import { DownloadOutlined, ReloadOutlined, RollbackOutlined, SearchOutlined } from '@ant-design/icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { apiGet, apiPost } from '../lib/api';
import { formatTimeSmart } from '../lib/format';
import { displayAdminInfo } from '../lib/userFacingText';
import { RequestErrorAlert } from '../ui/RequestState';

type ImportBatchKind = 'PEOPLE_ACHIEVEMENTS' | 'PATENT' | 'LISTING' | 'DEAL_RECORD' | 'LISTING_BATCH_ACTION';
type ImportBatchStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'PARTIALLY_SUCCEEDED'
  | 'ROLLBACK_PRECHECKED'
  | 'ROLLBACK_RUNNING'
  | 'ROLLED_BACK'
  | 'PARTIALLY_ROLLED_BACK'
  | 'ROLLBACK_FAILED';
type ImportEntityType =
  | 'USER'
  | 'USER_VERIFICATION'
  | 'TECH_MANAGER_PROFILE'
  | 'TECH_MANAGER_BADGE'
  | 'ACHIEVEMENT'
  | 'PATENT'
  | 'LISTING'
  | 'DEAL_RECORD';
type RollbackStatus = 'PENDING' | 'ROLLBACKABLE' | 'BLOCKED' | 'CONFLICTED' | 'ROLLED_BACK' | 'FAILED' | 'SKIPPED';

type ImportBatch = {
  id: string;
  kind: ImportBatchKind;
  sourceBatch?: string | null;
  operatorUserId?: string | null;
  operatorName?: string | null;
  operatorPhone?: string | null;
  status: ImportBatchStatus;
  legacyJobType?: string | null;
  legacyJobId?: string | null;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
  rollbackableCount: number;
  conflictedCount: number;
  blockedCount: number;
  rolledBackCount: number;
  fileId?: string | null;
  errorFileId?: string | null;
  executedAt?: string | null;
  rollbackAt?: string | null;
  rollbackReason?: string | null;
  lastPrecheckedAt?: string | null;
  lastRollbackError?: string | null;
  createdAt: string;
  updatedAt: string;
};

type RollbackChangePreview = {
  changeId: string;
  rowNo?: number | null;
  entityType: ImportEntityType;
  entityId?: string | null;
  entityLabel?: string | null;
  operation: string;
  rollbackStrategy: string;
  rollbackStatus: RollbackStatus;
  blockedReason?: string | null;
  dependency?: Record<string, any> | null;
};

type RollbackPreview = {
  batch: ImportBatch;
  canRollback: boolean;
  summary: {
    totalCount: number;
    rollbackableCount: number;
    conflictedCount: number;
    blockedCount: number;
    manualOnlyCount: number;
    rolledBackCount: number;
    skippedCount: number;
    failedCount: number;
  };
  groups: Array<{
    entityType: ImportEntityType;
    total: number;
    created: number;
    updated: number;
    rollbackable: number;
    conflicted: number;
    blocked: number;
    manualOnly: number;
    rolledBack: number;
  }>;
  warnings: string[];
  changes: RollbackChangePreview[];
};

type ImportChange = {
  id: string;
  rowNo?: number | null;
  entityType: ImportEntityType;
  entityId?: string | null;
  operation: string;
  rollbackStrategy: string;
  rollbackStatus: RollbackStatus;
  blockedReason?: string | null;
  dependencyJson?: Record<string, any> | null;
  rolledBackAt?: string | null;
  rollbackError?: string | null;
};

type Paged<T> = { items: T[]; page: { page: number; pageSize: number; total: number } };
type FilterValues = { q?: string; kind?: ImportBatchKind; status?: ImportBatchStatus };

const KIND_LABELS: Record<ImportBatchKind, string> = {
  PEOPLE_ACHIEVEMENTS: '成果/经理人',
  PATENT: '专利主数据',
  LISTING: '挂牌导入',
  DEAL_RECORD: '成交记录',
  LISTING_BATCH_ACTION: '挂牌批处理',
};

const STATUS_LABELS: Record<ImportBatchStatus, string> = {
  PENDING: '待处理',
  RUNNING: '执行中',
  SUCCEEDED: '已完成',
  FAILED: '失败',
  PARTIALLY_SUCCEEDED: '部分完成',
  ROLLBACK_PRECHECKED: '已预检',
  ROLLBACK_RUNNING: '撤回中',
  ROLLED_BACK: '已撤回',
  PARTIALLY_ROLLED_BACK: '部分撤回',
  ROLLBACK_FAILED: '撤回失败',
};

const ENTITY_LABELS: Record<ImportEntityType, string> = {
  USER: '用户',
  USER_VERIFICATION: '认证资料',
  TECH_MANAGER_PROFILE: '经理人资料',
  TECH_MANAGER_BADGE: '经理人标签',
  ACHIEVEMENT: '成果',
  PATENT: '专利',
  LISTING: '挂牌',
  DEAL_RECORD: '成交记录',
};

const ROLLBACK_STATUS_LABELS: Record<RollbackStatus, string> = {
  PENDING: '待评估',
  ROLLBACKABLE: '可自动撤回',
  BLOCKED: '阻断/人工处理',
  CONFLICTED: '冲突',
  ROLLED_BACK: '已撤回',
  FAILED: '失败',
  SKIPPED: '跳过',
};

const OPERATION_LABELS: Record<string, string> = {
  CREATE: '新增',
  UPDATE: '更新',
  APPEND: '追加',
  REPLACE: '替换',
  SOFT_DELETE: '软删除',
  VOID: '作废',
};

const ROLLBACK_STRATEGY_LABELS: Record<string, string> = {
  DELETE: '删除新增数据',
  RESTORE: '恢复原数据',
  SOFT_OFF_SHELF: '下架新增挂牌',
  VOID: '作废新增记录',
  EXPIRE_BADGE: '移除新增标签',
  MANUAL_ONLY: '仅人工处理',
};

function importChangeOperationLabel(value?: string | null): string {
  return OPERATION_LABELS[String(value || '').trim().toUpperCase()] || '操作待确认';
}

function rollbackStrategyLabel(value?: string | null): string {
  return ROLLBACK_STRATEGY_LABELS[String(value || '').trim().toUpperCase()] || '策略待确认';
}

function statusTag(status: ImportBatchStatus) {
  if (status === 'SUCCEEDED') return <Tag color="green">{STATUS_LABELS[status]}</Tag>;
  if (status === 'FAILED' || status === 'ROLLBACK_FAILED') return <Tag color="red">{STATUS_LABELS[status]}</Tag>;
  if (status === 'PARTIALLY_SUCCEEDED' || status === 'PARTIALLY_ROLLED_BACK') return <Tag color="orange">{STATUS_LABELS[status]}</Tag>;
  if (status === 'ROLLBACK_PRECHECKED' || status === 'ROLLBACK_RUNNING') return <Tag color="blue">{STATUS_LABELS[status]}</Tag>;
  if (status === 'ROLLED_BACK') return <Tag>{STATUS_LABELS[status]}</Tag>;
  return <Tag>{STATUS_LABELS[status] || '状态待确认'}</Tag>;
}

function rollbackStatusTag(status: RollbackStatus) {
  if (status === 'ROLLBACKABLE') return <Tag color="green">{ROLLBACK_STATUS_LABELS[status]}</Tag>;
  if (status === 'CONFLICTED') return <Tag color="orange">{ROLLBACK_STATUS_LABELS[status]}</Tag>;
  if (status === 'BLOCKED' || status === 'FAILED') return <Tag color="red">{ROLLBACK_STATUS_LABELS[status]}</Tag>;
  if (status === 'ROLLED_BACK') return <Tag color="blue">{ROLLBACK_STATUS_LABELS[status]}</Tag>;
  return <Tag>{ROLLBACK_STATUS_LABELS[status] || '状态待确认'}</Tag>;
}

function escapeCsv(value: unknown): string {
  const raw = value === null || value === undefined ? '' : String(value);
  return `"${raw.replace(/"/g, '""')}"`;
}

function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const objectUrl = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(objectUrl);
}

function buildReportCsv(rows: ImportChange[]): string {
  const headers = ['行号', '实体类型', '实体ID', '操作', '撤回策略', '撤回状态', '阻断/失败原因', '已撤回时间'];
  const lines = rows.map((row) =>
    [
      row.rowNo ?? '',
      ENTITY_LABELS[row.entityType] || '实体待确认',
      row.entityId || '',
      importChangeOperationLabel(row.operation),
      rollbackStrategyLabel(row.rollbackStrategy),
      ROLLBACK_STATUS_LABELS[row.rollbackStatus] || '状态待确认',
      row.rollbackError || row.blockedReason || '',
      row.rolledBackAt ? formatTimeSmart(row.rolledBackAt) : '',
    ]
      .map(escapeCsv)
      .join(','),
  );
  return [`\uFEFF${headers.map(escapeCsv).join(',')}`, ...lines].join('\n');
}

export function ImportBatchesPage() {
  const [form] = Form.useForm<FilterValues>();
  const [items, setItems] = useState<ImportBatch[]>([]);
  const [page, setPage] = useState({ page: 1, pageSize: 20, total: 0 });
  const [filters, setFilters] = useState<FilterValues>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [rollbackSubmitting, setRollbackSubmitting] = useState(false);
  const [reportDownloading, setReportDownloading] = useState(false);
  const [activePreview, setActivePreview] = useState<RollbackPreview | null>(null);
  const [activeBatch, setActiveBatch] = useState<ImportBatch | null>(null);
  const [reason, setReason] = useState('');
  const [confirmationText, setConfirmationText] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<Paged<ImportBatch>>('/admin/import-batches', {
        ...filters,
        page: page.page,
        pageSize: page.pageSize,
      });
      setItems(res.items || []);
      setPage((prev) => ({ ...prev, total: res.page.total, page: res.page.page, pageSize: res.page.pageSize }));
    } catch (e: any) {
      setError(e);
      message.error(e?.message || '导入批次加载失败');
    } finally {
      setLoading(false);
    }
  }, [filters, page.page, page.pageSize]);

  useEffect(() => {
    void load();
  }, [load]);

  const expectedConfirmation = useMemo(() => {
    if (!activePreview?.batch && !activeBatch) return '';
    return String(activePreview?.batch.sourceBatch || activeBatch?.sourceBatch || activePreview?.batch.id || activeBatch?.id || '').trim();
  }, [activeBatch, activePreview]);

  const openPreview = useCallback(async (batch: ImportBatch) => {
    setActiveBatch(batch);
    setActivePreview(null);
    setDrawerOpen(true);
    setReason('');
    setConfirmationText('');
    setPreviewLoading(true);
    try {
      const res = await apiPost<RollbackPreview>(`/admin/import-batches/${batch.id}/rollback-preview`, {});
      setActivePreview(res);
      void load();
    } catch (e: any) {
      message.error(e?.message || '撤回预检失败');
    } finally {
      setPreviewLoading(false);
    }
  }, [load]);

  const executeRollback = useCallback(async () => {
    const batchId = activePreview?.batch.id || activeBatch?.id;
    if (!batchId) return;
    if (!reason.trim()) {
      message.warning('请填写撤回原因');
      return;
    }
    if (!expectedConfirmation || confirmationText.trim() !== expectedConfirmation) {
      message.warning('确认文本需要与批次名称一致');
      return;
    }
    setRollbackSubmitting(true);
    try {
      const res = await apiPost<RollbackPreview>(
        `/admin/import-batches/${batchId}/rollback`,
        { reason: reason.trim(), confirmationText: confirmationText.trim() },
        { idempotencyKey: `import-batch-rollback-${batchId}-${Date.now()}`, retry: 1 },
      );
      setActivePreview(res);
      message.success('批次撤回已执行');
      void load();
    } catch (e: any) {
      message.error(e?.message || '批次撤回失败');
    } finally {
      setRollbackSubmitting(false);
    }
  }, [activeBatch?.id, activePreview?.batch.id, confirmationText, expectedConfirmation, load, reason]);

  const downloadReport = useCallback(async () => {
    const batchId = activePreview?.batch.id || activeBatch?.id;
    if (!batchId) return;
    setReportDownloading(true);
    try {
      const allRows: ImportChange[] = [];
      let nextPage = 1;
      let total = 0;
      do {
        const res = await apiGet<Paged<ImportChange>>(`/admin/import-batches/${batchId}/rollback-report`, {
          page: nextPage,
          pageSize: 500,
        });
        allRows.push(...(res.items || []));
        total = res.page.total || allRows.length;
        nextPage += 1;
      } while (allRows.length < total);
      const date = new Date().toISOString().slice(0, 10);
      downloadTextFile(`import-batch-rollback-report-${batchId.slice(0, 8)}-${date}.csv`, buildReportCsv(allRows), 'text/csv;charset=utf-8');
      message.success('报告下载已开始');
    } catch (e: any) {
      message.error(e?.message || '报告下载失败');
    } finally {
      setReportDownloading(false);
    }
  }, [activeBatch?.id, activePreview?.batch.id]);

  const columns = [
    {
      title: '批次',
      dataIndex: 'sourceBatch',
      width: 260,
      render: (value: string | null, row: ImportBatch) => (
        <Space direction="vertical" size={2}>
          <Typography.Text strong>{value || row.id}</Typography.Text>
          <Typography.Text type="secondary">{row.legacyJobId || row.id}</Typography.Text>
        </Space>
      ),
    },
    {
      title: '类型',
      dataIndex: 'kind',
      width: 130,
      render: (value: ImportBatchKind) => <Tag color="blue">{KIND_LABELS[value] || '类型待确认'}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 130,
      render: (value: ImportBatchStatus) => statusTag(value),
    },
    {
      title: '导入统计',
      width: 210,
      render: (_: unknown, row: ImportBatch) => `新增 ${row.createdCount} / 更新 ${row.updatedCount} / 跳过 ${row.skippedCount} / 失败 ${row.failedCount}`,
    },
    {
      title: '撤回评估',
      width: 210,
      render: (_: unknown, row: ImportBatch) =>
        `可撤 ${row.rollbackableCount} / 冲突 ${row.conflictedCount} / 阻断 ${row.blockedCount} / 已撤 ${row.rolledBackCount}`,
    },
    {
      title: '操作者',
      width: 150,
      render: (_: unknown, row: ImportBatch) => displayAdminInfo(row.operatorName || row.operatorPhone || row.operatorUserId, '平台成员'),
    },
    {
      title: '时间',
      dataIndex: 'createdAt',
      width: 150,
      render: (value: string) => formatTimeSmart(value),
    },
    {
      title: '操作',
      fixed: 'right' as const,
      width: 130,
      render: (_: unknown, row: ImportBatch) => (
        <Button icon={<RollbackOutlined />} size="small" onClick={() => void openPreview(row)}>
          撤回预检
        </Button>
      ),
    },
  ];

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card>
        <Space align="start" style={{ width: '100%', justifyContent: 'space-between' }}>
          <div>
            <Typography.Title level={3} style={{ marginTop: 0 }}>
              导入批次中心
            </Typography.Title>
            <Typography.Text type="secondary">统一查看导入批次、撤回预检、冲突阻断和审计报告。</Typography.Text>
          </div>
          <Button icon={<ReloadOutlined />} onClick={() => void load()} loading={loading}>
            刷新
          </Button>
        </Space>
      </Card>

      {error ? <RequestErrorAlert error={error} onRetry={load} /> : null}

      <Card>
        <Form
          form={form}
          layout="inline"
          onFinish={(values) => {
            setPage((prev) => ({ ...prev, page: 1 }));
            setFilters(values);
          }}
        >
          <Form.Item name="q">
            <Input allowClear prefix={<SearchOutlined />} placeholder="批次名称 / ID" style={{ width: 240 }} />
          </Form.Item>
          <Form.Item name="kind">
            <Select
              allowClear
              placeholder="导入类型"
              style={{ width: 160 }}
              options={Object.entries(KIND_LABELS).map(([value, label]) => ({ value, label }))}
            />
          </Form.Item>
          <Form.Item name="status">
            <Select
              allowClear
              placeholder="批次状态"
              style={{ width: 160 }}
              options={Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))}
            />
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

      <Card>
        <Table<ImportBatch>
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={items}
          scroll={{ x: 1420 }}
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
              total: page.total,
            });
          }}
        />
      </Card>

      <Drawer
        title={activePreview ? `撤回预检：${activePreview.batch.sourceBatch || activePreview.batch.id}` : '撤回预检'}
        open={drawerOpen}
        width={920}
        onClose={() => setDrawerOpen(false)}
        extra={
          <Space>
            <Button icon={<DownloadOutlined />} loading={reportDownloading} onClick={() => void downloadReport()} disabled={!activePreview}>
              下载报告
            </Button>
            <Button icon={<ReloadOutlined />} onClick={() => activeBatch && void openPreview(activeBatch)} loading={previewLoading} disabled={!activeBatch}>
              重新预检
            </Button>
          </Space>
        }
      >
        {previewLoading && !activePreview ? <Card loading /> : null}

        {activePreview ? (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="批次类型">{KIND_LABELS[activePreview.batch.kind] || '类型待确认'}</Descriptions.Item>
              <Descriptions.Item label="批次状态">{statusTag(activePreview.batch.status)}</Descriptions.Item>
              <Descriptions.Item label="操作者">
                {displayAdminInfo(activePreview.batch.operatorName || activePreview.batch.operatorPhone || activePreview.batch.operatorUserId, '平台成员')}
              </Descriptions.Item>
              <Descriptions.Item label="导入时间">{formatTimeSmart(activePreview.batch.executedAt || activePreview.batch.createdAt)}</Descriptions.Item>
              <Descriptions.Item label="批次名称" span={2}>
                {activePreview.batch.sourceBatch || activePreview.batch.id}
              </Descriptions.Item>
            </Descriptions>

            <Space size={12} wrap>
              <Card>
                <Statistic title="可自动撤回" value={activePreview.summary.rollbackableCount} />
              </Card>
              <Card>
                <Statistic title="冲突" value={activePreview.summary.conflictedCount} />
              </Card>
              <Card>
                <Statistic title="阻断/人工处理" value={activePreview.summary.blockedCount} />
              </Card>
              <Card>
                <Statistic title="已撤回" value={activePreview.summary.rolledBackCount} />
              </Card>
            </Space>

            {activePreview.warnings.length ? (
              <Alert type={activePreview.canRollback ? 'warning' : 'info'} showIcon message={activePreview.warnings.join(' ')} />
            ) : null}

            <Table
              size="small"
              rowKey="entityType"
              pagination={false}
              dataSource={activePreview.groups}
              columns={[
                {
                  title: '分组',
                  dataIndex: 'entityType',
                  render: (value: ImportEntityType) => ENTITY_LABELS[value] || '实体待确认',
                },
                { title: '总数', dataIndex: 'total' },
                { title: '新增', dataIndex: 'created' },
                { title: '更新', dataIndex: 'updated' },
                { title: '可自动撤回', dataIndex: 'rollbackable' },
                { title: '冲突', dataIndex: 'conflicted' },
                { title: '阻断', dataIndex: 'blocked' },
                { title: '人工处理', dataIndex: 'manualOnly' },
                { title: '已撤回', dataIndex: 'rolledBack' },
              ]}
            />

            <Table<RollbackChangePreview>
              size="small"
              rowKey="changeId"
              pagination={{ pageSize: 8 }}
              dataSource={activePreview.changes}
              columns={[
                { title: '行号', dataIndex: 'rowNo', width: 80, render: (value) => value || '-' },
                {
                  title: '实体',
                  width: 140,
                  render: (_: unknown, row) => ENTITY_LABELS[row.entityType] || '实体待确认',
                },
                {
                  title: '名称',
                  dataIndex: 'entityLabel',
                  render: (value: string | null, row) => value || row.entityId || '-',
                },
                {
                  title: '状态',
                  dataIndex: 'rollbackStatus',
                  width: 150,
                  render: (value: RollbackStatus) => rollbackStatusTag(value),
                },
                {
                  title: '原因',
                  dataIndex: 'blockedReason',
                  render: (value: string | null) => value || '-',
                },
              ]}
            />

            {activePreview.canRollback ? (
              <Card>
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  <Input.TextArea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="撤回原因，必填"
                    autoSize={{ minRows: 3, maxRows: 5 }}
                  />
                  <Input
                    value={confirmationText}
                    onChange={(e) => setConfirmationText(e.target.value)}
                    placeholder={`输入批次名称确认：${expectedConfirmation}`}
                  />
                  <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
                    <Button danger type="primary" icon={<RollbackOutlined />} loading={rollbackSubmitting} onClick={() => void executeRollback()}>
                      撤回可安全处理数据
                    </Button>
                  </Space>
                </Space>
              </Card>
            ) : (
              <Alert type="info" showIcon message="当前批次没有可自动撤回的数据，请下载报告后人工处理冲突或阻断项。" />
            )}
          </Space>
        ) : null}
      </Drawer>
    </Space>
  );
}
