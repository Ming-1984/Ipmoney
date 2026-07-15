import { Alert, Button, Card, Drawer, Form, Input, InputNumber, Select, Space, Switch, Table, Tag, Typography, Upload, message } from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { components } from '@ipmoney/api-types';

import { apiGet, apiPost, apiUploadFile, type FileObject } from '../lib/api';
import { formatTimeSmart, yuanToFen } from '../lib/format';
import {
  DEFAULT_LISTING_TOPIC_OPTIONS,
  fetchAdminListingTopicOptions,
} from '../lib/homeLandingConfig';
import { displayAdminInfo, formatRegionCodeDisplay, normalizeUserFacingText } from '../lib/userFacingText';
import { RequestErrorAlert } from '../ui/RequestState';

type ConsultationRouting = 'PLATFORM' | 'OWNER';
type ListingTradeMode = 'ASSIGNMENT' | 'LICENSE';
type LicenseMode = 'EXCLUSIVE' | 'SOLE' | 'NON_EXCLUSIVE';
type PriceType = 'FIXED' | 'NEGOTIABLE';
type ListingTopic = components['schemas']['ListingTopic'];
type DuplicatePolicy = 'SKIP' | 'OVERWRITE';
type JobStatus = 'PENDING' | 'RUNNING' | 'PAUSED' | 'SUCCEEDED' | 'FAILED';
type ImportRowStatus = 'PENDING' | 'VALID' | 'INVALID' | 'SUCCEEDED' | 'FAILED' | 'SKIPPED';

type Paged<T> = { items: T[]; page: { page: number; pageSize: number; total: number } };

type StaffUser = {
  id: string;
  name?: string;
  email?: string;
};

type StaffUserListResponse = {
  items?: StaffUser[];
};

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

function staffDisplayName(user: StaffUser | null | undefined, fallback = '未命名员工'): string {
  return normalizeUserFacingText(user?.name) || normalizeUserFacingText(user?.email) || fallback;
}

function patentImportJobSummary(job: PatentImportJob): string {
  return `总 ${job.totalCount} / 有效 ${job.validCount} / 无效 ${job.invalidCount} / 成功 ${job.successCount} / 失败 ${job.failedCount} / 跳过 ${job.skippedCount}`;
}

function patentMapListingSummary(item: PatentMapRegionDetail['items'][number]): string {
  const title = normalizeUserFacingText(item.title) || '挂牌标题待确认';
  const patentTitle = normalizeUserFacingText(item.patentTitle);
  const applicationNo = normalizeUserFacingText(item.applicationNoDisplay);
  return [title, patentTitle, applicationNo ? `申请号：${applicationNo}` : ''].filter(Boolean).join(' · ');
}

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
  return '层级待确认';
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
  { value: 'VALID', label: '校验通过' },
  { value: 'INVALID', label: '校验失败' },
  { value: 'SUCCEEDED', label: '已完成' },
  { value: 'FAILED', label: '失败' },
  { value: 'SKIPPED', label: '已跳过' },
  { value: 'PENDING', label: '待处理' },
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
    if (!sellerUserId) return { error: '平台客服路由必须选择平台承接人员' };
    listingDefaults.sellerUserId = sellerUserId;
  }
  if (values.tradeMode === 'LICENSE') {
    if (!values.licenseMode) return { error: '许可模式不能为空' };
    listingDefaults.licenseMode = values.licenseMode;
  }
  if (values.tradeMode !== 'LICENSE' && Array.isArray(values.listingTopics) && values.listingTopics.includes('OPEN_LICENSE')) {
    return { error: '开放许可标签仅可用于许可交易模式' };
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
  const label =
    text === 'SUCCEEDED'
      ? '已完成'
      : text === 'VALID'
        ? '校验通过'
        : text === 'FAILED'
          ? '失败'
          : text === 'INVALID'
            ? '校验失败'
            : text === 'RUNNING'
              ? '执行中'
              : text === 'PAUSED'
                ? '已暂停'
                : text === 'SKIPPED'
                  ? '已跳过'
                  : '状态待确认';
  if (text === 'SUCCEEDED' || text === 'VALID') return <Tag color="green">{label}</Tag>;
  if (text === 'FAILED' || text === 'INVALID') return <Tag color="red">{label}</Tag>;
  if (text === 'RUNNING') return <Tag color="blue">{label}</Tag>;
  if (text === 'PAUSED') return <Tag color="orange">{label}</Tag>;
  if (text === 'SKIPPED') return <Tag>{label}</Tag>;
  return <Tag>{label}</Tag>;
}

