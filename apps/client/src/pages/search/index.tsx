import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useState } from 'react';

import type { components } from '@ipmoney/api-types';

import { getToken } from '../../lib/auth';
import { apiGet, apiPost } from '../../lib/api';
import { favorite, getFavoriteListingIds, syncFavorites, unfavorite } from '../../lib/favorites';
import { ensureApproved } from '../../lib/guard';
import { CellRow, PageHeader, Spacer, Surface, Toolbar } from '../../ui/layout';
import { SearchEntry } from '../../ui/SearchEntry';
import { Button, CellGroup, Popup, Segmented } from '../../ui/nutui';
import { ListingCard } from '../../ui/ListingCard';
import { ListingListSkeleton } from '../../ui/ListingSkeleton';
import { EmptyCard, ErrorCard } from '../../ui/StateCards';

type PagedListingSummary = components['schemas']['PagedListingSummary'];
type ListingSummary = components['schemas']['ListingSummary'];
type SortBy = components['schemas']['SortBy'];
type PatentType = components['schemas']['PatentType'];
type TradeMode = components['schemas']['TradeMode'];
type PriceType = components['schemas']['PriceType'];

type Conversation = { id: string };

function patentTypeLabel(t: PatentType): string {
  if (t === 'INVENTION') return '发明';
  if (t === 'UTILITY_MODEL') return '实用新型';
  if (t === 'DESIGN') return '外观设计';
  return String(t);
}

function tradeModeLabel(t: TradeMode): string {
  return t === 'ASSIGNMENT' ? '转让' : '许可';
}

function priceTypeLabel(t: PriceType): string {
  return t === 'NEGOTIABLE' ? '面议' : '一口价';
}

