import { View, Text } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import type { components } from '@ipmoney/api-types';

import { STORAGE_KEYS } from '../../constants';
import { getToken } from '../../lib/auth';
import { apiGet, apiPost } from '../../lib/api';
import {
  favorite,
  favoriteArtwork,
  getFavoriteArtworkIds,
  getFavoriteListingIds,
  syncFavoriteArtworks,
  syncFavorites,
  unfavorite,
  unfavoriteArtwork,
} from '../../lib/favorites';
import { ensureApproved } from '../../lib/guard';
import {
  artworkCategoryLabel,
  calligraphyScriptLabel,
  paintingGenreLabel,
  patentTypeLabel,
  priceTypeLabel,
  tradeModeLabel,
  verificationTypeLabel,
} from '../../lib/labels';
import { fenToYuan, fenToYuanInt } from '../../lib/money';
import type { ChipOption } from '../../ui/filters';
import { ArtworkCard } from '../../ui/ArtworkCard';
import { ListingCard } from '../../ui/ListingCard';
import { ListingListSkeleton } from '../../ui/ListingSkeleton';
import { SearchEntry } from '../../ui/SearchEntry';
import { EmptyCard, ErrorCard, LoadingCard } from '../../ui/StateCards';
import { CategoryControl, ChipGroup, FilterSheet, FilterSummary, IndustryTagsPicker, RangeInput, SortControl, SortSheet } from '../../ui/filters';
import { CellRow, PageHeader, Spacer, Surface, Toolbar } from '../../ui/layout';
import { Button, CellGroup, Input, toast } from '../../ui/nutui';

type Tab = 'LISTING' | 'DEMAND' | 'ACHIEVEMENT' | 'ARTWORK' | 'ORG';

type PagedListingSummary = components['schemas']['PagedListingSummary'];
type ListingSummary = components['schemas']['ListingSummary'];
type SortBy = components['schemas']['SortBy'];
type PatentType = components['schemas']['PatentType'];
type TradeMode = components['schemas']['TradeMode'];
type PriceType = components['schemas']['PriceType'];
type CooperationMode = components['schemas']['CooperationMode'];
type VerificationType = components['schemas']['VerificationType'];
type LegalStatus = components['schemas']['LegalStatus'];

type PagedDemandSummary = components['schemas']['PagedDemandSummary'];
type DemandSummary = components['schemas']['DemandSummary'];

type PagedAchievementSummary = components['schemas']['PagedAchievementSummary'];
type AchievementSummary = components['schemas']['AchievementSummary'];
type AchievementMaturity = components['schemas']['AchievementMaturity'];

type PagedOrganizationSummary = components['schemas']['PagedOrganizationSummary'];
type OrganizationSummary = components['schemas']['OrganizationSummary'];

type PagedArtworkSummary = components['schemas']['PagedArtworkSummary'];
type ArtworkSummary = components['schemas']['ArtworkSummary'];
type ArtworkSortBy = components['schemas']['ArtworkSortBy'];
type ArtworkCategory = components['schemas']['ArtworkCategory'];
type CalligraphyScript = components['schemas']['CalligraphyScript'];
type PaintingGenre = components['schemas']['PaintingGenre'];

type ContentSortBy = components['schemas']['ContentSortBy'];

type Conversation = { id: string };

function fenRangeSummary(minFen?: number, maxFen?: number): string | null {
  if (minFen === undefined && maxFen === undefined) return null;
  if (minFen !== undefined && maxFen !== undefined) return `¥${fenToYuanInt(minFen)}-${fenToYuanInt(maxFen)}`;
  if (minFen !== undefined) return `≥¥${fenToYuanInt(minFen)}`;
  return `≤¥${fenToYuanInt(maxFen)}`;
}

function yearRangeSummary(start?: number, end?: number): string | null {
  if (start === undefined && end === undefined) return null;
  if (start !== undefined && end !== undefined) return `${start}-${end}`;
  if (start !== undefined) return `?${start}`;
  return `?${end}`;
}

function demandBudgetLabel(it: Pick<DemandSummary, 'budgetType' | 'budgetMinFen' | 'budgetMaxFen'>): string {
  const type = it.budgetType as PriceType | undefined;
  if (!type) return '预算：-';
  if (type === 'NEGOTIABLE') return '预算：面议';
  const min = it.budgetMinFen;
  const max = it.budgetMaxFen;
  if (min !== undefined && max !== undefined) return `预算：¥${fenToYuan(min)}–¥${fenToYuan(max)}`;
  if (min !== undefined) return `预算：≥¥${fenToYuan(min)}`;
  if (max !== undefined) return `预算：≤¥${fenToYuan(max)}`;
  return '预算：固定';
}

