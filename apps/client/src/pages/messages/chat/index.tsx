import { View, Text, Input } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { apiGet, apiPost } from '../../../lib/api';
import { requireLogin } from '../../../lib/guard';
import { EmptyCard, ErrorCard, LoadingCard } from '../../../ui/StateCards';

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

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PagedConversationMessage | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!conversationId) return;
    if (!requireLogin()) return;
    setLoading(true);
    setError(null);
    try {
      const d = await apiGet<PagedConversationMessage>(
        `/conversations/${conversationId}/messages`,
        { limit: 50 },
      );
      setData(d);
      await apiPost<any>(
        `/conversations/${conversationId}/read`,
        {},
        { idempotencyKey: `demo-read-${conversationId}` },
      );
    } catch (e: any) {
      setError(e?.message || '加载失败');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const send = useCallback(async () => {
    if (!requireLogin()) return;
    if (!conversationId) return;
    const v = text.trim();
    if (!v) {
      Taro.showToast({ title: '请输入内容', icon: 'none' });
      return;
    }
    setSending(true);
    try {
      await apiPost<ConversationMessage>(
        `/conversations/${conversationId}/messages`,
        { type: 'TEXT', text: v },
        { idempotencyKey: `demo-msg-${conversationId}-${Date.now()}` },
      );
      setText('');
      void load();
    } catch (e: any) {
      Taro.showToast({ title: e?.message || '发送失败', icon: 'none' });
    } finally {
      setSending(false);
    }
  }, [conversationId, load, text]);

  if (!conversationId) {
    return (
      <View className="container">
        <ErrorCard
          title="参数缺失"
          message="缺少 conversationId（演示）"
          onRetry={() => Taro.navigateBack()}
        />
      </View>
    );
  }

  return (
    <View className="container">
      <View className="card">
        <Text style={{ fontSize: '32rpx', fontWeight: 700 }}>咨询会话（非实时，P0）</Text>
        <View style={{ height: '6rpx' }} />
        <Text className="muted">会话ID：{conversationId}</Text>
      </View>

      <View style={{ height: '16rpx' }} />

      {loading ? (
        <LoadingCard />
      ) : error ? (
        <ErrorCard message={error} onRetry={load} />
      ) : data?.items?.length ? (
        <View>
          {data.items.map((m) => (
            <View key={m.id} className="card" style={{ marginBottom: '12rpx' }}>
              <Text style={{ fontWeight: 700 }}>{m.type}</Text>
              <View style={{ height: '6rpx' }} />
              <Text className="muted">{m.text || m.fileUrl || '（空）'}</Text>
              <View style={{ height: '6rpx' }} />
              <Text className="muted">{m.createdAt}</Text>
            </View>
          ))}
        </View>
      ) : (
        <EmptyCard title="暂无消息" message="可发送一条消息进行演示。" />
      )}

      <View style={{ height: '16rpx' }} />

      <View className="card">
        <Text style={{ fontWeight: 700 }}>发送消息（演示）</Text>
        <View style={{ height: '8rpx' }} />
        <Input value={text} onInput={(e) => setText(e.detail.value)} placeholder="输入内容…" />
        <View style={{ height: '12rpx' }} />
        <View className={`btn-primary ${sending ? '' : ''}`} onClick={sending ? undefined : send}>
          <Text>{sending ? '发送中…' : '发送'}</Text>
        </View>
        <View style={{ height: '10rpx' }} />
        <View className="btn-ghost" onClick={load}>
          <Text>刷新</Text>
        </View>
      </View>
    </View>
  );
}
