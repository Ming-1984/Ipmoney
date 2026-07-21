import { View, Text, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import './index.scss';

import type { components } from '@ipmoney/api-types';

import { apiGet, apiPost } from '../../lib/api';
import { displayTitleOrFallback, displayTitleWithSecondary, normalizeDisplayText } from '../../lib/displayText';
import { usePagedList } from '../../lib/usePagedList';
import { ensureApproved, goLogin, goOnboarding, usePageAccess } from '../../lib/guard';
import { auditStatusLabel, auditStatusTagClass, contentStatusLabel, listingStatusLabel } from '../../lib/labels';
import { safeOpenPage } from '../../lib/navigation';
import { useRouteStringParam } from '../../lib/routeParams';
import { ListFooter } from '../../ui/ListFooter';
import { Button, PullToRefresh, confirm, toast } from '../../ui/nutui';
import { AuditPendingCard, EmptyCard, ErrorCard, LoadingCard, PermissionCard } from '../../ui/StateCards';
import { PageHeader, Spacer, Surface } from '../../ui/layout';
import iconAchievement from '../../assets/icons/app/patent-achievement.png';
import iconShield from '../../assets/icons/icon-shield-orange.svg';

type PagedListing = components['schemas']['PagedListing'];
type Listing = components['schemas']['Listing'];
type PagedAchievement = components['schemas']['PagedAchievementSummary'];
type Achievement = components['schemas']['AchievementSummary'];
type PagedMaintenanceSchedule = components['schemas']['PagedMyPatentMaintenanceSchedule'];
type MaintenanceSchedule = components['schemas']['MyPatentMaintenanceSchedule'];
type ListingDraftItem = Listing & { draftType?: 'listing' };
type AchievementDraftItem = Achievement & { draftType: 'achievement' };
type DraftListItem = ListingDraftItem | AchievementDraftItem;
type ListingStatus = components['schemas']['ListingStatus'];
type AuditStatus = components['schemas']['AuditStatus'];
type FilterOption<T extends string> = {
  label: string;
  value: T;
};

async function openPage(url: string) {
  await safeOpenPage(url);
}

function FilterTabs<T extends string>(props: { value: T; options: FilterOption<T>[]; onChange: (value: T) => void }) {
  return (
    <View className="my-listings-filter-tabs">
      {props.options.map((option) => {
        const active = option.value === props.value;
        return (
          <View
            key={option.value || '__all'}
            className={`my-listings-filter-tab ${active ? 'is-active' : ''}`}
            onClick={() => props.onChange(option.value)}
          >
            <Text className="my-listings-filter-tab-text">{option.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

function listingCardStatusLabel(status: ListingStatus, auditStatus: AuditStatus): string {
  if (status === 'DRAFT') return listingStatusLabel(status);
  if (auditStatus !== 'APPROVED') return auditStatusLabel(auditStatus);
  return listingStatusLabel(status);
}

function listingCardStatusClass(status: ListingStatus, auditStatus: AuditStatus): string {
  if (status === 'DRAFT') return 'tag';
  if (auditStatus !== 'APPROVED') return auditStatusTagClass(auditStatus);
  return status === 'ACTIVE' ? 'tag tag-success' : 'tag';
}

export default function MyListingsPage() {
  const routeStatus = useRouteStringParam('status');
  const routeMixed = useRouteStringParam('mixed');
  const isDraftCenter = routeStatus?.toUpperCase() === 'DRAFT';
  const isMixedDraftCenter = isDraftCenter && routeMixed === '1';
  const loadedOnceRef = useRef(false);
  const filterKeyRef = useRef('');
  const maintenanceLoadSeqRef = useRef(0);
  const [status, setStatus] = useState<ListingStatus | ''>(() => (isDraftCenter ? 'DRAFT' : ''));
  const [auditStatusFilter, setAuditStatusFilter] = useState<AuditStatus | ''>('');
  const [maintenancePatentIds, setMaintenancePatentIds] = useState<Set<string>>(() => new Set());
  const [maintenanceApplicationNos, setMaintenanceApplicationNos] = useState<Set<string>>(() => new Set());
  const effectiveStatus = isDraftCenter ? 'DRAFT' : status;
  const effectiveAuditStatusFilter = isDraftCenter ? '' : auditStatusFilter;

  const fetcher = useCallback(
    async ({ page, pageSize }: { page: number; pageSize: number }) => {
      if (isMixedDraftCenter) {
        const [listings, achievements] = await Promise.all([
          apiGet<PagedListing>('/listings', { status: 'DRAFT', page, pageSize }),
          apiGet<PagedAchievement>('/achievements', { status: 'DRAFT', page, pageSize }),
        ]);
        const listingItems: DraftListItem[] = (listings.items || []).map((item) => ({ ...item, draftType: 'listing' }));
        const achievementItems: DraftListItem[] = (achievements.items || []).map((item) => ({ ...item, draftType: 'achievement' }));
        const items = [...listingItems, ...achievementItems].sort((a, b) => {
          const bTime = Date.parse(('updatedAt' in b ? b.updatedAt : '') || b.createdAt || '') || 0;
          const aTime = Date.parse(('updatedAt' in a ? a.updatedAt : '') || a.createdAt || '') || 0;
          return bTime - aTime;
        });
        return {
          items,
          page: {
            page,
            pageSize,
            total: Number(listings.page?.total || 0) + Number(achievements.page?.total || 0),
          },
        };
      }

      const result = await apiGet<PagedListing>('/listings', {
        page,
        pageSize,
        ...(effectiveStatus ? { status: effectiveStatus } : {}),
        ...(!isDraftCenter && !effectiveStatus ? { excludeStatus: 'DRAFT' } : {}),
        ...(effectiveAuditStatusFilter ? { auditStatus: effectiveAuditStatusFilter } : {}),
      });
      if (isDraftCenter) return result;
      return {
        ...result,
        items: (result.items || []).filter((item) => {
          if (item.status === 'DRAFT') return false;
          if (effectiveStatus && item.status !== effectiveStatus) return false;
          if (effectiveAuditStatusFilter && item.auditStatus !== effectiveAuditStatusFilter) return false;
          return true;
        }),
      };
    },
    [effectiveAuditStatusFilter, effectiveStatus, isDraftCenter, isMixedDraftCenter],
  );

  const { items, loading, error, refreshing, loadingMore, hasMore, reload, refresh, loadMore, reset } =
    usePagedList<DraftListItem>(fetcher, {
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
    const nextKey = `${effectiveStatus}:${effectiveAuditStatusFilter}`;
    if (filterKeyRef.current === nextKey) return;
    filterKeyRef.current = nextKey;
    reset();
  }, [effectiveAuditStatusFilter, effectiveStatus, reset]);

  useEffect(() => {
    if (access.state !== 'ok') return;
    loadedOnceRef.current = true;
    void reload();
  }, [access.state, effectiveAuditStatusFilter, effectiveStatus, reload]);

  const loadMaintenanceIndex = useCallback(async () => {
    const requestSeq = ++maintenanceLoadSeqRef.current;
    if (access.state !== 'ok' || isDraftCenter) {
      setMaintenancePatentIds(new Set());
      setMaintenanceApplicationNos(new Set());
      return;
    }
    try {
      const patentIds = new Set<string>();
      const applicationNos = new Set<string>();
      const pageSize = 50;
      let page = 1;
      let hasMore = true;
      while (hasMore) {
        const result = await apiGet<PagedMaintenanceSchedule>('/me/patent-maintenance/schedules', { page, pageSize });
        if (requestSeq !== maintenanceLoadSeqRef.current) return;
        const schedules = Array.isArray(result.items) ? result.items : [];
        schedules.forEach((schedule: MaintenanceSchedule) => {
          if (schedule.patentId) patentIds.add(schedule.patentId);
          const applicationNo = normalizeDisplayText(schedule.applicationNoDisplay);
          if (applicationNo) applicationNos.add(applicationNo);
        });
        const total = Number(result.page?.total || schedules.length);
        hasMore = page * pageSize < total && schedules.length > 0;
        page += 1;
      }
      if (requestSeq !== maintenanceLoadSeqRef.current) return;
      setMaintenancePatentIds(patentIds);
      setMaintenanceApplicationNos(applicationNos);
    } catch (error) {
      if (requestSeq !== maintenanceLoadSeqRef.current) return;
      console.warn('[my-listings] load maintenance index failed', error);
      setMaintenancePatentIds(new Set());
      setMaintenanceApplicationNos(new Set());
    }
  }, [access.state, isDraftCenter]);

  useEffect(() => {
    void loadMaintenanceIndex();
  }, [loadMaintenanceIndex]);

  const showInitialLoading = loading && items.length === 0;

  const goCreate = useCallback(() => {
    if (!ensureApproved()) return;
    void openPage('/subpackages/publish/patent/index');
  }, []);

  const goDraftBox = useCallback(() => {
    if (!ensureApproved()) return;
    void openPage('/subpackages/my-listings/index?status=DRAFT&mixed=1');
  }, []);

  const handleAuditStatusChange = useCallback((value: string) => {
    const next = value as AuditStatus | '';
    setAuditStatusFilter(next);
    if (next && next !== 'APPROVED') {
      setStatus('');
    }
  }, []);

  const handleListingStatusChange = useCallback((value: string) => {
    const next = value as ListingStatus | '';
    setStatus(next);
    if (next) {
      setAuditStatusFilter('APPROVED');
    }
  }, []);

  const goMaintenance = useCallback((listing: Listing) => {
    if (!ensureApproved()) return;
    if (listing.patentId && maintenancePatentIds.has(listing.patentId)) {
      void openPage(`/subpackages/maintenance/index?tab=schedules&patentId=${encodeURIComponent(listing.patentId)}`);
      return;
    }
    const applicationNo = normalizeDisplayText(listing.applicationNoDisplay);
    if (applicationNo && maintenanceApplicationNos.has(applicationNo)) {
      void openPage('/subpackages/maintenance/index?tab=schedules');
      return;
    }
    const params = [
      `listingId=${encodeURIComponent(listing.id)}`,
      `title=${encodeURIComponent(displayTitleOrFallback(listing.title, '专利信息待确认'))}`,
      applicationNo ? `applicationNo=${encodeURIComponent(applicationNo)}` : '',
    ].filter(Boolean);
    void openPage(`/subpackages/maintenance-apply/index?${params.join('&')}`);
  }, [maintenanceApplicationNos, maintenancePatentIds]);

  const handleOffShelf = useCallback(
    async (listing: Listing) => {
      const ok = await confirm({
        title: '确认取消展示',
        content: '取消公开后该专利将不再提供公开查询，确认继续吗？',
        confirmText: '确认取消',
        cancelText: '取消',
      });
      if (!ok) return;
      try {
        await apiPost<Listing>(
          `/listings/${listing.id}/off-shelf`,
          { reason: '权利方取消展示', confirmOffShelf: true },
          { idempotencyKey: `off-${listing.id}` },
        );
        toast('已取消展示', { icon: 'success' });
        void reload();
      } catch (e: any) {
        toast(e?.message || '操作失败');
      }
    },
    [reload],
  );
  const pageTitle = isDraftCenter ? '草稿箱' : '我的专利';
  const pageSubtitle = isMixedDraftCenter
    ? '集中查看未提交的专利信息和专利成果草稿'
    : isDraftCenter
      ? '仅展示未提交的专利信息草稿'
      : '查看、编辑、取消展示自己提交的专利信息';
  const showListingStatusFilter = !auditStatusFilter || auditStatusFilter === 'APPROVED';
  const isFilteredEmpty = !isDraftCenter && Boolean(status || auditStatusFilter);
  const emptyMessage = isDraftCenter
    ? '暂无草稿'
    : isFilteredEmpty
      ? '暂无符合条件的专利'
      : '暂无展示记录';

  if (access.state === 'need-login') {
    return (
      <View className="container my-listings-page">
        <PageHeader title={pageTitle} subtitle={pageSubtitle} />
        <Spacer />
        <PermissionCard title="需要登录" message="登录后才能查看专利信息。" actionText="去登录" onAction={goLogin} />
      </View>
    );
  }
  if (access.state === 'need-onboarding') {
    return (
      <View className="container my-listings-page">
        <PageHeader title={pageTitle} subtitle={pageSubtitle} />
        <Spacer />
        <PermissionCard title="需要选择身份" message="完成身份选择后才能继续。" actionText="去选择" onAction={goOnboarding} />
      </View>
    );
  }
  if (access.state === 'audit-pending') {
    return (
      <View className="container my-listings-page">
        <PageHeader title={pageTitle} subtitle={pageSubtitle} />
        <Spacer />
        <AuditPendingCard title="资料审核中" message="审核通过后才能提交与管理专利信息。" actionText="查看进度" onAction={goOnboarding} />
      </View>
    );
  }
  if (access.state === 'audit-rejected') {
    return (
      <View className="container my-listings-page">
        <PageHeader title={pageTitle} subtitle={pageSubtitle} />
        <Spacer />
        <AuditPendingCard title="资料已驳回" message="请重新提交资料，审核通过后才能继续。" actionText="重新提交" onAction={goOnboarding} />
      </View>
    );
  }
  if (access.state === 'audit-required') {
    return (
      <View className="container my-listings-page">
        <PageHeader title={pageTitle} subtitle={pageSubtitle} />
        <Spacer />
        <AuditPendingCard title="需要认证" message="完成认证并审核通过后才能继续。" actionText="去认证" onAction={goOnboarding} />
      </View>
    );
  }

  return (
    <View className="container my-listings-page">
      <PageHeader title={pageTitle} subtitle={pageSubtitle} />
      <Spacer />

      {!isDraftCenter ? (
        <>
          <Surface className="my-listings-filter-card">
            <Text className="text-strong">审核筛选</Text>
            <View style={{ height: '10rpx' }} />
            <FilterTabs
              value={auditStatusFilter}
              options={[
                { label: '全部', value: '' },
                { label: '审核中', value: 'PENDING' },
                { label: '已通过', value: 'APPROVED' },
                { label: '已驳回', value: 'REJECTED' },
              ]}
              onChange={handleAuditStatusChange}
            />
            {showListingStatusFilter ? (
              <>
                <View style={{ height: '14rpx' }} />
                <Text className="text-strong">展示状态</Text>
                <View style={{ height: '10rpx' }} />
                <FilterTabs
                  value={status}
                  options={[
                    { label: '全部', value: '' },
                    { label: '展示中', value: 'ACTIVE' },
                    { label: '已取消', value: 'OFF_SHELF' },
                    { label: '成交', value: 'SOLD' },
                  ]}
                  onChange={handleListingStatusChange}
                />
              </>
            ) : null}
            <View style={{ height: '12rpx' }} />
            <View className="my-listings-actions">
              <Button variant="primary" onClick={goCreate}>
                提交新的专利信息
              </Button>
              <Button variant="ghost" onClick={goDraftBox}>
                草稿箱
              </Button>
            </View>
          </Surface>

          <View style={{ height: '16rpx' }} />
        </>
      ) : null}

      <PullToRefresh type="primary" disabled={showInitialLoading || refreshing} onRefresh={refresh}>
        {showInitialLoading ? (
          <LoadingCard />
        ) : error ? (
          <ErrorCard message={error} onRetry={reload} />
        ) : items.length ? (
          <View className={isMixedDraftCenter ? 'draft-card-grid' : 'card-list'}>
            {items.map((it: DraftListItem) => {
              const isAchievementDraft = it.draftType === 'achievement';
              const title = isAchievementDraft
                ? displayTitleOrFallback(it.title, '成果标题待确认')
                : displayTitleWithSecondary(it.title, '专利信息待确认', {
                    secondary: it.applicationNoDisplay,
                    secondaryPrefix: '专利申请号 ',
                  });
              const listingApplicationNo = !isAchievementDraft ? normalizeDisplayText(it.applicationNoDisplay) : '';
              const hasMaintenanceRecord =
                !isAchievementDraft &&
                ((it.patentId && maintenancePatentIds.has(it.patentId)) ||
                  (listingApplicationNo && maintenanceApplicationNos.has(listingApplicationNo)));
              const editUrl = isAchievementDraft
                ? `/subpackages/publish/achievement/index?achievementId=${it.id}`
                : `/subpackages/publish/patent/index?listingId=${it.id}`;
              if (isMixedDraftCenter) {
                return (
                  <View key={`${isAchievementDraft ? 'achievement' : 'listing'}-${it.id}`} className="draft-card">
                    <View className="draft-card-main">
                      <View className="draft-card-icon">
                        <Image className="draft-card-icon-img" src={isAchievementDraft ? iconAchievement : iconShield} svg={!isAchievementDraft} mode="aspectFit" />
                      </View>
                      <View className="draft-card-content">
                        <Text className="draft-card-title clamp-2">{title}</Text>
                        <View className="draft-card-tags">
                          <Text className="draft-card-tag">草稿</Text>
                          <Text className="draft-card-tag">{isAchievementDraft ? '专利成果' : '专利信息'}</Text>
                        </View>
                      </View>
                    </View>
                    <View
                      className="draft-card-action"
                      hoverClass="draft-card-action-hover"
                      onClick={() => {
                        void openPage(editUrl);
                      }}
                    >
                      继续编辑
                    </View>
                  </View>
                );
              }
              return (
              <View key={it.id} className="list-card">
                <View className="list-card-thumb thumb-tone-teal">
                  <Image className="list-card-thumb-img" src={isAchievementDraft ? iconAchievement : iconShield} svg={!isAchievementDraft} mode="aspectFit" />
                </View>
                <View className="list-card-body">
                  <View className="list-card-head">
                    <View className="list-card-head-main">
                      <Text className="list-card-title clamp-2">{title}</Text>
                      <View className="list-card-tags">
                        <Text className={isAchievementDraft ? 'tag' : listingCardStatusClass(it.status, it.auditStatus)}>
                          {isAchievementDraft ? contentStatusLabel(it.status) : listingCardStatusLabel(it.status, it.auditStatus)}
                        </Text>
                        {isMixedDraftCenter ? <Text className="tag">{isAchievementDraft ? '专利成果' : '专利信息'}</Text> : null}
                        {!isDraftCenter && !isAchievementDraft && it.auditStatus === 'APPROVED' ? (
                          <Text className={auditStatusTagClass(it.auditStatus)}>{auditStatusLabel(it.auditStatus)}</Text>
                        ) : null}
                        {!isAchievementDraft && normalizeDisplayText(it.applicationNoDisplay) ? (
                          <Text className="tag">{normalizeDisplayText(it.applicationNoDisplay)}</Text>
                        ) : null}
                      </View>
                    </View>
                  </View>
                  <View className="list-card-actions">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        void openPage(editUrl);
                      }}
                    >
                      {isDraftCenter ? '继续编辑' : '编辑/查看'}
                    </Button>
                    {!isDraftCenter && !isAchievementDraft ? (
                      <>
                        <Button
                          className="my-listings-maintenance-button"
                          variant={hasMaintenanceRecord ? 'ghost' : it.auditStatus === 'APPROVED' ? 'primary' : 'ghost'}
                          disabled={it.auditStatus !== 'APPROVED'}
                          onClick={() => goMaintenance(it)}
                        >
                          {hasMaintenanceRecord ? '查看年费' : '代缴年费'}
                        </Button>
                        <Button
                          className="my-listings-off-shelf-button"
                          variant="ghost"
                          disabled={it.status !== 'ACTIVE' || it.auditStatus !== 'APPROVED'}
                          onClick={() => void handleOffShelf(it)}
                        >
                          取消展示
                        </Button>
                      </>
                    ) : null}
                  </View>
                </View>
              </View>
              );
            })}
          </View>
        ) : (
          <EmptyCard message={emptyMessage} actionText={isFilteredEmpty ? undefined : '刷新'} onAction={isFilteredEmpty ? undefined : reload} />
        )}

        {!showInitialLoading && items.length ? (
          <ListFooter loadingMore={loadingMore} hasMore={hasMore} onLoadMore={loadMore} showNoMore />
        ) : null}
      </PullToRefresh>
    </View>
  );
}
