import { Alert, Button, Card, Drawer, Form, Input, InputNumber, Select, Space, Switch, Table, Tag, Typography, Upload, message } from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { apiGet, apiPost, apiUploadFile, type FileObject } from '../lib/api';
import { formatTimeSmart, yuanToFen } from '../lib/format';
import { RequestErrorAlert } from '../ui/RequestState';

type ConsultationRouting = 'PLATFORM' | 'OWNER';
type ListingTradeMode = 'ASSIGNMENT' | 'LICENSE';
type LicenseMode = 'EXCLUSIVE' | 'SOLE' | 'NON_EXCLUSIVE';
type PriceType = 'FIXED' | 'NEGOTIABLE';
type ListingTopic = 'HIGH_TECH_RETIRED' | 'SLEEPING' | 'AWARD_WINNING' | 'OPEN_LICENSE';
type DuplicatePolicy = 'SKIP' | 'OVERWRITE';
type JobStatus = 'PENDING' | 'RUNNING' | 'PAUSED' | 'SUCCEEDED' | 'FAILED';
type ImportRowStatus = 'PENDING' | 'VALID' | 'INVALID' | 'SUCCEEDED' | 'FAILED' | 'SKIPPED';

type Paged<T> = { items: T[]; page: { page: number; pageSize: number; total: number } };

type PatentImportJob = {
  id: string;
  status: JobStatus;
  duplicatePolicy: DuplicatePolicy;
  totalCount: number;
  validCount: number;
  invalidCount: number;
  successCount: number;
  failedCount: number;
  skippedCount: number;
  failRate: number;
  validatedAt?: string | null;
  pausedAt?: string | null;
  finishedAt?: string | null;
  errorFileId?: string | null;
  createdAt: string;
};

type PatentImportJobRow = {
  id: string;
  rowNo: number;
  status: ImportRowStatus;
  normalized?: Record<string, any> | null;
  patentId?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
};

type PatentListingGenerateResult = {
  totalCount: number;
  successCount: number;
  failedCount: number;
  skippedCount: number;
};

type DefaultsFormValues = {
  duplicatePolicy: DuplicatePolicy;
  consultationRouting: ConsultationRouting;
  sellerUserId?: string;
  tradeMode: ListingTradeMode;
  licenseMode?: LicenseMode;
  priceType: PriceType;
  priceAmountYuan?: number | null;
  depositAmountYuan?: number | null;
  regionCode?: string;
  listingTopics?: ListingTopic[];
  industryTagsText?: string;
};

type ImportTemplateField = {
  header: string;
  required: boolean;
  description: string;
  example: string;
};

type PatentMapRegionScopeLevel = 'PROVINCE' | 'CITY' | 'DISTRICT';
type PatentMapRegionLevel = PatentMapRegionScopeLevel | 'UNKNOWN';
type PatentMapFeaturedLevel = 'NONE' | 'CITY' | 'PROVINCE';
type PatentMapDataScope = 'ACTIVE_APPROVED' | 'ALL';

type PatentMapRegionItem = {
  regionCode: string;
  regionName: string;
  regionLevel: PatentMapRegionLevel;
  centerLat: number | null;
  centerLng: number | null;
  listingCount: number;
  patentCount: number;
  rankedListingCount: number;
  activeRankedListingCount: number;
  topActiveRank: number | null;
  rankPosition: number;
};

type PatentMapOverview = {
  generatedAt: string;
  filters: { regionLevel: PatentMapRegionScopeLevel; top: number; scope: PatentMapDataScope };
  summary: {
    totalListingCount: number;
    totalPatentCount: number;
    totalRegionCount: number;
    regionsWithListingsCount: number;
    regionsWithPatentsCount: number;
    regionsWithActiveRankedCount: number;
    rankedListingCount: number;
    activeRankedListingCount: number;
    unassignedListingCount: number;
    mappableRegionCount: number;
  };
  ranking: PatentMapRegionItem[];
  regions: PatentMapRegionItem[];
};

type PatentMapRegionDetail = {
  generatedAt: string;
  filters: { scope: PatentMapDataScope };
  region: {
    code: string;
    name: string;
    level: PatentMapRegionScopeLevel;
    parentCode: string | null;
    centerLat: number | null;
    centerLng: number | null;
    descendantRegionCodeCount: number;
  };
  summary: {
    listingCount: number;
    patentCount: number;
    rankedListingCount: number;
    activeRankedListingCount: number;
    topActiveRank: number | null;
  };
  items: Array<{
    listingId: string;
    patentId: string | null;
    title: string;
    patentTitle: string;
    patentType: 'INVENTION' | 'UTILITY_MODEL' | 'DESIGN' | null;
    applicationNoDisplay: string | null;
    regionCode: string | null;
    tradeMode: 'ASSIGNMENT' | 'LICENSE';
    priceType: 'FIXED' | 'NEGOTIABLE';
    priceAmountFen: number | null;
    depositAmountFen: number;
    featuredLevel: PatentMapFeaturedLevel;
    featuredRegionCode: string | null;
    featuredRank: number | null;
    featuredUntil: string | null;
    isFeaturedActive: boolean;
    createdAt: string;
    updatedAt: string;
  }>;
  page: { page: number; pageSize: number; total: number };
};

type PatentMapBatchUpdateResult = {
  ok: true;
  totalRequested: number;
  updatedCount: number;
  missingListingIds: string[];
  patchApplied: Record<string, unknown>;
  reason: string | null;
};

function patentMapRegionLevelLabel(level: PatentMapRegionLevel) {
  if (level === 'PROVINCE') return '省';
  if (level === 'CITY') return '市';
  if (level === 'DISTRICT') return '区县';
  return '未知';
}

function patentMapFeaturedLevelLabel(level: PatentMapFeaturedLevel) {
  if (level === 'PROVINCE') return '省级';
  if (level === 'CITY') return '市级';
  return '未上榜';
}

const duplicatePolicyOptions = [
  { value: 'SKIP', label: '跳过重复' },
  { value: 'OVERWRITE', label: '覆盖重复' },
];

const consultationRoutingOptions = [
  { value: 'PLATFORM', label: '平台客服' },
  { value: 'OWNER', label: '权利人咨询' },
];

const tradeModeOptions = [
  { value: 'ASSIGNMENT', label: '转让' },
  { value: 'LICENSE', label: '许可' },
];

const licenseModeOptions = [
  { value: 'EXCLUSIVE', label: '独占许可' },
  { value: 'SOLE', label: '排他许可' },
  { value: 'NON_EXCLUSIVE', label: '普通许可' },
];

