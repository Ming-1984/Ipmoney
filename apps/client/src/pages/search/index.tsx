import { View, Text, Image, Picker } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './index.scss';

import type { components } from '@ipmoney/api-types';

import { STORAGE_KEYS } from '../../constants';
import { getToken } from '../../lib/auth';
import { apiGet, apiPost } from '../../lib/api';
import { favorite, getFavoriteListingIds, syncFavorites, unfavorite } from '../../lib/favorites';
import { ensureApproved } from '../../lib/guard';
import {
  artworkCategoryLabel,
  deliveryPeriodLabel,
  patentTypeLabel,
  priceTypeLabel,
  tradeModeLabel,
} from '../../lib/labels';
import { fenToYuan, fenToYuanInt } from '../../lib/money';
import { resolveLocalAsset } from '../../lib/localAssets';
import { ensureRegionNamesReady, regionDisplayName, regionNameByCode } from '../../lib/regions';
import type { ChipOption } from '../../ui/filters';
import { ArtworkCard } from '../../ui/ArtworkCard';
import { ListingCard } from '../../ui/ListingCard';
import { ListingListSkeleton } from '../../ui/ListingSkeleton';
import { SearchEntry } from '../../ui/SearchEntry';
import { EmptyCard, ErrorCard, LoadingCard } from '../../ui/StateCards';
import { CategoryControl, ChipGroup, FilterSheet, IndustryTagsPicker, RangeInput, SortSheet } from '../../ui/filters';
import { CellRow, Surface } from '../../ui/layout';
import { Button, CellGroup, Input, toast } from '../../ui/nutui';
import iconAward from '../../assets/icons/icon-award-teal.svg';

type Tab = 'LISTING' | 'DEMAND' | 'ACHIEVEMENT' | 'ARTWORK';

type PagedListingSummary = components['schemas']['PagedListingSummary'];
type ListingSummary = components['schemas']['ListingSummary'];
type SortBy = components['schemas']['SortBy'];
type PatentType = components['schemas']['PatentType'];
type TradeMode = components['schemas']['TradeMode'];
type PriceType = components['schemas']['PriceType'];
type CooperationMode = components['schemas']['CooperationMode'];
type LegalStatus = components['schemas']['LegalStatus'];
type TransferCountRange = '' | 'ZERO' | 'ONE' | 'TWO_PLUS';
type ListingTopic = '' | 'HIGH_TECH_RETIRED' | 'CLUSTER_FEATURED';

type PagedDemandSummary = components['schemas']['PagedDemandSummary'];
type DemandSummary = components['schemas']['DemandSummary'];

type PagedAchievementSummary = components['schemas']['PagedAchievementSummary'];
type AchievementSummary = components['schemas']['AchievementSummary'];
type AchievementMaturity = components['schemas']['AchievementMaturity'];


type PagedArtworkSummary = components['schemas']['PagedArtworkSummary'];
type ArtworkSummary = components['schemas']['ArtworkSummary'];
type ArtworkSortBy = components['schemas']['ArtworkSortBy'];
type ArtworkSortByLocal = ArtworkSortBy | 'DEPOSIT_ASC' | 'DEPOSIT_DESC' | 'YEAR_ASC' | 'YEAR_DESC';
type ArtworkPriceRange = '' | 'UNDER_5000' | '5000_10000' | '10000_PLUS' | 'NEGOTIABLE';
type ArtworkCategory = components['schemas']['ArtworkCategory'];

type ContentSortBy = components['schemas']['ContentSortBy'];

type Conversation = { id: string };

function fenRangeSummary(minFen?: number, maxFen?: number): string | null {
  if (minFen === undefined && maxFen === undefined) return null;
  if (minFen !== undefined && maxFen !== undefined) return `￥${fenToYuanInt(minFen)}-￥${fenToYuanInt(maxFen)}`;
  if (minFen !== undefined) return `￥${fenToYuanInt(minFen)}以上`;
  return `￥${fenToYuanInt(maxFen)}以内`;
}

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

function yearRangeSummary(start?: number, end?: number): string | null {
  if (start === undefined && end === undefined) return null;
  if (start !== undefined && end !== undefined) return `${start}-${end}`;
  if (start !== undefined) return `${start}年及以后`;
  return `${end}年及以前`;
}


function demandBudgetValue(it: Pick<DemandSummary, 'budgetType' | 'budgetMinFen' | 'budgetMaxFen'>): string {
  const type = it.budgetType as PriceType | undefined;
  if (!type) return '-';
  if (type === 'NEGOTIABLE') return '面议';
  const min = it.budgetMinFen;
  const max = it.budgetMaxFen;
  if (min !== undefined && max !== undefined) return `￥${fenToYuan(min)}-￥${fenToYuan(max)}`;
  if (min !== undefined) return `￥${fenToYuan(min)}以上`;
  if (max !== undefined) return `￥${fenToYuan(max)}以内`;
  return '固定预算';
}




function maturityLabelShort(m?: AchievementMaturity | ''): string | null {
  if (!m) return null;
  if (m === 'CONCEPT') return '概念';
  if (m === 'PROTOTYPE') return '样机/原型';
  if (m === 'PILOT') return '中试';
  if (m === 'MASS_PRODUCTION') return '量产';
  if (m === 'COMMERCIALIZED') return '已产业化';
  return '其他';
}



function cooperationModeLabel(mode: CooperationMode): string {
  if (mode === 'TRANSFER') return '专利转让';
  if (mode === 'TECH_CONSULTING') return '技术咨询';
  if (mode === 'COMMISSIONED_DEV') return '委托开发';
  if (mode === 'PLATFORM_CO_BUILD') return '平台共建';
  return '其他';
}



