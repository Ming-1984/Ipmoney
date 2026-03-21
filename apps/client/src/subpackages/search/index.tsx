import { View, Text, Input } from '@tarojs/components';
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
import { listingTopicLabel, LISTING_TOPIC_OPTIONS } from '../../lib/listingTopics';
import { fenToYuanInt } from '../../lib/money';
import { ensureRegionNamesReady, regionNameByCode } from '../../lib/regions';
import type { ChipOption } from '../../ui/filters';
import { ListingCard } from '../../ui/ListingCard';
import { ListingListSkeleton } from '../../ui/ListingSkeleton';
import { SearchEntry } from '../../ui/SearchEntry';
import { EmptyCard, ErrorCard } from '../../ui/StateCards';
import { ChipGroup, FilterSheet, IndustryTagsPicker, RangeInput } from '../../ui/filters';
import { CellRow, Surface } from '../../ui/layout';
import { Button, CellGroup, PullToRefresh, toast } from '../../ui/nutui';
import { usePagedList } from '../../lib/usePagedList';
import { ListFooter } from '../../ui/ListFooter';
import emptySearchNone from '../../assets/illustrations/empty-search-none.svg';
import { STORAGE_KEYS } from '../../constants';

type ListingSummary = components['schemas']['ListingSummary'];
type PagedListingSummary = components['schemas']['PagedListingSummary'];
type SortBy = components['schemas']['SortBy'];
type PatentType = components['schemas']['PatentType'];
type TradeMode = components['schemas']['TradeMode'];
type PriceType = components['schemas']['PriceType'];
type LegalStatus = components['schemas']['LegalStatus'];
type ListingTopic = components['schemas']['ListingTopic'];

type TransferCountRange = '' | 'ZERO' | 'ONE' | 'TWO_PLUS';

type Conversation = { id: string };

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
  listingTopic: ListingTopic | '';
  clusterId?: string;
  clusterName?: string;
};

