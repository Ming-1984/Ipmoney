import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './index.scss';

import type { components } from '@ipmoney/api-types';

import { apiGet, apiPost } from '../../../../lib/api';
import { ensureApproved } from '../../../../lib/guard';
import { patentTypeLabel } from '../../../../lib/labels';
import { fenToYuan } from '../../../../lib/money';
import { safeNavigateBack } from '../../../../lib/navigation';
import { useRouteUuidParam } from '../../../../lib/routeParams';
import { CommentsSection } from '../../../../ui/CommentsSection';
import { PageHeader, Spacer, StickyBar, Surface } from '../../../../ui/layout';
import { Button, toast } from '../../../../ui/nutui';
import { EmptyCard, ErrorCard, LoadingCard, MissingParamCard } from '../../../../ui/StateCards';

type Patent = components['schemas']['Patent'];

type PatentTradeSnapshot = {
  listingId?: string;
  depositAmountFen?: number | null;
};

type Conversation = { id: string };

function legalStatusLabel(status?: Patent['legalStatus']): string {
  if (!status) return '未知';
  if (status === 'PENDING') return '审中';
  if (status === 'GRANTED') return '已授权';
  if (status === 'EXPIRED') return '已失效';
  if (status === 'INVALIDATED') return '已无效';
  return '未知';
}

function buildTabUrl(tabId: string, patentId: string): string {
  const basePath = '/pages/patent/detail';
  if (tabId === 'summary') return `${basePath}/summary/index?patentId=${patentId}`;
  if (tabId === 'info') return `${basePath}/info/index?patentId=${patentId}`;
  if (tabId === 'comments') return `${basePath}/comments/index?patentId=${patentId}`;
  return `${basePath}/index?patentId=${patentId}`;
}

export default function PatentDetailCommentsPage() {
  const patentId = useRouteUuidParam('patentId') || '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Patent | null>(null);
  const activeTab = 'comments';

  const load = useCallback(async () => {
    if (!patentId) return;
    setLoading(true);
    setError(null);
    try {
      const d = await apiGet<Patent>(`/patents/${patentId}`);
      setData(d);
    } catch (e: any) {
      setError(e?.message || '加载失败');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [patentId]);

  const copyText = useCallback(async (text: string) => {
    try {
      await Taro.setClipboardData({ data: text });
      toast('已复制', { icon: 'success' });
    } catch (_) {
      toast('复制失败', { icon: 'fail' });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const tradeSnapshot = ((data as any)?.tradeSnapshot ?? null) as PatentTradeSnapshot | null;
  const listingId = tradeSnapshot?.listingId || '';
  const depositAmountFen = tradeSnapshot?.depositAmountFen ?? null;
  const canTrade = Boolean(listingId);
  const depositLabel = depositAmountFen != null ? `付订金 ￥${fenToYuan(depositAmountFen)}` : '付订金';

  const startConsult = useCallback(async () => {
    if (!listingId) {
      toast('暂无可咨询的挂牌', { icon: 'fail' });
      return;
    }
    if (!ensureApproved()) return;
    try {
      await apiPost<void>(
        `/listings/${listingId}/consultations`,
        { channel: 'FORM' },
        { idempotencyKey: `patent-c-${listingId}` },
      );
    } catch (_) {
      // ignore: heat event
    }
    try {
      const conv = await apiPost<Conversation>(
        `/listings/${listingId}/conversations`,
        {},
        { idempotencyKey: `patent-conv-${listingId}` },
      );
      Taro.navigateTo({ url: `/pages/messages/chat/index?conversationId=${conv.id}` });
    } catch (e: any) {
      toast(e?.message || '进入咨询失败');
    }
  }, [listingId]);

  const tabs = useMemo(
    () => [
      { id: 'overview', label: '概览' },
      { id: 'summary', label: '摘要' },
      { id: 'info', label: '信息' },
      { id: 'comments', label: '评论' },
    ],
    [],
  );

  const goToTab = useCallback(
    (id: string) => {
      if (!patentId || id === activeTab) return;
      Taro.redirectTo({ url: buildTabUrl(id, patentId) });
    },
    [patentId, activeTab],
  );

  if (!patentId) {
    return (
      <View className="container">
        <MissingParamCard onAction={() => void safeNavigateBack()} />
      </View>
    );
  }

  return (
    <View className="container detail-page-compact has-sticky">
      <PageHeader weapp title="专利详情" subtitle="评论信息" />
      <Spacer />

      {loading ? (
        <LoadingCard />
      ) : error ? (
        <ErrorCard message={error} onRetry={load} />
      ) : data ? (
        <View>
          <Surface className="detail-meta-card detail-compact-header" id="patent-overview">
            <Text className="detail-compact-title clamp-2">{data.title || '未命名专利'}</Text>
            <Spacer size={8} />
            <View className="detail-compact-tags">
              <Text className="detail-compact-tag detail-compact-tag-strong">类型 {patentTypeLabel(data.patentType)}</Text>
              <Text className="detail-compact-tag">状态 {legalStatusLabel(data.legalStatus)}</Text>
              {(data as any)?.caseStatus ? <Text className="detail-compact-tag">案号 {(data as any).caseStatus}</Text> : null}
            </View>
            <Spacer size={10} />
            <View className="detail-compact-row">
              <Text className="muted ellipsis" style={{ flex: 1, minWidth: 0 }}>
                申请号 {data.applicationNoDisplay || data.applicationNoNorm || '-'}
              </Text>
              {data.applicationNoDisplay || data.applicationNoNorm ? (
                <Button
                  block={false}
                  size="small"
                  variant="ghost"
                  onClick={() => void copyText((data.applicationNoDisplay || data.applicationNoNorm) as string)}
                >
                  复制
                </Button>
              ) : null}
            </View>
          </Surface>

          <View className="detail-tabs">
            <View className="detail-tabs-scroll">
              {tabs.map((tab) => (
                <Text
                  key={tab.id}
                  className={`detail-tab ${activeTab === tab.id ? 'is-active' : ''}`}
                  onClick={() => goToTab(tab.id)}
                >
                  {tab.label}
                </Text>
              ))}
            </View>
          </View>

          <Spacer size={12} />

          {listingId ? (
            <View id="patent-comments" className="patent-card-stack">
              <CommentsSection contentType="LISTING" contentId={listingId} title="互动留言" />
            </View>
          ) : (
            <View className="detail-section-card">
              <Text className="muted">暂无关联挂牌，无法展示评论</Text>
            </View>
          )}
        </View>
      ) : (
        <EmptyCard message="暂无数据" actionText="返回" onAction={() => void safeNavigateBack()} />
      )}

      {data && canTrade ? (
        <StickyBar>
          <View className="detail-sticky-buttons">
            <Button variant="default" onClick={() => void startConsult()}>
              在线咨询
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (!ensureApproved()) return;
                Taro.navigateTo({ url: `/pages/checkout/deposit-pay/index?listingId=${listingId}` });
              }}
            >
              {depositLabel}
            </Button>
          </View>
        </StickyBar>
      ) : null}
    </View>
  );
}