const priceTypeOptions = [
  { value: 'NEGOTIABLE', label: '面议' },
  { value: 'FIXED', label: '一口价' },
];

const listingTopicOptions = [
  { value: 'HIGH_TECH_RETIRED', label: '退役专利' },
  { value: 'SLEEPING', label: '沉睡专利' },
  { value: 'AWARD_WINNING', label: '获奖专利' },
  { value: 'OPEN_LICENSE', label: '开放许可' },
];

const patentMapRegionLevelOptions: Array<{ value: PatentMapRegionScopeLevel; label: string }> = [
  { value: 'PROVINCE', label: '按省聚合' },
  { value: 'CITY', label: '按市聚合' },
  { value: 'DISTRICT', label: '按区县聚合' },
];

const patentMapDataScopeOptions: Array<{ value: PatentMapDataScope; label: string }> = [
  { value: 'ACTIVE_APPROVED', label: '\u5728\u552e\u6302\u724c' },
  { value: 'ALL', label: '\u5168\u90e8\u4ea4\u6613\u6570\u636e' },
];

const patentMapFeaturedLevelPatchOptions: Array<{ value: PatentMapFeaturedLevel | ''; label: string }> = [
  { value: '', label: '不调整上榜层级' },
  { value: 'CITY', label: '市级上榜' },
  { value: 'PROVINCE', label: '省级上榜' },
  { value: 'NONE', label: '取消上榜' },
];

const rowStatusOptions: Array<{ value: ImportRowStatus | ''; label: string }> = [
  { value: '', label: '全部状态' },
  { value: 'VALID', label: 'VALID' },
  { value: 'INVALID', label: 'INVALID' },
  { value: 'SUCCEEDED', label: 'SUCCEEDED' },
  { value: 'FAILED', label: 'FAILED' },
  { value: 'SKIPPED', label: 'SKIPPED' },
  { value: 'PENDING', label: 'PENDING' },
];

const patentImportTemplateFields: ImportTemplateField[] = [
  { header: '申请号', required: true, description: '专利申请号，支持带点或不带点', example: '202311340972.0' },
  { header: '发明名称', required: true, description: '专利标题', example: '一种高效散热装置' },
  { header: '专利类型', required: true, description: 'INVENTION / UTILITY_MODEL / DESIGN，或中文类型', example: 'INVENTION' },
  { header: '法律状态', required: false, description: '可选：PENDING / GRANTED / EXPIRED / INVALIDATED / UNKNOWN', example: 'GRANTED' },
  { header: '申请日', required: false, description: '支持 YYYY-MM-DD / Excel 日期 / 中文日期', example: '2023-11-01' },
  { header: '授权日', required: false, description: '支持 YYYY-MM-DD / Excel 日期 / 中文日期', example: '2024-10-18' },
  { header: '公开(公告)号', required: false, description: '公开(公告)号展示值', example: 'CN117123456A' },
  { header: '公开(公告)日期', required: false, description: '支持 YYYY-MM-DD / Excel 日期 / 中文日期', example: '2024-02-20' },
  { header: '申请(专利权)人', required: false, description: '多个值可用逗号/分号/换行分隔', example: '上海某某科技有限公司' },
  { header: '申请人', required: false, description: '多个值可用逗号/分号/换行分隔；不填时可回落到申请(专利权)人', example: '上海某某科技有限公司' },
  { header: '发明人', required: false, description: '多个值可用逗号/分号/换行分隔', example: '张三;李四' },
  { header: '摘要', required: false, description: '专利摘要', example: '本发明公开了一种...' },
];

const patentImportTemplateSample: Record<string, string> = {
  申请号: '202311340972.0',
  发明名称: '一种高效散热装置',
  专利类型: 'INVENTION',
  法律状态: 'GRANTED',
  申请日: '2023-11-01',
  授权日: '2024-10-18',
  '公开(公告)号': 'CN117123456A',
  '公开(公告)日期': '2024-02-20',
  '申请(专利权)人': '上海某某科技有限公司',
  申请人: '上海某某科技有限公司',
  发明人: '张三;李四',
  摘要: '本发明公开了一种适用于工业场景的高效散热装置。',
};

