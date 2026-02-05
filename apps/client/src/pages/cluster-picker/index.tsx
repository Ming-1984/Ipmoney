import { View, Text, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './index.scss';

import { STORAGE_KEYS } from '../../constants';
import { apiGet } from '../../lib/api';
import { PageHeader, Spacer, Surface } from '../../ui/layout';
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PagedClusters | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await apiGet<PagedClusters>('/public/patent-clusters', { page: 1, pageSize: 20 });
      setData(d);
    } catch (e: any) {
      setError(e?.message || '加载失败');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const clusters = useMemo(() => data?.items || [], [data?.items]);
  const institutions = useMemo(() => data?.featuredInstitutions || [], [data?.featuredInstitutions]);

  const goClusterSearch = useCallback((cluster: ClusterSummary) => {
    Taro.setStorageSync(STORAGE_KEYS.searchPrefill, {
      tab: 'LISTING',
      listingTopic: 'CLUSTER_FEATURED',
      clusterId: cluster.id,
      clusterName: cluster.name,
      reset: true,
    });
    Taro.navigateTo({ url: '/pages/search/index' });
  }, []);

  return (
    <View className="container cluster-picker-page">
      <PageHeader weapp back title="产业集群" subtitle="先选集群，再进入专利搜索" />
      <Spacer />

      {loading ? (
        <LoadingCard text="集群加载中" />
      ) : error ? (
        <ErrorCard message={error} onRetry={load} />
      ) : !clusters.length ? (
        <EmptyCard message="暂无集群数据" actionText="刷新" onAction={load} />
      ) : (
        <>
          {institutions.length ? (
            <Surface className="cluster-section" padding="none">
              <Text className="cluster-section-title">高校 / 科研机构</Text>
              <View className="cluster-institution-grid">
                {institutions.map((inst) => (
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
                    {inst.tags?.length ? (
                      <View className="cluster-institution-tags">
                        {inst.tags.slice(0, 3).map((tag, idx) => (
                          <Text key={`${inst.id}-tag-${idx}`} className="pill">
                            {tag}
                          </Text>
                        ))}
                      </View>
                    ) : null}
                  </View>
                ))}
              </View>
            </Surface>
          ) : null}

          <Surface className="cluster-section" padding="none">
            <Text className="cluster-section-title">产业集群</Text>
            <View className="cluster-list">
              {clusters.map((cluster) => (
                <View key={cluster.id} className="cluster-card" onClick={() => goClusterSearch(cluster)}>
                  <View className="cluster-card-header">
                    <View className="cluster-card-title-wrap">
                      <Text className="cluster-card-title">{cluster.name}</Text>
                      {cluster.regionName ? <Text className="cluster-card-region">{cluster.regionName}</Text> : null}
                    </View>
                    <Text className="cluster-card-action">进入</Text>
                  </View>
                  {cluster.summary ? <Text className="cluster-card-summary">{cluster.summary}</Text> : null}
                  {cluster.industryTags?.length ? (
                    <View className="cluster-card-tags">
                      {cluster.industryTags.slice(0, 3).map((tag, idx) => (
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
              ))}
            </View>
          </Surface>
        </>
      )}
    </View>
  );
}