function maturityLabel(m?: AchievementMaturity): string {
  if (!m) return '成熟度：-';
  if (m === 'CONCEPT') return '成熟度：概念';
  if (m === 'PROTOTYPE') return '成熟度：样机/原型';
  if (m === 'PILOT') return '成熟度：中试';
  if (m === 'MASS_PRODUCTION') return '成熟度：量产';
  if (m === 'COMMERCIALIZED') return '成熟度：已产业化';
  return '成熟度：其他';
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
  if (mode === 'TRANSFER') return '转让';
  if (mode === 'LICENSE') return '许可';
  if (mode === 'EQUITY') return '股权合作';
  if (mode === 'JOINT_DEV') return '联合开发';
  if (mode === 'COMMISSIONED_DEV') return '委托开发';
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

type ListingFilters = {
  patentType: PatentType | '';
  tradeMode: TradeMode | '';
  priceType: PriceType | '';
  priceMinFen?: number;
  priceMaxFen?: number;
  depositMinFen?: number;
  depositMaxFen?: number;
  regionCode?: string;
  regionName?: string;
  ipc: string;
  loc: string;
  legalStatus: LegalStatus | '';
  industryTags: string[];
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
  calligraphyScript: CalligraphyScript | '';
  paintingGenre: PaintingGenre | '';
  creatorName: string;
  creationYearStart?: number;
  creationYearEnd?: number;
  priceType: PriceType | '';
  priceMinFen?: number;
  priceMaxFen?: number;
  depositMinFen?: number;
  depositMaxFen?: number;
  regionCode?: string;
  regionName?: string;
};

type OrgFilters = {
  regionCode?: string;
  regionName?: string;
  types: VerificationType[];
};

const LISTING_FILTER_DEFAULT: ListingFilters = {
  patentType: '',
  tradeMode: '',
  priceType: '',
  ipc: '',
  loc: '',
  legalStatus: '',
  industryTags: [],
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
  calligraphyScript: '',
  paintingGenre: '',
  creatorName: '',
  priceType: '',
};

const ORG_FILTER_DEFAULT: OrgFilters = {
  types: [],
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

const BUDGET_TYPE_OPTIONS: ChipOption<PriceType | ''>[] = [
  { value: '', label: '全部预算' },
  { value: 'FIXED', label: '固定预算' },
  { value: 'NEGOTIABLE', label: '面议' },
];

const COOPERATION_MODE_OPTIONS: ChipOption<CooperationMode>[] = [
  { value: 'TRANSFER', label: '转让' },
  { value: 'LICENSE', label: '许可' },
  { value: 'EQUITY', label: '股权合作' },
  { value: 'JOINT_DEV', label: '联合开发' },
  { value: 'COMMISSIONED_DEV', label: '委托开发' },
  { value: 'OTHER', label: '其他' },
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

const ORG_TYPE_OPTIONS: ChipOption<VerificationType>[] = [
  { value: 'COMPANY', label: '企业' },
  { value: 'ACADEMY', label: '科研院校' },
  { value: 'GOVERNMENT', label: '政府' },
  { value: 'ASSOCIATION', label: '行业协会/学会' },
  { value: 'TECH_MANAGER', label: '技术经理人' },
  { value: 'PERSON', label: '个人' },
];

const ARTWORK_CATEGORY_OPTIONS: ChipOption<ArtworkCategory | ''>[] = [
  { value: '', label: '全部类别' },
  { value: 'CALLIGRAPHY', label: '书法' },
  { value: 'PAINTING', label: '绘画' },
];

const CALLIGRAPHY_SCRIPT_OPTIONS: ChipOption<CalligraphyScript | ''>[] = [
  { value: '', label: '全部书体' },
  { value: 'KAISHU', label: '楷书' },
  { value: 'XINGSHU', label: '行书' },
  { value: 'CAOSHU', label: '草书' },
  { value: 'LISHU', label: '隶书' },
  { value: 'ZHUANSHU', label: '篆书' },
];

const PAINTING_GENRE_OPTIONS: ChipOption<PaintingGenre | ''>[] = [
  { value: '', label: '全部题材' },
  { value: 'FIGURE', label: '人物' },
  { value: 'LANDSCAPE', label: '山水' },
  { value: 'BIRD_FLOWER', label: '花鸟' },
  { value: 'OTHER', label: '其他' },
];

const LEGAL_STATUS_OPTIONS: ChipOption<LegalStatus | ''>[] = [
  { value: '', label: '全部状态' },
  { value: 'PENDING', label: '审中' },
  { value: 'GRANTED', label: '已授权' },
  { value: 'EXPIRED', label: '已失效' },
  { value: 'INVALIDATED', label: '已无效' },
  { value: 'UNKNOWN', label: '未知' },
];

export default function SearchPage() {
  const [tab, setTab] = useState<Tab>('LISTING');
  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');

  const [sortBy, setSortBy] = useState<SortBy>('RECOMMENDED');
  const [contentSortBy, setContentSortBy] = useState<ContentSortBy>('RECOMMENDED');
  const [artworkSortBy, setArtworkSortBy] = useState<ArtworkSortBy>('RECOMMENDED');

  const [listingFilters, setListingFilters] = useState<ListingFilters>(LISTING_FILTER_DEFAULT);
  const [demandFilters, setDemandFilters] = useState<DemandFilters>(DEMAND_FILTER_DEFAULT);
  const [achievementFilters, setAchievementFilters] = useState<AchievementFilters>(ACHIEVEMENT_FILTER_DEFAULT);
  const [artworkFilters, setArtworkFilters] = useState<ArtworkFilters>(ARTWORK_FILTER_DEFAULT);
  const [orgFilters, setOrgFilters] = useState<OrgFilters>(ORG_FILTER_DEFAULT);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortSheetOpen, setSortSheetOpen] = useState(false);
  const [artworkSortSheetOpen, setArtworkSortSheetOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [listingData, setListingData] = useState<PagedListingSummary | null>(null);
  const [demandData, setDemandData] = useState<PagedDemandSummary | null>(null);
  const [achievementData, setAchievementData] = useState<PagedAchievementSummary | null>(null);
  const [artworkData, setArtworkData] = useState<PagedArtworkSummary | null>(null);
  const [orgData, setOrgData] = useState<PagedOrganizationSummary | null>(null);

  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => new Set(getFavoriteListingIds()));
  const [favoriteArtworkIds, setFavoriteArtworkIds] = useState<Set<string>>(() => new Set(getFavoriteArtworkIds()));

  useEffect(() => {
    setFiltersOpen(false);
    setSortSheetOpen(false);
    setArtworkSortSheetOpen(false);
  }, [tab]);

  useDidShow(() => {
    const payload = Taro.getStorageSync(STORAGE_KEYS.searchPrefill);
    if (!payload) return;
    Taro.removeStorageSync(STORAGE_KEYS.searchPrefill);
    const keyword = typeof payload === 'string' ? payload : payload?.q;
    if (typeof keyword === 'string') {
      const trimmed = keyword.trim();
      setQInput(trimmed);
      setQ(trimmed);
    }
    if (payload?.tab) {
      setTab(payload.tab as Tab);
    }
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
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
        if (listingFilters.regionCode) params.regionCode = listingFilters.regionCode;
        if (listingFilters.ipc.trim()) params.ipc = listingFilters.ipc.trim();
        if (listingFilters.loc.trim()) params.loc = listingFilters.loc.trim();
        if (listingFilters.legalStatus) params.legalStatus = listingFilters.legalStatus;
        if (listingFilters.industryTags.length) params.industryTags = listingFilters.industryTags;
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
        const params: Record<string, any> = { page: 1, pageSize: 10, sortBy: artworkSortBy };
        if (q) params.q = q;
        if (artworkFilters.category) params.category = artworkFilters.category;
        if (artworkFilters.calligraphyScript) params.calligraphyScript = artworkFilters.calligraphyScript;
        if (artworkFilters.paintingGenre) params.paintingGenre = artworkFilters.paintingGenre;
        if (artworkFilters.creatorName.trim()) params.creator = artworkFilters.creatorName.trim();
        if (artworkFilters.creationYearStart !== undefined) params.creationYearStart = artworkFilters.creationYearStart;
        if (artworkFilters.creationYearEnd !== undefined) params.creationYearEnd = artworkFilters.creationYearEnd;
        if (artworkFilters.priceType) params.priceType = artworkFilters.priceType;
        if (artworkFilters.priceType !== 'NEGOTIABLE') {
          if (artworkFilters.priceMinFen !== undefined) params.priceMinFen = artworkFilters.priceMinFen;
          if (artworkFilters.priceMaxFen !== undefined) params.priceMaxFen = artworkFilters.priceMaxFen;
        }
        if (artworkFilters.depositMinFen !== undefined) params.depositMinFen = artworkFilters.depositMinFen;
        if (artworkFilters.depositMaxFen !== undefined) params.depositMaxFen = artworkFilters.depositMaxFen;
        if (artworkFilters.regionCode) params.regionCode = artworkFilters.regionCode;
        const d = await apiGet<PagedArtworkSummary>('/search/artworks', params);
        setArtworkData(d);
        return;
      }
      const params: Record<string, any> = { page: 1, pageSize: 10 };
      if (q) params.q = q;
      if (orgFilters.regionCode) params.regionCode = orgFilters.regionCode;
      if (orgFilters.types.length) params.types = orgFilters.types;
      const d = await apiGet<PagedOrganizationSummary>('/public/organizations', params);
      setOrgData(d);
    } catch (e: any) {
      setError(e?.message || '加载失败');
      setListingData(null);
      setDemandData(null);
      setAchievementData(null);
      setArtworkData(null);
      setOrgData(null);
    } finally {
      setLoading(false);
    }
  }, [achievementFilters, artworkFilters, artworkSortBy, contentSortBy, demandFilters, listingFilters, orgFilters, q, sortBy, tab]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!getToken()) return;
    syncFavorites()
      .then((ids) => setFavoriteIds(new Set(ids)))
      .catch(() => {});
    syncFavoriteArtworks()
      .then((ids) => setFavoriteArtworkIds(new Set(ids)))
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

  const startArtworkConsult = useCallback(async (artworkId: string) => {
    if (!ensureApproved()) return;
    try {
      const conv = await apiPost<Conversation>(
        `/artworks/${artworkId}/conversations`,
        {},
        { idempotencyKey: `conv-artwork-${artworkId}` },
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

  const toggleArtworkFavorite = useCallback(
    async (artworkId: string) => {
      if (!ensureApproved()) return;
      const isFav = favoriteArtworkIds.has(artworkId);
      try {
        if (isFav) {
          await unfavoriteArtwork(artworkId);
          setFavoriteArtworkIds((prev) => {
            const next = new Set(prev);
            next.delete(artworkId);
            return next;
          });
          toast('已取消收藏', { icon: 'success' });
          return;
        }
        await favoriteArtwork(artworkId);
        setFavoriteArtworkIds((prev) => new Set(prev).add(artworkId));
        toast('已收藏', { icon: 'success' });
      } catch (e: any) {
        toast(e?.message || '操作失败');
      }
    },
    [favoriteArtworkIds],
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
      toast(e?.message || '打开地区选择失败');
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
    setOrgFilters(ORG_FILTER_DEFAULT);
    setFiltersOpen(false);
  }, []);

  const listingItems = useMemo(() => listingData?.items || [], [listingData?.items]);
  const demandItems = useMemo(() => demandData?.items || [], [demandData?.items]);
  const achievementItems = useMemo(() => achievementData?.items || [], [achievementData?.items]);
  const artworkItems = useMemo(() => artworkData?.items || [], [artworkData?.items]);
  const orgItems = useMemo(() => orgData?.items || [], [orgData?.items]);

  const listingSortTabValue: SortBy = sortBy === 'PRICE_ASC' || sortBy === 'PRICE_DESC' ? 'RECOMMENDED' : sortBy;
  const listingMoreSortLabel = sortBy === 'PRICE_ASC' ? '价格升序' : sortBy === 'PRICE_DESC' ? '价格降序' : null;
  const artworkSortTabValue: ArtworkSortBy =
    artworkSortBy === 'PRICE_ASC' || artworkSortBy === 'PRICE_DESC' ? 'RECOMMENDED' : artworkSortBy;
  const artworkMoreSortLabel = artworkSortBy === 'PRICE_ASC' ? '价格升序' : artworkSortBy === 'PRICE_DESC' ? '价格降序' : null;

  const listingFilterLabels = useMemo(() => {
    const out: string[] = [];
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
    if (listingFilters.ipc.trim()) out.push(`IPC ${listingFilters.ipc.trim()}`);
    if (listingFilters.loc.trim()) out.push(`LOC ${listingFilters.loc.trim()}`);
    const legal = legalStatusLabelShort(listingFilters.legalStatus);
    if (legal) out.push(`法律${legal}`);
    if (listingFilters.industryTags.length) out.push(`标签${listingFilters.industryTags.length}`);
    return out.filter(Boolean);
  }, [listingFilters]);

  const demandFilterLabels = useMemo(() => {
    const out: string[] = [];
    if (demandFilters.regionName || demandFilters.regionCode) out.push(demandFilters.regionName || demandFilters.regionCode || '');
    if (demandFilters.cooperationModes.length) out.push(`合作${demandFilters.cooperationModes.length}`);
    if (demandFilters.budgetType === 'NEGOTIABLE') out.push('预算面议');
    if (demandFilters.budgetType === 'FIXED') {
      const range = fenRangeSummary(demandFilters.budgetMinFen, demandFilters.budgetMaxFen);
      out.push(range ? `预算${range}` : '固定预算');
    }
    if (demandFilters.industryTags.length) out.push(`标签${demandFilters.industryTags.length}`);
    return out.filter(Boolean);
  }, [demandFilters]);

  const achievementFilterLabels = useMemo(() => {
    const out: string[] = [];
    if (achievementFilters.regionName || achievementFilters.regionCode)
      out.push(achievementFilters.regionName || achievementFilters.regionCode || '');
    if (achievementFilters.cooperationModes.length) out.push(`合作${achievementFilters.cooperationModes.length}`);
    const maturity = maturityLabelShort(achievementFilters.maturity);
    if (maturity) out.push(`成熟度${maturity}`);
    if (achievementFilters.industryTags.length) out.push(`标签${achievementFilters.industryTags.length}`);
    return out.filter(Boolean);
  }, [achievementFilters]);

  const artworkFilterLabels = useMemo(() => {
    const out: string[] = [];
    if (artworkFilters.regionName || artworkFilters.regionCode) out.push(artworkFilters.regionName || artworkFilters.regionCode || '');
    if (artworkFilters.category) out.push(artworkCategoryLabel(artworkFilters.category));
    if (artworkFilters.calligraphyScript) out.push(calligraphyScriptLabel(artworkFilters.calligraphyScript));
    if (artworkFilters.paintingGenre) out.push(paintingGenreLabel(artworkFilters.paintingGenre));
    if (artworkFilters.creatorName.trim()) out.push(`作者${artworkFilters.creatorName.trim()}`);
    const yearRange = yearRangeSummary(artworkFilters.creationYearStart, artworkFilters.creationYearEnd);
    if (yearRange) out.push(`年份${yearRange}`);
    if (artworkFilters.priceType) out.push(priceTypeLabel(artworkFilters.priceType));
    if (artworkFilters.priceType !== 'NEGOTIABLE') {
      const range = fenRangeSummary(artworkFilters.priceMinFen, artworkFilters.priceMaxFen);
      if (range) out.push(`价格${range}`);
    }
    {
      const range = fenRangeSummary(artworkFilters.depositMinFen, artworkFilters.depositMaxFen);
      if (range) out.push(`订金${range}`);
    }
    return out.filter(Boolean);
  }, [artworkFilters]);

  const orgFilterLabels = useMemo(() => {
    const out: string[] = [];
    if (orgFilters.regionName || orgFilters.regionCode) out.push(orgFilters.regionName || orgFilters.regionCode || '');
    if (orgFilters.types.length === 1) out.push(verificationTypeLabel(orgFilters.types[0], { empty: '机构' }));
    if (orgFilters.types.length > 1) out.push(`类型${orgFilters.types.length}`);
    return out.filter(Boolean);
  }, [orgFilters]);

  return (
    <View className="container search-v3">
      <PageHeader title="检索" />
      <Spacer />

      <Surface className="search-hero glass-surface">
        <Text className="text-strong">分类</Text>
        <View style={{ height: '10rpx' }} />
        <CategoryControl
          className="tabs-control-compact"
          value={tab}
          options={[
            { label: '专利交易', value: 'LISTING' },
            { label: '产学研需求', value: 'DEMAND' },
            { label: '成果展示', value: 'ACHIEVEMENT' },
            { label: '书画专区', value: 'ARTWORK' },
            { label: '机构', value: 'ORG' },
          ]}
          onChange={(v) => setTab(v as Tab)}
        />

        <View style={{ height: '14rpx' }} />

        <SearchEntry
          value={qInput}
          placeholder="输入专利号/关键词/书画作品"
          actionText="搜索"
          onChange={(value) => {
            setQInput(value);
            if (!value) setQ('');
          }}
          onSearch={(value) => {
            setQ((value || '').trim());
          }}
        />

        {tab === 'LISTING' ? (
          <>
            <View style={{ height: '16rpx' }} />
            <View className="row-between" style={{ gap: '12rpx' }}>
              <Text className="text-strong">排序</Text>
              <Button
                variant="ghost"
                block={false}
                size="mini"
                onClick={() => {
                  setSortSheetOpen(true);
                }}
              >
                {listingMoreSortLabel ? `更多·${listingMoreSortLabel}` : '更多'}
              </Button>
            </View>
            <View style={{ height: '8rpx' }} />
            <SortControl
              className="tabs-control-compact"
              value={listingSortTabValue}
              options={[
                { label: '推荐', value: 'RECOMMENDED' },
                { label: '最新', value: 'NEWEST' },
                { label: '热度', value: 'POPULAR' },
              ]}
              onChange={(value) => setSortBy(value as SortBy)}
            />

            <View style={{ height: '12rpx' }} />

            <Toolbar
              left={<Text className="text-strong">筛选</Text>}
              right={
                <Button variant="ghost" block={false} size="mini" onClick={openFilters}>
                  筛选
                </Button>
              }
            />
            <View style={{ height: '10rpx' }} />
            <FilterSummary labels={listingFilterLabels} emptyText="未设置筛选" />

            <View style={{ height: '6rpx' }} />
            <View className="row" style={{ gap: '12rpx' }}>
              <View style={{ flex: 1 }}>
                <Button variant="ghost" size="mini" onClick={() => void load()}>
                  刷新
                </Button>
              </View>
              <View style={{ flex: 1 }}>
                <Button variant="ghost" size="mini" onClick={clearAll}>
                  清空
                </Button>
              </View>
            </View>
          </>
        ) : tab === 'ARTWORK' ? (
          <>
            <View style={{ height: '16rpx' }} />
            <View className="row-between" style={{ gap: '12rpx' }}>
              <Text className="text-strong">排序</Text>
              <Button
                variant="ghost"
                block={false}
                size="mini"
                onClick={() => {
                  setArtworkSortSheetOpen(true);
                }}
              >
                {artworkMoreSortLabel ? `更多·${artworkMoreSortLabel}` : '更多'}
              </Button>
            </View>
            <View style={{ height: '8rpx' }} />
            <SortControl
              className="tabs-control-compact"
              value={artworkSortTabValue}
              options={[
                { label: '推荐', value: 'RECOMMENDED' },
                { label: '最新', value: 'NEWEST' },
                { label: '热度', value: 'POPULAR' },
              ]}
              onChange={(value) => setArtworkSortBy(value as ArtworkSortBy)}
            />

            <View style={{ height: '12rpx' }} />

            <Toolbar
              left={<Text className="text-strong">筛选</Text>}
              right={
                <Button variant="ghost" block={false} size="mini" onClick={openFilters}>
                  筛选
                </Button>
              }
            />
            <View style={{ height: '10rpx' }} />
            <FilterSummary labels={artworkFilterLabels} emptyText="未设置筛选" />

            <View style={{ height: '6rpx' }} />
            <View className="row" style={{ gap: '12rpx' }}>
              <View style={{ flex: 1 }}>
                <Button variant="ghost" size="mini" onClick={() => void load()}>
                  刷新
                </Button>
              </View>
              <View style={{ flex: 1 }}>
                <Button variant="ghost" size="mini" onClick={clearAll}>
                  清空
                </Button>
              </View>
            </View>
          </>
        ) : tab === 'DEMAND' || tab === 'ACHIEVEMENT' ? (
          <>
            <View style={{ height: '16rpx' }} />
            <Text className="text-strong">排序</Text>
            <View style={{ height: '10rpx' }} />
            <SortControl
              className="tabs-control-compact"
              value={contentSortBy}
              options={[
                { label: '推荐', value: 'RECOMMENDED' },
                { label: '最新', value: 'NEWEST' },
                { label: '热度', value: 'POPULAR' },
              ]}
              onChange={(value) => setContentSortBy(value as ContentSortBy)}
            />
            <View style={{ height: '12rpx' }} />
            <Toolbar
              left={<Text className="text-strong">筛选</Text>}
              right={
                <Button variant="ghost" block={false} size="mini" onClick={openFilters}>
                  筛选
                </Button>
              }
            />
            <View style={{ height: '10rpx' }} />
            <FilterSummary labels={tab === 'DEMAND' ? demandFilterLabels : achievementFilterLabels} emptyText="未设置筛选" />
            <View style={{ height: '6rpx' }} />
            <View className="row" style={{ gap: '12rpx' }}>
              <View style={{ flex: 1 }}>
                <Button variant="ghost" size="mini" onClick={() => void load()}>
                  刷新
                </Button>
              </View>
              <View style={{ flex: 1 }}>
                <Button variant="ghost" size="mini" onClick={clearAll}>
                  清空
                </Button>
              </View>
            </View>
          </>
        ) : (
          <>
            <View style={{ height: '12rpx' }} />
            <Toolbar
              left={<Text className="text-strong">筛选</Text>}
              right={
                <Button variant="ghost" block={false} size="mini" onClick={openFilters}>
                  筛选
                </Button>
              }
            />
            <View style={{ height: '10rpx' }} />
            <FilterSummary labels={orgFilterLabels} emptyText="未设置筛选" />
            <View style={{ height: '6rpx' }} />
            <View className="row" style={{ gap: '12rpx' }}>
              <View style={{ flex: 1 }}>
                <Button variant="ghost" size="mini" onClick={() => void load()}>
                  刷新
                </Button>
              </View>
              <View style={{ flex: 1 }}>
                <Button variant="ghost" size="mini" onClick={clearAll}>
                  清空
                </Button>
              </View>
            </View>
          </>
        )}
      </Surface>

      {tab === 'LISTING' ? (
        <SortSheet
          visible={sortSheetOpen}
          title="排序（更多）"
          value={sortBy}
          options={[
            { label: '价格升序', value: 'PRICE_ASC', description: '按固定价由低到高（面议置后）' },
            { label: '价格降序', value: 'PRICE_DESC', description: '按固定价由高到低（面议置后）' },
          ]}
          onSelect={(value) => setSortBy(value as SortBy)}
          onClose={() => setSortSheetOpen(false)}
        />
      ) : null}

      {tab === 'ARTWORK' ? (
        <SortSheet
          visible={artworkSortSheetOpen}
          title="排序（更多）"
          value={artworkSortBy}
          options={[
            { label: '价格升序', value: 'PRICE_ASC', description: '按固定价由低到高（面议置后）' },
            { label: '价格降序', value: 'PRICE_DESC', description: '按固定价由高到低（面议置后）' },
          ]}
          onSelect={(value) => setArtworkSortBy(value as ArtworkSortBy)}
          onClose={() => setArtworkSortSheetOpen(false)}
        />
      ) : null}

      {tab === 'LISTING' ? (
        <FilterSheet<ListingFilters>
          open={filtersOpen}
          title="筛选（专利）"
          value={listingFilters}
          defaultValue={LISTING_FILTER_DEFAULT}
          onClose={() => setFiltersOpen(false)}
          onApply={(next) => setListingFilters(next)}
          validate={(draft) => {
            if (draft.priceMinFen !== undefined && draft.priceMaxFen !== undefined && draft.priceMinFen > draft.priceMaxFen) {
              return '价格区间不合法';
            }
            if (
              draft.depositMinFen !== undefined &&
              draft.depositMaxFen !== undefined &&
              draft.depositMinFen > draft.depositMaxFen
            ) {
              return '订金区间不合法';
            }
            return null;
          }}
        >
          {({ draft, setDraft }) => (
            <Surface>
              <Text className="text-strong">专利类型</Text>
              <View style={{ height: '10rpx' }} />
              <ChipGroup
                value={draft.patentType}
                options={PATENT_TYPE_OPTIONS}
                onChange={(v) => setDraft((prev) => ({ ...prev, patentType: v }))}
              />

              <View style={{ height: '8rpx' }} />
              <Text className="text-strong">交易方式</Text>
              <View style={{ height: '10rpx' }} />
              <ChipGroup
                value={draft.tradeMode}
                options={TRADE_MODE_OPTIONS}
                onChange={(v) => setDraft((prev) => ({ ...prev, tradeMode: v }))}
              />

              <View style={{ height: '8rpx' }} />
              <Text className="text-strong">报价类型</Text>
              <View style={{ height: '10rpx' }} />
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

              <View style={{ height: '8rpx' }} />
              <Text className="text-strong">价格区间</Text>
              <View style={{ height: '10rpx' }} />
              <RangeInput
                minFen={draft.priceMinFen}
                maxFen={draft.priceMaxFen}
                disabled={draft.priceType === 'NEGOTIABLE'}
                onChange={(range) =>
                  setDraft((prev) => ({ ...prev, priceMinFen: range.minFen, priceMaxFen: range.maxFen }))
                }
              />
              {draft.priceType === 'NEGOTIABLE' ? (
                <>
                  <View style={{ height: '6rpx' }} />
                  <Text className="text-caption muted">面议时不需要填写价格区间。</Text>
                </>
              ) : null}

              <View style={{ height: '8rpx' }} />
              <Text className="text-strong">订金区间</Text>
              <View style={{ height: '10rpx' }} />
              <RangeInput
                minFen={draft.depositMinFen}
                maxFen={draft.depositMaxFen}
                onChange={(range) =>
                  setDraft((prev) => ({ ...prev, depositMinFen: range.minFen, depositMaxFen: range.maxFen }))
                }
              />

              <View style={{ height: '8rpx' }} />
              <Text className="text-strong">地区</Text>
              <View style={{ height: '10rpx' }} />
              <Surface padding="none">
                <CellGroup divider>
                  <CellRow
                    clickable
                    title="地区"
                    description="用于地域推荐/地图统计"
                    extra={<Text className="muted">{draft.regionName || '不限'}</Text>}
                    isLast
                    onClick={() =>
                      openRegionPicker(({ code, name }) => {
                        setDraft((prev) => ({ ...prev, regionCode: code, regionName: name }));
                      })
                    }
                  />
                </CellGroup>
              </Surface>
              {draft.regionCode ? (
                <>
                  <View style={{ height: '10rpx' }} />
                  <Button
                    variant="ghost"
                    size="small"
                    block={false}
                    onClick={() => setDraft((prev) => ({ ...prev, regionCode: undefined, regionName: undefined }))}
                  >
                    清除地区
                  </Button>
                </>
              ) : null}

              <View style={{ height: '8rpx' }} />
              <Text className="text-strong">产业标签</Text>
              <View style={{ height: '10rpx' }} />
              <IndustryTagsPicker
                value={draft.industryTags}
                max={8}
                onChange={(tags) => setDraft((prev) => ({ ...prev, industryTags: tags }))}
              />
              <View style={{ height: '6rpx' }} />
              <Text className="text-caption muted">标签数据源：公共产业标签库。</Text>

              <View style={{ height: '8rpx' }} />
              <Text className="text-strong">IPC</Text>
              <View style={{ height: '10rpx' }} />
              <Input value={draft.ipc} onChange={(v) => setDraft((prev) => ({ ...prev, ipc: v }))} placeholder="如：H04L" clearable />

              <View style={{ height: '8rpx' }} />
              <Text className="text-strong">LOC</Text>
              <View style={{ height: '10rpx' }} />
              <Input value={draft.loc} onChange={(v) => setDraft((prev) => ({ ...prev, loc: v }))} placeholder="如：14-02" clearable />

              <View style={{ height: '8rpx' }} />
              <Text className="text-strong">法律状态</Text>
              <View style={{ height: '10rpx' }} />
              <ChipGroup
                value={draft.legalStatus}
                options={LEGAL_STATUS_OPTIONS}
                onChange={(v) => setDraft((prev) => ({ ...prev, legalStatus: v }))}
              />
            </Surface>
          )}
        </FilterSheet>
      ) : tab === 'ARTWORK' ? (
        <FilterSheet<ArtworkFilters>
          open={filtersOpen}
          title="筛选（书画专区）"
          value={artworkFilters}
          defaultValue={ARTWORK_FILTER_DEFAULT}
          onClose={() => setFiltersOpen(false)}
          onApply={(next) => setArtworkFilters(next)}
          validate={(draft) => {
            if (draft.priceMinFen !== undefined && draft.priceMaxFen !== undefined && draft.priceMinFen > draft.priceMaxFen) {
              return '价格区间不合法';
            }
            if (
              draft.depositMinFen !== undefined &&
              draft.depositMaxFen !== undefined &&
              draft.depositMinFen > draft.depositMaxFen
            ) {
              return '订金区间不合法';
            }
            if (
              draft.creationYearStart !== undefined &&
              draft.creationYearEnd !== undefined &&
              draft.creationYearStart > draft.creationYearEnd
            ) {
              return '创作年份区间不合法';
            }
            return null;
          }}
        >
          {({ draft, setDraft }) => (
            <Surface>
              <Text className="text-strong">类别</Text>
              <View style={{ height: '10rpx' }} />
              <ChipGroup
                value={draft.category}
                options={ARTWORK_CATEGORY_OPTIONS}
                onChange={(v) =>
                  setDraft((prev) => ({
                    ...prev,
                    category: v,
                    ...(v !== 'CALLIGRAPHY' ? { calligraphyScript: '' } : {}),
                    ...(v !== 'PAINTING' ? { paintingGenre: '' } : {}),
                  }))
                }
              />

              {draft.category === 'CALLIGRAPHY' ? (
                <>
                  <View style={{ height: '8rpx' }} />
                  <Text className="text-strong">书体</Text>
                  <View style={{ height: '10rpx' }} />
                  <ChipGroup
                    value={draft.calligraphyScript}
                    options={CALLIGRAPHY_SCRIPT_OPTIONS}
                    onChange={(v) => setDraft((prev) => ({ ...prev, calligraphyScript: v }))}
                  />
                </>
              ) : null}

              {draft.category === 'PAINTING' ? (
                <>
                  <View style={{ height: '8rpx' }} />
                  <Text className="text-strong">题材</Text>
                  <View style={{ height: '10rpx' }} />
                  <ChipGroup
                    value={draft.paintingGenre}
                    options={PAINTING_GENRE_OPTIONS}
                    onChange={(v) => setDraft((prev) => ({ ...prev, paintingGenre: v }))}
                  />
                </>
              ) : null}

              <View style={{ height: '8rpx' }} />
              <Text className="text-strong">作者</Text>
              <View style={{ height: '10rpx' }} />
              <Input
                value={draft.creatorName}
                onChange={(v) => setDraft((prev) => ({ ...prev, creatorName: v }))}
                placeholder="如：张三"
                clearable
              />

              <View style={{ height: '8rpx' }} />
              <Text className="text-strong">创作年份</Text>
              <View style={{ height: '10rpx' }} />
              <View className="row" style={{ gap: '12rpx' }}>
                <Input
                  value={draft.creationYearStart ? String(draft.creationYearStart) : ''}
                  onChange={(v) => {
                    const t = String(v || '').trim();
                    const n = t ? Number(t) : NaN;
                    setDraft((prev) => ({ ...prev, creationYearStart: Number.isFinite(n) ? Math.floor(n) : undefined }));
                  }}
                  placeholder="起始年份"
                  type="digit"
                  clearable
                />
                <Input
                  value={draft.creationYearEnd ? String(draft.creationYearEnd) : ''}
                  onChange={(v) => {
                    const t = String(v || '').trim();
                    const n = t ? Number(t) : NaN;
                    setDraft((prev) => ({ ...prev, creationYearEnd: Number.isFinite(n) ? Math.floor(n) : undefined }));
                  }}
                  placeholder="结束年份"
                  type="digit"
                  clearable
                />
              </View>

              <View style={{ height: '8rpx' }} />
              <Text className="text-strong">报价类型</Text>
              <View style={{ height: '10rpx' }} />
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

              <View style={{ height: '8rpx' }} />
              <Text className="text-strong">价格区间</Text>
              <View style={{ height: '10rpx' }} />
              <RangeInput
                minFen={draft.priceMinFen}
                maxFen={draft.priceMaxFen}
                disabled={draft.priceType === 'NEGOTIABLE'}
                onChange={(range) =>
                  setDraft((prev) => ({ ...prev, priceMinFen: range.minFen, priceMaxFen: range.maxFen }))
                }
              />
              {draft.priceType === 'NEGOTIABLE' ? (
                <>
                  <View style={{ height: '6rpx' }} />
                  <Text className="text-caption muted">面议时不需要填写价格区间。</Text>
                </>
              ) : null}

              <View style={{ height: '8rpx' }} />
              <Text className="text-strong">订金区间</Text>
              <View style={{ height: '10rpx' }} />
              <RangeInput
                minFen={draft.depositMinFen}
                maxFen={draft.depositMaxFen}
                onChange={(range) =>
                  setDraft((prev) => ({ ...prev, depositMinFen: range.minFen, depositMaxFen: range.maxFen }))
                }
              />

              <View style={{ height: '8rpx' }} />
              <Text className="text-strong">地区</Text>
              <View style={{ height: '10rpx' }} />
              <Surface padding="none">
                <CellGroup divider>
                  <CellRow
                    clickable
                    title="地区"
                    description="用于地域推荐/检索过滤"
                    extra={<Text className="muted">{draft.regionName || '不限'}</Text>}
                    isLast
                    onClick={() =>
                      openRegionPicker(({ code, name }) => {
                        setDraft((prev) => ({ ...prev, regionCode: code, regionName: name }));
                      })
                    }
                  />
                </CellGroup>
              </Surface>
              {draft.regionCode ? (
                <>
                  <View style={{ height: '10rpx' }} />
                  <Button
                    variant="ghost"
                    size="small"
                    block={false}
                    onClick={() => setDraft((prev) => ({ ...prev, regionCode: undefined, regionName: undefined }))}
                  >
                    清除地区
                  </Button>
                </>
              ) : null}
            </Surface>
          )}
        </FilterSheet>
      ) : tab === 'DEMAND' ? (
        <FilterSheet<DemandFilters>
          open={filtersOpen}
          title="筛选（需求）"
          value={demandFilters}
          defaultValue={DEMAND_FILTER_DEFAULT}
          onClose={() => setFiltersOpen(false)}
          onApply={(next) => setDemandFilters(next)}
          validate={(draft) => {
            if (draft.budgetType !== 'FIXED') return null;
            if (draft.budgetMinFen !== undefined && draft.budgetMaxFen !== undefined && draft.budgetMinFen > draft.budgetMaxFen) {
              return '预算区间不合法';
            }
            return null;
          }}
        >
          {({ draft, setDraft }) => (
            <Surface>
              <Text className="text-strong">地区</Text>
              <View style={{ height: '10rpx' }} />
              <Surface padding="none">
                <CellGroup divider>
                  <CellRow
                    clickable
                    title="地区"
                    description="用于地域推荐/检索过滤"
                    extra={<Text className="muted">{draft.regionName || '不限'}</Text>}
                    isLast
                    onClick={() =>
                      openRegionPicker(({ code, name }) => {
                        setDraft((prev) => ({ ...prev, regionCode: code, regionName: name }));
                      })
                    }
                  />
                </CellGroup>
              </Surface>
              {draft.regionCode ? (
                <>
                  <View style={{ height: '10rpx' }} />
                  <Button
                    variant="ghost"
                    size="small"
                    block={false}
                    onClick={() => setDraft((prev) => ({ ...prev, regionCode: undefined, regionName: undefined }))}
                  >
                    清除地区
                  </Button>
                </>
              ) : null}

              <View style={{ height: '8rpx' }} />
              <Text className="text-strong">合作方式（多选）</Text>
              <View style={{ height: '10rpx' }} />
              <ChipGroup<CooperationMode>
                multiple
                value={draft.cooperationModes}
                options={COOPERATION_MODE_OPTIONS}
                onChange={(v) => setDraft((prev) => ({ ...prev, cooperationModes: v }))}
              />

              <View style={{ height: '8rpx' }} />
              <Text className="text-strong">预算类型</Text>
              <View style={{ height: '10rpx' }} />
              <ChipGroup
                value={draft.budgetType}
                options={BUDGET_TYPE_OPTIONS}
                onChange={(v) =>
                  setDraft((prev) => ({
                    ...prev,
                    budgetType: v,
                    ...(v !== 'FIXED' ? { budgetMinFen: undefined, budgetMaxFen: undefined } : {}),
                  }))
                }
              />

              <View style={{ height: '8rpx' }} />
              <Text className="text-strong">预算区间</Text>
              <View style={{ height: '10rpx' }} />
              <RangeInput
                minFen={draft.budgetMinFen}
                maxFen={draft.budgetMaxFen}
                disabled={draft.budgetType !== 'FIXED'}
                onChange={(range) =>
                  setDraft((prev) => ({ ...prev, budgetMinFen: range.minFen, budgetMaxFen: range.maxFen }))
                }
              />
              {draft.budgetType !== 'FIXED' ? (
                <>
                  <View style={{ height: '6rpx' }} />
                  <Text className="text-caption muted">选择“固定预算”后可填写预算区间。</Text>
                </>
              ) : null}

              <View style={{ height: '8rpx' }} />
              <Text className="text-strong">产业标签</Text>
              <View style={{ height: '10rpx' }} />
              <IndustryTagsPicker
                value={draft.industryTags}
                max={8}
                onChange={(tags) => setDraft((prev) => ({ ...prev, industryTags: tags }))}
              />
            </Surface>
          )}
        </FilterSheet>
      ) : tab === 'ACHIEVEMENT' ? (
        <FilterSheet<AchievementFilters>
          open={filtersOpen}
          title="筛选（成果）"
          value={achievementFilters}
          defaultValue={ACHIEVEMENT_FILTER_DEFAULT}
          onClose={() => setFiltersOpen(false)}
          onApply={(next) => setAchievementFilters(next)}
        >
          {({ draft, setDraft }) => (
            <Surface>
              <Text className="text-strong">地区</Text>
              <View style={{ height: '10rpx' }} />
              <Surface padding="none">
                <CellGroup divider>
                  <CellRow
                    clickable
                    title="地区"
                    description="用于地域推荐/检索过滤"
                    extra={<Text className="muted">{draft.regionName || '不限'}</Text>}
                    isLast
                    onClick={() =>
                      openRegionPicker(({ code, name }) => {
                        setDraft((prev) => ({ ...prev, regionCode: code, regionName: name }));
                      })
                    }
                  />
                </CellGroup>
              </Surface>
              {draft.regionCode ? (
                <>
                  <View style={{ height: '10rpx' }} />
                  <Button
                    variant="ghost"
                    size="small"
                    block={false}
                    onClick={() => setDraft((prev) => ({ ...prev, regionCode: undefined, regionName: undefined }))}
                  >
                    清除地区
                  </Button>
                </>
              ) : null}

              <View style={{ height: '8rpx' }} />
              <Text className="text-strong">合作方式（多选）</Text>
              <View style={{ height: '10rpx' }} />
              <ChipGroup<CooperationMode>
                multiple
                value={draft.cooperationModes}
                options={COOPERATION_MODE_OPTIONS}
                onChange={(v) => setDraft((prev) => ({ ...prev, cooperationModes: v }))}
              />

              <View style={{ height: '8rpx' }} />
              <Text className="text-strong">成熟度</Text>
              <View style={{ height: '10rpx' }} />
              <ChipGroup value={draft.maturity} options={MATURITY_OPTIONS} onChange={(v) => setDraft((prev) => ({ ...prev, maturity: v }))} />

              <View style={{ height: '8rpx' }} />
              <Text className="text-strong">产业标签</Text>
              <View style={{ height: '10rpx' }} />
              <IndustryTagsPicker
                value={draft.industryTags}
                max={8}
                onChange={(tags) => setDraft((prev) => ({ ...prev, industryTags: tags }))}
              />
            </Surface>
          )}
        </FilterSheet>
      ) : (
        <FilterSheet<OrgFilters>
          open={filtersOpen}
          title="筛选（机构）"
          value={orgFilters}
          defaultValue={ORG_FILTER_DEFAULT}
          onClose={() => setFiltersOpen(false)}
          onApply={(next) => setOrgFilters(next)}
        >
          {({ draft, setDraft }) => (
            <Surface>
              <Text className="text-strong">地区</Text>
              <View style={{ height: '10rpx' }} />
              <Surface padding="none">
                <CellGroup divider>
                  <CellRow
                    clickable
                    title="地区"
                    description="用于机构检索过滤"
                    extra={<Text className="muted">{draft.regionName || '不限'}</Text>}
                    isLast
                    onClick={() =>
                      openRegionPicker(({ code, name }) => {
                        setDraft((prev) => ({ ...prev, regionCode: code, regionName: name }));
                      })
                    }
                  />
                </CellGroup>
              </Surface>
              {draft.regionCode ? (
                <>
                  <View style={{ height: '10rpx' }} />
                  <Button
                    variant="ghost"
                    size="small"
                    block={false}
                    onClick={() => setDraft((prev) => ({ ...prev, regionCode: undefined, regionName: undefined }))}
                  >
                    清除地区
                  </Button>
                </>
              ) : null}

              <View style={{ height: '8rpx' }} />
              <Text className="text-strong">机构类型（多选）</Text>
              <View style={{ height: '10rpx' }} />
              <ChipGroup<VerificationType>
                multiple
                value={draft.types}
                options={ORG_TYPE_OPTIONS}
                onChange={(v) => setDraft((prev) => ({ ...prev, types: v }))}
              />
            </Surface>
          )}
        </FilterSheet>
      )}

      <View style={{ height: '16rpx' }} />

      {loading ? (
        tab === 'LISTING' ? (
          <ListingListSkeleton />
        ) : (
          <LoadingCard />
        )
      ) : error ? (
        <ErrorCard message={error} onRetry={load} />
      ) : tab === 'LISTING' ? (
        listingItems.length ? (
          <Surface padding="none" className="listing-list">
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
          </Surface>
        ) : (
          <EmptyCard message="暂无符合条件的结果，尝试调整关键词或筛选条件。" actionText="刷新" onAction={load} />
        )
      ) : tab === 'DEMAND' ? (
        demandItems.length ? (
          <View>
            {demandItems.map((it: DemandSummary) => (
              <Surface
                key={it.id}
                style={{ marginBottom: '16rpx' }}
                onClick={() => {
                  Taro.navigateTo({ url: `/pages/demand/detail/index?demandId=${it.id}` });
                }}
              >
                <Text className="text-title clamp-2">{it.title || '未命名需求'}</Text>
                <View style={{ height: '8rpx' }} />
                <View className="row" style={{ gap: '12rpx', flexWrap: 'wrap' }}>
                  <Text className="tag tag-gold">{demandBudgetLabel(it)}</Text>
                  {it.publisher?.displayName ? <Text className="tag">{it.publisher.displayName}</Text> : null}
                </View>
                {it.cooperationModes?.length || it.industryTags?.length ? (
                  <>
                    <View style={{ height: '6rpx' }} />
                    <View className="row" style={{ gap: '10rpx', flexWrap: 'wrap' }}>
                      {it.cooperationModes?.slice(0, 2).map((m) => (
                        <Text key={`${it.id}-co-${m}`} className="tag">
                          {cooperationModeLabel(m)}
                        </Text>
                      ))}
                      {it.industryTags?.slice(0, 2).map((t) => (
                        <Text key={`${it.id}-tag-${t}`} className="tag">
                          {t}
                        </Text>
                      ))}
                    </View>
                  </>
                ) : null}
                {it.summary ? (
                  <>
                    <View style={{ height: '10rpx' }} />
                    <Text className="muted clamp-2">{it.summary}</Text>
                  </>
                ) : null}
              </Surface>
            ))}
          </View>
        ) : (
          <EmptyCard message="暂无需求结果" actionText="刷新" onAction={load} />
        )
      ) : tab === 'ACHIEVEMENT' ? (
        achievementItems.length ? (
          <View>
            {achievementItems.map((it: AchievementSummary) => (
              <Surface
                key={it.id}
                style={{ marginBottom: '16rpx' }}
                onClick={() => {
                  Taro.navigateTo({ url: `/pages/achievement/detail/index?achievementId=${it.id}` });
                }}
              >
                <Text className="text-title clamp-2">{it.title || '未命名成果'}</Text>
                <View style={{ height: '8rpx' }} />
                <View className="row" style={{ gap: '12rpx', flexWrap: 'wrap' }}>
                  <Text className="tag tag-gold">{maturityLabel(it.maturity)}</Text>
                  {it.publisher?.displayName ? <Text className="tag">{it.publisher.displayName}</Text> : null}
                </View>
                {it.cooperationModes?.length || it.industryTags?.length ? (
                  <>
                    <View style={{ height: '6rpx' }} />
                    <View className="row" style={{ gap: '10rpx', flexWrap: 'wrap' }}>
                      {it.cooperationModes?.slice(0, 2).map((m) => (
                        <Text key={`${it.id}-co-${m}`} className="tag">
                          {cooperationModeLabel(m)}
                        </Text>
                      ))}
                      {it.industryTags?.slice(0, 2).map((t) => (
                        <Text key={`${it.id}-tag-${t}`} className="tag">
                          {t}
                        </Text>
                      ))}
                    </View>
                  </>
                ) : null}
                {it.summary ? (
                  <>
                    <View style={{ height: '10rpx' }} />
                    <Text className="muted clamp-2">{it.summary}</Text>
                  </>
                ) : null}
              </Surface>
            ))}
          </View>
        ) : (
          <EmptyCard message="暂无成果结果" actionText="刷新" onAction={load} />
        )
      ) : tab === 'ARTWORK' ? (
        artworkItems.length ? (
          <Surface padding="none" className="listing-list">
            {artworkItems.map((it: ArtworkSummary) => (
              <ArtworkCard
                key={it.id}
                item={it}
                favorited={favoriteArtworkIds.has(it.id)}
                onClick={() => {
                  Taro.navigateTo({ url: `/pages/artwork/detail/index?artworkId=${it.id}` });
                }}
                onFavorite={() => {
                  void toggleArtworkFavorite(it.id);
                }}
                onConsult={() => {
                  void startArtworkConsult(it.id);
                }}
              />
            ))}
          </Surface>
        ) : (
          <EmptyCard message="暂无书画结果" actionText="刷新" onAction={load} />
        )
      ) : orgItems.length ? (
        <Surface padding="none">
          <CellGroup divider>
            {orgItems.map((it: OrganizationSummary, idx) => (
              <CellRow
                key={it.userId}
                clickable
                title={
                  <View className="row" style={{ gap: '10rpx', flexWrap: 'wrap' }}>
                    <Text className="tag tag-gold">{verificationTypeLabel(it.verificationType, { empty: '机构' })}</Text>
                    <Text className="text-strong clamp-1" style={{ flex: 1, minWidth: 0 }}>
                      {it.displayName || '-'}
                    </Text>
                  </View>
                }
                description={<Text className="muted clamp-2">{it.intro || it.regionCode || '-'}</Text>}
                isLast={idx === orgItems.length - 1}
                onClick={() => {
                  Taro.navigateTo({ url: `/pages/organizations/detail/index?orgUserId=${it.userId}` });
                }}
              />
            ))}
          </CellGroup>
        </Surface>
      ) : (
        <EmptyCard message="暂无机构结果" actionText="刷新" onAction={load} />
      )}

      <View style={{ height: '16rpx' }} />
    </View>
  );
}
