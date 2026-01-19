import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import type { components } from '@ipmoney/api-types';

import { apiGet, apiPost } from '../../lib/api';
import { ensureApproved, goLogin, goOnboarding, usePageAccess } from '../../lib/guard';
import { artworkStatusLabel, auditStatusLabel, auditStatusTagClass } from '../../lib/labels';
import { CategoryControl } from '../../ui/filters';
import { Button, toast } from '../../ui/nutui';
import { AuditPendingCard, EmptyCard, ErrorCard, LoadingCard, PermissionCard } from '../../ui/StateCards';
import { PageHeader, Spacer, Surface } from '../../ui/layout';

type PagedArtwork = components['schemas']['PagedArtwork'];
type Artwork = components['schemas']['Artwork'];
type ArtworkStatus = components['schemas']['ArtworkStatus'];
type AuditStatus = components['schemas']['AuditStatus'];

export default function MyArtworksPage() {
  const [status, setStatus] = useState<ArtworkStatus | ''>('');
  const [auditStatusFilter, setAuditStatusFilter] = useState<AuditStatus | ''>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PagedArtwork | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await apiGet<PagedArtwork>('/artworks', {
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
    Taro.navigateTo({ url: '/pages/publish/artwork/index' });
  }, []);

  if (access.state === 'need-login') {
    return (
      <View className="container">
        <PageHeader title="我的书画" subtitle="发布方查看/编辑/下架自己的书画作品" />
        <Spacer />
        <PermissionCard title="需要登录" message="登录后才能查看书画作品" actionText="去登录" onAction={goLogin} />
      </View>
    );
  }
  if (access.state === 'need-onboarding') {
    return (
      <View className="container">
        <PageHeader title="我的书画" subtitle="发布方查看/编辑/下架自己的书画作品" />
        <Spacer />
        <PermissionCard title="需要选择身份" message="完成身份选择后才能继续" actionText="去选择" onAction={goOnboarding} />
      </View>
    );
  }
  if (access.state === 'audit-pending') {
    return (
      <View className="container">
        <PageHeader title="我的书画" subtitle="发布方查看/编辑/下架自己的书画作品" />
        <Spacer />
        <AuditPendingCard title="资料审核中" message="审核通过后才能发布与管理书画作品" actionText="查看进度" onAction={goOnboarding} />
      </View>
    );
  }
  if (access.state === 'audit-rejected') {
    return (
      <View className="container">
        <PageHeader title="我的书画" subtitle="发布方查看/编辑/下架自己的书画作品" />
        <Spacer />
        <AuditPendingCard title="资料已驳回" message="请重新提交资料，审核通过后才能继续" actionText="重新提交" onAction={goOnboarding} />
      </View>
    );
  }
  if (access.state === 'audit-required') {
    return (
      <View className="container">
        <PageHeader title="我的书画" subtitle="发布方查看/编辑/下架自己的书画作品" />
        <Spacer />
        <AuditPendingCard title="需要认证" message="完成认证并审核通过后才能继续" actionText="去认证" onAction={goOnboarding} />
      </View>
    );
  }

  return (
    <View className="container">
      <PageHeader title="我的书画" subtitle="发布方查看/编辑/下架自己的书画作品" />
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
            { label: '成交', value: 'SOLD' },
          ]}
          onChange={(v) => setStatus(v as ArtworkStatus | '')}
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
          发布新的书画作品
        </Button>
      </Surface>

      <View style={{ height: '16rpx' }} />

      {loading ? (
        <LoadingCard />
      ) : error ? (
        <ErrorCard message={error} onRetry={load} />
      ) : items.length ? (
        <View>
          {items.map((it: Artwork) => (
            <Surface key={it.id} style={{ marginBottom: '16rpx' }}>
              <Text className="text-title clamp-2">{it.title || '未命名书画'}</Text>
              <View style={{ height: '8rpx' }} />
              <View className="row" style={{ gap: '12rpx', flexWrap: 'wrap' }}>
                <Text className="tag">{artworkStatusLabel(it.status)}</Text>
                <Text className={auditStatusTagClass(it.auditStatus)}>{auditStatusLabel(it.auditStatus)}</Text>
                {it.creatorName ? <Text className="tag">{it.creatorName}</Text> : null}
              </View>
              <View style={{ height: '12rpx' }} />
              <View className="row" style={{ gap: '12rpx' }}>
                <View style={{ flex: 1 }}>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      Taro.navigateTo({ url: `/pages/publish/artwork/index?artworkId=${it.id}` });
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
                        await apiPost<Artwork>(`/artworks/${it.id}/off-shelf`, {}, { idempotencyKey: `off-art-${it.id}` });
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
        <EmptyCard message="暂无书画作品" actionText="刷新" onAction={load} />
      )}
    </View>
  );
}
