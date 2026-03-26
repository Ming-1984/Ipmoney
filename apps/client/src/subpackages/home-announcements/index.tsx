import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useState } from 'react';
import './index.scss';

import type { PublicHomeAnnouncementItem } from '../../lib/homeAnnouncements';

import { formatTimeSmart } from '../../lib/format';
import { usePageAccess } from '../../lib/guard';
import { fetchHomeAnnouncements } from '../../lib/homeAnnouncements';
import { PageState } from '../../ui/PageState';
import { PageHeader, Spacer, Surface } from '../../ui/layout';
import { PullToRefresh, toast } from '../../ui/nutui';

export default function HomeAnnouncementsPage() {
  const access = usePageAccess('public');
  const [items, setItems] = useState<PublicHomeAnnouncementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAnnouncements = useCallback(async (ctx: 'load' | 'refresh') => {
    if (ctx === 'load') {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    setError(null);
    try {
      const next = await fetchHomeAnnouncements({ max: 50 });
      setItems(next);
    } catch (err: any) {
      const message = err?.message || '加载失败';
      setError(message);
      if (ctx === 'refresh') toast(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadAnnouncements('load');
  }, [loadAnnouncements]);

  const openDetail = useCallback((item: PublicHomeAnnouncementItem) => {
    Taro.navigateTo({ url: `/subpackages/home-announcements/detail/index?id=${item.id}` });
  }, []);

  const showInitialLoading = loading && items.length === 0;
  const empty = !showInitialLoading && !error && items.length === 0;

  return (
    <View className="container home-announcements-page">
      <PageHeader weapp back title="公告" />
      <Spacer />

      <PageState
        access={access}
        loading={showInitialLoading}
        error={error}
        empty={empty}
        emptyTitle="暂无公告"
        emptyMessage="稍后发布的公告会展示在这里。"
        onRetry={() => void loadAnnouncements('load')}
      >
        <PullToRefresh
          type="primary"
          disabled={showInitialLoading || refreshing}
          onRefresh={() => loadAnnouncements('refresh')}
        >
          <View className="home-announcements-list">
            {items.map((item) => {
              const time = item.publishedAt ? formatTimeSmart(item.publishedAt) : '';
              return (
                <Surface
                  key={item.id}
                  className="home-announcement-card"
                  padding="none"
                  onClick={() => openDetail(item)}
                >
                  <View className="home-announcement-card-body">
                    <View className="home-announcement-card-header">
                      <Text className="home-announcement-card-title clamp-2">{item.title}</Text>
                    </View>
                    <Text className="home-announcement-card-summary clamp-2">{item.content || '暂无内容'}</Text>
                    {time ? <Text className="home-announcement-card-time">{time}</Text> : null}
                  </View>
                </Surface>
              );
            })}
          </View>
        </PullToRefresh>
      </PageState>
    </View>
  );
}
