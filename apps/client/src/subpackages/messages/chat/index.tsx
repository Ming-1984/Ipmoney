import { Image, ScrollView, Text, Textarea, View } from '@tarojs/components';
import Taro, { useDidHide, useDidShow } from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './index.scss';

import type { components } from '@ipmoney/api-types';

import { API_BASE_URL } from '../../../constants';
import folderIcon from '../../../assets/icons/icon-folder-gray.svg';
import emptyChat from '../../../assets/illustrations/empty-chat-symbol.svg';
import { getToken, getVerificationStatus, isOnboardingDone, onAuthChanged } from '../../../lib/auth';
import { apiGet, apiPost } from '../../../lib/api';
import { resolveConversationEntityDisplayName } from '../../../lib/conversationDisplay';
import { getDetailCache, setDetailCache } from '../../../lib/detailCache';
import { displayInitial, displayTitleOrFallback, displayUserName, normalizeDisplayText } from '../../../lib/displayText';
import { formatTimeSmart } from '../../../lib/format';
import { patentTypeLabel, tradeModeLabel } from '../../../lib/labels';
import { fenToYuan } from '../../../lib/money';
import { safeNavigateBack } from '../../../lib/navigation';
import { useRouteStringParam, useRouteUuidParam } from '../../../lib/routeParams';
import { resolveTechManagerDisplayName } from '../../../lib/techManagerDisplay';
import { chooseImageFiles, chooseMessageFiles, uploadFileToApi } from '../../../lib/upload';
import { Avatar, toast } from '../../../ui/nutui';
import {
  AuditPendingCard,
  ErrorCard,
  LoadingCard,
  MissingParamCard,
  PermissionCard,
} from '../../../ui/StateCards';

type Me = { id: string; nickname?: string | null; displayName?: string | null; avatarUrl?: string | null };
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
  fileName?: string | null;
  sizeBytes?: number | null;
  referenceType?: ReferenceType;
  referenceTitle?: string;
  referenceNote?: string;
  createdAt: string;
};

type UiConversationMessage = ConversationMessage & { localStatus?: LocalMessageStatus };
type PagedConversationMessage = { items: UiConversationMessage[]; nextCursor?: string | null };
type ConversationSummary = components['schemas']['ConversationSummary'];
type ListingPublic = components['schemas']['ListingPublic'];
type AchievementPublic = components['schemas']['AchievementDetail'];
type TechManagerPublic = components['schemas']['TechManagerPublic'];
type OrderDetail = components['schemas']['Order'] & { listingTitle?: string | null };
type MaintenanceOrder = components['schemas']['PatentMaintenanceOrder'];

type ContextCard = {
  title: string;
  tag?: string;
  price?: string;
  thumbUrl?: string;
  contentType?: components['schemas']['ConversationContentType'];
  contentId?: string;
};

const TIME_SECTION_GAP_MS = 5 * 60 * 1000;
const CHAT_POLL_INTERVAL_MS = 5000;
const EMOJI_PRESETS = ['😀', '🥺', '😍', '😳', '😎', '😭', '😴', '😤', '😡', '😜', '😁', '🙄', '😊', '🤔', '😐', '😰'];
const CHAT_MESSAGES_CACHE_SCOPE = 'chat-messages';
const CHAT_SUMMARY_CACHE_SCOPE = 'chat-summary';
const CHAT_CONTEXT_CACHE_SCOPE = 'chat-context';
const CHAT_ME_CACHE_SCOPE = 'chat-meta';

function fileNameFromUrl(url?: string | null): string {
  if (!url) return 'File';
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname || '';
    const idx = pathname.lastIndexOf('/');
    const fileName = idx >= 0 ? pathname.slice(idx + 1) : pathname;
    return fileName || 'File';
  } catch {
    const idx = url.lastIndexOf('/');
    const fileName = idx >= 0 ? url.slice(idx + 1) : url;
    return fileName || 'File';
  }
}

