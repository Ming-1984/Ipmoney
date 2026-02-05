import { View, Text, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './index.scss';

import type { components } from '@ipmoney/api-types';

import { apiGet, apiPost } from '../../../lib/api';
import { ensureApproved } from '../../../lib/guard';
import { safeNavigateBack } from '../../../lib/navigation';
import { useRouteUuidParam } from '../../../lib/routeParams';
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
  honorTitles: string[];
};

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

  const avatar = useMemo(() => {
    if (!data?.avatarUrl) return '';
    return data.avatarUrl.includes('example.com') ? '' : data.avatarUrl;
  }, [data?.avatarUrl]);

  const meta: DetailMeta = useMemo(() => {
    const ratingScore = data?.stats?.ratingScore;
    const ratingText =
      typeof ratingScore === 'number' && !Number.isNaN(ratingScore) ? ratingScore.toFixed(1) : '-';
    const levelLabel =
      typeof ratingScore === 'number'
        ? ratingScore >= 4.9
          ? '高级'
          : ratingScore >= 4.6
          ? '中级'
          : '初级'
        : '认证';
    const orgName =
      (data as any)?.organizationName || (data as any)?.companyName || (data as any)?.organization || '';
    const expertiseText =
      (data as any)?.expertiseSummary ||
      (data?.serviceTags?.length ? data.serviceTags.join('、') : '') ||
      '暂无';
    const honorTitles = ((data as any)?.honorTitles as string[]) || [];
    let experienceYears: string | number = '-';
    if (data?.verifiedAt) {
      const verifiedDate = new Date(data.verifiedAt);
      if (!Number.isNaN(verifiedDate.getTime())) {
        const diffYears = Math.floor((Date.now() - verifiedDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
        experienceYears = Math.max(1, diffYears);
      }
    }

    return { ratingText, levelLabel, experienceYears, orgName, expertiseText, honorTitles };
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
                <Text className="consult-detail-org">{meta.orgName || '机构信息待补充'}</Text>
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
                {meta.ratingText === '-' ? '-' : `${meta.ratingText}分`}
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
            <Text className="consult-detail-section-text">{data.intro || '暂无简介'}</Text>
          </View>

          <View className="consult-detail-section">
            <View className="consult-detail-section-head">
              <View className="consult-detail-section-bar" />
              <Text className="consult-detail-section-title">荣誉称号</Text>
            </View>
            {meta.honorTitles.length ? (
              <View className="consult-detail-honors">
                {meta.honorTitles.map((title) => (
                  <Text key={title} className="consult-detail-honor">
                    {title}
                  </Text>
                ))}
              </View>
            ) : (
              <Text className="consult-detail-section-text">暂无荣誉</Text>
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




