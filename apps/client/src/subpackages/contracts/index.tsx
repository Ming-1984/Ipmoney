import { View, Text } from '@tarojs/components';
import Taro, { useDidHide, useDidShow } from '@tarojs/taro';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import './index.scss';

import { API_BASE_URL } from '../../constants';
import { apiGet, apiPost } from '../../lib/api';
import { getToken } from '../../lib/auth';
import { displayTitleOrFallback, normalizeDisplayText } from '../../lib/displayText';
import { formatTimeSmart } from '../../lib/format';
import { ensureApproved, usePageAccess } from '../../lib/guard';
import { chooseMessageFiles, uploadFileToApi } from '../../lib/upload';
import { usePagedList } from '../../lib/usePagedList';
import { PageState } from '../../ui/PageState';
import { ListFooter } from '../../ui/ListFooter';
import { PageHeader, Spacer, Surface } from '../../ui/layout';
import { Button, PullToRefresh, toast } from '../../ui/nutui';

type ContractStatus = 'WAIT_UPLOAD' | 'WAIT_CONFIRM' | 'AVAILABLE';

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
  copied: '\u5df2\u590d\u5236\u5408\u540c\u94fe\u63a5',
  copiedAndNotify: '\u5df2\u590d\u5236\u5408\u540c\u94fe\u63a5\uff0c\u8bf7\u53d1\u9001\u7ed9\u5bf9\u65b9\u786e\u8ba4',
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
  waitingSeller: '\u7b49\u5f85\u5356\u5bb6\u4e0a\u4f20',
  uploadPdf: '\u4e0a\u4f20\u5408\u540c PDF',
  viewContract: '\u67e5\u770b\u5408\u540c',
  remindConfirm: '\u63d0\u9192\u5bf9\u65b9\u786e\u8ba4',
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

export default function ContractCenterPage() {
  const loadedOnceRef = useRef(false);
  const tabKeyRef = useRef<ContractStatus>('WAIT_UPLOAD');
  const pageVisibleRef = useRef(true);
  const uploadSeqRef = useRef(0);
  const activeTabRef = useRef<ContractStatus>('WAIT_UPLOAD');
  const [activeTab, setActiveTab] = useState<ContractStatus>('WAIT_UPLOAD');
  const [uploadingContractId, setUploadingContractId] = useState('');

  useDidShow(() => {
    pageVisibleRef.current = true;
  });

  useDidHide(() => {
    pageVisibleRef.current = false;
    uploadSeqRef.current += 1;
    setUploadingContractId('');
  });

  const fetcher = useCallback(
    async ({ page, pageSize }: { page: number; pageSize: number }) =>
      apiGet<ContractListResponse>('/contracts', { status: activeTab, page, pageSize }),
    [activeTab],
  );

  const { items, loading, error, refreshing, loadingMore, hasMore, reload, refresh, loadMore, reset } =
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
    if (tabKeyRef.current === activeTab) return;
    tabKeyRef.current = activeTab;
    activeTabRef.current = activeTab;
    uploadSeqRef.current += 1;
    setUploadingContractId('');
    reset();
  }, [activeTab, reset]);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    if (access.state !== 'ok') return;
    loadedOnceRef.current = true;
    void reload();
  }, [access.state, activeTab, reload]);

  useEffect(() => {
    if (access.state === 'ok') return;
    uploadSeqRef.current += 1;
    setUploadingContractId('');
  }, [access.state]);

  const showInitialLoading = loading && items.length === 0;

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
        const res = await chooseMessageFiles({
          count: 1,
          type: 'file',
          extension: ['pdf'],
        });
        const tempPath = String(res[0]?.path || '').trim();
        if (!tempPath) {
          if (seq === uploadSeqRef.current && pageVisibleRef.current && activeTabRef.current === targetTab) {
            setUploadingContractId('');
          }
          toast(TEXT.noFile);
          return;
        }

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
        if (errMsg.includes('cancel')) return;
        toast(TEXT.uploadFailed);
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

  const copyContractLink = useCallback((item: ContractItem, successMessage: string) => {
    const url = String(item.fileUrl || '').trim();
    if (!url) {
      toast(TEXT.noLink);
      return;
    }
    Taro.setClipboardData({ data: url });
    toast(successMessage, { icon: 'success' });
  }, []);

  return (
    <View className="container contracts-page">
      <PageHeader weapp title={TEXT.title} subtitle={TEXT.subtitle} />
      <Spacer />

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
                <View className="row-between" style={{ gap: '12rpx' }}>
                  <Text className="text-card-title">{displayTitleOrFallback(contractCardTitle(item), TEXT.contractPrefix)}</Text>
                  <Text className={`contract-status ${contractStatusClass(item.status)}`}>{contractStatusLabel(item.status)}</Text>
                </View>

                <View className="contract-meta">
                  {normalizeDisplayText(item.listingTitle) ? <Text className="muted clamp-1">{TEXT.listingPrefix}{normalizeDisplayText(item.listingTitle)}</Text> : null}
                  {normalizeDisplayText(item.counterpartName) ? <Text className="muted">{TEXT.counterpartPrefix}{normalizeDisplayText(item.counterpartName)}</Text> : null}
                  <Text className="muted">{TEXT.orderPrefix}\u53ef\u5728\u8ba2\u5355\u8be6\u60c5\u4e2d\u67e5\u770b</Text>
                  <Text className="muted">{TEXT.createdPrefix}{formatTimeSmart(item.createdAt)}</Text>
                  {item.uploadedAt ? <Text className="muted">{TEXT.uploadedPrefix}{formatTimeSmart(item.uploadedAt)}</Text> : null}
                  {item.signedAt ? <Text className="muted">{TEXT.signedPrefix}{formatTimeSmart(item.signedAt)}</Text> : null}
                  <Text className="muted">{TEXT.watermarkPrefix}{item.watermarkOwner || TEXT.watermarkFallback}</Text>
                </View>

                <View className="contract-actions">
                  <Button
                    size="small"
                    variant="ghost"
                    onClick={() => Taro.navigateTo({ url: `/subpackages/orders/detail/index?orderId=${item.orderId}` })}
                  >
                    {TEXT.orderDetail}
                  </Button>

                  {item.status === 'WAIT_UPLOAD' ? (
                    item.canUpload === false ? (
                      <Button size="small" variant="ghost" disabled>
                        {TEXT.waitingSeller}
                      </Button>
                    ) : (
                      <Button size="small" variant="primary" onClick={() => void uploadContract(item)}>
                        {uploadingContractId === item.id ? '上传中…' : TEXT.uploadPdf}
                      </Button>
                    )
                  ) : item.status === 'WAIT_CONFIRM' ? (
                    <>
                      <Button
                        size="small"
                        variant="ghost"
                        onClick={() => copyContractLink(item, TEXT.copied)}
                      >
                        {TEXT.viewContract}
                      </Button>
                      <Button
                        size="small"
                        variant="primary"
                        onClick={() => copyContractLink(item, TEXT.copiedAndNotify)}
                      >
                        {TEXT.remindConfirm}
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="small"
                      variant="primary"
                      onClick={() => copyContractLink(item, TEXT.copied)}
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