function formatFileSize(sizeBytes?: number | null): string {
  if (typeof sizeBytes !== 'number' || !Number.isFinite(sizeBytes) || sizeBytes <= 0) return '';
  if (sizeBytes < 1024) return `${sizeBytes}B`;
  const kb = sizeBytes / 1024;
  if (kb < 1024) return `${kb >= 100 ? Math.round(kb) : kb.toFixed(1)}K`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb >= 100 ? Math.round(mb) : mb.toFixed(1)}M`;
  return `${(mb / 1024).toFixed(1)}G`;
}

function fileLabelFromMessage(message: Pick<ConversationMessage, 'text' | 'fileName' | 'fileUrl'>): string {
  return normalizeDisplayText(message.fileName) || normalizeDisplayText(message.text) || fileNameFromUrl(message.fileUrl);
}

function fileTypeLabel(fileName: string): string {
  const extension = fileName.split('.').pop()?.trim().toUpperCase() || '';
  if (extension === 'DOC' || extension === 'DOCX') return 'W';
  if (extension === 'XLS' || extension === 'XLSX') return 'X';
  if (extension === 'PPT' || extension === 'PPTX') return 'P';
  if (extension === 'PDF') return 'PDF';
  return extension.slice(0, 3) || 'FILE';
}

async function openChatFile(url: string): Promise<void> {
  const fileUrl = url.trim();
  if (!fileUrl) return;

  try {
    const downloaded = await Taro.downloadFile({ url: fileUrl });
    const filePath = downloaded.tempFilePath;
    if (!filePath) throw new Error('文件下载失败');
    await Taro.openDocument({ filePath, showMenu: true });
  } catch (error) {
    console.warn('[chat] open file failed', error);
    toast('当前环境无法预览该文件，请稍后重试');
  }
}

function mergeMessages(incoming: UiConversationMessage[], existing: UiConversationMessage[]): UiConversationMessage[] {
  const seen = new Set<string>();
  const out: UiConversationMessage[] = [];
  for (const item of [...incoming, ...existing]) {
    if (!item?.id) continue;
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

function normalizeMessageItems(items: unknown): UiConversationMessage[] {
  return Array.isArray(items) ? (items as UiConversationMessage[]).filter(Boolean) : [];
}

function isSameMessageSnapshot(a: UiConversationMessage[], b: UiConversationMessage[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const left = a[i];
    const right = b[i];
    if (!left || !right) return false;
    if (left.id !== right.id) return false;
    if (left.localStatus !== right.localStatus) return false;
    if ((left.text || '') !== (right.text || '')) return false;
  }
  return true;
}

function formatPriceLabel(priceType?: components['schemas']['PriceType'] | null, amount?: number | null): string {
  if (priceType === 'NEGOTIABLE') return '面议';
  if (amount == null) return '';
  return `￥${fenToYuan(amount)}`;
}


function shouldShowTimeDivider(current: UiConversationMessage, prev?: UiConversationMessage): boolean {
  if (!prev) return true;
  const currentAt = Date.parse(current.createdAt || '');
  const prevAt = Date.parse(prev.createdAt || '');
  if (!Number.isFinite(currentAt) || !Number.isFinite(prevAt)) return true;
  return currentAt - prevAt >= TIME_SECTION_GAP_MS;
}

function resolveConversationContentTitle(summary?: Pick<ConversationSummary, 'contentTitle'> | null): string {
  return normalizeDisplayText(summary?.contentTitle);
}

function resolveAvatarFallbackText(value: unknown, fallback: string): string {
  return displayInitial(value, fallback);
}

export default function ChatPage() {
  const rawConversationId = useRouteStringParam('conversationId') || '';
  const conversationId = useRouteUuidParam('conversationId') || '';
  const conversationIdRef = useRef(conversationId);
  const invalidConversationId = Boolean(rawConversationId && !conversationId);

  const [auth, setAuth] = useState(() => ({
    token: getToken(),
    onboardingDone: isOnboardingDone(),
    verificationStatus: getVerificationStatus(),
  }));
  const token = auth.token;
  const onboardingDone = auth.onboardingDone;
  const verificationStatus = auth.verificationStatus;
  const canChat = Boolean(token) && onboardingDone && verificationStatus === 'APPROVED';

  const [pageVisible, setPageVisible] = useState(true);
  const [meId, setMeId] = useState<string | null>(null);
  const [meAvatarUrl, setMeAvatarUrl] = useState('');
  const [meAvatarFallback, setMeAvatarFallback] = useState('我');
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PagedConversationMessage | null>(null);
  const [conversation, setConversation] = useState<ConversationSummary | null>(null);
  const [contextCard, setContextCard] = useState<ContextCard | null>(null);
  const [showSafety, setShowSafety] = useState(true);
  const [scrollIntoView, setScrollIntoView] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [emojiPanelOpen, setEmojiPanelOpen] = useState(false);
  const hasDraft = text.trim().length > 0;
  const authTokenRef = useRef<string | null>(token);
  const meLoadSeqRef = useRef(0);
  const allowNextLineBreakRef = useRef(false);

  useDidShow(() => {
    setPageVisible(true);
  });

  useDidHide(() => {
    setPageVisible(false);
  });

  useEffect(() => {
    const off = onAuthChanged(() => {
      const next = {
        token: getToken(),
        onboardingDone: isOnboardingDone(),
        verificationStatus: getVerificationStatus(),
      };
      setAuth((prev) => {
        if (
          prev.token === next.token &&
          prev.onboardingDone === next.onboardingDone &&
          prev.verificationStatus === next.verificationStatus
        ) {
          return prev;
        }
        return next;
      });
    });
    return () => off();
  }, []);

  useEffect(() => {
    authTokenRef.current = token;
  }, [token]);

  const items = useMemo(() => normalizeMessageItems(data?.items), [data?.items]);
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

  const getConversationDisplayName = useCallback((c: ConversationSummary | null): string => {
    if (!c) return '沟通详情';
    const contentType = String(c.contentType || '').toUpperCase();
    if (contentType === 'SUPPORT') return '平台客服助手';
    if (contentType === 'DISPUTE') return resolveConversationContentTitle(c) || '订单争议';
    if (contentType === 'MAINTENANCE') return resolveConversationContentTitle(c) || '专利年费代缴';
    const role = c.counterpart?.role;
    if (role === 'cs') return '平台客服助手';
    if (role === 'admin') return '交易通知';
    return resolveConversationEntityDisplayName(c);
  }, []);

  const displayName = useMemo(() => getConversationDisplayName(conversation), [conversation, getConversationDisplayName]);
  const counterpartAvatar = useMemo(() => conversation?.counterpart?.avatarUrl || '', [conversation?.counterpart?.avatarUrl]);

  const applyMeProfile = useCallback((profile: Me | null | undefined) => {
    setMeId(profile?.id || null);
    setMeAvatarUrl(normalizeDisplayText(profile?.avatarUrl || ''));
    setMeAvatarFallback(resolveAvatarFallbackText(profile?.displayName || profile?.nickname || '我', '我'));
  }, []);

  useEffect(() => {
    conversationIdRef.current = conversationId;
    setError(null);
    setLoadingMore(false);
    setText('');
    setSending(false);
    setScrollIntoView('');
    if (!conversationId) {
      setLoading(false);
      setData(null);
      setConversation(null);
      setContextCard(null);
      return;
    }

    const cachedMessages = getDetailCache<PagedConversationMessage>(CHAT_MESSAGES_CACHE_SCOPE, conversationId);
    const cachedSummary = getDetailCache<ConversationSummary>(CHAT_SUMMARY_CACHE_SCOPE, conversationId);
    const cachedContext = getDetailCache<ContextCard>(CHAT_CONTEXT_CACHE_SCOPE, conversationId);

    setData(cachedMessages || null);
    setConversation(cachedSummary || null);
    setContextCard(cachedContext || null);
    setLoading(!cachedMessages);

    if (cachedSummary) {
      void Taro.setNavigationBarTitle({ title: getConversationDisplayName(cachedSummary) });
    } else {
      void Taro.setNavigationBarTitle({ title: '沟通详情' });
    }
  }, [conversationId, getConversationDisplayName]);

  const loadMe = useCallback(async () => {
    const currentToken = token;
    const seq = ++meLoadSeqRef.current;
    const cached = getDetailCache<Me>(CHAT_ME_CACHE_SCOPE, 'me');
    if (cached?.id) {
      applyMeProfile(cached);
    }
    try {
      const current = await apiGet<Me>('/me');
      if (seq !== meLoadSeqRef.current || authTokenRef.current !== currentToken) return;
      applyMeProfile(current);
      setDetailCache(CHAT_ME_CACHE_SCOPE, 'me', current);
    } catch {
      if (seq !== meLoadSeqRef.current || authTokenRef.current !== currentToken) return;
      if (!cached) {
        applyMeProfile(null);
      }
    }
  }, [applyMeProfile, token]);

  const loadMessages = useCallback(async () => {
    const targetConversationId = conversationId;
    if (!targetConversationId) return;

    const cached = getDetailCache<PagedConversationMessage>(CHAT_MESSAGES_CACHE_SCOPE, targetConversationId);
    if (cached) {
      setData(cached);
      setLoading(false);
      setError(null);
      scrollToBottom();
    } else {
      setLoading(true);
      setError(null);
    }

    try {
      const response = await apiGet<PagedConversationMessage>(`/conversations/${targetConversationId}/messages`, { limit: 50 });
      const snapshot = {
        items: normalizeMessageItems(response?.items),
        nextCursor: response?.nextCursor ?? null,
      };
      if (conversationIdRef.current !== targetConversationId) return;
      setData(snapshot);
      setDetailCache(CHAT_MESSAGES_CACHE_SCOPE, targetConversationId, snapshot);
      scrollToBottom();
      try {
        await apiPost(`/conversations/${targetConversationId}/read`, {}, { idempotencyKey: `read-${targetConversationId}` });
      } catch {
        // ignore read marker failures
      }
    } catch (err: any) {
      if (conversationIdRef.current !== targetConversationId) return;
      if (!cached) {
        setError(err?.message || '消息加载失败');
        setData(null);
      }
    } finally {
      if (conversationIdRef.current === targetConversationId) {
        setLoading(false);
      }
    }
  }, [conversationId, scrollToBottom]);

  const pollMessages = useCallback(async () => {
    const targetConversationId = conversationId;
    if (!targetConversationId || !canChat) return;
    if (loading || loadingMore || sending) return;
    try {
      const response = await apiGet<PagedConversationMessage>(`/conversations/${targetConversationId}/messages`, { limit: 50 });
      const serverItems = normalizeMessageItems(response?.items);
      if (conversationIdRef.current !== targetConversationId) return;
      let snapshot: PagedConversationMessage | null = null;
      setData((prev) => {
        const pending = normalizeMessageItems(prev?.items).filter(
          (item) => Boolean(item.localStatus) && !serverItems.some((serverItem) => serverItem.id === item.id),
        );
        const merged = mergeMessages(serverItems, pending);
        const cursor = response?.nextCursor ?? null;
        snapshot = { items: merged, nextCursor: cursor };
        if (prev && prev.nextCursor === cursor && isSameMessageSnapshot(normalizeMessageItems(prev.items), merged)) {
          return prev;
        }
        return snapshot;
      });
      if (snapshot) {
        setDetailCache(CHAT_MESSAGES_CACHE_SCOPE, targetConversationId, snapshot);
      }
    } catch {
      // poll should not break UI
    }
  }, [canChat, conversationId, loading, loadingMore, sending]);

  const loadMore = useCallback(async () => {
    const targetConversationId = conversationId;
    if (!targetConversationId || !nextCursor || loadingMore) return;

    const anchorId = items[0]?.id;
    setLoadingMore(true);
    try {
      const response = await apiGet<PagedConversationMessage>(`/conversations/${targetConversationId}/messages`, {
        limit: 50,
        cursor: nextCursor,
      });
      const serverItems = normalizeMessageItems(response?.items);
      if (conversationIdRef.current !== targetConversationId) return;
      let snapshot: PagedConversationMessage | null = null;
      setData((prev) => {
        snapshot = {
          items: mergeMessages(serverItems, normalizeMessageItems(prev?.items)),
          nextCursor: response?.nextCursor ?? null,
        };
        return snapshot;
      });
      if (snapshot) {
        setDetailCache(CHAT_MESSAGES_CACHE_SCOPE, targetConversationId, snapshot);
      }
      if (anchorId) {
        scrollToMessage(anchorId);
      }
    } catch (err: any) {
      toast(err?.message || '加载失败');
    } finally {
      if (conversationIdRef.current === targetConversationId) {
        setLoadingMore(false);
      }
    }
  }, [conversationId, items, loadingMore, nextCursor, scrollToMessage]);

  const buildContextCard = useCallback(
    async (summary: ConversationSummary) => {
      let title = resolveConversationContentTitle(summary) || '咨询内容';
      let tag = '';
      let price = '';
      let thumbUrl = '';
      const summaryTitle = resolveConversationContentTitle(summary);
      if (summaryTitle) title = summaryTitle;

      try {
        if (summary.contentType === 'LISTING') {
          const listing = await apiGet<ListingPublic>(`/public/listings/${summary.contentId}`);
          title = displayTitleOrFallback(listing.title, title);
          tag = [patentTypeLabel(listing.patentType, { empty: '' }), tradeModeLabel(listing.tradeMode, { empty: '' })]
            .filter(Boolean)
            .join(' · ');
          price = formatPriceLabel(listing.priceType, listing.priceAmountFen);
          thumbUrl = listing.coverUrl || '';
        } else if (summary.contentType === 'ACHIEVEMENT') {
          const achievement = await apiGet<AchievementPublic>(`/public/achievements/${summary.contentId}`);
          title = displayTitleOrFallback(achievement.title, title);
          tag = displayUserName(achievement.publisher, '认证提交方');
          thumbUrl = achievement.coverUrl || '';
        } else if (String(summary.contentType || '').toUpperCase() === 'DISPUTE') {
          const order = await apiGet<OrderDetail>(`/orders/${summary.contentId}`);
          title = normalizeDisplayText(order.listingTitle)
            ? `订单争议 · ${normalizeDisplayText(order.listingTitle)}`
            : summaryTitle || '订单争议';
          tag = '订单争议';
        } else if (String(summary.contentType || '').toUpperCase() === 'MAINTENANCE') {
          const order = await apiGet<MaintenanceOrder>(`/me/patent-maintenance/orders/${summary.contentId}`);
          const yearLabel = typeof order.scheduleYearNo === 'number' && order.scheduleYearNo > 0 ? `第${order.scheduleYearNo}年` : '';
          title =
            summaryTitle ||
            ['专利年费代缴', displayTitleOrFallback(order.patentTitle, ''), yearLabel]
              .filter(Boolean)
              .join(' · ');
          tag = '专利年费代缴';
          price = order.totalAmountFen != null ? `￥${fenToYuan(order.totalAmountFen)}` : '';
        } else if (summary.contentType === 'TECH_MANAGER') {
          const manager = await apiGet<TechManagerPublic>(`/public/tech-managers/${summary.contentId}`);
          title = resolveTechManagerDisplayName(manager, title);
          tag = normalizeDisplayText(manager.organization) || '技术经理人';
          thumbUrl = manager.avatarUrl || '';
        } else if (String(summary.contentType || '').toUpperCase() === 'SUPPORT') {
          title = summaryTitle || '平台客服';
          tag = '客服会话';
        }
      } catch {
        // ignore and use summary fallback
      }

      const card: ContextCard = {
        title,
        tag,
        price,
        thumbUrl,
        contentType: summary.contentType,
        contentId: summary.contentId,
      };
      if (conversationIdRef.current !== conversationId) return;
      setContextCard(card);
      if (conversationId) {
        setDetailCache(CHAT_CONTEXT_CACHE_SCOPE, conversationId, card);
      }
    },
    [conversationId],
  );

  const loadConversationSummary = useCallback(async () => {
    const targetConversationId = conversationId;
    if (!targetConversationId) return;

    const cachedSummary = getDetailCache<ConversationSummary>(CHAT_SUMMARY_CACHE_SCOPE, targetConversationId);
    if (cachedSummary) {
      setConversation(cachedSummary);
      void Taro.setNavigationBarTitle({ title: getConversationDisplayName(cachedSummary) });
    }

    const cachedContext = getDetailCache<ContextCard>(CHAT_CONTEXT_CACHE_SCOPE, targetConversationId);
    if (cachedContext) {
      setContextCard(cachedContext);
    }

    try {
      const found = await apiGet<ConversationSummary>(`/me/conversations/${targetConversationId}`);
      if (conversationIdRef.current !== targetConversationId) return;
      setConversation(found);
      if (found) {
        setDetailCache(CHAT_SUMMARY_CACHE_SCOPE, targetConversationId, found);
        void Taro.setNavigationBarTitle({ title: getConversationDisplayName(found) });
        void buildContextCard(found);
      }
    } catch {
      if (conversationIdRef.current !== targetConversationId) return;
      if (!cachedSummary) {
        setConversation(null);
      }
    }
  }, [buildContextCard, conversationId, getConversationDisplayName]);

  useEffect(() => {
    if (!canChat) return;
    void loadConversationSummary();
  }, [canChat, loadConversationSummary]);

  useEffect(() => {
    if (!canChat) return;
    void loadMe();
    void loadMessages();
  }, [canChat, loadMe, loadMessages]);

  useEffect(() => {
    if (!canChat || !conversationId || !pageVisible) return;
    const timer = setInterval(() => {
      void pollMessages();
    }, CHAT_POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [canChat, conversationId, pageVisible, pollMessages]);

  const send = useCallback(async (textOverride?: string) => {
    if (!canChat || !conversationId || sending) return;
    const targetConversationId = conversationId;
    const value = (textOverride ?? text).trim();
    if (!value) {
      return;
    }

    const optimisticId = `local-${Date.now()}`;
    const optimistic: UiConversationMessage = {
      id: optimisticId,
      conversationId: targetConversationId,
      senderUserId: meId || 'me',
      type: 'TEXT',
      text: value,
      createdAt: new Date().toISOString(),
      localStatus: 'sending',
    };

    setData((prev) => ({
      items: [...(prev?.items || []), optimistic],
      nextCursor: prev?.nextCursor ?? null,
    }));
    scrollToBottom();
    setText('');
    setEmojiPanelOpen(false);
    setSending(true);

    try {
      const created = await apiPost<ConversationMessage>(
        `/conversations/${targetConversationId}/messages`,
        { type: 'TEXT', text: value },
        { idempotencyKey: `msg-${targetConversationId}-${Date.now()}` },
      );
      if (conversationIdRef.current !== targetConversationId) return;
      setData((prev) => ({
        items: (prev?.items || []).map((item) => (item.id === optimisticId ? (created as UiConversationMessage) : item)),
        nextCursor: prev?.nextCursor ?? null,
      }));
      scrollToBottom();
    } catch (err: any) {
      if (conversationIdRef.current !== targetConversationId) return;
      setData((prev) => ({
        items: (prev?.items || []).map((item) =>
          item.id === optimisticId ? { ...item, localStatus: 'failed' as LocalMessageStatus } : item,
        ),
        nextCursor: prev?.nextCursor ?? null,
      }));
      toast(err?.message || '发送失败');
      setText((prevText) => (prevText ? prevText : value));
    } finally {
      if (conversationIdRef.current === targetConversationId) {
        setSending(false);
      }
    }
  }, [canChat, conversationId, meId, scrollToBottom, sending, text]);

  const handleTextareaKeyDown = useCallback(
    (event: any) => {
      if (event?.key !== 'Enter') return;
      if (event?.shiftKey) {
        allowNextLineBreakRef.current = true;
        return;
      }
      event.preventDefault?.();
      void send();
    },
    [send],
  );

  const handleTextareaInput = useCallback(
    (event: any) => {
      const nextValue = String(event?.detail?.value ?? '');
      const prevLineBreaks = (text.match(/\n/g) || []).length;
      const nextLineBreaks = (nextValue.match(/\n/g) || []).length;
      if (nextLineBreaks > prevLineBreaks && !allowNextLineBreakRef.current) {
        const cursor = Number(event?.detail?.cursor);
        const valueBeforeEnter =
          Number.isFinite(cursor) && cursor > 0 && nextValue[cursor - 1] === '\n'
            ? `${nextValue.slice(0, cursor - 1)}${nextValue.slice(cursor)}`
            : nextValue.replace(/\n+$/g, '');
        setText(valueBeforeEnter);
        void send(valueBeforeEnter);
        return;
      }
      allowNextLineBreakRef.current = false;
      setText(nextValue);
    },
    [send, text],
  );

  const retry = useCallback(
    async (messageItem: UiConversationMessage) => {
      if (!canChat || !conversationId) return;
      const targetConversationId = conversationId;
      if (messageItem.type !== 'TEXT' || !messageItem.text?.trim()) return;

      setData((prev) => ({
        items: (prev?.items || []).map((item) =>
          item.id === messageItem.id ? { ...item, localStatus: 'sending' as LocalMessageStatus } : item,
        ),
        nextCursor: prev?.nextCursor ?? null,
      }));
      scrollToBottom();

      try {
        const created = await apiPost<ConversationMessage>(
          `/conversations/${targetConversationId}/messages`,
          { type: 'TEXT', text: messageItem.text },
          { idempotencyKey: `msg-${targetConversationId}-${Date.now()}` },
        );
        if (conversationIdRef.current !== targetConversationId) return;
        setData((prev) => ({
          items: (prev?.items || []).map((item) => (item.id === messageItem.id ? (created as UiConversationMessage) : item)),
          nextCursor: prev?.nextCursor ?? null,
        }));
        scrollToBottom();
      } catch (err: any) {
        if (conversationIdRef.current !== targetConversationId) return;
        setData((prev) => ({
          items: (prev?.items || []).map((item) =>
            item.id === messageItem.id ? { ...item, localStatus: 'failed' as LocalMessageStatus } : item,
          ),
          nextCursor: prev?.nextCursor ?? null,
        }));
        toast(err?.message || '发送失败');
      }
    },
    [canChat, conversationId, scrollToBottom],
  );

  const closeEmojiPanel = useCallback(() => {
    setEmojiPanelOpen(false);
  }, []);

  const stopPanelEvent = useCallback((event: any) => {
    event?.stopPropagation?.();
  }, []);

  const openEmojiSheet = useCallback((event?: any) => {
    event?.stopPropagation?.();
    if (!canChat) return;
    setEmojiPanelOpen((prev) => !prev);
  }, [canChat]);

  const appendEmoji = useCallback((emoji: string) => {
    setText((prev) => `${prev}${emoji}`);
  }, []);

  const sendReference = useCallback(
    async (referenceType: ReferenceType) => {
      if (!canChat || !conversationId || sending) return;
      const targetConversationId = conversationId;
      try {
        console.info('[chat] reference picker open', {
          referenceType,
          hasChooseMessageFile: typeof Taro.chooseMessageFile === 'function',
        });
        let chosen;
        try {
          chosen = await chooseMessageFiles({
            count: 1,
            type: referenceType === 'CONTRACT' ? 'file' : 'all',
            extension:
              referenceType === 'CONTRACT'
                ? ['pdf', 'doc', 'docx']
                : ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'jpg', 'jpeg', 'png'],
          });
        } catch (pickerError: any) {
          const pickerMessage = String(pickerError?.errMsg || pickerError?.message || pickerError || '').toLowerCase();
          const unsupported = pickerMessage.includes('not a function') || pickerMessage.includes('not support') || pickerMessage.includes('不支持');
          if (referenceType !== 'MATERIAL' || pickerMessage.includes('cancel') || !unsupported) {
            throw pickerError;
          }
          console.warn('[chat] chooseMessageFile unsupported, fallback to chooseImage', pickerError);
          chosen = await chooseImageFiles({ count: 1 });
        }
        console.info('[chat] reference picker selected', { referenceType, count: chosen.length });
        const filePath = String(chosen[0]?.path || '').trim();
        const fileName = String(chosen[0]?.name || '').trim();
        if (!filePath) return;

        setSending(true);
        const token = getToken();
        const { data: uploaded } = await uploadFileToApi<{ id?: string; fileName?: string; mimeType?: string; sizeBytes?: number; url?: string }>({
          url: `${API_BASE_URL}/files`,
          filePath,
          name: 'file',
          formData: { purpose: referenceType === 'CONTRACT' ? 'MESSAGE_CONTRACT' : 'MESSAGE_MATERIAL' },
          header: token ? { Authorization: `Bearer ${token}` } : {},
          retry: 1,
        });
        console.info('[chat] reference upload finished', { referenceType, fileId: uploaded?.id, mimeType: uploaded?.mimeType });
        const fileId = String(uploaded?.id || '').trim();
        if (!fileId) throw new Error('上传失败');
        const mimeType = String(uploaded?.mimeType || '').toLowerCase();
        const messageType = mimeType.startsWith('image/') ? 'IMAGE' : 'FILE';
        const created = await apiPost<ConversationMessage>(
          `/conversations/${targetConversationId}/messages`,
          { type: messageType, fileId, text: messageType === 'IMAGE' ? '' : fileName || uploaded?.fileName || '' },
          { idempotencyKey: `msg-file-${targetConversationId}-${Date.now()}` },
        );
        if (conversationIdRef.current !== targetConversationId) return;
        const createdWithFileMeta: UiConversationMessage = {
          ...(created as UiConversationMessage),
          fileName: fileName || uploaded?.fileName || created.fileName || null,
          sizeBytes: typeof uploaded?.sizeBytes === 'number' ? uploaded.sizeBytes : created.sizeBytes ?? null,
        };
        setData((prev) => ({
          items: [...(prev?.items || []), createdWithFileMeta],
          nextCursor: prev?.nextCursor ?? null,
        }));
        scrollToBottom();
      } catch (err: any) {
        const errMsg = String(err?.errMsg || err?.message || err || '').toLowerCase();
        if (errMsg.includes('cancel')) return;
        toast(err?.message || '文件发送失败');
      } finally {
        if (conversationIdRef.current === targetConversationId) {
          setSending(false);
        }
      }
    },
    [canChat, conversationId, scrollToBottom, sending],
  );

  const openReferenceSheet = useCallback((event?: any) => {
    event?.stopPropagation?.();
    if (!canChat) return;
    setEmojiPanelOpen(false);
    void Taro.showActionSheet({ itemList: ['引用材料', '引用合同'] })
      .then((result) => {
        if (result.tapIndex === 1) {
          void sendReference('CONTRACT');
          return;
        }
        void sendReference('MATERIAL');
      })
      .catch(() => {});
  }, [canChat, sendReference]);

  const openContextDetail = useCallback(() => {
    if (!contextCard?.contentType || !contextCard?.contentId) return;
    const id = contextCard.contentId;
    const contentType = String(contextCard.contentType || '').toUpperCase();
    if (contentType === 'LISTING') {
      Taro.navigateTo({ url: `/subpackages/listing/detail/index?listingId=${id}` });
      return;
    }
    if (contentType === 'DISPUTE') {
      Taro.navigateTo({ url: `/subpackages/orders/detail/index?orderId=${id}` });
      return;
    }
    if (contentType === 'MAINTENANCE') {
      Taro.navigateTo({ url: `/subpackages/maintenance/index?tab=progress&orderId=${id}` });
      return;
    }
    if (contentType === 'TECH_MANAGER') {
      Taro.navigateTo({ url: `/subpackages/tech-managers/detail/index?techManagerId=${id}` });
      return;
    }
    if (contentType === 'ACHIEVEMENT') {
      Taro.navigateTo({ url: `/subpackages/achievement/detail/index?achievementId=${id}` });
    }
  }, [contextCard]);

  if (invalidConversationId) {
    return (
      <View className="container chat-page">
        <MissingParamCard
          title="咨询会话无效"
          message="当前咨询链接已失效，请返回专利详情重新发起咨询。"
          actionText="返回上一页"
          onAction={() => void safeNavigateBack()}
        />
      </View>
    );
  }

  if (!conversationId) {
    return (
      <View className="container chat-page">
        <MissingParamCard onAction={() => void safeNavigateBack()} />
      </View>
    );
  }

  return (
    <View className="container chat-page" onClick={closeEmojiPanel}>
      <View className="chat-header">
        <View className="chat-header-left" onClick={() => void safeNavigateBack()}>
          <Text className="chat-header-back">{'<'}</Text>
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
            <Text className="chat-safety-text">系统提醒：请勿私下转账或交换联系方式，交易请通过平台完成。</Text>
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
        <PermissionCard
          title="需要登录"
          message="登录并审核通过后才能查看当前沟通记录。"
          actionText="去登录"
          onAction={() => Taro.navigateTo({ url: '/subpackages/login/index' })}
        />
      ) : !onboardingDone ? (
        <PermissionCard
          title="需要选择身份"
          message="首次进入需先完成身份选择，审核通过后可咨询与交易。"
          actionText="去选择身份"
          onAction={() => Taro.navigateTo({ url: '/subpackages/onboarding/choose-identity/index' })}
        />
      ) : verificationStatus !== 'APPROVED' ? (
        <AuditPendingCard
          title={verificationStatus === 'REJECTED' ? '资料审核未通过' : '资料审核中'}
          message={
            verificationStatus === 'REJECTED'
              ? '请完善并重新提交资料，审核通过后可继续咨询与交易。'
              : '资料审核通过后即可继续咨询与交易。'
          }
        />
      ) : loading ? (
        <LoadingCard />
      ) : error ? (
        <ErrorCard message={error} onRetry={loadMessages} />
      ) : data?.items?.length ? (
        <View className="chat-content">
          <ScrollView
            className="chat-scroll"
            scrollY
            scrollIntoView={scrollIntoView}
            scrollWithAnimation
            style={{ height: '100%' }}
          >
            <View className="chat-scroll-inner">
              {canLoadMore ? (
                <View className="chat-load-more">
                  <View className="chat-load-more-btn-wrap">
                    <View className={`chat-load-more-btn${loadingMore ? ' is-loading' : ''}`} onClick={loadMore}>
                      <Text className="chat-load-more-btn-text">{loadingMore ? '加载中...' : '加载更早消息'}</Text>
                    </View>
                  </View>
                </View>
              ) : null}

              {items.map((item, index) => {
                const prev = index > 0 ? items[index - 1] : undefined;
                const showTimeDivider = shouldShowTimeDivider(item, prev);
                const isMe = Boolean(meId) && item.senderUserId === meId;
                const isSystem = item.type === 'SYSTEM';
                const isReference = item.type === 'REFERENCE';
                const isFile = item.type === 'FILE' && Boolean(item.fileUrl);
                const fileName = isFile ? fileLabelFromMessage(item) : '';
                const fileSize = isFile ? formatFileSize(item.sizeBytes) : '';
                const fileType = isFile ? fileTypeLabel(fileName) : '';
                const bubbleClass = `chat-bubble${isMe ? ' chat-bubble-me' : ''}${isReference ? ' chat-bubble-ref' : ''}${isFile ? ' chat-bubble-file' : ''}`;

                if (isSystem) {
                  return (
                    <React.Fragment key={item.id}>
                      {showTimeDivider ? <View className="chat-time-divider">{formatTimeSmart(item.createdAt)}</View> : null}
                      <View id={`msg-${item.id}`} className="chat-system-row">
                        <Text className="chat-system-text">{item.text || '系统消息'}</Text>
                      </View>
                    </React.Fragment>
                  );
                }

                return (
                  <React.Fragment key={item.id}>
                    {showTimeDivider ? <View className="chat-time-divider">{formatTimeSmart(item.createdAt)}</View> : null}
                    <View id={`msg-${item.id}`} className={`chat-row ${isMe ? 'chat-row-me' : ''}`}>
                      {!isMe ? (
                        <Avatar size="40" src={counterpartAvatar} background="var(--c-divider)" color="var(--c-muted)">
                          {resolveAvatarFallbackText(displayName, '沟')}
                        </Avatar>
                      ) : null}

                      <View className={bubbleClass}>
                        {isReference ? (
                          <View className="chat-ref">
                            <Text className="chat-ref-label">
                              {item.referenceType === 'CONTRACT' ? '合同引用' : '材料引用'}
                            </Text>
                            <Text className="chat-ref-title">{item.referenceTitle || '已引用资料'}</Text>
                            {item.referenceNote ? <Text className="chat-ref-note clamp-1">{item.referenceNote}</Text> : null}
                            <Text className="chat-ref-action">查看</Text>
                          </View>
                        ) : item.type === 'IMAGE' && item.fileUrl ? (
                          <Image
                            className="chat-image"
                            src={item.fileUrl}
                            mode="aspectFill"
                            onClick={() => {
                              void Taro.previewImage({ urls: [item.fileUrl as string] });
                            }}
                          />
                        ) : item.type === 'FILE' && item.fileUrl ? (
                          <View
                            className="chat-file"
                            onClick={() => {
                              void openChatFile(item.fileUrl as string);
                            }}
                          >
                            <View className="chat-file-body">
                              <Text className="chat-file-name clamp-1">{fileName}</Text>
                              {fileSize ? <Text className="chat-file-size">{fileSize}</Text> : null}
                            </View>
                            <View className="chat-file-badge">
                              <View className="chat-file-badge-fold" />
                              <Text className={`chat-file-badge-text${fileType.length > 1 ? ' is-small' : ''}`}>{fileType}</Text>
                            </View>
                          </View>
                        ) : item.type === 'TEXT' || item.type === 'EMOJI' ? (
                          <Text>{item.text || '暂不支持预览这条消息'}</Text>
                        ) : (
                          <Text>{item.text || item.fileUrl || '暂不支持预览这条消息'}</Text>
                        )}

                        {item.localStatus ? (
                          <View className="chat-meta-row">
                            {item.localStatus === 'sending' ? (
                              <Text className={`chat-meta ${isMe ? 'chat-meta-me' : ''}`}>发送中...</Text>
                            ) : item.localStatus === 'failed' ? (
                              <Text
                                className={`chat-meta chat-meta-action ${isMe ? 'chat-meta-action-me' : ''}`}
                                onClick={() => void retry(item)}
                              >
                                重试
                              </Text>
                            ) : null}
                          </View>
                        ) : null}
                      </View>

                      {isMe ? (
                        <Avatar size="40" src={meAvatarUrl} background="var(--c-soft)" color="var(--c-primary)">
                          {meAvatarFallback}
                        </Avatar>
                      ) : null}
                    </View>
                  </React.Fragment>
                );
              })}
              <View className="chat-scroll-spacer" />
              <View id="chat-bottom" />
            </View>
          </ScrollView>
        </View>
      ) : (
        <View className="chat-empty-state">
          <View className="chat-empty-ill-wrap">
            <Image className="chat-empty-ill" src={emptyChat} svg mode="aspectFit" />
          </View>
          <Text className="chat-empty-title">暂无会话消息</Text>
          <Text className="chat-empty-message">发一条消息，开始本次沟通。</Text>
        </View>
      )}

      {canChat ? (
        <View className="chat-input-bar">
          <View className="chat-input-inner">
            <View className="chat-input-field">
              <Textarea
                className="chat-textarea"
                value={text}
                autoHeight
                fixed
                maxlength={-1}
                confirmType="send"
                showConfirmBar={false}
                disableDefaultPadding
                onInput={handleTextareaInput}
                nativeProps={{ onKeyDown: handleTextareaKeyDown }}
                placeholder="发送消息..."
                placeholderClass="chat-textarea-placeholder"
                onConfirm={() => void send()}
              />
              <View className="chat-input-toolbar">
                <View className="chat-input-tools-left">
                  <View
                    className="chat-input-tool"
                    hoverClass="chat-input-tool-hover"
                    data-testid="chat-reference"
                    onClick={openReferenceSheet}
                  >
                    <Image className="chat-tool-folder-icon" src={folderIcon} mode="aspectFit" svg />
                  </View>
                  <View
                    className={`chat-input-tool ${emojiPanelOpen ? 'is-active' : ''}`}
                    hoverClass="chat-input-tool-hover"
                    data-testid="chat-emoji"
                    onClick={openEmojiSheet}
                  >
                    <View className="chat-tool-smile">
                      <View className="chat-tool-smile-eye chat-tool-smile-eye-left" />
                      <View className="chat-tool-smile-eye chat-tool-smile-eye-right" />
                      <View className="chat-tool-smile-mouth" />
                    </View>
                  </View>
                </View>
                <View className="chat-input-tools-right">
                  <View
                    className={`chat-send-btn ${hasDraft ? 'is-ready' : 'is-disabled'} ${sending ? 'is-loading' : ''}`}
                    data-testid="chat-send"
                    onClick={() => {
                      if (!hasDraft) return;
                      void send();
                    }}
                  >
                    <Text className="chat-send-text">{sending ? '...' : '发送'}</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
          {emojiPanelOpen ? (
            <View className="chat-emoji-panel" onClick={stopPanelEvent}>
              <View className="chat-emoji-arrow" />
              <Text className="chat-emoji-section-title">最近使用</Text>
              <View className="chat-emoji-recent-row">
                {EMOJI_PRESETS.slice(3, 13).map((emoji) => (
                  <View
                    key={`recent-${emoji}`}
                    className="chat-emoji-item"
                    hoverClass="chat-emoji-item-hover"
                    onClick={() => appendEmoji(emoji)}
                  >
                    <Text className="chat-emoji-text">{emoji}</Text>
                  </View>
                ))}
              </View>
              <Text className="chat-emoji-section-title">所有表情</Text>
              <View className="chat-emoji-grid">
                {EMOJI_PRESETS.map((emoji) => (
                  <View
                    key={emoji}
                    className="chat-emoji-item"
                    hoverClass="chat-emoji-item-hover"
                    onClick={() => appendEmoji(emoji)}
                  >
                    <Text className="chat-emoji-text">{emoji}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
