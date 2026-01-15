import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useMemo, useState } from 'react';

import type { components } from '@ipmoney/api-types';

import { apiGet } from '../../lib/api';
import { usePageAccess } from '../../lib/guard';
import { formatTimeSmart } from '../../lib/format';
import { PageState } from '../../ui/PageState';
import { CellRow, PageHeader, Spacer, Surface } from '../../ui/layout';
import { Avatar, Badge, Button, CellGroup, PullToRefresh, Tag } from '../../ui/nutui';

type ConversationContentType = components['schemas']['ConversationContentType'];
type PagedConversationSummary = components['schemas']['PagedConversationSummary'];

function contentTypeLabel(t?: ConversationContentType | null): string {
  if (!t) return '内容';
  if (t === 'LISTING') return '专利';
  if (t === 'DEMAND') return '需求';
  if (t === 'ACHIEVEMENT') return '成果';
  return String(t);
}

export default function MessagesPage() {
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
    <View className="container messages-page">
      <PageHeader
        title="咨询/消息"
        subtitle="用于咨询与跟单沟通（证据留痕）。"
        right={
          access.state === 'ok' ? (
            <Button variant="ghost" size="small" loading={refreshing} onClick={refresh}>
              刷新
            </Button>
          ) : null
        }
      />
      <Spacer />

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
          <Surface padding="none">
            <CellGroup divider>
              {items.map((c, idx) => (
                <CellRow
                  key={c.id}
                  clickable
                  arrow={false}
                  className="conversation-cell"
                  title={
                    <View className="conversation-row">
                      <Avatar
                        className="conversation-avatar"
                        size="40"
                        src={c.counterpart?.avatarUrl || ''}
                        background="var(--c-soft)"
                        color="var(--c-primary)"
                      >
                        {(c.counterpart?.nickname || 'U').slice(0, 1).toUpperCase()}
                      </Avatar>
                      <View className="conversation-body">
                        <View className="conversation-title-row">
                          <Tag className="conversation-tag" type="primary" plain round>
                            {contentTypeLabel(c.contentType)}
                          </Tag>
                          <Text className="ellipsis text-strong conversation-title">
                            {c.contentTitle || c.listingTitle || '（未命名）'}
                          </Text>
                        </View>
                        <Text className="muted ellipsis conversation-preview">
                          {c.lastMessagePreview || '暂无消息'}
                        </Text>
                      </View>
                    </View>
                  }
                  extra={
                    <View className="conversation-extra">
                      <Text className="conversation-time">{formatTimeSmart(c.lastMessageAt)}</Text>
                      {c.unreadCount ? <Badge value={c.unreadCount} max={99} /> : null}
                    </View>
                  }
                  isLast={idx === items.length - 1}
                  onClick={() => {
                    Taro.navigateTo({ url: `/pages/messages/chat/index?conversationId=${c.id}` });
                  }}
                />
              ))}
            </CellGroup>
          </Surface>
        </PullToRefresh>
      </PageState>
    </View>
  );
}
