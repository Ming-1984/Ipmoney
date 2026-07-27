import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useRef } from 'react';
import './index.scss';

import type { components } from '@ipmoney/api-types';

import { apiGet } from '../../lib/api';
import { displayInfoOrPlaceholder, displayTitleOrFallback } from '../../lib/displayText';
import { formatTimeSmart } from '../../lib/format';
import { usePageAccess } from '../../lib/guard';
import { normalizeNotificationDisplay } from '../../lib/userFacingText';
import { usePagedList } from '../../lib/usePagedList';
import { PageState } from '../../ui/PageState';
import { ListFooter } from '../../ui/ListFooter';
import { PageHeader, Spacer, Surface } from '../../ui/layout';
import { PullToRefresh, toast } from '../../ui/nutui';

type NotificationItem = components['schemas']['Notification'];
type PagedNotification = components['schemas']['PagedNotification'];

const TEXT = {
  title: '\u901a\u77e5',
  emptyTitle: '\u6682\u65e0\u901a\u77e5',
  emptyMessage: '\u7a0d\u540e\u6709\u65b0\u6d88\u606f\u4f1a\u663e\u793a\u5728\u8fd9\u91cc\u3002',
  systemTag: '\u7cfb\u7edf',
} as const;

export default function NotificationsPage() {
  const loadedOnceRef = useRef(false);

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

  const reloadData = useCallback(async () => {
    await reload();
    loadedOnceRef.current = true;
  }, [reload]);

  const refreshData = useCallback(async () => {
    await refresh();
    loadedOnceRef.current = true;
  }, [refresh]);

  const access = usePageAccess('login-required', (next) => {
    if (next.state === 'ok') {
      if (loadedOnceRef.current) {
        void refreshData();
      }
      return;
    }
    loadedOnceRef.current = false;
    reset();
  });

  useEffect(() => {
    if (access.state !== 'ok') return;
    loadedOnceRef.current = true;
    void reloadData();
  }, [access.state, reloadData]);

  const showInitialLoading = loading && items.length === 0;

  return (
    <View className="container notifications-page">
      <PageHeader weapp back title={TEXT.title} />
      <Spacer />

      <PageState
        access={access}
        loading={showInitialLoading}
        error={error}
        empty={!showInitialLoading && !error && !items.length}
        emptyTitle={TEXT.emptyTitle}
        emptyMessage={TEXT.emptyMessage}
        onRetry={reloadData}
      >
        <PullToRefresh type="primary" disabled={showInitialLoading || refreshing} onRefresh={refreshData}>
          <View className="notifications-list">
            {items.map((item) => (
              (() => {
                const display = normalizeNotificationDisplay(item);
                const titleText = displayTitleOrFallback(display.title, '通知');
                const summaryText = displayInfoOrPlaceholder(display.summary, '暂无详情');
                const sourceText = displayInfoOrPlaceholder(display.source, '平台通知');
                return (
                  <Surface
                    key={item.id}
                    className="notification-item"
                    padding="none"
                    onClick={() => {
                      Taro.navigateTo({ url: `/subpackages/notifications/detail/index?id=${item.id}` });
                    }}
                  >
                    <View className="notification-item-header">
                      <View className="notification-tag is-system">
                        <Text>{TEXT.systemTag}</Text>
                      </View>
                      <Text className="notification-time">{formatTimeSmart(item.time)}</Text>
                    </View>
                    <View className="notification-body">
                      <Text className="notification-title">{titleText}</Text>
                      <Text className="notification-summary">{summaryText}</Text>
                    </View>
                    <Text className="notification-source">{sourceText}</Text>
                  </Surface>
                );
              })()
            ))}

            {!items.length ? (
              <Surface className="notification-empty" padding="none">
                <Text className="notification-empty-title">{TEXT.emptyTitle}</Text>
                <Text className="notification-empty-desc">{TEXT.emptyMessage}</Text>
              </Surface>
            ) : null}
          </View>

          {!showInitialLoading && items.length ? (
            <ListFooter loadingMore={loadingMore} hasMore={hasMore} onLoadMore={loadMore} showNoMore />
          ) : null}
        </PullToRefresh>
      </PageState>
    </View>
  );
}