function parseTextList(text?: string): string[] {
  return Array.from(
    new Set(
      String(text || '')
        .split(/[\n,，;；、]/g)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function escapeCsv(value: unknown): string {
  const raw = String(value ?? '');
  if (raw.includes('"') || raw.includes(',') || raw.includes('\n')) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

function buildImportTemplateCsv(): string {
  const headers = patentImportTemplateFields.map((it) => it.header);
  const headerLine = headers.map((header) => escapeCsv(header)).join(',');
  const sampleLine = headers.map((header) => escapeCsv(patentImportTemplateSample[header] || '')).join(',');
  return `\uFEFF${headerLine}\n${sampleLine}\n`;
}

function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const objectUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(objectUrl);
}

function buildListingDefaults(values: DefaultsFormValues): { payload?: Record<string, unknown>; error?: string } {
  const listingDefaults: Record<string, unknown> = {
    consultationRouting: values.consultationRouting,
    tradeMode: values.tradeMode,
    priceType: values.priceType,
    depositAmountFen: yuanToFen(values.depositAmountYuan ?? 0),
    listingTopics: values.listingTopics || [],
    auditStatus: 'APPROVED',
    status: 'ACTIVE',
  };
  if (values.consultationRouting === 'PLATFORM') {
    const sellerUserId = String(values.sellerUserId || '').trim();
    if (sellerUserId) listingDefaults.sellerUserId = sellerUserId;
  }
  if (values.tradeMode === 'LICENSE') {
    if (!values.licenseMode) return { error: '许可模式不能为空' };
    listingDefaults.licenseMode = values.licenseMode;
  }
  if (values.priceType === 'FIXED') {
    if (!values.priceAmountYuan || Number(values.priceAmountYuan) <= 0) {
      return { error: '一口价模式必须填写挂牌价格（元）' };
    }
    listingDefaults.priceAmountFen = yuanToFen(values.priceAmountYuan);
  }
  const regionCode = String(values.regionCode || '').trim();
  if (regionCode) listingDefaults.regionCode = regionCode;
  const industryTags = parseTextList(values.industryTagsText);
  if (industryTags.length) listingDefaults.industryTags = industryTags;
  return { payload: listingDefaults };
}

function statusTag(status: JobStatus | ImportRowStatus) {
  const text = String(status || '');
  if (text === 'SUCCEEDED' || text === 'VALID') return <Tag color="green">{text}</Tag>;
  if (text === 'FAILED' || text === 'INVALID') return <Tag color="red">{text}</Tag>;
  if (text === 'RUNNING') return <Tag color="blue">{text}</Tag>;
  if (text === 'PAUSED') return <Tag color="orange">{text}</Tag>;
  if (text === 'SKIPPED') return <Tag>{text}</Tag>;
  return <Tag>{text}</Tag>;
}

export function PatentOperationsPage() {
  const [error, setError] = useState<unknown | null>(null);
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState<Paged<PatentImportJob> | null>(null);
  const [jobsPage, setJobsPage] = useState(1);
  const [jobsPageSize, setJobsPageSize] = useState(20);
  const [file, setFile] = useState<FileObject | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [rowsOpen, setRowsOpen] = useState(false);
  const [rows, setRows] = useState<Paged<PatentImportJobRow> | null>(null);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [activeJob, setActiveJob] = useState<PatentImportJob | null>(null);
  const [rowsPage, setRowsPage] = useState(1);
  const [rowsPageSize, setRowsPageSize] = useState(50);
  const [rowsDraftStatus, setRowsDraftStatus] = useState<ImportRowStatus | ''>('');
  const [rowsAppliedStatus, setRowsAppliedStatus] = useState<ImportRowStatus | ''>('');
  const [patentIdsText, setPatentIdsText] = useState('');
  const [generateResult, setGenerateResult] = useState<PatentListingGenerateResult | null>(null);
  const [draftJobStatusFilter, setDraftJobStatusFilter] = useState<JobStatus | ''>('');
  const [draftJobDuplicatePolicyFilter, setDraftJobDuplicatePolicyFilter] = useState<DuplicatePolicy | ''>('');
  const [appliedJobStatusFilter, setAppliedJobStatusFilter] = useState<JobStatus | ''>('');
  const [appliedJobDuplicatePolicyFilter, setAppliedJobDuplicatePolicyFilter] = useState<DuplicatePolicy | ''>('');
  const [form] = Form.useForm<DefaultsFormValues>();

  const [mapOverviewLoading, setMapOverviewLoading] = useState(false);
  const [mapOverviewError, setMapOverviewError] = useState<unknown | null>(null);
  const [mapOverview, setMapOverview] = useState<PatentMapOverview | null>(null);
  const [mapOverviewRegionLevel, setMapOverviewRegionLevel] = useState<PatentMapRegionScopeLevel>('PROVINCE');
  const [mapDataScope, setMapDataScope] = useState<PatentMapDataScope>('ACTIVE_APPROVED');
  const [mapOverviewTop, setMapOverviewTop] = useState(100);
  const [mapSelectedRegionCode, setMapSelectedRegionCode] = useState('');

  const [mapRegionPage, setMapRegionPage] = useState(1);
  const [mapRegionPageSize, setMapRegionPageSize] = useState(20);
  const [mapRegionDetailLoading, setMapRegionDetailLoading] = useState(false);
  const [mapRegionDetailError, setMapRegionDetailError] = useState<unknown | null>(null);
  const [mapRegionDetail, setMapRegionDetail] = useState<PatentMapRegionDetail | null>(null);
  const [mapSelectedListingRowKeys, setMapSelectedListingRowKeys] = useState<React.Key[]>([]);

  const [mapManualListingIdsText, setMapManualListingIdsText] = useState('');
  const [mapPatchRegionCode, setMapPatchRegionCode] = useState('');
  const [mapPatchFeaturedLevel, setMapPatchFeaturedLevel] = useState<PatentMapFeaturedLevel | ''>('');
  const [mapPatchFeaturedRegionCode, setMapPatchFeaturedRegionCode] = useState('');
  const [mapPatchFeaturedRank, setMapPatchFeaturedRank] = useState<number | null>(null);
  const [mapPatchFeaturedUntil, setMapPatchFeaturedUntil] = useState('');
  const [mapPatchClearRanking, setMapPatchClearRanking] = useState(false);
  const [mapPatchReason, setMapPatchReason] = useState('');
  const [mapBatchSubmitting, setMapBatchSubmitting] = useState(false);
  const [mapBatchResult, setMapBatchResult] = useState<PatentMapBatchUpdateResult | null>(null);

  const parsedPatentIdsCount = useMemo(() => parseTextList(patentIdsText).length, [patentIdsText]);
  const mapManualListingIds = useMemo(() => parseTextList(mapManualListingIdsText), [mapManualListingIdsText]);
  const mapSelectedListingIds = useMemo(
    () => mapSelectedListingRowKeys.map((it) => String(it)).filter(Boolean),
    [mapSelectedListingRowKeys],
  );
  const mapTargetListingIds = useMemo(
    () => Array.from(new Set([...mapSelectedListingIds, ...mapManualListingIds])),
    [mapManualListingIds, mapSelectedListingIds],
  );
  const mapSelectedRegion = useMemo(
    () => (mapOverview?.regions || []).find((it) => it.regionCode === mapSelectedRegionCode) || null,
    [mapOverview?.regions, mapSelectedRegionCode],
  );

  const loadJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<Paged<PatentImportJob>>('/admin/patents/jobs/import', {
        page: jobsPage,
        pageSize: jobsPageSize,
        status: appliedJobStatusFilter || undefined,
        duplicatePolicy: appliedJobDuplicatePolicyFilter || undefined,
      });
      setJobs(res);
    } catch (e: any) {
      setError(e);
      message.error(e?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [appliedJobDuplicatePolicyFilter, appliedJobStatusFilter, jobsPage, jobsPageSize]);

  const loadRows = useCallback(async () => {
    if (!activeJobId || !rowsOpen) return;
    setRowsLoading(true);
    try {
      const res = await apiGet<Paged<PatentImportJobRow>>(`/admin/patents/jobs/import/${activeJobId}/rows`, {
        page: rowsPage,
        pageSize: rowsPageSize,
        status: rowsAppliedStatus || undefined,
      });
      setRows(res);
    } catch (e: any) {
      message.error(e?.message || '加载任务明细失败');
    } finally {
      setRowsLoading(false);
    }
  }, [activeJobId, rowsAppliedStatus, rowsOpen, rowsPage, rowsPageSize]);

  const loadPatentMapOverview = useCallback(async () => {
    setMapOverviewLoading(true);
    setMapOverviewError(null);
    try {
      const data = await apiGet<PatentMapOverview>('/search/patent-map/overview', {
        regionLevel: mapOverviewRegionLevel,
        top: Math.max(1, Math.min(100, Number(mapOverviewTop) || 100)),
        scope: mapDataScope,
      });
      setMapOverview(data);
      let nextRegionCode = '';
      setMapSelectedRegionCode((prev) => {
        const current = String(prev || '').trim();
        const existed = (data.regions || []).some((item) => item.regionCode === current);
        nextRegionCode = existed ? current : data.ranking[0]?.regionCode || data.regions[0]?.regionCode || '';
        return nextRegionCode;
      });
      if (!nextRegionCode) {
        setMapRegionDetail(null);
      }
    } catch (e: any) {
      setMapOverview(null);
      setMapOverviewError(e);
      message.error(e?.message || '加载专利地图总览失败');
    } finally {
      setMapOverviewLoading(false);
    }
  }, [mapDataScope, mapOverviewRegionLevel, mapOverviewTop]);

  const loadPatentMapRegionDetail = useCallback(async () => {
    const regionCode = String(mapSelectedRegionCode || '').trim();
    if (!regionCode) {
      setMapRegionDetail(null);
      setMapRegionDetailError(null);
      return;
    }
    setMapRegionDetailLoading(true);
    setMapRegionDetailError(null);
    try {
      const data = await apiGet<PatentMapRegionDetail>(`/search/patent-map/regions/${regionCode}`, {
        page: mapRegionPage,
        pageSize: mapRegionPageSize,
        scope: mapDataScope,
      });
      setMapRegionDetail(data);
    } catch (e: any) {
      setMapRegionDetail(null);
      setMapRegionDetailError(e);
      message.error(e?.message || '加载区域挂牌明细失败');
    } finally {
      setMapRegionDetailLoading(false);
    }
  }, [mapDataScope, mapRegionPage, mapRegionPageSize, mapSelectedRegionCode]);

  const appendMapManualListingIds = useCallback(
    (listingIds: string[]) => {
      const merged = Array.from(
        new Set([
          ...mapManualListingIds,
          ...listingIds
            .map((item) => String(item || '').trim())
            .filter(Boolean),
        ]),
      );
      setMapManualListingIdsText(merged.join('\n'));
    },
    [mapManualListingIds],
  );

  const resetMapPatchFields = useCallback(() => {
    setMapPatchRegionCode('');
    setMapPatchFeaturedLevel('');
    setMapPatchFeaturedRegionCode('');
    setMapPatchFeaturedRank(null);
    setMapPatchFeaturedUntil('');
    setMapPatchClearRanking(false);
    setMapPatchReason('');
    setMapBatchResult(null);
  }, []);

  const runPatentMapBatchUpdate = useCallback(async () => {
    if (!mapTargetListingIds.length) {
      message.warning('请先选择或输入挂牌ID');
      return;
    }

    const patch: Record<string, unknown> = {};
    const regionCode = String(mapPatchRegionCode || '').trim();
    const featuredRegionCode = String(mapPatchFeaturedRegionCode || '').trim();
    const featuredUntil = String(mapPatchFeaturedUntil || '').trim();

    if (regionCode) patch.regionCode = regionCode;
    if (mapPatchFeaturedLevel) patch.featuredLevel = mapPatchFeaturedLevel;
    if (featuredRegionCode) patch.featuredRegionCode = featuredRegionCode;
    if (mapPatchFeaturedRank !== null && Number.isFinite(Number(mapPatchFeaturedRank))) {
      patch.featuredRank = Number(mapPatchFeaturedRank);
    }
    if (featuredUntil) patch.featuredUntil = featuredUntil;
    if (mapPatchClearRanking) patch.clearRanking = true;

    if (!Object.keys(patch).length) {
      message.warning('请至少设置一个变更字段');
      return;
    }

    try {
      setMapBatchSubmitting(true);
      const result = await apiPost<PatentMapBatchUpdateResult>(
        '/admin/patent-map/listings/batch',
        {
          listingIds: mapTargetListingIds,
          patch,
          reason: String(mapPatchReason || '').trim() || undefined,
        },
        { idempotencyKey: `admin-patent-map-listings-batch-${Date.now()}` },
      );
      setMapBatchResult(result);
      message.success(`批量更新完成：已更新 ${result.updatedCount} 条，缺失 ${result.missingListingIds.length} 条`);
      await Promise.all([loadPatentMapOverview(), loadPatentMapRegionDetail()]);
    } catch (e: any) {
      message.error(e?.message || '专利地图批量更新失败');
    } finally {
      setMapBatchSubmitting(false);
    }
  }, [
    loadPatentMapOverview,
    loadPatentMapRegionDetail,
    mapPatchClearRanking,
    mapPatchFeaturedLevel,
    mapPatchFeaturedRank,
    mapPatchFeaturedRegionCode,
    mapPatchFeaturedUntil,
    mapPatchReason,
    mapPatchRegionCode,
    mapTargetListingIds,
  ]);

  useEffect(() => {
    form.setFieldsValue({
      duplicatePolicy: 'SKIP',
      consultationRouting: 'PLATFORM',
      tradeMode: 'ASSIGNMENT',
      priceType: 'NEGOTIABLE',
      depositAmountYuan: 0,
      listingTopics: [],
    });
  }, [form]);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  useEffect(() => {
    void loadPatentMapOverview();
  }, [loadPatentMapOverview]);

  useEffect(() => {
    void loadPatentMapRegionDetail();
  }, [loadPatentMapRegionDetail]);

  useEffect(() => {
    setMapSelectedListingRowKeys([]);
  }, [mapSelectedRegionCode, mapRegionPage, mapRegionPageSize]);

  useEffect(() => {
    if (!activeJobId) return;
    const matched = (jobs?.items || []).find((it) => it.id === activeJobId) || null;
    if (matched) setActiveJob(matched);
  }, [activeJobId, jobs?.items]);

  const applyJobFilters = useCallback(() => {
    setJobsPage(1);
    setAppliedJobStatusFilter(draftJobStatusFilter);
    setAppliedJobDuplicatePolicyFilter(draftJobDuplicatePolicyFilter);
  }, [draftJobDuplicatePolicyFilter, draftJobStatusFilter]);

  const resetJobFilters = useCallback(() => {
    setJobsPage(1);
    setDraftJobStatusFilter('');
    setDraftJobDuplicatePolicyFilter('');
    setAppliedJobStatusFilter('');
    setAppliedJobDuplicatePolicyFilter('');
  }, []);

  const applyRowFilters = useCallback(() => {
    setRowsPage(1);
    setRowsAppliedStatus(rowsDraftStatus);
  }, [rowsDraftStatus]);

  const resetRowFilters = useCallback(() => {
    setRowsPage(1);
    setRowsDraftStatus('');
    setRowsAppliedStatus('');
  }, []);

  const downloadTemplate = useCallback(() => {
    const content = buildImportTemplateCsv();
    const date = new Date().toISOString().slice(0, 10);
    downloadTextFile(`patent-import-template-${date}.csv`, content, 'text/csv;charset=utf-8');
    message.success('模板下载已开始');
  }, []);

  const uploadExcel = useCallback(async (options: any) => {
    try {
      setUploading(true);
      const uploaded = await apiUploadFile(options.file as File, 'PATENT_IMPORT');
      setFile(uploaded);
      message.success('导入文件上传成功');
      options.onSuccess?.(uploaded);
    } catch (e: any) {
      message.error(e?.message || '上传失败');
      options.onError?.(e);
    } finally {
      setUploading(false);
    }
  }, []);

  const createImportJob = useCallback(
    async (autoExecute: boolean) => {
      if (!file?.id) {
        message.warning('请先上传导入文件');
        return;
      }
      const values = await form.validateFields();
      const built = buildListingDefaults(values);
      if (!built.payload) {
        message.error(built.error || '默认上架参数不合法');
        return;
      }
      try {
        setSubmitting(true);
        const created = await apiPost<{ id: string }>(
          '/admin/patents/jobs/import',
          { fileId: file.id, duplicatePolicy: values.duplicatePolicy, defaults: { listing: { enabled: true, ...built.payload } } },
          { idempotencyKey: `admin-patent-import-create-${Date.now()}` },
        );
        if (autoExecute) {
          await apiPost(`/admin/patents/jobs/import/${created.id}/validate`, {}, { idempotencyKey: `validate-${Date.now()}` });
          await apiPost(`/admin/patents/jobs/import/${created.id}/execute`, {}, { idempotencyKey: `execute-${Date.now()}` });
        }
        message.success(autoExecute ? '任务已创建并完成“校验+执行”' : '任务已创建，请在任务列表中执行“校验/执行”');
        await loadJobs();
      } catch (e: any) {
        message.error(e?.message || '创建任务失败');
      } finally {
        setSubmitting(false);
      }
    },
    [file?.id, form, loadJobs],
  );

  const validateJob = useCallback(
    async (jobId: string) => {
      try {
        setSubmitting(true);
        await apiPost(`/admin/patents/jobs/import/${jobId}/validate`, {}, { idempotencyKey: `admin-patent-import-validate-${jobId}-${Date.now()}` });
        message.success('任务校验完成');
        await Promise.all([loadJobs(), loadRows()]);
      } catch (e: any) {
        message.error(e?.message || '任务校验失败');
      } finally {
        setSubmitting(false);
      }
    },
    [loadJobs, loadRows],
  );

  const executeJob = useCallback(
    async (job: PatentImportJob) => {
      try {
        setSubmitting(true);
        await apiPost(`/admin/patents/jobs/import/${job.id}/execute`, {}, { idempotencyKey: `admin-patent-import-execute-${job.id}-${Date.now()}` });
        message.success(job.status === 'PAUSED' ? '任务已继续执行' : '任务已开始执行');
        await Promise.all([loadJobs(), loadRows()]);
      } catch (e: any) {
        message.error(e?.message || '执行任务失败');
      } finally {
        setSubmitting(false);
      }
    },
    [loadJobs, loadRows],
  );

  const downloadErrorFile = useCallback(async (fileId?: string | null) => {
    if (!fileId) {
      message.warning('当前任务暂无错误文件');
      return;
    }
    try {
      const temp = await apiPost<{ url: string }>(`/files/${fileId}/temporary-access`, { scope: 'download' });
      if (!temp?.url) throw new Error('empty url');
      window.open(temp.url, '_blank', 'noopener,noreferrer');
    } catch (e: any) {
      message.error(e?.message || '下载错误文件失败');
    }
  }, []);

  const runBatchGenerate = useCallback(async () => {
    const patentIds = parseTextList(patentIdsText);
    if (!patentIds.length) {
      message.warning('请先输入专利ID列表');
      return;
    }
    const values = await form.validateFields();
    const built = buildListingDefaults(values);
    if (!built.payload) {
      message.error(built.error || '默认上架参数不合法');
      return;
    }
    try {
      setSubmitting(true);
      const result = await apiPost<PatentListingGenerateResult>(
        '/admin/patents/jobs/listings',
        { patentIds, duplicatePolicy: values.duplicatePolicy, listingDefaults: built.payload },
        { idempotencyKey: `admin-patent-listings-${Date.now()}` },
      );
      setGenerateResult(result);
      message.success(`批量上架执行完成：成功 ${result.successCount}，失败 ${result.failedCount}，跳过 ${result.skippedCount}`);
    } catch (e: any) {
      message.error(e?.message || '批量上架失败');
    } finally {
      setSubmitting(false);
    }
  }, [form, patentIdsText]);

  const openRows = useCallback((job: PatentImportJob) => {
    setActiveJobId(job.id);
    setActiveJob(job);
    setRowsPage(1);
    setRowsPageSize(50);
    setRowsDraftStatus('');
    setRowsAppliedStatus('');
    setRowsOpen(true);
  }, []);

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card>
        <Typography.Title level={3} style={{ marginTop: 0 }}>
          专利批量运营
        </Typography.Title>
        <Typography.Paragraph type="secondary">
          提供模板下载、导入指引、任务校验与执行、失败回溯，降低运营批量导入出错率。
        </Typography.Paragraph>
        {error ? <RequestErrorAlert error={error} onRetry={loadJobs} /> : null}

        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Alert
            showIcon
            type="info"
            message="导入前请先下载模板，保持表头不变"
            description={
              <Space direction="vertical" size={2}>
                <Typography.Text type="secondary">必填列：申请号、发明名称、专利类型。</Typography.Text>
                <Typography.Text type="secondary">支持 .xlsx / .xls / .csv（Excel 兼容 CSV 模板）。</Typography.Text>
                <Typography.Text type="secondary">单次导入建议控制在 5000 行以内。</Typography.Text>
              </Space>
            }
          />

          <Space wrap>
            <Button onClick={downloadTemplate}>下载导入模板（Excel兼容CSV）</Button>
            <Upload
              accept=".xlsx,.xls,.csv"
              showUploadList={false}
              customRequest={uploadExcel}
              disabled={uploading || submitting}
            >
              <Button loading={uploading}>上传导入文件</Button>
            </Upload>
            <Typography.Text type="secondary">{file?.id ? `文件ID：${file.id}` : '未上传文件'}</Typography.Text>
          </Space>

          <Table<ImportTemplateField>
            rowKey="header"
            size="small"
            pagination={false}
            dataSource={patentImportTemplateFields}
            columns={[
              { title: '模板列名', dataIndex: 'header', width: 180 },
              { title: '必填', dataIndex: 'required', width: 80, render: (v: boolean) => (v ? <Tag color="red">是</Tag> : <Tag>否</Tag>) },
              { title: '说明', dataIndex: 'description' },
              { title: '示例', dataIndex: 'example', width: 280, render: (v: string) => <Typography.Text code>{v}</Typography.Text> },
            ]}
          />

          <Form form={form} layout="vertical">
            <Space wrap>
              <Form.Item label="重复策略" name="duplicatePolicy" rules={[{ required: true }]}>
                <Select style={{ width: 160 }} options={duplicatePolicyOptions} />
              </Form.Item>
              <Form.Item label="咨询路由" name="consultationRouting" rules={[{ required: true }]}>
                <Select style={{ width: 160 }} options={consultationRoutingOptions} />
              </Form.Item>
              <Form.Item label="交易模式" name="tradeMode" rules={[{ required: true }]}>
                <Select style={{ width: 160 }} options={tradeModeOptions} />
              </Form.Item>
              <Form.Item label="许可模式" name="licenseMode">
                <Select style={{ width: 160 }} allowClear options={licenseModeOptions} />
              </Form.Item>
              <Form.Item label="价格模式" name="priceType" rules={[{ required: true }]}>
                <Select style={{ width: 140 }} options={priceTypeOptions} />
              </Form.Item>
              <Form.Item label="挂牌价格(元)" name="priceAmountYuan">
                <InputNumber min={0.01} precision={2} />
              </Form.Item>
              <Form.Item label="保证金(元)" name="depositAmountYuan">
                <InputNumber min={0} precision={2} />
              </Form.Item>
              <Form.Item label="平台卖家用户ID" name="sellerUserId">
                <Input style={{ width: 220 }} />
              </Form.Item>
            </Space>
            <Form.Item label="特色标签" name="listingTopics">
              <Select mode="multiple" allowClear options={listingTopicOptions} />
            </Form.Item>
            <Form.Item label="行业标签（逗号/分号/换行分隔）" name="industryTagsText">
              <Input.TextArea rows={2} />
            </Form.Item>
          </Form>

          <Space>
            <Button type="primary" loading={submitting} onClick={() => void createImportJob(false)}>
              创建导入任务
            </Button>
            <Button loading={submitting} onClick={() => void createImportJob(true)}>
              创建并校验执行
            </Button>
            <Button onClick={() => void loadJobs()}>刷新任务</Button>
          </Space>
        </Space>
      </Card>

      <Card title="按专利ID批量上架">
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Input.TextArea
            rows={4}
            value={patentIdsText}
            onChange={(e) => setPatentIdsText(e.target.value)}
            placeholder="每行一个专利ID，或逗号分隔"
          />
          <Typography.Text type="secondary">已识别 {parsedPatentIdsCount} 个专利ID（自动去重）</Typography.Text>
          <Button type="primary" loading={submitting} onClick={() => void runBatchGenerate()}>
            执行批量上架
          </Button>
          {generateResult ? (
            <Typography.Text type="secondary">
              总 {generateResult.totalCount}，成功 {generateResult.successCount}，失败 {generateResult.failedCount}，跳过 {generateResult.skippedCount}
            </Typography.Text>
          ) : null}
        </Space>
      </Card>

      <Card title="导入任务列表">
        <Space wrap style={{ marginBottom: 12 }}>
          <Select
            value={draftJobStatusFilter}
            style={{ width: 160 }}
            onChange={(v) => setDraftJobStatusFilter((v as JobStatus) || '')}
            options={[
              { value: '', label: '全部状态' },
              { value: 'PENDING', label: 'PENDING' },
              { value: 'RUNNING', label: 'RUNNING' },
              { value: 'PAUSED', label: 'PAUSED' },
              { value: 'SUCCEEDED', label: 'SUCCEEDED' },
              { value: 'FAILED', label: 'FAILED' },
            ]}
          />
          <Select
            value={draftJobDuplicatePolicyFilter}
            style={{ width: 160 }}
            onChange={(v) => setDraftJobDuplicatePolicyFilter((v as DuplicatePolicy) || '')}
            options={[
              { value: '', label: '全部策略' },
              { value: 'SKIP', label: 'SKIP' },
              { value: 'OVERWRITE', label: 'OVERWRITE' },
            ]}
          />
          <Button onClick={applyJobFilters}>查询</Button>
          <Button onClick={resetJobFilters}>重置</Button>
        </Space>
        <Table<PatentImportJob>
          rowKey="id"
          loading={loading}
          dataSource={jobs?.items || []}
          pagination={{
            current: jobs?.page.page || jobsPage,
            pageSize: jobs?.page.pageSize || jobsPageSize,
            total: jobs?.page.total || 0,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50'],
            onChange: (nextPage, nextPageSize) => {
              setJobsPage(nextPage);
              if (nextPageSize && nextPageSize !== jobsPageSize) {
                setJobsPageSize(nextPageSize);
              }
            },
          }}
          columns={[
            { title: '任务ID', dataIndex: 'id', width: 260 },
            { title: '状态', dataIndex: 'status', width: 110, render: (v: JobStatus) => statusTag(v) },
            { title: '策略', dataIndex: 'duplicatePolicy', width: 90 },
            {
              title: '统计',
              render: (_, r) => `总 ${r.totalCount}/有效 ${r.validCount}/无效 ${r.invalidCount}/成功 ${r.successCount}/失败 ${r.failedCount}/跳过 ${r.skippedCount}`,
            },
            { title: '失败率', dataIndex: 'failRate', width: 100, render: (v: number) => `${Math.round((Number(v) || 0) * 100)}%` },
            { title: '已校验', dataIndex: 'validatedAt', width: 160, render: (v: string | null | undefined) => (v ? formatTimeSmart(v) : '-') },
            { title: '创建时间', dataIndex: 'createdAt', width: 150, render: (v: string) => formatTimeSmart(v) },
            {
              title: '操作',
              width: 340,
              render: (_, r) => (
                <Space>
                  <Button size="small" onClick={() => openRows(r)}>
                    查看明细
                  </Button>
                  <Button size="small" loading={submitting} disabled={r.status === 'RUNNING'} onClick={() => void validateJob(r.id)}>
                    校验
                  </Button>
                  <Button
                    size="small"
                    type="primary"
                    loading={submitting}
                    disabled={r.status === 'RUNNING' || !r.validatedAt}
                    onClick={() => void executeJob(r)}
                  >
                    {r.status === 'PAUSED' ? '继续执行' : '执行'}
                  </Button>
                  <Button size="small" disabled={!r.errorFileId} onClick={() => void downloadErrorFile(r.errorFileId)}>
                    错误文件
                  </Button>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Card title="专利地图批量管理">
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
            先按区域查看地图分布与排名，再批量调整挂牌地区与上榜参数。地图数据直接复用挂牌与地区主数据，不新增冗余表。
          </Typography.Paragraph>

          {mapOverviewError ? <RequestErrorAlert error={mapOverviewError} onRetry={loadPatentMapOverview} /> : null}

          <Space wrap>
            <Select
              value={mapOverviewRegionLevel}
              style={{ width: 160 }}
              options={patentMapRegionLevelOptions}
              onChange={(value) => {
                setMapOverviewRegionLevel(value as PatentMapRegionScopeLevel);
                setMapRegionPage(1);
              }}
            />
            <Select
              value={mapDataScope}
              style={{ width: 180 }}
              options={patentMapDataScopeOptions}
              onChange={(value) => {
                setMapDataScope(value as PatentMapDataScope);
                setMapRegionPage(1);
              }}
            />
            <InputNumber
              min={1}
              max={100}
              value={mapOverviewTop}
              onChange={(value) => setMapOverviewTop(value == null ? 100 : Number(value))}
            />
            <Button loading={mapOverviewLoading} onClick={() => void loadPatentMapOverview()}>
              加载地图总览
            </Button>
            <Typography.Text type="secondary">
              {mapOverview?.generatedAt ? `总览时间：${formatTimeSmart(mapOverview.generatedAt)}` : '尚未加载总览'}
            </Typography.Text>
          </Space>

          {mapOverview ? (
            <Space wrap>
              <Tag color="purple">\u8303\u56f4 {mapOverview.filters.scope}</Tag>
              <Tag color="blue">\u6302\u724c {mapOverview.summary.totalListingCount}</Tag>
              <Tag color="green">\u4e13\u5229 {mapOverview.summary.totalPatentCount}</Tag>
              <Tag color="gold">\u6d3b\u8dc3\u4e0a\u699c {mapOverview.summary.activeRankedListingCount}</Tag>
              <Tag>\u533a\u57df {mapOverview.summary.totalRegionCount}</Tag>
              <Tag color="cyan">\u6709\u6302\u724c\u533a\u57df {mapOverview.summary.regionsWithListingsCount}</Tag>
              <Tag>\u672a\u5f52\u5c5e\u6302\u724c {mapOverview.summary.unassignedListingCount}</Tag>
            </Space>
          ) : null}

          <Table<PatentMapRegionItem>
            rowKey="regionCode"
            size="small"
            loading={mapOverviewLoading}
            dataSource={mapOverview?.ranking || []}
            pagination={false}
            columns={[
              {
                title: '排名',
                dataIndex: 'rankPosition',
                width: 80,
                render: (value: number) => <Typography.Text strong>#{value}</Typography.Text>,
              },
              {
                title: '区域',
                render: (_, row) => (
                  <Space size={4}>
                    <Typography.Text>{row.regionName}</Typography.Text>
                    <Tag>{row.regionCode}</Tag>
                    <Tag color="purple">{patentMapRegionLevelLabel(row.regionLevel)}</Tag>
                  </Space>
                ),
              },
              { title: '挂牌数', dataIndex: 'listingCount', width: 100 },
              { title: '专利数', dataIndex: 'patentCount', width: 100 },
              { title: '活跃上榜', dataIndex: 'activeRankedListingCount', width: 110 },
              {
                title: '最佳名次',
                dataIndex: 'topActiveRank',
                width: 110,
                render: (value: number | null) => (value === null ? '-' : `#${value}`),
              },
              {
                title: '操作',
                width: 120,
                render: (_, row) => (
                  <Button
                    size="small"
                    type={row.regionCode === mapSelectedRegionCode ? 'primary' : 'default'}
                    onClick={() => {
                      setMapSelectedRegionCode(row.regionCode);
                      setMapRegionPage(1);
                    }}
                  >
                    查看挂牌
                  </Button>
                ),
              },
            ]}
          />

          <Space wrap>
            <Typography.Text strong>
              当前区域：{mapSelectedRegion ? `${mapSelectedRegion.regionName}（${mapSelectedRegion.regionCode}）` : '未选择'}
            </Typography.Text>
            <Button
              size="small"
              onClick={() => appendMapManualListingIds((mapRegionDetail?.items || []).map((item) => item.listingId))}
              disabled={!mapRegionDetail?.items?.length}
            >
              将当前页挂牌ID加入批量输入
            </Button>
            <Button
              size="small"
              onClick={() => {
                if (!mapSelectedRegionCode) return;
                setMapPatchRegionCode(mapSelectedRegionCode);
                setMapPatchFeaturedRegionCode(mapSelectedRegionCode);
              }}
              disabled={!mapSelectedRegionCode}
            >
              使用当前区域编码
            </Button>
            <Button size="small" onClick={() => void loadPatentMapRegionDetail()} disabled={!mapSelectedRegionCode}>
              刷新区域明细
            </Button>
          </Space>

          {mapRegionDetailError ? <RequestErrorAlert error={mapRegionDetailError} onRetry={loadPatentMapRegionDetail} /> : null}

          <Table<PatentMapRegionDetail['items'][number]>
            rowKey="listingId"
            size="small"
            loading={mapRegionDetailLoading}
            dataSource={mapRegionDetail?.items || []}
            rowSelection={{
              selectedRowKeys: mapSelectedListingRowKeys,
              onChange: setMapSelectedListingRowKeys,
            }}
            pagination={{
              current: mapRegionDetail?.page.page || mapRegionPage,
              pageSize: mapRegionDetail?.page.pageSize || mapRegionPageSize,
              total: mapRegionDetail?.page.total || 0,
              showSizeChanger: true,
              pageSizeOptions: ['10', '20', '50'],
              onChange: (nextPage, nextPageSize) => {
                setMapRegionPage(nextPage);
                if (nextPageSize && nextPageSize !== mapRegionPageSize) {
                  setMapRegionPageSize(nextPageSize);
                }
              },
            }}
            columns={[
              { title: '挂牌ID', dataIndex: 'listingId', width: 240 },
              { title: '标题', dataIndex: 'title', ellipsis: true },
              {
                title: '专利类型',
                dataIndex: 'patentType',
                width: 110,
                render: (value: PatentMapRegionDetail['items'][number]['patentType']) => value || '-',
              },
              { title: '申请号', dataIndex: 'applicationNoDisplay', width: 160, render: (value: string | null) => value || '-' },
              {
                title: '上榜状态',
                width: 220,
                render: (_, row) =>
                  row.featuredLevel === 'NONE' ? (
                    <Typography.Text type="secondary">未上榜</Typography.Text>
                  ) : (
                    <Space size={4}>
                      <Tag color={row.isFeaturedActive ? 'green' : 'default'}>
                        {patentMapFeaturedLevelLabel(row.featuredLevel)}
                        {row.featuredRank !== null ? ` #${row.featuredRank}` : ''}
                      </Tag>
                      {!row.isFeaturedActive ? <Tag>已过期</Tag> : null}
                    </Space>
                  ),
              },
              { title: '更新时间', dataIndex: 'updatedAt', width: 160, render: (value: string) => formatTimeSmart(value) },
            ]}
          />

          <Input.TextArea
            rows={4}
            value={mapManualListingIdsText}
            onChange={(e) => setMapManualListingIdsText(e.target.value)}
            placeholder="手工补充挂牌ID（每行一个或逗号分隔）"
          />
          <Typography.Text type="secondary">
            选择 {mapSelectedListingIds.length} 条 + 手工输入 {mapManualListingIds.length} 条 = 合计 {mapTargetListingIds.length} 条（自动去重）
          </Typography.Text>

          <Space wrap>
            <Input
              value={mapPatchRegionCode}
              onChange={(e) => setMapPatchRegionCode(e.target.value)}
              placeholder="挂牌地区编码（如 110000）"
              style={{ width: 180 }}
              allowClear
            />
            <Select
              value={mapPatchFeaturedLevel}
              style={{ width: 180 }}
              options={patentMapFeaturedLevelPatchOptions}
              onChange={(value) => setMapPatchFeaturedLevel((value as PatentMapFeaturedLevel) || '')}
            />
            <Input
              value={mapPatchFeaturedRegionCode}
              onChange={(e) => setMapPatchFeaturedRegionCode(e.target.value)}
              placeholder="上榜地区编码（如 110000）"
              style={{ width: 190 }}
              allowClear
            />
            <InputNumber
              min={0}
              precision={0}
              value={mapPatchFeaturedRank}
              onChange={(value) => setMapPatchFeaturedRank(value == null ? null : Number(value))}
              placeholder="上榜名次"
            />
            <Input
              value={mapPatchFeaturedUntil}
              onChange={(e) => setMapPatchFeaturedUntil(e.target.value)}
              placeholder="上榜截止时间（ISO 8601）"
              style={{ width: 220 }}
              allowClear
            />
            <Space size={4}>
              <Typography.Text>清除上榜</Typography.Text>
              <Switch checked={mapPatchClearRanking} onChange={setMapPatchClearRanking} />
            </Space>
          </Space>

          <Input
            value={mapPatchReason}
            onChange={(e) => setMapPatchReason(e.target.value)}
            placeholder="变更原因（选填，建议记录批量操作目的）"
            allowClear
          />

          <Space>
            <Button type="primary" loading={mapBatchSubmitting} onClick={() => void runPatentMapBatchUpdate()}>
              执行地图批量更新
            </Button>
            <Button onClick={resetMapPatchFields}>清空变更字段</Button>
            <Button onClick={() => setMapManualListingIdsText('')}>清空手工挂牌ID</Button>
          </Space>

          {mapBatchResult ? (
            <Alert
              showIcon
              type="success"
              message={`批量处理完成：请求 ${mapBatchResult.totalRequested}，更新 ${mapBatchResult.updatedCount}，缺失 ${mapBatchResult.missingListingIds.length}`}
              description={
                <Space direction="vertical" size={2}>
                  <Typography.Text type="secondary">
                    patch: {JSON.stringify(mapBatchResult.patchApplied)}
                  </Typography.Text>
                  {mapBatchResult.missingListingIds.length ? (
                    <Typography.Text type="secondary">
                      missing: {mapBatchResult.missingListingIds.join(', ')}
                    </Typography.Text>
                  ) : null}
                </Space>
              }
            />
          ) : null}
        </Space>
      </Card>

      <Drawer
        open={rowsOpen}
        width={1080}
        title={activeJobId ? `任务明细 ${activeJobId}` : '任务明细'}
        onClose={() => setRowsOpen(false)}
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          {activeJob ? (
            <Alert
              showIcon
              type="info"
              message={`任务统计：总 ${activeJob.totalCount}，有效 ${activeJob.validCount}，无效 ${activeJob.invalidCount}，成功 ${activeJob.successCount}，失败 ${activeJob.failedCount}，跳过 ${activeJob.skippedCount}`}
            />
          ) : null}
          <Space wrap>
            <Select
              value={rowsDraftStatus}
              style={{ width: 180 }}
              options={rowStatusOptions}
              onChange={(v) => setRowsDraftStatus((v as ImportRowStatus) || '')}
            />
            <Button onClick={applyRowFilters}>查询</Button>
            <Button onClick={resetRowFilters}>重置</Button>
            <Button onClick={() => void loadRows()}>刷新</Button>
          </Space>
          <Table<PatentImportJobRow>
            rowKey="id"
            loading={rowsLoading}
            dataSource={rows?.items || []}
            pagination={{
              current: rows?.page.page || rowsPage,
              pageSize: rows?.page.pageSize || rowsPageSize,
              total: rows?.page.total || 0,
              showSizeChanger: true,
              pageSizeOptions: ['20', '50', '100', '200'],
              onChange: (nextPage, nextPageSize) => {
                setRowsPage(nextPage);
                if (nextPageSize && nextPageSize !== rowsPageSize) {
                  setRowsPageSize(nextPageSize);
                }
              },
            }}
            columns={[
              { title: '行号', dataIndex: 'rowNo', width: 80 },
              { title: '状态', dataIndex: 'status', width: 120, render: (v: ImportRowStatus) => statusTag(v) },
              { title: '申请号', render: (_, r) => String(r.normalized?.applicationNoNorm || '-') },
              { title: '标题', render: (_, r) => String(r.normalized?.title || '-') },
              { title: '专利ID', dataIndex: 'patentId', render: (v: string | null | undefined) => v || '-' },
              { title: '错误码', dataIndex: 'errorCode', width: 160, render: (v: string | null | undefined) => v || '-' },
              { title: '错误信息', dataIndex: 'errorMessage', render: (v: string | null | undefined) => v || '-' },
            ]}
          />
        </Space>
      </Drawer>
    </Space>
  );
}