type SearchPrefill = Partial<ListingFilters> & {
  tab?: 'LISTING';
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
  clusterId: undefined,
  clusterName: undefined,
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

const LISTING_TOPIC_FILTER_OPTIONS: ChipOption<ListingTopic | ''>[] = [
  { value: '', label: '不限' },
  ...LISTING_TOPIC_OPTIONS,
];

const LISTING_SORT_OPTIONS: ChipOption<SortBy>[] = [
  { value: 'RECOMMENDED', label: '综合推荐' },
  { value: 'PRICE_ASC', label: '价格升序' },
  { value: 'PRICE_DESC', label: '价格降序' },
  { value: 'NEWEST', label: '最新发布' },
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
  if (minFen !== undefined && maxFen !== undefined) return `￥${fenToYuanInt(minFen)}-￥${fenToYuanInt(maxFen)}`;
  if (minFen !== undefined) return `￥${fenToYuanInt(minFen)}以上`;
  return `￥${fenToYuanInt(maxFen)}以内`;
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

export default function SearchPage() {
  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');

  const [sortBy, setSortBy] = useState<SortBy>('RECOMMENDED');
  const [listingFilters, setListingFilters] = useState<ListingFilters>(LISTING_FILTER_DEFAULT);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => new Set(getFavoriteListingIds()));

  useEffect(() => {
    const raw = Taro.getStorageSync(STORAGE_KEYS.searchPrefill);
    if (!raw || typeof raw !== 'object') return;
    Taro.removeStorageSync(STORAGE_KEYS.searchPrefill);

    const prefill = raw as SearchPrefill;

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
        clusterId: prefill.clusterId ?? base.clusterId,
        clusterName: prefill.clusterName ?? base.clusterName,
      };
    });
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
      if (listingFilters.clusterId) params.clusterId = listingFilters.clusterId;
      return apiGet<PagedListingSummary>('/search/listings', params);
    },
    [listingFilters, q, sortBy],
  );

  const listingList = usePagedList<ListingSummary>(fetchListing, { pageSize: 20 });

  const startListingConsult = useCallback(async (listingId: string) => {
    if (!ensureApproved()) return;
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

  const listingFilterLabels = useMemo(() => {
    const out: string[] = [];
    const topicLabel = listingTopicLabel(listingFilters.listingTopic);
    if (topicLabel) out.push(topicLabel);
    if (listingFilters.patentType) out.push(patentTypeLabel(listingFilters.patentType, { empty: '' }));
    if (listingFilters.tradeMode) out.push(tradeModeLabel(listingFilters.tradeMode, { empty: '' }));
    if (listingFilters.priceType) out.push(priceTypeLabel(listingFilters.priceType, { empty: '' }));
    const priceLabel = fenRangeSummary(listingFilters.priceMinFen, listingFilters.priceMaxFen);
    if (priceLabel) out.push(`价格${priceLabel}`);
    const depositLabel = fenRangeSummary(listingFilters.depositMinFen, listingFilters.depositMaxFen);
    if (depositLabel) out.push(`订金${depositLabel}`);
    const transferLabel = transferCountSummary(listingFilters.transferCountMin, listingFilters.transferCountMax);
    if (transferLabel) out.push(`转让${transferLabel}`);
    const regionLabel = listingFilters.regionCode ? regionNameByCode(listingFilters.regionCode) : '';
    if (regionLabel) out.push(regionLabel);
    const legalLabel = legalStatusLabelShort(listingFilters.legalStatus);
    if (legalLabel) out.push(legalLabel);
    if (listingFilters.industryTags.length) out.push(...listingFilters.industryTags.slice(0, 3));
    if (listingFilters.ipcName || listingFilters.ipc) out.push(`IPC ${listingFilters.ipcName || listingFilters.ipc}`);
    if (listingFilters.loc) out.push(`LOC ${listingFilters.loc}`);
    return out.filter(Boolean);
  }, [listingFilters]);

  const showListingInitialLoading = listingList.loading && listingItems.length === 0;

  return (
    <View className="container search-v4">
      <Surface className="search-hero glass-surface">
        <SearchEntry
          value={qInput}
          placeholder="输入专利关键词"
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

        {listingFilterLabels.length ? (
          <View className="search-selected-wrap">
            <View className="search-selected-scroll">
              {listingFilterLabels.map((txt, idx) => (
                <View key={`${txt}-${idx}`} className="pill">
                  <Text>{txt}</Text>
                </View>
              ))}
              <View
                className="pill pill-strong"
                onClick={() => {
                  setListingFilters(LISTING_FILTER_DEFAULT);
                }}
              >
                <Text>清空</Text>
              </View>
            </View>
          </View>
        ) : null}
      </Surface>

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
                  options={LISTING_TOPIC_FILTER_OPTIONS}
                  onChange={(v) => setDraft((prev) => ({ ...prev, listingTopic: v }))}
                />
              </FilterSection>

              <FilterSection title="技术领域（IPC）">
                <IndustryTagsPicker
                  value={draft.industryTags}
                  max={8}
                  onChange={(tags) => setDraft((prev) => ({ ...prev, industryTags: sanitizeIndustryTagNames(tags) }))}
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
                  onChange={(range) => setDraft((prev) => ({ ...prev, priceMinFen: range.minFen, priceMaxFen: range.maxFen }))}
                />
                {draft.priceType === 'NEGOTIABLE' ? (
                  <Text className="text-caption muted">面议时不需要填写价格区间。</Text>
                ) : null}
              </FilterSection>

              <FilterSection title="订金区间">
                <RangeInput
                  minFen={draft.depositMinFen}
                  maxFen={draft.depositMaxFen}
                  onChange={(range) => setDraft((prev) => ({ ...prev, depositMinFen: range.minFen, depositMaxFen: range.maxFen }))}
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
                  onInput={(e) => setDraft((prev) => ({ ...prev, loc: e.detail.value }))}
                  placeholder="LOC 如 A01"
                />
              </FilterSection>
            </View>
          );
        }}
      </FilterSheet>

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
          <ListFooter
            loadingMore={listingList.loadingMore}
            hasMore={listingList.hasMore}
            onLoadMore={listingList.loadMore}
            showNoMore
          />
        ) : null}
      </PullToRefresh>

      <View style={{ height: '16rpx' }} />
    </View>
  );
}
