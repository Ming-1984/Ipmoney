import { Image, Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './index.scss';

import type { components } from '@ipmoney/api-types';

import { API_BASE_URL } from '../../constants';
import { getToken } from '../../lib/auth';
import { apiGet, apiPost } from '../../lib/api';
import { ensureApproved, usePageAccess } from '../../lib/guard';
import { useRouteStringParam, useRouteUuidParam } from '../../lib/routeParams';
import { usePagedList } from '../../lib/usePagedList';
import { uploadWithRetry } from '../../lib/upload';
import { CategoryControl } from '../../ui/filters';
import { ListFooter } from '../../ui/ListFooter';
import { AccessGate } from '../../ui/PageState';
import { PageHeader, Spacer, Surface, TipBanner } from '../../ui/layout';
import { Button, PullToRefresh, TextArea, confirm, toast } from '../../ui/nutui';
import { EmptyCard, ErrorCard, LoadingCard } from '../../ui/StateCards';
import iconUpload from '../../assets/icons/icon-image-gray.svg';

type Patent = components['schemas']['Patent'];
type PatentClaimRequest = components['schemas']['PatentClaimRequest'];
type PatentClaimStatus = components['schemas']['PatentClaimStatus'];
type PagedPatentClaimRequest = components['schemas']['PagedPatentClaimRequest'];
type FileObject = components['schemas']['FileObject'];
type PatentClaimCreateRequest = components['schemas']['PatentClaimCreateRequest'];

type UploadedEvidence = Pick<FileObject, 'id'> &
  Partial<Omit<FileObject, 'id'>> & {
    localPath?: string;
  };

type ClaimStatusFilter = '' | PatentClaimStatus;

const MAX_EVIDENCE_COUNT = 6;
const CLAIM_STATUS_OPTIONS: Array<{ value: ClaimStatusFilter; label: string }> = [
  { value: '', label: '全部' },
  { value: 'PENDING', label: '待审核' },
  { value: 'APPROVED', label: '已通过' },
  { value: 'REJECTED', label: '已驳回' },
];

function claimStatusLabel(status?: PatentClaimStatus): string {
  if (status === 'PENDING') return '待审核';
  if (status === 'APPROVED') return '已通过';
  if (status === 'REJECTED') return '已驳回';
  return '-';
}

function claimStatusClass(status?: PatentClaimStatus): string {
  if (status === 'APPROVED') return 'is-approved';
  if (status === 'REJECTED') return 'is-rejected';
  return 'is-pending';
}

function sourcePrimaryLabel(value?: Patent['sourcePrimary']): string {
  if (value === 'ADMIN') return '平台统一发布';
  if (value === 'PROVIDER') return '平台数据导入';
  if (value === 'USER') return '用户自发布';
  return '未知来源';
}

function isPlatformUnifiedPatent(patent?: Patent | null): boolean {
  if (!patent) return false;
  const source = String(patent.sourcePrimary || '').toUpperCase();
  return source === 'ADMIN' || source === 'PROVIDER';
}

function getClaimDisabledReason(patent?: Patent | null): string {
  if (!patent) return '专利信息加载中';
  if (patent.ownerUserId) return '该专利已归属个人，不支持认领';
  if (!isPlatformUnifiedPatent(patent)) return '仅平台统一发布的专利支持认领';
  return '';
}

export default function PatentClaimsPage() {
  const patentId = useRouteUuidParam('patentId') || '';
  const patentTitleFromRoute = useRouteStringParam('title') || '';
  const claimMode = Boolean(patentId);
  const loadedOnceRef = useRef(false);
  const statusFilterMountedRef = useRef(false);
  const access = usePageAccess('approved-required', (a) => {
    if (a.state !== 'ok') {
      loadedOnceRef.current = false;
      return;
    }
    if (loadedOnceRef.current) {
      void refresh();
    }
  });

  const [statusFilter, setStatusFilter] = useState<ClaimStatusFilter>('');
  const [claimReason, setClaimReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [evidenceFiles, setEvidenceFiles] = useState<UploadedEvidence[]>([]);
  const [patentLoading, setPatentLoading] = useState(claimMode);
  const [patentError, setPatentError] = useState<string | null>(null);
  const [patent, setPatent] = useState<Patent | null>(null);

  const fetcher = useCallback(
    async ({ page, pageSize }: { page: number; pageSize: number }) => {
      const queryPageSize = claimMode ? 100 : pageSize;
      const res = await apiGet<PagedPatentClaimRequest>('/me/patent-claims', {
        page,
        pageSize: queryPageSize,
        ...(statusFilter ? { status: statusFilter } : {}),
      });
      const filteredItems = claimMode ? res.items.filter((item) => item.patentId === patentId) : res.items;
      if (claimMode) {
        return {
          items: filteredItems,
          page: { page: 1, pageSize: queryPageSize, total: filteredItems.length },
        };
      }
      return {
        items: filteredItems,
        page: res.page,
      };
    },
    [claimMode, patentId, statusFilter],
  );

  const { items, loading, error, refreshing, loadingMore, hasMore, reload, refresh, loadMore } =
    usePagedList<PatentClaimRequest>(fetcher, {
      pageSize: 20,
      onError: (message, ctx) => {
        if (ctx === 'loadMore') toast(message);
      },
    });

  const loadPatent = useCallback(async () => {
    if (!claimMode) return;
    setPatentLoading(true);
    setPatentError(null);
    try {
      const data = await apiGet<Patent>(`/patents/${patentId}`);
      setPatent(data);
    } catch (e: any) {
      setPatent(null);
      setPatentError(e?.message || '专利信息加载失败');
    } finally {
      setPatentLoading(false);
    }
  }, [claimMode, patentId]);

  useEffect(() => {
    if (access.state !== 'ok') return;
    loadedOnceRef.current = true;
    void reload();
    if (claimMode) {
      void loadPatent();
    }
  }, [access.state, claimMode, loadPatent, reload]);

  useEffect(() => {
    if (access.state !== 'ok') return;
    if (!statusFilterMountedRef.current) {
      statusFilterMountedRef.current = true;
      return;
    }
    void reload();
  }, [access.state, reload, statusFilter]);

  const handleRefresh = useCallback(async () => {
    if (access.state !== 'ok') return;
    if (claimMode) {
      await Promise.all([refresh(), loadPatent()]);
      return;
    }
    await refresh();
  }, [access.state, claimMode, loadPatent, refresh]);

  const removeEvidence = useCallback(async (fileId: string) => {
    const ok = await confirm({
      title: '移除证明材料',
      content: '确定移除该材料？',
      confirmText: '移除',
      cancelText: '取消',
    });
    if (!ok) return;
    setEvidenceFiles((prev) => prev.filter((it) => it.id !== fileId));
  }, []);

  const uploadEvidence = useCallback(async () => {
    if (uploading) return;
    if (!ensureApproved()) return;
    if (evidenceFiles.length >= MAX_EVIDENCE_COUNT) {
      toast(`最多上传 ${MAX_EVIDENCE_COUNT} 份材料`);
      return;
    }
    setUploading(true);
    try {
      const remain = MAX_EVIDENCE_COUNT - evidenceFiles.length;
      const chosen = await Taro.chooseImage({
        count: Math.min(3, remain),
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
      });
      const paths = chosen?.tempFilePaths || [];
      if (!paths.length) return;
      const token = getToken();
      const uploaded: UploadedEvidence[] = [];
      for (const path of paths) {
        const uploadRes = await uploadWithRetry({
          url: `${API_BASE_URL}/files`,
          filePath: path,
          name: 'file',
          header: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          retry: 1,
        });
        const parsed = JSON.parse(String(uploadRes.data || '{}')) as Partial<FileObject>;
        if (!parsed.id) continue;
        uploaded.push({ ...(parsed as UploadedEvidence), localPath: path });
      }
      if (!uploaded.length) {
        toast('上传失败');
        return;
      }
      setEvidenceFiles((prev) => {
        const next = [...prev];
        for (const item of uploaded) {
          if (next.some((it) => it.id === item.id)) continue;
          next.push(item);
        }
        return next.slice(0, MAX_EVIDENCE_COUNT);
      });
      toast('材料已上传', { icon: 'success' });
    } catch (e: any) {
      if (e?.errMsg?.includes('cancel')) return;
      toast(e?.message || '上传失败');
    } finally {
      setUploading(false);
    }
  }, [evidenceFiles.length, uploading]);

  const pendingClaim = useMemo(
    () => items.find((item) => item.status === 'PENDING' && (!claimMode || item.patentId === patentId)),
    [claimMode, items, patentId],
  );
  const approvedClaim = useMemo(
    () => items.find((item) => item.status === 'APPROVED' && (!claimMode || item.patentId === patentId)),
    [claimMode, items, patentId],
  );

  const disabledReason = useMemo(() => {
    if (!claimMode) return '';
    const patentReason = getClaimDisabledReason(patent);
    if (patentReason) return patentReason;
    if (pendingClaim) return '你已提交认领申请，请等待审核';
    if (approvedClaim) return '该专利已完成你的认领，无需重复提交';
    return '';
  }, [approvedClaim, claimMode, patent, pendingClaim]);

  const submitClaim = useCallback(async () => {
    if (!claimMode) return;
    if (!ensureApproved()) return;
    if (disabledReason) {
      toast(disabledReason);
      return;
    }
    if (!evidenceFiles.length) {
      toast('请至少上传 1 份证明材料');
      return;
    }
    setSubmitting(true);
    try {
      const payload: PatentClaimCreateRequest = {
        patentId,
        evidenceFileIds: evidenceFiles.map((it) => it.id),
        ...(claimReason.trim() ? { claimReason: claimReason.trim() } : {}),
      };
      await apiPost<PatentClaimRequest>('/me/patent-claims', payload, {
        idempotencyKey: `patent-claim-${patentId}-${Date.now()}`,
      });
      toast('认领申请已提交', { icon: 'success' });
      setClaimReason('');
      setEvidenceFiles([]);
      await Promise.all([reload(), loadPatent()]);
    } catch (e: any) {
      toast(e?.message || '提交失败');
    } finally {
      setSubmitting(false);
    }
  }, [claimMode, claimReason, disabledReason, evidenceFiles, loadPatent, patentId, reload]);

  const title = claimMode ? '专利认领' : '专利认领记录';
  const subtitle = claimMode ? '上传权属证明并提交审核，审核通过后自动切换归属与咨询路由。' : '查看你的专利认领申请状态与审核意见。';
  const modeTitle = patent?.title || patentTitleFromRoute || patentId;
  const showInitialLoading = loading && items.length === 0;

  return (
    <PullToRefresh type="primary" disabled={refreshing} onRefresh={handleRefresh}>
      <View className="container patent-claims-page">
        <PageHeader title={title} subtitle={subtitle} />
        <Spacer />

        {access.state !== 'ok' ? (
          <AccessGate access={access} />
        ) : (
          <>
            {claimMode ? (
              <>
                {patentLoading ? <LoadingCard text="正在加载专利信息…" /> : null}
                {patentError ? <ErrorCard message={patentError} onRetry={() => void loadPatent()} /> : null}

                {patent ? (
                  <Surface className="claim-target-card">
                    <Text className="claim-target-title clamp-2">{modeTitle}</Text>
                    <View className="claim-target-meta">
                      <Text className="claim-target-pill">{sourcePrimaryLabel(patent.sourcePrimary)}</Text>
                      {patent.ownerUserId ? <Text className="claim-target-pill is-owner">已归属个人</Text> : null}
                    </View>
                    <Text className="claim-target-number">申请号：{patent.applicationNoDisplay || patent.applicationNoNorm || '-'}</Text>
                    {disabledReason ? <TipBanner tone="warning" title={disabledReason}>请在“我的-专利认领记录”查看历史申请。</TipBanner> : null}
                  </Surface>
                ) : null}

                <Spacer size={12} />

                <Surface className="claim-form-card">
                  <Text className="claim-form-title">提交认领申请</Text>
                  <Text className="claim-form-tip">需上传真实可核验的权属证明材料，平台将进行审核。</Text>

                  <View className="claim-form-block">
                    <Text className="claim-form-label">认领说明（可选）</Text>
                    <TextArea
                      value={claimReason}
                      onChange={setClaimReason}
                      rows={4}
                      maxLength={300}
                      placeholder="补充你与该专利的关系说明、授权链路等信息（选填）"
                    />
                  </View>

                  <View className="claim-form-block">
                    <View className="claim-evidence-head">
                      <Text className="claim-form-label">证明材料</Text>
                      <Text className="claim-evidence-count">
                        {evidenceFiles.length}/{MAX_EVIDENCE_COUNT}
                      </Text>
                    </View>
                    <View className="claim-upload-box" onClick={() => void uploadEvidence()}>
                      <Image className="claim-upload-icon" src={iconUpload} svg mode="aspectFit" />
                      <Text className="claim-upload-title">{uploading ? '上传中…' : '上传证明材料'}</Text>
                      <Text className="claim-upload-subtitle">支持图片，至少 1 份</Text>
                    </View>
                    {evidenceFiles.length ? (
                      <View className="claim-evidence-list">
                        {evidenceFiles.map((file, idx) => (
                          <View key={file.id} className="claim-evidence-item">
                            <View className="claim-evidence-main">
                              <Text className="claim-evidence-name">材料 {idx + 1}</Text>
                              <Text className="claim-evidence-desc">{file.fileName || file.mimeType || file.id}</Text>
                            </View>
                            <Text className="claim-evidence-remove" onClick={() => void removeEvidence(file.id)}>
                              删除
                            </Text>
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </View>

                  <Button
                    variant="primary"
                    loading={submitting}
                    disabled={submitting || uploading || Boolean(disabledReason)}
                    onClick={() => void submitClaim()}
                  >
                    提交认领申请
                  </Button>
                </Surface>

                <Spacer size={12} />
              </>
            ) : null}

            <Surface className="claim-filter-card" padding="sm">
              <CategoryControl value={statusFilter} options={CLAIM_STATUS_OPTIONS} onChange={setStatusFilter} />
            </Surface>

            <Spacer size={12} />

            {showInitialLoading ? (
              <LoadingCard text="正在加载认领记录…" />
            ) : error ? (
              <ErrorCard message={error} onRetry={() => void reload()} />
            ) : items.length ? (
              <View className="claim-list">
                {items.map((item) => (
                  <Surface key={item.id} className="claim-record-card">
                    <View className="claim-record-head">
                      <Text className="claim-record-id">认领单 #{item.id.slice(0, 8)}</Text>
                      <Text className={`claim-status ${claimStatusClass(item.status)}`}>{claimStatusLabel(item.status)}</Text>
                    </View>
                    <View className="claim-record-row">
                      <Text className="claim-record-label">专利ID</Text>
                      <Text className="claim-record-value">{item.patentId}</Text>
                    </View>
                    <View className="claim-record-row">
                      <Text className="claim-record-label">提交时间</Text>
                      <Text className="claim-record-value">{item.submittedAt?.slice(0, 19).replace('T', ' ') || '-'}</Text>
                    </View>
                    {item.claimReason ? (
                      <View className="claim-record-row">
                        <Text className="claim-record-label">认领说明</Text>
                        <Text className="claim-record-value">{item.claimReason}</Text>
                      </View>
                    ) : null}
                    {item.reviewComment ? (
                      <View className="claim-record-row">
                        <Text className="claim-record-label">审核意见</Text>
                        <Text className="claim-record-value">{item.reviewComment}</Text>
                      </View>
                    ) : null}
                    <View className="claim-record-foot">
                      <Text className="claim-record-evidence">材料数：{item.evidenceFileIds?.length || 0}</Text>
                      {!claimMode ? (
                        <Button
                          size="small"
                          variant="ghost"
                          block={false}
                          onClick={() =>
                            Taro.navigateTo({ url: `/subpackages/patent/detail/index?patentId=${encodeURIComponent(item.patentId)}` })
                          }
                        >
                          查看专利
                        </Button>
                      ) : null}
                    </View>
                  </Surface>
                ))}
              </View>
            ) : (
              <EmptyCard message={claimMode ? '暂无该专利的认领记录' : '暂无认领记录'} />
            )}

            {!claimMode && items.length ? (
              <ListFooter loadingMore={loadingMore} hasMore={hasMore} onLoadMore={() => void loadMore()} />
            ) : null}
          </>
        )}
      </View>
    </PullToRefresh>
  );
}
