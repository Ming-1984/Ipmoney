import { View, Text, Input, Picker } from '@tarojs/components';
import Taro, { useDidHide, useDidShow } from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './index.scss';

import type { components } from '@ipmoney/api-types';

import { getToken } from '../../lib/auth';
import { apiGet, apiPost } from '../../lib/api';
import { favorite, getFavoriteListingIds, syncFavorites, unfavorite } from '../../lib/favorites';
import { ensureApproved } from '../../lib/guard';
import {
  buildEnabledListingTopicOptions,
  fetchHomeLandingConfig,
  normalizeHomeLandingConfig,
} from '../../lib/homeLandingConfig';
import { achievementMaturityLabel, patentTypeLabel, priceTypeLabel, tradeModeLabel } from '../../lib/labels';
import { sanitizeIndustryTagNames } from '../../lib/industryTags';
import { fenToYuanInt } from '../../lib/money';
import { ensureRegionNamesReady, formatRegionPathNames, parseRegionPickerSelection, regionDisplayName } from '../../lib/regions';
import type { ChipOption } from '../../ui/filters';
import { AchievementCard } from '../../ui/AchievementCard';
import { ListingCard } from '../../ui/ListingCard';
import { ListingListSkeleton } from '../../ui/ListingSkeleton';
import { SearchEntry } from '../../ui/SearchEntry';
import { EmptyCard, ErrorCard } from '../../ui/StateCards';
import { CategoryControl, ChipGroup, FilterSheet, IndustryTagsPicker, RangeInput } from '../../ui/filters';
import { CellRow, Surface } from '../../ui/layout';
import { Button, CellGroup, PullToRefresh, toast } from '../../ui/nutui';
import { usePagedList } from '../../lib/usePagedList';
import { ListFooter } from '../../ui/ListFooter';
import emptySearchNone from '../../assets/illustrations/empty-search-none.svg';
import { STORAGE_KEYS } from '../../constants';
import { Close } from '../../ui/icons';

type ListingSummary = components['schemas']['ListingSummary'];
type PagedListingSummary = components['schemas']['PagedListingSummary'];
type SortBy = components['schemas']['SortBy'];
type PatentType = components['schemas']['PatentType'];
type TradeMode = components['schemas']['TradeMode'];
type PriceType = components['schemas']['PriceType'];
type LegalStatus = components['schemas']['LegalStatus'];
type ListingTopic = components['schemas']['ListingTopic'];
type AchievementSummary = components['schemas']['AchievementSummary'];
type PagedAchievementSummary = components['schemas']['PagedAchievementSummary'];
type AchievementMaturity = components['schemas']['AchievementMaturity'];
type AchievementSortBy = components['schemas']['AchievementSortBy'];

type TransferCountRange = '' | 'ZERO' | 'ONE' | 'TWO_PLUS';

type Conversation = { id: string };

type IpcFilterItem = {
  code: string;
  name: string;
};

type ListingFilters = {
  patentType: PatentType | '';
  tradeMode: TradeMode | '';
  priceType: PriceType | '';
  priceMin?: number;
  priceMax?: number;
  depositMin?: number;
  depositMax?: number;
  transferCountMin?: number;
  transferCountMax?: number;
  regionCode?: string;
  regionName?: string;
  ipc: string;
  ipcName?: string;
  ipcItems?: IpcFilterItem[];
  loc: string;
  legalStatus: LegalStatus | '';
  industryTags: string[];
  listingTopic: ListingTopic | '';
  clusterId?: string;
  clusterName?: string;
};

type AchievementFilters = {
  maturity: AchievementMaturity | '';
  regionCode?: string;
  regionName?: string;
  industryTags: string[];
};

type SearchPrefill = Partial<ListingFilters & AchievementFilters> & {
  tab?: 'LISTING' | 'ACHIEVEMENT';
  q?: string;
  qType?: 'AUTO' | 'NUMBER' | 'KEYWORD' | 'APPLICANT' | 'INVENTOR';
  prefillSource?: 'FEATURED_ZONE';
  reset?: boolean;
};

const LISTING_FILTER_DEFAULT: ListingFilters = {
  patentType: '',
  tradeMode: '',
  priceType: '',
  ipc: '',
  ipcName: '',
  ipcItems: [],
  loc: '',
  legalStatus: '',
  industryTags: [],
  transferCountMin: undefined,
  transferCountMax: undefined,
  listingTopic: '',
  clusterId: undefined,
  clusterName: undefined,
};

const ACHIEVEMENT_FILTER_DEFAULT: AchievementFilters = {
  maturity: '',
  industryTags: [],
  regionCode: undefined,
  regionName: undefined,
};

const IPC_FILTER_MAX = 8;

