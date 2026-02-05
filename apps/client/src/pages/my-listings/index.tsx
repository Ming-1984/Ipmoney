import { View, Text, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './index.scss';

import type { components } from '@ipmoney/api-types';

import { apiGet, apiPost } from '../../lib/api';
import { ensureApproved, goLogin, goOnboarding, usePageAccess } from '../../lib/guard';
import { auditStatusLabel, auditStatusTagClass, listingStatusLabel } from '../../lib/labels';
import { CategoryControl } from '../../ui/filters';
import { Button, toast } from '../../ui/nutui';
import { AuditPendingCard, EmptyCard, ErrorCard, LoadingCard, PermissionCard } from '../../ui/StateCards';
import { PageHeader, Spacer, Surface } from '../../ui/layout';
import iconShield from '../../assets/icons/icon-shield-orange.svg';

type PagedListing = components['schemas']['PagedListing'];
type Listing = components['schemas']['Listing'];
type ListingStatus = components['schemas']['ListingStatus'];
type AuditStatus = components['schemas']['AuditStatus'];

export default function MyListingsPage() {
  const [status, setStatus] = useState<ListingStatus | ''>('');
  const [auditStatusFilter, setAuditStatusFilter] = useState<AuditStatus | ''>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PagedListing | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await apiGet<PagedListing>('/listings', {
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
    Taro.navigateTo({ url: '/pages/publish/patent/index' });
  }, []);

  if (access.state === 'need-login') {
    return (
      <View className="container">
        <PageHeader title="我的专利上架" subtitle="卖家查看/编辑/下架自己的专利上架信息" />
        <Spacer />
        <PermissionCard title="需要登录" message="登录后才能查看上架信息。" actionText="去登录" onAction={goLogin} />
      </View>
    );
  }
  if (access.state === 'need-onboarding') {
    return (
      <View className="container">
        <PageHeader title="我的专利上架" subtitle="卖家查看/编辑/下架自己的专利上架信息" />
        <Spacer />
        <PermissionCard title="需要选择身份" message="完成身份选择后才能继续。" actionText="去选择" onAction={goOnboarding} />
      </View>
    );
  }
  if (access.state === 'audit-pending') {
    return (
      <View className="container">
        <PageHeader title="我的专利上架" subtitle="卖家查看/编辑/下架自己的专利上架信息" />
        <Spacer />
        <AuditPendingCard title="资料审核中" message="审核通过后才能发布与管理上架信息。" actionText="查看进度" onAction={goOnboarding} />
      </View>
    );
  }
  if (access.state === 'audit-rejected') {
    return (
      <View className="container">
        <PageHeader title="我的专利上架" subtitle="卖家查看/编辑/下架自己的专利上架信息" />
        <Spacer />
        <AuditPendingCard title="资料已驳回" message="请重新提交资料，审核通过后才能继续。" actionText="重新提交" onAction={goOnboarding} />
      </View>
    );
  }
  if (access.state === 'audit-required') {
    return (
      <View className="container">
        <PageHeader title="我的专利上架" subtitle="卖家查看/编辑/下架自己的专利上架信息" />
        <Spacer />
        <AuditPendingCard title="需要认证" message="完成认证并审核通过后才能继续。" actionText="去认证" onAction={goOnboarding} />
      </View>
    );
  }

  return (
    <View className="container">
      <PageHeader title="我的专利上架" subtitle="卖家查看/编辑/下架自己的专利上架信息" />
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
          onChange={(v) => setStatus(v as ListingStatus | '')}
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
          发布新的专利上架
        </Button>
      </Surface>

      <View style={{ height: '16rpx' }} />

      {loading ? (
        <LoadingCard />
      ) : error ? (
        <ErrorCard message={error} onRetry={load} />
      ) : items.length ? (
        <View className="card-list">
          {items.map((it: Listing) => (
            <View key={it.id} className="list-card">
              <View className="list-card-thumb thumb-tone-teal">
                <Image className="list-card-thumb-img" src={iconShield} svg mode="aspectFit" />
              </View>
              <View className="list-card-body">
                <View className="list-card-head">
                  <View className="list-card-head-main">
                    <Text className="list-card-title clamp-2">{it.title || '未命名专利'}</Text>
                    <View className="list-card-tags">
                      <Text className="tag">{listingStatusLabel(it.status)}</Text>
                      <Text className={auditStatusTagClass(it.auditStatus)}>{auditStatusLabel(it.auditStatus)}</Text>
                      {it.applicationNoDisplay ? <Text className="tag">{it.applicationNoDisplay}</Text> : null}
                    </View>
                  </View>
                </View>
                <View className="list-card-actions">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      Taro.navigateTo({ url: `/pages/publish/patent/index?listingId=${it.id}` });
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
                        await apiPost<Listing>(
                          `/listings/${it.id}/off-shelf`,
                          { reason: '卖家下架' },
                          { idempotencyKey: `off-${it.id}` },
                        );
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
            </View>
          ))}
        </View>
      ) : (
        <EmptyCard message="暂无上架记录" actionText="刷新" onAction={load} />
      )}
    </View>
  );
}

