import { View, Text, Input, ScrollView, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { getToken, getVerificationStatus, isOnboardingDone } from '../../../lib/auth';
import { apiGet, apiPost } from '../../../lib/api';
import { formatTimeSmart } from '../../../lib/format';
import { safeNavigateBack } from '../../../lib/navigation';
import { useRouteUuidParam } from '../../../lib/routeParams';
import { PageHeader, Spacer } from '../../../ui/layout';
import { Avatar, Button, PullToRefresh, toast } from '../../../ui/nutui';
import { AuditPendingCard, EmptyCard, ErrorCard, LoadingCard, MissingParamCard, PermissionCard } from '../../../ui/StateCards';

type Me = { id: string };

type LocalMessageStatus = 'sending' | 'failed';

type ConversationMessage = {
  id: string;
  conversationId: string;
  senderUserId: string;
  type: 'TEXT' | 'IMAGE' | 'FILE' | 'SYSTEM';
  text?: string;
  fileId?: string | null;
  fileUrl?: string | null;
  createdAt: string;
};

type UiConversationMessage = ConversationMessage & { localStatus?: LocalMessageStatus };

type PagedConversationMessage = { items: UiConversationMessage[]; nextCursor?: string | null };

function fileNameFromUrl(url?: string | null): string {
  if (!url) return 'File';
  try {
    const u = new URL(url);
    const pathname = u.pathname || '';
    const idx = pathname.lastIndexOf('/');
    const name = idx >= 0 ? pathname.slice(idx + 1) : pathname;
    return name || 'File';
  } catch {
    const idx = url.lastIndexOf('/');
    const name = idx >= 0 ? url.slice(idx + 1) : url;
    return name || 'File';
  }
}

function mergeMessages(prepend: UiConversationMessage[], existing: UiConversationMessage[]): UiConversationMessage[] {
  const seen = new Set<string>();
  const out: UiConversationMessage[] = [];
  for (const m of [...prepend, ...existing]) {
    if (!m?.id) continue;
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    out.push(m);
  }
  return out;
}

export default function ChatPage() {
  const conversationId = useRouteUuidParam('conversationId') || '';

  const token = getToken();
  const onboardingDone = isOnboardingDone();
  const verificationStatus = getVerificationStatus();
  const canChat = Boolean(token) && onboardingDone && verificationStatus === 'APPROVED';

  const [meId, setMeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PagedConversationMessage | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [scrollIntoView, setScrollIntoView] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const items = useMemo(() => data?.items || [], [data?.items]);
  const nextCursor = useMemo(() => data?.nextCursor ?? null, [data?.nextCursor]);
  const canLoadMore = useMemo(() => Boolean(nextCursor), [nextCursor]);

  const scrollToTarget = useCallback((target: string) => {
    setScrollIntoView('');
    setTimeout(() => setScrollIntoView(target), 0);
  }, []);

  const scrollToBottom = useCallback(() => scrollToTarget('chat-bottom'), [scrollToTarget]);

  const scrollToMessage = useCallback(
    (messageId: string) => {
      scrollToTarget(`msg-${messageId}`);
    },
    [scrollToTarget],
  );

  const loadMe = useCallback(async () => {
    try {
      const d = await apiGet<Me>('/me');
      setMeId(d.id);
    } catch (_) {
      setMeId(null);
    }
  }, []);

  const load = useCallback(async () => {
    if (!conversationId) return;
    setLoading(true);
    setError(null);
    try {
      const d = await apiGet<PagedConversationMessage>(
        `/conversations/${conversationId}/messages`,
        { limit: 50 },
      );
      setData(d);
      scrollToBottom();
      try {
        await apiPost<any>(
          `/conversations/${conversationId}/read`,
          {},
          { idempotencyKey: `read-${conversationId}` },
        );
      } catch (_) {}
    } catch (e: any) {
      setError(e?.message || '加载失败');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [conversationId, scrollToBottom]);

  const loadMore = useCallback(async () => {
    if (!conversationId) return;
    if (!nextCursor) return;
    if (loadingMore) return;

    const anchorId = items[0]?.id;
    setLoadingMore(true);
    try {
      const d = await apiGet<PagedConversationMessage>(
        `/conversations/${conversationId}/messages`,
        { limit: 50, cursor: nextCursor },
      );
      setData((prev) => ({
        items: mergeMessages(d.items || [], prev?.items || []),
        nextCursor: d.nextCursor ?? null,
      }));
      if (anchorId) scrollToMessage(anchorId);
    } catch (e: any) {
      toast(e?.message || 'Load failed');
    } finally {
      setLoadingMore(false);
    }
  }, [conversationId, items, loadingMore, nextCursor, scrollToMessage]);

  useEffect(() => {
    if (!canChat) return;
    void loadMe();
    void load();
  }, [canChat, load, loadMe]);

  const send = useCallback(async () => {
    if (!canChat) return;
    if (!conversationId) return;
    const v = text.trim();
    if (!v) {
      toast('请输入内容');
      return;
    }

    const optimisticId = `local-${Date.now()}`;
    const optimistic: UiConversationMessage = {
      id: optimisticId,
      conversationId,
      senderUserId: meId || 'me',
      type: 'TEXT',
      text: v,
      createdAt: new Date().toISOString(),
      localStatus: 'sending',
    };

    setData((prev) => ({
      items: [...(prev?.items || []), optimistic],
      nextCursor: prev?.nextCursor ?? null,
    }));
    scrollToBottom();
    setText('');
    setSending(true);
    try {
      const created = await apiPost<ConversationMessage>(
        `/conversations/${conversationId}/messages`,
        { type: 'TEXT', text: v },
        { idempotencyKey: `msg-${conversationId}-${Date.now()}` },
      );
      setData((prev) => ({
        items: (prev?.items || []).map((m) => (m.id === optimisticId ? (created as UiConversationMessage) : m)),
        nextCursor: prev?.nextCursor ?? null,
      }));
      scrollToBottom();
    } catch (e: any) {
      setData((prev) => ({
        items: (prev?.items || []).map((m) => (m.id === optimisticId ? { ...m, localStatus: 'failed' } : m)),
        nextCursor: prev?.nextCursor ?? null,
      }));
      toast(e?.message || '发送失败');
      setText((prevText) => (prevText ? prevText : v));
    } finally {
      setSending(false);
    }
  }, [canChat, conversationId, meId, scrollToBottom, text]);

  const retry = useCallback(
    async (msg: UiConversationMessage) => {
      if (!canChat) return;
      if (!conversationId) return;
      if (msg.type !== 'TEXT') return;
      if (!msg.text?.trim()) return;

      setData((prev) => ({
        items: (prev?.items || []).map((m) => (m.id === msg.id ? { ...m, localStatus: 'sending' } : m)),
        nextCursor: prev?.nextCursor ?? null,
      }));
      scrollToBottom();

      try {
        const created = await apiPost<ConversationMessage>(
          `/conversations/${conversationId}/messages`,
          { type: 'TEXT', text: msg.text },
          { idempotencyKey: `msg-${conversationId}-${Date.now()}` },
        );
        setData((prev) => ({
          items: (prev?.items || []).map((m) => (m.id === msg.id ? (created as UiConversationMessage) : m)),
          nextCursor: prev?.nextCursor ?? null,
        }));
        scrollToBottom();
      } catch (e: any) {
        setData((prev) => ({
          items: (prev?.items || []).map((m) => (m.id === msg.id ? { ...m, localStatus: 'failed' } : m)),
          nextCursor: prev?.nextCursor ?? null,
        }));
        toast(e?.message || '发送失败');
      }
    },
    [canChat, conversationId, scrollToBottom],
  );

  if (!conversationId) {
    return (
      <View className="container chat-page page-bg-plain">
        <MissingParamCard onAction={() => void safeNavigateBack()} />
      </View>
    );
  }

  return (
    <View className="container chat-page page-bg-plain">
      <PageHeader title="咨询会话" subtitle={`会话ID：${conversationId}`} />
      <Spacer />

      {!token ? (
        <PermissionCard title="需要登录" message="登录并审核通过后才能查看咨询会话。" actionText="去登录" onAction={() => Taro.navigateTo({ url: '/pages/login/index' })} />
      ) : !onboardingDone ? (
        <PermissionCard
          title="需要选择身份"
          message="首次进入需完成身份选择；审核通过后才能咨询与交易。"
          actionText="去选择身份"
          onAction={() => Taro.navigateTo({ url: '/pages/onboarding/choose-identity/index' })}
        />
      ) : verificationStatus !== 'APPROVED' ? (
        <AuditPendingCard
          title={verificationStatus === 'REJECTED' ? '资料已驳回' : '资料审核中'}
          message={verificationStatus === 'REJECTED' ? '请重新提交资料，审核通过后才能咨询与交易。' : '审核通过后才能咨询与交易。'}
        />
      ) : loading ? (
        <LoadingCard />
      ) : error ? (
        <ErrorCard message={error} onRetry={load} />
      ) : data?.items?.length ? (
        <PullToRefresh
          className="chat-content"
          type="default"
          scrollTop={scrollTop}
          disabled={!canLoadMore || loadingMore}
          onRefresh={loadMore}
        >
          <ScrollView
            className="chat-scroll"
            scrollY
            scrollIntoView={scrollIntoView}
            scrollWithAnimation
            style={{ height: '100%' }}
            onScroll={(e) => setScrollTop(e.detail.scrollTop)}
          >
            {canLoadMore ? (
              <View className="chat-load-more">
                <Button
                  block={false}
                  size="small"
                  variant="ghost"
                  loading={loadingMore}
                  disabled={loadingMore}
                  onClick={loadMore}
                >
                  加载更早消息
                </Button>
              </View>
            ) : null}
          {items.map((m) => {
            const isMe = Boolean(meId) && m.senderUserId === meId;
            const isSystem = m.type === 'SYSTEM';

            if (isSystem) {
              return (
                <View key={m.id} id={`msg-${m.id}`} className="chat-system-row">
                  <Text className="chat-system-text">{m.text || '系统消息'}</Text>
                  <Text className="chat-system-time">{formatTimeSmart(m.createdAt)}</Text>
                </View>
              );
            }

            return (
              <View key={m.id} id={`msg-${m.id}`} className={`chat-row ${isMe ? 'chat-row-me' : ''}`}>
                {!isMe ? (
                  <Avatar size="small" background="var(--c-divider)" color="var(--c-muted)">
                    TA
                  </Avatar>
                ) : null}

                <View className={`chat-bubble ${isMe ? 'chat-bubble-me' : ''}`}>
                  {m.type === 'IMAGE' && m.fileUrl ? (
                    <Image
                      className="chat-image"
                      src={m.fileUrl}
                      mode="aspectFill"
                      onClick={() => {
                        void Taro.previewImage({ urls: [m.fileUrl as string] });
                      }}
                    />
                  ) : m.type === 'FILE' && m.fileUrl ? (
                    <View
                      className="chat-file"
                      onClick={() => {
                        void Taro.setClipboardData({ data: m.fileUrl as string });
                        toast('链接已复制', { icon: 'success' });
                      }}
                    >
                      <Text className="chat-file-name">{fileNameFromUrl(m.fileUrl)}</Text>
                      <Text className="chat-file-url clamp-1">{m.fileUrl}</Text>
                    </View>
                  ) : (
                    <Text>{m.text || m.fileUrl || '（空）'}</Text>
                  )}
                  <View className="chat-meta-row">
                    <Text className={`chat-meta ${isMe ? 'chat-meta-me' : ''}`}>{formatTimeSmart(m.createdAt)}</Text>
                    {m.localStatus === 'sending' ? (
                      <Text className={`chat-meta ${isMe ? 'chat-meta-me' : ''}`}>发送中…</Text>
                    ) : m.localStatus === 'failed' ? (
                      <Text className={`chat-meta chat-meta-action ${isMe ? 'chat-meta-action-me' : ''}`} onClick={() => void retry(m)}>
                        重试
                      </Text>
                    ) : null}
                  </View>
                </View>

                {isMe ? (
                  <Avatar size="small" background="var(--c-soft)" color="var(--c-primary)">
                    我
                  </Avatar>
                ) : null}
              </View>
            );
          })}
            <View id="chat-bottom" />
          </ScrollView>
        </PullToRefresh>
      ) : (
        <EmptyCard title="暂无消息" message="可发送一条消息开始沟通。" />
      )}

      {canChat ? (
        <View className="chat-input-bar">
          <View className="chat-input-inner">
            <View className="chat-input-field">
              <Input
                className="input"
                value={text}
                onInput={(e) => setText(e.detail.value)}
                placeholder="输入内容…"
                onConfirm={send}
                confirmType="send"
              />
            </View>
            <Button block={false} size="small" loading={sending} disabled={sending} onClick={send}>
              {sending ? '发送中…' : '发送'}
            </Button>
          </View>
        </View>
      ) : null}
    </View>
  );
}
