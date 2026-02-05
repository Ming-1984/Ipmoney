import { View, Text, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './index.scss';

import type { components } from '@ipmoney/api-types';

import { apiGet } from '../../lib/api';
import { regionDisplayName } from '../../lib/regions';
import { SearchEntry } from '../../ui/SearchEntry';
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PagedTechManagerSummary | null>(null);

  const [orgQInput, setOrgQInput] = useState('');
  const [orgQ, setOrgQ] = useState('');
  const [orgLoading, setOrgLoading] = useState(true);
  const [orgError, setOrgError] = useState<string | null>(null);
  const [orgData, setOrgData] = useState<PagedOrganizationSummary | null>(null);

  const loadTech = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await apiGet<PagedTechManagerSummary>('/search/tech-managers', {
        q: techQ || undefined,
        page: 1,
        pageSize: 20,
      });
      setData(d);
    } catch (e: any) {
      setError(e?.message || '加载失败');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [techQ]);

  const loadOrg = useCallback(async () => {
    setOrgLoading(true);
    setOrgError(null);
    try {
      const d = await apiGet<PagedOrganizationSummary>('/public/organizations', {
        q: orgQ || undefined,
        page: 1,
        pageSize: 20,
      });
      setOrgData(d);
    } catch (e: any) {
      setOrgError(e?.message || '加载失败');
      setOrgData(null);
    } finally {
      setOrgLoading(false);
    }
  }, [orgQ]);

  useEffect(() => {
    if (activeTab !== 'TECH') return;
    void loadTech();
  }, [activeTab, loadTech]);

  useEffect(() => {
    if (activeTab !== 'ORG') return;
    void loadOrg();
  }, [activeTab, loadOrg]);

  const techItems = useMemo(() => data?.items || [], [data?.items]);
  const orgItems = useMemo(
    () => (orgData?.items || []).filter((x) => x.verificationStatus === 'APPROVED'),
    [orgData?.items],
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

          {loading ? (
            <LoadingCard />
          ) : error ? (
            <ErrorCard message={error} onRetry={loadTech} />
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
                      Taro.navigateTo({ url: `/pages/tech-managers/detail/index?techManagerId=${it.userId}` });
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
            <EmptyCard message="暂无专家" actionText="刷新" onAction={loadTech} />
          )}
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

          {orgLoading ? (
            <LoadingCard />
          ) : orgError ? (
            <ErrorCard message={orgError} onRetry={loadOrg} />
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
                      Taro.navigateTo({ url: `/pages/organizations/detail/index?orgUserId=${it.userId}` });
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
            <EmptyCard message="暂无机构" actionText="刷新" onAction={loadOrg} />
          )}
        </>
      )}
    </View>
  );
}
