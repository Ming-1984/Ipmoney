import { View, Text, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import './index.scss';

import type { components } from '@ipmoney/api-types';

import { apiGet, apiPost } from '../../lib/api';
import { displayTitleOrFallback, normalizeDisplayText } from '../../lib/displayText';
import { usePagedList } from '../../lib/usePagedList';
import { ensureApproved, goLogin, goOnboarding, usePageAccess } from '../../lib/guard';
import { auditStatusLabel, auditStatusTagClass, contentStatusLabel } from '../../lib/labels';
import { CategoryControl } from '../../ui/filters';
import { ListFooter } from '../../ui/ListFooter';
import { Button, PullToRefresh, toast } from '../../ui/nutui';
import { AuditPendingCard, EmptyCard, ErrorCard, LoadingCard, PermissionCard } from '../../ui/StateCards';
import { PageHeader, Spacer, Surface } from '../../ui/layout';
import iconAchievement from '../../assets/icons/app/patent-achievement.png';

type PagedAchievement = components['schemas']['PagedAchievementSummary'];
type Achievement = components['schemas']['AchievementSummary'];
type ContentStatus = components['schemas']['ContentStatus'];
type AuditStatus = components['schemas']['AuditStatus'];

const PAGE_TITLE = '我的专利成果';
const PAGE_SUBTITLE = '发布方查看、编辑、下架自己的成果展示信息';

export default function MyAchievementsPage() {
  const loadedOnceRef = useRef(false);
  const filterKeyRef = useRef('');
  const [status, setStatus] = useState<ContentStatus | ''>('');
  const [auditStatusFilter, setAuditStatusFilter] = useState<AuditStatus | ''>('');

  const fetcher = useCallback(
    async ({ page, pageSize }: { page: number; pageSize: number }) =>
      apiGet<PagedAchievement>('/achievements', {
        page,
        pageSize,
        ...(status ? { status } : {}),
        ...(auditStatusFilter ? { auditStatus: auditStatusFilter } : {}),
      }),
    [auditStatusFilter, status],
  );

  const { items, loading, error, refreshing, loadingMore, hasMore, reload, refresh, loadMore, reset } =
    usePagedList<Achievement>(fetcher, {
      pageSize: 20,
      onError: (message, ctx) => {
        if (ctx === 'loadMore') toast(message);
      },
    });

  const access = usePageAccess('approved-required', (a) => {
    if (a.state === 'ok') {
      if (loadedOnceRef.current) {
        void refresh();
      }
      return;
    }
    loadedOnceRef.current = false;
    reset();
  });

  useEffect(() => {
    const nextKey = `${status}:${auditStatusFilter}`;
    if (filterKeyRef.current === nextKey) return;
    filterKeyRef.current = nextKey;
    reset();
  }, [auditStatusFilter, reset, status]);

  useEffect(() => {
    if (access.state !== 'ok') return;
    loadedOnceRef.current = true;
    void reload();
  }, [access.state, auditStatusFilter, reload, status]);

  const showInitialLoading = loading && items.length === 0;

  const goCreate = useCallback(() => {
    if (!ensureApproved()) return;
    Taro.navigateTo({ url: '/subpackages/publish/achievement/index' });
  }, []);

  if (access.state === 'need-login') {
    return (
      <View className="container my-achievements-page">
        <PageHeader title={PAGE_TITLE} subtitle={PAGE_SUBTITLE} />
        <Spacer />
        <PermissionCard title="需要登录" message="登录后才能查看成果信息。" actionText="去登录" onAction={goLogin} />
      </View>
    );
  }
  if (access.state === 'need-onboarding') {
    return (
      <View className="container my-achievements-page">
        <PageHeader title={PAGE_TITLE} subtitle={PAGE_SUBTITLE} />
        <Spacer />
        <PermissionCard title="需要选择身份" message="完成身份选择后才能继续。" actionText="去选择" onAction={goOnboarding} />
      </View>
    );
  }
  if (access.state === 'audit-pending') {
    return (
      <View className="container my-achievements-page">
        <PageHeader title={PAGE_TITLE} subtitle={PAGE_SUBTITLE} />
        <Spacer />
        <AuditPendingCard title="资料审核中" message="审核通过后才能发布与管理成果信息。" actionText="查看进度" onAction={goOnboarding} />
      </View>
    );
  }
  if (access.state === 'audit-rejected') {
    return (
      <View className="container my-achievements-page">
        <PageHeader title={PAGE_TITLE} subtitle={PAGE_SUBTITLE} />
        <Spacer />
        <AuditPendingCard title="资料已驳回" message="请重新提交资料，审核通过后才能继续。" actionText="重新提交" onAction={goOnboarding} />
      </View>
    );
  }
  if (access.state === 'audit-required') {
    return (
      <View className="container my-achievements-page">
        <PageHeader title={PAGE_TITLE} subtitle={PAGE_SUBTITLE} />
        <Spacer />
        <AuditPendingCard title="需要认证" message="完成认证并审核通过后才能继续。" actionText="去认证" onAction={goOnboarding} />
      </View>
    );
  }

  return (
    <View className="container my-achievements-page">
      <PageHeader title={PAGE_TITLE} subtitle={PAGE_SUBTITLE} />
      <Spacer />

      <Surface>
        <Text className="text-strong">状态筛选</Text>
        <View style={{ height: '10rpx' }} />
        <CategoryControl
          value={status}
          options={[
            { label: '全部', value: '' },
            { label: '草稿', value: 'DRAFT' },
            { label: '上架', value: 'ACTIVE' },
            { label: '下架', value: 'OFF_SHELF' },
          ]}
          onChange={(v) => setStatus(v as ContentStatus | '')}
        />

        <View style={{ height: '14rpx' }} />
        <Text className="text-strong">审核筛选</Text>
        <View style={{ height: '10rpx' }} />
        <CategoryControl
          value={auditStatusFilter}
          options={[
            { label: '全部', value: '' },
            { label: '审核中', value: 'PENDING' },
            { label: '已通过', value: 'APPROVED' },
            { label: '已驳回', value: 'REJECTED' },
          ]}
          onChange={(v) => setAuditStatusFilter(v as AuditStatus | '')}
        />
        <View style={{ height: '12rpx' }} />
        <Button variant="primary" onClick={goCreate}>
          发布新的专利成果
        </Button>
      </Surface>

      <View style={{ height: '16rpx' }} />

      <PullToRefresh type="primary" disabled={showInitialLoading || refreshing} onRefresh={refresh}>
        {showInitialLoading ? (
          <LoadingCard />
        ) : error ? (
          <ErrorCard message={error} onRetry={reload} />
        ) : items.length ? (
          <View className="card-list">
            {items.map((it: Achievement) => (
              <View key={it.id} className="list-card">
                <View className="list-card-thumb thumb-tone-teal">
                  <Image className="list-card-thumb-img" src={iconAchievement} mode="aspectFit" />
                </View>
                <View className="list-card-body">
                  <View className="list-card-head">
                    <View className="list-card-head-main">
                      <Text className="list-card-title clamp-2">{displayTitleOrFallback(it.title, '成果标题待确认')}</Text>
                      <View className="list-card-tags">
                        <Text className="tag">{contentStatusLabel(it.status)}</Text>
                        <Text className={auditStatusTagClass(it.auditStatus)}>{auditStatusLabel(it.auditStatus)}</Text>
                      </View>
                    </View>
                  </View>
                  <View className="list-card-actions">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        Taro.navigateTo({ url: `/subpackages/publish/achievement/index?achievementId=${it.id}` });
                      }}
                    >
                      编辑/查看
                    </Button>
                    <Button
                      variant="danger"
                      fill="outline"
                      disabled={it.status !== 'ACTIVE'}
                      onClick={async () => {
                        try {
                          await apiPost<components['schemas']['AchievementRecord']>(
                            `/achievements/${it.id}/off-shelf`,
                            { reason: '发布方下架' },
                            { idempotencyKey: `off-ach-${it.id}` },
                          );
                          toast('已下架', { icon: 'success' });
                          void reload();
                        } catch (e: any) {
                          toast(e?.message || '操作失败');
                        }
                      }}
                    >
                      下架
                    </Button>
                  </View>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <EmptyCard message="暂无成果记录" actionText="刷新" onAction={reload} />
        )}

        {!showInitialLoading && items.length ? (
          <ListFooter loadingMore={loadingMore} hasMore={hasMore} onLoadMore={loadMore} showNoMore />
        ) : null}
      </PullToRefresh>
    </View>
  );
}
