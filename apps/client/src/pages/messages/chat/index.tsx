import { View, Text, Input } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { getToken, getVerificationStatus, isOnboardingDone } from '../../../lib/auth';
import { apiGet, apiPost } from '../../../lib/api';
import { PageHeader, Spacer } from '../../../ui/layout';
import { Button } from '../../../ui/nutui';
import { AuditPendingCard, EmptyCard, ErrorCard, LoadingCard, PermissionCard } from '../../../ui/StateCards';

type Me = { id: string };

type ConversationMessage = {
  id: string;
  conversationId: string;
  senderUserId: string;
  type: 'TEXT' | 'IMAGE' | 'FILE' | 'SYSTEM';
  text?: string;
  fileUrl?: string | null;
  createdAt: string;
};

type PagedConversationMessage = { items: ConversationMessage[]; nextCursor?: string | null };

export default function ChatPage() {
  const router = useRouter();
  const conversationId = useMemo(
    () => router?.params?.conversationId || '',
    [router?.params?.conversationId],
  );

  const token = getToken();
  const onboardingDone = isOnboardingDone();
  const verificationStatus = getVerificationStatus();
  const canChat = Boolean(token) && onboardingDone && verificationStatus === 'APPROVED';

  const [meId, setMeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PagedConversationMessage | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

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
      try {
        await apiPost<any>(
          `/conversations/${conversationId}/read`,
          {},
          { idempotencyKey: `demo-read-${conversationId}` },
        );
      } catch (_) {}
    } catch (e: any) {
      setError(e?.message || '加载失败');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

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
      Taro.showToast({ title: '请输入内容', icon: 'none' });
      return;
    }

    const optimisticId = `local-${Date.now()}`;
    const optimistic: ConversationMessage = {
      id: optimisticId,
      conversationId,
      senderUserId: meId || 'me',
      type: 'TEXT',
      text: v,
      createdAt: new Date().toISOString(),
    };

    setData((prev) => ({
      items: [...(prev?.items || []), optimistic],
      nextCursor: prev?.nextCursor ?? null,
    }));
    setText('');
    setSending(true);
    try {
      await apiPost<ConversationMessage>(
        `/conversations/${conversationId}/messages`,
        { type: 'TEXT', text: v },
        { idempotencyKey: `demo-msg-${conversationId}-${Date.now()}` },
      );
    } catch (e: any) {
      setData((prev) => ({
        items: (prev?.items || []).filter((m) => m.id !== optimisticId),
        nextCursor: prev?.nextCursor ?? null,
      }));
      Taro.showToast({ title: e?.message || '发送失败', icon: 'none' });
    } finally {
      setSending(false);
    }
  }, [canChat, conversationId, meId, text]);

  if (!conversationId) {
    return (
      <View className="container">
        <ErrorCard
          title="参数缺失"
          message="缺少 conversationId"
          onRetry={() => Taro.navigateBack()}
        />
      </View>
    );
  }

  return (
    <View className="container">
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
        <View className="chat-content">
          {data.items.map((m) => (
            <View
              key={m.id}
              className={`chat-row ${meId && m.senderUserId === meId ? 'chat-row-me' : ''}`}
            >
              <View className={`chat-bubble ${meId && m.senderUserId === meId ? 'chat-bubble-me' : ''}`}>
                <Text>{m.text || m.fileUrl || '（空）'}</Text>
                <Text className={`chat-meta ${meId && m.senderUserId === meId ? 'chat-meta-me' : ''}`}>
                  {m.createdAt}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <EmptyCard title="暂无消息" message="可发送一条消息开始沟通。" />
      )}

      <View className="chat-input-bar">
        <View className="chat-input-inner">
          <Input
            className="input"
            value={text}
            onInput={(e) => setText(e.detail.value)}
            placeholder="输入内容…"
            onConfirm={send}
            confirmType="send"
          />
          <Button block={false} size="small" loading={sending} disabled={sending} onClick={send}>
            {sending ? '发送中…' : '发送'}
          </Button>
          <Button block={false} size="small" variant="ghost" onClick={load}>
            刷新
          </Button>
        </View>
      </View>
    </View>
  );
}