function splitFilterList(value?: string): string[] {
  return String(value || '')
    .split(/[,\uFF0C]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeIpcFilterItems(items?: IpcFilterItem[], ipc?: string, ipcName?: string): IpcFilterItem[] {
  const out: IpcFilterItem[] = [];
  const seen = new Set<string>();
  const push = (item: Partial<IpcFilterItem>) => {
    const code = String(item.code || '').trim().toUpperCase();
    if (!code || seen.has(code)) return;
    seen.add(code);
    out.push({ code, name: String(item.name || code).trim() || code });
  };

  if (Array.isArray(items)) items.forEach(push);

  const names = String(ipcName || '')
    .split('||')
    .map((item) => item.trim());
  splitFilterList(ipc).forEach((code, index) => push({ code, name: names[index] || code }));
  return out.slice(0, IPC_FILTER_MAX);
}

function applyIpcFilterItems(base: ListingFilters, items: IpcFilterItem[]): ListingFilters {
  const normalized = normalizeIpcFilterItems(items);
  return {
    ...base,
    ipcItems: normalized,
    ipc: normalized.map((item) => item.code).join(','),
    ipcName: normalized.map((item) => item.name).join('||'),
  };
}

function formatIpcLabel(item: IpcFilterItem): string {
  return item.name && item.name !== item.code ? `${item.code} ${item.name}` : item.code;
}

const PATENT_TYPE_OPTIONS: ChipOption<PatentType | ''>[] = [
  { value: '', label: '全部类型' },
  { value: 'INVENTION', label: '发明' },
  { value: 'UTILITY_MODEL', label: '实用新型' },
  { value: 'DESIGN', label: '外观设计' },
];

const TRADE_MODE_OPTIONS: ChipOption<TradeMode | ''>[] = [
  { value: '', label: '全部交易' },
  { value: 'ASSIGNMENT', label: '转让' },
  { value: 'LICENSE', label: '许可' },
];

const PRICE_TYPE_OPTIONS: ChipOption<PriceType | ''>[] = [
  { value: '', label: '全部报价' },
  { value: 'FIXED', label: '一口价' },
  { value: 'NEGOTIABLE', label: '面议' },
];

const TRANSFER_COUNT_OPTIONS: ChipOption<TransferCountRange>[] = [
  { value: '', label: '不限' },
  { value: 'ZERO', label: '0次转让' },
  { value: 'ONE', label: '1次' },
  { value: 'TWO_PLUS', label: '2次及以上' },
];

const LEGAL_STATUS_OPTIONS: ChipOption<LegalStatus | ''>[] = [
  { value: '', label: '全部状态' },
  { value: 'PENDING', label: '审中' },
  { value: 'GRANTED', label: '已授权' },
  { value: 'EXPIRED', label: '已失效' },
  { value: 'INVALIDATED', label: '已无效' },
];

const LISTING_SORT_OPTIONS: ChipOption<SortBy>[] = [
  { value: 'RECOMMENDED', label: '综合推荐' },
  { value: 'PRICE_ASC', label: '价格升序' },
  { value: 'PRICE_DESC', label: '价格降序' },
  { value: 'NEWEST', label: '最新发布' },
];

const ACHIEVEMENT_SORT_OPTIONS: ChipOption<AchievementSortBy>[] = [
  { value: 'RECOMMENDED', label: '综合推荐' },
  { value: 'NEWEST', label: '最新发布' },
];

const ACHIEVEMENT_MATURITY_OPTIONS: ChipOption<AchievementMaturity | ''>[] = [
  { value: '', label: '不限' },
  { value: 'CONCEPT', label: '概念验证' },
  { value: 'PROTOTYPE', label: '样机阶段' },
  { value: 'PILOT', label: '中试阶段' },
  { value: 'MASS_PRODUCTION', label: '量产阶段' },
  { value: 'COMMERCIALIZED', label: '已商业化' },
  { value: 'OTHER', label: '其他' },
];

function FilterSection(props: { title: string; children: React.ReactNode }) {
  return (
    <View className="search-filter-section">
      <View className="search-filter-section-title">
        <View className="search-filter-section-accent" />
        <Text>{props.title}</Text>
      </View>
      <View className="search-filter-section-body">{props.children}</View>
    </View>
  );
}

function fenRangeSummary(minFen?: number, maxFen?: number): string | null {
  if (minFen === undefined && maxFen === undefined) return null;
  if (minFen !== undefined && maxFen !== undefined) return `¥${fenToYuanInt(minFen)}-¥${fenToYuanInt(maxFen)}`;
  if (minFen !== undefined) return `¥${fenToYuanInt(minFen)}以上`;
  return `¥${fenToYuanInt(maxFen)}以内`;
}

function legalStatusLabelShort(s?: LegalStatus | ''): string | null {
  if (!s) return null;
  if (s === 'PENDING') return '审中';
  if (s === 'GRANTED') return '已授权';
  if (s === 'EXPIRED') return '已失效';
  if (s === 'INVALIDATED') return '已无效';
  return null;
}

function transferCountRangeValue(min?: number, max?: number): TransferCountRange {
  if (min === 0 && max === 0) return 'ZERO';
  if (min === 1 && max === 1) return 'ONE';
  if (min === 2 && max === undefined) return 'TWO_PLUS';
  return '';
}

function transferCountSummary(min?: number, max?: number): string | null {
  if (min === undefined && max === undefined) return null;
  if (min !== undefined && max !== undefined && min === max) return `${min}次`;
  if (min !== undefined && max !== undefined) return `${min}-${max}次`;
  if (min !== undefined) return `${min}次以上`;
  if (max !== undefined) return `${max}次以内`;
  return null;
}

export default function SearchPage() {
  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');
  const [qType, setQType] = useState<'AUTO' | 'NUMBER' | 'KEYWORD' | 'APPLICANT' | 'INVENTOR'>('AUTO');
  const [searchSeq, setSearchSeq] = useState(0);

  const [tab, setTab] = useState<'LISTING' | 'ACHIEVEMENT'>('LISTING');
  const [sortBy, setSortBy] = useState<SortBy>('RECOMMENDED');
  const [achievementSortBy, setAchievementSortBy] = useState<AchievementSortBy>('RECOMMENDED');
  const [listingFilters, setListingFilters] = useState<ListingFilters>(LISTING_FILTER_DEFAULT);
  const [achievementFilters, setAchievementFilters] = useState<AchievementFilters>(ACHIEVEMENT_FILTER_DEFAULT);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const autoLoadSignatureRef = useRef<{ LISTING: string | null; ACHIEVEMENT: string | null }>({
    LISTING: null,
    ACHIEVEMENT: null,
  });
  const pageVisibleRef = useRef(true);
  const consultSeqRef = useRef(0);

  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => new Set(getFavoriteListingIds()));
  const [listingTopicOptions, setListingTopicOptions] = useState<Array<{ value: ListingTopic; label: string }>>(() =>
    buildEnabledListingTopicOptions(normalizeHomeLandingConfig(null)),
  );
  const listingTopicFilterOptions = useMemo<ChipOption<ListingTopic | ''>[]>(
    () => [{ value: '', label: '不限' }, ...listingTopicOptions],
    [listingTopicOptions],
  );
  const listingTopicLabelMap = useMemo(
    () => new Map<ListingTopic, string>(listingTopicOptions.map((item) => [item.value, item.label])),
    [listingTopicOptions],
  );
  const enabledListingTopicSet = useMemo(
    () => new Set<ListingTopic>(listingTopicOptions.map((item) => item.value)),
    [listingTopicOptions],
  );

  useDidShow(() => {
    pageVisibleRef.current = true;
  });

  useDidHide(() => {
    pageVisibleRef.current = false;
    consultSeqRef.current += 1;
  });

  useEffect(() => {
    (async () => {
      try {
        const config = await fetchHomeLandingConfig();
        setListingTopicOptions(buildEnabledListingTopicOptions(config));
      } catch {
        setListingTopicOptions(buildEnabledListingTopicOptions(normalizeHomeLandingConfig(null)));
      }
    })();
  }, []);

  useEffect(() => {
    setListingFilters((prev) => {
      if (!prev.listingTopic) return prev;
      if (enabledListingTopicSet.has(prev.listingTopic)) return prev;
      return { ...prev, listingTopic: '' };
    });
  }, [enabledListingTopicSet]);

  useEffect(() => {
    const raw = Taro.getStorageSync(STORAGE_KEYS.searchPrefill);
    if (!raw || typeof raw !== 'object') return;
    Taro.removeStorageSync(STORAGE_KEYS.searchPrefill);
    // Force a fresh query when entering from external prefill sources
    // (inventor rank / featured zone / home shortcuts), so first render
    // always reflects the latest injected conditions.
    autoLoadSignatureRef.current = { LISTING: null, ACHIEVEMENT: null };

    const prefill = raw as SearchPrefill;

    if (prefill.tab === 'ACHIEVEMENT') setTab('ACHIEVEMENT');
    if (prefill.tab === 'LISTING') setTab('LISTING');

    if (prefill.reset) {
      setListingFilters(LISTING_FILTER_DEFAULT);
      if (typeof prefill.q !== 'string') {
        setQInput('');
        setQ('');
      }
    }
    if (typeof prefill.q === 'string') {
      const nextQ = prefill.q.trim();
      setQInput(prefill.q);
      setQ(nextQ);
    }
    if (
      prefill.qType === 'AUTO' ||
      prefill.qType === 'NUMBER' ||
      prefill.qType === 'KEYWORD' ||
      prefill.qType === 'APPLICANT' ||
      prefill.qType === 'INVENTOR'
    ) {
      setQType(prefill.qType);
    } else {
      setQType('AUTO');
    }

    setAchievementFilters((prev) => {
      const base = prefill.reset ? ACHIEVEMENT_FILTER_DEFAULT : prev;
      const nextIndustryTags = Array.isArray(prefill.industryTags)
        ? sanitizeIndustryTagNames(prefill.industryTags)
        : sanitizeIndustryTagNames(base.industryTags);
      return {
        ...base,
        maturity: (prefill.maturity as AchievementMaturity | undefined) ?? base.maturity,
        regionCode: prefill.regionCode ?? base.regionCode,
        regionName: prefill.regionName ?? base.regionName,
        industryTags: nextIndustryTags,
      };
    });

    setListingFilters((prev) => {
      const base = prefill.reset ? LISTING_FILTER_DEFAULT : prev;
      const nextIndustryTags = Array.isArray(prefill.industryTags)
        ? sanitizeIndustryTagNames(prefill.industryTags)
        : sanitizeIndustryTagNames(base.industryTags);
      const next = {
        ...base,
        patentType: prefill.patentType ?? base.patentType,
        tradeMode: prefill.tradeMode ?? base.tradeMode,
        priceType: prefill.priceType ?? base.priceType,
        priceMin: prefill.priceMin ?? base.priceMin,
        priceMax: prefill.priceMax ?? base.priceMax,
        depositMin: prefill.depositMin ?? base.depositMin,
        depositMax: prefill.depositMax ?? base.depositMax,
        transferCountMin: prefill.transferCountMin ?? base.transferCountMin,
        transferCountMax: prefill.transferCountMax ?? base.transferCountMax,
        regionCode: prefill.regionCode ?? base.regionCode,
        regionName: prefill.regionName ?? base.regionName,
        loc: prefill.loc ?? base.loc,
        legalStatus: prefill.legalStatus ?? base.legalStatus,
        industryTags: nextIndustryTags,
        listingTopic: prefill.listingTopic ?? base.listingTopic,
        clusterId: prefill.clusterId ?? base.clusterId,
        clusterName: prefill.clusterName ?? base.clusterName,
      };
      return applyIpcFilterItems(next, normalizeIpcFilterItems(prefill.ipcItems, prefill.ipc ?? base.ipc, prefill.ipcName ?? base.ipcName));
    });
    setSearchSeq((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (!getToken()) return;
    const timer = setTimeout(() => {
      syncFavorites().catch(() => {});
    }, 600);
    return () => clearTimeout(timer);
  }, []);

  const fetchListing = useCallback(
    async ({ page, pageSize }: { page: number; pageSize: number }) => {
      await ensureRegionNamesReady();
      const params: Record<string, any> = { page, pageSize, sortBy };
      if (q) params.q = q;
      if (q) params.qType = qType;
      if (listingFilters.regionCode) params.regionCode = listingFilters.regionCode;
      if (listingFilters.patentType) params.patentType = listingFilters.patentType;
      if (listingFilters.tradeMode) params.tradeMode = listingFilters.tradeMode;
      if (listingFilters.priceType) params.priceType = listingFilters.priceType;
      if (listingFilters.priceType === 'FIXED') {
        if (listingFilters.priceMin !== undefined) params.priceMin = listingFilters.priceMin;
        if (listingFilters.priceMax !== undefined) params.priceMax = listingFilters.priceMax;
      }
      if (listingFilters.depositMin !== undefined) params.depositMin = listingFilters.depositMin;
      if (listingFilters.depositMax !== undefined) params.depositMax = listingFilters.depositMax;
      if (listingFilters.transferCountMin !== undefined) params.transferCountMin = listingFilters.transferCountMin;
      if (listingFilters.transferCountMax !== undefined) params.transferCountMax = listingFilters.transferCountMax;
      const ipcItems = normalizeIpcFilterItems(listingFilters.ipcItems, listingFilters.ipc, listingFilters.ipcName);
      if (ipcItems.length) params.ipc = ipcItems.map((item) => item.code).join(',');
      if (listingFilters.loc.trim()) params.loc = listingFilters.loc.trim();
      if (listingFilters.legalStatus) params.legalStatus = listingFilters.legalStatus;
      const listingIndustryTags = sanitizeIndustryTagNames(listingFilters.industryTags);
      if (listingIndustryTags.length) params.industryTags = listingIndustryTags;
      if (listingFilters.listingTopic && enabledListingTopicSet.has(listingFilters.listingTopic)) {
        params.listingTopic = listingFilters.listingTopic;
      }
      if (listingFilters.clusterId) params.clusterId = listingFilters.clusterId;
      return apiGet<PagedListingSummary>('/search/listings', params);
    },
    [enabledListingTopicSet, listingFilters, q, qType, sortBy],
  );

  const listingList = usePagedList<ListingSummary>(fetchListing, { pageSize: 20 });

  const fetchAchievement = useCallback(
    async ({ page, pageSize }: { page: number; pageSize: number }) => {
      await ensureRegionNamesReady();
      const params: Record<string, any> = { page, pageSize, sortBy: achievementSortBy };
      if (q) params.q = q;
      if (achievementFilters.regionCode) params.regionCode = achievementFilters.regionCode;
      if (achievementFilters.maturity) params.maturity = achievementFilters.maturity;
      const tags = sanitizeIndustryTagNames(achievementFilters.industryTags);
      if (tags.length) params.industryTags = tags;
      return apiGet<PagedAchievementSummary>('/search/achievements', params);
    },
    [achievementFilters, achievementSortBy, q],
  );

  const achievementList = usePagedList<AchievementSummary>(fetchAchievement, { pageSize: 20 });

  const listingSignature = useMemo(
    () => JSON.stringify({ q, qType, sortBy, listingFilters, searchSeq }),
    [listingFilters, q, qType, searchSeq, sortBy],
  );
  const achievementSignature = useMemo(
    () => JSON.stringify({ q, achievementSortBy, achievementFilters, searchSeq }),
    [achievementFilters, achievementSortBy, q, searchSeq],
  );

  useEffect(() => {
    if (tab === 'LISTING') {
      if (autoLoadSignatureRef.current.LISTING === listingSignature) return;
      autoLoadSignatureRef.current.LISTING = listingSignature;
      listingList.reset();
      void listingList.reload();
      return;
    }
    if (autoLoadSignatureRef.current.ACHIEVEMENT === achievementSignature) return;
    autoLoadSignatureRef.current.ACHIEVEMENT = achievementSignature;
    achievementList.reset();
    void achievementList.reload();
  }, [
    achievementList.reset,
    achievementList.reload,
    achievementSignature,
    listingList.reset,
    listingList.reload,
    listingSignature,
    tab,
  ]);

  const startListingConsult = useCallback(async (listingId: string) => {
    if (!ensureApproved()) return;
    const seq = ++consultSeqRef.current;
    try {
      await apiPost<void>(`/listings/${listingId}/consultations`, { channel: 'FORM' }, { idempotencyKey: `c-${listingId}` });
    } catch (_) {
      // ignore: heat event
    }
    try {
      const conv = await apiPost<Conversation>(
        `/listings/${listingId}/conversations`,
        {},
        { idempotencyKey: `conv-${listingId}` },
      );
      if (seq !== consultSeqRef.current || !pageVisibleRef.current) return;
      Taro.navigateTo({ url: `/subpackages/messages/chat/index?conversationId=${conv.id}` });
    } catch (e: any) {
      if (seq !== consultSeqRef.current || !pageVisibleRef.current) return;
      toast(e?.message || '进入咨询失败');
    }
  }, []);

  const toggleFavorite = useCallback(
    async (listingId: string) => {
      if (!ensureApproved()) return;
      const isFav = favoriteIds.has(listingId);
      try {
        if (isFav) {
          await unfavorite(listingId);
          setFavoriteIds((prev) => {
            const next = new Set(prev);
            next.delete(listingId);
            return next;
          });
          toast('已取消收藏', { icon: 'success' });
          return;
        }
        await favorite(listingId);
        setFavoriteIds((prev) => new Set(prev).add(listingId));
        toast('已收藏', { icon: 'success' });
      } catch (e: any) {
        toast(e?.message || '操作失败');
      }
    },
    [favoriteIds],
  );

  const openFilters = useCallback(() => setFiltersOpen(true), []);

  const openIpcPicker = useCallback((onPicked: (payload: { code: string; name: string }) => void) => {
    try {
      Taro.navigateTo({
        url: '/subpackages/ipc-picker/index',
        events: {
          ipcSelected: (payload: any) => {
            const code = String(payload?.code || '').trim();
            if (!code) return;
            const name = String(payload?.name || code).trim();
            onPicked({ code, name });
          },
        },
      } as any);
    } catch (e: any) {
      toast(e?.message || '打开 IPC 分类失败');
    }
  }, []);

  const listingItems = useMemo(() => listingList.items, [listingList.items]);
  const achievementItems = useMemo(() => achievementList.items, [achievementList.items]);

  const listingFilterLabels = useMemo(() => {
    const out: string[] = [];
    const topicLabel = listingFilters.listingTopic ? listingTopicLabelMap.get(listingFilters.listingTopic) || '' : '';
    if (topicLabel) out.push(topicLabel);
    if (listingFilters.patentType) out.push(patentTypeLabel(listingFilters.patentType, { empty: '' }));
    if (listingFilters.tradeMode) out.push(tradeModeLabel(listingFilters.tradeMode, { empty: '' }));
    if (listingFilters.priceType) out.push(priceTypeLabel(listingFilters.priceType, { empty: '' }));
    const priceLabel = fenRangeSummary(listingFilters.priceMin, listingFilters.priceMax);
    if (priceLabel) out.push(`价格${priceLabel}`);
    const depositLabel = fenRangeSummary(listingFilters.depositMin, listingFilters.depositMax);
    if (depositLabel) out.push(`订金${depositLabel}`);
    const transferLabel = transferCountSummary(listingFilters.transferCountMin, listingFilters.transferCountMax);
    if (transferLabel) out.push(`转让${transferLabel}`);
    const regionLabel = regionDisplayName(listingFilters.regionCode, listingFilters.regionName, '');
    if (regionLabel) out.push(regionLabel);
    const legalLabel = legalStatusLabelShort(listingFilters.legalStatus);
    if (legalLabel) out.push(legalLabel);
    if (listingFilters.industryTags.length) out.push(...listingFilters.industryTags.slice(0, 3));
    normalizeIpcFilterItems(listingFilters.ipcItems, listingFilters.ipc, listingFilters.ipcName)
      .slice(0, 3)
      .forEach((item) => out.push(`IPC ${formatIpcLabel(item)}`));
    if (listingFilters.loc) out.push(`LOC ${listingFilters.loc}`);
    return out.filter(Boolean);
  }, [listingFilters, listingTopicLabelMap]);

  const achievementFilterLabels = useMemo(() => {
    const out: string[] = [];
    const maturityLabel = achievementMaturityLabel(achievementFilters.maturity || undefined);
    if (maturityLabel) out.push(maturityLabel);
    const regionLabel = regionDisplayName(achievementFilters.regionCode, achievementFilters.regionName, '');
    if (regionLabel) out.push(regionLabel);
    if (achievementFilters.industryTags.length) out.push(...achievementFilters.industryTags.slice(0, 3));
    return out.filter(Boolean);
  }, [achievementFilters]);

  const showListingInitialLoading = listingList.loading && listingItems.length === 0;
  const showAchievementInitialLoading = achievementList.loading && achievementItems.length === 0;

  return (
    <View className="container search-v4">
      <Surface className="search-hero glass-surface">
        <SearchEntry
          value={qInput}
          placeholder={tab === 'LISTING' ? '输入专利关键词' : '输入成果关键词'}
          actionText="搜索"
          onChange={(value) => {
            setQInput(value);
            if (!value) setQ('');
          }}
          onSearch={(value) => {
            setQ((value || '').trim());
            setQType('AUTO');
            setSearchSeq((prev) => prev + 1);
          }}
        />

        <View style={{ height: '12rpx' }} />

        <CategoryControl
          value={tab}
          options={[
            { label: '专利交易', value: 'LISTING' },
            { label: '专利成果', value: 'ACHIEVEMENT' },
          ]}
          onChange={(value) => setTab(value as 'LISTING' | 'ACHIEVEMENT')}
        />

        <View style={{ height: '12rpx' }} />

        {tab === 'LISTING' ? (
          <>
            <View className="search-sort-row">
              <View className="search-sort-options">
                {LISTING_SORT_OPTIONS.map((opt) => (
                  <Text
                    key={opt.value}
                    className={['search-sort-option', sortBy === opt.value ? 'is-active' : ''].filter(Boolean).join(' ')}
                    onClick={() => setSortBy(opt.value)}
                  >
                    {opt.label}
                  </Text>
                ))}
              </View>
              <View className="search-filter-btn" onClick={openFilters}>
                <Text>筛选</Text>
              </View>
            </View>

            {listingFilterLabels.length ? (
              <View className="search-selected-wrap">
                <View className="search-selected-scroll">
                  {listingFilterLabels.map((txt, idx) => (
                    <View key={`${txt}-${idx}`} className="pill">
                      <Text>{txt}</Text>
                    </View>
                  ))}
                  <View className="pill pill-strong" onClick={() => setListingFilters(LISTING_FILTER_DEFAULT)}>
                    <Text>清空</Text>
                  </View>
                </View>
              </View>
            ) : null}
          </>
        ) : (
          <>
            <View className="search-sort-row">
              <View className="search-sort-options">
                {ACHIEVEMENT_SORT_OPTIONS.map((opt) => (
                  <Text
                    key={opt.value}
                    className={[
                      'search-sort-option',
                      achievementSortBy === opt.value ? 'is-active' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => setAchievementSortBy(opt.value)}
                  >
                    {opt.label}
                  </Text>
                ))}
              </View>
              <View className="search-filter-btn" onClick={openFilters}>
                <Text>筛选</Text>
              </View>
            </View>

            {achievementFilterLabels.length ? (
              <View className="search-selected-wrap">
                <View className="search-selected-scroll">
                  {achievementFilterLabels.map((txt, idx) => (
                    <View key={`${txt}-${idx}`} className="pill">
                      <Text>{txt}</Text>
                    </View>
                  ))}
                  <View className="pill pill-strong" onClick={() => setAchievementFilters(ACHIEVEMENT_FILTER_DEFAULT)}>
                    <Text>清空</Text>
                  </View>
                </View>
              </View>
            ) : null}
          </>
        )}
      </Surface>

      {tab === 'LISTING' ? (
        <FilterSheet<ListingFilters>
          open={filtersOpen}
          title="筛选（专利）"
          headerTitle="筛选条件"
          variant="search"
          value={listingFilters}
          defaultValue={LISTING_FILTER_DEFAULT}
          onClose={() => setFiltersOpen(false)}
          onApply={(next) => setListingFilters(next)}
          validate={(draft) => {
            if (
              draft.priceMin !== undefined &&
              draft.priceMax !== undefined &&
              draft.priceMin > draft.priceMax
            ) {
              return '价格区间不合法';
            }
            if (
              draft.depositMin !== undefined &&
              draft.depositMax !== undefined &&
              draft.depositMin > draft.depositMax
            ) {
              return '订金区间不合法';
            }
            if (
              draft.transferCountMin !== undefined &&
              draft.transferCountMax !== undefined &&
              draft.transferCountMin > draft.transferCountMax
            ) {
              return '转让次数区间不合法';
            }
            return null;
          }}
        >
          {({ draft, setDraft }) => {
            const transferRangeValue = transferCountRangeValue(draft.transferCountMin, draft.transferCountMax);
            return (
              <View className="search-filter-content">
                <FilterSection title="特色标签">
                  <ChipGroup
                    value={draft.listingTopic}
                    options={listingTopicFilterOptions}
                    onChange={(v) => setDraft((prev) => ({ ...prev, listingTopic: v }))}
                  />
                </FilterSection>

                <FilterSection title="技术领域（IPC）">
                  <IndustryTagsPicker
                    value={draft.industryTags}
                    max={8}
                    onChange={(tags) => setDraft((prev) => ({ ...prev, industryTags: sanitizeIndustryTagNames(tags) }))}
                  />
                  <View className="search-ipc-control">
                    <View className="search-ipc-tags">
                      {normalizeIpcFilterItems(draft.ipcItems, draft.ipc, draft.ipcName).length ? (
                        normalizeIpcFilterItems(draft.ipcItems, draft.ipc, draft.ipcName).map((item) => (
                          <View key={item.code} className="search-ipc-pill">
                            <Text className="search-ipc-pill-text">{formatIpcLabel(item)}</Text>
                            <View
                              className="search-ipc-pill-remove"
                              onClick={(event) => {
                                event.stopPropagation();
                                setDraft((prev) =>
                                  applyIpcFilterItems(
                                    prev,
                                    normalizeIpcFilterItems(prev.ipcItems, prev.ipc, prev.ipcName).filter((current) => current.code !== item.code),
                                  ),
                                );
                              }}
                            >
                              <Close size={9} color="#ff7a18" />
                            </View>
                          </View>
                        ))
                      ) : (
                        <Text className="search-ipc-placeholder">支持按 IPC 类别筛选</Text>
                      )}
                    </View>
                    <View className="search-ipc-divider" />
                    <View
                      className="search-ipc-select"
                      onClick={() =>
                        openIpcPicker(({ code, name }) => {
                          setDraft((prev) => {
                            const current = normalizeIpcFilterItems(prev.ipcItems, prev.ipc, prev.ipcName);
                            if (current.some((item) => item.code === code)) return prev;
                            if (current.length >= IPC_FILTER_MAX) {
                              toast(`最多选择 ${IPC_FILTER_MAX} 个 IPC 类别`);
                              return prev;
                            }
                            return applyIpcFilterItems(prev, [...current, { code, name }]);
                          });
                        })
                      }
                    >
                      <Text>选择</Text>
                    </View>
                    {normalizeIpcFilterItems(draft.ipcItems, draft.ipc, draft.ipcName).length ? (
                      <View className="search-ipc-clear" onClick={() => setDraft((prev) => applyIpcFilterItems(prev, []))}>
                        <Text>清空</Text>
                      </View>
                    ) : null}
                  </View>
                </FilterSection>

                <FilterSection title="转让次数">
                  <ChipGroup
                    value={transferRangeValue}
                    options={TRANSFER_COUNT_OPTIONS}
                    onChange={(v) =>
                      setDraft((prev) => {
                        if (!v) return { ...prev, transferCountMin: undefined, transferCountMax: undefined };
                        if (v === 'ZERO') return { ...prev, transferCountMin: 0, transferCountMax: 0 };
                        if (v === 'ONE') return { ...prev, transferCountMin: 1, transferCountMax: 1 };
                        return { ...prev, transferCountMin: 2, transferCountMax: undefined };
                      })
                    }
                  />
                </FilterSection>

                <FilterSection title="专利类型">
                  <ChipGroup
                    value={draft.patentType}
                    options={PATENT_TYPE_OPTIONS}
                    onChange={(v) => setDraft((prev) => ({ ...prev, patentType: v }))}
                  />
                </FilterSection>

                <FilterSection title="法律状态">
                  <ChipGroup
                    value={draft.legalStatus}
                    options={LEGAL_STATUS_OPTIONS}
                    onChange={(v) => setDraft((prev) => ({ ...prev, legalStatus: v }))}
                  />
                </FilterSection>

                <FilterSection title="交易方式">
                  <ChipGroup
                    value={draft.tradeMode}
                    options={TRADE_MODE_OPTIONS}
                    onChange={(v) => setDraft((prev) => ({ ...prev, tradeMode: v }))}
                  />
                </FilterSection>

                <FilterSection title="报价类型">
                  <ChipGroup
                    value={draft.priceType}
                    options={PRICE_TYPE_OPTIONS}
                    onChange={(v) =>
                      setDraft((prev) => ({
                        ...prev,
                        priceType: v,
                        ...(v === 'NEGOTIABLE' ? { priceMin: undefined, priceMax: undefined } : {}),
                      }))
                    }
                  />
                </FilterSection>

                <FilterSection title="价格区间">
                  <RangeInput
                    minFen={draft.priceMin}
                    maxFen={draft.priceMax}
                    disabled={draft.priceType === 'NEGOTIABLE'}
                    onChange={(range) =>
                      setDraft((prev) => ({ ...prev, priceMin: range.minFen, priceMax: range.maxFen }))
                    }
                  />
                  {draft.priceType === 'NEGOTIABLE' ? (
                    <Text className="text-caption muted">面议时不需要填写价格区间。</Text>
                  ) : null}
                </FilterSection>

                <FilterSection title="订金区间">
                  <RangeInput
                    minFen={draft.depositMin}
                    maxFen={draft.depositMax}
                    onChange={(range) =>
                      setDraft((prev) => ({ ...prev, depositMin: range.minFen, depositMax: range.maxFen }))
                    }
                  />
                </FilterSection>

              <FilterSection title="地区">
                <Picker
                  mode="region"
                  level="region"
                  onChange={(event) => {
                    const parsed = parseRegionPickerSelection(event);
                    if (!parsed) {
                      toast('地区读取失败，请重试');
                      return;
                    }
                    setDraft((prev) => ({
                      ...prev,
                      regionCode: parsed.code,
                      regionName: formatRegionPathNames(parsed.pathNames, parsed.name),
                    }));
                  }}
                >
                  <View className="search-filter-card">
                    <CellGroup divider>
                      <CellRow
                        clickable
                        title="地区"
                        description={draft.regionCode ? regionDisplayName(draft.regionCode, draft.regionName, '') : '按行政区划选择'}
                        extra={<Text className="muted">{draft.regionCode ? '已选' : '不限'}</Text>}
                        isLast
                      />
                    </CellGroup>
                  </View>
                </Picker>
                {draft.regionCode ? (
                  <Button
                    className="search-filter-clear"
                    variant="ghost"
                    size="small"
                    block={false}
                    onClick={() => setDraft((prev) => ({ ...prev, regionCode: undefined, regionName: undefined }))}
                  >
                    清空地区
                  </Button>
                ) : null}
              </FilterSection>

                <FilterSection title="LOC">
                  <Input
                    className="search-filter-input"
                    value={draft.loc}
                    onInput={(e) => setDraft((prev) => ({ ...prev, loc: e.detail.value }))}
                    placeholder="LOC 如 A01"
                  />
                </FilterSection>
              </View>
            );
          }}
        </FilterSheet>
      ) : (
        <FilterSheet<AchievementFilters>
          open={filtersOpen}
          title="筛选（成果）"
          headerTitle="筛选条件"
          variant="search"
          value={achievementFilters}
          defaultValue={ACHIEVEMENT_FILTER_DEFAULT}
          onClose={() => setFiltersOpen(false)}
          onApply={(next) => setAchievementFilters(next)}
        >
          {({ draft, setDraft }) => (
            <View className="search-filter-content">
              <FilterSection title="成熟度">
                <ChipGroup
                  value={draft.maturity}
                  options={ACHIEVEMENT_MATURITY_OPTIONS}
                  onChange={(v) => setDraft((prev) => ({ ...prev, maturity: v as AchievementMaturity | '' }))}
                />
              </FilterSection>

              <FilterSection title="行业标签">
                <IndustryTagsPicker
                  value={draft.industryTags}
                  max={8}
                  onChange={(tags) => setDraft((prev) => ({ ...prev, industryTags: sanitizeIndustryTagNames(tags) }))}
                />
              </FilterSection>

              <FilterSection title="地区">
                <Picker
                  mode="region"
                  level="region"
                  onChange={(event) => {
                    const parsed = parseRegionPickerSelection(event);
                    if (!parsed) {
                      toast('地区读取失败，请重试');
                      return;
                    }
                    setDraft((prev) => ({
                      ...prev,
                      regionCode: parsed.code,
                      regionName: formatRegionPathNames(parsed.pathNames, parsed.name),
                    }));
                  }}
                >
                  <View className="search-filter-card">
                    <CellGroup divider>
                      <CellRow
                        clickable
                        title="地区"
                        description={draft.regionCode ? regionDisplayName(draft.regionCode, draft.regionName, '') : '按行政区划选择'}
                        extra={<Text className="muted">{draft.regionCode ? '已选' : '不限'}</Text>}
                        isLast
                      />
                    </CellGroup>
                  </View>
                </Picker>
                {draft.regionCode ? (
                  <Button
                    className="search-filter-clear"
                    variant="ghost"
                    size="small"
                    block={false}
                    onClick={() => setDraft((prev) => ({ ...prev, regionCode: undefined, regionName: undefined }))}
                  >
                    清空地区
                  </Button>
                ) : null}
              </FilterSection>
            </View>
          )}
        </FilterSheet>
      )}

      <PullToRefresh
        type="primary"
        disabled={tab === 'LISTING' ? showListingInitialLoading || listingList.refreshing : showAchievementInitialLoading || achievementList.refreshing}
        onRefresh={tab === 'LISTING' ? listingList.refresh : achievementList.refresh}
      >
        {tab === 'LISTING' ? (
          showListingInitialLoading ? (
            <ListingListSkeleton />
          ) : listingList.error ? (
            <ErrorCard message={listingList.error} onRetry={listingList.reload} />
          ) : listingItems.length ? (
            <View className="search-card-list listing-card-list">
              {listingItems.map((it: ListingSummary) => (
                <ListingCard
                  key={it.id}
                  item={it}
                  favorited={favoriteIds.has(it.id)}
                  onClick={() => {
                    Taro.navigateTo({ url: `/subpackages/listing/detail/index?listingId=${it.id}` });
                  }}
                  onFavorite={() => {
                    void toggleFavorite(it.id);
                  }}
                  onConsult={() => {
                    void startListingConsult(it.id);
                  }}
                />
              ))}
            </View>
          ) : (
            <EmptyCard
              image={emptySearchNone}
              title="暂无专利结果"
              message="请调整关键词或筛选条件后重试。"
              variant="inline"
              actionText="刷新"
              onAction={listingList.reload}
            />
          )
        ) : showAchievementInitialLoading ? (
          <ListingListSkeleton />
        ) : achievementList.error ? (
          <ErrorCard message={achievementList.error} onRetry={achievementList.reload} />
        ) : achievementItems.length ? (
          <View className="search-card-list listing-card-list">
            {achievementItems.map((it: AchievementSummary) => (
              <AchievementCard
                key={it.id}
                item={it}
                onClick={() => {
                  Taro.navigateTo({ url: `/subpackages/achievement/detail/index?achievementId=${it.id}` });
                }}
              />
            ))}
          </View>
        ) : (
          <EmptyCard
            image={emptySearchNone}
            title="暂无成果结果"
            message="请调整关键词或筛选条件后重试。"
            variant="inline"
            actionText="刷新"
            onAction={achievementList.reload}
          />
        )}

        {tab === 'LISTING' ? (
          !showListingInitialLoading && listingItems.length ? (
            <ListFooter
              loadingMore={listingList.loadingMore}
              hasMore={listingList.hasMore}
              onLoadMore={listingList.loadMore}
              showNoMore
            />
          ) : null
        ) : !showAchievementInitialLoading && achievementItems.length ? (
          <ListFooter
            loadingMore={achievementList.loadingMore}
            hasMore={achievementList.hasMore}
            onLoadMore={achievementList.loadMore}
            showNoMore
          />
        ) : null}
      </PullToRefresh>

      <View style={{ height: '16rpx' }} />
    </View>
  );
}
