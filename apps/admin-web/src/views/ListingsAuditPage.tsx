import {
  Button,
  Card,
  Col,
  Drawer,
  Form,
  Input,
  InputNumber,
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

import { apiGet, apiPost, apiUploadFile } from '../lib/api';
import { formatTimeSmart, yuanToFen } from '../lib/format';
import { displayAdminInfo, normalizeUserFacingText } from '../lib/userFacingText';
import {
  DEFAULT_LISTING_TOPIC_OPTIONS,
  fetchAdminListingTopicOptions,
  topicLabelFromOptions,
} from '../lib/homeLandingConfig';
import { auditStatusLabel, listingStatusLabel, tradeModeLabel } from '../lib/labels';
import { RequestErrorAlert } from '../ui/RequestState';

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

type Listing = {
  id: string;
  title: string;
  source?: ContentSource;
  auditStatus: AuditStatus;
  status: ListingStatus;
  tradeMode: 'ASSIGNMENT' | 'LICENSE';
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

function actionLabel(action: BatchAction) {
  if (action === 'APPROVE') return '批量通过';
  if (action === 'REJECT') return '批量驳回';
  if (action === 'PUBLISH') return '批量上架';
  return '批量下架';
}

function statusTag(status: JobStatus | BatchItemStatus | ImportRowStatus) {
  const text = String(status || '');
  if (text === 'SUCCEEDED' || text === 'VALID') return <Tag color="green">{text}</Tag>;
  if (text === 'FAILED' || text === 'INVALID') return <Tag color="red">{text}</Tag>;
  if (text === 'RUNNING') return <Tag color="blue">{text}</Tag>;
  if (text === 'PAUSED') return <Tag color="orange">{text}</Tag>;
  if (text === 'SKIPPED') return <Tag>{text}</Tag>;
  return <Tag>{text}</Tag>;
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

  const loadListings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<Paged<Listing>>('/admin/listings', {
        page,
        pageSize,
        q: appliedQ.trim() || undefined,
        auditStatus: appliedAuditStatus || undefined,
        status: appliedStatus || undefined,
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
  }, [appliedAuditStatus, appliedListingTopic, appliedQ, appliedSource, appliedStatus, page, pageSize]);

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
      message.error(e?.message || '下载错误文件失败');
    }
  }, []);

  const submitBatchAction = useCallback(
    async (action: BatchAction) => {
      if (!selectedListingIds.length) {
        message.warning('请先选择需要操作的挂牌');
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
    [loadBatchJobs, loadListings, selectedListingIds],
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

          <Space wrap>
            <Input
              value={draftQ}
              onChange={(e) => setDraftQ(e.target.value)}
              placeholder="关键词（标题）"
              style={{ width: 220 }}
              allowClear
              onPressEnter={applyFilters}
            />
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
                { value: 'DRAFT', label: '草稿' },
                { value: 'ACTIVE', label: '上架中' },
                { value: 'OFF_SHELF', label: '已下架' },
                { value: 'SOLD', label: '已售出' },
              ]}
            />
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

          <Space wrap>
            <Button onClick={() => void submitBatchAction('APPROVE')}>批量通过</Button>
            <Button onClick={() => void submitBatchAction('REJECT')}>批量驳回</Button>
            <Button type="primary" onClick={() => void submitBatchAction('PUBLISH')}>
              批量上架
            </Button>
            <Button onClick={() => void submitBatchAction('OFF_SHELF')}>批量下架</Button>
            <Typography.Text type="secondary">已选 {selectedListingIds.length} 条</Typography.Text>
          </Space>

          <Table<Listing>
            rowKey="id"
            loading={loading}
            dataSource={listings?.items || []}
            rowSelection={{
              selectedRowKeys,
              onChange: setSelectedRowKeys,
            }}
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
              { title: 'ID', dataIndex: 'id', width: 220 },
              { title: '标题', dataIndex: 'title', ellipsis: true, render: (value) => normalizeUserFacingText(value) || '未命名挂牌' },
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
                    <Typography.Text type="secondary">-</Typography.Text>
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
                width: 120,
                render: (v: ListingStatus) => <Tag>{listingStatusLabel(v)}</Tag>,
              },
              {
                title: '创建时间',
                dataIndex: 'createdAt',
                width: 180,
                render: (v) => formatTimeSmart(v),
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
            { title: '任务ID', dataIndex: 'id', width: 220 },
            { title: '动作', dataIndex: 'action', width: 120, render: (v: BatchAction) => actionLabel(v) },
            { title: '状态', dataIndex: 'status', width: 110, render: (v: JobStatus) => statusTag(v) },
            { title: '总数', dataIndex: 'totalCount', width: 80 },
            { title: '成功', dataIndex: 'successCount', width: 80 },
            { title: '失败', dataIndex: 'failedCount', width: 80 },
            { title: '跳过', dataIndex: 'skippedCount', width: 80 },
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
                <Form.Item label="默认卖家用户ID">
                  <Input
                    value={importSellerUserId}
                    onChange={(e) => setImportSellerUserId(e.target.value)}
                    placeholder="可选"
                    allowClear
                  />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item label="默认地区编码">
                  <Input
                    value={importRegionCode}
                    onChange={(e) => setImportRegionCode(e.target.value)}
                    placeholder="如 110000"
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
            { title: '任务ID', dataIndex: 'id', width: 220 },
            { title: '重复策略', dataIndex: 'duplicatePolicy', width: 110 },
            { title: '状态', dataIndex: 'status', width: 110, render: (v: JobStatus) => statusTag(v) },
            { title: '总数', dataIndex: 'totalCount', width: 80 },
            { title: '有效', dataIndex: 'validCount', width: 80 },
            { title: '无效', dataIndex: 'invalidCount', width: 80 },
            { title: '成功', dataIndex: 'successCount', width: 80 },
            { title: '失败', dataIndex: 'failedCount', width: 80 },
            { title: '跳过', dataIndex: 'skippedCount', width: 80 },
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
            { title: '挂牌ID', dataIndex: 'listingId', width: 220 },
            { title: '状态', dataIndex: 'status', width: 120, render: (v: BatchItemStatus) => statusTag(v) },
            { title: '错误码', dataIndex: 'errorCode', width: 160 },
            { title: '错误信息', dataIndex: 'errorMessage', ellipsis: true },
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
            { title: '挂牌ID', dataIndex: 'listingId', width: 220, render: (v) => displayAdminInfo(v) },
            { title: '错误码', dataIndex: 'errorCode', width: 160, render: (v) => displayAdminInfo(v) },
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
                    {JSON.stringify(v)}
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
