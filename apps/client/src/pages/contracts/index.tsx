import { View, Text } from '@tarojs/components';
import Taro, { usePullDownRefresh } from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './index.scss';

import { apiGet, apiPost } from '../../lib/api';
import { ensureApproved, usePageAccess } from '../../lib/guard';
import { formatTimeSmart } from '../../lib/format';
import { PageState } from '../../ui/PageState';
import { PageHeader, Spacer, Surface } from '../../ui/layout';
import { Button, toast } from '../../ui/nutui';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ContractListResponse | null>(null);

  const access = usePageAccess('approved-required', (a) => {
    if (a.state === 'ok') return;
    setLoading(false);
    setError(null);
    setData(null);
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<ContractListResponse>('/contracts', { status: activeTab, page: 1, pageSize: 20 });
      setData(res);
    } catch (e: any) {
      setError(e?.message || '加载失败');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    if (access.state !== 'ok') return;
    void load();
  }, [access.state, load, activeTab]);

  usePullDownRefresh(() => {
    if (access.state !== 'ok') {
      Taro.stopPullDownRefresh();
      return;
    }
    load().finally(() => Taro.stopPullDownRefresh());
  });

  const items = useMemo(() => {
    const list = data?.items || [];
    return list.filter((it) => it.status === activeTab);
  }, [data?.items, activeTab]);

  const uploadContract = useCallback(async (item: ContractItem) => {
    if (!ensureApproved()) return;
    try {
      const res = await apiPost<ContractItem>(`/contracts/${item.id}/upload`, {}, { idempotencyKey: `contract-${item.id}` });
      toast('已模拟上传合同', { icon: 'success' });
      setData((prev) => {
        if (!prev) return prev;
        return { ...prev, items: prev.items.map((it) => (it.id === item.id ? { ...it, ...res } : it)) };
      });
    } catch (e: any) {
      toast(e?.message || '上传失败');
    }
  }, []);

  const remindConfirm = useCallback(() => {
    toast('已提醒对方确认');
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
        onRetry={load}
      >
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
                  onClick={() => Taro.navigateTo({ url: `/pages/orders/detail/index?orderId=${item.orderId}` })}
                >
                  订单详情
                </Button>
                {item.status === 'WAIT_UPLOAD' ? (
                  <Button size="small" variant="primary" onClick={() => void uploadContract(item)}>
                    上传合同（模拟）
                  </Button>
                ) : item.status === 'WAIT_CONFIRM' ? (
                  <>
                    <Button size="small" variant="ghost" onClick={() => copyContractLink(item)}>
                      查看合同
                    </Button>
                    <Button size="small" variant="primary" onClick={remindConfirm}>
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
      </PageState>
    </View>
  );
}
