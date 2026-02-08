import { View, Text, Input, ScrollView, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './index.scss';

import type { components } from '@ipmoney/api-types';

import plusIcon from '../../../assets/icons/icon-plus-gray.svg';
import emptyChat from '../../../assets/illustrations/empty-chat.svg';
import { API_BASE_URL, ENABLE_MOCK_TOOLS } from '../../../constants';
import { getToken, getVerificationStatus, isOnboardingDone } from '../../../lib/auth';
import { apiGet, apiPost } from '../../../lib/api';
import { formatTimeSmart } from '../../../lib/format';
import { patentTypeLabel, tradeModeLabel } from '../../../lib/labels';
import { fenToYuan } from '../../../lib/money';
import { safeNavigateBack } from '../../../lib/navigation';
import { useRouteUuidParam } from '../../../lib/routeParams';
import { Avatar, Button, PullToRefresh, toast } from '../../../ui/nutui';
import { AuditPendingCard, EmptyCard, ErrorCard, LoadingCard, MissingParamCard, PermissionCard } from '../../../ui/StateCards';

type Me = { id: string };

type LocalMessageStatus = 'sending' | 'failed';

type ReferenceType = 'MATERIAL' | 'CONTRACT';

type ConversationMessage = {
  id: string;
  conversationId: string;
  senderUserId: string;
  type: 'TEXT' | 'EMOJI' | 'REFERENCE' | 'IMAGE' | 'FILE' | 'SYSTEM';
  text?: string;
  fileId?: string | null;
  fileUrl?: string | null;
  referenceType?: ReferenceType;
  referenceTitle?: string;
  referenceNote?: string;
  createdAt: string;
};

type UiConversationMessage = ConversationMessage & { localStatus?: LocalMessageStatus };

type PagedConversationMessage = { items: UiConversationMessage[]; nextCursor?: string | null };

type ConversationSummary = components['schemas']['ConversationSummary'];
type PagedConversationSummary = components['schemas']['PagedConversationSummary'];
type ListingPublic = components['schemas']['ListingPublic'];
type DemandPublic = components['schemas']['DemandPublic'];
type AchievementPublic = components['schemas']['AchievementPublic'];
type ArtworkPublic = components['schemas']['ArtworkPublic'];
type TechManagerPublic = components['schemas']['TechManagerPublic'];

type ContextCard = {
  title: string;
  tag?: string;
  price?: string;
  thumbUrl?: string;
  contentType?: components['schemas']['ConversationContentType'];
  contentId?: string;
};

const TIME_SECTION_GAP_MS = 5 * 60 * 1000;
const EMOJI_PRESETS = ['😀', '👍', '🎉', '👏', '🙏'];
const SHOULD_USE_OFFLINE_MOCK = ENABLE_MOCK_TOOLS || API_BASE_URL.includes('127.0.0.1') || API_BASE_URL.includes('localhost');

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

function formatPriceLabel(priceType?: components['schemas']['PriceType'] | null, amount?: number | null): string {
  if (priceType === 'NEGOTIABLE') return '面议';
  if (amount == null) return '';
  return `¥ ${fenToYuan(amount)}`;
}

function formatBudgetLabel(
  priceType?: components['schemas']['PriceType'] | null,
  min?: number | null,
  max?: number | null,
): string {
  if (priceType === 'NEGOTIABLE') return '面议';
  if (min != null && max != null) return `¥ ${fenToYuan(min)} - ¥ ${fenToYuan(max)}`;
  if (min != null) return `¥ ${fenToYuan(min)} 起`;
  if (max != null) return `¥ ${fenToYuan(max)} 内`;
  return '';
}

function shouldShowTimeDivider(current: UiConversationMessage, prev?: UiConversationMessage): boolean {
  if (!prev) return true;
  const currentAt = Date.parse(current.createdAt || '');
  const prevAt = Date.parse(prev.createdAt || '');
  if (!Number.isFinite(currentAt) || !Number.isFinite(prevAt)) return true;
  return currentAt - prevAt >= TIME_SECTION_GAP_MS;
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
  const [conversation, setConversation] = useState<ConversationSummary | null>(null);
  const [contextCard, setContextCard] = useState<ContextCard | null>(null);
  const [showSafety, setShowSafety] = useState(true);
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

  const getConversationDisplayName = useCallback((c: ConversationSummary | null): string => {
    if (!c) return '咨询会话';
    const role = c.counterpart?.role;
    if (role === 'cs') return '平台客服助手';
    if (role === 'admin') return '交易通知';
    return c.counterpart?.nickname || '对方';
  }, []);

  const displayName = useMemo(() => getConversationDisplayName(conversation), [conversation, getConversationDisplayName]);
  const counterpartAvatar = useMemo(() => conversation?.counterpart?.avatarUrl || '', [conversation?.counterpart?.avatarUrl]);

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
      toast(e?.message || '加载失败');
    } finally {
      setLoadingMore(false);
    }
  }, [conversationId, items, loadingMore, nextCursor, scrollToMessage]);

  const buildContextCard = useCallback(async (c: ConversationSummary) => {
    let title = c.contentTitle || c.listingTitle || '咨询内容';
    let tag = '';
    let price = '';
    let thumbUrl = '';
    try {
      if (c.contentType === 'LISTING') {
        const d = await apiGet<ListingPublic>(`/public/listings/${c.contentId}`);
        title = d.title || title;
        tag = [patentTypeLabel(d.patentType, { empty: '' }), tradeModeLabel(d.tradeMode, { empty: '' })]
          .filter(Boolean)
          .join('·');
        price = formatPriceLabel(d.priceType, d.priceAmountFen);
        thumbUrl = d.coverUrl || '';
      } else if (c.contentType === 'DEMAND') {
        const d = await apiGet<DemandPublic>(`/public/demands/${c.contentId}`);
        title = d.title || title;
        tag = '需求';
        price = formatBudgetLabel(d.budgetType, d.budgetMinFen, d.budgetMaxFen);
        thumbUrl = d.coverUrl || '';
      } else if (c.contentType === 'ACHIEVEMENT') {
        const d = await apiGet<AchievementPublic>(`/public/achievements/${c.contentId}`);
        title = d.title || title;
        tag = '成果';
        thumbUrl = d.coverUrl || '';
      } else if (c.contentType === 'ARTWORK') {
        const d = await apiGet<ArtworkPublic>(`/public/artworks/${c.contentId}`);
        title = d.title || title;
        tag = '书画';
        price = formatPriceLabel(d.priceType, d.priceAmountFen);
        thumbUrl = d.coverUrl || '';
      } else if (c.contentType === 'TECH_MANAGER') {
        const d = await apiGet<TechManagerPublic>(`/public/tech-managers/${c.contentId}`);
        title = d.displayName || title;
        tag = '技术经理人';
        thumbUrl = d.avatarUrl || '';
      }
    } catch (_) {
      // ignore detail errors, fallback to base info
    }

    setContextCard({
      title,
      tag,
      price,
      thumbUrl,
      contentType: c.contentType,
      contentId: c.contentId,
    });
  }, []);

  const loadConversationSummary = useCallback(async () => {
    if (!conversationId) return;
    try {
      const d = await apiGet<PagedConversationSummary>('/me/conversations', { page: 1, pageSize: 50 });
      const found = (d.items || []).find((item) => item.id === conversationId) || null;
      setConversation(found);
      if (found) {
        void Taro.setNavigationBarTitle({ title: getConversationDisplayName(found) });
        void buildContextCard(found);
      }
    } catch (_) {
      setConversation(null);
    }
  }, [buildContextCard, conversationId, getConversationDisplayName]);

  useEffect(() => {
    if (!token) return;
    void loadConversationSummary();
  }, [loadConversationSummary, token]);

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

  const openEmojiSheet = useCallback(() => {
    if (!canChat) return;
    void Taro.showActionSheet({
      itemList: EMOJI_PRESETS,
    })
      .then((res) => {
        const emoji = EMOJI_PRESETS[res.tapIndex];
        if (!emoji) return;
        setText((prevText) => `${prevText}${emoji}`);
      })
      .catch(() => {});
  }, [canChat]);

  const sendReference = useCallback(
    (referenceType: ReferenceType) => {
      if (!canChat) return;
      if (!conversationId) return;
      if (!SHOULD_USE_OFFLINE_MOCK) {
        toast('请先在发布/合同中心上传后再引用');
        return;
      }

      const now = new Date().toISOString();
      const optimisticId = `local-ref-${Date.now()}`;
      const preset =
        referenceType === 'CONTRACT'
          ? { title: '合同电子版（示例）', note: '协商后上传，双方可查阅' }
          : { title: '权属证明材料（示例）', note: '来自专利发布材料' };

      const optimistic: UiConversationMessage = {
        id: optimisticId,
        conversationId,
        senderUserId: meId || 'me',
        type: 'REFERENCE',
        referenceType,
        referenceTitle: preset.title,
        referenceNote: preset.note,
        createdAt: now,
      };

      setData((prev) => ({
        items: [...(prev?.items || []), optimistic],
        nextCursor: prev?.nextCursor ?? null,
      }));
      scrollToBottom();
    },
    [canChat, conversationId, meId, scrollToBottom],
  );

  const openReferenceSheet = useCallback(() => {
    if (!canChat) return;
    void Taro.showActionSheet({
      itemList: ['引用材料', '引用合同'],
    })
      .then((res) => {
        if (res.tapIndex === 1) {
          sendReference('CONTRACT');
          return;
        }
        sendReference('MATERIAL');
      })
      .catch(() => {});
  }, [canChat, sendReference]);

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

  const openContextDetail = useCallback(() => {
    if (!contextCard?.contentType || !contextCard?.contentId) return;
    const id = contextCard.contentId;
    if (contextCard.contentType === 'LISTING') {
      Taro.navigateTo({ url: `/pages/listing/detail/index?listingId=${id}` });
      return;
    }
    if (contextCard.contentType === 'DEMAND') {
      Taro.navigateTo({ url: `/pages/demand/detail/index?demandId=${id}` });
      return;
    }
    if (contextCard.contentType === 'ACHIEVEMENT') {
      Taro.navigateTo({ url: `/pages/achievement/detail/index?achievementId=${id}` });
      return;
    }
    if (contextCard.contentType === 'ARTWORK') {
      Taro.navigateTo({ url: `/pages/artwork/detail/index?artworkId=${id}` });
      return;
    }
    if (contextCard.contentType === 'TECH_MANAGER') {
      Taro.navigateTo({ url: `/pages/tech-managers/detail/index?techManagerId=${id}` });
    }
  }, [contextCard]);

  if (!conversationId) {
    return (
      <View className="container chat-page">
        <MissingParamCard onAction={() => void safeNavigateBack()} />
      </View>
    );
  }

  return (
    <View className="container chat-page">
      <View className="chat-header">
        <View className="chat-header-left" onClick={() => void safeNavigateBack()}>
          <Text className="chat-header-back">‹</Text>
        </View>
        <Text className="chat-header-title">{displayName}</Text>
        <View className="chat-header-right">
          <Text className="chat-header-more">⋯</Text>
        </View>
      </View>

      {showSafety ? (
        <View className="chat-safety">
          <View className="chat-safety-left">
            <Text className="chat-safety-icon">!</Text>
            <Text className="chat-safety-text">系统提醒：请勿私下转账或添加私人联系方式。所有交易请通过平台进行，以保障资金安全。</Text>
          </View>
          <Text className="chat-safety-close" onClick={() => setShowSafety(false)}>
            ×
          </Text>
        </View>
      ) : null}

      {contextCard ? (
        <View className="chat-context-card" onClick={openContextDetail}>
          <View className="chat-context-thumb">
            {contextCard.thumbUrl ? (
              <Image src={contextCard.thumbUrl} mode="aspectFill" className="chat-context-thumb-img" />
            ) : (
              <View className="chat-context-thumb-fallback" />
            )}
          </View>
          <View className="chat-context-body">
            <Text className="chat-context-title clamp-1">{contextCard.title}</Text>
            <View className="chat-context-meta">
              {contextCard.tag ? <Text className="chat-context-tag">{contextCard.tag}</Text> : null}
              {contextCard.price ? <Text className="chat-context-price">{contextCard.price}</Text> : null}
            </View>
          </View>
          <View className="chat-context-action">查看详情</View>
        </View>
      ) : null}

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
            {items.map((m, index) => {
              const prev = index > 0 ? items[index - 1] : undefined;
              const showTimeDivider = shouldShowTimeDivider(m, prev);
              const isMe = Boolean(meId) && m.senderUserId === meId;
              const isSystem = m.type === 'SYSTEM';
              const isReference = m.type === 'REFERENCE';
              const bubbleClass = `chat-bubble${isMe ? ' chat-bubble-me' : ''}${isReference ? ' chat-bubble-ref' : ''}`;

              if (isSystem) {
                return (
                  <React.Fragment key={m.id}>
                    {showTimeDivider ? <View className="chat-time-divider">{formatTimeSmart(m.createdAt)}</View> : null}
                    <View id={`msg-${m.id}`} className="chat-system-row">
                      <Text className="chat-system-text">{m.text || '系统消息'}</Text>
                    </View>
                  </React.Fragment>
                );
              }

              return (
                <React.Fragment key={m.id}>
                  {showTimeDivider ? <View className="chat-time-divider">{formatTimeSmart(m.createdAt)}</View> : null}
                  <View id={`msg-${m.id}`} className={`chat-row ${isMe ? 'chat-row-me' : ''}`}>
                    {!isMe ? (
                      <Avatar size="40" src={counterpartAvatar} background="var(--c-divider)" color="var(--c-muted)">
                        {(displayName || 'T').slice(0, 1)}
                      </Avatar>
                    ) : null}

                    <View className={bubbleClass}>
                      {isReference ? (
                        <View className="chat-ref">
                          <Text className="chat-ref-label">
                            {m.referenceType === 'CONTRACT' ? '合同引用' : '材料引用'}
                          </Text>
                          <Text className="chat-ref-title">{m.referenceTitle || '已引用材料'}</Text>
                          {m.referenceNote ? <Text className="chat-ref-note clamp-1">{m.referenceNote}</Text> : null}
                          <Text className="chat-ref-action">查看</Text>
                        </View>
                      ) : m.type === 'IMAGE' && m.fileUrl ? (
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
                      ) : m.type === 'TEXT' || m.type === 'EMOJI' ? (
                        <Text>{m.text || '（空）'}</Text>
                      ) : (
                        <Text>{m.text || m.fileUrl || '（空）'}</Text>
                      )}
                    {m.localStatus ? (
                      <View className="chat-meta-row">
                        {m.localStatus === 'sending' ? (
                          <Text className={`chat-meta ${isMe ? 'chat-meta-me' : ''}`}>发送中…</Text>
                        ) : m.localStatus === 'failed' ? (
                          <Text
                            className={`chat-meta chat-meta-action ${isMe ? 'chat-meta-action-me' : ''}`}
                            onClick={() => void retry(m)}
                          >
                            重试
                          </Text>
                        ) : null}
                      </View>
                    ) : null}
                    </View>

                    {isMe ? (
                      <Avatar size="40" background="var(--c-soft)" color="var(--c-primary)">
                        我
                      </Avatar>
                    ) : null}
                  </View>
                </React.Fragment>
              );
            })}
            <View id="chat-bottom" />
          </ScrollView>
        </PullToRefresh>
      ) : (
        <EmptyCard title="暂无会话消息" message="可发送一条消息开始沟通。" image={emptyChat} />
      )}

      {canChat ? (
        <View className="chat-input-bar">
          <View className="chat-input-inner">
            <View className="chat-input-field">
              <Input
                className="input"
                value={text}
                onInput={(e) => setText(e.detail.value)}
                placeholder="发送消息…"
                onConfirm={send}
                confirmType="send"
              />
            </View>
            <View className="chat-input-actions">
              <View className="chat-input-icon" onClick={openEmojiSheet}>
                <Text className="chat-input-icon-text">表情</Text>
              </View>
              <View className="chat-input-icon" onClick={openReferenceSheet}>
                <Image className="chat-input-icon-img" src={plusIcon} mode="aspectFit" svg />
              </View>
              <View className={`chat-send-btn ${sending ? 'is-loading' : ''}`} onClick={send}>
                <Text className="chat-send-text">{sending ? '…' : '发送'}</Text>
              </View>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}





