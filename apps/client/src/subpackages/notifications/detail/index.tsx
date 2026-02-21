import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useState } from 'react';
import './index.scss';

import type { components } from '@ipmoney/api-types';

import { apiGet } from '../../../lib/api';
import { formatTimeSmart } from '../../../lib/format';
import { usePageAccess } from '../../../lib/guard';
import { useRouteStringParam } from '../../../lib/routeParams';
import { PageState } from '../../../ui/PageState';
import { PageHeader, Spacer, Surface } from '../../../ui/layout';

type NotificationItem = components['schemas']['Notification'];

export default function NotificationDetailPage() {
  const id = useRouteStringParam('id');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [item, setItem] = useState<NotificationItem | null>(null);

  const load = useCallback(async () => {
    if (!id) {
      setError('通知不存在');
      setItem(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<NotificationItem>(`/notifications/${id}`);
      setItem(data);
    } catch (e: any) {
      setError(e?.message || '加载失败');
      setItem(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const access = usePageAccess('login-required', (next) => {
    if (next.state === 'ok') {
      void load();
      return;
    }
    setItem(null);
    setLoading(false);
    setError(null);
  });

  return (
    <View className="container notification-detail-page">
      <PageHeader weapp back title="通知详情" subtitle="系统与客服消息" />
      <Spacer />

      <PageState
        access={access}
        loading={loading}
        error={error}
        empty={!loading && !error && !item}
        emptyTitle="未找到对应通知"
        emptyMessage="通知可能已被清理或不存在。"
        emptyActionText="返回"
        onEmptyAction={() => Taro.navigateBack()}
        onRetry={load}
      >
        {item ? (
          <Surface className="notification-detail-card" padding="none">
            <View className="notification-detail-header">
              <View className={`notification-detail-tag ${item.kind === 'system' ? 'is-system' : 'is-cs'}`}>
                <Text>{item.kind === 'system' ? '系统通知' : '客服通知'}</Text>
              </View>
              <Text className="notification-detail-time">{formatTimeSmart(item.time)}</Text>
            </View>
            <Text className="notification-detail-title">{item.title}</Text>
            <Text className="notification-detail-source">来源：{item.source}</Text>
            <View className="notification-detail-content">
              <Text className="notification-detail-paragraph">{item.summary || '暂无详情'}</Text>
            </View>
          </Surface>
        ) : null}
      </PageState>
    </View>
  );
}
