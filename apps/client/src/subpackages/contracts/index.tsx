import { useGlobalShareAppMessage } from '../../lib/wechatShare';
import { View, Text } from '@tarojs/components';
import Taro, { useDidHide, useDidShow, useUnload } from '@tarojs/taro';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import './index.scss';

import { API_BASE_URL } from '../../constants';
import { apiGet, apiPost } from '../../lib/api';
import { getToken } from '../../lib/auth';
import { refreshClientBadges } from '../../lib/clientBadges';
import { previewContractFile } from '../../lib/contractFiles';
import { displayTitleOrFallback, normalizeDisplayText } from '../../lib/displayText';
import { formatTimeSmart } from '../../lib/format';
import { ensureApproved, usePageAccess } from '../../lib/guard';
import { useRouteUuidParam } from '../../lib/routeParams';
import { chooseMessageFiles, uploadFileToApi } from '../../lib/upload';
import { usePagedList } from '../../lib/usePagedList';
import { PageState } from '../../ui/PageState';
import { ListFooter } from '../../ui/ListFooter';
import { PageHeader, Surface } from '../../ui/layout';
import { Button, PullToRefresh, toast } from '../../ui/nutui';

type ContractStatus = 'WAIT_UPLOAD' | 'WAIT_CONFIRM' | 'AVAILABLE';
type ContractSignedSubmissionStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'SUPERSEDED';

type ContractSignedSubmission = {
  id: string;
  status: ContractSignedSubmissionStatus;
  fileUrl?: string | null;
  fileName?: string | null;
  createdAt: string;
  reviewedAt?: string | null;
  rejectReason?: string | null;
};

type ContractItem = {
  id: string;
  orderId: string;
  listingTitle?: string | null;
  counterpartName?: string | null;
  status: ContractStatus;
  createdAt: string;
  uploadedAt?: string | null;
  signedAt?: string | null;
  fileUrl?: string | null;
  watermarkOwner?: string | null;
  canUpload?: boolean;
  latestSignedSubmission?: ContractSignedSubmission | null;
};

type ContractListResponse = {
  items: ContractItem[];
  page: { page: number; pageSize: number; total: number };
};

const TEXT = {
  title: '\u5408\u540c\u4e2d\u5fc3',
  subtitle: '\u7edf\u4e00\u67e5\u770b\u5408\u540c\u4e0a\u4f20\u3001\u786e\u8ba4\u4e0e\u67e5\u9605\u72b6\u6001',
  waitUploadTab: '\u5f85\u4e0a\u4f20',
  waitConfirmTab: '\u5f85\u786e\u8ba4',
  availableTab: '\u53ef\u67e5\u770b',
  waitUploadStatus: '\u5f85\u4e0a\u4f20',
  waitConfirmStatus: '\u5f85\u786e\u8ba4',
  availableStatus: '\u53ef\u67e5\u770b',
  emptyTitle: '\u6682\u65e0\u5408\u540c',
  emptyMessage: '\u5f53\u524d\u5206\u7c7b\u4e0b\u6682\u65e0\u5408\u540c\u8bb0\u5f55\u3002',
  sellerOnly: '\u4ec5\u5356\u5bb6\u53ef\u4e0a\u4f20\u5408\u540c',
  weappOnly: '\u8bf7\u5728\u5c0f\u7a0b\u5e8f\u4e2d\u4e0a\u4f20 PDF \u5408\u540c',
  noFile: '\u672a\u9009\u62e9\u6587\u4ef6',
  uploadFailed: '\u4e0a\u4f20\u5931\u8d25\uff0c\u8bf7\u91cd\u8bd5',
  uploadPdfFirst: '\u8bf7\u5148\u4e0a\u4f20\u5408\u540c PDF',
  uploadSuccess: '\u5df2\u63d0\u4ea4\u5408\u540c',
  noLink: '\u6682\u65e0\u53ef\u7528\u5408\u540c\u94fe\u63a5',
  previewFailed: '\u5408\u540c\u9884\u89c8\u5931\u8d25',
  signedSubmissionPending: '\u5df2\u56de\u4f20\uff0c\u5f85\u5e73\u53f0\u786e\u8ba4',
  signedSubmissionAccepted: '\u5df2\u786e\u8ba4',
  signedSubmissionRejected: '\u5df2\u9a73\u56de',
  signedSubmissionSuperseded: '\u5df2\u88ab\u66ff\u6362',
  uploadSignedContract: '\u4e0a\u4f20\u7b7e\u7f72\u7248\u5408\u540c',
  reuploadSignedContract: '\u91cd\u65b0\u4e0a\u4f20\u7b7e\u7f72\u7248',
  contractPrefix: '\u5408\u540c\u5f85\u786e\u8ba4',
  listingPrefix: '\u4ea4\u6613\u6807\u7684\uff1a',
  counterpartPrefix: '\u5bf9\u65b9\uff1a',
  orderPrefix: '\u5173\u8054\u8ba2\u5355\uff1a',
  createdPrefix: '\u521b\u5efa\u65f6\u95f4\uff1a',
  uploadedPrefix: '\u4e0a\u4f20\u65f6\u95f4\uff1a',
  signedPrefix: '\u786e\u8ba4\u65f6\u95f4\uff1a',
  watermarkPrefix: '\u6c34\u5370\u5f52\u5c5e\uff1a',
  watermarkFallback: '\u5e73\u53f0\u5904\u7406',
  orderDetail: '\u8ba2\u5355\u8be6\u60c5',
  focusedOrderTitle: '当前订单合同',
  waitingSeller: '\u7b49\u5f85\u5356\u5bb6\u4e0a\u4f20',
  uploadPdf: '\u4e0a\u4f20\u5408\u540c PDF',
  viewContract: '\u9884\u89c8\u5408\u540c',
} as const;

