import { View, Text, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './index.scss';

import type { components } from '@ipmoney/api-types';

import { apiGet } from '../../lib/api';
import { regionDisplayName } from '../../lib/regions';
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

export default function TechManagersPage() {
  const [activeTab, setActiveTab] = useState<ConsultTab>('TECH');

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
    if (activeTab !== 'TECH') return;
    void techList.reload();
  }, [activeTab, techList.reload]);

  useEffect(() => {
    if (activeTab !== 'ORG') return;
    void orgList.reload();
  }, [activeTab, orgList.reload]);

  const techItems = useMemo(() => techList.items, [techList.items]);
  const orgItems = useMemo(
    () => orgList.items.filter((x) => x.verificationStatus === 'APPROVED'),
    [orgList.items],
  );

  return (
    <View className="container consult-page">
      <View className="consult-tabs">
        {[
          { id: 'TECH', label: '技术经理人' },
          { id: 'ORG', label: '机构' },
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
              placeholder="搜索专家姓名、领域或机构"
              actionText="查询"
              onChange={(value) => {
                setTechQInput(value);
                if (!value) setTechQ('');
              }}
              onSearch={(value) => {
                setTechQ((value || '').trim());
              }}
            />
          </View>

          <PullToRefresh type="primary" disabled={techList.loading || techList.refreshing} onRefresh={techList.refresh}>
            {techList.loading ? (
              <LoadingCard />
            ) : techList.error ? (
              <ErrorCard message={techList.error} onRetry={techList.reload} />
            ) : techItems.length ? (
              <View className="consult-list">
                {techItems.map((it: TechManagerSummary) => {
                  const avatar = it.avatarUrl && !it.avatarUrl.includes('example.com') ? it.avatarUrl : '';
                  const ratingScore = it.stats?.ratingScore;
                  const ratingText =
                    typeof ratingScore === 'number' && !Number.isNaN(ratingScore) ? ratingScore.toFixed(1) : '';
                  let experienceYears: number | null = null;
                  if (it.verifiedAt) {
                    const verifiedDate = new Date(it.verifiedAt);
                    if (!Number.isNaN(verifiedDate.getTime())) {
                      const diffYears = Math.floor((Date.now() - verifiedDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
                      experienceYears = Math.max(1, diffYears);
                    }
                  }
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
                            <Text className="consult-avatar-text">{(it.displayName || 'T').slice(0, 1)}</Text>
                          )}
                        </View>
                        <View className="consult-info">
                          <View className="consult-name-row">
                            <Text className="consult-name">{it.displayName || '-'}</Text>
                          </View>
                          <View className="consult-meta-row">
                            {experienceYears ? <Text className="consult-meta">从业 {experienceYears} 年</Text> : null}
                            {ratingText ? <Text className="consult-meta consult-rating">{ratingText}分</Text> : null}
                          </View>
                          {it.intro ? <Text className="consult-intro clamp-1">{it.intro}</Text> : null}
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

            {!techList.loading && techItems.length ? (
              <ListFooter loadingMore={techList.loadingMore} hasMore={techList.hasMore} onLoadMore={techList.loadMore} showNoMore />
            ) : null}
          </PullToRefresh>
        </>
      ) : (
        <>
          <View className="consult-search">
            <SearchEntry
              value={orgQInput}
              placeholder="搜索机构名称/关键词"
              actionText="查询"
              onChange={(value) => {
                setOrgQInput(value);
                if (!value) setOrgQ('');
              }}
              onSearch={(value) => {
                setOrgQ((value || '').trim());
              }}
            />
          </View>

          <PullToRefresh type="primary" disabled={orgList.loading || orgList.refreshing} onRefresh={orgList.refresh}>
            {orgList.loading ? (
              <LoadingCard />
            ) : orgList.error ? (
              <ErrorCard message={orgList.error} onRetry={orgList.reload} />
            ) : orgItems.length ? (
              <View className="consult-list">
                {orgItems.map((it: OrganizationSummary) => {
                  const logo = it.logoUrl && !it.logoUrl.includes('example.com') ? it.logoUrl : '';
                  const location = it.regionCode ? regionDisplayName(it.regionCode) : '';
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
                            <Text className="consult-avatar-text">{(it.displayName || '机').slice(0, 1)}</Text>
                          )}
                        </View>
                        <View className="consult-info">
                          <View className="consult-name-row">
                            <Text className="consult-name">{it.displayName || '-'}</Text>
                          </View>
                          <View className="consult-meta-row">
                            {location ? <Text className="consult-meta">{location}</Text> : null}
                          </View>
                          {it.intro ? <Text className="consult-intro clamp-1">{it.intro}</Text> : null}
                        </View>
                      </View>
                      <View className="consult-action">咨询</View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <EmptyCard message="暂无机构" actionText="刷新" onAction={orgList.reload} />
            )}

            {!orgList.loading && orgItems.length ? (
              <ListFooter loadingMore={orgList.loadingMore} hasMore={orgList.hasMore} onLoadMore={orgList.loadMore} showNoMore />
            ) : null}
          </PullToRefresh>
        </>
      )}
    </View>
  );
}
