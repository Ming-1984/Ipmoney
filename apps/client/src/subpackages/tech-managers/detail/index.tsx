import { View, Text, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './index.scss';

import type { components } from '@ipmoney/api-types';

import { apiGet, apiPost } from '../../../lib/api';
import { getDetailCache, setDetailCache } from '../../../lib/detailCache';
import { ensureApproved } from '../../../lib/guard';
import { safeNavigateBack } from '../../../lib/navigation';
import { useRouteUuidParam } from '../../../lib/routeParams';
import { sanitizeServiceTagNames } from '../../../lib/serviceTags';
import { toast } from '../../../ui/nutui';
import { EmptyCard, ErrorCard, LoadingCard, MissingParamCard } from '../../../ui/StateCards';

type TechManagerPublic = components['schemas']['TechManagerPublic'];
type Conversation = { id: string };

type DetailMeta = {
  ratingText: string;
  levelLabel: string;
  experienceYears: string | number;
  orgName: string;
  expertiseText: string;
};

export default function TechManagerDetailPage() {
  const techManagerId = useRouteUuidParam('techManagerId') || '';

  const initialCachedData = techManagerId ? getDetailCache<TechManagerPublic>('tech-manager-public', techManagerId) : null;
  const [loading, setLoading] = useState(!initialCachedData);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TechManagerPublic | null>(initialCachedData);

  useEffect(() => {
    if (!techManagerId) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }
    const cached = getDetailCache<TechManagerPublic>('tech-manager-public', techManagerId);
    setData(cached || null);
    setLoading(!cached);
    setError(null);
  }, [techManagerId]);

  const load = useCallback(async () => {
    if (!techManagerId) return;
    const cached = getDetailCache<TechManagerPublic>('tech-manager-public', techManagerId);
    if (cached) {
      setData(cached);
      setLoading(false);
      setError(null);
    } else {
      setLoading(true);
      setError(null);
    }
    try {
      const d = await apiGet<TechManagerPublic>(`/public/tech-managers/${techManagerId}`);
      setData(d);
      setDetailCache('tech-manager-public', techManagerId, d);
    } catch (e: any) {
      if (!cached) {
        setError(e?.message || '加载失败');
        setData(null);
      }
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
      Taro.navigateTo({ url: `/subpackages/messages/chat/index?conversationId=${conv.id}` });
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

  const avatar = useMemo(() => {
    if (!data?.avatarUrl) return '';
    return data.avatarUrl.includes('example.com') ? '' : data.avatarUrl;
  }, [data?.avatarUrl]);

  const meta: DetailMeta = useMemo(() => {
    const ratingScore = data?.stats?.ratingScore;
    const ratingCount = data?.stats?.ratingCount ?? 0;
    const ratingText =
      ratingCount > 0 && typeof ratingScore === 'number' && !Number.isNaN(ratingScore) ? ratingScore.toFixed(1) : '-';
    const ratingDisplay = ratingText === '-' ? '暂无评分' : `${ratingText}分`;
    const levelLabel =
      ratingCount > 0 && typeof ratingScore === 'number'
        ? ratingScore >= 4.9
          ? '高级'
          : ratingScore >= 4.6
          ? '中级'
          : '初级'
        : '认证';
    const orgName = data?.organization || '';
    const visibleServiceTags = sanitizeServiceTagNames(data?.serviceTags || []);
    const expertiseText =
      (data?.serviceDirections?.length ? data.serviceDirections.join('、') : '') ||
      (visibleServiceTags.length ? visibleServiceTags.join('、') : '') ||
      '暂无';
    let experienceYears: string | number = '-';
    if (data?.verifiedAt) {
      const verifiedDate = new Date(data.verifiedAt);
      if (!Number.isNaN(verifiedDate.getTime())) {
        const diffYears = Math.floor((Date.now() - verifiedDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
        experienceYears = Math.max(1, diffYears);
      }
    }

    return { ratingText: ratingDisplay, levelLabel, experienceYears, orgName, expertiseText };
  }, [data]);

  return (
    <View className="container consult-detail-page">
      {loading ? (
        <LoadingCard />
      ) : error ? (
        <ErrorCard message={error} onRetry={load} />
      ) : data ? (
        <View>
          <View className="consult-detail-hero">
            <View className="consult-detail-hero-card">
              <View className="consult-detail-avatar">
                {avatar ? (
                  <Image src={avatar} mode="aspectFill" className="consult-detail-avatar-img" />
                ) : (
                  <Text className="consult-detail-avatar-text">{(data.displayName || 'T').slice(0, 1)}</Text>
                )}
              </View>
              <View className="consult-detail-meta">
                <View className="consult-detail-name-row">
                  <Text className="consult-detail-name">{data.displayName || '-'}</Text>
                  {meta.levelLabel ? <Text className="consult-detail-level-badge">{meta.levelLabel}</Text> : null}
                </View>
                <Text className="consult-detail-org">{meta.orgName || '暂无机构信息'}</Text>
              </View>
            </View>
          </View>

          <View className="consult-detail-stats-card">
            <View className="consult-detail-stat">
              <Text className="consult-detail-stat-num">
                {typeof meta.experienceYears === 'number' ? `${meta.experienceYears}年` : meta.experienceYears}
              </Text>
              <Text className="consult-detail-stat-label">从业年限</Text>
            </View>
            <View className="consult-detail-stat-divider" />
            <View className="consult-detail-stat">
              <Text className="consult-detail-stat-num is-accent">
                {meta.ratingText}
              </Text>
              <Text className="consult-detail-stat-label">综合评分</Text>
            </View>
          </View>

          <View className="consult-detail-section">
            <View className="consult-detail-section-head">
              <View className="consult-detail-section-bar" />
              <Text className="consult-detail-section-title">擅长领域</Text>
            </View>
            <Text className="consult-detail-section-text consult-detail-section-accent">{meta.expertiseText}</Text>
          </View>

          <View className="consult-detail-section">
            <View className="consult-detail-section-head">
              <View className="consult-detail-section-bar" />
              <Text className="consult-detail-section-title">个人简介</Text>
            </View>
            <Text className="consult-detail-section-text">{data.intro || data.workHighlights || '暂无简介'}</Text>
          </View>

          <View className="consult-detail-section">
            <View className="consult-detail-section-head">
              <View className="consult-detail-section-bar" />
              <Text className="consult-detail-section-title">服务标签</Text>
            </View>
            {Array.isArray(data.serviceTags) && data.serviceTags.length ? (
              <View className="consult-detail-honors">
                {data.serviceTags.map((title) => (
                  <Text key={title} className="consult-detail-honor">
                    {title}
                  </Text>
                ))}
              </View>
            ) : (
              <Text className="consult-detail-section-text">暂无标签</Text>
            )}
          </View>

          <View className="consult-detail-cta-wrap">
            <View className="consult-detail-cta" onClick={() => void startConsult()}>
              立即咨询
            </View>
          </View>
        </View>
      ) : (
        <EmptyCard message="暂无数据" actionText="返回" onAction={() => void safeNavigateBack()} />
      )}
    </View>
  );
}