function duplicatePolicyLabel(policy?: DuplicatePolicy | null): string {
  if (policy === 'OVERWRITE') return '覆盖更新';
  if (policy === 'SKIP') return '跳过重复';
  return '策略待确认';
}

function summarizeDisplayValue(value: unknown): string {
  if (value === null) return '清空';
  if (value === undefined) return '';
  if (typeof value === 'boolean') return value ? '是' : '否';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  if (Array.isArray(value)) {
    return value
      .map((item) => summarizeDisplayValue(item))
      .filter(Boolean)
      .join('、');
  }
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => {
        const text = summarizeDisplayValue(item);
        return text ? `${key}：${text}` : '';
      })
      .filter(Boolean)
      .join('；');
  }
  return normalizeUserFacingText(value);
}

function patentMapPatchLabel(key: string): string {
  if (key === 'regionCode') return '挂牌地区';
  if (key === 'featuredLevel') return '上榜层级';
  if (key === 'featuredRegionCode') return '上榜地区';
  if (key === 'featuredRank') return '上榜名次';
  if (key === 'featuredUntil') return '上榜截止时间';
  if (key === 'clearRanking') return '清除上榜';
  return key;
}

function patentMapPatchSummary(patch: Record<string, unknown>): string {
  return (
    Object.entries(patch)
      .map(([key, value]) => {
        const text = summarizeDisplayValue(value);
        return text ? `${patentMapPatchLabel(key)}：${text}` : '';
      })
      .filter(Boolean)
      .join('；') || '未返回变更字段'
  );
}

function patentImportRowSummary(row: PatentImportJobRow): string {
  const normalized = row.normalized;
  if (!normalized) return '';
  const fields: Array<[string, unknown]> = [
    ['申请号', normalized.applicationNoDisplay || normalized.applicationNoNorm],
    ['标题', normalized.title],
    ['专利类型', normalized.patentType],
    ['法律状态', normalized.legalStatus],
    ['申请人', normalized.applicants],
    ['发明人', normalized.inventors],
  ];
  const summary = fields
    .map(([label, value]) => {
      const text = summarizeDisplayValue(value);
      return text ? `${label}：${text}` : '';
    })
    .filter(Boolean)
    .join('；');
  return summary || '已生成标准化字段';
}

const jobStatusFilterOptions: Array<{ value: JobStatus | ''; label: string }> = [
  { value: '', label: '全部状态' },
  { value: 'PENDING', label: '待处理' },
  { value: 'RUNNING', label: '执行中' },
  { value: 'PAUSED', label: '已暂停' },
  { value: 'SUCCEEDED', label: '已完成' },
  { value: 'FAILED', label: '失败' },
];

