import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useState } from 'react';

import type { components } from '@ipmoney/api-types';

import { apiGet, apiPost } from '../../../lib/api';
import { ensureApproved } from '../../../lib/guard';
import { verificationTypeLabel } from '../../../lib/labels';
import { safeNavigateBack } from '../../../lib/navigation';
import { regionDisplayName } from '../../../lib/regions';
import { useRouteUuidParam } from '../../../lib/routeParams';
import { PageHeader, SectionHeader, Spacer, StickyBar, Surface, TipBanner } from '../../../ui/layout';
import { Avatar, Button, Space, Tag, toast } from '../../../ui/nutui';
import { EmptyCard, ErrorCard, LoadingCard, MissingParamCard } from '../../../ui/StateCards';

type TechManagerPublic = components['schemas']['TechManagerPublic'];
type Conversation = { id: string };

export default function TechManagerDetailPage() {
  const techManagerId = useRouteUuidParam('techManagerId') || '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TechManagerPublic | null>(null);

  const load = useCallback(async () => {
    if (!techManagerId) return;
    setLoading(true);
    setError(null);
    try {
      const d = await apiGet<TechManagerPublic>(`/public/tech-managers/${techManagerId}`);
      setData(d);
    } catch (e: any) {
      setError(e?.message || '加载失败');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [techManagerId]);

  useEffect(() => {
    void load();
  }, [load]);

  const startConsult = useCallback(async () => {
    if (!ensureApproved()) return;
    try {
      const conv = await apiPost<Conversation>(
        `/tech-managers/${techManagerId}/conversations`,
        {},
        { idempotencyKey: `conv-tech-${techManagerId}` },
      );
      Taro.navigateTo({ url: `/pages/messages/chat/index?conversationId=${conv.id}` });
    } catch (e: any) {
      toast(e?.message || '进入咨询失败');
    }
  }, [techManagerId]);

  if (!techManagerId) {
    return (
      <View className="container">
        <MissingParamCard onAction={() => void safeNavigateBack()} />
      </View>
    );
  }

  return (
    <View className="container has-sticky">
      <PageHeader title="技术经理人详情" subtitle="可在线咨询对接，交易过程全程留痕" />
      <Spacer />

      {loading ? (
        <LoadingCard />
      ) : error ? (
        <ErrorCard message={error} onRetry={load} />
      ) : data ? (
        <View>
          <Surface>
            <View className="row" style={{ gap: '14rpx', alignItems: 'center' }}>
              <Avatar size="56" src={data.avatarUrl || ''} background="var(--c-soft)" color="var(--c-primary)">
                {(data.displayName || 'T').slice(0, 1)}
              </Avatar>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text className="text-title clamp-2">{data.displayName || '-'}</Text>
                <Spacer size={8} />
                <Space wrap align="center">
                  <Tag type="primary" plain round>
                    {verificationTypeLabel(data.verificationType)}
                  </Tag>
                  <Tag type="default" plain round>
                    地区：{regionDisplayName(data.regionCode)}
                  </Tag>
                  <Tag type="default" plain round>
                    咨询 {data.stats?.consultCount ?? 0}
                  </Tag>
                  <Tag type="default" plain round>
                    成交 {data.stats?.dealCount ?? 0}
                  </Tag>
                  <Tag type="default" plain round>
                    评分 {data.stats?.ratingScore ?? '-'}
                  </Tag>
                </Space>
              </View>
            </View>
          </Surface>

          <Spacer size={12} />

          <Surface>
            <SectionHeader title="擅长领域" density="compact" />
            {data.serviceTags?.length ? (
              <View className="row" style={{ gap: '10rpx', flexWrap: 'wrap' }}>
                {data.serviceTags.map((t) => (
                  <Text key={t} className="tag">
                    {t}
                  </Text>
                ))}
              </View>
            ) : (
              <Text className="muted">暂无标签</Text>
            )}
          </Surface>

          <Spacer size={12} />

          <Surface>
            <SectionHeader title="简介" density="compact" />
            <Text className="muted break-word">{data.intro || '暂无简介'}</Text>
          </Surface>

          <Spacer size={12} />

          <TipBanner tone="info" title="说明">
            技术经理人信息由本人提交并经平台审核后展示；如需修改或下架，请联系平台客服。
          </TipBanner>
        </View>
      ) : (
        <EmptyCard message="暂无数据" actionText="返回" onAction={() => void safeNavigateBack()} />
      )}

      {data ? (
        <StickyBar>
          <View className="flex-1">
            <Button variant="ghost" onClick={() => Taro.navigateBack()}>
              返回
            </Button>
          </View>
          <View className="flex-1">
            <Button
              variant="primary"
              onClick={() => {
                void startConsult();
              }}
            >
              咨询
            </Button>
          </View>
        </StickyBar>
      ) : null}
    </View>
  );
}