const TABS: Array<{ id: ContractStatus; label: string }> = [
  { id: 'WAIT_UPLOAD', label: TEXT.waitUploadTab },
  { id: 'WAIT_CONFIRM', label: TEXT.waitConfirmTab },
  { id: 'AVAILABLE', label: TEXT.availableTab },
];

function contractStatusLabel(status: ContractStatus): string {
  if (status === 'WAIT_UPLOAD') return TEXT.waitUploadStatus;
  if (status === 'WAIT_CONFIRM') return TEXT.waitConfirmStatus;
  return TEXT.availableStatus;
}

function contractStatusClass(status: ContractStatus): string {
  if (status === 'WAIT_UPLOAD') return 'is-wait';
  if (status === 'WAIT_CONFIRM') return 'is-confirm';
  return 'is-available';
}

function contractCardTitle(item: Pick<ContractItem, 'listingTitle' | 'counterpartName'>): string {
  const listingTitle = normalizeDisplayText(item.listingTitle);
  if (listingTitle) return listingTitle;
  const counterpartName = normalizeDisplayText(item.counterpartName);
  if (counterpartName) return `与${counterpartName}的合同`;
  return '待确认合同';
}

function signedSubmissionStatusLabel(status?: ContractSignedSubmissionStatus | null): string {
  if (status === 'ACCEPTED') return TEXT.signedSubmissionAccepted;
  if (status === 'REJECTED') return TEXT.signedSubmissionRejected;
  if (status === 'SUPERSEDED') return TEXT.signedSubmissionSuperseded;
  return TEXT.signedSubmissionPending;
}

function formatOrderNo(orderId?: string | null): string {
  const compact = String(orderId || '').replace(/-/g, '').trim().toUpperCase();
  return compact ? compact.slice(0, 8) : '待确认';
}

function ContractInfoRow(props: { label: string; value: React.ReactNode; valueClassName?: string; onClick?: () => void }) {
  return (
    <View className="contract-info-row" onClick={props.onClick}>
      <Text className="contract-info-label">{props.label}</Text>
      <View className={`contract-info-value ${props.valueClassName || ''}`}>{props.value}</View>
    </View>
  );
}

