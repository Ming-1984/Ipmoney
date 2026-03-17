import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import './index.scss';

import type { components } from '@ipmoney/api-types';

import { apiGet } from '../../../lib/api';
import { getDetailCache, setDetailCache } from '../../../lib/detailCache';
import { formatTimeSmart } from '../../../lib/format';
import { usePageAccess } from '../../../lib/guard';
import { safeNavigateBack } from '../../../lib/navigation';
import { useRouteStringParam } from '../../../lib/routeParams';
import { PageState } from '../../../ui/PageState';
import { MissingParamCard } from '../../../ui/StateCards';
import { PageHeader, Spacer, Surface } from '../../../ui/layout';

type NotificationItem = components['schemas']['Notification'];

const NOTIFICATION_CACHE_SCOPE = 'notification-detail';

export default function NotificationDetailPage() {
  const id = useRouteStringParam('id');
  const loadedOnceRef = useRef(false);
  const initialCachedItem = id ? getDetailCache<NotificationItem>(NOTIFICATION_CACHE_SCOPE, id) : null;
  const [loading, setLoading] = useState(!initialCachedItem);
  const [error, setError] = useState<string | null>(null);
  const [item, setItem] = useState<NotificationItem | null>(initialCachedItem);

  const load = useCallback(async (options?: { silent?: boolean }) => {
    const silent = Boolean(options?.silent);
    if (!id) {
      if (!silent) {
        setError('通知不存在');
        setItem(null);
        setLoading(false);
      }
      return;
    }

    const cached = silent ? null : getDetailCache<NotificationItem>(NOTIFICATION_CACHE_SCOPE, id);
    if (cached) {
      setItem(cached);
      setLoading(false);
      setError(null);
    } else if (!silent) {
      setLoading(true);
      setError(null);
    }

    try {
      const data = await apiGet<NotificationItem>(`/notifications/${id}`);
      setItem(data);
      setDetailCache(NOTIFICATION_CACHE_SCOPE, id, data);
      if (!silent) setError(null);
    } catch (e: any) {
      if (!silent && !cached) {
        setError(e?.message || '加载失败');
        setItem(null);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [id]);

  const access = usePageAccess('login-required', (next) => {
    if (next.state === 'ok') {
      if (loadedOnceRef.current && id) {
        void load({ silent: true });
      }
      return;
    }
    loadedOnceRef.current = false;
    setItem(null);
    setLoading(false);
    setError(null);
  });

  useEffect(() => {
    loadedOnceRef.current = false;
    setError(null);
    if (!id) {
      setItem(null);
      setLoading(false);
      return;
    }
    const cached = getDetailCache<NotificationItem>(NOTIFICATION_CACHE_SCOPE, id);
    setItem(cached || null);
    setLoading(!cached);
  }, [id]);

  useEffect(() => {
    if (access.state !== 'ok') return;
    if (!id) return;
    loadedOnceRef.current = true;
    void load();
  }, [access.state, id, load]);

  if (!id) {
    return (
      <View className="container notification-detail-page">
        <PageHeader weapp back title="通知详情" subtitle="系统与客服消息" />
        <Spacer />
        <MissingParamCard onAction={() => void safeNavigateBack()} />
      </View>
    );
  }

  const showInitialLoading = loading && !item;

  return (
    <View className="container notification-detail-page">
      <PageHeader weapp back title="通知详情" subtitle="系统与客服消息" />
      <Spacer />

      <PageState
        access={access}
        loading={showInitialLoading}
        error={error}
        empty={!showInitialLoading && !error && !item}
        emptyTitle="未找到对应通知"
        emptyMessage="通知可能已被清理或不存在。"
        emptyActionText="返回"
        onEmptyAction={() => void safeNavigateBack()}
        onRetry={() => {
          void load();
        }}
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