function legalStatusLabelShort(s?: LegalStatus | ''): string | null {
  if (!s) return null;
  if (s === 'PENDING') return '审中';
  if (s === 'GRANTED') return '已授权';
  if (s === 'EXPIRED') return '已失效';
  if (s === 'INVALIDATED') return '已无效';
  return '未知';
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



type ListingFilters = {
  patentType: PatentType | '';
  tradeMode: TradeMode | '';
  priceType: PriceType | '';
  priceMinFen?: number;
  priceMaxFen?: number;
  depositMinFen?: number;
  depositMaxFen?: number;
  transferCountMin?: number;
  transferCountMax?: number;
  regionCode?: string;
  regionName?: string;
  ipc: string;
  ipcName?: string;
  loc: string;
  legalStatus: LegalStatus | '';
  industryTags: string[];
  listingTopic: ListingTopic;
  clusterId?: string;
  clusterName?: string;
};

type DemandFilters = {
  regionCode?: string;
  regionName?: string;
  cooperationModes: CooperationMode[];
  budgetType: PriceType | '';
  budgetMinFen?: number;
  budgetMaxFen?: number;
  industryTags: string[];
};

type AchievementFilters = {
  regionCode?: string;
  regionName?: string;
  cooperationModes: CooperationMode[];
  maturity: AchievementMaturity | '';
  industryTags: string[];
};

type ArtworkFilters = {
  category: ArtworkCategory | '';
  creationYearStart?: number;
  creationYearEnd?: number;
  priceType: PriceType | '';
  priceRange: ArtworkPriceRange;
};

const LISTING_FILTER_DEFAULT: ListingFilters = {
  patentType: '',
  tradeMode: '',
  priceType: '',
  ipc: '',
  ipcName: '',
  loc: '',
  legalStatus: '',
  industryTags: [],
  transferCountMin: undefined,
  transferCountMax: undefined,
  listingTopic: '',
  clusterId: undefined,
  clusterName: undefined,
};

const DEMAND_FILTER_DEFAULT: DemandFilters = {
  cooperationModes: [],
  budgetType: '',
  industryTags: [],
};

const ACHIEVEMENT_FILTER_DEFAULT: AchievementFilters = {
  cooperationModes: [],
  maturity: '',
  industryTags: [],
};

const ARTWORK_FILTER_DEFAULT: ArtworkFilters = {
  category: '',
  priceType: '',
  priceRange: '',
};

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
  { value: 'ZERO', label: '0次（沉睡）' },
  { value: 'ONE', label: '1次' },
  { value: 'TWO_PLUS', label: '2次以上' },
];


const ARTWORK_PRICE_RANGE_OPTIONS: ChipOption<ArtworkPriceRange>[] = [
  { value: '', label: '不限' },
  { value: 'UNDER_5000', label: '0-5000' },
  { value: '5000_10000', label: '5000-10000' },
  { value: '10000_PLUS', label: '10000以上' },
  { value: 'NEGOTIABLE', label: '面议' },
];


const BUDGET_TYPE_OPTIONS: ChipOption<PriceType | ''>[] = [
  { value: '', label: '全部预算' },
  { value: 'FIXED', label: '固定预算' },
  { value: 'NEGOTIABLE', label: '面议' },
];


const COOPERATION_MODE_OPTIONS: ChipOption<CooperationMode>[] = [
  { value: 'TRANSFER', label: '专利转让' },
  { value: 'TECH_CONSULTING', label: '技术咨询' },
  { value: 'COMMISSIONED_DEV', label: '委托开发' },
  { value: 'PLATFORM_CO_BUILD', label: '平台共建' },
];


const MATURITY_OPTIONS: ChipOption<AchievementMaturity | ''>[] = [
  { value: '', label: '全部成熟度' },
  { value: 'CONCEPT', label: '概念' },
  { value: 'PROTOTYPE', label: '样机/原型' },
  { value: 'PILOT', label: '中试' },
  { value: 'MASS_PRODUCTION', label: '量产' },
  { value: 'COMMERCIALIZED', label: '已产业化' },
  { value: 'OTHER', label: '其他' },
];


