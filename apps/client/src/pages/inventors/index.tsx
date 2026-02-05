import { View, Text } from '@tarojs/components';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './index.scss';

import { apiGet } from '../../lib/api';
import { EmptyCard, ErrorCard, LoadingCard } from '../../ui/StateCards';

type InventorRankingItem = {
  inventorName: string;
  patentCount: number;
  listingCount: number;
  location?: string;
  typeLabel?: string;
  tags?: string[];
};

type PagedInventorRanking = {
  items: InventorRankingItem[];
  page: { page: number; pageSize: number; total: number };
};

const TITLE = '\u53d1\u660e\u4eba\u699c';
const LABEL_RANK = '\u6392\u540d';
const LABEL_PATENT_COUNT = '\u4e13\u5229\u6570';
const LABEL_LISTING_COUNT = '\u5173\u8054\u4e0a\u67b6';
const LABEL_EMPTY = '\u6682\u65e0\u6570\u636e';
const LABEL_REFRESH = '\u5237\u65b0';
const LABEL_LOAD_FAIL = '\u52a0\u8f7d\u5931\u8d25';

export default function InventorsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PagedInventorRanking | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await apiGet<PagedInventorRanking>('/search/inventors', {
        page: 1,
        pageSize: 20,
      });
      setData(d);
    } catch (e: any) {
      setError(e?.message || LABEL_LOAD_FAIL);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const items = useMemo(() => data?.items || [], [data?.items]);

  return (
    <View className="container consult-page inventor-rank-page">
      {loading ? (
        <LoadingCard />
      ) : error ? (
        <ErrorCard message={error} onRetry={load} />
      ) : items.length ? (
        <View className="inventor-rank-list">
          {items.map((it, idx) => {
            const rank = idx + 1;
            const isTop = rank <= 3;
            const typeLabel = it.typeLabel || '';
            const tags = it.tags || [];
            const showTags = Boolean(typeLabel || tags.length);
            return (
              <View key={`${it.inventorName}-${idx}`} className={`inventor-rank-card ${isTop ? 'is-top' : ''}`}>
                <View className={`inventor-rank-badge ${isTop ? 'is-top' : ''} rank-${rank}`}>
                  <Text className="inventor-rank-badge-text">{rank}</Text>
                  <Text className="inventor-rank-badge-label">{LABEL_RANK}</Text>
                </View>
                <View className="inventor-rank-main">
                  <View className="inventor-rank-title-row">
                    <Text className="inventor-rank-name clamp-1">{it.inventorName}</Text>
                    {it.location ? <Text className="inventor-rank-location">{it.location}</Text> : null}
                  </View>
                  {showTags ? (
                    <View className="inventor-rank-tags">
                      {typeLabel ? <Text className="inventor-rank-chip inventor-rank-chip-primary">{typeLabel}</Text> : null}
                      {tags.map((tag) => (
                        <Text key={`${it.inventorName}-${tag}`} className="inventor-rank-chip">
                          {tag}
                        </Text>
                      ))}
                    </View>
                  ) : null}
                </View>
                <View className="inventor-rank-stats">
                  <View className="inventor-rank-stat">
                    <Text className="inventor-rank-stat-num">{it.patentCount}</Text>
                    <Text className="inventor-rank-stat-label">{LABEL_PATENT_COUNT}</Text>
                  </View>
                  <View className="inventor-rank-stat">
                    <Text className="inventor-rank-stat-num is-muted">{it.listingCount}</Text>
                    <Text className="inventor-rank-stat-label">{LABEL_LISTING_COUNT}</Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      ) : (
        <EmptyCard message={LABEL_EMPTY} actionText={LABEL_REFRESH} onAction={load} />
      )}
    </View>
  );
}
