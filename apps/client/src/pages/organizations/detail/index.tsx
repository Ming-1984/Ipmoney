import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './index.scss';

import type { components } from '@ipmoney/api-types';

import { Heart, Share2 } from '@nutui/icons-react-taro';
import { apiGet } from '../../../lib/api';
import { verificationTypeLabel } from '../../../lib/labels';
import { safeNavigateBack } from '../../../lib/navigation';
import { regionDisplayName } from '../../../lib/regions';
import { useRouteUuidParam } from '../../../lib/routeParams';
import { PageHeader, Spacer, Surface, TipBanner } from '../../../ui/layout';
import { Avatar } from '../../../ui/nutui';
import { EmptyCard, ErrorCard, LoadingCard, MissingParamCard } from '../../../ui/StateCards';

type OrganizationSummary = components['schemas']['OrganizationSummary'];

export default function OrganizationDetailPage() {
  const orgUserId = useRouteUuidParam('orgUserId') || '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<OrganizationSummary | null>(null);
  const [activeTab, setActiveTab] = useState('org-overview');

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

  const tabs = useMemo(
    () => [
      { id: 'org-overview', label: '概览' },
      { id: 'org-intro', label: '简介' },
      { id: 'org-note', label: '说明' },
    ],
    [],
  );

  const scrollToTab = useCallback((id: string) => {
    setActiveTab(id);
    Taro.pageScrollTo({ selector: `#${id}`, duration: 300 });
  }, []);

  if (!orgUserId) {
    return (
      <View className="container">
        <MissingParamCard onAction={() => void safeNavigateBack()} />
      </View>
    );
  }

  const logo = useMemo(() => {
    if (!data?.logoUrl) return '';
    return data.logoUrl.includes('example.com') ? '' : data.logoUrl;
  }, [data?.logoUrl]);

  return (
    <View className="container detail-page-compact">
      <PageHeader weapp title="机构详情" subtitle="展示已审核通过的机构主体信息" brand={false} />
      <Spacer />

      {loading ? (
        <LoadingCard />
      ) : error ? (
        <ErrorCard message={error} onRetry={load} />
      ) : data ? (
        <View>
          <Surface className="detail-compact-header" id="org-overview">
            <View className="detail-compact-row">
              <Avatar size="48" src={logo} background="rgba(15, 23, 42, 0.06)" color="var(--c-muted)">
                {(data.displayName || '-').slice(0, 1)}
              </Avatar>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text className="detail-compact-title clamp-2">{data.displayName || '-'}</Text>
                <Spacer size={8} />
                <View className="detail-compact-tags">
                  <Text className="detail-compact-tag detail-compact-tag-strong">
                    {verificationTypeLabel(data.verificationType)}
                  </Text>
                  <Text className="detail-compact-tag">地区：{regionDisplayName(data.regionCode)}</Text>
                  <Text className="detail-compact-tag">上架 {data.stats?.listingCount ?? 0}</Text>
                  <Text className="detail-compact-tag">专利 {data.stats?.patentCount ?? 0}</Text>
                </View>
              </View>
            </View>
          </Surface>

          <View className="detail-tabs">
            <View className="detail-tabs-scroll">
              {tabs.map((tab) => (
                <Text
                  key={tab.id}
                  className={`detail-tab ${activeTab === tab.id ? 'is-active' : ''}`}
                  onClick={() => scrollToTab(tab.id)}
                >
                  {tab.label}
                </Text>
              ))}
            </View>
          </View>

          <Spacer size={12} />

          <View id="org-intro" className="detail-section-card">
            <View className="detail-field-list">
              <View className="detail-field-row">
                <Text className="detail-field-label">简介</Text>
                <Text className="detail-field-value break-word">{data.intro || '暂无简介'}</Text>
              </View>
            </View>
          </View>

          <Spacer size={12} />

          <TipBanner id="org-note" tone="info" title="说明">
            机构信息由主体提交并经平台审核后展示；如需下架/纠错，请联系平台客服。
          </TipBanner>

          <Spacer size={12} />
          <View className="detail-bottom-tools">
            <View className="detail-tool-row">
              <View
                className="detail-tool"
                onClick={() => {
                  Taro.showToast({ title: '分享功能开发中', icon: 'none' });
                }}
              >
                <View className="detail-tool-icon">
                  <Share2 size={16} />
                </View>
                <Text>分享</Text>
              </View>
              <View
                className="detail-tool is-disabled"
                onClick={() => {
                  Taro.showToast({ title: '收藏功能暂未开放', icon: 'none' });
                }}
              >
                <View className="detail-tool-icon">
                  <Heart size={16} />
                </View>
                <Text>收藏</Text>
              </View>
            </View>
          </View>
        </View>
      ) : (
        <EmptyCard message="无数据" actionText="返回" onAction={() => void safeNavigateBack()} />
      )}
    </View>
  );
}


