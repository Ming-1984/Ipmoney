import {
  Button,
  Card,
  Col,
  Descriptions,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Segmented,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  Upload,
  message,
} from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { components } from '@ipmoney/api-types';

import { apiGet, apiPatch, apiPost, apiUploadFile } from '../lib/api';
import { fenToYuan, fenToYuanNumber, formatTimeSmart, yuanToFen } from '../lib/format';
import { displayAdminInfo, normalizeUserFacingText } from '../lib/userFacingText';
import {
  DEFAULT_LISTING_TOPIC_OPTIONS,
  fetchAdminListingTopicOptions,
  topicLabelFromOptions,
} from '../lib/homeLandingConfig';
import { auditStatusLabel, listingStatusLabel, tradeModeLabel } from '../lib/labels';
import { RequestErrorAlert } from '../ui/RequestState';
import { confirmActionWithReason } from '../ui/confirm';

type AuditStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
type ListingStatus = 'DRAFT' | 'ACTIVE' | 'OFF_SHELF' | 'SOLD';
type ListingTopic = components['schemas']['ListingTopic'];
type ContentSource = 'USER' | 'ADMIN' | 'PLATFORM';
type BatchAction = 'APPROVE' | 'REJECT' | 'PUBLISH' | 'OFF_SHELF';
type JobStatus = 'PENDING' | 'RUNNING' | 'PAUSED' | 'SUCCEEDED' | 'FAILED';
type BatchItemStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'SKIPPED';
type ImportDuplicatePolicy = 'SKIP' | 'OVERWRITE';
type ImportRowStatus = 'PENDING' | 'VALID' | 'INVALID' | 'SUCCEEDED' | 'FAILED' | 'SKIPPED';

type PageMeta = { page: number; pageSize: number; total: number };
type Paged<T> = { items: T[]; page: PageMeta };

type StaffUser = {
  id: string;
  name?: string;
  email?: string;
};

type StaffUserListResponse = {
  items?: StaffUser[];
};

type Listing = {
  id: string;
  title: string;
  summary?: string | null;
  source?: ContentSource;
  patentId?: string | null;
  applicationNoDisplay?: string | null;
  publicationNoDisplay?: string | null;
  patentNoDisplay?: string | null;
  grantPublicationNoDisplay?: string | null;
  patentType?: string | null;
  inventorNames?: string[];
  assigneeNames?: string[];
  applicantNames?: string[];
  ipcCodes?: string[];
  locCodes?: string[];
  proofFileIds?: string[];
  proofFiles?: Array<{
    id: string;
    fileName?: string | null;
    mimeType?: string | null;
    moderationStatus?: string | null;
    moderationLabel?: string | null;
    moderationReason?: string | null;
    createdAt: string;
  }>;
  deliverables?: string[];
  industryTags?: string[];
  auditStatus: AuditStatus;
  status: ListingStatus;
  tradeMode: 'ASSIGNMENT' | 'LICENSE';
  licenseMode?: 'EXCLUSIVE' | 'SOLE' | 'NON_EXCLUSIVE' | null;
  priceType?: 'FIXED' | 'NEGOTIABLE';
  priceAmountFen?: number | null;
  depositAmountFen?: number | null;
  regionCode?: string;
  listingTopics?: ListingTopic[];
  createdAt: string;
  updatedAt: string;
};

type BatchJob = {
  id: string;
  action: BatchAction;
  status: JobStatus;
  reason?: string | null;
  totalCount: number;
  successCount: number;
  failedCount: number;
  skippedCount: number;
  failRate: number;
  errorFileId?: string | null;
  createdAt: string;
  updatedAt: string;
};

type BatchJobItem = {
  id: string;
  listingId: string;
  status: BatchItemStatus;
  errorCode?: string | null;
  errorMessage?: string | null;
  processedAt?: string | null;
};

type ImportJob = {
  id: string;
  fileId: string;
  status: JobStatus;
  duplicatePolicy: ImportDuplicatePolicy;
  totalCount: number;
  validCount: number;
  invalidCount: number;
  successCount: number;
  failedCount: number;
  skippedCount: number;
  failRate: number;
  errorFileId?: string | null;
  createdAt: string;
};

type ImportRow = {
  id: string;
  rowNo: number;
  status: ImportRowStatus;
  listingId?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  raw?: Record<string, any>;
  normalized?: Record<string, any> | null;
};

type ListingEditFormValues = {
  priceType?: 'FIXED' | 'NEGOTIABLE';
  priceAmountYuan?: number | null;
  depositAmountYuan?: number | null;
};

const priceTypeOptions: Array<{ value: 'FIXED' | 'NEGOTIABLE'; label: string }> = [
  { value: 'NEGOTIABLE', label: '面议' },
  { value: 'FIXED', label: '固定价' },
];

function actionLabel(action: BatchAction) {
  if (action === 'APPROVE') return '批量通过';
  if (action === 'REJECT') return '批量驳回';
  if (action === 'PUBLISH') return '批量上架';
  return '批量下架';
}

function duplicatePolicyLabel(policy?: ImportDuplicatePolicy | null): string {
  if (policy === 'OVERWRITE') return '覆盖更新';
  if (policy === 'SKIP') return '跳过重复';
  return '策略待确认';
}

function jobStatusLabel(status?: JobStatus | BatchItemStatus | ImportRowStatus | null): string {
  const text = String(status || '').trim().toUpperCase();
  if (text === 'PENDING') return '待处理';
  if (text === 'RUNNING') return '执行中';
  if (text === 'PAUSED') return '已暂停';
  if (text === 'SUCCEEDED') return '已完成';
  if (text === 'FAILED') return '失败';
  if (text === 'SKIPPED') return '已跳过';
  if (text === 'VALID') return '校验通过';
  if (text === 'INVALID') return '校验失败';
  return '状态待确认';
}

function statusTag(status: JobStatus | BatchItemStatus | ImportRowStatus) {
  const text = String(status || '');
  const label = jobStatusLabel(status);
  if (text === 'SUCCEEDED' || text === 'VALID') return <Tag color="green">{label}</Tag>;
  if (text === 'FAILED' || text === 'INVALID') return <Tag color="red">{label}</Tag>;
  if (text === 'RUNNING') return <Tag color="blue">{label}</Tag>;
  if (text === 'PAUSED') return <Tag color="orange">{label}</Tag>;
  if (text === 'SKIPPED') return <Tag>{label}</Tag>;
  return <Tag>{label}</Tag>;
}

function summarizeImportValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? '是' : '否';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  if (Array.isArray(value)) {
    return value
      .map((item) => summarizeImportValue(item))
      .filter(Boolean)
      .join('、');
  }
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => {
        const text = summarizeImportValue(item);
        return text ? `${key}：${text}` : '';
      })
      .filter(Boolean)
      .join('；');
  }
  return normalizeUserFacingText(value);
}

function importRowNormalizedSummary(value: Record<string, any> | null | undefined): string {
  if (!value) return '';
  const fields: Array<[string, unknown]> = [
    ['标题', value.title],
    ['申请号', value.applicationNoDisplay || value.applicationNoNorm],
    ['地区', value.regionCode],
    ['交易模式', value.tradeMode],
    ['价格方式', value.priceType],
    ['专题标签', value.listingTopics],
  ];
  const summary = fields
    .map(([label, raw]) => {
      const text = summarizeImportValue(raw);
      return text ? `${label}：${text}` : '';
    })
    .filter(Boolean)
    .join('；');
  return summary || '已生成标准化字段';
}

function batchJobSummary(job: BatchJob): string {
  return `总 ${job.totalCount} / 成功 ${job.successCount} / 失败 ${job.failedCount} / 跳过 ${job.skippedCount}`;
}

