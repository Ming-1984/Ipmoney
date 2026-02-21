import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect } from 'react';
import './index.scss';

import { apiGet } from '../../lib/api';
import { formatTimeSmart } from '../../lib/format';
import { usePagedList } from '../../lib/usePagedList';
import { ListFooter } from '../../ui/ListFooter';
import { PageHeader, Spacer, Surface } from '../../ui/layout';
import { PullToRefresh, toast } from '../../ui/nutui';
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
  const fetcher = useCallback(
    async ({ page, pageSize }: { page: number; pageSize: number }) =>
      apiGet<PagedAnnouncements>('/public/announcements', { page, pageSize }),
    [],
  );

  const { items, loading, error, refreshing, loadingMore, hasMore, reload, refresh, loadMore } =
    usePagedList<AnnouncementSummary>(fetcher, {
      pageSize: 20,
      onError: (message, ctx) => {
        if (ctx === 'loadMore') toast(message);
      },
    });

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <View className="container announcements-page">
      <PageHeader weapp back title="公告" subtitle="挂牌清单与专利公告" />
      <Spacer />

      <PullToRefresh type="primary" disabled={loading || refreshing} onRefresh={refresh}>
        {loading ? (
          <LoadingCard text="公告加载中" />
        ) : error ? (
          <ErrorCard message={error} onRetry={reload} />
        ) : !items.length ? (
          <EmptyCard message="暂无公告" actionText="刷新" onAction={reload} />
        ) : (
          <View className="announcement-list">
            {items.map((item) => (
              <Surface
                key={item.id}
                className="announcement-card"
                padding="none"
                onClick={() => {
                  Taro.navigateTo({ url: `/subpackages/announcements/detail/index?announcementId=${item.id}` });
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

        {!loading && items.length ? (
          <ListFooter loadingMore={loadingMore} hasMore={hasMore} onLoadMore={loadMore} showNoMore />
        ) : null}
      </PullToRefresh>
    </View>
  );
}
