import { View, Text, Image } from '@tarojs/components';
import Taro, { useDidHide, useDidShow } from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './index.scss';

import type { components } from '@ipmoney/api-types';

import { apiGet, apiPost } from '../../../lib/api';
import { getDetailCache, setDetailCache } from '../../../lib/detailCache';
import { displayInitial, normalizeDisplayText } from '../../../lib/displayText';
import { ensureApproved } from '../../../lib/guard';
import { safeNavigateBack } from '../../../lib/navigation';
import { useRouteUuidParam } from '../../../lib/routeParams';
import { sanitizeServiceTagNames } from '../../../lib/serviceTags';
import {
  resolveTechManagerBadges,
  resolveTechManagerDisplayName,
  resolveTechManagerExperienceLabel,
  resolveTechManagerLevelLabel,
} from '../../../lib/techManagerDisplay';
import { toast } from '../../../ui/nutui';
import { EmptyCard, ErrorCard, LoadingCard, MissingParamCard } from '../../../ui/StateCards';

type TechManagerPublic = components['schemas']['TechManagerPublic'];
type Conversation = { id: string };

type DetailMeta = {
  displayName: string;
  levelLabel?: string;
  experienceLabel: string;
  organizationText: string;
  expertiseText: string;
  introText: string;
  badges: Array<{ code: string; name: string; category: string }>;
};

function resolveAvatarFallbackText(value: unknown, fallback: string): string {
  return displayInitial(value, fallback);
}

