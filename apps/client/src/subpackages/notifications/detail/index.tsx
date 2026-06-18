import { View, Text } from '@tarojs/components';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import './index.scss';

import type { components } from '@ipmoney/api-types';

import { apiGet } from '../../../lib/api';
import { getDetailCache, setDetailCache } from '../../../lib/detailCache';
import { displayInfoOrPlaceholder, normalizeDisplayText } from '../../../lib/displayText';
import { formatTimeSmart } from '../../../lib/format';
import { usePageAccess } from '../../../lib/guard';
import { safeNavigateBack } from '../../../lib/navigation';
import { useRouteStringParam } from '../../../lib/routeParams';
import { normalizeNotificationDisplay } from '../../../lib/userFacingText';
import { PageState } from '../../../ui/PageState';
import { MissingParamCard } from '../../../ui/StateCards';
import { PageHeader, Spacer, Surface } from '../../../ui/layout';

type NotificationItem = components['schemas']['Notification'];

const NOTIFICATION_CACHE_SCOPE = 'notification-detail';
const TEXT = {
  title: '\u901a\u77e5\u8be6\u60c5',
  subtitle: '\u7cfb\u7edf\u4e0e\u5ba2\u670d\u6d88\u606f',
  missing: '\u901a\u77e5\u4e0d\u5b58\u5728',
  loadFailed: '\u52a0\u8f7d\u5931\u8d25',
  emptyTitle: '\u672a\u627e\u5230\u5bf9\u5e94\u901a\u77e5',
  emptyMessage: '\u901a\u77e5\u53ef\u80fd\u5df2\u88ab\u6e05\u7406\u6216\u4e0d\u5b58\u5728\u3002',
  emptyAction: '\u8fd4\u56de',
  systemTag: '\u7cfb\u7edf\u901a\u77e5',
  csTag: '\u5ba2\u670d\u901a\u77e5',
  sourcePrefix: '\u6765\u6e90\uff1a',
  noSummary: '\u6682\u65e0\u8be6\u60c5',
} as const;

export default function NotificationDetailPage() {
  const id = useRouteStringParam('id');
  const loadedOnceRef = useRef(false);
  const notificationIdRef = useRef(id);
  const initialCachedItem = id ? getDetailCache<NotificationItem>(NOTIFICATION_CACHE_SCOPE, id) : null;
  const [loading, setLoading] = useState(!initialCachedItem);
  const [error, setError] = useState<string | null>(null);
  const [item, setItem] = useState<NotificationItem | null>(initialCachedItem);

  const load = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = Boolean(options?.silent);
      const targetId = id;
      if (!targetId) {
        if (!silent) {
          setError(TEXT.missing);
          setItem(null);
          setLoading(false);
        }
        return;
      }

      const cached = silent ? null : getDetailCache<NotificationItem>(NOTIFICATION_CACHE_SCOPE, targetId);
      if (cached) {
        setItem(cached);
        setLoading(false);
        setError(null);
      } else if (!silent) {
        setLoading(true);
        setError(null);
      }

      try {
        const data = await apiGet<NotificationItem>(`/notifications/${targetId}`);
        if (notificationIdRef.current !== targetId) return;
        setItem(data);
        setDetailCache(NOTIFICATION_CACHE_SCOPE, targetId, data);
        if (!silent) setError(null);
      } catch (e: any) {
        if (notificationIdRef.current !== targetId) return;
        if (!silent && !cached) {
          setError(e?.message || TEXT.loadFailed);
          setItem(null);
        }
      } finally {
        if (!silent && notificationIdRef.current === targetId) setLoading(false);
      }
    },
    [id],
  );

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
    notificationIdRef.current = id;
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
        <PageHeader weapp back title={TEXT.title} subtitle={TEXT.subtitle} />
        <Spacer />
        <MissingParamCard onAction={() => void safeNavigateBack()} />
      </View>
    );
  }

  const showInitialLoading = loading && !item;
  const display = item ? normalizeNotificationDisplay(item) : null;
  const titleText = normalizeDisplayText(display?.title) || normalizeDisplayText(item?.title) || TEXT.title;
  const sourceText = displayInfoOrPlaceholder(display?.source || item?.source, '平台通知');
  const summaryText = displayInfoOrPlaceholder(display?.summary || item?.summary, TEXT.noSummary);

  return (
    <View className="container notification-detail-page">
      <PageHeader weapp back title={TEXT.title} subtitle={TEXT.subtitle} />
      <Spacer />

      <PageState
        access={access}
        loading={showInitialLoading}
        error={error}
        empty={!showInitialLoading && !error && !item}
        emptyTitle={TEXT.emptyTitle}
        emptyMessage={TEXT.emptyMessage}
        emptyActionText={TEXT.emptyAction}
        onEmptyAction={() => void safeNavigateBack()}
        onRetry={() => {
          void load();
        }}
      >
        {item ? (
          <Surface className="notification-detail-card" padding="none">
            <View className="notification-detail-header">
              <View className={`notification-detail-tag ${item.kind === 'system' ? 'is-system' : 'is-cs'}`}>
                <Text>{item.kind === 'system' ? TEXT.systemTag : TEXT.csTag}</Text>
              </View>
              <Text className="notification-detail-time">{formatTimeSmart(item.time)}</Text>
            </View>
            <Text className="notification-detail-title">{titleText}</Text>
            <Text className="notification-detail-source">{TEXT.sourcePrefix}{sourceText}</Text>
            <View className="notification-detail-content">
              <Text className="notification-detail-paragraph">{summaryText}</Text>
            </View>
          </Surface>
        ) : null}
      </PageState>
    </View>
  );
}
