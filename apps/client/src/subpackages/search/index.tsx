import { View, Text, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './index.scss';

import type { components } from '@ipmoney/api-types';

import { getToken } from '../../lib/auth';
import { apiGet, apiPost } from '../../lib/api';
import { favorite, getFavoriteListingIds, syncFavorites, unfavorite } from '../../lib/favorites';
import { ensureApproved } from '../../lib/guard';
import { patentTypeLabel, priceTypeLabel, tradeModeLabel } from '../../lib/labels';
import { sanitizeIndustryTagNames } from '../../lib/industryTags';
import { fenToYuanInt } from '../../lib/money';
import { resolveLocalAsset } from '../../lib/localAssets';
import { ensureRegionNamesReady, regionNameByCode } from '../../lib/regions';
import type { ChipOption } from '../../ui/filters';
import { ListingCard } from '../../ui/ListingCard';
import { ListingListSkeleton } from '../../ui/ListingSkeleton';
import { SearchEntry } from '../../ui/SearchEntry';
import { EmptyCard, ErrorCard, LoadingCard } from '../../ui/StateCards';
import { CategoryControl, ChipGroup, FilterSheet, IndustryTagsPicker, RangeInput } from '../../ui/filters';
import { CellRow, Surface } from '../../ui/layout';
import { Button, CellGroup, Input, PullToRefresh, toast } from '../../ui/nutui';
import { usePagedList } from '../../lib/usePagedList';
import { ListFooter } from '../../ui/ListFooter';
import iconAward from '../../assets/icons/icon-award-teal.svg';
import emptySearchNone from '../../assets/illustrations/empty-search-none.svg';
import { STORAGE_KEYS } from '../../constants';

type Tab = 'LISTING' | 'ACHIEVEMENT';

type ListingSummary = components['schemas']['ListingSummary'];
type PagedListingSummary = components['schemas']['PagedListingSummary'];
type SortBy = components['schemas']['SortBy'];
type PatentType = components['schemas']['PatentType'];
type TradeMode = components['schemas']['TradeMode'];
type PriceType = components['schemas']['PriceType'];
type CooperationMode = components['schemas']['CooperationMode'];
type LegalStatus = components['schemas']['LegalStatus'];
type TransferCountRange = '' | 'ZERO' | 'ONE' | 'TWO_PLUS';
type ListingTopic = '' | 'HIGH_TECH_RETIRED' | 'AWARD_WINNING';

type PagedAchievementSummary = components['schemas']['PagedAchievementSummary'];
type AchievementSummary = components['schemas']['AchievementSummary'];
type AchievementMaturity = components['schemas']['AchievementMaturity'];

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
};

type AchievementFilters = {
  regionCode?: string;
  regionName?: string;
  cooperationModes: CooperationMode[];
  maturity: AchievementMaturity | '';
  industryTags: string[];
};

type SearchPrefill = Partial<ListingFilters & AchievementFilters> & {
  tab?: Tab;
  q?: string;
  reset?: boolean;
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
};

const ACHIEVEMENT_FILTER_DEFAULT: AchievementFilters = {
  cooperationModes: [],
  maturity: '',
  industryTags: [],
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
];