export default function ContractCenterPage() {
  useGlobalShareAppMessage();
  const loadedOnceRef = useRef(false);
  const listKeyRef = useRef('WAIT_UPLOAD:');
  const pageVisibleRef = useRef(true);
  const uploadPickerActiveRef = useRef(false);
  const uploadSeqRef = useRef(0);
  const activeTabRef = useRef<ContractStatus>('WAIT_UPLOAD');
  const focusOrderId = useRouteUuidParam('orderId');
  const [activeTab, setActiveTab] = useState<ContractStatus>('WAIT_UPLOAD');
  const [uploadingContractId, setUploadingContractId] = useState('');

  useDidShow(() => {
    pageVisibleRef.current = true;
    void refreshClientBadges();
  });

  useDidHide(() => {
    if (uploadPickerActiveRef.current) return;
    pageVisibleRef.current = false;
    uploadSeqRef.current += 1;
    setUploadingContractId('');
  });

  useUnload(() => {
    pageVisibleRef.current = false;
    uploadPickerActiveRef.current = false;
    uploadSeqRef.current += 1;
  });

  const fetcher = useCallback(
    async ({ page, pageSize }: { page: number; pageSize: number }) =>
      apiGet<ContractListResponse>(
        '/contracts',
        focusOrderId ? { orderId: focusOrderId, page, pageSize } : { status: activeTab, page, pageSize },
      ),
    [activeTab, focusOrderId],
  );

  const { items, setItems, loading, error, refreshing, loadingMore, hasMore, reload, refresh, loadMore, reset } =
    usePagedList<ContractItem>(fetcher, {
      pageSize: 20,
      onError: (message, ctx) => {
        if (ctx === 'loadMore') toast(message);
      },
    });

  const access = usePageAccess('approved-required', (next) => {
    if (next.state === 'ok') {
      if (loadedOnceRef.current) {
        void refresh();
      }
      return;
    }
    loadedOnceRef.current = false;
    reset();
  });

  useEffect(() => {
    const nextKey = `${activeTab}:${focusOrderId || ''}`;
    if (listKeyRef.current === nextKey) return;
    listKeyRef.current = nextKey;
    activeTabRef.current = activeTab;
    uploadSeqRef.current += 1;
    setUploadingContractId('');
    reset();
  }, [activeTab, focusOrderId, reset]);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    if (access.state !== 'ok') return;
    loadedOnceRef.current = true;
    void reload();
  }, [access.state, activeTab, focusOrderId, reload]);

  useEffect(() => {
    if (access.state === 'ok') return;
    uploadSeqRef.current += 1;
    setUploadingContractId('');
  }, [access.state]);

  const showInitialLoading = loading && items.length === 0;

  const renderSubmissionSummary = useCallback((submission?: ContractSignedSubmission | null) => {
    if (!submission) return '暂无回传';

    return (
      <View className="contract-signed-submission">
        <Text className={`contract-signed-submission-status is-${submission.status.toLowerCase()}`}>
          {signedSubmissionStatusLabel(submission.status)}
        </Text>
        <Text className="contract-signed-submission-time">{formatTimeSmart(submission.createdAt)}</Text>
        {submission.fileUrl ? (
          <Text className="contract-signed-submission-link" onClick={() => void previewContractFile(submission.fileUrl)}>
            预览
          </Text>
        ) : null}
        {submission.rejectReason ? <Text className="contract-signed-submission-reason">{submission.rejectReason}</Text> : null}
      </View>
    );
  }, []);

  const uploadContract = useCallback(
    async (item: ContractItem) => {
      if (!ensureApproved()) return;
      if (uploadingContractId) return;
      if (item.canUpload === false) {
        toast(TEXT.sellerOnly);
        return;
      }
      if (process.env.TARO_ENV !== 'weapp') {
        toast(TEXT.weappOnly);
        return;
      }

      let contractFileId = '';
      const targetTab = activeTabRef.current;
      const seq = ++uploadSeqRef.current;
      setUploadingContractId(item.id);
      try {
        uploadPickerActiveRef.current = true;
        const res = await chooseMessageFiles({
          count: 1,
          type: 'file',
          extension: ['pdf'],
        }).finally(() => {
          uploadPickerActiveRef.current = false;
        });
        const tempPath = String(res[0]?.path || '').trim();
        if (!tempPath) {
          if (seq === uploadSeqRef.current && pageVisibleRef.current && activeTabRef.current === targetTab) {
            setUploadingContractId('');
          }
          toast(TEXT.noFile);
          return;
        }

        pageVisibleRef.current = true;
        const token = getToken();
        const { data: parsed } = await uploadFileToApi<{ id?: string }>({
          url: `${API_BASE_URL}/files`,
          filePath: tempPath,
          name: 'file',
          formData: { purpose: 'CONTRACT_EVIDENCE' },
          header: token ? { Authorization: `Bearer ${token}` } : {},
          retry: 1,
        });
        contractFileId = String(parsed?.id || '').trim();
      } catch (e: any) {
        if (seq !== uploadSeqRef.current || !pageVisibleRef.current || activeTabRef.current !== targetTab) return;
        setUploadingContractId('');
        const errMsg = String(e?.errMsg || '').toLowerCase();
        if (errMsg.includes('cancel')) {
          toast(TEXT.noFile);
          return;
        }
        toast(e?.message || TEXT.uploadFailed);
        return;
      }

      if (!contractFileId) {
        if (seq !== uploadSeqRef.current || !pageVisibleRef.current || activeTabRef.current !== targetTab) return;
        setUploadingContractId('');
        toast(TEXT.uploadPdfFirst);
        return;
      }

      try {
        await apiPost<ContractItem>(
          `/contracts/${item.id}/upload`,
          { contractFileId },
          { idempotencyKey: `contract-${item.id}` },
        );
        if (seq !== uploadSeqRef.current || !pageVisibleRef.current || activeTabRef.current !== targetTab) return;
        toast(TEXT.uploadSuccess, { icon: 'success' });
        void refreshClientBadges();
        void reload();
      } catch (e: any) {
        if (seq !== uploadSeqRef.current || !pageVisibleRef.current || activeTabRef.current !== targetTab) return;
        toast(e?.message || TEXT.uploadFailed);
      } finally {
        if (seq === uploadSeqRef.current && pageVisibleRef.current && activeTabRef.current === targetTab) {
          setUploadingContractId('');
        }
      }
    },
    [reload, uploadingContractId],
  );

  const uploadSignedContract = useCallback(
    async (item: ContractItem) => {
      if (!ensureApproved()) return;
      if (uploadingContractId) return;
      if (process.env.TARO_ENV !== 'weapp') {
        toast(TEXT.weappOnly);
        return;
      }

      let signedFileId = '';
      const targetTab = activeTabRef.current;
      const seq = ++uploadSeqRef.current;
      setUploadingContractId(item.id);
      try {
        uploadPickerActiveRef.current = true;
        const res = await chooseMessageFiles({
          count: 1,
          type: 'file',
          extension: ['pdf'],
        }).finally(() => {
          uploadPickerActiveRef.current = false;
        });
        const tempPath = String(res[0]?.path || '').trim();
        if (!tempPath) {
          if (seq === uploadSeqRef.current && pageVisibleRef.current && activeTabRef.current === targetTab) {
            setUploadingContractId('');
          }
          toast(TEXT.noFile);
          return;
        }

        pageVisibleRef.current = true;
        const token = getToken();
        const { data: parsed } = await uploadFileToApi<{ id?: string }>({
          url: `${API_BASE_URL}/files`,
          filePath: tempPath,
          name: 'file',
          formData: { purpose: 'CONTRACT_EVIDENCE' },
          header: token ? { Authorization: `Bearer ${token}` } : {},
          retry: 1,
        });
        signedFileId = String(parsed?.id || '').trim();
      } catch (e: any) {
        if (seq !== uploadSeqRef.current || !pageVisibleRef.current || activeTabRef.current !== targetTab) return;
        setUploadingContractId('');
        const errMsg = String(e?.errMsg || '').toLowerCase();
        if (errMsg.includes('cancel')) {
          toast(TEXT.noFile);
          return;
        }
        toast(e?.message || TEXT.uploadFailed);
        return;
      }

      if (!signedFileId) {
        if (seq !== uploadSeqRef.current || !pageVisibleRef.current || activeTabRef.current !== targetTab) return;
        setUploadingContractId('');
        toast(TEXT.uploadPdfFirst);
        return;
      }

      try {
        const submission = await apiPost<ContractSignedSubmission>(
          `/contracts/${item.id}/signed-submissions`,
          { fileId: signedFileId },
          { idempotencyKey: `contract-signed-${item.id}-${signedFileId}` },
        );
        if (seq !== uploadSeqRef.current || !pageVisibleRef.current || activeTabRef.current !== targetTab) return;
        setUploadingContractId('');
        toast(TEXT.uploadSuccess, { icon: 'success' });
        setItems((prev) => prev.map((row) => (row.id === item.id ? { ...row, latestSignedSubmission: submission } : row)));
        void refreshClientBadges();
        void reload();
      } catch (e: any) {
        if (seq !== uploadSeqRef.current || !pageVisibleRef.current || activeTabRef.current !== targetTab) return;
        toast(e?.message || TEXT.uploadFailed);
      } finally {
        if (seq === uploadSeqRef.current && pageVisibleRef.current && activeTabRef.current === targetTab) {
          setUploadingContractId('');
        }
      }
    },
    [reload, setItems, uploadingContractId],
  );

  const navigateToOrderDetail = useCallback((orderId: string) => {
    Taro.navigateTo({ url: `/subpackages/orders/detail/index?orderId=${orderId}` });
  }, []);

  return (
    <View className="container contracts-page">
      <PageHeader weapp title={TEXT.title} subtitle={TEXT.subtitle} />

      {focusOrderId ? (
        <View className="contract-focus-banner">
          <Text className="contract-focus-title">{TEXT.focusedOrderTitle}</Text>
          <Text className="contract-focus-order">{formatOrderNo(focusOrderId)}</Text>
        </View>
      ) : (
        <View className="contract-tabs">
          {TABS.map((tab) => (
            <View
              key={tab.id}
              className={`contract-tab ${activeTab === tab.id ? 'is-active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Text>{tab.label}</Text>
              {activeTab === tab.id ? <View className="contract-tab-underline" /> : null}
            </View>
          ))}
        </View>
      )}

      <PageState
        access={access}
        loading={showInitialLoading}
        error={error}
        empty={!showInitialLoading && !error && items.length === 0}
        emptyTitle={TEXT.emptyTitle}
        emptyMessage={TEXT.emptyMessage}
        onRetry={reload}
      >
        <PullToRefresh type="primary" disabled={showInitialLoading || refreshing} onRefresh={refresh}>
          <View className="contract-list">
            {items.map((item) => (
              <Surface key={item.id} className="contract-card" padding="none">
                <View className="contract-card-head">
                  <View className="contract-title-wrap">
                    <View className="contract-title-mark" />
                    <Text className="contract-title clamp-1">{displayTitleOrFallback(contractCardTitle(item), TEXT.contractPrefix)}</Text>
                  </View>
                  <Text className={`contract-status ${contractStatusClass(item.status)}`}>{contractStatusLabel(item.status)}</Text>
                </View>

                <View className="contract-card-body">
                  <ContractInfoRow label="对方" value={normalizeDisplayText(item.counterpartName) || '待确认'} />
                  <ContractInfoRow
                    label="关联订单"
                    value={formatOrderNo(item.orderId)}
                    valueClassName="contract-order-link"
                    onClick={() => navigateToOrderDetail(item.orderId)}
                  />
                  <ContractInfoRow label="创建时间" value={formatTimeSmart(item.createdAt)} />
                  <ContractInfoRow label="水印归属" value={item.watermarkOwner || TEXT.watermarkFallback} />
                  {item.uploadedAt ? <ContractInfoRow label="上传时间" value={formatTimeSmart(item.uploadedAt)} /> : null}
                  {item.signedAt ? <ContractInfoRow label="确认时间" value={formatTimeSmart(item.signedAt)} /> : null}
                  {item.latestSignedSubmission ? (
                    <ContractInfoRow
                      label="回传签署版"
                      value={renderSubmissionSummary(item.latestSignedSubmission)}
                    />
                  ) : null}
                </View>

                <View className="contract-actions">
                  <Button
                    className="contract-action-btn contract-action-btn-outline"
                    size="small"
                    variant="ghost"
                    onClick={() => navigateToOrderDetail(item.orderId)}
                  >
                    {TEXT.orderDetail}
                  </Button>

                  {item.status === 'WAIT_UPLOAD' ? (
                    item.canUpload === false ? (
                      <Button className="contract-action-btn contract-action-btn-primary" size="small" variant="primary" disabled>
                        {TEXT.waitingSeller}
                      </Button>
                    ) : (
                      <Button className="contract-action-btn contract-action-btn-primary" size="small" variant="primary" onClick={() => void uploadContract(item)}>
                        {uploadingContractId === item.id ? '上传中…' : TEXT.uploadPdf}
                      </Button>
                    )
                  ) : item.status === 'WAIT_CONFIRM' ? (
                    <>
                      <Button
                        className="contract-action-btn contract-action-btn-outline"
                        size="small"
                        variant="ghost"
                        onClick={() => void previewContractFile(item.fileUrl)}
                      >
                        {TEXT.viewContract}
                      </Button>
                      <Button
                        className="contract-action-btn contract-action-btn-primary"
                        size="small"
                        variant="primary"
                        onClick={() => void uploadSignedContract(item)}
                      >
                        {item.latestSignedSubmission ? TEXT.reuploadSignedContract : TEXT.uploadSignedContract}
                      </Button>
                    </>
                  ) : (
                    <Button
                      className="contract-action-btn contract-action-btn-primary"
                      size="small"
                      variant="primary"
                      onClick={() => void previewContractFile(item.fileUrl)}
                    >
                      {TEXT.viewContract}
                    </Button>
                  )}
                </View>
              </Surface>
            ))}
          </View>

          {!showInitialLoading && items.length ? (
            <ListFooter loadingMore={loadingMore} hasMore={hasMore} onLoadMore={loadMore} showNoMore />
          ) : null}
        </PullToRefresh>
      </PageState>
    </View>
  );
}
