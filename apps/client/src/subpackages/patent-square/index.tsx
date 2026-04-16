import { View, Text, Image } from '@tarojs/components';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './index.scss';

import {
  fetchHomeLandingConfig,
  normalizeHomeLandingConfig,
  type HomeLandingConfig,
} from '../../lib/homeLandingConfig';
import {
  executeHomeLandingAction,
  resolveHomeLandingZoneImage,
} from '../../lib/homeLandingFeatured';

export default function PatentSquarePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<HomeLandingConfig>(() => normalizeHomeLandingConfig(null));

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchHomeLandingConfig();
      setConfig(data);
    } catch (e: any) {
      setError(e?.message || '加载失败');
      setConfig((prev) => normalizeHomeLandingConfig(prev));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const items = useMemo(
    () =>
      (config.featuredZones.enabled ? config.featuredZones.items : [])
        .filter((item) => item.enabled)
        .map((item) => ({
          id: item.id,
          title: item.title,
          subtitle: item.subtitle,
          bgImage: resolveHomeLandingZoneImage(item.imageUrl),
          onClick: () => executeHomeLandingAction(item.actionType, item.actionPayload),
        })),
    [config],
  );

  return (
    <View className="patent-square-page">
      <View className="patent-square-head">
        <Text className="patent-square-title">特色专区</Text>
        <Text className="patent-square-subtitle">
          汇总展示全部特色专区，超出首页 4/6 张限制的卡片可在此进入。
        </Text>
      </View>

      {loading ? (
        <View className="patent-square-empty">加载中...</View>
      ) : error ? (
        <View className="patent-square-empty">
          {error}
          <View className="patent-square-retry" onClick={() => void load()}>
            重新加载
          </View>
        </View>
      ) : !items.length ? (
        <View className="patent-square-empty">
          暂无可展示的特色专区
          <View className="patent-square-retry" onClick={() => void load()}>
            重新加载
          </View>
        </View>
      ) : (
        <View className="patent-square-grid">
          {items.map((item) => (
            <View key={item.id} className="patent-square-card" onClick={item.onClick}>
              <Image src={item.bgImage} mode="aspectFill" className="patent-square-bg" lazyLoad />
              <View className="patent-square-scrim" />
              <View className="patent-square-content">
                <Text className="patent-square-card-title">{item.title}</Text>
                <Text className="patent-square-card-desc">{item.subtitle}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
