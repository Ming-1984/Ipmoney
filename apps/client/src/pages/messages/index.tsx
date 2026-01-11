import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { getToken } from '../../lib/auth';
import { apiGet } from '../../lib/api';
import { EmptyCard, ErrorCard, LoadingCard } from '../../ui/StateCards';

type UserBrief = { id: string; nickname?: string; avatarUrl?: string };
type ConversationSummary = {
  id: string;
  listingId: string;
  listingTitle: string;
  lastMessagePreview?: string;
  lastMessageAt: string;
  unreadCount: number;
  counterpart: UserBrief;
};

type PagedConversationSummary = {
  items: ConversationSummary[];
  page: { page: number; pageSize: number; total: number };
};

export default function MessagesPage() {
  const token = getToken();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PagedConversationSummary | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const d = await apiGet<PagedConversationSummary>('/me/conversations', {
        page: 1,
        pageSize: 20,
      });
      setData(d);
    } catch (e: any) {
      setError(e?.message || '加载失败');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const items = useMemo(() => data?.items || [], [data?.items]);

  return (
    <View className="container">
      <View className="card">
        <Text style={{ fontSize: '34rpx', fontWeight: 700 }}>咨询/消息</Text>
        <View style={{ height: '8rpx' }} />
        <Text className="muted">P0：工单式消息（非实时），支持刷新与证据留痕。</Text>
      </View>

      <View style={{ height: '16rpx' }} />

      {!token ? (
        <View
          className="card btn-primary"
          onClick={() => {
            Taro.navigateTo({ url: '/pages/login/index' });
          }}
        >
          <Text>登录后查看会话</Text>
        </View>
      ) : loading ? (
        <LoadingCard />
      ) : error ? (
        <ErrorCard message={error} onRetry={load} />
      ) : items.length ? (
        <View>
          {items.map((c) => (
            <View
              key={c.id}
              className="card"
              style={{ marginBottom: '16rpx' }}
              onClick={() => {
                Taro.navigateTo({ url: `/pages/messages/chat/index?conversationId=${c.id}` });
              }}
            >
              <Text style={{ fontWeight: 700 }}>{c.listingTitle}</Text>
              <View style={{ height: '6rpx' }} />
              <Text className="muted">对方：{c.counterpart?.nickname || '-'}</Text>
              <View style={{ height: '6rpx' }} />
              <Text className="muted">预览：{c.lastMessagePreview || '（无）'}</Text>
              <View style={{ height: '6rpx' }} />
              <Text className="muted">
                未读：{c.unreadCount} · 更新时间：{c.lastMessageAt}
              </Text>
            </View>
          ))}

          <View className="card btn-ghost" onClick={load}>
            <Text>刷新</Text>
          </View>
        </View>
      ) : (
        <EmptyCard
          title="暂无会话"
          message="从详情页点击“咨询”即可创建会话（演示）。"
          actionText="刷新"
          onAction={load}
        />
      )}
    </View>
  );
}
