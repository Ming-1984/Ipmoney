import { View, Text, Image } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { getToken, getVerificationStatus, isOnboardingDone } from '../../lib/auth';
import { apiGet } from '../../lib/api';
import { CellRow, PageHeader, Spacer, Surface } from '../../ui/layout';
import { Button, CellGroup } from '../../ui/nutui';
import { AuditPendingCard, EmptyCard, ErrorCard, LoadingCard } from '../../ui/StateCards';

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
  const [auth, setAuth] = useState(() => ({
    token: getToken(),
    onboardingDone: isOnboardingDone(),
    verificationStatus: getVerificationStatus(),
  }));

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PagedConversationSummary | null>(null);

  const load = useCallback(async () => {
    if (!auth.token) return;
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
  }, [auth.token]);

  useDidShow(() => {
    const token = getToken();
    const onboardingDone = isOnboardingDone();
    const verificationStatus = getVerificationStatus();
    setAuth({ token, onboardingDone, verificationStatus });
    if (token && onboardingDone && verificationStatus === 'APPROVED') {
      void load();
      return;
    }
    setData(null);
    setError(null);
    setLoading(false);
  });

  const items = useMemo(() => data?.items || [], [data?.items]);

  return (
    <View className="container">
      <PageHeader title="咨询/消息" subtitle="用于咨询与跟单沟通（支持刷新与证据留痕）。" />
      <Spacer />

      {!auth.token ? (
        <Surface>
          <Text className="text-card-title">登录后查看会话</Text>
          <View style={{ height: '8rpx' }} />
          <Text className="muted">咨询/收藏/下单等功能需登录且审核通过。</Text>
          <View style={{ height: '14rpx' }} />
          <Button
            onClick={() => {
              Taro.navigateTo({ url: '/pages/login/index' });
            }}
          >
            去登录
          </Button>
        </Surface>
      ) : !auth.onboardingDone ? (
        <Surface>
          <Text className="text-card-title">请先选择身份</Text>
          <View style={{ height: '8rpx' }} />
          <Text className="muted">首次进入需完成身份选择；审核通过后才能咨询与交易。</Text>
          <View style={{ height: '14rpx' }} />
          <Button
            onClick={() => {
              Taro.navigateTo({ url: '/pages/onboarding/choose-identity/index' });
            }}
          >
            去选择身份
          </Button>
        </Surface>
      ) : auth.verificationStatus !== 'APPROVED' ? (
        <AuditPendingCard
          title={auth.verificationStatus === 'REJECTED' ? '资料已驳回' : '资料审核中'}
          message={
            auth.verificationStatus === 'REJECTED'
              ? '请重新提交资料，审核通过后才能咨询与交易。'
              : '审核通过后才能咨询与交易。'
          }
        />
      ) : loading ? (
        <LoadingCard />
      ) : error ? (
        <ErrorCard message={error} onRetry={load} />
      ) : items.length ? (
        <View>
          <Surface padding="none">
            <CellGroup divider>
              {items.map((c, idx) => (
                <CellRow
                  key={c.id}
                  clickable
                  title={
                    <View className="row" style={{ gap: '12rpx' }}>
                      <View className="avatar">
                        {c.counterpart?.avatarUrl ? (
                          <Image className="avatar-img" src={c.counterpart.avatarUrl} mode="aspectFill" />
                        ) : (
                          <Text className="text-strong" style={{ color: 'var(--c-primary)' }}>
                            {(c.counterpart?.nickname || 'U').slice(0, 1).toUpperCase()}
                          </Text>
                        )}
                      </View>
                      <View style={{ flex: 1, overflow: 'hidden' }}>
                        <Text className="ellipsis text-strong">{c.listingTitle}</Text>
                        <View style={{ height: '6rpx' }} />
                        <Text className="muted ellipsis">{c.lastMessagePreview || '暂无消息'}</Text>
                        <View style={{ height: '6rpx' }} />
                        <Text className="muted ellipsis">
                          对方：{c.counterpart?.nickname || '-'} · {c.lastMessageAt}
                        </Text>
                      </View>
                    </View>
                  }
                  extra={
                    <View className="row" style={{ gap: '10rpx' }}>
                      {c.unreadCount ? (
                        <Text className="badge">{c.unreadCount > 99 ? '99+' : c.unreadCount}</Text>
                      ) : null}
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

          <View style={{ height: '12rpx' }} />
          <Surface>
            <Button variant="ghost" onClick={load}>
              刷新
            </Button>
          </Surface>
        </View>
      ) : (
        <EmptyCard
          title="暂无会话"
          message="从详情页点击“咨询”即可创建会话。"
          actionText="刷新"
          onAction={load}
        />
      )}
    </View>
  );
}
