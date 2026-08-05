import {
  Alert,
  Button,
  Card,
  Checkbox,
  Descriptions,
  Drawer,
  Form,
  Input,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import { CheckCircleOutlined, ClockCircleOutlined, DownloadOutlined, ExclamationCircleOutlined, FileTextOutlined, ReloadOutlined, RollbackOutlined, SearchOutlined } from '@ant-design/icons';
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
  overrideable?: boolean;
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
  SOFT_OFF_SHELF: '下架/隐藏',
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

function countTag(label: string, value: number, color?: string) {
  return (
    <Tag color={color}>
      {label} {value}
    </Tag>
  );
}

type RollbackSummaryTone = 'status' | 'auto' | 'confirm' | 'report' | 'done';

const ROLLBACK_SUMMARY_TONES: Record<
  RollbackSummaryTone,
  { background: string; border: string; text: string; number: string }
> = {
  status: { background: '#eef4ff', border: '#8bb7ff', text: '#1d4ed8', number: '#1e40af' },
  auto: { background: '#edf9f0', border: '#70c58a', text: '#1f7a3a', number: '#12642b' },
  confirm: { background: '#fff7e6', border: '#f0a744', text: '#ad5b00', number: '#8a4400' },
  report: { background: '#fff1f0', border: '#ff8f85', text: '#c92a20', number: '#a51d16' },
  done: { background: '#f0f5ff', border: '#8ea9e8', text: '#31579f', number: '#24467f' },
};

function rollbackSummaryTag(label: string, value: React.ReactNode, tone: RollbackSummaryTone, icon: React.ReactNode, title: string) {
  const style = ROLLBACK_SUMMARY_TONES[tone];
  return (
    <Tag
      title={title}
      style={{
        alignItems: 'center',
        background: style.background,
        borderColor: style.border,
        borderRadius: 8,
        color: style.text,
        display: 'inline-flex',
        fontSize: 13,
        fontWeight: 600,
        gap: 6,
        lineHeight: '28px',
        marginInlineEnd: 0,
        minHeight: 30,
        padding: '0 10px',
      }}
    >
      <span style={{ color: style.number, display: 'inline-flex', fontSize: 15 }}>{icon}</span>
      <span>{label}</span>
      <span style={{ color: style.number, fontSize: 16, fontWeight: 700 }}>{value}</span>
    </Tag>
  );
}

function rollbackSummaryTags(preview: RollbackPreview, overrideableCount: number) {
  const reportOnlyCount = Math.max(0, rollbackRiskCount(preview) - overrideableCount);
  return (
    <Space size={[8, 8]} wrap>
      {rollbackSummaryTag('当前状态', STATUS_LABELS[preview.batch.status] || '状态待确认', 'status', <ClockCircleOutlined />, '当前批次的撤回流程状态')}
      {rollbackSummaryTag('系统自动', preview.summary.rollbackableCount, 'auto', <CheckCircleOutlined />, '预检后可由系统直接处理的记录')}
      {rollbackSummaryTag('人工可选', overrideableCount, 'confirm', <ExclamationCircleOutlined />, '需要人工核对，确认后可勾选纳入撤回的记录')}
      {rollbackSummaryTag('仅出报告', reportOnlyCount, 'report', <FileTextOutlined />, '不能自动处理，只能下载报告后人工跟进的记录')}
      {rollbackSummaryTag('已撤回', preview.summary.rolledBackCount, 'done', <RollbackOutlined />, '已经完成软撤回、下架或作废的记录')}
    </Space>
  );
}

function previewWarningDescription(warnings: string[]) {
  return (
    <Space direction="vertical" size={2}>
      {warnings.map((item) => (
        <Typography.Text key={item}>{item}</Typography.Text>
      ))}
    </Space>
  );
}

function importStatsTags(batch: ImportBatch) {
  return (
    <Space size={[4, 4]} wrap>
      {countTag('新增', batch.createdCount, 'green')}
      {countTag('更新', batch.updatedCount, 'blue')}
      {countTag('跳过', batch.skippedCount)}
      {countTag('失败', batch.failedCount, batch.failedCount > 0 ? 'red' : undefined)}
    </Space>
  );
}

function successfulImportCount(batch: ImportBatch) {
  return batch.createdCount + batch.updatedCount;
}

function hasSuccessfulImportChanges(batch: ImportBatch) {
  return successfulImportCount(batch) > 0;
}

function hasRollbackEvaluation(batch: ImportBatch) {
  return batch.rollbackableCount + batch.conflictedCount + batch.blockedCount + batch.rolledBackCount > 0;
}

function rollbackEvaluationTags(batch: ImportBatch) {
  if (!hasSuccessfulImportChanges(batch)) {
    return (
      <Space size={[4, 4]} wrap>
        <Tag color={batch.failedCount > 0 ? 'red' : undefined}>{batch.failedCount > 0 ? '未写入业务数据' : '无新增/更新'}</Tag>
        {batch.failedCount > 0 ? countTag('导入失败', batch.failedCount, 'red') : null}
        {batch.skippedCount > 0 ? countTag('跳过', batch.skippedCount) : null}
      </Space>
    );
  }
  if (!batch.lastPrecheckedAt && batch.status !== 'ROLLBACK_PRECHECKED') {
    return <Tag>未预检</Tag>;
  }
  if (!hasRollbackEvaluation(batch)) {
    return (
      <Space size={[4, 4]} wrap>
        <Tag color="orange">暂无撤回明细</Tag>
        <Tag>可刷新预检</Tag>
      </Space>
    );
  }
  return (
    <Space size={[4, 4]} wrap>
      {countTag('可自动撤回', batch.rollbackableCount, batch.rollbackableCount > 0 ? 'green' : undefined)}
      {countTag('需人工确认', batch.conflictedCount + batch.blockedCount, batch.conflictedCount + batch.blockedCount > 0 ? 'orange' : undefined)}
      {countTag('已撤回', batch.rolledBackCount, batch.rolledBackCount > 0 ? 'blue' : undefined)}
    </Space>
  );
}

function rollbackRiskCount(preview: RollbackPreview) {
  return preview.summary.conflictedCount + preview.summary.blockedCount + preview.summary.failedCount;
}

function buildPreviewConclusion(preview: RollbackPreview): { type: 'success' | 'info' | 'warning' | 'error'; message: string; description: string } {
  const { summary } = preview;
  const riskCount = rollbackRiskCount(preview);
  const importedFailed = preview.batch.failedCount;
  const failedSuffix = importedFailed > 0 ? ` 本批次另有 ${importedFailed} 条导入失败，失败行不会进入撤回。` : '';

  if (summary.totalCount === 0 && !hasSuccessfulImportChanges(preview.batch)) {
    return {
      type: preview.batch.failedCount > 0 ? 'error' : 'info',
      message: preview.batch.failedCount > 0 ? '导入未写入业务数据' : '本批次没有新增或更新',
      description:
        preview.batch.failedCount > 0
          ? `本批次 ${preview.batch.failedCount} 条导入失败，没有产生可撤回的数据。失败原因需要在原导入任务的行记录或错误文件中查看。`
          : '本批次没有成功新增或更新业务数据，因此不需要撤回。',
    };
  }

  if (summary.totalCount === 0) {
    return {
      type: 'warning',
      message: '暂无撤回明细',
      description: '本批次有导入成功统计，但当前未匹配到可评估的撤回明细；可刷新预检后再核对原业务模块的导入结果。',
    };
  }

  if (summary.rolledBackCount > 0 && summary.rolledBackCount >= summary.totalCount) {
    return {
      type: 'success',
      message: `已完成撤回：${summary.rolledBackCount} 条已处理`,
      description: `本批次已没有待自动撤回的数据，可下载报告核对结果。${failedSuffix}`,
    };
  }

  if (summary.rollbackableCount > 0 && riskCount === 0) {
    return {
      type: 'success',
      message: `预检通过：${summary.rollbackableCount} 条可全部自动撤回`,
      description: `执行撤回后，相关挂牌或成果会下架，成交记录会作废；系统不会物理删除数据。${failedSuffix}`,
    };
  }

  if (summary.rollbackableCount > 0) {
    return {
      type: 'warning',
      message: `可部分撤回：${summary.rollbackableCount} 条可自动处理，${riskCount} 条需要人工确认`,
      description: `执行撤回只会处理可自动撤回项；冲突、阻断和失败项会保留在报告中。${failedSuffix}`,
    };
  }

  if (riskCount > 0) {
    return {
      type: 'error',
      message: `无法自动撤回：${riskCount} 条需要人工确认`,
      description: `当前没有可自动处理的数据，请根据下方明细和下载报告跟进冲突或阻断项。${failedSuffix}`,
    };
  }

  return {
    type: 'info',
    message: '暂无可撤回数据',
    description: `当前批次没有可自动处理的数据，可下载报告留存。${failedSuffix}`,
  };
}

function buildNoRollbackAction(preview: RollbackPreview): { type: 'success' | 'info' | 'warning'; message: string; description: string } {
  if (preview.summary.rolledBackCount > 0) {
    return {
      type: 'success',
      message: `本批次已撤回 ${preview.summary.rolledBackCount} 条数据`,
      description: '可下载报告核对已撤回、冲突和阻断项。',
    };
  }
  if (preview.summary.totalCount === 0 && !hasSuccessfulImportChanges(preview.batch)) {
    return {
      type: 'info',
      message: '没有可撤回的数据',
      description:
        preview.batch.failedCount > 0
          ? '本批次没有成功写入业务数据；失败原因需要回到原导入任务的行记录或错误文件中查看。'
          : '本批次没有新增或更新业务数据，因此不需要撤回。',
    };
  }
  if (preview.summary.totalCount === 0) {
    return {
      type: 'warning',
      message: '暂无撤回明细',
      description: '当前没有匹配到可评估的撤回明细；可刷新预检，仍为空时请核对原业务模块的导入结果。',
    };
  }
  return {
    type: 'info',
    message: '当前批次没有可自动撤回的数据',
    description: '请下载报告后人工处理冲突或阻断项。',
  };
}

function rollbackActionText(row: RollbackChangePreview) {
  if (row.rollbackStrategy === 'SOFT_OFF_SHELF') {
    if (row.entityType === 'LISTING') return '执行撤回后下架该挂牌，不删除记录。';
    if (row.entityType === 'ACHIEVEMENT') return '执行撤回后下架该成果，不删除记录。';
    if (row.entityType === 'USER_VERIFICATION') return '执行撤回后取消该技术经理人认证，账号和记录仍保留。';
    if (row.entityType === 'TECH_MANAGER_PROFILE') return '执行撤回后隐藏该技术经理人主页，不删除资料记录。';
    return '执行撤回后做软处理，不删除记录。';
  }
  if (row.rollbackStrategy === 'VOID') return '执行撤回后作废该记录，不删除记录。';
  if (row.rollbackStrategy === 'MANUAL_ONLY') return '系统不自动改动该数据，仅生成报告供人工处理。';
  return rollbackStrategyLabel(row.rollbackStrategy);
}

function rowHandlingText(row: RollbackChangePreview) {
  const reason = String(row.blockedReason || '').trim();
  if (row.rollbackStatus === 'ROLLBACKABLE') return rollbackActionText(row);
  if (row.overrideable) return `${reason || '导入后又被修改，需要人工确认。'} 核对后可勾选纳入本次撤回。`;
  if (row.rollbackStatus === 'CONFLICTED') return reason || '导入后又被修改，需要人工确认。';
  if (row.rollbackStatus === 'BLOCKED') return reason || '当前业务状态不允许自动撤回，需要人工处理。';
  if (row.rollbackStatus === 'ROLLED_BACK') return '已按撤回策略处理。';
  if (row.rollbackStatus === 'FAILED') return reason || '撤回执行失败，请下载报告排查。';
  if (row.rollbackStatus === 'SKIPPED') return reason || '该行已跳过。';
  return reason || '等待预检。';
}

function dependencyText(dependency?: Record<string, any> | null) {
  if (!dependency) return '';
  const labels: Record<string, string> = {
    orderCount: '订单',
    conversationCount: '会话',
    favoriteCount: '收藏',
    consultCount: '咨询',
    listingCount: '关联挂牌',
    claimRequestCount: '认领申请',
    dealRecordCount: '成交记录',
    maintenanceScheduleCount: '年费计划',
  };
  const parts = Object.entries(labels)
    .map(([key, label]) => ({ label, value: Number(dependency[key] || 0) }))
    .filter((item) => item.value > 0)
    .map((item) => `${item.label} ${item.value}`);
  return parts.length ? parts.join(' / ') : '';
}

function rollbackActionLabel(row: ImportBatch): { label: string; disabled: boolean; title?: string } {
  if (row.status === 'ROLLBACK_RUNNING') return { label: '撤回中', disabled: true, title: '批次正在撤回处理中' };
  if (row.rollbackAt || row.rolledBackCount > 0 || row.status === 'ROLLED_BACK' || row.status === 'PARTIALLY_ROLLED_BACK' || row.status === 'ROLLBACK_FAILED') {
    return { label: '查看结果', disabled: false, title: '查看本批次的撤回结果和未处理项' };
  }
  if (!hasSuccessfulImportChanges(row)) {
    return {
      label: '无可撤回',
      disabled: true,
      title:
        row.failedCount > 0
          ? '本批次没有成功写入业务数据，失败原因请到原导入任务查看'
          : '本批次没有新增或更新业务数据，不需要撤回',
    };
  }
  if (row.lastPrecheckedAt || row.status === 'ROLLBACK_PRECHECKED') {
    return { label: '刷新预检', disabled: false, title: '已做过撤回预检，再次点击会重新计算当前结果' };
  }
  return { label: '撤回预检', disabled: false, title: '先检查哪些数据可自动撤回、哪些需要人工确认' };
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
  const [overrideChangeIds, setOverrideChangeIds] = useState<string[]>([]);
  const [overrideReason, setOverrideReason] = useState('');

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
  const previewConclusion = useMemo(() => (activePreview ? buildPreviewConclusion(activePreview) : null), [activePreview]);
  const noRollbackAction = useMemo(() => (activePreview ? buildNoRollbackAction(activePreview) : null), [activePreview]);
  const overrideableChanges = useMemo(
    () => (activePreview?.changes || []).filter((item) => item.overrideable && item.rollbackStatus !== 'ROLLED_BACK'),
    [activePreview],
  );
  const selectedOverrideCount = overrideChangeIds.length;
  const plannedRollbackCount = (activePreview?.summary.rollbackableCount || 0) + selectedOverrideCount;

  const openPreview = useCallback(async (batch: ImportBatch) => {
    setActiveBatch(batch);
    setActivePreview(null);
    setDrawerOpen(true);
    setReason('');
    setConfirmationText('');
    setOverrideChangeIds([]);
    setOverrideReason('');
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
    if (selectedOverrideCount > 0 && !overrideReason.trim()) {
      message.warning('请填写人工确认说明');
      return;
    }
    if (!activePreview?.summary.rollbackableCount && selectedOverrideCount === 0) {
      message.warning('请选择要人工确认纳入撤回的数据');
      return;
    }
    setRollbackSubmitting(true);
    try {
      const res = await apiPost<RollbackPreview>(
        `/admin/import-batches/${batchId}/rollback`,
        {
          reason: reason.trim(),
          confirmationText: confirmationText.trim(),
          overrideChangeIds,
          overrideReason: selectedOverrideCount > 0 ? overrideReason.trim() : undefined,
        },
        { idempotencyKey: `import-batch-rollback-${batchId}-${Date.now()}`, retry: 1 },
      );
      setDrawerOpen(false);
      setActivePreview(null);
      setActiveBatch(null);
      setReason('');
      setConfirmationText('');
      setOverrideChangeIds([]);
      setOverrideReason('');
      message.success(`批次撤回已执行，已处理 ${res.summary.rolledBackCount} 条数据`);
      await load();
    } catch (e: any) {
      message.error(e?.message || '批次撤回失败');
    } finally {
      setRollbackSubmitting(false);
    }
  }, [
    activeBatch?.id,
    activePreview?.batch.id,
    activePreview?.summary.rollbackableCount,
    confirmationText,
    expectedConfirmation,
    load,
    overrideChangeIds,
    overrideReason,
    reason,
    selectedOverrideCount,
  ]);

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
      width: 260,
      render: (_: unknown, row: ImportBatch) => rollbackEvaluationTags(row),
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
      render: (_: unknown, row: ImportBatch) => {
        const action = rollbackActionLabel(row);
        return (
          <Tooltip title={action.title}>
            <span>
              <Button icon={<RollbackOutlined />} size="small" disabled={action.disabled} onClick={() => void openPreview(row)}>
                {action.label}
              </Button>
            </span>
          </Tooltip>
        );
      },
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
            <Tooltip title={activePreview && activePreview.summary.totalCount === 0 ? '当前没有撤回明细，暂不生成撤回报告' : '下载撤回明细和处理结果'}>
              <span>
                <Button
                  icon={<DownloadOutlined />}
                  loading={reportDownloading}
                  onClick={() => void downloadReport()}
                  disabled={!activePreview || activePreview.summary.totalCount === 0}
                >
                  下载报告
                </Button>
              </span>
            </Tooltip>
            <Button icon={<ReloadOutlined />} onClick={() => activeBatch && void openPreview(activeBatch)} loading={previewLoading} disabled={!activeBatch}>
              刷新预检
            </Button>
          </Space>
        }
      >
        {previewLoading && !activePreview ? <Card loading /> : null}

        {activePreview ? (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            {previewConclusion ? (
              <Alert type={previewConclusion.type} showIcon message={previewConclusion.message} description={previewConclusion.description} />
            ) : null}

            {rollbackSummaryTags(activePreview, overrideableChanges.length)}

            <Tabs
              defaultActiveKey="action"
              items={[
                {
                  key: 'action',
                  label: '处理',
                  children: (
                    <Space direction="vertical" size={16} style={{ width: '100%' }}>
                      {activePreview.warnings.length && rollbackRiskCount(activePreview) > 0 ? (
                        <Alert type="warning" showIcon message="预检提示" description={previewWarningDescription(activePreview.warnings)} />
                      ) : null}

                      {overrideableChanges.length > 0 ? (
                        <Card size="small" title="可人工确认纳入撤回">
                          <Space direction="vertical" size={12} style={{ width: '100%' }}>
                            <Alert
                              type="warning"
                              showIcon
                              message="以下项目默认不会自动处理"
                              description="它们在导入后又被修改过。请先核对后续修改是否可以放弃；确认后勾选，执行撤回时会一起下架，不会物理删除。"
                            />
                            <Table<RollbackChangePreview>
                              size="small"
                              rowKey="changeId"
                              pagination={false}
                              dataSource={overrideableChanges}
                              scroll={{ x: 760 }}
                              columns={[
                                {
                                  title: '纳入',
                                  width: 70,
                                  render: (_: unknown, row) => (
                                    <Checkbox
                                      checked={overrideChangeIds.includes(row.changeId)}
                                      onChange={(event) => {
                                        setOverrideChangeIds((prev) =>
                                          event.target.checked ? Array.from(new Set([...prev, row.changeId])) : prev.filter((id) => id !== row.changeId),
                                        );
                                      }}
                                    />
                                  ),
                                },
                                {
                                  title: '数据对象',
                                  width: 280,
                                  render: (_: unknown, row) => (
                                    <Space direction="vertical" size={2}>
                                      <Typography.Text strong>{row.entityLabel || row.entityId || '-'}</Typography.Text>
                                      <Typography.Text type="secondary">{ENTITY_LABELS[row.entityType] || '实体待确认'}</Typography.Text>
                                    </Space>
                                  ),
                                },
                                {
                                  title: '不能直接撤回的原因',
                                  render: (_: unknown, row) => row.blockedReason || '导入后又被修改，需要人工确认。',
                                },
                                {
                                  title: '勾选后的处理',
                                  width: 220,
                                  render: (_: unknown, row) => rollbackActionText(row),
                                },
                              ]}
                            />
                            <Input.TextArea
                              value={overrideReason}
                              onChange={(e) => setOverrideReason(e.target.value)}
                              placeholder="人工确认说明，例如：已核对后续修改不需要保留，同意纳入本次撤回"
                              autoSize={{ minRows: 2, maxRows: 4 }}
                              disabled={selectedOverrideCount === 0}
                            />
                          </Space>
                        </Card>
                      ) : null}

                      {activePreview.canRollback || overrideableChanges.length > 0 ? (
                        <Card size="small" title="执行撤回">
                          <Space direction="vertical" size={12} style={{ width: '100%' }}>
                            <Alert
                              type="warning"
                              showIcon
                              message={`本次将处理 ${plannedRollbackCount} 条数据`}
                              description={`系统可自动处理 ${activePreview.summary.rollbackableCount} 条；人工确认纳入 ${selectedOverrideCount} 条。未勾选或不可强制处理的冲突/阻断项不会被改动。`}
                            />
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
                              <Button
                                danger
                                type="primary"
                                icon={<RollbackOutlined />}
                                loading={rollbackSubmitting}
                                disabled={plannedRollbackCount <= 0}
                                onClick={() => void executeRollback()}
                              >
                                撤回可自动处理及已确认数据
                              </Button>
                            </Space>
                          </Space>
                        </Card>
                      ) : (
                        <Alert
                          type={noRollbackAction?.type || 'info'}
                          showIcon
                          message={noRollbackAction?.message || '当前批次没有可自动撤回的数据'}
                          description={noRollbackAction?.description || '请下载报告后人工处理冲突或阻断项。'}
                        />
                      )}
                    </Space>
                  ),
                },
                {
                  key: 'detail',
                  label: '明细',
                  children: (
                    <Space direction="vertical" size={16} style={{ width: '100%' }}>
                      <Card size="small" title="按数据类型汇总">
                        <Table
                          size="small"
                          rowKey="entityType"
                          pagination={false}
                          dataSource={activePreview.groups}
                          columns={[
                            {
                              title: '数据类型',
                              width: 120,
                              dataIndex: 'entityType',
                              render: (value: ImportEntityType) => <Tag>{ENTITY_LABELS[value] || '实体待确认'}</Tag>,
                            },
                            {
                              title: '导入影响',
                              render: (_: unknown, row) => (
                                <Space size={[4, 4]} wrap>
                                  {countTag('共', row.total)}
                                  {countTag('新增', row.created, row.created > 0 ? 'green' : undefined)}
                                  {countTag('更新', row.updated, row.updated > 0 ? 'blue' : undefined)}
                                </Space>
                              ),
                            },
                            {
                              title: '预检结果',
                              render: (_: unknown, row) => (
                                <Space size={[4, 4]} wrap>
                                  {countTag('可自动', row.rollbackable, row.rollbackable > 0 ? 'green' : undefined)}
                                  {countTag('冲突', row.conflicted, row.conflicted > 0 ? 'orange' : undefined)}
                                  {countTag('阻断', row.blocked, row.blocked > 0 ? 'red' : undefined)}
                                  {countTag('人工', row.manualOnly, row.manualOnly > 0 ? 'red' : undefined)}
                                  {countTag('已撤回', row.rolledBack, row.rolledBack > 0 ? 'blue' : undefined)}
                                </Space>
                              ),
                            },
                          ]}
                        />
                      </Card>

                      <Card size="small" title="逐行预检结果">
                        <Table<RollbackChangePreview>
                          size="small"
                          rowKey="changeId"
                          pagination={{ pageSize: 8 }}
                          dataSource={activePreview.changes}
                          scroll={{ x: 860 }}
                          columns={[
                            { title: '行号', dataIndex: 'rowNo', width: 70, render: (value) => value || '-' },
                            {
                              title: '数据对象',
                              width: 320,
                              render: (_: unknown, row) => (
                                <Space direction="vertical" size={2} style={{ maxWidth: '100%' }}>
                                  <Space size={[4, 4]} wrap>
                                    <Tag>{ENTITY_LABELS[row.entityType] || '实体待确认'}</Tag>
                                    <Typography.Text strong>{row.entityLabel || row.entityId || '-'}</Typography.Text>
                                  </Space>
                                  {row.entityId ? (
                                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                                      {row.entityId}
                                    </Typography.Text>
                                  ) : null}
                                </Space>
                              ),
                            },
                            {
                              title: '导入动作',
                              width: 100,
                              dataIndex: 'operation',
                              render: (value: string) => importChangeOperationLabel(value),
                            },
                            {
                              title: '预检结果',
                              dataIndex: 'rollbackStatus',
                              width: 140,
                              render: (value: RollbackStatus) => rollbackStatusTag(value),
                            },
                            {
                              title: '处理说明',
                              render: (_: unknown, row) => {
                                const depText = dependencyText(row.dependency);
                                return (
                                  <Space direction="vertical" size={2}>
                                    <Typography.Text>{rowHandlingText(row)}</Typography.Text>
                                    {depText ? <Typography.Text type="secondary">关联业务：{depText}</Typography.Text> : null}
                                  </Space>
                                );
                              },
                            },
                          ]}
                        />
                      </Card>
                    </Space>
                  ),
                },
                {
                  key: 'batch',
                  label: '批次',
                  children: (
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
                      <Descriptions.Item label="导入结果" span={2}>
                        {importStatsTags(activePreview.batch)}
                      </Descriptions.Item>
                      <Descriptions.Item label="撤回评估" span={2}>
                        <Space size={[4, 4]} wrap>
                          {countTag('可自动撤回', activePreview.summary.rollbackableCount, activePreview.summary.rollbackableCount > 0 ? 'green' : undefined)}
                          {countTag('冲突', activePreview.summary.conflictedCount, activePreview.summary.conflictedCount > 0 ? 'orange' : undefined)}
                          {countTag('阻断/人工处理', activePreview.summary.blockedCount, activePreview.summary.blockedCount > 0 ? 'red' : undefined)}
                          {countTag('已撤回', activePreview.summary.rolledBackCount, activePreview.summary.rolledBackCount > 0 ? 'blue' : undefined)}
                        </Space>
                      </Descriptions.Item>
                    </Descriptions>
                  ),
                },
              ]}
            />
          </Space>
        ) : null}
      </Drawer>
    </Space>
  );
}
