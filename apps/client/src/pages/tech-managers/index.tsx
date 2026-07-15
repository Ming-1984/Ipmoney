import { View, Text, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './index.scss';

import type { components } from '@ipmoney/api-types';

import { STORAGE_KEYS } from '../../constants';
import { apiGet } from '../../lib/api';
import { displayInitial, displayTitleOrFallback, normalizeDisplayText } from '../../lib/displayText';
import { regionDisplayName } from '../../lib/regions';
import {
  resolveTechManagerBadges,
  resolveTechManagerDisplayName,
  resolveTechManagerExperienceLabel,
} from '../../lib/techManagerDisplay';
import { usePagedList } from '../../lib/usePagedList';
import { ListFooter } from '../../ui/ListFooter';
import { SearchEntry } from '../../ui/SearchEntry';
import { PullToRefresh, toast } from '../../ui/nutui';
import { EmptyCard, ErrorCard, LoadingCard } from '../../ui/StateCards';

type ConsultTab = 'TECH' | 'ORG';

type PagedTechManagerSummary = components['schemas']['PagedTechManagerSummary'];
type TechManagerSummary = components['schemas']['TechManagerSummary'];

type OrganizationSummary = components['schemas']['OrganizationSummary'];
type PagedOrganizationSummary = components['schemas']['PagedOrganizationSummary'];

function resolveAvatarFallbackText(value: unknown, fallback: string): string {
  return displayInitial(value, fallback);
}

export default function TechManagersPage() {
  const [activeTab, setActiveTab] = useState<ConsultTab>('TECH');
  const techQueryKeyRef = useRef<string | null>(null);
  const orgQueryKeyRef = useRef<string | null>(null);
  const tabPrefetchScheduledRef = useRef(false);
  const techFilterKeyRef = useRef('');
  const orgFilterKeyRef = useRef('');
  const [techSearchSeq, setTechSearchSeq] = useState(0);
  const [orgSearchSeq, setOrgSearchSeq] = useState(0);

  const [techQInput, setTechQInput] = useState('');
  const [techQ, setTechQ] = useState('');

  const [orgQInput, setOrgQInput] = useState('');
  const [orgQ, setOrgQ] = useState('');
  const techFetcher = useCallback(
    async ({ page, pageSize }: { page: number; pageSize: number }) =>
      apiGet<PagedTechManagerSummary>('/search/tech-managers', {
        q: techQ || undefined,
        page,
        pageSize,
      }),
    [techQ],
  );

  const orgFetcher = useCallback(
    async ({ page, pageSize }: { page: number; pageSize: number }) =>
      apiGet<PagedOrganizationSummary>('/public/organizations', {
        q: orgQ || undefined,
        page,
        pageSize,
      }),
    [orgQ],
  );

  const techList = usePagedList<TechManagerSummary>(techFetcher, {
    pageSize: 20,
    onError: (message, ctx) => {
      if (ctx === 'loadMore') toast(message);
    },
  });

  const orgList = usePagedList<OrganizationSummary>(orgFetcher, {
    pageSize: 20,
    onError: (message, ctx) => {
      if (ctx === 'loadMore') toast(message);
    },
  });

  useEffect(() => {
    const nextKey = `${techQ.trim()}::${techSearchSeq}`;
    if (techFilterKeyRef.current === nextKey) return;
    techFilterKeyRef.current = nextKey;
    techList.reset();
  }, [techList.reset, techQ, techSearchSeq]);

  useEffect(() => {
    const nextKey = `${orgQ.trim()}::${orgSearchSeq}`;
    if (orgFilterKeyRef.current === nextKey) return;
    orgFilterKeyRef.current = nextKey;
    orgList.reset();
  }, [orgList.reset, orgQ, orgSearchSeq]);

  useEffect(() => {
    const intent = String(Taro.getStorageSync(STORAGE_KEYS.consultLandingTab) || '')
      .trim()
      .toUpperCase();
    if (intent === 'ORG') setActiveTab('ORG');
    if (intent === 'TECH') setActiveTab('TECH');
    if (intent) Taro.removeStorageSync(STORAGE_KEYS.consultLandingTab);
  }, []);

  useEffect(() => {
    if (activeTab !== 'TECH') return;
    const queryKey = `${techQ.trim()}::${techSearchSeq}`;
    if (techQueryKeyRef.current === queryKey) return;
    techQueryKeyRef.current = queryKey;
    void techList.reload();
  }, [activeTab, techQ, techList.reload, techSearchSeq]);

  useEffect(() => {
    if (activeTab !== 'ORG') return;
    const queryKey = `${orgQ.trim()}::${orgSearchSeq}`;
    if (orgQueryKeyRef.current === queryKey) return;
    orgQueryKeyRef.current = queryKey;
    void orgList.reload();
  }, [activeTab, orgList.reload, orgQ, orgSearchSeq]);

  useEffect(() => {
    if (tabPrefetchScheduledRef.current) return;
    tabPrefetchScheduledRef.current = true;
    // Warm up the inactive tab once so first manual switch is less likely to flash a blocking loader.
    const timer = setTimeout(() => {
      if (activeTab === 'TECH') {
        const queryKey = orgQ.trim();
        if (orgQueryKeyRef.current !== queryKey) {
          orgQueryKeyRef.current = queryKey;
          void orgList.reload();
        }
        return;
      }
      const queryKey = techQ.trim();
      if (techQueryKeyRef.current !== queryKey) {
        techQueryKeyRef.current = queryKey;
        void techList.reload();
      }
    }, 280);
    return () => clearTimeout(timer);
  }, [activeTab, orgList.reload, orgQ, techList.reload, techQ]);

  const techItems = useMemo(() => techList.items, [techList.items]);
  const orgItems = useMemo(() => orgList.items, [orgList.items]);
  const showTechInitialLoading = techList.loading && techItems.length === 0;
  const showOrgInitialLoading = orgList.loading && orgItems.length === 0;

  return (
    <View className="container consult-page">
      <View className="consult-tabs">
        {[
          { id: 'TECH', label: '技术经理人' },
          { id: 'ORG', label: '服务资源' },
        ].map((tab) => (
          <View
            key={tab.id}
            className={`consult-tab ${activeTab === tab.id ? 'is-active' : ''}`}
            onClick={() => setActiveTab(tab.id as ConsultTab)}
          >
            <Text>{tab.label}</Text>
            {activeTab === tab.id ? <View className="consult-tab-underline" /> : null}
          </View>
        ))}
      </View>

      {activeTab === 'TECH' ? (
        <>
          <View className="consult-search">
            <SearchEntry
              value={techQInput}
              placeholder="搜索专家姓名、领域或单位"
              actionText="查询"
              onChange={(value) => {
                setTechQInput(value);
                if (!value) setTechQ('');
              }}
              onSearch={(value) => {
                setTechQ((value || '').trim());
                setTechSearchSeq((prev) => prev + 1);
              }}
            />
          </View>

          <PullToRefresh type="primary" disabled={showTechInitialLoading || techList.refreshing} onRefresh={techList.refresh}>
            {showTechInitialLoading ? (
              <LoadingCard />
            ) : techList.error ? (
              <ErrorCard message={techList.error} onRetry={techList.reload} />
            ) : techItems.length ? (
              <View className="consult-list">
                {techItems.map((it: TechManagerSummary) => {
                  const avatar = it.avatarUrl && !it.avatarUrl.includes('example.com') ? it.avatarUrl : '';
                  const displayName = resolveTechManagerDisplayName(it);
                  const experienceLabel = resolveTechManagerExperienceLabel(it);
                  const badges = resolveTechManagerBadges(it, { limit: 2 });
                  const introText = normalizeDisplayText(it.intro);
                  return (
                    <View
                      key={it.userId}
                      className="consult-card"
                      onClick={() => {
                        Taro.navigateTo({ url: `/subpackages/tech-managers/detail/index?techManagerId=${it.userId}` });
                      }}
                    >
                      <View className="consult-card-main">
                        <View className="consult-avatar">
                          {avatar ? (
                            <Image src={avatar} mode="aspectFill" className="consult-avatar-img" />
                          ) : (
                            <Text className="consult-avatar-text">{resolveAvatarFallbackText(displayName, '专')}</Text>
                          )}
                        </View>
                        <View className="consult-info">
                          <View className="consult-name-row">
                            <Text className="consult-name">{displayName}</Text>
                          </View>
                          <View className="consult-meta-row">
                            {experienceLabel ? <Text className="consult-meta">{experienceLabel}</Text> : null}
                          </View>
                          {badges.length ? (
                            <View className="consult-badge-row">
                              {badges.map((badge) => (
                                <Text
                                  key={badge.code}
                                  className={[
                                    'consult-badge',
                                    badge.category === 'STATUS' ? 'is-status' : 'is-honor',
                                  ]
                                    .filter(Boolean)
                                    .join(' ')}
                                >
                                  {badge.name}
                                </Text>
                              ))}
                            </View>
                          ) : null}
                          {introText ? <Text className="consult-intro clamp-1">{introText}</Text> : null}
                        </View>
                      </View>
                      <View className="consult-action">咨询</View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <EmptyCard message="暂无专家" actionText="刷新" onAction={techList.reload} />
            )}

            {!showTechInitialLoading && techItems.length ? (
              <ListFooter loadingMore={techList.loadingMore} hasMore={techList.hasMore} onLoadMore={techList.loadMore} showNoMore />
            ) : null}
          </PullToRefresh>
        </>
      ) : (
        <>
          <View className="consult-search">
            <SearchEntry
              value={orgQInput}
              placeholder="搜索服务资源名称/关键词"
              actionText="查询"
              onChange={(value) => {
                setOrgQInput(value);
                if (!value) setOrgQ('');
              }}
              onSearch={(value) => {
                setOrgQ((value || '').trim());
                setOrgSearchSeq((prev) => prev + 1);
              }}
            />
          </View>

          <PullToRefresh type="primary" disabled={showOrgInitialLoading || orgList.refreshing} onRefresh={orgList.refresh}>
            {showOrgInitialLoading ? (
              <LoadingCard />
            ) : orgList.error ? (
              <ErrorCard message={orgList.error} onRetry={orgList.reload} />
            ) : orgItems.length ? (
              <View className="consult-list">
                {orgItems.map((it: OrganizationSummary) => {
                  const logo = it.logoUrl && !it.logoUrl.includes('example.com') ? it.logoUrl : '';
                  const displayName = displayTitleOrFallback(it.displayName, '认证服务资源');
                  const location = it.regionCode ? regionDisplayName(it.regionCode) : '';
                  const introText = normalizeDisplayText(it.intro);
                  return (
                    <View
                      key={it.userId}
                      className="consult-card"
                      onClick={() => {
                        Taro.navigateTo({ url: `/subpackages/organizations/detail/index?orgUserId=${it.userId}` });
                      }}
                    >
                      <View className="consult-card-main">
                        <View className="consult-avatar">
                          {logo ? (
                            <Image src={logo} mode="aspectFill" className="consult-avatar-img" />
                          ) : (
                            <Text className="consult-avatar-text">{resolveAvatarFallbackText(displayName, '机')}</Text>
                          )}
                        </View>
                        <View className="consult-info">
                          <View className="consult-name-row">
                            <Text className="consult-name">{displayName}</Text>
                          </View>
                          <View className="consult-meta-row">
                            {location ? <Text className="consult-meta">{location}</Text> : null}
                          </View>
                          {introText ? <Text className="consult-intro clamp-1">{introText}</Text> : null}
                        </View>
                      </View>
                      <View className="consult-action">咨询</View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <EmptyCard message="暂无服务资源" actionText="刷新" onAction={orgList.reload} />
            )}

            {!showOrgInitialLoading && orgItems.length ? (
              <ListFooter loadingMore={orgList.loadingMore} hasMore={orgList.hasMore} onLoadMore={orgList.loadMore} showNoMore />
            ) : null}
          </PullToRefresh>
        </>
      )}
    </View>
  );
}
