import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './index.scss';

import { apiGet } from '../../../lib/api';
import { formatTimeSmart } from '../../../lib/format';
import { useRouteUuidParam } from '../../../lib/routeParams';
import { PageHeader, Spacer, Surface } from '../../../ui/layout';
import { EmptyCard, ErrorCard, LoadingCard, MissingParamCard } from '../../../ui/StateCards';
import { Button, toast } from '../../../ui/nutui';

type AnnouncementDetail = {
  id: string;
  title: string;
  publisherName?: string;
  publishedAt?: string;
  issueNo?: string;
  tags?: string[];
  content?: string;
  sourceUrl?: string;
  relatedPatents?: { name: string; patentNo: string }[];
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

export default function AnnouncementDetailPage() {
  const announcementId = useRouteUuidParam('announcementId');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AnnouncementDetail | null>(null);

  const load = useCallback(async () => {
    if (!announcementId) return;
    setLoading(true);
    setError(null);
    try {
      const d = await apiGet<AnnouncementDetail>(`/public/announcements/${announcementId}`);
      setData(d);
    } catch (e: any) {
      setError(e?.message || '加载失败');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [announcementId]);

  useEffect(() => {
    void load();
  }, [load]);

  const contentLines = useMemo(() => {
    if (!data?.content) return [];
    return data.content.split('\n').filter(Boolean);
  }, [data?.content]);

  if (!announcementId) {
    return (
      <View className="container announcement-detail-page">
        <PageHeader weapp back title="公告详情" />
        <Spacer />
        <MissingParamCard
          message="缺少公告编号，请返回公告列表重新进入。"
          actionText="返回公告"
          onAction={() => Taro.navigateBack()}
        />
      </View>
    );
  }

  return (
    <View className="container announcement-detail-page">
      <PageHeader weapp back title="公告详情" subtitle="挂牌清单与公告信息" />
      <Spacer />

      {loading ? (
        <LoadingCard text="公告加载中" />
      ) : error ? (
        <ErrorCard message={error} onRetry={load} />
      ) : !data ? (
        <EmptyCard message="未找到公告详情" actionText="返回" onAction={() => Taro.navigateBack()} />
      ) : (
        <>
          <Surface className="announcement-detail-card" padding="none">
            <Text className="announcement-detail-title">{data.title}</Text>
            <View className="announcement-detail-meta">
              <Text>发布单位：{data.publisherName || '-'}</Text>
              <Text>发布日期：{formatDate(data.publishedAt)}</Text>
              {data.issueNo ? <Text>期次：{data.issueNo}</Text> : null}
            </View>
            {data.tags?.length ? (
              <View className="announcement-detail-tags">
                {data.tags.map((tag, idx) => (
                  <Text key={`${data.id}-tag-${idx}`} className="pill">
                    {tag}
                  </Text>
                ))}
              </View>
            ) : null}
            {contentLines.length ? (
              <View className="announcement-detail-content">
                {contentLines.map((line, idx) => (
                  <Text key={`${data.id}-line-${idx}`} className="announcement-detail-paragraph">
                    {line}
                  </Text>
                ))}
              </View>
            ) : (
              <Text className="announcement-detail-empty">暂无正文说明。</Text>
            )}

            {data.sourceUrl ? (
              <View className="announcement-detail-source">
                <Text className="announcement-detail-source-label">来源链接</Text>
                <Text className="announcement-detail-source-url">{data.sourceUrl}</Text>
                <Button
                  className="announcement-detail-source-btn"
                  size="small"
                  onClick={() => {
                    Taro.setClipboardData({ data: data.sourceUrl || '' });
                    toast('链接已复制');
                  }}
                >
                  复制链接
                </Button>
              </View>
            ) : null}
          </Surface>

          {data.relatedPatents?.length ? (
            <Surface className="announcement-detail-related" padding="none">
              <Text className="announcement-detail-related-title">关联专利</Text>
              <View className="announcement-detail-related-list">
                {data.relatedPatents.map((it, idx) => (
                  <View key={`${data.id}-patent-${idx}`} className="announcement-detail-related-item">
                    <Text className="announcement-detail-related-name">{it.name}</Text>
                    <Text className="announcement-detail-related-no">{it.patentNo}</Text>
                  </View>
                ))}
              </View>
            </Surface>
          ) : null}

          {data.publishedAt ? (
            <Text className="announcement-detail-time">更新时间：{formatTimeSmart(data.publishedAt)}</Text>
          ) : null}
        </>
      )}
    </View>
  );
}
