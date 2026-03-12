import { View, Text, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useState } from 'react';
import './index.scss';

import { STORAGE_KEYS } from '../../constants';
import { apiGet } from '../../lib/api';
import { sanitizeIndustryTagNames } from '../../lib/industryTags';
import { usePagedList } from '../../lib/usePagedList';
import { ListFooter } from '../../ui/ListFooter';
import { PageHeader, Spacer, Surface } from '../../ui/layout';
import { PullToRefresh, toast } from '../../ui/nutui';
import { EmptyCard, ErrorCard, LoadingCard } from '../../ui/StateCards';

type ClusterSummary = {
  id: string;
  name: string;
  regionName?: string;
  industryTags?: string[];
  summary?: string;
  patentCount?: number;
  listingCount?: number;
  institutionCount?: number;
  updatedAt?: string;
};

type InstitutionSummary = {
  id: string;
  name: string;
  regionName?: string;
  tags?: string[];
  patentCount?: number;
  listingCount?: number;
  logoUrl?: string;
};

type PagedClusters = {
  items: ClusterSummary[];
  featuredInstitutions?: InstitutionSummary[];
  page?: { page: number; pageSize: number; total: number };
};

export default function ClusterPickerPage() {
  const [institutions, setInstitutions] = useState<InstitutionSummary[]>([]);

  const fetcher = useCallback(
    async ({ page, pageSize }: { page: number; pageSize: number }) => {
      const d = await apiGet<PagedClusters>('/public/patent-clusters', { page, pageSize });
      if (page === 1) {
        setInstitutions(d.featuredInstitutions || []);
      }
      return d;
    },
    [],
  );

  const { items: clusters, loading, error, refreshing, loadingMore, hasMore, reload, refresh, loadMore } =
    usePagedList<ClusterSummary>(fetcher, {
      pageSize: 20,
      onError: (message, ctx) => {
        if (ctx === 'loadMore') toast(message);
      },
    });

  useEffect(() => {
    void reload();
  }, [reload]);

  const goClusterSearch = useCallback((cluster: ClusterSummary) => {
    Taro.setStorageSync(STORAGE_KEYS.searchPrefill, {
      tab: 'LISTING',
      listingTopic: 'CLUSTER_FEATURED',
      clusterId: cluster.id,
      clusterName: cluster.name,
      reset: true,
    });
    Taro.navigateTo({ url: '/subpackages/search/index' });
  }, []);

  return (
    <View className="container cluster-picker-page">
      <PageHeader weapp back title="产业集群" subtitle="先选集群，再进入专利搜索" />
      <Spacer />

      <PullToRefresh type="primary" disabled={loading || refreshing} onRefresh={refresh}>
        {loading ? (
          <LoadingCard text="集群加载中" />
        ) : error ? (
          <ErrorCard message={error} onRetry={reload} />
        ) : !clusters.length ? (
          <EmptyCard message="暂无集群数据" actionText="刷新" onAction={reload} />
        ) : (
          <>
            {institutions.length ? (
              <Surface className="cluster-section" padding="none">
                <Text className="cluster-section-title">高校 / 科研机构</Text>
                <View className="cluster-institution-grid">
                  {institutions.map((inst) => {
                    const visibleInstitutionTags = sanitizeIndustryTagNames(inst.tags || []);
                    return (
                    <View key={inst.id} className="cluster-institution-card">
                      <View className="cluster-institution-header">
                        <View className="cluster-institution-logo">
                          {inst.logoUrl ? (
                            <Image src={inst.logoUrl} mode="aspectFill" className="cluster-institution-logo-img" />
                          ) : (
                            <Text className="cluster-institution-logo-text">{inst.name?.slice(0, 2) || '高校'}</Text>
                          )}
                        </View>
                        <View className="cluster-institution-info">
                          <Text className="cluster-institution-name">{inst.name}</Text>
                          <Text className="cluster-institution-region">{inst.regionName || ''}</Text>
                        </View>
                      </View>
                      <View className="cluster-institution-stats">
                        <Text>专利 {inst.patentCount ?? '-'}</Text>
                        <Text>挂牌 {inst.listingCount ?? '-'}</Text>
                      </View>
                      {visibleInstitutionTags.length ? (
                        <View className="cluster-institution-tags">
                          {visibleInstitutionTags.slice(0, 3).map((tag, idx) => (
                            <Text key={`${inst.id}-tag-${idx}`} className="pill">
                              {tag}
                            </Text>
                          ))}
                        </View>
                      ) : null}
                    </View>
                  )})}
                </View>
              </Surface>
            ) : null}

            <Surface className="cluster-section" padding="none">
              <Text className="cluster-section-title">产业集群</Text>
              <View className="cluster-list">
                {clusters.map((cluster) => {
                  const visibleClusterTags = sanitizeIndustryTagNames(cluster.industryTags || []);
                  return (
                  <View key={cluster.id} className="cluster-card" onClick={() => goClusterSearch(cluster)}>
                    <View className="cluster-card-header">
                      <View className="cluster-card-title-wrap">
                        <Text className="cluster-card-title">{cluster.name}</Text>
                        {cluster.regionName ? <Text className="cluster-card-region">{cluster.regionName}</Text> : null}
                      </View>
                      <Text className="cluster-card-action">进入</Text>
                    </View>
                    {cluster.summary ? <Text className="cluster-card-summary">{cluster.summary}</Text> : null}
                    {visibleClusterTags.length ? (
                      <View className="cluster-card-tags">
                        {visibleClusterTags.slice(0, 3).map((tag, idx) => (
                          <Text key={`${cluster.id}-tag-${idx}`} className="pill">
                            {tag}
                          </Text>
                        ))}
                      </View>
                    ) : null}
                    <View className="cluster-card-meta">
                      <Text>专利 {cluster.patentCount ?? '-'}</Text>
                      <Text>挂牌 {cluster.listingCount ?? '-'}</Text>
                      <Text>机构 {cluster.institutionCount ?? '-'}</Text>
                    </View>
                  </View>
                )})}
              </View>
            </Surface>

            <ListFooter loadingMore={loadingMore} hasMore={hasMore} onLoadMore={loadMore} showNoMore />
          </>
        )}
      </PullToRefresh>
    </View>
  );
}
