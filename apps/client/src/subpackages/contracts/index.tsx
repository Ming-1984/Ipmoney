import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './index.scss';

import { apiGet, apiPost } from '../../lib/api';
import { getToken } from '../../lib/auth';
import { API_BASE_URL } from '../../constants';
import { ensureApproved, usePageAccess } from '../../lib/guard';
import { formatTimeSmart } from '../../lib/format';
import { uploadWithRetry } from '../../lib/upload';
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

const TABS: { id: ContractStatus; label: string }[] = [
  { id: 'WAIT_UPLOAD', label: '待上传' },
  { id: 'WAIT_CONFIRM', label: '待确认' },
  { id: 'AVAILABLE', label: '可查阅' },
];

function contractStatusLabel(status: ContractStatus): string {
  if (status === 'WAIT_UPLOAD') return '待上传';
  if (status === 'WAIT_CONFIRM') return '待确认';
  return '可查阅';
}

function contractStatusClass(status: ContractStatus): string {
  if (status === 'WAIT_UPLOAD') return 'is-wait';
  if (status === 'WAIT_CONFIRM') return 'is-confirm';
  return 'is-available';
}

export default function ContractCenterPage() {
  const [activeTab, setActiveTab] = useState<ContractStatus>('WAIT_UPLOAD');

  const fetcher = useCallback(
    async ({ page, pageSize }: { page: number; pageSize: number }) =>
      apiGet<ContractListResponse>('/contracts', { status: activeTab, page, pageSize }),
    [activeTab],
  );

  const { items: rawItems, loading, error, refreshing, loadingMore, hasMore, reload, refresh, loadMore, reset } =
    usePagedList<ContractItem>(fetcher, {
      pageSize: 20,
      onError: (message, ctx) => {
        if (ctx === 'loadMore') toast(message);
      },
    });

  const access = usePageAccess('approved-required', (a) => {
    if (a.state === 'ok') return;
    reset();
  });

  useEffect(() => {
    if (access.state !== 'ok') return;
    void reload();
  }, [access.state, reload, activeTab]);

  const items = useMemo(() => rawItems.filter((it) => it.status === activeTab), [rawItems, activeTab]);

  const uploadContract = useCallback(async (item: ContractItem) => {
    if (!ensureApproved()) return;
    if (item.canUpload === false) {
      toast('仅卖家可上传合同');
      return;
    }

    const isWeapp = process.env.TARO_ENV === 'weapp';
    if (!isWeapp) {
      toast('请在小程序上传 PDF 合同');
      return;
    }

    let contractFileId: string | null = null;
    try {
      const res = await Taro.chooseMessageFile({
        count: 1,
        type: 'file',
        extension: ['pdf'],
      });
      const tempPath = String((res as any)?.tempFiles?.[0]?.path || '').trim();
      if (!tempPath) {
        toast('未选择文件');
        return;
      }

      const token = getToken();
      const uploadRes = await uploadWithRetry({
        url: `${API_BASE_URL}/files`,
        filePath: tempPath,
        name: 'file',
        formData: { purpose: 'CONTRACT_EVIDENCE' },
        header: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        retry: 1,
      });

      if (uploadRes.statusCode >= 200 && uploadRes.statusCode < 300) {
        const parsed = JSON.parse(String(uploadRes.data || '{}')) as any;
        if (parsed?.id && typeof parsed.id === 'string') contractFileId = parsed.id;
      }
    } catch (e: any) {
      const errMsg = String(e?.errMsg || '').toLowerCase();
      if (errMsg.includes('cancel')) return;
      // If upload isn't available, keep going with simulated upload.
      contractFileId = null;
    }

    if (!contractFileId) {
      toast('请先上传合同 PDF');
      return;
    }

    try {
      await apiPost<ContractItem>(
        `/contracts/${item.id}/upload`,
        { contractFileId },
        { idempotencyKey: `contract-${item.id}` },
      );
      toast('已提交合同', { icon: 'success' });
      void reload();
    } catch (e: any) {
      toast(e?.message || '上传失败');
    }
  }, []);

  const remindConfirm = useCallback((item: ContractItem) => {
    const url = item.fileUrl || '';
    if (!url) {
      toast('暂无合同链接，无法提醒');
      return;
    }
    Taro.setClipboardData({ data: url });
    toast('已复制合同链接，请发送给对方确认');
  }, []);

  const copyContractLink = useCallback((item: ContractItem) => {
    const url = item.fileUrl || '';
    if (!url) {
      toast('暂无可用合同链接');
      return;
    }
    Taro.setClipboardData({ data: url });
    toast('已复制合同链接', { icon: 'success' });
  }, []);

  return (
    <View className="container contracts-page">
      <PageHeader weapp title="合同中心" subtitle="合同上传、确认与查阅集中管理" />
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
        loading={loading}
        error={error}
        empty={!loading && !error && items.length === 0}
        emptyTitle="暂无合同"
        emptyMessage="当前分类下暂无合同记录"
        onRetry={reload}
      >
        <PullToRefresh type="primary" disabled={loading || refreshing} onRefresh={refresh}>
          <View className="contract-list">
            {items.map((item) => (
              <Surface key={item.id} className="contract-card" padding="none">
                <View className="row-between" style={{ gap: '12rpx' }}>
                  <Text className="text-card-title">合同 {item.id.slice(0, 8)}...</Text>
                  <Text className={`contract-status ${contractStatusClass(item.status)}`}>
                    {contractStatusLabel(item.status)}
                  </Text>
                </View>
                <View className="contract-meta">
                  {item.listingTitle ? <Text className="muted clamp-1">交易标的：{item.listingTitle}</Text> : null}
                  {item.counterpartName ? <Text className="muted">对方：{item.counterpartName}</Text> : null}
                  <Text className="muted">关联订单：{item.orderId.slice(0, 8)}...</Text>
                  <Text className="muted">合同时间：{formatTimeSmart(item.createdAt)}</Text>
                  {item.uploadedAt ? <Text className="muted">上传时间：{formatTimeSmart(item.uploadedAt)}</Text> : null}
                  {item.signedAt ? <Text className="muted">确认时间：{formatTimeSmart(item.signedAt)}</Text> : null}
                  <Text className="muted">水印：{item.watermarkOwner || '发布方'}</Text>
                </View>
                <View className="contract-actions">
                  <Button
                    size="small"
                    variant="ghost"
                    onClick={() => Taro.navigateTo({ url: `/subpackages/orders/detail/index?orderId=${item.orderId}` })}
                  >
                    订单详情
                  </Button>
                  {item.status === 'WAIT_UPLOAD' ? (
                    item.canUpload === false ? (
                      <Button size="small" variant="ghost" disabled>
                        等待卖家上传
                      </Button>
                    ) : (
                      <Button size="small" variant="primary" onClick={() => void uploadContract(item)}>
                        上传合同（PDF）
                      </Button>
                    )
                  ) : item.status === 'WAIT_CONFIRM' ? (
                    <>
                      <Button size="small" variant="ghost" onClick={() => copyContractLink(item)}>
                        查看合同
                      </Button>
                      <Button size="small" variant="primary" onClick={() => remindConfirm(item)}>
                        提醒对方确认
                      </Button>
                    </>
                  ) : (
                    <Button size="small" variant="primary" onClick={() => copyContractLink(item)}>
                      查看合同
                    </Button>
                  )}
                </View>
              </Surface>
            ))}
          </View>

          {!loading && items.length ? (
            <ListFooter loadingMore={loadingMore} hasMore={hasMore} onLoadMore={loadMore} showNoMore />
          ) : null}
        </PullToRefresh>
      </PageState>
    </View>
  );
}