function importJobSummary(job: ImportJob): string {
  return `总 ${job.totalCount} / 有效 ${job.validCount} / 无效 ${job.invalidCount} / 成功 ${job.successCount} / 失败 ${job.failedCount} / 跳过 ${job.skippedCount}`;
}

function staffDisplayName(user: StaffUser | null | undefined, fallback = '未命名员工'): string {
  return normalizeUserFacingText(user?.name) || normalizeUserFacingText(user?.email) || fallback;
}

function displayText(value: unknown, fallback = '-'): string {
  return normalizeUserFacingText(value) || fallback;
}

function displayList(value: unknown, fallback = '-'): string {
  const items = Array.isArray(value) ? value.map((item) => normalizeUserFacingText(item)).filter(Boolean) : [];
  return items.length ? items.join('、') : fallback;
}

function licenseModeLabel(value?: Listing['licenseMode']): string {
  if (value === 'EXCLUSIVE') return '独占许可';
  if (value === 'SOLE') return '排他许可';
  if (value === 'NON_EXCLUSIVE') return '普通许可';
  return '-';
}

function priceDisplay(row?: Listing | null): string {
  if (!row) return '-';
  if (row.priceType === 'FIXED') return row.priceAmountFen == null ? '一口价待确认' : `一口价 ¥${fenToYuan(row.priceAmountFen)}`;
  return '面议';
}

function listingAuditStatusText(row: Listing): string {
  if (row.status === 'DRAFT') return listingStatusLabel(row.status);
  if (row.auditStatus === 'PENDING') return '待审核，审核通过后上架';
  return listingStatusLabel(row.status);
}

function fileModerationLabel(status?: string | null): string {
  const text = String(status || '').trim().toUpperCase();
  if (text === 'APPROVED') return '已通过';
  if (text === 'PENDING') return '待审核';
  if (text === 'REJECTED') return '已驳回';
  if (text === 'NOT_REQUIRED') return '无需审核';
  return '状态待确认';
}

function translateApiMessage(message: string): string {
  const text = String(message || '').trim();
  if (!text) return '操作失败';
  if (text.includes('media moderation is not approved')) return '权属材料内容审核未通过，无法通过挂牌';
  if (text.includes('contains prohibited media')) return '权属材料包含违规图片，已被驳回';
  if (text.includes('is still under review')) return '权属材料仍在审核中';
  if (text.includes('reason must not be empty')) return '请填写驳回原因';
  if (text === 'Resource not found.') return '资源不存在';
  if (text === 'Authentication required or session expired.') return '登录状态已过期，请重新登录';
  if (text === 'Request failed. Please try again later.') return '请求失败，请稍后重试';
  return text;
}

function listingHasRejectedProofFiles(row?: Listing | null): boolean {
  if (!row?.proofFiles?.length) return false;
  return row.proofFiles.some((file) => {
    const status = String(file.moderationStatus || '').trim().toUpperCase();
    return status === 'REJECTED';
  });
}

function listingRejectedProofFiles(row?: Listing | null): Array<NonNullable<Listing['proofFiles']>[number]> {
  if (!row?.proofFiles?.length) return [];
  return row.proofFiles.filter((file) => {
    const status = String(file.moderationStatus || '').trim().toUpperCase();
    return status === 'REJECTED';
  });
}

