import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './index.scss';

import { apiGet } from '../../lib/api';
import { formatTimeSmart } from '../../lib/format';
import { PageHeader, Spacer, Surface } from '../../ui/layout';
import { EmptyCard, ErrorCard, LoadingCard } from '../../ui/StateCards';

type AnnouncementSummary = {
  id: string;
  title: string;
  publisherName?: string;
  publishedAt?: string;
  issueNo?: string;
  tags?: string[];
  summary?: string;
};

type PagedAnnouncements = {
  items: AnnouncementSummary[];
  page?: { page: number; pageSize: number; total: number };
};

function formatDate(value?: string): string {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export default function AnnouncementsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PagedAnnouncements | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await apiGet<PagedAnnouncements>('/public/announcements', { page: 1, pageSize: 20 });
      setData(d);
    } catch (e: any) {
      setError(e?.message || '加载失败');
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
    <View className="container announcements-page">
      <PageHeader weapp back title="公告" subtitle="挂牌清单与专利公告" />
      <Spacer />

      {loading ? (
        <LoadingCard text="公告加载中" />
      ) : error ? (
        <ErrorCard message={error} onRetry={load} />
      ) : !items.length ? (
        <EmptyCard message="暂无公告" actionText="刷新" onAction={load} />
      ) : (
        <View className="announcement-list">
          {items.map((item) => (
            <Surface
              key={item.id}
              className="announcement-card"
              padding="none"
              onClick={() => {
                Taro.navigateTo({ url: `/pages/announcements/detail/index?announcementId=${item.id}` });
              }}
            >
              <View className="announcement-card-header">
                <Text className="announcement-card-title">{item.title}</Text>
              </View>
              <View className="announcement-card-meta">
                <Text>{item.publisherName || '发布单位'}</Text>
                <Text>{formatDate(item.publishedAt)}</Text>
                {item.issueNo ? <Text>期次 {item.issueNo}</Text> : null}
              </View>
              {item.tags?.length ? (
                <View className="announcement-card-tags">
                  {item.tags.map((tag, idx) => (
                    <Text key={`${item.id}-tag-${idx}`} className="pill">
                      {tag}
                    </Text>
                  ))}
                </View>
              ) : null}
              {item.summary ? <Text className="announcement-card-summary">{item.summary}</Text> : null}
              {item.publishedAt ? (
                <Text className="announcement-card-time">{formatTimeSmart(item.publishedAt)}</Text>
              ) : null}
            </Surface>
          ))}
        </View>
      )}
    </View>
  );
}
