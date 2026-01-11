import { View, Text, Input } from '@tarojs/components';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { apiGet } from '../../lib/api';
import { EmptyCard, ErrorCard, LoadingCard } from '../../ui/StateCards';

type InventorRankingItem = { inventorName: string; patentCount: number; listingCount: number };
type PagedInventorRanking = {
  items: InventorRankingItem[];
  page: { page: number; pageSize: number; total: number };
};

export default function InventorsPage() {
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
      <View className="card">
        <Text style={{ fontSize: '34rpx', fontWeight: 700 }}>发明人排行榜</Text>
        <View style={{ height: '8rpx' }} />
        <Text className="muted">口径：按平台内用户上传的专利统计（去重）。</Text>
      </View>

      <View style={{ height: '16rpx' }} />

      <View className="card">
        <Text style={{ fontWeight: 700 }}>搜索发明人</Text>
        <View style={{ height: '8rpx' }} />
        <Input value={q} onInput={(e) => setQ(e.detail.value)} placeholder="输入姓名（可选）" />
        <View style={{ height: '12rpx' }} />
        <View className="btn-primary" onClick={load}>
          <Text>查询</Text>
        </View>
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
              <Text style={{ fontWeight: 700 }}>
                #{idx + 1} {it.inventorName}
              </Text>
              <View style={{ height: '8rpx' }} />
              <Text className="muted">
                专利数：{it.patentCount} · 关联上架：{it.listingCount}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <EmptyCard message="暂无数据（可切换 Mock 场景演示）。" actionText="刷新" onAction={load} />
      )}
    </View>
  );
}