export default function SearchPage() {
  const [tab, setTab] = useState<Tab>('LISTING');
  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');

  const [sortBy, setSortBy] = useState<SortBy>('RECOMMENDED');
  const [contentSortBy, setContentSortBy] = useState<ContentSortBy>('RECOMMENDED');

  const [listingFilters, setListingFilters] = useState<ListingFilters>(LISTING_FILTER_DEFAULT);
  const [achievementFilters, setAchievementFilters] = useState<AchievementFilters>(ACHIEVEMENT_FILTER_DEFAULT);

  const [filtersOpen, setFiltersOpen] = useState(false);

  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => new Set(getFavoriteListingIds()));

  useEffect(() => {
    const raw = Taro.getStorageSync(STORAGE_KEYS.searchPrefill);
    if (!raw || typeof raw !== 'object') return;
    Taro.removeStorageSync(STORAGE_KEYS.searchPrefill);

    const prefill = raw as SearchPrefill;
    const tabCandidate = typeof prefill.tab === 'string' ? prefill.tab : '';
    const nextTab =
      tabCandidate === 'LISTING' || tabCandidate === 'ACHIEVEMENT'
        ? (tabCandidate as Tab)
        : undefined;

    if (prefill.reset) {
      setListingFilters(LISTING_FILTER_DEFAULT);
      setAchievementFilters(ACHIEVEMENT_FILTER_DEFAULT);
      if (typeof prefill.q !== 'string') {
        setQInput('');
        setQ('');
      }
    }

    if (nextTab) setTab(nextTab);

    if (typeof prefill.q === 'string') {
      const nextQ = prefill.q.trim();
      setQInput(prefill.q);
      setQ(nextQ);
    }

    const targetTab = nextTab ?? 'LISTING';
    if (targetTab === 'LISTING') {
      setListingFilters((prev) => {
        const base = prefill.reset ? LISTING_FILTER_DEFAULT : prev;
        const nextIndustryTags = Array.isArray(prefill.industryTags)
          ? sanitizeIndustryTagNames(prefill.industryTags)
          : sanitizeIndustryTagNames(base.industryTags);
        return {
          ...base,
          patentType: prefill.patentType ?? base.patentType,
          tradeMode: prefill.tradeMode ?? base.tradeMode,
          priceType: prefill.priceType ?? base.priceType,
          priceMinFen: prefill.priceMinFen ?? base.priceMinFen,
          priceMaxFen: prefill.priceMaxFen ?? base.priceMaxFen,
          depositMinFen: prefill.depositMinFen ?? base.depositMinFen,
          depositMaxFen: prefill.depositMaxFen ?? base.depositMaxFen,
          transferCountMin: prefill.transferCountMin ?? base.transferCountMin,
          transferCountMax: prefill.transferCountMax ?? base.transferCountMax,
          regionCode: prefill.regionCode ?? base.regionCode,
          regionName: prefill.regionName ?? base.regionName,
          ipc: prefill.ipc ?? base.ipc,
          ipcName: prefill.ipcName ?? base.ipcName,
          loc: prefill.loc ?? base.loc,
          legalStatus: prefill.legalStatus ?? base.legalStatus,
          industryTags: nextIndustryTags,
          listingTopic: prefill.listingTopic ?? base.listingTopic,
        };
      });
    }

    if (targetTab === 'ACHIEVEMENT') {
      setAchievementFilters((prev) => {
        const base = prefill.reset ? ACHIEVEMENT_FILTER_DEFAULT : prev;
        const nextIndustryTags = Array.isArray(prefill.industryTags)
          ? sanitizeIndustryTagNames(prefill.industryTags)
          : sanitizeIndustryTagNames(base.industryTags);
        const nextCooperationModes = Array.isArray(prefill.cooperationModes)
          ? prefill.cooperationModes
          : base.cooperationModes;
        return {
          ...base,
          regionCode: prefill.regionCode ?? base.regionCode,
          regionName: prefill.regionName ?? base.regionName,
          cooperationModes: nextCooperationModes,
          maturity: prefill.maturity ?? base.maturity,
          industryTags: nextIndustryTags,
        };
      });
    }

  }, []);

  const fetchListing = useCallback(
    async ({ page, pageSize }: { page: number; pageSize: number }) => {
      await ensureRegionNamesReady();
      const params: Record<string, any> = { page, pageSize, sortBy };
      if (q) params.q = q;
      if (listingFilters.regionCode) params.regionCode = listingFilters.regionCode;
      if (listingFilters.patentType) params.patentType = listingFilters.patentType;
      if (listingFilters.tradeMode) params.tradeMode = listingFilters.tradeMode;
      if (listingFilters.priceType) params.priceType = listingFilters.priceType;
      if (listingFilters.priceType === 'FIXED') {
        if (listingFilters.priceMinFen !== undefined) params.priceMinFen = listingFilters.priceMinFen;
        if (listingFilters.priceMaxFen !== undefined) params.priceMaxFen = listingFilters.priceMaxFen;
      }
      if (listingFilters.depositMinFen !== undefined) params.depositMinFen = listingFilters.depositMinFen;
      if (listingFilters.depositMaxFen !== undefined) params.depositMaxFen = listingFilters.depositMaxFen;
      if (listingFilters.transferCountMin !== undefined) params.transferCountMin = listingFilters.transferCountMin;
      if (listingFilters.transferCountMax !== undefined) params.transferCountMax = listingFilters.transferCountMax;
      if (listingFilters.ipc.trim()) params.ipc = listingFilters.ipc.trim();
      if (listingFilters.loc.trim()) params.loc = listingFilters.loc.trim();
      if (listingFilters.legalStatus) params.legalStatus = listingFilters.legalStatus;
      const listingIndustryTags = sanitizeIndustryTagNames(listingFilters.industryTags);
      if (listingIndustryTags.length) params.industryTags = listingIndustryTags;
      if (listingFilters.listingTopic) params.listingTopic = listingFilters.listingTopic;
      return apiGet<PagedListingSummary>('/search/listings', params);
    },
    [listingFilters, q, sortBy],
  );




  const fetchAchievement = useCallback(
    async ({ page, pageSize }: { page: number; pageSize: number }) => {
      await ensureRegionNamesReady();
      const params: Record<string, any> = { page, pageSize, sortBy: contentSortBy };
      if (q) params.q = q;
      if (achievementFilters.regionCode) params.regionCode = achievementFilters.regionCode;
      if (achievementFilters.cooperationModes.length) params.cooperationModes = achievementFilters.cooperationModes;
      if (achievementFilters.maturity) params.maturity = achievementFilters.maturity;
      const achievementIndustryTags = sanitizeIndustryTagNames(achievementFilters.industryTags);
      if (achievementIndustryTags.length) params.industryTags = achievementIndustryTags;
      return apiGet<PagedAchievementSummary>('/search/achievements', params);
    },
    [achievementFilters, contentSortBy, q],
  );

  const listingList = usePagedList<ListingSummary>(fetchListing, {
    pageSize: 10,
    onError: (message, ctx) => {
      if (ctx === 'loadMore') toast(message);
    },
  });

  const achievementList = usePagedList<AchievementSummary>(fetchAchievement, {
    pageSize: 10,
    onError: (message, ctx) => {
      if (ctx === 'loadMore') toast(message);
    },
  });

  useEffect(() => {
    if (tab !== 'LISTING') return;
    void listingList.reload();
  }, [listingFilters, listingList.reload, q, sortBy, tab]);

  useEffect(() => {
    if (tab !== 'ACHIEVEMENT') return;
    void achievementList.reload();
  }, [achievementFilters, achievementList.reload, contentSortBy, q, tab]);

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
      Taro.navigateTo({ url: `/subpackages/messages/chat/index?conversationId=${conv.id}` });
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
        url: '/subpackages/region-picker/index',
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
  const showListingInitialLoading = listingList.loading && listingItems.length === 0;
  const showAchievementInitialLoading = achievementList.loading && achievementItems.length === 0;

  const listingFilterLabels = useMemo(() => {
    const out: string[] = [];
    if (listingFilters.listingTopic === 'HIGH_TECH_RETIRED') out.push('退役专利');
    if (listingFilters.listingTopic === 'AWARD_WINNING') out.push('获奖专利');
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

  const selectedSummary = useMemo(() => {
    if (tab === 'LISTING') return listingFilterLabels;
    if (tab === 'ACHIEVEMENT') return achievementFilterLabels;
    return [];
  }, [tab, listingFilterLabels, achievementFilterLabels]);

  return (
    <View className="container search-v4">
      <Surface className="search-hero glass-surface">
        <SearchEntry
          value={qInput}
          placeholder="输入专利/成果"
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
            { label: '专利成果', value: 'ACHIEVEMENT' },
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

        {tab === 'ACHIEVEMENT' ? (
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
                  if (tab === 'ACHIEVEMENT') setAchievementFilters(ACHIEVEMENT_FILTER_DEFAULT);
                }}
              >
                <Text>清空</Text>
              </View>
            </View>
          </View>
        ) : null}
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
                    onChange={(tags) =>
                      setDraft((prev) => ({ ...prev, industryTags: sanitizeIndustryTagNames(tags) }))
                    }
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


      {tab === 'LISTING' ? (
        <PullToRefresh type="primary" disabled={showListingInitialLoading || listingList.refreshing} onRefresh={listingList.refresh}>
          {showListingInitialLoading ? (
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
          )}

          {!showListingInitialLoading && listingItems.length ? (
            <ListFooter loadingMore={listingList.loadingMore} hasMore={listingList.hasMore} onLoadMore={listingList.loadMore} showNoMore />
          ) : null}
        </PullToRefresh>
      ) : tab === 'ACHIEVEMENT' ? (
        <PullToRefresh
          type="primary"
          disabled={showAchievementInitialLoading || achievementList.refreshing}
          onRefresh={achievementList.refresh}
        >
          {showAchievementInitialLoading ? (
            <LoadingCard />
          ) : achievementList.error ? (
            <ErrorCard message={achievementList.error} onRetry={achievementList.reload} />
          ) : achievementItems.length ? (
            <View className="search-card-list">
              {achievementItems.map((it: AchievementSummary) => {
                const cover = resolveLocalAsset(it.coverUrl || '');
                const publisher = it.publisher?.displayName || '';
                const location = it.regionCode ? regionNameByCode(it.regionCode) || '' : '';
                const maturityText = maturityLabelShort(it.maturity || '');
                const tags: { label: string; tone: 'green' | 'slate' }[] = [];
                const visibleIndustryTags = sanitizeIndustryTagNames(it.industryTags || []);
                it.cooperationModes?.slice(0, 2).forEach((m) => tags.push({ label: cooperationModeLabel(m), tone: 'green' }));
                visibleIndustryTags.slice(0, 2).forEach((t) => tags.push({ label: t, tone: 'slate' }));
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
                      Taro.navigateTo({ url: `/subpackages/achievement/detail/index?achievementId=${it.id}` });
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
                            应用阶段{' '}
                            <Text className="list-card-price-value list-card-price-value--muted">{maturityText}</Text>
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                );
              })}
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

          {!showAchievementInitialLoading && achievementItems.length ? (
            <ListFooter
              loadingMore={achievementList.loadingMore}
              hasMore={achievementList.hasMore}
              onLoadMore={achievementList.loadMore}
              showNoMore
            />
          ) : null}
        </PullToRefresh>
      ) : null}

      <View style={{ height: '16rpx' }} />
    </View>
  );
}