export function ListingsAuditPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown | null>(null);
  const [listings, setListings] = useState<Paged<Listing> | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [draftQ, setDraftQ] = useState('');
  const [draftAuditStatus, setDraftAuditStatus] = useState<AuditStatus | ''>('');
  const [draftStatus, setDraftStatus] = useState<ListingStatus | ''>('');
  const [draftListingTopic, setDraftListingTopic] = useState<ListingTopic | ''>('');
  const [draftSource, setDraftSource] = useState<ContentSource | ''>('');
  const [appliedQ, setAppliedQ] = useState('');
  const [appliedAuditStatus, setAppliedAuditStatus] = useState<AuditStatus | ''>('');
  const [appliedStatus, setAppliedStatus] = useState<ListingStatus | ''>('');
  const [appliedListingTopic, setAppliedListingTopic] = useState<ListingTopic | ''>('');
  const [appliedSource, setAppliedSource] = useState<ContentSource | ''>('');
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [viewMode, setViewMode] = useState<'REVIEW' | 'DRAFTS'>('REVIEW');
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeListing, setActiveListing] = useState<Listing | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editForm] = Form.useForm<ListingEditFormValues>();

  const [batchJobsLoading, setBatchJobsLoading] = useState(false);
  const [batchJobs, setBatchJobs] = useState<Paged<BatchJob> | null>(null);
  const [batchJobsPage, setBatchJobsPage] = useState(1);
  const [batchJobsPageSize, setBatchJobsPageSize] = useState(20);
  const [activeBatchJob, setActiveBatchJob] = useState<BatchJob | null>(null);
  const [batchItemsLoading, setBatchItemsLoading] = useState(false);
  const [batchItems, setBatchItems] = useState<Paged<BatchJobItem> | null>(null);
  const [batchItemsPage, setBatchItemsPage] = useState(1);
  const [batchItemsPageSize, setBatchItemsPageSize] = useState(20);
  const [batchDrawerOpen, setBatchDrawerOpen] = useState(false);

  const [importing, setImporting] = useState(false);
  const [uploadFileList, setUploadFileList] = useState<any[]>([]);
  const [duplicatePolicy, setDuplicatePolicy] = useState<ImportDuplicatePolicy>('SKIP');
  const [importSellerUserId, setImportSellerUserId] = useState('');
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [importRegionCode, setImportRegionCode] = useState('');
  const [importTradeMode, setImportTradeMode] = useState<'' | 'ASSIGNMENT' | 'LICENSE'>('');
  const [importPriceType, setImportPriceType] = useState<'' | 'NEGOTIABLE' | 'FIXED'>('');
  const [importDepositAmountYuan, setImportDepositAmountYuan] = useState<number | null>(null);
  const [importListingTopics, setImportListingTopics] = useState<ListingTopic[]>([]);
  const [listingTopicOptions, setListingTopicOptions] =
    useState<Array<{ value: ListingTopic; label: string }>>(DEFAULT_LISTING_TOPIC_OPTIONS);

  const [importJobsLoading, setImportJobsLoading] = useState(false);
  const [importJobs, setImportJobs] = useState<Paged<ImportJob> | null>(null);
  const [importJobsPage, setImportJobsPage] = useState(1);
  const [importJobsPageSize, setImportJobsPageSize] = useState(20);
  const [activeImportJob, setActiveImportJob] = useState<ImportJob | null>(null);
  const [importRowsLoading, setImportRowsLoading] = useState(false);
  const [importRows, setImportRows] = useState<Paged<ImportRow> | null>(null);
  const [importRowsPage, setImportRowsPage] = useState(1);
  const [importRowsPageSize, setImportRowsPageSize] = useState(20);
  const [importDrawerOpen, setImportDrawerOpen] = useState(false);
  const [autoRefreshImportJobIds, setAutoRefreshImportJobIds] = useState<string[]>([]);

  const selectedListingIds = useMemo(
    () => selectedRowKeys.map((it) => String(it)).filter(Boolean),
    [selectedRowKeys],
  );
  const selectedListings = useMemo(
    () => {
      const rowMap = new Map((listings?.items || []).map((row) => [row.id, row]));
      return selectedListingIds.map((id) => rowMap.get(id)).filter(Boolean) as Listing[];
    },
    [listings?.items, selectedListingIds],
  );
  const selectedPublishBlocked = useMemo(
    () => selectedListings.some((row) => row.status === 'DRAFT' || row.auditStatus !== 'APPROVED'),
    [selectedListings],
  );
  const isDraftMode = viewMode === 'DRAFTS';

  const loadListings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<Paged<Listing>>('/admin/listings', {
        page,
        pageSize,
        q: appliedQ.trim() || undefined,
        auditStatus: isDraftMode ? undefined : appliedAuditStatus || undefined,
        status: isDraftMode ? 'DRAFT' : appliedStatus || undefined,
        excludeStatus: isDraftMode ? undefined : !appliedStatus ? 'DRAFT' : undefined,
        source: appliedSource || undefined,
        listingTopic: appliedListingTopic || undefined,
      });
      setListings(data);
    } catch (e: any) {
      setError(e);
      setListings(null);
      message.error(e?.message || '加载挂牌列表失败');
    } finally {
      setLoading(false);
    }
  }, [appliedAuditStatus, appliedListingTopic, appliedQ, appliedSource, appliedStatus, isDraftMode, page, pageSize]);

  const loadBatchJobs = useCallback(async (opts?: { page?: number; pageSize?: number }) => {
    const nextPage = opts?.page ?? batchJobsPage;
    const nextPageSize = opts?.pageSize ?? batchJobsPageSize;
    setBatchJobsLoading(true);
    try {
      const data = await apiGet<Paged<BatchJob>>('/admin/listings/jobs/batch', {
        page: nextPage,
        pageSize: nextPageSize,
      });
      setBatchJobs(data);
    } catch (e: any) {
      message.error(e?.message || '加载批量任务失败');
      setBatchJobs(null);
    } finally {
      setBatchJobsLoading(false);
    }
  }, [batchJobsPage, batchJobsPageSize]);

  const loadImportJobs = useCallback(async (opts?: { page?: number; pageSize?: number }) => {
    const nextPage = opts?.page ?? importJobsPage;
    const nextPageSize = opts?.pageSize ?? importJobsPageSize;
    setImportJobsLoading(true);
    try {
      const data = await apiGet<Paged<ImportJob>>('/admin/listings/jobs/import', {
        page: nextPage,
        pageSize: nextPageSize,
      });
      setImportJobs(data);
    } catch (e: any) {
      message.error(e?.message || '加载导入任务失败');
      setImportJobs(null);
    } finally {
      setImportJobsLoading(false);
    }
  }, [importJobsPage, importJobsPageSize]);

  useEffect(() => {
    void loadListings();
  }, [loadListings]);

  useEffect(() => {
    void loadBatchJobs();
  }, [batchJobsPage, batchJobsPageSize, loadBatchJobs]);

  useEffect(() => {
    void loadImportJobs();
  }, [importJobsPage, importJobsPageSize, loadImportJobs]);

  useEffect(() => {
    setSelectedRowKeys([]);
  }, [appliedAuditStatus, appliedListingTopic, appliedQ, appliedSource, appliedStatus, page, pageSize]);

  useEffect(() => {
    (async () => {
      const options = await fetchAdminListingTopicOptions();
      setListingTopicOptions(options);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiGet<StaffUserListResponse>('/admin/rbac/users', { scope: 'STAFF' });
        setStaffUsers(Array.isArray(res?.items) ? res.items : []);
      } catch {
        setStaffUsers([]);
      }
    })();
  }, []);

  const enabledTopicSet = useMemo(
    () => new Set<ListingTopic>(listingTopicOptions.map((item) => item.value)),
    [listingTopicOptions],
  );

  useEffect(() => {
    setDraftListingTopic((prev) => (prev && !enabledTopicSet.has(prev) ? '' : prev));
    setAppliedListingTopic((prev) => (prev && !enabledTopicSet.has(prev) ? '' : prev));
    setImportListingTopics((prev) => prev.filter((topic) => enabledTopicSet.has(topic)));
  }, [enabledTopicSet]);

  const topicLabel = useCallback(
    (topic?: ListingTopic | null) => topicLabelFromOptions(topic, listingTopicOptions),
    [listingTopicOptions],
  );

  const staffOptions = useMemo(
    () =>
      staffUsers.map((user) => ({
        value: user.id,
        label: staffDisplayName(user),
      })),
    [staffUsers],
  );

  const applyFilters = useCallback(() => {
    setPage(1);
    setAppliedQ(draftQ);
    setAppliedAuditStatus(draftAuditStatus);
    setAppliedStatus(draftStatus);
    setAppliedListingTopic(draftListingTopic);
    setAppliedSource(draftSource);
  }, [draftAuditStatus, draftListingTopic, draftQ, draftSource, draftStatus]);

  const resetFilters = useCallback(() => {
    setPage(1);
    setDraftQ('');
    setDraftAuditStatus('');
    setDraftStatus('');
    setDraftListingTopic('');
    setDraftSource('');
    setAppliedQ('');
    setAppliedAuditStatus('');
    setAppliedStatus('');
    setAppliedListingTopic('');
    setAppliedSource('');
    setViewMode('REVIEW');
  }, []);

  const openFileById = useCallback(async (fileId?: string | null) => {
    if (!fileId) {
      message.warning('任务暂无错误文件');
      return;
    }
    try {
      const temp = await apiPost<{ url: string }>(`/files/${fileId}/temporary-access`, {
        scope: 'download',
      });
      if (!temp?.url) throw new Error('empty url');
      window.open(temp.url, '_blank', 'noopener,noreferrer');
    } catch (e: any) {
      message.error(translateApiMessage(e?.message || '下载错误文件失败'));
    }
  }, []);

  const openListingDetail = useCallback(async (row: Listing) => {
    setDetailOpen(true);
    setActiveListing(row);
    setDetailLoading(true);
    try {
      const detail = await apiGet<Listing>(`/admin/listings/${row.id}`);
      setActiveListing(detail);
    } catch (e: any) {
      message.error(translateApiMessage(e?.message || '加载挂牌详情失败'));
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const openListingEdit = useCallback(() => {
    if (!activeListing) return;
    editForm.setFieldsValue({
      priceType: activeListing.priceType || 'NEGOTIABLE',
      priceAmountYuan: activeListing.priceAmountFen == null ? undefined : fenToYuanNumber(activeListing.priceAmountFen),
      depositAmountYuan: activeListing.depositAmountFen == null ? 0 : fenToYuanNumber(activeListing.depositAmountFen),
    });
    setEditOpen(true);
  }, [activeListing, editForm]);

  const submitListingEdit = useCallback(async () => {
    if (!activeListing) return;
    try {
      const values = await editForm.validateFields();
      const payload: Record<string, unknown> = {
        priceType: values.priceType || 'NEGOTIABLE',
        depositAmountFen: yuanToFen(values.depositAmountYuan ?? 0),
      };
      if ((values.priceType || 'NEGOTIABLE') === 'FIXED') {
        if (values.priceAmountYuan == null) {
          message.error('固定价需要填写价格');
          return;
        }
        payload.priceAmountFen = yuanToFen(values.priceAmountYuan);
      } else {
        payload.priceAmountFen = null;
      }

      setEditSubmitting(true);
      await apiPatch(
        `/admin/listings/${activeListing.id}`,
        payload,
        { idempotencyKey: `admin-listing-price-edit-${activeListing.id}-${Date.now()}` },
      );
      message.success('挂牌价格已更新');
      setEditOpen(false);
      const detail = await apiGet<Listing>(`/admin/listings/${activeListing.id}`);
      setActiveListing(detail);
      await loadListings();
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error(translateApiMessage(e?.message || '更新挂牌价格失败'));
    } finally {
      setEditSubmitting(false);
    }
  }, [activeListing, editForm, loadListings]);

  const updateFileModeration = useCallback(
    async (fileId: string, status: 'APPROVED' | 'REJECTED') => {
      const reason =
        status === 'REJECTED'
          ? window.prompt('请输入驳回原因')?.trim()
          : window.prompt('可选：请输入通过备注（可留空）')?.trim();
      if (status === 'REJECTED' && !reason) {
        message.error('请填写驳回原因');
        return;
      }
      try {
        await apiPost(
          `/admin/files/${fileId}/moderation`,
          {
            status,
            reason: reason || undefined,
          },
          { idempotencyKey: `admin-file-moderation-${fileId}-${status}-${Date.now()}` },
        );
        message.success(status === 'APPROVED' ? '材料已标记为通过' : '材料已标记为驳回');
        if (activeListing) {
          const detail = await apiGet<Listing>(`/admin/listings/${activeListing.id}`);
          setActiveListing(detail);
        }
        await loadListings();
      } catch (e: any) {
        message.error(translateApiMessage(e?.message || '更新材料审核状态失败'));
      }
    },
    [activeListing, loadListings],
  );

  const submitBatchAction = useCallback(
    async (action: BatchAction) => {
      if (!selectedListingIds.length) {
        message.warning('请先选择需要操作的挂牌');
        return;
      }
      if (action === 'PUBLISH' && selectedPublishBlocked) {
        message.error('选中的挂牌包含草稿或未审核通过项，不能直接上架');
        return;
      }
      const reason = window.prompt('可选：请输入批量操作备注（可留空）')?.trim();
      try {
        await apiPost<BatchJob>(
          '/admin/listings/jobs/batch',
          {
            action,
            listingIds: selectedListingIds,
            reason: reason || undefined,
          },
          {
            idempotencyKey: `admin-listing-batch-${action}-${Date.now()}`,
          },
        );
        message.success(`${actionLabel(action)}任务已创建`);
        setSelectedRowKeys([]);
        await Promise.all([loadBatchJobs(), loadListings()]);
      } catch (e: any) {
        message.error(e?.message || '创建批量任务失败');
      }
    },
    [loadBatchJobs, loadListings, selectedListingIds, selectedPublishBlocked],
  );

  const approveListing = useCallback(
    async (row: Listing) => {
      const title = normalizeUserFacingText(row.title) || row.id;
      const { ok, reason } = await confirmActionWithReason({
        title: '确认通过挂牌审核？',
        content: (
          <Space direction="vertical" size={4}>
            <Typography.Text>挂牌：{title}</Typography.Text>
            <Typography.Text type="secondary">系统会一并处理当前待审核的权属材料。</Typography.Text>
          </Space>
        ),
        okText: '通过',
        reasonLabel: '审核备注（可选）',
        reasonPlaceholder: '可填写通过原因或备注，便于审计和后续对账。',
      });
      if (!ok) return;
      if (listingHasRejectedProofFiles(row)) {
        const blocked = listingRejectedProofFiles(row);
        const reasonText = blocked
          .map((file) => `${file.fileName || file.id}：${fileModerationLabel(file.moderationStatus)}${file.moderationReason ? `，${file.moderationReason}` : ''}`)
          .join('；');
        message.error(reasonText ? `当前权属材料存在驳回项：${reasonText}` : '当前权属材料存在驳回项，不能通过挂牌');
        return;
      }

      try {
        await apiPost(
          `/admin/listings/${row.id}/approve`,
          { reason: reason || undefined },
          { idempotencyKey: `admin-listing-approve-${row.id}-${Date.now()}` },
        );
        message.success('挂牌已通过审核');
        setSelectedRowKeys((prev) => prev.filter((key) => String(key) !== row.id));
        setDetailOpen(false);
        await loadListings();
      } catch (e: any) {
        message.error(translateApiMessage(e?.message || '通过审核失败'));
      }
    },
    [loadListings],
  );

  const rejectListing = useCallback(
    async (row: Listing) => {
      const title = normalizeUserFacingText(row.title) || row.id;
      const { ok, reason } = await confirmActionWithReason({
        title: '确认驳回挂牌审核？',
        content: `挂牌：${title}`,
        okText: '驳回',
        reasonRequired: true,
        reasonLabel: '驳回原因',
        reasonPlaceholder: '请填写驳回原因，便于用户修改后重新提交。',
        danger: true,
      });
      if (!ok) return;
      if (!reason) {
        message.error('驳回必须填写原因');
        return;
      }

      try {
        await apiPost(
          `/admin/listings/${row.id}/reject`,
          { reason },
          { idempotencyKey: `admin-listing-reject-${row.id}-${Date.now()}` },
        );
        message.success('挂牌已驳回');
        setSelectedRowKeys((prev) => prev.filter((key) => String(key) !== row.id));
        setDetailOpen(false);
        await loadListings();
      } catch (e: any) {
        message.error(translateApiMessage(e?.message || '驳回审核失败'));
      }
    },
    [loadListings],
  );

  const openBatchJobItems = useCallback(async (job: BatchJob) => {
    setBatchDrawerOpen(true);
    setActiveBatchJob(job);
    setBatchItemsPage(1);
    setBatchItemsPageSize(20);
    setBatchItems(null);
    setBatchItemsLoading(true);
    try {
      const data = await apiGet<Paged<BatchJobItem>>(`/admin/listings/jobs/batch/${job.id}/items`, {
        page: 1,
        pageSize: 20,
      });
      setBatchItems(data);
    } catch (e: any) {
      message.error(e?.message || '加载批量任务明细失败');
      setBatchItems(null);
    } finally {
      setBatchItemsLoading(false);
    }
  }, []);

  const loadBatchJobItems = useCallback(
    async (job: BatchJob, opts?: { page?: number; pageSize?: number }) => {
      const nextPage = opts?.page ?? batchItemsPage;
      const nextPageSize = opts?.pageSize ?? batchItemsPageSize;
      setBatchItemsLoading(true);
      try {
        const data = await apiGet<Paged<BatchJobItem>>(`/admin/listings/jobs/batch/${job.id}/items`, {
          page: nextPage,
          pageSize: nextPageSize,
        });
        setBatchItems(data);
      } catch (e: any) {
        message.error(e?.message || '加载批量任务明细失败');
        setBatchItems(null);
      } finally {
        setBatchItemsLoading(false);
      }
    },
    [batchItemsPage, batchItemsPageSize],
  );

  const openImportJobRows = useCallback(async (job: ImportJob) => {
    setImportDrawerOpen(true);
    setActiveImportJob(job);
    setImportRowsPage(1);
    setImportRowsPageSize(20);
    setImportRows(null);
    setImportRowsLoading(true);
    try {
      const data = await apiGet<Paged<ImportRow>>(`/admin/listings/jobs/import/${job.id}/rows`, {
        page: 1,
        pageSize: 20,
      });
      setImportRows(data);
    } catch (e: any) {
      message.error(e?.message || '加载导入明细失败');
      setImportRows(null);
    } finally {
      setImportRowsLoading(false);
    }
  }, []);

  const loadImportJobRows = useCallback(
    async (job: ImportJob, opts?: { page?: number; pageSize?: number }) => {
      const nextPage = opts?.page ?? importRowsPage;
      const nextPageSize = opts?.pageSize ?? importRowsPageSize;
      setImportRowsLoading(true);
      try {
        const data = await apiGet<Paged<ImportRow>>(`/admin/listings/jobs/import/${job.id}/rows`, {
          page: nextPage,
          pageSize: nextPageSize,
        });
        setImportRows(data);
      } catch (e: any) {
        message.error(e?.message || '加载导入明细失败');
        setImportRows(null);
      } finally {
        setImportRowsLoading(false);
      }
    },
    [importRowsPage, importRowsPageSize],
  );

  useEffect(() => {
    if (!autoRefreshImportJobIds.length) return;
    const timer = window.setInterval(() => {
      void loadImportJobs();
      if (activeImportJob && importDrawerOpen) {
        void loadImportJobRows(activeImportJob, { page: importRowsPage, pageSize: importRowsPageSize });
      }
    }, 4000);
    return () => window.clearInterval(timer);
  }, [
    activeImportJob,
    autoRefreshImportJobIds.length,
    importDrawerOpen,
    importRowsPage,
    importRowsPageSize,
    loadImportJobRows,
    loadImportJobs,
  ]);

  useEffect(() => {
    if (!autoRefreshImportJobIds.length || !importJobs?.items?.length) return;
    const runningIds = new Set(
      importJobs.items
        .filter((job) => autoRefreshImportJobIds.includes(job.id))
        .filter((job) => job.status === 'PENDING' || job.status === 'RUNNING' || job.status === 'PAUSED')
        .map((job) => job.id),
    );
    if (runningIds.size === autoRefreshImportJobIds.length) return;
    setAutoRefreshImportJobIds(Array.from(runningIds));
  }, [autoRefreshImportJobIds, importJobs]);

  useEffect(() => {
    if (!activeBatchJob || !batchDrawerOpen) return;
    void loadBatchJobItems(activeBatchJob, { page: batchItemsPage, pageSize: batchItemsPageSize });
  }, [activeBatchJob, batchDrawerOpen, batchItemsPage, batchItemsPageSize, loadBatchJobItems]);

  useEffect(() => {
    if (!activeImportJob || !importDrawerOpen) return;
    void loadImportJobRows(activeImportJob, { page: importRowsPage, pageSize: importRowsPageSize });
  }, [activeImportJob, importDrawerOpen, importRowsPage, importRowsPageSize, loadImportJobRows]);

  const runImport = useCallback(async () => {
    const file = uploadFileList?.[0]?.originFileObj as File | undefined;
    if (!file) {
      message.warning('请先上传导入文件');
      return;
    }
    setImporting(true);
    try {
      const uploaded = await apiUploadFile(file, 'DOCUMENT');
      const defaults: Record<string, any> = {};
      if (importSellerUserId.trim()) defaults.sellerUserId = importSellerUserId.trim();
      if (importRegionCode.trim()) defaults.regionCode = importRegionCode.trim();
      if (importTradeMode) defaults.tradeMode = importTradeMode;
      if (importPriceType) defaults.priceType = importPriceType;
      if (importDepositAmountYuan != null) defaults.depositAmountFen = yuanToFen(importDepositAmountYuan);
      if (importListingTopics.length) defaults.listingTopics = importListingTopics;

      const job = await apiPost<ImportJob>(
        '/admin/listings/jobs/import',
        {
          fileId: uploaded.id,
          duplicatePolicy,
          defaults,
        },
        { idempotencyKey: `admin-listing-import-create-${Date.now()}` },
      );
      await apiPost(`/admin/listings/jobs/import/${job.id}/validate`, undefined, {
        idempotencyKey: `admin-listing-import-validate-${job.id}`,
      });
      await apiPost(`/admin/listings/jobs/import/${job.id}/execute`, undefined, {
        idempotencyKey: `admin-listing-import-execute-${job.id}`,
      });
      setAutoRefreshImportJobIds((prev) => Array.from(new Set([...prev, job.id])));
      message.success('导入任务已提交并开始执行');
      setUploadFileList([]);
      await loadImportJobs();
    } catch (e: any) {
      message.error(e?.message || '提交导入任务失败');
    } finally {
      setImporting(false);
    }
  }, [
    duplicatePolicy,
    importDepositAmountYuan,
    importListingTopics,
    importPriceType,
    importRegionCode,
    importSellerUserId,
    importTradeMode,
    loadImportJobs,
    uploadFileList,
  ]);

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card>
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Typography.Title level={3} style={{ margin: 0 }}>
            挂牌审核与批量发布
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
            统一进行挂牌筛选、批量操作、批量导入发布和任务追踪。批量上架仅会处理已审核通过的数据。
          </Typography.Paragraph>

          {error ? <RequestErrorAlert error={error} onRetry={loadListings} /> : null}

          <Segmented
            value={viewMode}
            onChange={(value) => setViewMode(value as 'REVIEW' | 'DRAFTS')}
            options={[
              { label: '待处理', value: 'REVIEW' },
              { label: '草稿箱', value: 'DRAFTS' },
            ]}
          />

          <Space wrap>
            <Input
              value={draftQ}
              onChange={(e) => setDraftQ(e.target.value)}
              placeholder="关键词（标题）"
              style={{ width: 220 }}
              allowClear
              onPressEnter={applyFilters}
            />
            {!isDraftMode ? (
              <>
                <Select
                  value={draftAuditStatus}
                  style={{ width: 160 }}
                  onChange={(v) => setDraftAuditStatus((v as AuditStatus) || '')}
                  options={[
                    { value: '', label: '全部审核状态' },
                    { value: 'PENDING', label: '待审核' },
                    { value: 'APPROVED', label: '已通过' },
                    { value: 'REJECTED', label: '已驳回' },
                  ]}
                />
                <Select
                  value={draftStatus}
                  style={{ width: 160 }}
                  onChange={(v) => setDraftStatus((v as ListingStatus) || '')}
                  options={[
                    { value: '', label: '全部上架状态' },
                    { value: 'ACTIVE', label: '已上架' },
                    { value: 'OFF_SHELF', label: '已下架' },
                    { value: 'SOLD', label: '已售出' },
                  ]}
                />
              </>
            ) : null}
            <Select
              value={draftListingTopic}
              style={{ width: 180 }}
              onChange={(v) => setDraftListingTopic((v as ListingTopic) || '')}
              options={[{ value: '', label: '全部特色标签' }, ...listingTopicOptions]}
            />
            <Select
              value={draftSource}
              style={{ width: 160 }}
              onChange={(v) => setDraftSource((v as ContentSource) || '')}
              options={[
                { value: '', label: '全部来源' },
                { value: 'ADMIN', label: '后台录入' },
                { value: 'USER', label: '用户发布' },
                { value: 'PLATFORM', label: '平台导入' },
              ]}
            />
            <Button type="primary" onClick={applyFilters}>
              查询
            </Button>
            <Button onClick={resetFilters}>
              重置
            </Button>
          </Space>

          {!isDraftMode ? (
            <Space wrap>
              <Button onClick={() => void submitBatchAction('APPROVE')}>批量通过</Button>
              <Button onClick={() => void submitBatchAction('REJECT')}>批量驳回</Button>
              <Button type="primary" disabled={selectedPublishBlocked} onClick={() => void submitBatchAction('PUBLISH')}>
                批量上架
              </Button>
              <Button onClick={() => void submitBatchAction('OFF_SHELF')}>批量下架</Button>
              <Typography.Text type="secondary">已选 {selectedListingIds.length} 条</Typography.Text>
              {selectedPublishBlocked ? <Typography.Text type="secondary">草稿和未审核通过项不能直接上架</Typography.Text> : null}
            </Space>
          ) : (
            <Typography.Text type="secondary">草稿箱仅用于查看草稿，不进入待审核队列。</Typography.Text>
          )}

          <Table<Listing>
            rowKey="id"
            loading={loading}
            dataSource={listings?.items || []}
            rowSelection={
              isDraftMode
                ? undefined
                : {
                    selectedRowKeys,
                    onChange: setSelectedRowKeys,
                  }
            }
            pagination={{
              current: listings?.page.page || page,
              pageSize: listings?.page.pageSize || pageSize,
              total: listings?.page.total || 0,
              showSizeChanger: true,
              pageSizeOptions: ['10', '20', '50'],
              onChange: (nextPage, nextPageSize) => {
                if (nextPageSize && nextPageSize !== pageSize) {
                  setPageSize(nextPageSize);
                  setPage(1);
                  return;
                }
                setPage(nextPage);
              },
            }}
            columns={[
              {
                title: '挂牌摘要',
                key: 'summary',
                width: 360,
                render: (_, row) => (
                  <Space direction="vertical" size={2}>
                    <Typography.Text>{normalizeUserFacingText(row.title) || '挂牌标题待确认'}</Typography.Text>
                    <Typography.Text type="secondary">
                      交易方式：{tradeModeLabel(row.tradeMode)} · 来源：
                      {row.source === 'ADMIN' ? '后台录入' : row.source === 'USER' ? '用户发布' : row.source === 'PLATFORM' ? '平台导入' : '-'}
                    </Typography.Text>
                    <Typography.Text type="secondary" copyable={{ text: row.id }}>
                      挂牌记录编号：{row.id}
                    </Typography.Text>
                  </Space>
                ),
              },
              {
                title: '交易方式',
                dataIndex: 'tradeMode',
                width: 110,
                render: (v) => tradeModeLabel(v),
              },
              {
                title: '特色标签',
                dataIndex: 'listingTopics',
                width: 240,
                render: (v: ListingTopic[] | undefined) =>
                  Array.isArray(v) && v.length ? (
                    <Space size={[4, 4]} wrap>
                      {v.map((it) => (
                        <Tag key={it}>{topicLabel(it)}</Tag>
                      ))}
                    </Space>
                  ) : (
                    <Typography.Text type="secondary">未设置</Typography.Text>
                  ),
              },
              {
                title: '审核状态',
                dataIndex: 'auditStatus',
                width: 120,
                render: (v: AuditStatus) => <Tag>{auditStatusLabel(v)}</Tag>,
              },
              {
                title: '来源',
                dataIndex: 'source',
                width: 110,
                render: (v: ContentSource | undefined) => {
                  if (v === 'ADMIN') return '后台录入';
                  if (v === 'USER') return '用户发布';
                  if (v === 'PLATFORM') return '平台导入';
                  return '-';
                },
              },
              {
                title: '上架状态',
                dataIndex: 'status',
                width: 180,
                render: (_: ListingStatus, row) => <Tag>{listingAuditStatusText(row)}</Tag>,
              },
              {
                title: '创建时间',
                dataIndex: 'createdAt',
                width: 180,
                render: (v) => formatTimeSmart(v),
              },
              {
                title: '操作',
                key: 'actions',
                width: 220,
                fixed: 'right',
                render: (_, row) =>
                  row.status === 'DRAFT' ? (
                    <Button size="small" onClick={() => void openListingDetail(row)}>
                      详情
                    </Button>
                  ) : row.auditStatus === 'PENDING' ? (
                    <Space>
                      <Button size="small" onClick={() => void openListingDetail(row)}>
                        详情
                      </Button>
                      <Button size="small" type="primary" onClick={() => void approveListing(row)}>
                        通过
                      </Button>
                      <Button size="small" danger onClick={() => void rejectListing(row)}>
                        驳回
                      </Button>
                    </Space>
                  ) : (
                    <Space>
                      <Button size="small" onClick={() => void openListingDetail(row)}>
                        详情
                      </Button>
                      <Typography.Text type="secondary">已处理</Typography.Text>
                    </Space>
                  ),
              },
            ]}
          />
        </Space>
      </Card>

      <Card title="批量任务中心">
        <Table<BatchJob>
          rowKey="id"
          loading={batchJobsLoading}
          dataSource={batchJobs?.items || []}
          pagination={{
            current: batchJobs?.page.page || batchJobsPage,
            pageSize: batchJobs?.page.pageSize || batchJobsPageSize,
            total: batchJobs?.page.total || 0,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50'],
            onChange: (nextPage, nextPageSize) => {
              const normalizedPageSize = nextPageSize || batchJobsPageSize;
              if (normalizedPageSize !== batchJobsPageSize) {
                setBatchJobsPageSize(normalizedPageSize);
                setBatchJobsPage(1);
                return;
              }
              setBatchJobsPage(nextPage);
            },
          }}
          columns={[
            {
              title: '任务摘要',
              key: 'summary',
              width: 360,
              render: (_, row) => (
                <Space direction="vertical" size={2}>
                  <Typography.Text>{batchJobSummary(row)}</Typography.Text>
                  <Typography.Text type="secondary">
                    动作：{actionLabel(row.action)} · 状态：{statusTag(row.status)}
                  </Typography.Text>
                  <Typography.Text type="secondary" copyable={{ text: row.id }}>
                    任务单号：{row.id}
                  </Typography.Text>
                </Space>
              ),
            },
            { title: '动作', dataIndex: 'action', width: 120, render: (v: BatchAction) => actionLabel(v) },
            { title: '状态', dataIndex: 'status', width: 110, render: (v: JobStatus) => statusTag(v) },
            {
              title: '失败率',
              dataIndex: 'failRate',
              width: 100,
              render: (v: number) => `${(Number(v || 0) * 100).toFixed(1)}%`,
            },
            {
              title: '创建时间',
              dataIndex: 'createdAt',
              width: 180,
              render: (v) => formatTimeSmart(v),
            },
            {
              title: '操作',
              key: 'action',
              width: 220,
              render: (_, row) => (
                <Space>
                  <Button size="small" onClick={() => void openBatchJobItems(row)}>
                    查看明细
                  </Button>
                  <Button size="small" onClick={() => void openFileById(row.errorFileId)}>
                    错误文件
                  </Button>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Card title="批量导入发布">
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
            支持上传运营模板进行批量导入。流程为创建任务、校验任务、异步执行。执行结果可在任务中心查看并下载错误文件。
          </Typography.Paragraph>
          <Form layout="vertical">
            <Row gutter={12}>
              <Col span={8}>
                <Form.Item label="导入文件（xlsx）">
                  <Upload
                    fileList={uploadFileList}
                    maxCount={1}
                    beforeUpload={() => false}
                    onChange={({ fileList }) => setUploadFileList(fileList)}
                    accept=".xlsx,.xls"
                  >
                    <Button>选择文件</Button>
                  </Upload>
                </Form.Item>
              </Col>
              <Col span={4}>
                <Form.Item label="重复策略">
                  <Select
                    value={duplicatePolicy}
                    onChange={(v) => setDuplicatePolicy(v)}
                    options={[
                      { value: 'SKIP', label: '跳过重复' },
                      { value: 'OVERWRITE', label: '覆盖更新' },
                    ]}
                  />
                </Form.Item>
              </Col>
              <Col span={4}>
                <Form.Item label="默认交易方式">
                  <Select
                    value={importTradeMode}
                    onChange={(v) => setImportTradeMode(v)}
                    options={[
                      { value: '', label: '不设置' },
                      { value: 'ASSIGNMENT', label: '转让' },
                      { value: 'LICENSE', label: '许可' },
                    ]}
                  />
                </Form.Item>
              </Col>
              <Col span={4}>
                <Form.Item label="默认报价类型">
                  <Select
                    value={importPriceType}
                    onChange={(v) => setImportPriceType(v)}
                    options={[
                      { value: '', label: '不设置' },
                      { value: 'NEGOTIABLE', label: '面议' },
                      { value: 'FIXED', label: '固定价' },
                    ]}
                  />
                </Form.Item>
              </Col>
              <Col span={4}>
                <Form.Item label="默认保证金（元）">
                  <InputNumber
                    value={importDepositAmountYuan}
                    min={0}
                    precision={2}
                    style={{ width: '100%' }}
                    onChange={(v) => setImportDepositAmountYuan(v == null ? null : Number(v))}
                  />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={12}>
              <Col span={6}>
                <Form.Item label="平台承接人员">
                  <Select
                    value={importSellerUserId || undefined}
                    onChange={(value) => setImportSellerUserId(String(value || '').trim())}
                    options={staffOptions}
                    placeholder="可选"
                    allowClear
                    showSearch
                    optionFilterProp="label"
                  />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item label="默认地区">
                  <Input
                    value={importRegionCode}
                    onChange={(e) => setImportRegionCode(e.target.value)}
                    placeholder="可填写地区名称或地区代码"
                    allowClear
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="默认特色标签">
                  <Select
                    mode="multiple"
                    value={importListingTopics}
                    onChange={(v) => setImportListingTopics(v as ListingTopic[])}
                    options={listingTopicOptions}
                    placeholder="可选"
                  />
                </Form.Item>
              </Col>
            </Row>
          </Form>
          <Space>
            <Button type="primary" loading={importing} onClick={() => void runImport()}>
              提交导入任务
            </Button>
            <Button onClick={() => void loadImportJobs()}>刷新导入任务</Button>
          </Space>
        </Space>
      </Card>

      <Card title="导入任务中心">
        <Table<ImportJob>
          rowKey="id"
          loading={importJobsLoading}
          dataSource={importJobs?.items || []}
          pagination={{
            current: importJobs?.page.page || importJobsPage,
            pageSize: importJobs?.page.pageSize || importJobsPageSize,
            total: importJobs?.page.total || 0,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50'],
            onChange: (nextPage, nextPageSize) => {
              const normalizedPageSize = nextPageSize || importJobsPageSize;
              if (normalizedPageSize !== importJobsPageSize) {
                setImportJobsPageSize(normalizedPageSize);
                setImportJobsPage(1);
                return;
              }
              setImportJobsPage(nextPage);
            },
          }}
          columns={[
            {
              title: '任务摘要',
              key: 'summary',
              width: 360,
              render: (_, row) => (
                <Space direction="vertical" size={2}>
                  <Typography.Text>{importJobSummary(row)}</Typography.Text>
                  <Typography.Text type="secondary">
                    重复策略：{duplicatePolicyLabel(row.duplicatePolicy)} · 状态：{statusTag(row.status)}
                  </Typography.Text>
                  <Typography.Text type="secondary" copyable={{ text: row.id }}>
                    任务单号：{row.id}
                  </Typography.Text>
                </Space>
              ),
            },
            { title: '重复策略', dataIndex: 'duplicatePolicy', width: 110, render: (v: ImportDuplicatePolicy) => duplicatePolicyLabel(v) },
            { title: '状态', dataIndex: 'status', width: 110, render: (v: JobStatus) => statusTag(v) },
            {
              title: '失败率',
              dataIndex: 'failRate',
              width: 100,
              render: (v: number) => `${(Number(v || 0) * 100).toFixed(1)}%`,
            },
            {
              title: '创建时间',
              dataIndex: 'createdAt',
              width: 180,
              render: (v) => formatTimeSmart(v),
            },
            {
              title: '操作',
              key: 'action',
              width: 220,
              render: (_, row) => (
                <Space>
                  <Button size="small" onClick={() => void openImportJobRows(row)}>
                    查看明细
                  </Button>
                  <Button size="small" onClick={() => void openFileById(row.errorFileId)}>
                    错误文件
                  </Button>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Drawer
        width={860}
        open={detailOpen}
        title={activeListing ? `挂牌详情：${displayText(activeListing.title, activeListing.id)}` : '挂牌详情'}
        onClose={() => setDetailOpen(false)}
        extra={
          activeListing ? (
            <Space>
              {activeListing.status !== 'DRAFT' && activeListing.auditStatus === 'PENDING' ? (
                <>
                  <Button onClick={() => void rejectListing(activeListing)} danger>
                    驳回
                  </Button>
                  <Button type="primary" onClick={() => void approveListing(activeListing)}>
                    通过
                  </Button>
                </>
              ) : null}
              <Button onClick={openListingEdit}>编辑价格/保证金</Button>
            </Space>
          ) : null
        }
      >
        {detailLoading && !activeListing ? (
          <Typography.Text type="secondary">加载详情中...</Typography.Text>
        ) : activeListing ? (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            {listingHasRejectedProofFiles(activeListing) ? (
              <Typography.Text type="danger">有权属材料已被驳回，当前不能通过。</Typography.Text>
            ) : null}
            <Descriptions size="small" bordered column={2}>
              <Descriptions.Item label="挂牌记录编号" span={2}>{activeListing.id}</Descriptions.Item>
              <Descriptions.Item label="标题" span={2}>{displayText(activeListing.title, '挂牌标题待确认')}</Descriptions.Item>
              <Descriptions.Item label="审核状态">{auditStatusLabel(activeListing.auditStatus)}</Descriptions.Item>
              <Descriptions.Item label="上架状态">{listingAuditStatusText(activeListing)}</Descriptions.Item>
              <Descriptions.Item label="来源">
                {activeListing.source === 'ADMIN'
                  ? '后台录入'
                  : activeListing.source === 'USER'
                  ? '用户发布'
                  : activeListing.source === 'PLATFORM'
                  ? '平台导入'
                  : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="地区">{displayText(activeListing.regionCode)}</Descriptions.Item>
              <Descriptions.Item label="交易方式">{tradeModeLabel(activeListing.tradeMode)}</Descriptions.Item>
              <Descriptions.Item label="许可方式">{licenseModeLabel(activeListing.licenseMode)}</Descriptions.Item>
              <Descriptions.Item label="价格">{priceDisplay(activeListing)}</Descriptions.Item>
              <Descriptions.Item label="订金">
                {activeListing.depositAmountFen == null ? '-' : `¥${fenToYuan(activeListing.depositAmountFen)}`}
              </Descriptions.Item>
              <Descriptions.Item label="特色标签" span={2}>
                {activeListing.listingTopics?.length ? (
                  <Space size={[4, 4]} wrap>
                    {activeListing.listingTopics.map((topic) => (
                      <Tag key={topic}>{topicLabel(topic)}</Tag>
                    ))}
                  </Space>
                ) : (
                  <Typography.Text type="secondary">未设置</Typography.Text>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="交付内容" span={2}>{displayList(activeListing.deliverables, '未填写')}</Descriptions.Item>
              <Descriptions.Item label="摘要" span={2}>{displayText(activeListing.summary, '未填写')}</Descriptions.Item>
              <Descriptions.Item label="权属材料" span={2}>
                {activeListing.proofFiles?.length ? (
                  <Space direction="vertical" size={6} style={{ width: '100%' }}>
                    {activeListing.proofFiles.map((file) => (
                      <Space key={file.id} size={8} wrap>
                        <Button size="small" onClick={() => void openFileById(file.id)}>
                          查看
                        </Button>
                        <Tag>{fileModerationLabel(file.moderationStatus)}</Tag>
                        <Typography.Text>{displayText(file.fileName, file.id)}</Typography.Text>
                        {String(file.moderationStatus || '').trim().toUpperCase() === 'PENDING' ? (
                          <Space size={4} wrap>
                            <Button size="small" type="primary" onClick={() => void updateFileModeration(file.id, 'APPROVED')}>
                              通过
                            </Button>
                            <Button size="small" danger onClick={() => void updateFileModeration(file.id, 'REJECTED')}>
                              驳回
                            </Button>
                          </Space>
                        ) : null}
                        {file.moderationReason ? (
                          <Typography.Text type="danger">原因：{displayText(file.moderationReason)}</Typography.Text>
                        ) : null}
                      </Space>
                    ))}
                  </Space>
                ) : (
                  <Typography.Text type="secondary">未上传</Typography.Text>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">{formatTimeSmart(activeListing.createdAt)}</Descriptions.Item>
              <Descriptions.Item label="更新时间">{formatTimeSmart(activeListing.updatedAt)}</Descriptions.Item>
            </Descriptions>

            <Descriptions title="专利信息" size="small" bordered column={2}>
              <Descriptions.Item label="专利记录编号" span={2}>{displayText(activeListing.patentId)}</Descriptions.Item>
              <Descriptions.Item label="申请号">{displayText(activeListing.applicationNoDisplay)}</Descriptions.Item>
              <Descriptions.Item label="专利号">{displayText(activeListing.patentNoDisplay)}</Descriptions.Item>
              <Descriptions.Item label="公开号">{displayText(activeListing.publicationNoDisplay)}</Descriptions.Item>
              <Descriptions.Item label="授权公告号">{displayText(activeListing.grantPublicationNoDisplay)}</Descriptions.Item>
              <Descriptions.Item label="专利类型">{displayText(activeListing.patentType)}</Descriptions.Item>
              <Descriptions.Item label="IPC">{displayList(activeListing.ipcCodes)}</Descriptions.Item>
              <Descriptions.Item label="发明人" span={2}>{displayList(activeListing.inventorNames)}</Descriptions.Item>
              <Descriptions.Item label="申请人" span={2}>{displayList(activeListing.applicantNames)}</Descriptions.Item>
              <Descriptions.Item label="权利人" span={2}>{displayList(activeListing.assigneeNames)}</Descriptions.Item>
            </Descriptions>
          </Space>
        ) : (
          <Typography.Text type="secondary">暂未获取到挂牌详情。</Typography.Text>
        )}
      </Drawer>

      <Modal
        title="编辑挂牌价格/保证金"
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        onOk={() => void submitListingEdit()}
        okText="保存"
        confirmLoading={editSubmitting}
        destroyOnClose
      >
        <Form form={editForm} layout="vertical">
          <Form.Item label="价格方式" name="priceType" rules={[{ required: true, message: '请选择价格方式' }]}>
            <Select options={priceTypeOptions} />
          </Form.Item>
          <Form.Item
            label="价格（元）"
            name="priceAmountYuan"
            rules={[
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (getFieldValue('priceType') === 'FIXED' && (value === null || value === undefined)) {
                    return Promise.reject(new Error('固定价需要填写价格'));
                  }
                  return Promise.resolve();
                },
              }),
            ]}
          >
            <InputNumber min={0} precision={2} style={{ width: '100%' }} placeholder="面议时可留空" />
          </Form.Item>
          <Form.Item label="订金（元）" name="depositAmountYuan">
            <InputNumber min={0} precision={2} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        width={980}
        open={batchDrawerOpen}
        title={activeBatchJob ? `批量任务明细 ${activeBatchJob.id}` : '批量任务明细'}
        onClose={() => setBatchDrawerOpen(false)}
      >
        <Table<BatchJobItem>
          rowKey="id"
          loading={batchItemsLoading}
          dataSource={batchItems?.items || []}
          pagination={{
            current: batchItems?.page.page || batchItemsPage,
            pageSize: batchItems?.page.pageSize || batchItemsPageSize,
            total: batchItems?.page.total || 0,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            onChange: (nextPage, nextPageSize) => {
              const normalizedPageSize = nextPageSize || batchItemsPageSize;
              if (normalizedPageSize !== batchItemsPageSize) {
                setBatchItemsPageSize(normalizedPageSize);
                setBatchItemsPage(1);
                return;
              }
              setBatchItemsPage(nextPage);
            },
          }}
          columns={[
            {
              title: '处理对象',
              key: 'listing',
              width: 300,
              render: (_, row) => (
                <Space direction="vertical" size={2}>
                  <Typography.Text>{displayAdminInfo(row.errorMessage, '挂牌记录处理结果')}</Typography.Text>
                  <Typography.Text type="secondary" copyable={{ text: row.listingId }}>
                    挂牌记录编号：{displayAdminInfo(row.listingId)}
                  </Typography.Text>
                </Space>
              ),
            },
            { title: '状态', dataIndex: 'status', width: 120, render: (v: BatchItemStatus) => statusTag(v) },
            { title: '失败原因代码', dataIndex: 'errorCode', width: 160, render: (v) => displayAdminInfo(v) },
            { title: '错误信息', dataIndex: 'errorMessage', ellipsis: true, render: (v) => displayAdminInfo(v) },
            {
              title: '处理时间',
              dataIndex: 'processedAt',
              width: 180,
              render: (v) => (v ? formatTimeSmart(v) : '-'),
            },
          ]}
        />
      </Drawer>

      <Drawer
        width={1080}
        open={importDrawerOpen}
        title={activeImportJob ? `导入任务明细 ${activeImportJob.id}` : '导入任务明细'}
        onClose={() => setImportDrawerOpen(false)}
      >
        <Table<ImportRow>
          rowKey="id"
          loading={importRowsLoading}
          dataSource={importRows?.items || []}
          pagination={{
            current: importRows?.page.page || importRowsPage,
            pageSize: importRows?.page.pageSize || importRowsPageSize,
            total: importRows?.page.total || 0,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            onChange: (nextPage, nextPageSize) => {
              const normalizedPageSize = nextPageSize || importRowsPageSize;
              if (normalizedPageSize !== importRowsPageSize) {
                setImportRowsPageSize(normalizedPageSize);
                setImportRowsPage(1);
                return;
              }
              setImportRowsPage(nextPage);
            },
          }}
          columns={[
            { title: '行号', dataIndex: 'rowNo', width: 90 },
            { title: '状态', dataIndex: 'status', width: 120, render: (v: ImportRowStatus) => statusTag(v) },
            {
              title: '行摘要',
              key: 'summary',
              width: 360,
              render: (_, row) => (
                <Space direction="vertical" size={2}>
                  <Typography.Text>{displayAdminInfo(row.normalized?.title, '挂牌标题待确认')}</Typography.Text>
                  <Typography.Text type="secondary">
                    申请号：{displayAdminInfo(row.normalized?.applicationNoDisplay || row.normalized?.applicationNoNorm)}
                  </Typography.Text>
                  <Typography.Text type="secondary" copyable={{ text: String(row.listingId || '') }}>
                    挂牌记录编号：{displayAdminInfo(row.listingId)}
                  </Typography.Text>
                </Space>
              ),
            },
            { title: '失败原因代码', dataIndex: 'errorCode', width: 160, render: (v) => displayAdminInfo(v) },
            {
              title: '错误信息',
              dataIndex: 'errorMessage',
              width: 260,
              render: (v) => displayAdminInfo(v),
            },
            {
              title: '标准化结果',
              dataIndex: 'normalized',
              render: (v: Record<string, any> | null | undefined) =>
                v ? (
                  <Typography.Text code style={{ whiteSpace: 'pre-wrap' }}>
                    {importRowNormalizedSummary(v)}
                  </Typography.Text>
                ) : (
                  '-'
                ),
            },
          ]}
        />
      </Drawer>
    </Space>
  );
}
