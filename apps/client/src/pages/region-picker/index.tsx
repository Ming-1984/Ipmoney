import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import type { components } from '@ipmoney/api-types';

import { apiGet } from '../../lib/api';
import { PageHeader, Spacer, Surface } from '../../ui/layout';
import { SearchEntry } from '../../ui/SearchEntry';
import { EmptyCard, ErrorCard, LoadingCard } from '../../ui/StateCards';

type RegionNode = components['schemas']['RegionNode'];

export default function RegionPickerPage() {
  const [qInput, setQInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [regions, setRegions] = useState<RegionNode[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await apiGet<RegionNode[]>('/regions', { level: 'PROVINCE' });
      setRegions(Array.isArray(d) ? d : []);
    } catch (e: any) {
      setError(e?.message || '加载失败');
      setRegions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const items = useMemo(() => {
    const q = qInput.trim();
    if (!q) return regions;
    return regions.filter((r) => (r.name || '').includes(q) || (r.code || '').includes(q));
  }, [qInput, regions]);

  const pick = useCallback((node: RegionNode) => {
    const channel = Taro.getCurrentInstance()?.page?.getOpenerEventChannel?.();
    channel?.emit?.('regionSelected', { code: node.code, name: node.name, level: node.level });
    Taro.navigateBack();
  }, []);

  return (
    <View className="container">
      <PageHeader title="选择地区" subtitle="用于地域推荐/地图展示；默认选择省级即可" />
      <Spacer />

      <Surface>
        <SearchEntry
          value={qInput}
          placeholder="输入省份名称/编码过滤"
          actionText="清空"
          onChange={(v) => setQInput(v)}
          onSearch={() => setQInput('')}
        />
      </Surface>

      <View style={{ height: '16rpx' }} />

      {loading ? (
        <LoadingCard text="加载地区…" />
      ) : error ? (
        <ErrorCard message={error} onRetry={load} />
      ) : items.length ? (
        <Surface padding="none">
          {items.map((it) => (
            <View
              key={it.code}
              className="list-item"
              onClick={() => {
                pick(it);
              }}
            >
              <Text className="text-strong">{it.name}</Text>
              <Text className="muted">{it.code}</Text>
            </View>
          ))}
        </Surface>
      ) : (
        <EmptyCard message="暂无地区数据" actionText="刷新" onAction={load} />
      )}
    </View>
  );
}