const ARTWORK_CATEGORY_OPTIONS: ChipOption<ArtworkCategory | ''>[] = [
  { value: '', label: '全部类别' },
  { value: 'CALLIGRAPHY', label: '书法' },
  { value: 'PAINTING', label: '绘画' },
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


const CONTENT_SORT_OPTIONS: ChipOption<ContentSortBy>[] = [
  { value: 'RECOMMENDED', label: '推荐' },
  { value: 'NEWEST', label: '最新' },
  { value: 'POPULAR', label: '热度' },
];


type ArtworkSortOptionValue = ArtworkSortByLocal | 'MORE';
const ARTWORK_SORT_OPTIONS: { value: ArtworkSortOptionValue; label: string }[] = [
  { value: 'RECOMMENDED', label: '推荐' },
  { value: 'NEWEST', label: '最新' },
  { value: 'POPULAR', label: '热度' },
  { value: 'MORE', label: '更多' },
];


export default function SearchPage() {
  const [tab, setTab] = useState<Tab>('LISTING');
  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');

  const [sortBy, setSortBy] = useState<SortBy>('RECOMMENDED');
  const [contentSortBy, setContentSortBy] = useState<ContentSortBy>('RECOMMENDED');
  const [artworkSortBy, setArtworkSortBy] = useState<ArtworkSortByLocal>('RECOMMENDED');

  const [listingFilters, setListingFilters] = useState<ListingFilters>(LISTING_FILTER_DEFAULT);
  const [demandFilters, setDemandFilters] = useState<DemandFilters>(DEMAND_FILTER_DEFAULT);
  const [achievementFilters, setAchievementFilters] = useState<AchievementFilters>(ACHIEVEMENT_FILTER_DEFAULT);
  const [artworkFilters, setArtworkFilters] = useState<ArtworkFilters>(ARTWORK_FILTER_DEFAULT);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [artworkSortSheetOpen, setArtworkSortSheetOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [listingData, setListingData] = useState<PagedListingSummary | null>(null);
  const [demandData, setDemandData] = useState<PagedDemandSummary | null>(null);
  const [achievementData, setAchievementData] = useState<PagedAchievementSummary | null>(null);
  const [artworkData, setArtworkData] = useState<PagedArtworkSummary | null>(null);

  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => new Set(getFavoriteListingIds()));

  const resetStateForTab = useCallback((nextTab: Tab) => {
    if (nextTab === 'LISTING') {
      setListingFilters(LISTING_FILTER_DEFAULT);
      setSortBy('RECOMMENDED');
      return;
    }
    if (nextTab === 'DEMAND') {
      setDemandFilters(DEMAND_FILTER_DEFAULT);
      setContentSortBy('RECOMMENDED');
      return;
    }
    if (nextTab === 'ACHIEVEMENT') {
      setAchievementFilters(ACHIEVEMENT_FILTER_DEFAULT);
      setContentSortBy('RECOMMENDED');
      return;
    }
    if (nextTab === 'ARTWORK') {
      setArtworkFilters(ARTWORK_FILTER_DEFAULT);
      setArtworkSortBy('RECOMMENDED');
      return;
    }
  }, []);

  useEffect(() => {
    setFiltersOpen(false);
    setArtworkSortSheetOpen(false);
  }, [tab]);

  useDidShow(() => {
    const payload = Taro.getStorageSync(STORAGE_KEYS.searchPrefill);
    if (!payload) return;
    Taro.removeStorageSync(STORAGE_KEYS.searchPrefill);
    const keyword = typeof payload === 'string' ? payload : payload?.q;
    const nextTab = typeof payload === 'object' ? (payload?.tab as Tab | undefined) : undefined;
    const shouldReset = typeof payload === 'object' ? Boolean(payload?.reset) : false;
    const listingTopic = typeof payload === 'object' ? (payload?.listingTopic as ListingTopic | undefined) : undefined;
    const clusterId = typeof payload === 'object' ? (payload?.clusterId as string | undefined) : undefined;
    const clusterName = typeof payload === 'object' ? (payload?.clusterName as string | undefined) : undefined;
    const tradeMode = typeof payload === 'object' ? (payload?.tradeMode as TradeMode | undefined) : undefined;
    const transferCountMin = typeof payload === 'object' ? payload?.transferCountMin : undefined;
    const transferCountMax = typeof payload === 'object' ? payload?.transferCountMax : undefined;
    const hasListingPrefill =
      Boolean(listingTopic) ||
      Boolean(clusterId) ||
      Boolean(tradeMode) ||
      transferCountMin !== undefined ||
      transferCountMax !== undefined;
    const finalTab = nextTab || (hasListingPrefill ? 'LISTING' : undefined);
    if (shouldReset) {
      setQ('');
      setQInput('');
      if (finalTab) resetStateForTab(finalTab);
    }
    if (typeof keyword === 'string') {
      const trimmed = keyword.trim();
      setQInput(trimmed);
      setQ(trimmed);
    }
    if (finalTab) {
      setTab(finalTab);
    }
    if (hasListingPrefill) {
      setListingFilters((prev) => {
        const base = shouldReset ? LISTING_FILTER_DEFAULT : prev;
        return {
          ...base,
          listingTopic: listingTopic ?? base.listingTopic,
          clusterId: clusterId ?? base.clusterId,
          clusterName: clusterName ?? base.clusterName,
          tradeMode: tradeMode ?? base.tradeMode,
          transferCountMin:
            typeof transferCountMin === 'number' ? transferCountMin : base.transferCountMin,
          transferCountMax:
            typeof transferCountMax === 'number' ? transferCountMax : base.transferCountMax,
        };
      });
    }
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await ensureRegionNamesReady();
      if (tab === 'LISTING') {
        const params: Record<string, any> = { page: 1, pageSize: 10, sortBy };
        if (q) params.q = q;
        if (listingFilters.patentType) params.patentType = listingFilters.patentType;
        if (listingFilters.tradeMode) params.tradeMode = listingFilters.tradeMode;
        if (listingFilters.priceType) params.priceType = listingFilters.priceType;
        if (listingFilters.priceMinFen !== undefined) params.priceMinFen = listingFilters.priceMinFen;
        if (listingFilters.priceMaxFen !== undefined) params.priceMaxFen = listingFilters.priceMaxFen;
        if (listingFilters.depositMinFen !== undefined) params.depositMinFen = listingFilters.depositMinFen;
        if (listingFilters.depositMaxFen !== undefined) params.depositMaxFen = listingFilters.depositMaxFen;
        if (listingFilters.transferCountMin !== undefined) params.transferCountMin = listingFilters.transferCountMin;
        if (listingFilters.transferCountMax !== undefined) params.transferCountMax = listingFilters.transferCountMax;
        if (listingFilters.regionCode) params.regionCode = listingFilters.regionCode;
        if (listingFilters.ipc.trim()) params.ipc = listingFilters.ipc.trim();
        if (listingFilters.loc.trim()) params.loc = listingFilters.loc.trim();
        if (listingFilters.legalStatus) params.legalStatus = listingFilters.legalStatus;
        if (listingFilters.industryTags.length) params.industryTags = listingFilters.industryTags;
        if (listingFilters.listingTopic) params.listingTopic = listingFilters.listingTopic;
        if (listingFilters.clusterId) params.clusterId = listingFilters.clusterId;
        const d = await apiGet<PagedListingSummary>('/search/listings', params);
        setListingData(d);
        return;
      }
      if (tab === 'DEMAND') {
        const params: Record<string, any> = { page: 1, pageSize: 10, sortBy: contentSortBy };
        if (q) params.q = q;
        if (demandFilters.regionCode) params.regionCode = demandFilters.regionCode;
        if (demandFilters.cooperationModes.length) params.cooperationModes = demandFilters.cooperationModes;
        if (demandFilters.budgetType) params.budgetType = demandFilters.budgetType;
        if (demandFilters.budgetType === 'FIXED') {
          if (demandFilters.budgetMinFen !== undefined) params.budgetMinFen = demandFilters.budgetMinFen;
          if (demandFilters.budgetMaxFen !== undefined) params.budgetMaxFen = demandFilters.budgetMaxFen;
        }
        if (demandFilters.industryTags.length) params.industryTags = demandFilters.industryTags;
        const d = await apiGet<PagedDemandSummary>('/search/demands', params);
        setDemandData(d);
        return;
      }
      if (tab === 'ACHIEVEMENT') {
        const params: Record<string, any> = { page: 1, pageSize: 10, sortBy: contentSortBy };
        if (q) params.q = q;
        if (achievementFilters.regionCode) params.regionCode = achievementFilters.regionCode;
        if (achievementFilters.cooperationModes.length) params.cooperationModes = achievementFilters.cooperationModes;
        if (achievementFilters.maturity) params.maturity = achievementFilters.maturity;
        if (achievementFilters.industryTags.length) params.industryTags = achievementFilters.industryTags;
        const d = await apiGet<PagedAchievementSummary>('/search/achievements', params);
        setAchievementData(d);
        return;
      }
      if (tab === 'ARTWORK') {
        const sortByParam: ArtworkSortBy =
          artworkSortBy === 'DEPOSIT_ASC' || artworkSortBy === 'DEPOSIT_DESC' || artworkSortBy === 'YEAR_ASC' || artworkSortBy === 'YEAR_DESC'
            ? 'RECOMMENDED'
            : artworkSortBy;
        const params: Record<string, any> = { page: 1, pageSize: 10, sortBy: sortByParam };
        if (q) params.q = q;
        if (artworkFilters.category) params.category = artworkFilters.category;
        if (artworkFilters.creationYearStart !== undefined) params.creationYearStart = artworkFilters.creationYearStart;
        if (artworkFilters.creationYearEnd !== undefined) params.creationYearEnd = artworkFilters.creationYearEnd;
        if (artworkFilters.priceRange === 'NEGOTIABLE') {
          params.priceType = 'NEGOTIABLE';
        } else {
          if (artworkFilters.priceType) params.priceType = artworkFilters.priceType;
          if (artworkFilters.priceRange === 'UNDER_5000') {
            params.priceMinFen = 0;
            params.priceMaxFen = 5000 * 100;
          }
          if (artworkFilters.priceRange === '5000_10000') {
            params.priceMinFen = 5000 * 100;
            params.priceMaxFen = 10000 * 100;
          }
          if (artworkFilters.priceRange === '10000_PLUS') {
            params.priceMinFen = 10000 * 100;
          }
        }
        const d = await apiGet<PagedArtworkSummary>('/search/artworks', params);
        setArtworkData(d);
        return;
      }
    } catch (e: any) {
      setError(e?.message || '加载失败');
      setListingData(null);
      setDemandData(null);
      setAchievementData(null);
      setArtworkData(null);
    } finally {
      setLoading(false);
    }
  }, [achievementFilters, artworkFilters, artworkSortBy, contentSortBy, demandFilters, listingFilters, q, sortBy, tab]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!getToken()) return;
    syncFavorites()
      .then((ids) => setFavoriteIds(new Set(ids)))
      .catch(() => {});
  }, []);

  const startListingConsult = useCallback(async (listingId: string) => {
    if (!ensureApproved()) return;
    try {
      await apiPost<void>(`/listings/${listingId}/consultations`, { channel: 'FORM' }, { idempotencyKey: `c-${listingId}` });
    } catch (_) {
      // ignore: heat event
    }
    try {
      const conv = await apiPost<Conversation>(`/listings/${listingId}/conversations`, {}, { idempotencyKey: `conv-${listingId}` });
      Taro.navigateTo({ url: `/pages/messages/chat/index?conversationId=${conv.id}` });
    } catch (e: any) {
      toast(e?.message || '进入咨询失败');
    }
  }, []);

  const startDemandConsult = useCallback(async (demandId: string) => {
    if (!ensureApproved()) return;
    try {
      const conv = await apiPost<Conversation>(
        `/demands/${demandId}/conversations`,
        {},
        { idempotencyKey: `conv-demand-${demandId}` },
      );
      Taro.navigateTo({ url: `/pages/messages/chat/index?conversationId=${conv.id}` });
    } catch (e: any) {
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

  const openRegionPicker = useCallback((onPicked: (payload: { code: string; name: string }) => void) => {
    try {
      Taro.navigateTo({
        url: '/pages/region-picker/index',
        // Taro types for H5/weapp differ; keep it permissive.
        events: {
          regionSelected: (payload: any) => {
            const code = String(payload?.code || '').trim();
            if (!code) return;
            const name = String(payload?.name || code).trim();
            onPicked({ code, name });
          },
        },
      } as any);
    } catch (e: any) {
        toast(e?.message || '操作失败');
    }
  }, []);

  const openIpcPicker = useCallback((onPicked: (payload: { code: string; name: string }) => void) => {
    try {
      Taro.navigateTo({
        url: '/pages/ipc-picker/index',
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

  const clearAll = useCallback(() => {
    setQInput('');
    setQ('');
    setSortBy('RECOMMENDED');
    setContentSortBy('RECOMMENDED');
    setArtworkSortBy('RECOMMENDED');
    setListingFilters(LISTING_FILTER_DEFAULT);
    setDemandFilters(DEMAND_FILTER_DEFAULT);
    setAchievementFilters(ACHIEVEMENT_FILTER_DEFAULT);
    setArtworkFilters(ARTWORK_FILTER_DEFAULT);
    setFiltersOpen(false);
  }, []);

  const listingItems = useMemo(() => listingData?.items || [], [listingData?.items]);
  const demandItems = useMemo(() => demandData?.items || [], [demandData?.items]);
  const achievementItems = useMemo(() => achievementData?.items || [], [achievementData?.items]);
  const artworkItems = useMemo(() => {
    const items = artworkData?.items || [];
    if (!items.length) return items;
    if (artworkSortBy === 'DEPOSIT_ASC' || artworkSortBy === 'DEPOSIT_DESC') {
      const fallback = artworkSortBy === 'DEPOSIT_ASC' ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
      return [...items].sort((a, b) => {
        const aVal = Number.isFinite(a.depositAmountFen as number) ? Number(a.depositAmountFen) : fallback;
        const bVal = Number.isFinite(b.depositAmountFen as number) ? Number(b.depositAmountFen) : fallback;
        return artworkSortBy === 'DEPOSIT_ASC' ? aVal - bVal : bVal - aVal;
      });
    }
    if (artworkSortBy === 'YEAR_ASC' || artworkSortBy === 'YEAR_DESC') {
      const fallback = artworkSortBy === 'YEAR_ASC' ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
      return [...items].sort((a, b) => {
        const aVal = Number.isFinite(a.creationYear as number) ? Number(a.creationYear) : fallback;
        const bVal = Number.isFinite(b.creationYear as number) ? Number(b.creationYear) : fallback;
        return artworkSortBy === 'YEAR_ASC' ? aVal - bVal : bVal - aVal;
      });
    }
    return items;
  }, [artworkData?.items, artworkSortBy]);

  const artworkYearOptions = useMemo(() => {
    const years = (artworkData?.items || [])
      .map((it) => (Number.isFinite(it.creationYear as number) ? Number(it.creationYear) : NaN))
      .filter((v) => Number.isFinite(v)) as number[];
    const fallbackMax = new Date().getFullYear();
    const maxYear = years.length ? Math.max(...years) : fallbackMax;
    const minYear = years.length ? Math.min(...years) : Math.max(fallbackMax - 30, 1900);
    const list = ['不限', ...Array.from({ length: Math.max(0, maxYear - minYear + 1) }, (_, idx) => String(minYear + idx))];
    return { minYear, maxYear, options: list };
  }, [artworkData?.items]);

  const isArtworkMoreSort = useCallback(
    (v: ArtworkSortByLocal) =>
      v === 'PRICE_ASC' ||
      v === 'PRICE_DESC' ||
      v === 'DEPOSIT_ASC' ||
      v === 'DEPOSIT_DESC' ||
      v === 'YEAR_DESC' ||
      v === 'YEAR_ASC',
    [],
  );

  const listingFilterLabels = useMemo(() => {
    const out: string[] = [];
    if (listingFilters.listingTopic === 'HIGH_TECH_RETIRED') out.push('高新退役');
    if (listingFilters.listingTopic === 'CLUSTER_FEATURED') {
      out.push(listingFilters.clusterName ? `产业集群·${listingFilters.clusterName}` : '产业集群');
    }
    if (listingFilters.regionName || listingFilters.regionCode) out.push(listingFilters.regionName || listingFilters.regionCode || '');
    if (listingFilters.patentType) out.push(patentTypeLabel(listingFilters.patentType));
    if (listingFilters.tradeMode) out.push(tradeModeLabel(listingFilters.tradeMode));
    if (listingFilters.priceType) out.push(priceTypeLabel(listingFilters.priceType));
    if (listingFilters.priceType !== 'NEGOTIABLE') {
      const range = fenRangeSummary(listingFilters.priceMinFen, listingFilters.priceMaxFen);
      if (range) out.push(`价格${range}`);
    }
    {
      const range = fenRangeSummary(listingFilters.depositMinFen, listingFilters.depositMaxFen);
      if (range) out.push(`订金${range}`);
    }
    {
      const range = transferCountSummary(listingFilters.transferCountMin, listingFilters.transferCountMax);
      if (listingFilters.transferCountMin === 0 && listingFilters.transferCountMax === 0) {
        out.push('未转让');
      } else if (range) {
        out.push(`转让${range}`);
      }
    }
    if (listingFilters.ipc.trim()) {
      const label = listingFilters.ipcName?.trim() || listingFilters.ipc.trim();
      out.push(`IPC ${label}`);
    }
    if (listingFilters.loc.trim()) out.push(`LOC ${listingFilters.loc.trim()}`);
    const legal = legalStatusLabelShort(listingFilters.legalStatus);
    if (legal) out.push(`法律状态${legal}`);
    if (listingFilters.industryTags.length) out.push(`行业标签${listingFilters.industryTags.length}`);
    return out.filter(Boolean);
  }, [listingFilters]);

  const demandFilterLabels = useMemo(() => {
    const out: string[] = [];
    if (demandFilters.regionName || demandFilters.regionCode) out.push(demandFilters.regionName || demandFilters.regionCode || '');
    if (demandFilters.cooperationModes.length) out.push(`合作方式${demandFilters.cooperationModes.length}`);
    if (demandFilters.budgetType === 'NEGOTIABLE') out.push('预算面议');
    if (demandFilters.budgetType === 'FIXED') {
      const range = fenRangeSummary(demandFilters.budgetMinFen, demandFilters.budgetMaxFen);
      out.push(range ? `预算${range}` : '固定预算');
    }
    if (demandFilters.industryTags.length) out.push(`行业标签${demandFilters.industryTags.length}`);
    return out.filter(Boolean);
  }, [demandFilters]);

  const achievementFilterLabels = useMemo(() => {
    const out: string[] = [];
    if (achievementFilters.regionName || achievementFilters.regionCode)
      out.push(achievementFilters.regionName || achievementFilters.regionCode || '');
    if (achievementFilters.cooperationModes.length) out.push(`合作方式${achievementFilters.cooperationModes.length}`);
    const maturity = maturityLabelShort(achievementFilters.maturity);
    if (maturity) out.push(`成熟度${maturity}`);
    if (achievementFilters.industryTags.length) out.push(`行业标签${achievementFilters.industryTags.length}`);
    return out.filter(Boolean);
  }, [achievementFilters]);

  const artworkFilterLabels = useMemo(() => {
    const out: string[] = [];
    if (artworkFilters.category) out.push(artworkCategoryLabel(artworkFilters.category));
    const yearRange = yearRangeSummary(artworkFilters.creationYearStart, artworkFilters.creationYearEnd);
    if (yearRange) out.push(`创作年份${yearRange}`);
    if (artworkFilters.priceType && artworkFilters.priceRange !== 'NEGOTIABLE') out.push(priceTypeLabel(artworkFilters.priceType));
    if (artworkFilters.priceRange) {
      const label =
        artworkFilters.priceRange === 'UNDER_5000'
          ? '0-5000'
          : artworkFilters.priceRange === '5000_10000'
            ? '5000-10000'
            : artworkFilters.priceRange === '10000_PLUS'
              ? '10000以上'
              : '面议';
      out.push(`价格区间${label}`);
    }
    return out.filter(Boolean);
  }, [artworkFilters]);
  const selectedSummary = useMemo(() => {
    if (tab === 'LISTING') return listingFilterLabels;
    if (tab === 'DEMAND') return demandFilterLabels;
    if (tab === 'ACHIEVEMENT') return achievementFilterLabels;
    if (tab === 'ARTWORK') return artworkFilterLabels;
    return [];
  }, [tab, listingFilterLabels, demandFilterLabels, achievementFilterLabels, artworkFilterLabels]);

  return (
    <View className="container search-v4">
      <Surface className="search-hero glass-surface">
        <SearchEntry
          value={qInput}
          placeholder="输入专利/成果/需求/书画作品"
          actionText="搜索"
          onChange={(value) => {
            setQInput(value);
            if (!value) setQ('');
          }}
          onSearch={(value) => {
            setQ((value || '').trim());
          }}
        />

        <View style={{ height: '12rpx' }} />

        <CategoryControl
          className="tabs-control-compact"
          value={tab}
          options={[
            { label: '专利交易', value: 'LISTING' },
            { label: '\u4ea7\u5b66\u7814\u9700\u6c42', value: 'DEMAND' },
            { label: '成果展示', value: 'ACHIEVEMENT' },
            { label: '书画专区', value: 'ARTWORK' },
          ]}
          onChange={(v) => setTab(v as Tab)}
        />

        {tab === 'LISTING' ? (
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
            <View
              className="search-filter-btn"
              onClick={() => {
                openFilters();
              }}
            >
              <Text>筛选</Text>
            </View>
          </View>
        ) : null}

        {tab === 'DEMAND' || tab === 'ACHIEVEMENT' ? (
          <View className="search-sort-row">
            <View className="search-sort-options">
              {CONTENT_SORT_OPTIONS.map((opt) => (
                <Text
                  key={opt.value}
                  className={['search-sort-option', contentSortBy === opt.value ? 'is-active' : ''].filter(Boolean).join(' ')}
                  onClick={() => setContentSortBy(opt.value)}
                >
                  {opt.label}
                </Text>
              ))}
            </View>
            <View
              className="search-filter-btn"
              onClick={() => {
                openFilters();
              }}
            >
              <Text>筛选</Text>
            </View>
          </View>
        ) : null}

        {tab === 'ARTWORK' ? (
          <View className="search-sort-row">
            <View className="search-sort-options">
              {ARTWORK_SORT_OPTIONS.map((opt) => {
                const isMore = opt.value === 'MORE';
                const isActive = isMore ? isArtworkMoreSort(artworkSortBy) : artworkSortBy === opt.value;
                return (
                  <Text
                    key={opt.value}
                    className={['search-sort-option', isActive ? 'is-active' : ''].filter(Boolean).join(' ')}
                    onClick={() => {
                      if (isMore) {
                        setArtworkSortSheetOpen(true);
                        return;
                      }
                      setArtworkSortBy(opt.value as ArtworkSortByLocal);
                    }}
                  >
                    {opt.label}
                  </Text>
                );
              })}
            </View>
            <View className="search-filter-btn" onClick={() => setFiltersOpen(true)}>
              <Text>筛选</Text>
            </View>
          </View>
        ) : null}
        {selectedSummary.length ? (
          <View className="search-toolbar-row search-toolbar-compact">
            <View className="search-selected-scroll">
              {selectedSummary.map((txt, idx) => (
                <View key={`${txt}-${idx}`} className="pill">
                  <Text>{txt}</Text>
                </View>
              ))}
              <View
                className="pill pill-strong"
                onClick={() => {
                  if (tab === 'LISTING') setListingFilters(LISTING_FILTER_DEFAULT);
                  if (tab === 'DEMAND') setDemandFilters(DEMAND_FILTER_DEFAULT);
                  if (tab === 'ACHIEVEMENT') setAchievementFilters(ACHIEVEMENT_FILTER_DEFAULT);
                  if (tab === 'ARTWORK') setArtworkFilters(ARTWORK_FILTER_DEFAULT);
                }}
              >
                <Text>清空</Text>
              </View>
            </View>
          </View>
        ) : null}
      </Surface>

      {tab === 'ARTWORK' ? (
        <SortSheet
          visible={artworkSortSheetOpen}
          title="排序（更多）"
          value={artworkSortBy}
          options={[
            { label: '价格升序', value: 'PRICE_ASC', description: '按固定价由低到高（面议置后）' },
            { label: '价格降序', value: 'PRICE_DESC', description: '按固定价由高到低（面议置后）' },
            { label: '订金升序', value: 'DEPOSIT_ASC', description: '按订金由低到高（未填置后）' },
            { label: '订金降序', value: 'DEPOSIT_DESC', description: '按订金由高到低（未填置后）' },
            { label: '年份新到旧', value: 'YEAR_DESC', description: '按创作年份从新到旧' },
            { label: '年份旧到新', value: 'YEAR_ASC', description: '按创作年份从旧到新' },
          ]}
          onSelect={(value) => setArtworkSortBy(value as ArtworkSortByLocal)}
          onClose={() => setArtworkSortSheetOpen(false)}
        />
      ) : null}

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
            if (draft.priceMinFen !== undefined && draft.priceMaxFen !== undefined && draft.priceMinFen > draft.priceMaxFen) {
              return "价格区间不合法";
            }
            if (
              draft.depositMinFen !== undefined &&
              draft.depositMaxFen !== undefined &&
              draft.depositMinFen > draft.depositMaxFen
            ) {
              return "订金区间不合法";
            }
            if (
              draft.transferCountMin !== undefined &&
              draft.transferCountMax !== undefined &&
              draft.transferCountMin > draft.transferCountMax
            ) {
              return "转让次数区间不合法";
            }
            return null;
          }}
        >
          {({ draft, setDraft }) => {
            const transferRangeValue = transferCountRangeValue(draft.transferCountMin, draft.transferCountMax);
            return (
              <View className="search-filter-content">
                <FilterSection title="技术领域（IPC）">
                  <IndustryTagsPicker
                    value={draft.industryTags}
                    max={8}
                    onChange={(tags) => setDraft((prev) => ({ ...prev, industryTags: tags }))}
                  />
                  <Text className="text-caption muted">标签数据源：公共产业标签库。</Text>
                  <View className="search-filter-card">
                    <CellGroup divider>
                      <CellRow
                        clickable
                        title="IPC 分类"
                        description="支持按 IPC 类别筛选"
                        extra={<Text className="muted">{draft.ipcName || draft.ipc || '不限'}</Text>}
                        isLast
                        onClick={() =>
                          openIpcPicker(({ code, name }) => {
                            setDraft((prev) => ({ ...prev, ipc: code, ipcName: name }));
                          })
                        }
                      />
                    </CellGroup>
                  </View>
                  {draft.ipc ? (
                    <Button
                      className="search-filter-clear"
                      variant="ghost"
                      size="small"
                      block={false}
                      onClick={() => setDraft((prev) => ({ ...prev, ipc: '', ipcName: '' }))}
                    >
                      清空 IPC
                    </Button>
                  ) : null}
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
                        ...(v === 'NEGOTIABLE' ? { priceMinFen: undefined, priceMaxFen: undefined } : {}),
                      }))
                    }
                  />
                </FilterSection>

                <FilterSection title="价格区间">
                  <RangeInput
                    minFen={draft.priceMinFen}
                    maxFen={draft.priceMaxFen}
                    disabled={draft.priceType === 'NEGOTIABLE'}
                    onChange={(range) =>
                      setDraft((prev) => ({ ...prev, priceMinFen: range.minFen, priceMaxFen: range.maxFen }))
                    }
                  />
                  {draft.priceType === 'NEGOTIABLE' ? (
                    <Text className="text-caption muted">面议时不需要填写价格区间。</Text>
                  ) : null}
                </FilterSection>

                <FilterSection title="订金区间">
                  <RangeInput
                    minFen={draft.depositMinFen}
                    maxFen={draft.depositMaxFen}
                    onChange={(range) =>
                      setDraft((prev) => ({ ...prev, depositMinFen: range.minFen, depositMaxFen: range.maxFen }))
                    }
                  />
                </FilterSection>

                <FilterSection title="地区">
                  <View className="search-filter-card">
                    <CellGroup divider>
                      <CellRow
                        clickable
                        title="地区"
                        description="按行政区划选择"
                        extra={<Text className="muted">{draft.regionName || '不限'}</Text>}
                        isLast
                        onClick={() =>
                          openRegionPicker(({ code, name }) => {
                            setDraft((prev) => ({ ...prev, regionCode: code, regionName: name }));
                          })
                        }
                      />
                    </CellGroup>
                  </View>
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
                    onChange={(v) => setDraft((prev) => ({ ...prev, loc: v }))}
                    placeholder="LOC 如 A01"
                    clearable
                  />
                </FilterSection>
              </View>
            );
          }}

        </FilterSheet>
      ) : null}

      {tab === 'ARTWORK' ? (
        <FilterSheet<ArtworkFilters>
          open={filtersOpen}
          title="筛选（书画专区）"
          headerTitle="筛选条件"
          variant="search"
          value={artworkFilters}
          defaultValue={ARTWORK_FILTER_DEFAULT}
          onClose={() => setFiltersOpen(false)}
          onApply={(next) => setArtworkFilters(next)}
          validate={(draft) => {
            if (
              draft.creationYearStart !== undefined &&
              draft.creationYearEnd !== undefined &&
              draft.creationYearStart > draft.creationYearEnd
            ) {
              return "创作年份区间不合法";
            }
            return null;
          }}
        >
          {({ draft, setDraft }) => (
            <View className="search-filter-content">
              <FilterSection title="类别">
                <ChipGroup
                  value={draft.category}
                  options={ARTWORK_CATEGORY_OPTIONS}
                  onChange={(v) => setDraft((prev) => ({ ...prev, category: v }))}
                />
              </FilterSection>

              <FilterSection title="创作年份">
                {(() => {
                  const startOptions = artworkYearOptions.options;
                  const startLabel = draft.creationYearStart ? String(draft.creationYearStart) : '不限';
                  const startIndex = Math.max(0, startOptions.indexOf(startLabel));
                  const minYear = artworkYearOptions.minYear;
                  const endBase = startOptions.slice(1).filter((val) => {
                    const year = Number(val);
                    return !draft.creationYearStart || (Number.isFinite(year) && year >= (draft.creationYearStart || minYear));
                  });
                  const endOptions = ['不限', ...endBase];
                  const endLabel = draft.creationYearEnd ? String(draft.creationYearEnd) : '不限';
                  const endIndex = Math.max(0, endOptions.indexOf(endLabel));
                  return (
                    <View className="row" style={{ gap: '12rpx' }}>
                      <Picker
                        mode="selector"
                        range={startOptions}
                        value={startIndex}
                        onChange={(e) => {
                          const idx = Number((e as any).detail?.value ?? 0);
                          const nextValue = startOptions[idx];
                          const nextYear = nextValue === '不限' ? undefined : Number(nextValue);
                          setDraft((prev) => {
                            const next = { ...prev, creationYearStart: nextYear };
                            if (nextYear && prev.creationYearEnd && prev.creationYearEnd < nextYear) {
                              next.creationYearEnd = undefined;
                            }
                            return next;
                          });
                        }}
                      >
                        <Button className="search-filter-picker" variant="default" size="small" block={false}>
                          {startLabel}
                        </Button>
                      </Picker>
                      <Picker
                        mode="selector"
                        range={endOptions}
                        value={endIndex}
                        onChange={(e) => {
                          const idx = Number((e as any).detail?.value ?? 0);
                          const nextValue = endOptions[idx];
                          const nextYear = nextValue === '不限' ? undefined : Number(nextValue);
                          setDraft((prev) => ({ ...prev, creationYearEnd: nextYear }));
                        }}
                      >
                        <Button className="search-filter-picker" variant="default" size="small" block={false}>
                          {endLabel}
                        </Button>
                      </Picker>
                    </View>
                  );
                })()}
              </FilterSection>

              <FilterSection title="报价类型">
                <ChipGroup
                  value={draft.priceType}
                  options={PRICE_TYPE_OPTIONS}
                  onChange={(v) =>
                    setDraft((prev) => ({
                      ...prev,
                      priceType: v,
                      ...(v === 'NEGOTIABLE' ? { priceRange: 'NEGOTIABLE' } : prev.priceRange === 'NEGOTIABLE' ? { priceRange: '' } : {}),
                    }))
                  }
                />
              </FilterSection>

              <FilterSection title="价格区间">
                <ChipGroup
                  value={draft.priceRange}
                  options={ARTWORK_PRICE_RANGE_OPTIONS}
                  onChange={(v) =>
                    setDraft((prev) => ({
                      ...prev,
                      priceRange: v,
                      ...(v === 'NEGOTIABLE' ? { priceType: 'NEGOTIABLE' } : prev.priceType === 'NEGOTIABLE' ? { priceType: '' } : {}),
                    }))
                  }
                />
              </FilterSection>
            </View>
          )}

        </FilterSheet>
      ) : null}

      {tab === 'LISTING' ? (
        loading ? (
          <ListingListSkeleton />
        ) : error ? (
          <ErrorCard message={error} onRetry={load} />
        ) : listingItems.length ? (
          <View className="search-card-list listing-card-list">
            {listingItems.map((it: ListingSummary) => (
              <ListingCard
                key={it.id}
                item={it}
                favorited={favoriteIds.has(it.id)}
                onClick={() => {
                  Taro.navigateTo({ url: `/pages/listing/detail/index?listingId=${it.id}` });
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
          <EmptyCard message="暂无需求结果" actionText="刷新" onAction={load} />
        )
      ) : tab === 'DEMAND' ? (
        demandItems.length ? (
          <View className="search-card-list">
            {demandItems.map((it: DemandSummary) => {
              const location = it.regionCode ? regionNameByCode(it.regionCode) || '' : '';
              const publisher = it.publisher?.displayName || '';
              const budgetValue = demandBudgetValue(it);
              const primaryTag = it.cooperationModes?.[0]
                ? cooperationModeLabel(it.cooperationModes[0])
                : it.industryTags?.[0] || "技术需求";

              return (
                <View
                  className="demand-card-target"
                  key={it.id}
                  onClick={() => {
                    Taro.navigateTo({ url: `/pages/demand/detail/index?demandId=${it.id}` });
                  }}
                >
                  <View className="demand-card-main">
                    <View className="demand-card-tags">
                      <Text className="demand-card-tag">{primaryTag}</Text>
                      {location ? <Text className="demand-card-location">{location}</Text> : null}
                    </View>
                    <Text className="demand-card-title clamp-2">{it.title || "未命名需求"}</Text>
                    <Text className="demand-card-subinfo clamp-1">供给方：{publisher || '-'}</Text>
                    <View className="demand-card-budget">
                      <Text className="demand-card-budget-label">预算</Text>
                      <Text className="demand-card-budget-value">{budgetValue}</Text>
                    </View>
                  </View>
                  <View
                    className="demand-card-action"
                    onClick={(e) => {
                      e.stopPropagation();
                      void startDemandConsult(it.id);
                    }}
                  >
                    立即对接
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <EmptyCard message="暂无需求结果" actionText="刷新" onAction={load} />
        )
      ) : tab === 'ACHIEVEMENT' ? (
        achievementItems.length ? (
          <View className="search-card-list">
            {achievementItems.map((it: AchievementSummary) => {
              const cover = resolveLocalAsset(it.coverUrl || '');
              const publisher = it.publisher?.displayName || '';
            const location = it.regionCode ? regionNameByCode(it.regionCode) || '' : '';
              const maturityText = maturityLabelShort(it.maturity || '');
              const tags: { label: string; tone: 'green' | 'slate' }[] = [];
              it.cooperationModes?.slice(0, 2).forEach((m) => tags.push({ label: cooperationModeLabel(m), tone: 'green' }));
              it.industryTags?.slice(0, 2).forEach((t) => tags.push({ label: t, tone: 'slate' }));
              const visibleTags = tags.slice(0, 3);
              const subinfoParts: string[] = [];
              if (publisher) subinfoParts.push(`机构：${publisher}`);
              if (location) subinfoParts.push(location);
              const subinfo = subinfoParts.join(' · ');

              return (
                <View
                  className="list-card listing-item listing-item--compact search-card achievement-card"
                  key={it.id}
                  onClick={() => {
                    Taro.navigateTo({ url: `/pages/achievement/detail/index?achievementId=${it.id}` });
                  }}
                >
                  <View className="list-card-thumb listing-thumb thumb-tone-green achievement-thumb">
                    {cover ? (
                      <Image className="list-card-thumb-cover" src={cover} mode="aspectFill" />
                    ) : (
                      <Image className="list-card-thumb-img" src={iconAward} svg mode="aspectFit" />
                    )}
                  </View>
                  <View className="list-card-body listing-body--compact">
                    <View className="list-card-head">
                      <View className="list-card-head-main">
                        {visibleTags.length ? (
                          <View className="list-card-badges listing-badges-compact">
                            {visibleTags.map((tag, idx) => (
                              <Text key={`${it.id}-tag-${idx}`} className={`listing-tag listing-tag--${tag.tone} listing-tag--small`}>
                                {tag.label}
                              </Text>
                            ))}
                          </View>
                        ) : null}
                        <Text className="list-card-title clamp-1">{it.title || "未命名成果"}</Text>
                      </View>
                    </View>
                    {subinfo ? <Text className="list-card-subinfo clamp-1">{subinfo}</Text> : null}
                    {maturityText ? (
                      <View className="list-card-footer listing-footer-stacked">
                        <Text className="list-card-price">
                                                    应用阶段 <Text className="list-card-price-value list-card-price-value--muted">{maturityText}</Text>
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <EmptyCard message="暂无需求结果" actionText="刷新" onAction={load} />
        )
      ) : tab === 'ARTWORK' ? (
        loading ? (
          <LoadingCard />
        ) : error ? (
          <ErrorCard message={error} onRetry={load} />
        ) : artworkItems.length ? (
          <Surface padding="none" className="listing-list">
            {artworkItems.map((it: ArtworkSummary) => (
              <ArtworkCard
                key={it.id}
                item={it}
                onClick={() => {
                  Taro.navigateTo({ url: `/pages/artwork/detail/index?artworkId=${it.id}` });
                }}
              />
            ))}
          </Surface>
        ) : (
          <EmptyCard message="暂无需求结果" actionText="刷新" onAction={load} />
        )
      ) : null}

      <View style={{ height: '16rpx' }} />
    </View>
  );
}
