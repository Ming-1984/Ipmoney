import { View, Text } from '@tarojs/components';
import React, { useCallback, useEffect, useState } from 'react';

import type { components } from '@ipmoney/api-types';

import { apiGet } from '../../../lib/api';
import { verificationTypeLabel } from '../../../lib/labels';
import { safeNavigateBack } from '../../../lib/navigation';
import { regionDisplayName } from '../../../lib/regions';
import { useRouteUuidParam } from '../../../lib/routeParams';
import { PageHeader, SectionHeader, Spacer, Surface, TipBanner } from '../../../ui/layout';
import { Avatar, Space, Tag } from '../../../ui/nutui';
import { EmptyCard, ErrorCard, LoadingCard, MissingParamCard } from '../../../ui/StateCards';

type OrganizationSummary = components['schemas']['OrganizationSummary'];

export default function OrganizationDetailPage() {
  const orgUserId = useRouteUuidParam('orgUserId') || '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<OrganizationSummary | null>(null);

  const load = useCallback(async () => {
    if (!orgUserId) return;
    setLoading(true);
    setError(null);
    try {
      const d = await apiGet<OrganizationSummary>(`/public/organizations/${orgUserId}`);
      setData(d);
    } catch (e: any) {
      setError(e?.message || '加载失败');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [orgUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!orgUserId) {
    return (
      <View className="container">
        <MissingParamCard onAction={() => void safeNavigateBack()} />
      </View>
    );
  }

  return (
    <View className="container">
      <PageHeader title="机构详情" subtitle="展示已审核通过的机构主体信息" brand={false} />
      <Spacer />

      {loading ? (
        <LoadingCard />
      ) : error ? (
        <ErrorCard message={error} onRetry={load} />
      ) : data ? (
        <View>
          <Surface>
            <View className="row" style={{ gap: '14rpx', alignItems: 'center' }}>
              <Avatar size="48" src={data.logoUrl || ''} background="rgba(15, 23, 42, 0.06)" color="var(--c-muted)">
                {data.displayName.slice(0, 1)}
              </Avatar>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text className="text-title clamp-2">{data.displayName}</Text>
                <Spacer size={8} />
                <Space wrap align="center">
                  <Tag type="primary" plain round>
                    {verificationTypeLabel(data.verificationType)}
                  </Tag>
                  <Tag type="default" plain round>
                    地区：{regionDisplayName(data.regionCode)}
                  </Tag>
                  <Tag type="default" plain round>
                    上架 {data.stats?.listingCount ?? 0}
                  </Tag>
                  <Tag type="default" plain round>
                    专利 {data.stats?.patentCount ?? 0}
                  </Tag>
                </Space>
              </View>
            </View>
          </Surface>

          <Spacer size={12} />

          <Surface>
            <SectionHeader title="简介" density="compact" />
            <Text className="muted break-word">{data.intro || '暂无简介'}</Text>
          </Surface>

          <Spacer size={12} />

          <TipBanner tone="info" title="说明">
            机构信息由主体提交并经平台审核后展示；如需下架/纠错，请联系平台客服。
          </TipBanner>
        </View>
      ) : (
        <EmptyCard message="无数据" actionText="返回" onAction={() => void safeNavigateBack()} />
      )}
    </View>
  );
}
