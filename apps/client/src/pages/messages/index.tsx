import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useMemo, useState } from 'react';

import type { components } from '@ipmoney/api-types';

import { apiGet } from '../../lib/api';
import { usePageAccess } from '../../lib/guard';
import { formatTimeSmart } from '../../lib/format';
import { PageState } from '../../ui/PageState';
import { Surface } from '../../ui/layout';
import { Avatar, Button, PullToRefresh } from '../../ui/nutui';

type ConversationContentType = components['schemas']['ConversationContentType'];
type PagedConversationSummary = components['schemas']['PagedConversationSummary'];

function contentTypeLabel(t?: ConversationContentType | null): string {
  if (!t) return '内容';
  if (t === 'LISTING') return '专利';
  if (t === 'DEMAND') return '需求';
  if (t === 'ACHIEVEMENT') return '成果';
  if (t === 'ARTWORK') return '书画';
  if (t === 'TECH_MANAGER') return '技术经理人';
  return String(t);
}

export default function MessagesPage() {
  const [tab, setTab] = useState<'chat' | 'notice'>('chat');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PagedConversationSummary | null>(null);

  const load = useCallback(async () => {
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
  }, []);

  const refresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const d = await apiGet<PagedConversationSummary>('/me/conversations', {
        page: 1,
        pageSize: 20,
      });
      setData(d);
      setError(null);
    } catch (_) {
      // keep existing data visible during refresh failures
    } finally {
      setRefreshing(false);
    }
  }, [refreshing]);

  const access = usePageAccess('approved-required', (next) => {
    if (next.state === 'ok') {
      void load();
      return;
    }
    setData(null);
    setError(null);
    setLoading(false);
  });

  const items = useMemo(() => data?.items || [], [data?.items]);

  return (
    <View className="container messages-page messages-v4">
      <View className="messages-header">
        <Text className="text-hero">消息中心</Text>
        {access.state === 'ok' ? (
          <Button variant="ghost" size="small" loading={refreshing} onClick={refresh}>
            刷新
          </Button>
        ) : null}
      </View>

      <View className="messages-tabs glass-surface">
        {[
          { key: 'chat', label: '私聊消息' },
          { key: 'notice', label: '系统通知' },
        ].map((it) => (
          <View
            key={it.key}
            className={`messages-tab ${tab === it.key ? 'is-active' : ''}`}
            onClick={() => setTab(it.key as 'chat' | 'notice')}
          >
            <Text>{it.label}</Text>
            {tab === it.key ? <View className="messages-tab-underline" /> : null}
          </View>
        ))}
      </View>

      {tab === 'chat' ? (
        <PageState
          access={access}
          loading={loading}
          loadingText="加载会话…"
          error={error}
          empty={!items.length}
          emptyTitle="暂无会话"
          emptyMessage="从详情页点击“咨询”即可创建会话。"
          emptyActionText="刷新"
          onRetry={load}
          onEmptyAction={load}
        >
          <PullToRefresh type="primary" disabled={refreshing} onRefresh={refresh}>
            <Surface padding="md" className="glass-surface messages-list">
              {items.map((c, idx) => (
                <View
                  key={c.id}
                  className={`message-item ${idx === items.length - 1 ? 'is-last' : ''}`}
                  onClick={() => {
                    Taro.navigateTo({ url: `/pages/messages/chat/index?conversationId=${c.id}` });
                  }}
                >
                  <View className="message-avatar">
                    <Avatar size="48" src={c.counterpart?.avatarUrl || ''} background="var(--c-soft)" color="var(--c-primary)">
                      {(c.counterpart?.nickname || 'U').slice(0, 1).toUpperCase()}
                    </Avatar>
                    {c.unreadCount ? (
                      <View className="message-unread">
                        <Text className="message-unread-text">{c.unreadCount > 99 ? '99+' : c.unreadCount}</Text>
                      </View>
                    ) : null}
                  </View>
                  <View className="message-body">
                    <View className="message-title-row">
                      <Text className="message-title ellipsis">{c.counterpart?.nickname || '对方'}</Text>
                      <Text className="message-time">{formatTimeSmart(c.lastMessageAt)}</Text>
                    </View>
                    <View className="message-meta-row">
                      <Text className="message-tag">{contentTypeLabel(c.contentType)}</Text>
                      <Text className="message-content ellipsis">
                        {c.contentTitle || c.listingTitle || c.lastMessagePreview || '暂无消息'}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </Surface>
          </PullToRefresh>
        </PageState>
      ) : (
        <Surface className="glass-surface messages-list" padding="md">
          <View className="notice-empty">
            <Text className="text-card-title">暂无系统通知</Text>
            <Text className="muted text-caption">重要更新会在此展示</Text>
          </View>
        </Surface>
      )}
    </View>
  );
}
