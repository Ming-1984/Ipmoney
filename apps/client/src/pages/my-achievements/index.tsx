import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import type { components } from '@ipmoney/api-types';

import { apiGet, apiPost } from '../../lib/api';
import { ensureApproved, goLogin, goOnboarding, usePageAccess } from '../../lib/guard';
import { auditStatusLabel, auditStatusTagClass, contentStatusLabel } from '../../lib/labels';
import { regionDisplayName } from '../../lib/regions';
import { CategoryControl } from '../../ui/filters';
import { PageHeader, Spacer, Surface } from '../../ui/layout';
import { AuditPendingCard, EmptyCard, ErrorCard, LoadingCard, PermissionCard } from '../../ui/StateCards';
import { Button, toast } from '../../ui/nutui';

type PagedAchievement = components['schemas']['PagedAchievement'];
type Achievement = components['schemas']['Achievement'];
type ContentStatus = components['schemas']['ContentStatus'];
type AuditStatus = components['schemas']['AuditStatus'];
type AchievementMaturity = components['schemas']['AchievementMaturity'];

function maturityLabel(m?: AchievementMaturity | null): string {
  if (!m) return '成熟度：-';
  if (m === 'CONCEPT') return '成熟度：概念';
  if (m === 'PROTOTYPE') return '成熟度：样机/原型';
  if (m === 'PILOT') return '成熟度：中试';
  if (m === 'MASS_PRODUCTION') return '成熟度：量产';
  if (m === 'COMMERCIALIZED') return '成熟度：已产业化';
  return '成熟度：其他';
}

export default function MyAchievementsPage() {
  const [status, setStatus] = useState<ContentStatus | ''>('');
  const [auditStatusFilter, setAuditStatusFilter] = useState<AuditStatus | ''>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PagedAchievement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await apiGet<PagedAchievement>('/achievements', {
        page: 1,
        pageSize: 20,
        ...(status ? { status } : {}),
        ...(auditStatusFilter ? { auditStatus: auditStatusFilter } : {}),
      });
      setData(d);
    } catch (e: any) {
      setError(e?.message || '加载失败');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [auditStatusFilter, status]);

  const access = usePageAccess('approved-required', (a) => {
    if (a.state === 'ok') {
      void load();
      return;
    }
    setLoading(false);
    setError(null);
    setData(null);
  });

  useEffect(() => {
    if (access.state !== 'ok') return;
    void load();
  }, [access.state, load]);

  const items = useMemo(() => data?.items || [], [data?.items]);

  const goCreate = useCallback(() => {
    if (!ensureApproved()) return;
    Taro.navigateTo({ url: '/pages/publish/achievement/index' });
  }, []);

  if (access.state === 'need-login') {
    return (
      <View className="container">
        <PageHeader title="我的成果" subtitle="发布方查看/编辑/下架自己的成果展示" />
        <Spacer />
        <PermissionCard title="需要登录" message="登录后才能查看成果。" actionText="去登录" onAction={goLogin} />
      </View>
    );
  }
  if (access.state === 'need-onboarding') {
    return (
      <View className="container">
        <PageHeader title="我的成果" subtitle="发布方查看/编辑/下架自己的成果展示" />
        <Spacer />
        <PermissionCard title="需要选择身份" message="完成身份选择后才能继续。" actionText="去选择" onAction={goOnboarding} />
      </View>
    );
  }
  if (access.state === 'audit-pending') {
    return (
      <View className="container">
        <PageHeader title="我的成果" subtitle="发布方查看/编辑/下架自己的成果展示" />
        <Spacer />
        <AuditPendingCard title="资料审核中" message="审核通过后才能发布与管理成果。" actionText="查看进度" onAction={goOnboarding} />
      </View>
    );
  }
  if (access.state === 'audit-rejected') {
    return (
      <View className="container">
        <PageHeader title="我的成果" subtitle="发布方查看/编辑/下架自己的成果展示" />
        <Spacer />
        <AuditPendingCard title="资料已驳回" message="请重新提交资料，审核通过后才能继续。" actionText="重新提交" onAction={goOnboarding} />
      </View>
    );
  }
  if (access.state === 'audit-required') {
    return (
      <View className="container">
        <PageHeader title="我的成果" subtitle="发布方查看/编辑/下架自己的成果展示" />
        <Spacer />
        <AuditPendingCard title="需要认证" message="完成认证并审核通过后才能继续。" actionText="去认证" onAction={goOnboarding} />
      </View>
    );
  }

  return (
    <View className="container">
      <PageHeader title="我的成果" subtitle="发布方查看/编辑/下架自己的成果展示" />
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
          发布新的成果
        </Button>
      </Surface>

      <View style={{ height: '16rpx' }} />

      {loading ? (
        <LoadingCard />
      ) : error ? (
        <ErrorCard message={error} onRetry={load} />
      ) : items.length ? (
        <View>
          {items.map((it: Achievement) => (
            <Surface key={it.id} style={{ marginBottom: '16rpx' }}>
              <Text className="text-title clamp-2">{it.title || '未命名成果'}</Text>
              <View style={{ height: '8rpx' }} />
              <View className="row" style={{ gap: '12rpx', flexWrap: 'wrap' }}>
                <Text className="tag">{contentStatusLabel(it.status)}</Text>
                <Text className={auditStatusTagClass(it.auditStatus)}>{auditStatusLabel(it.auditStatus)}</Text>
                {it.regionCode ? <Text className="tag">{regionDisplayName(it.regionCode)}</Text> : null}
                <Text className="tag tag-gold">{maturityLabel(it.maturity)}</Text>
              </View>
              {it.summary ? (
                <>
                  <View style={{ height: '10rpx' }} />
                  <Text className="muted clamp-2">{it.summary}</Text>
                </>
              ) : null}
              <View style={{ height: '12rpx' }} />
              <View className="row" style={{ gap: '12rpx' }}>
                <View style={{ flex: 1 }}>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      Taro.navigateTo({ url: `/pages/publish/achievement/index?achievementId=${it.id}` });
                    }}
                  >
                    编辑/查看
                  </Button>
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    variant="danger"
                    fill="outline"
                    disabled={it.status !== 'ACTIVE'}
                    onClick={async () => {
                      try {
                        await apiPost<Achievement>(`/achievements/${it.id}/off-shelf`, { reason: '发布方下架' }, { idempotencyKey: `off-achievement-${it.id}` });
                        toast('已下架', { icon: 'success' });
                        void load();
                      } catch (e: any) {
                        toast(e?.message || '操作失败');
                      }
                    }}
                  >
                    下架
                  </Button>
                </View>
              </View>
            </Surface>
          ))}
        </View>
      ) : (
        <EmptyCard title="暂无成果" message="可先发布一条成果草稿。" actionText="刷新" onAction={load} />
      )}
    </View>
  );
}