export default function TechManagerDetailPage() {
  const techManagerId = useRouteUuidParam('techManagerId') || '';
  const techManagerIdRef = useRef(techManagerId);
  const pageVisibleRef = useRef(true);
  const consultSeqRef = useRef(0);

  const initialCachedData = techManagerId ? getDetailCache<TechManagerPublic>('tech-manager-public', techManagerId) : null;
  const [loading, setLoading] = useState(!initialCachedData);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TechManagerPublic | null>(initialCachedData);

  useDidShow(() => {
    pageVisibleRef.current = true;
  });

  useDidHide(() => {
    pageVisibleRef.current = false;
    consultSeqRef.current += 1;
  });

  useEffect(() => {
    techManagerIdRef.current = techManagerId;
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
    const targetTechManagerId = techManagerId;
    if (!targetTechManagerId) return;
    const cached = getDetailCache<TechManagerPublic>('tech-manager-public', targetTechManagerId);
    if (cached) {
      setData(cached);
      setLoading(false);
      setError(null);
    } else {
      setLoading(true);
      setError(null);
    }
    try {
      const d = await apiGet<TechManagerPublic>(`/public/tech-managers/${targetTechManagerId}`);
      if (techManagerIdRef.current !== targetTechManagerId) return;
      setData(d);
      setDetailCache('tech-manager-public', targetTechManagerId, d);
    } catch (e: any) {
      if (techManagerIdRef.current !== targetTechManagerId) return;
      if (!cached) {
        setError(e?.message || '加载失败');
        setData(null);
      }
    } finally {
      if (techManagerIdRef.current === targetTechManagerId) setLoading(false);
    }
  }, [techManagerId]);

  useEffect(() => {
    void load();
  }, [load]);

  const startConsult = useCallback(async () => {
    if (!ensureApproved()) return;
    const seq = ++consultSeqRef.current;
    try {
      const conv = await apiPost<Conversation>(
        `/tech-managers/${techManagerId}/conversations`,
        {},
        { idempotencyKey: `conv-tech-${techManagerId}` },
      );
      if (seq !== consultSeqRef.current || !pageVisibleRef.current) return;
      Taro.navigateTo({ url: `/subpackages/messages/chat/index?conversationId=${conv.id}` });
    } catch (e: any) {
      if (seq !== consultSeqRef.current || !pageVisibleRef.current) return;
      toast(e?.message || '进入咨询失败');
    }
  }, [techManagerId]);

  const avatar = useMemo(() => {
    if (!data?.avatarUrl) return '';
    return data.avatarUrl.includes('example.com') ? '' : data.avatarUrl;
  }, [data?.avatarUrl]);

  const visibleServiceTags = useMemo(() => sanitizeServiceTagNames(data?.serviceTags || []), [data?.serviceTags]);

  const meta: DetailMeta = useMemo(() => {
    const displayName = resolveTechManagerDisplayName(data);
    const levelLabel = resolveTechManagerLevelLabel(data);
    const organizationText = normalizeDisplayText(data?.organization);
    const visibleServiceDirections = Array.isArray(data?.serviceDirections)
      ? data.serviceDirections.map((item) => normalizeDisplayText(item)).filter(Boolean)
      : [];
    const expertiseText = visibleServiceDirections.join('、');
    const experienceLabel = resolveTechManagerExperienceLabel(data);
    const introText = normalizeDisplayText(data?.intro);
    const badges = resolveTechManagerBadges(data).map((item) => ({
      code: item.code,
      name: item.name,
      category: item.category,
    }));

    return {
      displayName,
      levelLabel: levelLabel || undefined,
      experienceLabel,
      organizationText,
      expertiseText,
      introText,
      badges,
    };
  }, [data]);

  if (!techManagerId) {
    return (
      <View className="container">
        <MissingParamCard onAction={() => void safeNavigateBack()} />
      </View>
    );
  }

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
                  <Text className="consult-detail-avatar-text">{resolveAvatarFallbackText(meta.displayName, '专')}</Text>
                )}
              </View>
              <View className="consult-detail-meta">
                <View className="consult-detail-name-row">
                  <Text className="consult-detail-name">{meta.displayName}</Text>
                  {meta.levelLabel ? <Text className="consult-detail-level-badge">{meta.levelLabel}</Text> : null}
                </View>
                {meta.organizationText ? <Text className="consult-detail-org">{meta.organizationText}</Text> : null}
              </View>
            </View>
          </View>

          <View className="consult-detail-stats-card">
            {meta.experienceLabel ? (
              <>
                <View className="consult-detail-stat">
                  <Text className="consult-detail-stat-num">{meta.experienceLabel}</Text>
                  <Text className="consult-detail-stat-label">从业信息</Text>
                </View>
              </>
            ) : null}
          </View>

          <View className="consult-detail-section">
            <View className="consult-detail-section-head">
              <View className="consult-detail-section-bar" />
              <Text className="consult-detail-section-title">荣誉标签</Text>
            </View>
            {meta.badges.length ? (
              <View className="consult-detail-honors">
                {meta.badges.map((badge) => (
                  <Text
                    key={badge.code}
                    className={[
                      'consult-detail-honor',
                      badge.category === 'STATUS' ? 'is-status' : 'is-honor',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {badge.name}
                  </Text>
                ))}
              </View>
            ) : (
              <Text className="consult-detail-section-text">暂无标签</Text>
            )}
          </View>

          <View className="consult-detail-section">
            <View className="consult-detail-section-head">
              <View className="consult-detail-section-bar" />
              <Text className="consult-detail-section-title">擅长领域</Text>
            </View>
            {meta.expertiseText ? (
              <Text className="consult-detail-section-text consult-detail-section-accent">{meta.expertiseText}</Text>
            ) : (
              <Text className="consult-detail-section-text">暂无信息</Text>
            )}
          </View>

          <View className="consult-detail-section">
            <View className="consult-detail-section-head">
              <View className="consult-detail-section-bar" />
              <Text className="consult-detail-section-title">个人简介</Text>
            </View>
            {meta.introText ? (
              <Text className="consult-detail-section-text">{meta.introText}</Text>
            ) : (
              <Text className="consult-detail-section-text">暂无信息</Text>
            )}
          </View>

          <View className="consult-detail-section">
            <View className="consult-detail-section-head">
              <View className="consult-detail-section-bar" />
              <Text className="consult-detail-section-title">服务标签</Text>
            </View>
            {visibleServiceTags.length ? (
              <View className="consult-detail-honors">
                {visibleServiceTags.map((title) => (
                  <Text key={title} className="consult-detail-honor">
                    {title}
                  </Text>
                ))}
              </View>
            ) : (
              <Text className="consult-detail-section-text">暂无信息</Text>
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