const duplicatePolicyFilterOptions: Array<{ value: DuplicatePolicy | ''; label: string }> = [
  { value: '', label: '全部策略' },
  { value: 'SKIP', label: '跳过重复' },
  { value: 'OVERWRITE', label: '覆盖更新' },
];

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
  const tradeModeValue = Form.useWatch('tradeMode', form);
  const [listingTopicOptions, setListingTopicOptions] =
    useState<Array<{ value: ListingTopic; label: string }>>(DEFAULT_LISTING_TOPIC_OPTIONS);
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);

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
  const [mapPatchClearRegionCode, setMapPatchClearRegionCode] = useState(false);
  const [mapPatchFeaturedLevel, setMapPatchFeaturedLevel] = useState<PatentMapFeaturedLevel | ''>('');
  const [mapPatchFeaturedRegionCode, setMapPatchFeaturedRegionCode] = useState('');
  const [mapPatchClearFeaturedRegionCode, setMapPatchClearFeaturedRegionCode] = useState(false);
  const [mapPatchFeaturedRank, setMapPatchFeaturedRank] = useState<number | null>(null);
  const [mapPatchFeaturedUntil, setMapPatchFeaturedUntil] = useState('');
  const [mapPatchClearFeaturedUntil, setMapPatchClearFeaturedUntil] = useState(false);
  const [mapPatchClearRanking, setMapPatchClearRanking] = useState(false);
  const [mapPatchReason, setMapPatchReason] = useState('');
  const [mapBatchSubmitting, setMapBatchSubmitting] = useState(false);
  const [mapBatchResult, setMapBatchResult] = useState<PatentMapBatchUpdateResult | null>(null);
  const [templateTablePage, setTemplateTablePage] = useState(1);
  const [templateTablePageSize, setTemplateTablePageSize] = useState(10);
  const [mapRankingTablePage, setMapRankingTablePage] = useState(1);
  const [mapRankingTablePageSize, setMapRankingTablePageSize] = useState(20);

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
  const enabledTopicSet = useMemo(
    () => new Set<ListingTopic>(listingTopicOptions.map((item) => item.value)),
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
    setMapPatchClearRegionCode(false);
    setMapPatchFeaturedLevel('');
    setMapPatchFeaturedRegionCode('');
    setMapPatchClearFeaturedRegionCode(false);
    setMapPatchFeaturedRank(null);
    setMapPatchFeaturedUntil('');
    setMapPatchClearFeaturedUntil(false);
    setMapPatchClearRanking(false);
    setMapPatchReason('');
    setMapBatchResult(null);
  }, []);

  const runPatentMapBatchUpdate = useCallback(async () => {
    if (!mapTargetListingIds.length) {
      message.warning('请先选择或输入挂牌记录编号');
      return;
    }

    const patch: Record<string, unknown> = {};
    const regionCode = String(mapPatchRegionCode || '').trim();
    const featuredRegionCode = String(mapPatchFeaturedRegionCode || '').trim();
    const featuredUntil = String(mapPatchFeaturedUntil || '').trim();

    if (mapPatchClearRegionCode) {
      patch.regionCode = null;
    } else if (regionCode) {
      patch.regionCode = regionCode;
    }
    if (mapPatchFeaturedLevel) patch.featuredLevel = mapPatchFeaturedLevel;
    if (mapPatchFeaturedLevel && mapPatchFeaturedLevel !== 'NONE' && mapPatchClearFeaturedRegionCode) {
      message.warning('设置上榜级别时，不能同时清空上榜地区。');
      return;
    }
    if (mapPatchClearFeaturedRegionCode) {
      patch.featuredRegionCode = null;
    } else if (featuredRegionCode) {
      patch.featuredRegionCode = featuredRegionCode;
    }
    if (mapPatchFeaturedRank !== null && Number.isFinite(Number(mapPatchFeaturedRank))) {
      patch.featuredRank = Number(mapPatchFeaturedRank);
    }
    if (mapPatchClearFeaturedUntil) {
      patch.featuredUntil = null;
    } else if (featuredUntil) {
      patch.featuredUntil = featuredUntil;
    }
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
    mapPatchClearFeaturedRegionCode,
    mapPatchClearFeaturedUntil,
    mapPatchClearRegionCode,
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
    (async () => {
      const options = await fetchAdminListingTopicOptions();
      setListingTopicOptions(options);
    })();
  }, []);

  useEffect(() => {
    const current = form.getFieldValue('listingTopics') as ListingTopic[] | undefined;
    if (!Array.isArray(current) || !current.length) return;
    const next = current.filter(
      (topic) => enabledTopicSet.has(topic) && (tradeModeValue === 'LICENSE' || topic !== 'OPEN_LICENSE'),
    );
    if (next.length === current.length) return;
    form.setFieldsValue({ listingTopics: next });
  }, [enabledTopicSet, form, tradeModeValue]);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

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
      message.warning('请先输入专利记录编号列表');
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
    setRows(null);
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
          专利批量处理
        </Typography.Title>
        <Typography.Paragraph type="secondary">
          按“下载模板并上传数据、设置本次处理方式、查看处理结果”的顺序完成专利批量处理。系统内部检查和执行会自动完成。
        </Typography.Paragraph>
        {error ? <RequestErrorAlert error={error} onRetry={loadJobs} /> : null}

        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Alert
            showIcon
            type="info"
            message="1. 先下载模板并准备本次要处理的数据"
            description={
              <Space direction="vertical" size={2}>
                <Typography.Text type="secondary">必填列：申请号、发明名称、专利类型。</Typography.Text>
                <Typography.Text type="secondary">支持 .xlsx / .xls / .csv（Excel 兼容 CSV 模板）。</Typography.Text>
                <Typography.Text type="secondary">单次导入建议控制在 5000 行以内。</Typography.Text>
              </Space>
            }
          />

          <Space wrap>
            <Button onClick={downloadTemplate}>下载专利导入模板（Excel兼容 CSV）</Button>
            <Upload
              accept=".xlsx,.xls,.csv"
              showUploadList={false}
              customRequest={uploadExcel}
              disabled={uploading || submitting}
            >
              <Button loading={uploading}>上传处理文件</Button>
            </Upload>
            <Typography.Text type="secondary">{file?.id ? '已选择本次处理文件' : '还未上传处理文件'}</Typography.Text>
          </Space>

          <Table<ImportTemplateField>
            rowKey="header"
            size="small"
            pagination={{
              current: templateTablePage,
              pageSize: templateTablePageSize,
              total: patentImportTemplateFields.length,
              showSizeChanger: true,
              pageSizeOptions: ['10', '20', '50'],
              onChange: (nextPage, nextPageSize) => {
                setTemplateTablePage(nextPage);
                if (nextPageSize && nextPageSize !== templateTablePageSize) {
                  setTemplateTablePageSize(nextPageSize);
                  setTemplateTablePage(1);
                }
              },
            }}
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
              <Form.Item label="2. 重复数据怎么处理" name="duplicatePolicy" rules={[{ required: true }]}>
                <Select style={{ width: 160 }} options={duplicatePolicyOptions} />
              </Form.Item>
              <Form.Item label="咨询分配方式" name="consultationRouting" rules={[{ required: true }]}>
                <Select style={{ width: 160 }} options={consultationRoutingOptions} />
              </Form.Item>
              <Form.Item label="交易方式" name="tradeMode" rules={[{ required: true }]}>
                <Select style={{ width: 160 }} options={tradeModeOptions} />
              </Form.Item>
              <Form.Item label="许可方式" name="licenseMode">
                <Select style={{ width: 160 }} allowClear options={licenseModeOptions} />
              </Form.Item>
              <Form.Item label="报价方式" name="priceType" rules={[{ required: true }]}>
                <Select style={{ width: 140 }} options={priceTypeOptions} />
              </Form.Item>
              <Form.Item label="挂牌价格(元)" name="priceAmountYuan">
                <InputNumber min={0.01} precision={2} />
              </Form.Item>
              <Form.Item label="保证金(元)" name="depositAmountYuan">
                <InputNumber min={0} precision={2} />
              </Form.Item>
              <Form.Item label="平台承接人员" name="sellerUserId">
                <Select style={{ width: 220 }} allowClear showSearch optionFilterProp="label" options={staffOptions} />
              </Form.Item>
            </Space>
            <Form.Item label="展示标签" name="listingTopics">
              <Select mode="multiple" allowClear options={listingTopicOptions} />
            </Form.Item>
            <Form.Item label="行业标签（逗号/分号/换行分隔）" name="industryTagsText">
              <Input.TextArea rows={2} />
            </Form.Item>
          </Form>

          <Space>
            <Button type="primary" loading={submitting} onClick={() => void createImportJob(false)}>
              提交本次导入
            </Button>
            <Button loading={submitting} onClick={() => void createImportJob(true)}>
              提交并立即开始处理
            </Button>
            <Button onClick={() => void loadJobs()}>刷新处理记录</Button>
          </Space>
        </Space>
      </Card>

      <Card title="按专利编号批量发布">
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Input.TextArea
            rows={4}
            value={patentIdsText}
            onChange={(e) => setPatentIdsText(e.target.value)}
            placeholder="每行一个专利记录编号，或逗号分隔"
          />
          <Typography.Text type="secondary">已识别 {parsedPatentIdsCount} 个专利编号（自动去重）</Typography.Text>
          <Button type="primary" loading={submitting} onClick={() => void runBatchGenerate()}>
            开始批量发布
          </Button>
          {generateResult ? (
            <Typography.Text type="secondary">
              总 {generateResult.totalCount}，成功 {generateResult.successCount}，失败 {generateResult.failedCount}，跳过 {generateResult.skippedCount}
            </Typography.Text>
          ) : null}
        </Space>
      </Card>

      <Card title="3. 最近处理记录">
        <Space wrap style={{ marginBottom: 12 }}>
          <Select
            value={draftJobStatusFilter}
            style={{ width: 160 }}
            onChange={(v) => setDraftJobStatusFilter((v as JobStatus) || '')}
            options={jobStatusFilterOptions}
          />
          <Select
            value={draftJobDuplicatePolicyFilter}
            style={{ width: 160 }}
            onChange={(v) => setDraftJobDuplicatePolicyFilter((v as DuplicatePolicy) || '')}
            options={duplicatePolicyFilterOptions}
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
            {
              title: '处理摘要',
              key: 'summary',
              width: 360,
              render: (_, row) => (
                <Space direction="vertical" size={2}>
                  <Typography.Text>{patentImportJobSummary(row)}</Typography.Text>
                  <Typography.Text type="secondary">
                    策略：{duplicatePolicyLabel(row.duplicatePolicy)} · 状态：{statusTag(row.status)}
                  </Typography.Text>
                  <Typography.Text type="secondary" copyable={{ text: row.id }}>
                    处理单号：{row.id}
                  </Typography.Text>
                </Space>
              ),
            },
            { title: '状态', dataIndex: 'status', width: 110, render: (v: JobStatus) => statusTag(v) },
            { title: '策略', dataIndex: 'duplicatePolicy', width: 90, render: (v: DuplicatePolicy) => duplicatePolicyLabel(v) },
            { title: '失败率', dataIndex: 'failRate', width: 100, render: (v: number) => `${Math.round((Number(v) || 0) * 100)}%` },
            { title: '已检查', dataIndex: 'validatedAt', width: 160, render: (v: string | null | undefined) => (v ? formatTimeSmart(v) : '-') },
            { title: '创建时间', dataIndex: 'createdAt', width: 150, render: (v: string) => formatTimeSmart(v) },
            {
              title: '操作',
              width: 340,
              render: (_, r) => (
                <Space>
                  <Button size="small" onClick={() => openRows(r)}>
                    查看详情
                  </Button>
                  <Button size="small" loading={submitting} disabled={r.status === 'RUNNING'} onClick={() => void validateJob(r.id)}>
                    检查
                  </Button>
                  <Button
                    size="small"
                    type="primary"
                    loading={submitting}
                    disabled={r.status === 'RUNNING' || !r.validatedAt}
                    onClick={() => void executeJob(r)}
                  >
                    {r.status === 'PAUSED' ? '继续处理' : '开始处理'}
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
            pagination={{
              current: mapRankingTablePage,
              pageSize: mapRankingTablePageSize,
              total: (mapOverview?.ranking || []).length,
              showSizeChanger: true,
              pageSizeOptions: ['10', '20', '50'],
              onChange: (nextPage, nextPageSize) => {
                setMapRankingTablePage(nextPage);
                if (nextPageSize && nextPageSize !== mapRankingTablePageSize) {
                  setMapRankingTablePageSize(nextPageSize);
                  setMapRankingTablePage(1);
                }
              },
            }}
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
                    <Tag>{formatRegionCodeDisplay(row.regionCode, '地区待完善')}</Tag>
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
              当前区域：{mapSelectedRegion ? `${mapSelectedRegion.regionName}（${formatRegionCodeDisplay(mapSelectedRegion.regionCode, '地区待完善')}）` : '未选择'}
            </Typography.Text>
            <Button
              size="small"
              onClick={() => appendMapManualListingIds((mapRegionDetail?.items || []).map((item) => item.listingId))}
              disabled={!mapRegionDetail?.items?.length}
            >
              将当前页挂牌记录编号加入批量输入
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
              {
                title: '挂牌摘要',
                key: 'listing',
                width: 360,
                render: (_, row) => (
                  <Space direction="vertical" size={2}>
                    <Typography.Text>{normalizeUserFacingText(row.title) || '挂牌标题待确认'}</Typography.Text>
                    <Typography.Text type="secondary">{patentMapListingSummary(row)}</Typography.Text>
                    <Typography.Text type="secondary" copyable={{ text: row.listingId }}>
                      挂牌记录编号：{row.listingId}
                    </Typography.Text>
                  </Space>
                ),
              },
              {
                title: '专利类型',
                dataIndex: 'patentType',
                width: 110,
                render: (value: PatentMapRegionDetail['items'][number]['patentType']) => displayAdminInfo(value),
              },
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
            placeholder="手工补充挂牌记录编号（每行一个或逗号分隔）"
          />
          <Typography.Text type="secondary">
            选择 {mapSelectedListingIds.length} 条 + 手工输入 {mapManualListingIds.length} 条 = 合计 {mapTargetListingIds.length} 条（自动去重）
          </Typography.Text>

          <Space wrap>
            <Input
              value={mapPatchRegionCode}
              onChange={(e) => setMapPatchRegionCode(e.target.value)}
              placeholder="挂牌地区名称或代码"
              style={{ width: 180 }}
              allowClear
            />
            <Space size={4}>
              <Typography.Text>清除挂牌地区</Typography.Text>
              <Switch checked={mapPatchClearRegionCode} onChange={setMapPatchClearRegionCode} />
            </Space>
            <Select
              value={mapPatchFeaturedLevel}
              style={{ width: 180 }}
              options={patentMapFeaturedLevelPatchOptions}
              onChange={(value) => setMapPatchFeaturedLevel((value as PatentMapFeaturedLevel) || '')}
            />
            <Input
              value={mapPatchFeaturedRegionCode}
              onChange={(e) => setMapPatchFeaturedRegionCode(e.target.value)}
              placeholder="上榜地区名称或代码"
              style={{ width: 190 }}
              allowClear
            />
            <Space size={4}>
              <Typography.Text>清除上榜地区</Typography.Text>
              <Switch checked={mapPatchClearFeaturedRegionCode} onChange={setMapPatchClearFeaturedRegionCode} />
            </Space>
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
              <Typography.Text>清除截止时间</Typography.Text>
              <Switch checked={mapPatchClearFeaturedUntil} onChange={setMapPatchClearFeaturedUntil} />
            </Space>
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
            <Button onClick={() => setMapManualListingIdsText('')}>清空手工挂牌记录编号</Button>
          </Space>

          {mapBatchResult ? (
            <Alert
              showIcon
              type="success"
              message={`批量处理完成：请求 ${mapBatchResult.totalRequested}，更新 ${mapBatchResult.updatedCount}，缺失 ${mapBatchResult.missingListingIds.length}`}
              description={
                <Space direction="vertical" size={2}>
                  <Typography.Text type="secondary">
                    变更内容：{patentMapPatchSummary(mapBatchResult.patchApplied)}
                  </Typography.Text>
                  {mapBatchResult.missingListingIds.length ? (
                    <Typography.Text type="secondary">
                      缺失挂牌记录编号：{mapBatchResult.missingListingIds.join(', ')}
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
              {
                title: '行摘要',
                width: 360,
                render: (_, r) => (
                  <Space direction="vertical" size={2}>
                    <Typography.Text>{displayAdminInfo(r.normalized?.title, '挂牌标题待确认')}</Typography.Text>
                    <Typography.Text type="secondary">
                      申请号：{displayAdminInfo(r.normalized?.applicationNoNorm)}
                    </Typography.Text>
                    <Typography.Text type="secondary">
                      专利记录编号：{displayAdminInfo(r.patentId)}
                    </Typography.Text>
                  </Space>
                ),
              },
              { title: '失败原因代码', dataIndex: 'errorCode', width: 160, render: (v: string | null | undefined) => displayAdminInfo(v) },
              { title: '错误信息', dataIndex: 'errorMessage', render: (v: string | null | undefined) => displayAdminInfo(v) },
              {
                title: '标准化预览',
                width: 360,
                render: (_, row) => displayAdminInfo(patentImportRowSummary(row)),
              },
            ]}
          />
        </Space>
      </Drawer>
    </Space>
  );
}
