import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './index.scss';

import type { components } from '@ipmoney/api-types';

import { apiGet } from '../../lib/api';
import { formatTimeSmart } from '../../lib/format';
import { usePageAccess } from '../../lib/guard';
import { useRouteStringParam } from '../../lib/routeParams';
import { usePagedList } from '../../lib/usePagedList';
import { PageState } from '../../ui/PageState';
import { ListFooter } from '../../ui/ListFooter';
import { PageHeader, Spacer, Surface } from '../../ui/layout';
import { PullToRefresh, toast } from '../../ui/nutui';

type NoticeTab = 'system' | 'cs';
type NotificationItem = components['schemas']['Notification'];
type PagedNotification = components['schemas']['PagedNotification'];

const TABS: { id: NoticeTab; label: string }[] = [
  { id: 'system', label: '系统通知' },
  { id: 'cs', label: '客服通知' },
];

export default function NotificationsPage() {
  const tabParam = useRouteStringParam('tab');
  const [activeTab, setActiveTab] = useState<NoticeTab>('system');

  useEffect(() => {
    if (tabParam === 'system' || tabParam === 'cs') {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const fetcher = useCallback(
    async ({ page, pageSize }: { page: number; pageSize: number }) =>
      apiGet<PagedNotification>('/notifications', { page, pageSize }),
    [],
  );

  const { items, loading, error, refreshing, loadingMore, hasMore, reload, refresh, loadMore, reset } =
    usePagedList<NotificationItem>(fetcher, {
      pageSize: 50,
      onError: (message, ctx) => {
        if (ctx === 'loadMore') toast(message);
      },
    });

  const access = usePageAccess('login-required', (next) => {
    if (next.state === 'ok') {
      void reload();
      return;
    }
    reset();
  });

  const filteredItems = useMemo(() => {
    return (items || []).filter((item) => item.kind === activeTab);
  }, [items, activeTab]);

  return (
    <View className="container notifications-page">
      <PageHeader weapp back title="通知" />
      <Spacer />

      <PageState
        access={access}
        loading={loading}
        error={error}
        empty={!loading && !error && !items.length}
        emptyTitle="暂无通知"
        emptyMessage="稍后有新消息会展示在这里。"
        onRetry={reload}
      >
        <PullToRefresh type="primary" disabled={loading || refreshing} onRefresh={refresh}>
          <View className="notifications-tabs">
            {TABS.map((tab) => (
              <View
                key={tab.id}
                className={`notifications-tab ${activeTab === tab.id ? 'is-active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <Text>{tab.label}</Text>
                {activeTab === tab.id ? <View className="notifications-tab-underline" /> : null}
              </View>
            ))}
          </View>

          <View className="notifications-list">
            {filteredItems.map((item) => (
              <Surface
                key={item.id}
                className="notification-item"
                padding="none"
                onClick={() => {
                  Taro.navigateTo({ url: `/subpackages/notifications/detail/index?id=${item.id}` });
                }}
              >
                <View className="notification-item-header">
                  <View className={`notification-tag ${item.kind === 'system' ? 'is-system' : 'is-cs'}`}>
                    <Text>{item.kind === 'system' ? '系统' : '客服'}</Text>
                  </View>
                  <Text className="notification-time">{formatTimeSmart(item.time)}</Text>
                </View>
                <View className="notification-body">
                  <Text className="notification-title">{item.title}</Text>
                  <Text className="notification-summary">{item.summary}</Text>
                </View>
                <Text className="notification-source">{item.source}</Text>
              </Surface>
            ))}
            {!filteredItems.length ? (
              <Surface className="notification-empty" padding="none">
                <Text className="notification-empty-title">暂无通知</Text>
                <Text className="notification-empty-desc">稍后有新消息会展示在这里。</Text>
              </Surface>
            ) : null}
          </View>

          {!loading && items.length ? (
            <ListFooter loadingMore={loadingMore} hasMore={hasMore} onLoadMore={loadMore} showNoMore />
          ) : null}
        </PullToRefresh>
      </PageState>
    </View>
  );
}
