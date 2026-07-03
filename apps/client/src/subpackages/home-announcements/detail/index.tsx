import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './index.scss';

import type { PublicHomeAnnouncementItem } from '../../../lib/homeAnnouncements';

import { displayInfoOrPlaceholder, displayTitleOrFallback } from '../../../lib/displayText';
import { formatTimeSmart } from '../../../lib/format';
import { usePageAccess } from '../../../lib/guard';
import { fetchHomeAnnouncements } from '../../../lib/homeAnnouncements';
import { isTabPageUrl, normalizePageUrl } from '../../../lib/navigation';
import { useRouteStringParam } from '../../../lib/routeParams';
import { PageState } from '../../../ui/PageState';
import { PageHeader, Spacer, Surface } from '../../../ui/layout';
import { toast } from '../../../ui/nutui';

export default function HomeAnnouncementDetailPage() {
  const access = usePageAccess('public');
  const id = useRouteStringParam('id');
  const [item, setItem] = useState<PublicHomeAnnouncementItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const idRef = useRef(id);

  useEffect(() => {
    idRef.current = id;
    setItem(null);
    setLoading(Boolean(id));
    setError(null);
  }, [id]);

  const loadDetail = useCallback(async () => {
    const currentId = id;
    idRef.current = currentId;
    if (!currentId) {
      setError('公告不存在');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const items = await fetchHomeAnnouncements({ max: 50 });
      if (idRef.current !== currentId) return;
      const found = items.find((entry) => entry.id === currentId) || null;
      if (!found) {
        setError('公告不存在');
        setItem(null);
      } else {
        setItem(found);
      }
    } catch (err: any) {
      if (idRef.current !== currentId) return;
      setError(err?.message || '加载失败');
      setItem(null);
    } finally {
      if (idRef.current !== currentId) return;
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const timeText = useMemo(() => {
    if (!item?.publishedAt) return '';
    return formatTimeSmart(item.publishedAt);
  }, [item?.publishedAt]);
  const titleText = displayTitleOrFallback(item?.title, '公告标题待确认');
  const contentText = displayInfoOrPlaceholder(item?.content, '暂未更新');

  const openLink = useCallback(async () => {
    if (!item?.linkUrl) return;
    const target = normalizePageUrl(item.linkUrl);
    if (!target) {
      toast('公告链接暂不可用');
      return;
    }
    try {
      if (isTabPageUrl(target)) {
        await Taro.switchTab({ url: target });
        return;
      }
      await Taro.navigateTo({ url: target });
    } catch {
      toast('公告链接暂不可用');
    }
  }, [item?.linkUrl]);

  const showEmpty = !loading && !error && !item;

  return (
    <View className="container home-announcement-detail-page">
      <PageHeader weapp back title="公告详情" />
      <Spacer />

      <PageState
        access={access}
        loading={loading}
        error={error}
        empty={showEmpty}
        emptyTitle="未找到公告"
        emptyMessage="公告可能已不可见或不存在。"
        onRetry={() => void loadDetail()}
      >
        {item ? (
          <Surface className="home-announcement-detail-card" padding="none">
            <View className="home-announcement-detail-body">
              <Text className="home-announcement-detail-title">{titleText}</Text>
              {timeText ? <Text className="home-announcement-detail-time">{timeText}</Text> : null}
              <Text className="home-announcement-detail-content">{contentText}</Text>
              {item.linkUrl ? (
                <Text className="home-announcement-detail-link" onClick={openLink}>
                  查看详情
                </Text>
              ) : null}
            </View>
          </Surface>
        ) : null}
      </PageState>
    </View>
  );
}