export default function SearchPage() {
  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('RECOMMENDED');
  const [patentType, setPatentType] = useState<PatentType | ''>('');
  const [tradeMode, setTradeMode] = useState<TradeMode | ''>('');
  const [priceType, setPriceType] = useState<PriceType | ''>('');

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftPatentType, setDraftPatentType] = useState<PatentType | ''>('');
  const [draftTradeMode, setDraftTradeMode] = useState<TradeMode | ''>('');
  const [draftPriceType, setDraftPriceType] = useState<PriceType | ''>('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PagedListingSummary | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => new Set(getFavoriteListingIds()));

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, any> = { page: 1, pageSize: 10, sortBy };
      if (q) params.q = q;
      if (patentType) params.patentType = patentType;
      if (tradeMode) params.tradeMode = tradeMode;
      if (priceType) params.priceType = priceType;
      const d = await apiGet<PagedListingSummary>('/search/listings', params);
      setData(d);
    } catch (e: any) {
      setError(e?.message || '加载失败');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [q, sortBy, patentType, tradeMode, priceType]);

  const startConsult = useCallback(async (listingId: string) => {
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
        { idempotencyKey: `demo-consult-${listingId}` },
      );
      Taro.navigateTo({ url: `/pages/messages/chat/index?conversationId=${conv.id}` });
    } catch (e: any) {
      Taro.showToast({ title: e?.message || '进入咨询失败', icon: 'none' });
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
          Taro.showToast({ title: '已取消收藏', icon: 'success' });
          return;
        }
        await favorite(listingId);
        setFavoriteIds((prev) => new Set(prev).add(listingId));
        Taro.showToast({ title: '已收藏', icon: 'success' });
      } catch (e: any) {
        Taro.showToast({ title: e?.message || '操作失败', icon: 'none' });
      }
    },
    [favoriteIds],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!getToken()) return;
    syncFavorites()
      .then((ids) => setFavoriteIds(new Set(ids)))
      .catch(() => {});
  }, []);

  const openFilters = useCallback(() => {
    setDraftPatentType(patentType);
    setDraftTradeMode(tradeMode);
    setDraftPriceType(priceType);
    setFiltersOpen(true);
  }, [patentType, priceType, tradeMode]);

  const applyFilters = useCallback(() => {
    setPatentType(draftPatentType);
    setTradeMode(draftTradeMode);
    setPriceType(draftPriceType);
    setFiltersOpen(false);
  }, [draftPatentType, draftPriceType, draftTradeMode]);

  const resetDraftFilters = useCallback(() => {
    setDraftPatentType('');
    setDraftTradeMode('');
    setDraftPriceType('');
  }, []);

  const clearAll = useCallback(() => {
    setQInput('');
    setQ('');
    setSortBy('RECOMMENDED');
    setPatentType('');
    setTradeMode('');
    setPriceType('');
  }, []);

  return (
    <View className="container">
      <PageHeader title="专利交易检索" subtitle="游客可搜索/看列表/看详情；收藏/咨询/下单需登录且审核通过。" />
      <Spacer />

      <Surface>
        <SearchEntry
          value={qInput}
          placeholder="输入关键字 / 专利号 / 发明人"
          actionText="检索"
          onChange={(value) => {
            setQInput(value);
            if (!value) setQ('');
          }}
          onSearch={(value) => {
            setQ((value || '').trim());
          }}
        />

        <View style={{ height: '16rpx' }} />

        <Text className="text-strong">排序</Text>
        <View style={{ height: '10rpx' }} />
        <Segmented
          value={sortBy}
          options={[
            { label: '推荐', value: 'RECOMMENDED' },
            { label: '热度', value: 'POPULAR' },
            { label: '最新', value: 'NEWEST' },
            { label: '发明人', value: 'INVENTOR_RANK' },
          ]}
          onChange={(value) => setSortBy(value as SortBy)}
        />

        <View style={{ height: '12rpx' }} />

        <Toolbar
          left={<Text className="text-strong">筛选</Text>}
          right={
            <Button variant="ghost" block={false} size="small" onClick={openFilters}>
              筛选
            </Button>
          }
        />
        <View style={{ height: '10rpx' }} />
        <View style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '10rpx' }}>
          {patentType ? <Text className="tag tag-active">{patentTypeLabel(patentType)}</Text> : null}
          {tradeMode ? <Text className="tag tag-active">{tradeModeLabel(tradeMode)}</Text> : null}
          {priceType ? <Text className="tag tag-active">{priceTypeLabel(priceType)}</Text> : null}
          {!patentType && !tradeMode && !priceType ? <Text className="muted">未设置筛选</Text> : null}
        </View>

        <View style={{ height: '6rpx' }} />
        <View className="row" style={{ gap: '12rpx' }}>
          <View style={{ flex: 1 }}>
            <Button variant="ghost" onClick={() => void load()}>
              刷新
            </Button>
          </View>
          <View style={{ flex: 1 }}>
            <Button variant="ghost" onClick={clearAll}>
              清空
            </Button>
          </View>
        </View>
      </Surface>

      <Popup
        visible={filtersOpen}
        position="bottom"
        round
        closeable
        title="筛选"
        onClose={() => setFiltersOpen(false)}
        onOverlayClick={() => setFiltersOpen(false)}
      >
        <View className="container">
          <View className="card">
            <Text className="text-strong">专利类型</Text>
            <View style={{ height: '10rpx' }} />
            <View className="chip-row">
              {[
                ['', '全部类型'],
                ['INVENTION', '发明'],
                ['UTILITY_MODEL', '实用新型'],
                ['DESIGN', '外观设计'],
              ].map(([value, label]) => (
                <View
                  key={`f-pt-${value || 'all'}`}
                  className={`chip ${draftPatentType === (value as PatentType) ? 'chip-active' : ''}`}
                  onClick={() => setDraftPatentType(value as PatentType | '')}
                >
                  <Text>{label}</Text>
                </View>
              ))}
            </View>

            <View style={{ height: '8rpx' }} />
            <Text className="text-strong">交易方式</Text>
            <View style={{ height: '10rpx' }} />
            <View className="chip-row">
              {[
                ['', '全部交易'],
                ['ASSIGNMENT', '转让'],
                ['LICENSE', '许可'],
              ].map(([value, label]) => (
                <View
                  key={`f-tm-${value || 'all'}`}
                  className={`chip ${draftTradeMode === (value as TradeMode) ? 'chip-active' : ''}`}
                  onClick={() => setDraftTradeMode(value as TradeMode | '')}
                >
                  <Text>{label}</Text>
                </View>
              ))}
            </View>

            <View style={{ height: '8rpx' }} />
            <Text className="text-strong">报价类型</Text>
            <View style={{ height: '10rpx' }} />
            <View className="chip-row">
              {[
                ['', '全部报价'],
                ['FIXED', '一口价'],
                ['NEGOTIABLE', '面议'],
              ].map(([value, label]) => (
                <View
                  key={`f-price-${value || 'all'}`}
                  className={`chip ${draftPriceType === (value as PriceType) ? 'chip-active' : ''}`}
                  onClick={() => setDraftPriceType(value as PriceType | '')}
                >
                  <Text>{label}</Text>
                </View>
              ))}
            </View>

            <View style={{ height: '8rpx' }} />
            <Text className="muted">更多筛选（地域/行业标签/IPC/LOC/法律状态）P1 补齐。</Text>
          </View>

          <View style={{ height: '12rpx' }} />

          <View className="card">
            <View className="row" style={{ gap: '12rpx' }}>
              <View style={{ flex: 1 }}>
                <Button variant="ghost" onClick={resetDraftFilters}>
                  重置
                </Button>
              </View>
              <View style={{ flex: 1 }}>
                <Button variant="primary" onClick={applyFilters}>
                  应用
                </Button>
              </View>
            </View>
          </View>

          <View style={{ height: '16rpx' }} />
        </View>
      </Popup>

      <View style={{ height: '16rpx' }} />

      <Surface padding="none">
        <CellGroup divider>
          <CellRow
            clickable
            title={<Text className="text-strong">发明人榜</Text>}
            description={<Text className="muted">基于平台内上传专利统计</Text>}
            onClick={() => {
              Taro.navigateTo({ url: '/pages/inventors/index' });
            }}
          />
          <CellRow
            clickable
            title={<Text className="text-strong">专利地图</Text>}
            description={<Text className="muted">查看各区域专利数量分布</Text>}
            isLast
            onClick={() => {
              Taro.navigateTo({ url: '/pages/patent-map/index' });
            }}
          />
        </CellGroup>
      </Surface>

      <View style={{ height: '16rpx' }} />

      {loading ? (
        <ListingListSkeleton />
      ) : error ? (
        <ErrorCard message={error} onRetry={load} />
      ) : data?.items?.length ? (
        <Surface padding="none" className="listing-list">
          {data.items.map((it: ListingSummary) => (
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
                void startConsult(it.id);
              }}
            />
          ))}
        </Surface>
      ) : (
        <EmptyCard
          message="暂无符合条件的结果，尝试调整关键词或筛选条件。"
          actionText="刷新"
          onAction={load}
        />
      )}

      <View style={{ height: '16rpx' }} />
    </View>
  );
}
