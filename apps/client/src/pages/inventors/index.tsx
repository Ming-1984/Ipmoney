import { View, Text } from '@tarojs/components';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { apiGet } from '../../lib/api';
import { PageHeader, Spacer } from '../../ui/layout';
import { SearchEntry } from '../../ui/SearchEntry';
import { EmptyCard, ErrorCard, LoadingCard } from '../../ui/StateCards';

type InventorRankingItem = { inventorName: string; patentCount: number; listingCount: number };
type PagedInventorRanking = {
  items: InventorRankingItem[];
  page: { page: number; pageSize: number; total: number };
};

export default function InventorsPage() {
  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PagedInventorRanking | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await apiGet<PagedInventorRanking>('/search/inventors', {
        q: q || undefined,
        page: 1,
        pageSize: 20,
      });
      setData(d);
    } catch (e: any) {
      setError(e?.message || '加载失败');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    void load();
  }, [load]);

  const items = useMemo(() => data?.items || [], [data?.items]);

  return (
    <View className="container">
      <PageHeader title="发明人排行榜" subtitle="口径：按平台内用户上传的专利统计（去重）。" />
      <Spacer />

      <View className="card">
        <Text className="text-card-title">搜索发明人</Text>
        <View style={{ height: '12rpx' }} />
        <SearchEntry
          value={qInput}
          placeholder="输入姓名（可选）"
          actionText="查询"
          onChange={(value) => {
            setQInput(value);
            if (!value) setQ('');
          }}
          onSearch={(value) => {
            setQ((value || '').trim());
          }}
        />
      </View>

      <View style={{ height: '16rpx' }} />

      {loading ? (
        <LoadingCard />
      ) : error ? (
        <ErrorCard message={error} onRetry={load} />
      ) : items.length ? (
        <View>
          {items.map((it, idx) => (
            <View
              key={`${it.inventorName}-${idx}`}
              className="card"
              style={{ marginBottom: '16rpx' }}
            >
              <View className="row-between">
                <Text className="ellipsis text-strong">
                  #{idx + 1} {it.inventorName}
                </Text>
                {idx < 3 ? <Text className="tag tag-gold">TOP{idx + 1}</Text> : <Text className="tag">#{idx + 1}</Text>}
              </View>
              <View style={{ height: '8rpx' }} />
              <Text className="muted">
                专利数：{it.patentCount} · 关联上架：{it.listingCount}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <EmptyCard message="暂无数据" actionText="刷新" onAction={load} />
      )}
    </View>
  );
}
