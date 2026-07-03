import { View, Text, Button as TaroButton } from '@tarojs/components';
import Taro, { useShareAppMessage } from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './index.scss';

import type { components } from '@ipmoney/api-types';

import { apiGet } from '../../../lib/api';
import { getDetailCache, setDetailCache } from '../../../lib/detailCache';
import { displayInfoOrPlaceholder, displayInitial, displayTitleOrFallback, normalizeDisplayText } from '../../../lib/displayText';
import { verificationTypeLabel } from '../../../lib/labels';
import { safeNavigateBack } from '../../../lib/navigation';
import { regionDisplayName } from '../../../lib/regions';
import { useRouteUuidParam } from '../../../lib/routeParams';
import { PageHeader, Spacer, Surface, TipBanner } from '../../../ui/layout';
import { Avatar } from '../../../ui/nutui';
import { Heart, Share2 } from '../../../ui/icons';
import { EmptyCard, ErrorCard, LoadingCard, MissingParamCard } from '../../../ui/StateCards';

type OrganizationSummary = components['schemas']['OrganizationSummary'];

function resolveAvatarFallbackText(value: unknown, fallback: string): string {
  return displayInitial(value, fallback);
}

export default function OrganizationDetailPage() {
  const orgUserId = useRouteUuidParam('orgUserId') || '';
  const orgUserIdRef = useRef(orgUserId);

  const initialCachedData = orgUserId ? getDetailCache<OrganizationSummary>('organization-summary', orgUserId) : null;
  const [loading, setLoading] = useState(!initialCachedData);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<OrganizationSummary | null>(initialCachedData);
  const [activeTab, setActiveTab] = useState('org-overview');

  useEffect(() => {
    orgUserIdRef.current = orgUserId;
    if (!orgUserId) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }
    const cached = getDetailCache<OrganizationSummary>('organization-summary', orgUserId);
    setData(cached || null);
    setLoading(!cached);
    setError(null);
  }, [orgUserId]);

  const load = useCallback(async () => {
    const targetOrgUserId = orgUserId;
    if (!targetOrgUserId) return;
    const cached = getDetailCache<OrganizationSummary>('organization-summary', targetOrgUserId);
    if (cached) {
      setData(cached);
      setLoading(false);
      setError(null);
    } else {
      setLoading(true);
      setError(null);
    }
    try {
      const next = await apiGet<OrganizationSummary>(`/public/organizations/${targetOrgUserId}`);
      if (orgUserIdRef.current !== targetOrgUserId) return;
      setData(next);
      setDetailCache('organization-summary', targetOrgUserId, next);
    } catch (e: any) {
      if (orgUserIdRef.current !== targetOrgUserId) return;
      if (!cached) {
        setError(e?.message || '加载失败');
        setData(null);
      }
    } finally {
      if (orgUserIdRef.current === targetOrgUserId) setLoading(false);
    }
  }, [orgUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  useShareAppMessage(() => ({
    title: displayTitleOrFallback(data?.displayName, '服务资源详情'),
    path: orgUserId ? `/subpackages/organizations/detail/index?orgUserId=${orgUserId}` : '/pages/home/index',
    imageUrl: data?.logoUrl || undefined,
  }));

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

  const logo = useMemo(() => {
    if (!data?.logoUrl) return '';
    return data.logoUrl.includes('example.com') ? '' : data.logoUrl;
  }, [data?.logoUrl]);

  const displayName = normalizeDisplayText(data?.displayName);
  const regionText = normalizeDisplayText(regionDisplayName(data?.regionCode));
  const titleText = displayTitleOrFallback(data?.displayName, '认证服务资源');
  const introText = displayInfoOrPlaceholder(data?.intro, displayName ? `${displayName}暂未公开简介` : '服务资源暂未公开简介');

  if (!orgUserId) {
    return (
      <View className="container">
        <MissingParamCard onAction={() => void safeNavigateBack()} />
      </View>
    );
  }

  return (
    <View className="container detail-page-compact">
      <PageHeader weapp title="服务资源详情" brand={false} />
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
                {resolveAvatarFallbackText(displayName, '构')}
              </Avatar>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text className="detail-compact-title clamp-2">{titleText}</Text>
                <Spacer size={8} />
                <View className="detail-compact-tags">
                  <Text className="detail-compact-tag detail-compact-tag-strong">
                    {verificationTypeLabel(data.verificationType)}
                  </Text>
                  {regionText ? <Text className="detail-compact-tag">地区：{regionText}</Text> : null}
                  <Text className="detail-compact-tag">展示：{data.stats?.listingCount ?? 0}</Text>
                  <Text className="detail-compact-tag">专利：{data.stats?.patentCount ?? 0}</Text>
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
                <Text className="detail-field-label">资源简介</Text>
                <Text className="detail-field-value break-word">{introText}</Text>
              </View>
            </View>
          </View>

          <Spacer size={12} />

          <TipBanner id="org-note" tone="info" title="说明">
            资料由账号主体提交，并经平台审核后对外展示。
          </TipBanner>

          <Spacer size={12} />

          <View className="detail-bottom-tools">
            <View className="detail-tool-row">
              <TaroButton className="detail-tool" openType="share" hoverClass="none">
                <View className="detail-tool-icon">
                  <Share2 size={16} />
                </View>
                <Text>分享</Text>
              </TaroButton>
              <View className="detail-tool is-disabled">
                <View className="detail-tool-icon">
                  <Heart size={16} />
                </View>
                <Text>收藏</Text>
              </View>
            </View>
          </View>
        </View>
      ) : (
        <EmptyCard message="暂无数据" actionText="返回" onAction={() => void safeNavigateBack()} />
      )}
    </View>
  );
}
