import { PaperClipOutlined, SmileOutlined } from '@ant-design/icons';
import {
  Avatar,
  Badge,
  Button,
  Card,
  DatePicker,
  Descriptions,
  Drawer,
  Empty,
  Grid,
  Input,
  Form,
  List,
  Pagination,
  Modal,
  Popover,
  Select,
  Space,
  Switch,
  Tag,
  Typography,
  InputNumber,
  message,
} from 'antd';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { components } from '@ipmoney/api-types';
import { useNavigate } from 'react-router-dom';

import { apiDelete, apiGet, apiPatch, apiPost, apiUploadFile } from '../lib/api';
import { fenToYuan, fenToYuanNumber, formatTimeSmart, yuanToFen } from '../lib/format';
import {
  DEFAULT_LISTING_TOPIC_OPTIONS,
  fetchAdminListingTopicOptions,
  topicLabelFromOptions,
} from '../lib/homeLandingConfig';
import { orderStatusLabel } from '../lib/labels';
import { displayAdminTitleWithSecondary, displayUserInitial, displayUserName, normalizeUserFacingText } from '../lib/userFacingText';
import { RequestErrorAlert } from '../ui/RequestState';
import { confirmAction } from '../ui/confirm';

type ListingTopic = components['schemas']['ListingTopic'];
type AssignedFilter = 'ALL' | 'MINE' | 'ASSIGNED' | 'UNASSIGNED';
type ConversationChannelFilter = 'ALL' | 'CONSULTATION' | 'SUPPORT' | 'DISPUTE' | 'MAINTENANCE';
type DateRangeValue = [any, any] | null;

type ConversationSummary = {
  id: string;
  contentType: 'LISTING' | 'ACHIEVEMENT' | 'TECH_MANAGER' | 'SUPPORT' | 'DISPUTE' | 'MAINTENANCE';
  contentId: string;
  contentTitle: string;
  orderId?: string | null;
  orderStatus?: components['schemas']['OrderStatus'] | string | null;
  orderTitle?: string | null;
  patentId?: string | null;
  patentTitle?: string | null;
  patentNoDisplay?: string | null;
  applicationNoDisplay?: string | null;
  maintenanceYearNo?: number | null;
  maintenancePatentTitle?: string | null;
  listingId?: string | null;
  listingTitle?: string | null;
  listingTopics?: ListingTopic[];
  lastMessagePreview?: string | null;
  lastMessageAt: string;
  unreadCount?: number;
  assignedAgentUserIds?: string[];
  counterpart: {
    id: string;
    displayName?: string | null;
    nickname?: string | null;
    avatarUrl?: string | null;
    role?: string | null;
  };
};

type ConversationMessage = {
  id: string;
  conversationId: string;
  senderUserId: string;
  type: 'TEXT' | 'EMOJI' | 'IMAGE' | 'FILE' | 'SYSTEM';
  text?: string | null;
  fileId?: string | null;
  fileUrl?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  createdAt: string;
};

type StaffUser = {
  id: string;
  name: string;
  email?: string;
  roleIds: string[];
};

type AuthSession = {
  userId: string;
  role?: string;
  roleNames?: string[];
  roleIds?: string[];
  permissions?: string[];
};

type Paged<T> = { items: T[]; page: { page: number; pageSize: number; total: number } };
type PagedMessages = { items: ConversationMessage[]; nextCursor?: string | null };
type UserListResponse = { items: StaffUser[] };
type PatentDetail = {
  id: string;
  jurisdiction: 'CN';
  applicationNoNorm: string;
  applicationNoDisplay?: string;
  publicationNoDisplay?: string;
  patentNoDisplay?: string;
  grantPublicationNoDisplay?: string;
  patentType: 'INVENTION' | 'UTILITY_MODEL' | 'DESIGN';
  title: string;
  abstract?: string;
  inventorNames?: string[];
  assigneeNames?: string[];
  applicantNames?: string[];
  filingDate?: string;
  publicationDate?: string;
  grantDate?: string;
  legalStatus?: 'PENDING' | 'GRANTED' | 'EXPIRED' | 'INVALIDATED' | 'UNKNOWN';
  sourcePrimary?: 'USER' | 'ADMIN' | 'PROVIDER';
  sourceUpdatedAt?: string;
  tradeSnapshot?: {
    listingId?: string | null;
    priceType?: 'FIXED' | 'NEGOTIABLE' | null;
    priceAmountFen?: number | null;
    depositAmountFen?: number | null;
    supplyType?: 'UNIVERSITY' | 'UNIVERSITY_985' | 'UNIVERSITY_211' | 'RESEARCH_INSTITUTE' | 'OTHER' | null;
    seller?: {
      id: string;
      displayName?: string | null;
      nickname?: string | null;
      avatarUrl?: string | null;
      verificationStatus?: 'PENDING' | 'APPROVED' | 'REJECTED' | null;
      verificationType?: 'PERSON' | 'COMPANY' | 'ACADEMY' | 'GOVERNMENT' | 'ASSOCIATION' | 'TECH_MANAGER' | null;
      orgCategory?: 'UNIVERSITY' | 'UNIVERSITY_985' | 'UNIVERSITY_211' | 'RESEARCH_INSTITUTE' | 'OTHER' | null;
    } | null;
  } | null;
  createdAt: string;
  updatedAt: string;
};
type ListingDetail = {
  id: string;
  priceType?: 'FIXED' | 'NEGOTIABLE' | null;
  priceAmountFen?: number | null;
  depositAmountFen?: number | null;
};

type ListingEditFormValues = {
  priceType?: 'FIXED' | 'NEGOTIABLE';
  priceAmountYuan?: number | null;
  depositAmountYuan?: number | null;
};
type TimelineLine = { kind: 'divider'; key: string; label: string } | { kind: 'message'; key: string; message: ConversationMessage };

const EMOJI_PRESETS = ['😀', '😂', '😍', '👍', '🙏', '🎉', '🔥', '❤️'];

const priceTypeOptions: Array<{ value: 'FIXED' | 'NEGOTIABLE'; label: string }> = [
  { value: 'NEGOTIABLE', label: '面议' },
  { value: 'FIXED', label: '固定价' },
];

const ASSIGNED_FILTER_OPTIONS: Array<{ value: AssignedFilter; label: string }> = [
  { value: 'ALL', label: '全部会话' },
  { value: 'MINE', label: '仅我负责' },
  { value: 'ASSIGNED', label: '已分配' },
  { value: 'UNASSIGNED', label: '未分配' },
];

const CHANNEL_FILTER_OPTIONS: Array<{ value: ConversationChannelFilter; label: string }> = [
  { value: 'ALL', label: '全部类型' },
  { value: 'CONSULTATION', label: '咨询' },
  { value: 'SUPPORT', label: '客服' },
  { value: 'DISPUTE', label: '争议' },
  { value: 'MAINTENANCE', label: '年费托管' },
];

function hasFullPlatformConversationAccess(session?: AuthSession | null): boolean {
  if (!session) return false;
  if ((session.permissions || []).includes('*')) return true;
  if (String(session.role || '').toLowerCase() === 'admin') return true;
  if ((session.roleNames || []).some((item) => String(item || '').toLowerCase() === 'admin')) return true;
  return (session.roleIds || []).some((item) => String(item || '') === 'role-admin');
}

function toDateKey(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || '').slice(0, 10);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function topicColor(topic: ListingTopic): string {
  if (topic === 'HIGH_TECH_RETIRED') return 'blue';
  if (topic === 'SLEEPING') return 'gold';
  if (topic === 'AWARD_WINNING') return 'green';
  if (topic === 'FIVE_STAR') return 'magenta';
  if (topic === 'OPEN_LICENSE') return 'geekblue';
  return 'default';
}

function channelLabel(contentType: ConversationSummary['contentType']): string {
  if (contentType === 'SUPPORT') return '客服';
  if (contentType === 'DISPUTE') return '争议';
  if (contentType === 'MAINTENANCE') return '年费托管';
  if (contentType === 'LISTING') return '咨询';
  return '会话';
}

function channelTagColor(contentType: ConversationSummary['contentType']): string {
  if (contentType === 'SUPPORT') return 'cyan';
  if (contentType === 'DISPUTE') return 'volcano';
  if (contentType === 'MAINTENANCE') return 'purple';
  if (contentType === 'LISTING') return 'blue';
  return 'default';
}

function conversationTitle(item: ConversationSummary): string {
  return displayAdminTitleWithSecondary(item.contentTitle, fallbackConversationTitle(item), {
    secondary: item.listingTitle,
  });
}

function safeChannelLabel(contentType: ConversationSummary['contentType']): string {
  if (contentType === 'ACHIEVEMENT') return '成果咨询';
  return channelLabel(contentType);
}

function safeChannelTagColor(contentType: ConversationSummary['contentType']): string {
  if (contentType === 'ACHIEVEMENT') return 'green';
  return channelTagColor(contentType);
}

function conversationCounterpartName(item: Pick<ConversationSummary, 'counterpart'>): string {
  return displayUserName(item.counterpart, '平台用户');
}

function staffDisplayName(user: Pick<StaffUser, 'name' | 'email'> | null | undefined, fallback = '平台坐席'): string {
  return normalizeUserFacingText(user?.name) || normalizeUserFacingText(user?.email) || fallback;
}

function assignedStaffName(userId: string, staffNameMap: Map<string, string>): string {
  return normalizeUserFacingText(staffNameMap.get(userId)) || '平台坐席';
}

function conversationPreviewText(item: Pick<ConversationSummary, 'lastMessagePreview'>): string {
  return normalizeUserFacingText(item.lastMessagePreview) || '暂无新消息';
}

function resolvedConversationTitle(item: ConversationSummary): string {
  return conversationTitle(item);
}

function fallbackConversationTitle(item: Pick<ConversationSummary, 'contentType'>): string {
  if (item.contentType === 'SUPPORT') return '平台客服会话';
  if (item.contentType === 'DISPUTE') return '订单争议会话';
  if (item.contentType === 'MAINTENANCE') return '年费托管会话';
  if (item.contentType === 'ACHIEVEMENT') return '成果咨询会话';
  if (item.contentType === 'LISTING') return '挂牌咨询会话';
  return '业务会话待确认';
}

function conversationMessageTypeLabel(type: ConversationMessage['type']): string {
  if (type === 'IMAGE') return '图片消息';
  if (type === 'FILE') return '文件消息';
  if (type === 'EMOJI') return '表情消息';
  if (type === 'SYSTEM') return '系统消息';
  return '消息内容待确认';
}

function conversationMessageBody(messageItem: ConversationMessage): string {
  const text = normalizeUserFacingText(messageItem.text);
  if (text) return text;
  const fileName = normalizeUserFacingText(messageItem.fileName);
  if (fileName) return fileName;
  return conversationMessageTypeLabel(messageItem.type);
}

function conversationMessageFileName(messageItem: ConversationMessage): string {
  const fileName = normalizeUserFacingText(messageItem.fileName);
  if (fileName) return fileName;
  const text = normalizeUserFacingText(messageItem.text);
  if (text) return text;
  const rawUrl = normalizeUserFacingText(messageItem.fileUrl);
  if (!rawUrl) return 'file';
  try {
    const parsed = new URL(rawUrl);
    const path = parsed.pathname || '';
    return decodeURIComponent(path.split('/').pop() || 'file');
  } catch {
    return decodeURIComponent(rawUrl.split('/').pop() || 'file');
  }
}

function normalizeAttachmentLabel(value: string): string {
  return value.replace(/\\/g, '/').split('/').pop()?.trim().toLowerCase() || '';
}

function looksLikeImageFileName(value: string): boolean {
  return /\.(png|jpe?g|gif|webp|bmp|svg|heic|heif|avif)$/i.test(value);
}

function conversationImageCaption(messageItem: ConversationMessage): string {
  const text = normalizeUserFacingText(messageItem.text);
  if (!text) return '';
  const fileName = conversationMessageFileName(messageItem);
  const normalizedText = normalizeAttachmentLabel(text);
  const normalizedFileName = normalizeAttachmentLabel(fileName);
  if (normalizedText && normalizedText === normalizedFileName) return '';
  if (looksLikeImageFileName(text)) return '';
  return text;
}

function formatFileSize(sizeBytes?: number | null): string {
  if (typeof sizeBytes !== 'number' || !Number.isFinite(sizeBytes) || sizeBytes <= 0) return '';
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  const kb = sizeBytes / 1024;
  if (kb < 1024) return `${kb >= 100 ? Math.round(kb) : kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb >= 100 ? Math.round(mb) : mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
}

function displayPatentText(value?: string | null): string {
  return normalizeUserFacingText(value) || '-';
}

function patentTypeLabel(value?: PatentDetail['patentType']): string {
  if (value === 'UTILITY_MODEL') return '实用新型';
  if (value === 'DESIGN') return '外观设计';
  if (value === 'INVENTION') return '发明';
  return '类型待确认';
}

function patentLegalStatusLabel(value?: PatentDetail['legalStatus']): string {
  if (value === 'GRANTED') return '已授权';
  if (value === 'PENDING') return '审查中';
  if (value === 'EXPIRED') return '已失效';
  if (value === 'INVALIDATED') return '已无效';
  if (value === 'UNKNOWN') return '状态待确认';
  return '状态待确认';
}

function patentLegalStatusColor(value?: PatentDetail['legalStatus']): string {
  if (value === 'GRANTED') return 'green';
  if (value === 'PENDING') return 'gold';
  if (value === 'EXPIRED') return 'default';
  if (value === 'INVALIDATED') return 'red';
  return 'default';
}

function patentSourceLabel(value?: PatentDetail['sourcePrimary']): string {
  if (value === 'ADMIN') return '后台录入';
  if (value === 'USER') return '用户上传';
  if (value === 'PROVIDER') return '外部数据源';
  return '来源待确认';
}

function patentNamesLabel(values?: string[] | null): string {
  const list = (values || []).map((item) => normalizeUserFacingText(item)).filter(Boolean);
  return list.length ? list.join('、') : '-';
}

function patentTradeTypeLabel(value?: string | null): string {
  if (value === 'FIXED') return '固定价';
  if (value === 'NEGOTIABLE') return '可议价';
  return '-';
}

function patentSupplyTypeLabel(value?: string | null): string {
  if (value === 'UNIVERSITY') return '普通高校';
  if (value === 'UNIVERSITY_985') return '985高校';
  if (value === 'UNIVERSITY_211') return '211高校';
  if (value === 'RESEARCH_INSTITUTE') return '科研院所';
  if (value === 'OTHER') return '其他';
  return '-';
}

function orderProgressColor(status?: string | null): string {
  if (status === 'COMPLETED') return 'green';
  if (status === 'CANCELLED' || status === 'REFUNDED') return 'red';
  if (status === 'FINAL_PAID_ESCROW' || status === 'READY_TO_SETTLE') return 'blue';
  if (status === 'DEPOSIT_PAID' || status === 'WAIT_FINAL_PAYMENT') return 'gold';
  return 'default';
}

export function PlatformConversationsPage() {
  const navigate = useNavigate();
  const screens = Grid.useBreakpoint();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown | null>(null);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paged<ConversationSummary> | null>(null);

  const [draftQ, setDraftQ] = useState('');
  const [draftAssigned, setDraftAssigned] = useState<AssignedFilter>('ALL');
  const [draftChannel, setDraftChannel] = useState<ConversationChannelFilter>('ALL');
  const [draftListingTopic, setDraftListingTopic] = useState<ListingTopic | ''>('');
  const [draftUpdatedRange, setDraftUpdatedRange] = useState<DateRangeValue>(null);

  const [appliedQ, setAppliedQ] = useState('');
  const [appliedAssigned, setAppliedAssigned] = useState<AssignedFilter>('ALL');
  const [appliedChannel, setAppliedChannel] = useState<ConversationChannelFilter>('ALL');
  const [appliedListingTopic, setAppliedListingTopic] = useState<ListingTopic | ''>('');
  const [appliedUpdatedRange, setAppliedUpdatedRange] = useState<DateRangeValue>(null);

  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [targetUserId, setTargetUserId] = useState('');
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [currentUserId, setCurrentUserId] = useState('');
  const [fullConversationAccess, setFullConversationAccess] = useState<boolean | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [patentDetailOpen, setPatentDetailOpen] = useState(false);
  const [patentDetailLoading, setPatentDetailLoading] = useState(false);
  const [patentDetail, setPatentDetail] = useState<PatentDetail | null>(null);
  const [listingEditOpen, setListingEditOpen] = useState(false);
  const [listingEditSubmitting, setListingEditSubmitting] = useState(false);
  const [listingEditForm] = Form.useForm<ListingEditFormValues>();
  const [listingEditListingId, setListingEditListingId] = useState('');
  const [listingTopicOptions, setListingTopicOptions] =
    useState<Array<{ value: ListingTopic; label: string }>>(DEFAULT_LISTING_TOPIC_OPTIONS);

  const messageListRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const olderAnchorRef = useRef<number | null>(null);
  const activeConversationIdRef = useRef<string | null>(null);
  const latestMessageLoadIdRef = useRef(0);
  const conversationsLoadIdRef = useRef(0);

  const activeConversation = useMemo(
    () => (data?.items || []).find((item) => item.id === activeConversationId) || null,
    [activeConversationId, data?.items],
  );

  const staffNameMap = useMemo(() => {
    const out = new Map<string, string>();
    for (const user of staffUsers) {
      out.set(user.id, staffDisplayName(user));
    }
    return out;
  }, [staffUsers]);

  const timeline = useMemo<TimelineLine[]>(() => {
    const out: TimelineLine[] = [];
    let lastDate = '';
    for (const item of messages) {
      const key = toDateKey(item.createdAt);
      if (key !== lastDate) {
        out.push({ kind: 'divider', key: `date-${key}`, label: key });
        lastDate = key;
      }
      out.push({ kind: 'message', key: `msg-${item.id}`, message: item });
    }
    return out;
  }, [messages]);

  const enabledTopicSet = useMemo(
    () => new Set<ListingTopic>(listingTopicOptions.map((item) => item.value)),
    [listingTopicOptions],
  );
  const topicLabel = useCallback(
    (topic: ListingTopic) => topicLabelFromOptions(topic, listingTopicOptions),
    [listingTopicOptions],
  );

  const loadStaffContext = useCallback(async () => {
    try {
      const [staffRes, sessionRes] = await Promise.all([
        apiGet<UserListResponse>('/admin/rbac/users', { scope: 'STAFF' }),
        apiGet<AuthSession>('/auth/session'),
      ]);
      setStaffUsers(staffRes.items || []);
      setCurrentUserId(String(sessionRes?.userId || ''));
      setFullConversationAccess(hasFullPlatformConversationAccess(sessionRes));
    } catch {
      // fail open
    }
  }, []);

  const scrollToBottom = useCallback(() => {
    window.requestAnimationFrame(() => {
      const el = messageListRef.current;
      if (!el) return;
      el.scrollTop = el.scrollHeight;
    });
  }, []);

  const loadConversations = useCallback(async () => {
    const requestId = conversationsLoadIdRef.current + 1;
    conversationsLoadIdRef.current = requestId;
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, any> = {
        page,
        pageSize: 20,
        q: appliedQ.trim() || undefined,
        assigned: appliedAssigned === 'ALL' ? undefined : appliedAssigned,
        channel: appliedChannel === 'ALL' ? undefined : appliedChannel,
        listingTopic: appliedListingTopic || undefined,
        updatedFrom: appliedUpdatedRange?.[0]?.startOf('day').toISOString(),
        updatedTo: appliedUpdatedRange?.[1]?.endOf('day').toISOString(),
      };
      const res = await apiGet<Paged<ConversationSummary>>('/admin/conversations/platform', params);
      if (conversationsLoadIdRef.current !== requestId) return null;
      setData(res);
      return res;
    } catch (err: any) {
      if (conversationsLoadIdRef.current !== requestId) return null;
      setError(err);
      message.error(err?.message || '会话加载失败');
      return null;
    } finally {
      if (conversationsLoadIdRef.current === requestId) {
        setLoading(false);
      }
    }
  }, [appliedAssigned, appliedChannel, appliedListingTopic, appliedQ, appliedUpdatedRange, page]);

  const loadLatestMessages = useCallback(
    async (conversationId: string) => {
      const requestId = latestMessageLoadIdRef.current + 1;
      latestMessageLoadIdRef.current = requestId;
      setMessagesLoading(true);
      try {
        const res = await apiGet<PagedMessages>(`/conversations/${conversationId}/messages`, { limit: 50 });
        if (activeConversationIdRef.current !== conversationId || latestMessageLoadIdRef.current !== requestId) return;
        setMessages(res.items || []);
        setNextCursor(res.nextCursor || null);
        try {
          await apiPost(`/conversations/${conversationId}/read`, {}, { idempotencyKey: `admin-conv-read-${Date.now()}` });
        } catch {
          // ignore
        }
        scrollToBottom();
      } catch (err: any) {
        message.error(err?.message || '消息加载失败');
      } finally {
        if (latestMessageLoadIdRef.current === requestId) {
          setMessagesLoading(false);
        }
      }
    },
    [scrollToBottom],
  );

  const loadOlderMessages = useCallback(async () => {
    if (!activeConversationId || !nextCursor || loadingOlder) return;
    const requestedConversationId = activeConversationId;
    const box = messageListRef.current;
    olderAnchorRef.current = box ? box.scrollHeight - box.scrollTop : null;
    setLoadingOlder(true);
    try {
      const res = await apiGet<PagedMessages>(`/conversations/${requestedConversationId}/messages`, {
        cursor: nextCursor,
        limit: 50,
      });
      if (activeConversationIdRef.current !== requestedConversationId) return;
      const older = res.items || [];
      if (older.length) {
        setMessages((prev) => [...older, ...prev]);
      }
      setNextCursor(res.nextCursor || null);
      window.requestAnimationFrame(() => {
        const el = messageListRef.current;
        const anchor = olderAnchorRef.current;
        if (!el || anchor == null) return;
        el.scrollTop = Math.max(0, el.scrollHeight - anchor);
      });
    } catch (err: any) {
      message.error(err?.message || '历史消息加载失败');
    } finally {
      setLoadingOlder(false);
    }
  }, [activeConversationId, loadingOlder, nextCursor]);

  const applyFilters = useCallback(() => {
    const shouldDropListingTopic = draftChannel !== 'ALL' && draftChannel !== 'CONSULTATION';
    const nextAssigned = fullConversationAccess === false ? 'MINE' : draftAssigned;
    setPage(1);
    setAppliedQ(draftQ);
    setDraftAssigned(nextAssigned);
    setAppliedAssigned(nextAssigned);
    setAppliedChannel(draftChannel);
    setAppliedListingTopic(shouldDropListingTopic ? '' : draftListingTopic);
    setAppliedUpdatedRange(draftUpdatedRange);
    if (shouldDropListingTopic && draftListingTopic) {
      setDraftListingTopic('');
    }
  }, [draftAssigned, draftChannel, draftListingTopic, draftQ, draftUpdatedRange, fullConversationAccess]);

  const applyAssignedFilter = useCallback((value: AssignedFilter) => {
    setPage(1);
    setDraftAssigned(value);
    setAppliedAssigned(value);
  }, []);

  const applyChannelFilter = useCallback(
    (value: ConversationChannelFilter) => {
      const shouldDropListingTopic = value !== 'ALL' && value !== 'CONSULTATION';
      setPage(1);
      setDraftChannel(value);
      setAppliedChannel(value);
      if (shouldDropListingTopic) {
        setDraftListingTopic('');
        setAppliedListingTopic('');
      }
    },
    [],
  );

  const applyListingTopicFilter = useCallback(
    (value: string) => {
      const next = (value as ListingTopic) || '';
      setPage(1);
      setDraftListingTopic(next);
      setAppliedListingTopic(draftChannel !== 'ALL' && draftChannel !== 'CONSULTATION' ? '' : next);
    },
    [draftChannel],
  );

  const resetFilters = useCallback(() => {
    const nextAssigned = fullConversationAccess === false ? 'MINE' : 'ALL';
    setPage(1);
    setDraftQ('');
    setDraftAssigned(nextAssigned);
    setDraftChannel('ALL');
    setDraftListingTopic('');
    setDraftUpdatedRange(null);
    setAppliedQ('');
    setAppliedAssigned(nextAssigned);
    setAppliedChannel('ALL');
    setAppliedListingTopic('');
    setAppliedUpdatedRange(null);
  }, [fullConversationAccess]);

  const assignedFilterOptions = useMemo(
    () =>
      fullConversationAccess === false
        ? ASSIGNED_FILTER_OPTIONS.filter((item) => item.value === 'MINE')
        : ASSIGNED_FILTER_OPTIONS,
    [fullConversationAccess],
  );

  const refreshCurrent = useCallback(async () => {
    await loadConversations();
    if (activeConversationId) {
      await loadLatestMessages(activeConversationId);
    }
  }, [activeConversationId, loadConversations, loadLatestMessages]);

  const sendConversationPayload = useCallback(
    async (payload: { type: 'TEXT' | 'EMOJI' | 'IMAGE' | 'FILE'; text?: string; fileId?: string }) => {
      if (!activeConversationId) {
        message.warning('请先选择会话');
        return false;
      }
      try {
        setSending(true);
        await apiPost(
          `/conversations/${activeConversationId}/messages`,
          payload,
          { idempotencyKey: `admin-conv-send-${activeConversationId}-${Date.now()}` },
        );
        await Promise.all([loadLatestMessages(activeConversationId), loadConversations()]);
        return true;
      } catch (err: any) {
        message.error(err?.message || '发送失败，请确认当前账号已分配到该会话');
        return false;
      } finally {
        setSending(false);
      }
    },
    [activeConversationId, loadConversations, loadLatestMessages],
  );

  const sendEmoji = useCallback(
    async (emojiText: string) => {
      const text = String(emojiText || '').trim();
      if (!text) return;
      const ok = await sendConversationPayload({ type: 'EMOJI', text });
      if (ok) {
        setEmojiPickerOpen(false);
      }
    },
    [sendConversationPayload],
  );

  const openFilePicker = useCallback(() => {
    if (!activeConversationId) {
      message.warning('请先选择会话');
      return;
    }
    fileInputRef.current?.click();
  }, [activeConversationId]);

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;
      if (!activeConversationId) {
        message.warning('请先选择会话');
        return;
      }
      try {
        setSending(true);
        const uploaded = await apiUploadFile(file, 'OTHER');
        const nextType: 'IMAGE' | 'FILE' = String(uploaded?.mimeType || '').toLowerCase().startsWith('image/')
          ? 'IMAGE'
          : 'FILE';
        await apiPost(
          `/conversations/${activeConversationId}/messages`,
          {
            type: nextType,
            fileId: uploaded.id,
            text: nextType === 'IMAGE' ? undefined : file.name || undefined,
          },
          { idempotencyKey: `admin-conv-file-${activeConversationId}-${Date.now()}` },
        );
        await Promise.all([loadLatestMessages(activeConversationId), loadConversations()]);
        message.success(nextType === 'IMAGE' ? '图片已发送' : '文件已发送');
      } catch (err: any) {
        message.error(err?.message || '文件发送失败');
      } finally {
        setSending(false);
      }
    },
    [activeConversationId, loadConversations, loadLatestMessages],
  );

  const sendMessage = useCallback(async () => {
    const text = String(messageText || '').trim();
    if (!activeConversationId) {
      message.warning('请先选择会话');
      return;
    }
    if (!text) {
      message.warning('请输入消息内容');
      return;
    }
    const ok = await sendConversationPayload({ type: 'TEXT', text });
    if (ok) {
      setMessageText('');
    }
  }, [activeConversationId, messageText, sendConversationPayload]);

  const assignAgent = useCallback(
    async (userId?: string) => {
      if (!activeConversationId) {
        message.warning('请先选择会话');
        return;
      }
      const normalizedUserId = String(userId || '').trim();
      try {
        setAssigning(true);
        await apiPost(
          `/admin/conversations/${activeConversationId}/agents`,
          normalizedUserId ? { userId: normalizedUserId } : {},
          { idempotencyKey: `admin-conv-agent-add-${activeConversationId}-${Date.now()}` },
        );
        setTargetUserId('');
        message.success('坐席分配成功');
        await Promise.all([loadConversations(), loadStaffContext()]);
      } catch (err: any) {
        message.error(err?.message || '坐席分配失败');
      } finally {
        setAssigning(false);
      }
    },
    [activeConversationId, loadConversations, loadStaffContext],
  );

  const removeAgent = useCallback(
    async (userId: string) => {
      if (!activeConversationId) return;
      const ok = await confirmAction({
        title: '确认移除坐席',
        content: `将移除 ${assignedStaffName(userId, staffNameMap)} 的处理权限，是否继续？`,
        danger: true,
      });
      if (!ok) return;
      try {
        setAssigning(true);
        await apiDelete(`/admin/conversations/${activeConversationId}/agents/${userId}`, {
          idempotencyKey: `admin-conv-agent-remove-${activeConversationId}-${userId}-${Date.now()}`,
        });
        message.success('坐席已移除');
        await loadConversations();
      } catch (err: any) {
        message.error(err?.message || '移除失败');
      } finally {
        setAssigning(false);
      }
    },
    [activeConversationId, loadConversations, staffNameMap],
  );

  const openPatentDetail = useCallback(async () => {
    const patentId = String(activeConversation?.patentId || '').trim();
    if (!patentId) {
      message.warning('当前会话没有可查看的专利');
      return;
    }
    setPatentDetailOpen(true);
    setPatentDetailLoading(true);
    try {
      const detail = await apiGet<PatentDetail>(`/admin/patents/${patentId}`);
      setPatentDetail(detail);
    } catch (err: any) {
      message.error(err?.message || '加载专利详情失败');
      setPatentDetailOpen(false);
    } finally {
      setPatentDetailLoading(false);
    }
  }, [activeConversation?.patentId]);

  const openListingEdit = useCallback(async () => {
    const listingId = String(activeConversation?.listingId || patentDetail?.tradeSnapshot?.listingId || '').trim();
    if (!listingId) {
      message.warning('当前会话没有可编辑的挂牌');
      return;
    }
    try {
      const detail = await apiGet<ListingDetail>(`/admin/listings/${listingId}`);
      setListingEditListingId(detail.id);
      listingEditForm.setFieldsValue({
        priceType: detail.priceType || 'NEGOTIABLE',
        priceAmountYuan: detail.priceAmountFen == null ? undefined : fenToYuanNumber(detail.priceAmountFen),
        depositAmountYuan: detail.depositAmountFen == null ? 0 : fenToYuanNumber(detail.depositAmountFen),
      });
      setListingEditOpen(true);
    } catch (err: any) {
      message.error(err?.message || '加载挂牌信息失败');
    }
  }, [activeConversation?.listingId, listingEditForm, patentDetail?.tradeSnapshot?.listingId]);

  const submitListingEdit = useCallback(async () => {
    if (!listingEditListingId) return;
    try {
      const values = await listingEditForm.validateFields();
      const payload: Record<string, unknown> = {
        priceType: values.priceType || 'NEGOTIABLE',
        depositAmountFen: yuanToFen(values.depositAmountYuan ?? 0),
      };
      if ((values.priceType || 'NEGOTIABLE') === 'FIXED') {
        if (values.priceAmountYuan == null) {
          message.error('固定价需要填写价格');
          return;
        }
        payload.priceAmountFen = yuanToFen(values.priceAmountYuan);
      } else {
        payload.priceAmountFen = null;
      }

      setListingEditSubmitting(true);
      await apiPatch(`/admin/listings/${listingEditListingId}`, payload, {
        idempotencyKey: `admin-conv-listing-edit-${listingEditListingId}-${Date.now()}`,
      });
      message.success('挂牌价格已更新');
      setListingEditOpen(false);
      if (patentDetail?.id) {
        const detail = await apiGet<PatentDetail>(`/admin/patents/${patentDetail.id}`);
        setPatentDetail(detail);
      }
      await loadConversations();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err?.message || '更新挂牌价格失败');
    } finally {
      setListingEditSubmitting(false);
    }
  }, [listingEditForm, listingEditListingId, loadConversations, patentDetail?.id]);

  useEffect(() => {
    void loadStaffContext();
  }, [loadStaffContext]);

  useEffect(() => {
    if (fullConversationAccess !== false) return;
    if (draftAssigned !== 'MINE') setDraftAssigned('MINE');
    if (appliedAssigned !== 'MINE') {
      setPage(1);
      setAppliedAssigned('MINE');
    }
  }, [appliedAssigned, draftAssigned, fullConversationAccess]);

  useEffect(() => {
    (async () => {
      const options = await fetchAdminListingTopicOptions();
      setListingTopicOptions(options);
    })();
  }, []);

  useEffect(() => {
    setDraftListingTopic((prev) => (prev && !enabledTopicSet.has(prev) ? '' : prev));
    setAppliedListingTopic((prev) => (prev && !enabledTopicSet.has(prev) ? '' : prev));
  }, [enabledTopicSet]);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    const list = data?.items || [];
    if (!list.length) {
      if (activeConversationId) setActiveConversationId(null);
      return;
    }
    if (!activeConversationId || !list.some((item) => item.id === activeConversationId)) {
      setActiveConversationId(list[0].id);
    }
  }, [activeConversationId, data?.items]);

  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      setNextCursor(null);
      setMessageText('');
      return;
    }
    setMessages([]);
    setNextCursor(null);
    setTargetUserId('');
    setMessageText('');
    void loadLatestMessages(activeConversationId);
  }, [activeConversationId, loadLatestMessages]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = window.setInterval(() => {
      void refreshCurrent();
    }, 15000);
    return () => window.clearInterval(timer);
  }, [autoRefresh, refreshCurrent]);

  useEffect(() => {
    setPatentDetailOpen(false);
    setPatentDetail(null);
  }, [activeConversationId]);

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card>
        <Typography.Title level={3} style={{ marginTop: 0 }}>
          平台会话中心
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
          统一处理咨询、客服和订单争议会话，支持筛选、分配、连续对话与历史追溯。
        </Typography.Paragraph>
        <Typography.Text type="secondary" style={{ display: 'block', marginTop: 6, fontSize: 12, lineHeight: 1.5 }}>
          注：红点为待处理提醒。客服账号表示有新消息；客服队长或全权限管理员表示有未分配的新会话。
        </Typography.Text>
      </Card>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: screens.lg ? 'minmax(360px, 440px) minmax(0, 1fr)' : '1fr',
          gap: 16,
        }}
      >
        <Card style={{ height: 'min(78vh, 900px)' }} bodyStyle={{ height: '100%', padding: 12, display: 'flex', flexDirection: 'column' }}>
          {error ? <RequestErrorAlert error={error} onRetry={loadConversations} /> : null}

          <Space direction="vertical" size={8} style={{ width: '100%', marginBottom: 8 }}>
            <Input.Search
              value={draftQ}
              allowClear
              placeholder="关键词（标题/用户昵称/会话编号）"
              onChange={(event) => setDraftQ(event.target.value)}
              onSearch={applyFilters}
            />
            <Space wrap style={{ width: '100%' }}>
              <Select<AssignedFilter>
                value={draftAssigned}
                style={{ width: 140 }}
                options={assignedFilterOptions}
                disabled={fullConversationAccess === false}
                onChange={applyAssignedFilter}
              />
              <Select<ConversationChannelFilter>
                value={draftChannel}
                style={{ width: 140 }}
                options={CHANNEL_FILTER_OPTIONS}
                onChange={applyChannelFilter}
              />
              <Select
                value={draftListingTopic}
                style={{ width: 180 }}
                options={[{ value: '', label: '全部标签' }, ...listingTopicOptions]}
                onChange={applyListingTopicFilter}
                placeholder="特色标签"
                disabled={draftChannel !== 'ALL' && draftChannel !== 'CONSULTATION'}
              />
            </Space>
            <DatePicker.RangePicker
              allowClear
              value={draftUpdatedRange as any}
              style={{ width: '100%' }}
              onChange={(value) => {
                if (!value || !value[0] || !value[1]) {
                  setDraftUpdatedRange(null);
                  return;
                }
                setDraftUpdatedRange([value[0], value[1]]);
              }}
            />
            <Space>
              <Button type="primary" onClick={applyFilters}>
                查询
              </Button>
              <Button onClick={resetFilters}>重置</Button>
              <Button onClick={() => void refreshCurrent()}>刷新</Button>
            </Space>
          </Space>

          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', borderTop: '1px solid #f0f0f0', paddingTop: 8 }}>
            <List<ConversationSummary>
              loading={loading}
              dataSource={data?.items || []}
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无会话" /> }}
              renderItem={(item) => {
                const isActive = item.id === activeConversationId;
                const assignedCount = (item.assignedAgentUserIds || []).length;
                const unread = Number(item.unreadCount || 0);
                return (
                  <List.Item
                    style={{
                      cursor: 'pointer',
                      borderRadius: 10,
                      padding: '10px 12px',
                      marginBottom: 8,
                      border: isActive ? '1px solid #91caff' : '1px solid #f0f0f0',
                      background: isActive ? '#e6f4ff' : '#fff',
                    }}
                    onClick={() => setActiveConversationId(item.id)}
                  >
                    <Space align="start" style={{ width: '100%' }}>
                        <Badge count={unread > 99 ? '99+' : unread} size="small" offset={[-2, 2]}>
                          <Avatar src={item.counterpart.avatarUrl || undefined}>
                          {displayUserInitial(conversationCounterpartName(item), '用')}
                          </Avatar>
                        </Badge>
                      <Space direction="vertical" size={4} style={{ width: '100%' }}>
                        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                          <Typography.Text strong ellipsis style={{ maxWidth: 220 }}>
                            {resolvedConversationTitle(item)}
                          </Typography.Text>
                          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                            {formatTimeSmart(item.lastMessageAt)}
                          </Typography.Text>
                        </Space>
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          咨询人：{conversationCounterpartName(item)}
                        </Typography.Text>
                        <Typography.Paragraph type="secondary" style={{ margin: 0, fontSize: 12 }} ellipsis={{ rows: 1 }}>
                          {conversationPreviewText(item)}
                        </Typography.Paragraph>
                        <Space size={[4, 4]} wrap>
                          <Tag color={safeChannelTagColor(item.contentType)}>{safeChannelLabel(item.contentType)}</Tag>
                          {(item.listingTopics || []).map((topic) => (
                            <Tag key={`${item.id}-${topic}`} color={topicColor(topic)}>
                              {topicLabel(topic)}
                            </Tag>
                          ))}
                          {assignedCount > 0 ? <Tag color="blue">已分配 {assignedCount}</Tag> : <Tag>未分配</Tag>}
                        </Space>
                      </Space>
                    </Space>
                  </List.Item>
                );
              }}
            />
          </div>

          <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 10 }}>
            <Pagination
              size="small"
              current={data?.page.page || page}
              pageSize={data?.page.pageSize || 20}
              total={data?.page.total || 0}
              showSizeChanger={false}
              onChange={(nextPage) => setPage(nextPage)}
            />
          </div>
        </Card>

        <Card style={{ height: 'min(78vh, 900px)' }} bodyStyle={{ height: '100%', padding: 0, display: 'flex', flexDirection: 'column' }}>
          {!activeConversation ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Empty description="请先在左侧选择会话" />
            </div>
          ) : (
            <>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid #f0f0f0' }}>
                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                  <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
                    <Typography.Text strong style={{ fontSize: 16 }}>
                      {resolvedConversationTitle(activeConversation)}
                    </Typography.Text>
                    <Space>
                      <Typography.Text type="secondary">自动刷新</Typography.Text>
                      <Switch checked={autoRefresh} onChange={setAutoRefresh} size="small" />
                      <Typography.Text type="secondary">{formatTimeSmart(activeConversation.lastMessageAt)}</Typography.Text>
                    </Space>
                  </Space>

                  <Space size={[6, 6]} wrap>
                    <Tag color={safeChannelTagColor(activeConversation.contentType)}>{safeChannelLabel(activeConversation.contentType)}</Tag>
                    <Tag color="processing">咨询人：{conversationCounterpartName(activeConversation)}</Tag>
                    {activeConversation.orderId ? (
                      <Tag color={orderProgressColor(activeConversation.orderStatus)}>
                        订单进度：{orderStatusLabel(activeConversation.orderStatus as components['schemas']['OrderStatus'], { empty: '待确认' })}
                      </Tag>
                    ) : null}
                    {(activeConversation.listingTopics || []).map((topic) => (
                      <Tag key={`active-topic-${topic}`} color={topicColor(topic)}>
                        {topicLabel(topic)}
                      </Tag>
                    ))}
                  </Space>

                  <Space wrap>
                    {activeConversation.orderId ? (
                      <Button size="small" type="primary" onClick={() => navigate(`/orders/${activeConversation.orderId}`)}>
                        查看订单
                      </Button>
                    ) : null}
                    {activeConversation.patentId ? (
                      <Button size="small" loading={patentDetailLoading && patentDetailOpen} onClick={() => void openPatentDetail()}>
                        专利详情
                      </Button>
                    ) : null}
                    <Button size="small" loading={assigning} onClick={() => void assignAgent()}>
                      分配给我
                    </Button>
                    <Select
                      showSearch
                      value={targetUserId || undefined}
                      style={{ width: 340 }}
                      placeholder="选择坐席"
                      optionFilterProp="label"
                      options={staffUsers.map((user) => ({
                        value: user.id,
                        label: staffDisplayName(user, '未命名坐席'),
                      }))}
                      onChange={(value) => setTargetUserId(String(value || ''))}
                      allowClear
                    />
                    <Button size="small" loading={assigning} disabled={!targetUserId.trim()} onClick={() => void assignAgent(targetUserId)}>
                      指定分配
                    </Button>
                    <Button size="small" onClick={() => void loadLatestMessages(activeConversation.id)}>
                      刷新消息
                    </Button>
                  </Space>

                  <Space wrap size={[6, 6]}>
                    {(activeConversation.assignedAgentUserIds || []).length ? (
                      (activeConversation.assignedAgentUserIds || []).map((id) => (
                        <Tag key={id} color="blue">
                          <Space size={4}>
                            <span>{assignedStaffName(id, staffNameMap)}</span>
                            <Button type="link" size="small" danger onClick={() => void removeAgent(id)}>
                              移除
                            </Button>
                          </Space>
                        </Tag>
                      ))
                    ) : (
                      <Typography.Text type="secondary">当前未分配坐席</Typography.Text>
                    )}
                  </Space>
                </Space>
              </div>

              <div ref={messageListRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', background: '#fafafa', padding: 12 }}>
                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                  {nextCursor ? (
                    <Button size="small" loading={loadingOlder} onClick={() => void loadOlderMessages()}>
                      加载更早消息
                    </Button>
                  ) : (
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      已显示全部历史消息
                    </Typography.Text>
                  )}

                  {messagesLoading ? (
                    <Typography.Text type="secondary">消息加载中...</Typography.Text>
                  ) : timeline.length === 0 ? (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无消息" />
                  ) : (
                    timeline.map((line) => {
                      if (line.kind === 'divider') {
                        return (
                          <div key={line.key} style={{ textAlign: 'center', margin: '8px 0' }}>
                            <Tag>{line.label}</Tag>
                          </div>
                        );
                      }

                      const msg = line.message;
                      const isCounterpart = msg.senderUserId === activeConversation.counterpart.id;
                      const isMine = Boolean(currentUserId) && msg.senderUserId === currentUserId;
                      const senderName = isCounterpart
                        ? conversationCounterpartName(activeConversation)
                        : isMine
                          ? '我'
                          : assignedStaffName(msg.senderUserId, staffNameMap);

                      return (
                        <div key={line.key} style={{ display: 'flex', justifyContent: isCounterpart ? 'flex-start' : 'flex-end' }}>
                          <div
                            style={{
                              maxWidth: '92%',
                              background: isCounterpart ? '#fff' : '#e6f4ff',
                              border: '1px solid #d9d9d9',
                              borderRadius: 10,
                              padding: '8px 10px',
                            }}
                          >
                            <Space direction="vertical" size={2} style={{ width: '100%' }}>
                              <Space size={8}>
                                <Typography.Text strong style={{ fontSize: 12 }}>
                                  {senderName}
                                </Typography.Text>
                                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                                  {formatTimeSmart(msg.createdAt)}
                                </Typography.Text>
                              </Space>
                              {msg.type === 'IMAGE' && msg.fileUrl ? (
                                <Space direction="vertical" size={6} style={{ width: '100%' }}>
                                  <a href={msg.fileUrl} target="_blank" rel="noreferrer">
                                    <img
                                      src={msg.fileUrl}
                                      alt={conversationMessageFileName(msg)}
                                      style={{
                                        display: 'block',
                                        maxWidth: 280,
                                        maxHeight: 220,
                                        borderRadius: 10,
                                        objectFit: 'cover',
                                      }}
                                    />
                                  </a>
                                  {conversationImageCaption(msg) ? (
                                    <Typography.Text>{conversationImageCaption(msg)}</Typography.Text>
                                  ) : null}
                                </Space>
                              ) : msg.type === 'FILE' && msg.fileUrl ? (
                                <Space direction="vertical" size={4} style={{ width: '100%' }}>
                                  <a href={msg.fileUrl} target="_blank" rel="noreferrer">
                                    {conversationMessageFileName(msg)}
                                  </a>
                                  {formatFileSize(msg.sizeBytes) ? (
                                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                                      {formatFileSize(msg.sizeBytes)}
                                    </Typography.Text>
                                  ) : null}
                                </Space>
                              ) : (
                                <Typography.Text>{conversationMessageBody(msg)}</Typography.Text>
                              )}
                            </Space>
                          </div>
                        </div>
                      );
                    })
                  )}
                </Space>
              </div>

              <div style={{ borderTop: '1px solid #f0f0f0', padding: 12 }}>
                <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleFileChange} />
                <Input.TextArea
                  rows={3}
                  value={messageText}
                  placeholder="输入回复内容（Enter 发送，Shift+Enter 换行）"
                  onChange={(event) => setMessageText(event.target.value)}
                  onPressEnter={(event) => {
                    if (event.nativeEvent.isComposing || event.shiftKey) return;
                    event.preventDefault();
                    void sendMessage();
                  }}
                />
                <Space style={{ marginTop: 8, width: '100%', justifyContent: 'space-between' }} wrap>
                  <Space wrap>
                    <Button icon={<PaperClipOutlined />} loading={sending} onClick={openFilePicker}>
                      上传文件
                    </Button>
                    <Popover
                      trigger="click"
                      open={emojiPickerOpen}
                      onOpenChange={setEmojiPickerOpen}
                      content={
                        <Space size={[4, 8]} wrap style={{ maxWidth: 220 }}>
                          {EMOJI_PRESETS.map((emoji) => (
                            <Button key={emoji} size="small" onClick={() => void sendEmoji(emoji)}>
                              {emoji}
                            </Button>
                          ))}
                        </Space>
                      }
                    >
                      <Button icon={<SmileOutlined />} disabled={sending}>
                        表情
                      </Button>
                    </Popover>
                  </Space>
                  <Space wrap>
                    <Button type="primary" loading={sending} onClick={() => void sendMessage()}>
                    发送
                    </Button>
                    <Button onClick={() => setMessageText('')}>清空</Button>
                  </Space>
                </Space>
              </div>
            </>
          )}
        </Card>
      </div>

      <Drawer
        title="专利详情"
        open={patentDetailOpen}
        width={screens.lg ? 820 : '100%'}
        footer={
          patentDetail ? (
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              {patentDetail.tradeSnapshot?.listingId ? <Button onClick={() => void openListingEdit()}>编辑挂牌价格/保证金</Button> : null}
            </Space>
          ) : null
        }
        onClose={() => {
          setPatentDetailOpen(false);
          setPatentDetail(null);
          setListingEditOpen(false);
        }}
        destroyOnClose
      >
        {patentDetailLoading ? (
          <Typography.Text type="secondary">正在加载专利详情...</Typography.Text>
        ) : patentDetail ? (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              {patentDetail.tradeSnapshot?.listingId ? (
                <Button onClick={() => void openListingEdit()}>编辑挂牌价格/保证金</Button>
              ) : null}
            </Space>
            <Space wrap>
              <Tag color="blue">{patentTypeLabel(patentDetail.patentType)}</Tag>
              <Tag color={patentLegalStatusColor(patentDetail.legalStatus)}>{patentLegalStatusLabel(patentDetail.legalStatus)}</Tag>
              <Tag>{patentSourceLabel(patentDetail.sourcePrimary)}</Tag>
            </Space>

            <Descriptions bordered size="small" column={screens.lg ? 2 : 1}>
              <Descriptions.Item label="专利标题" span={2}>
                {displayPatentText(patentDetail.title)}
              </Descriptions.Item>
              <Descriptions.Item label="申请号">{displayPatentText(patentDetail.applicationNoDisplay || patentDetail.applicationNoNorm)}</Descriptions.Item>
              <Descriptions.Item label="专利号">{displayPatentText(patentDetail.patentNoDisplay)}</Descriptions.Item>
              <Descriptions.Item label="公开号">{displayPatentText(patentDetail.publicationNoDisplay)}</Descriptions.Item>
              <Descriptions.Item label="公告号">{displayPatentText(patentDetail.grantPublicationNoDisplay)}</Descriptions.Item>
              <Descriptions.Item label="发明人" span={2}>{patentNamesLabel(patentDetail.inventorNames)}</Descriptions.Item>
              <Descriptions.Item label="申请人" span={2}>{patentNamesLabel(patentDetail.applicantNames)}</Descriptions.Item>
              <Descriptions.Item label="权利人" span={2}>{patentNamesLabel(patentDetail.assigneeNames)}</Descriptions.Item>
              <Descriptions.Item label="申请日">{displayPatentText(patentDetail.filingDate)}</Descriptions.Item>
              <Descriptions.Item label="公开日">{displayPatentText(patentDetail.publicationDate)}</Descriptions.Item>
              <Descriptions.Item label="授权日">{displayPatentText(patentDetail.grantDate)}</Descriptions.Item>
              <Descriptions.Item label="来源更新时间">{patentDetail.sourceUpdatedAt ? formatTimeSmart(patentDetail.sourceUpdatedAt) : '-'}</Descriptions.Item>
              <Descriptions.Item label="创建时间">{formatTimeSmart(patentDetail.createdAt)}</Descriptions.Item>
              <Descriptions.Item label="更新时间">{formatTimeSmart(patentDetail.updatedAt)}</Descriptions.Item>
              <Descriptions.Item label="挂牌编号">{displayPatentText(patentDetail.tradeSnapshot?.listingId)}</Descriptions.Item>
              <Descriptions.Item label="交易方式">{patentTradeTypeLabel(patentDetail.tradeSnapshot?.priceType)}</Descriptions.Item>
              <Descriptions.Item label="挂牌价格">
                {patentDetail.tradeSnapshot?.priceAmountFen != null ? `${fenToYuan(patentDetail.tradeSnapshot.priceAmountFen)} 元` : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="订金">
                {patentDetail.tradeSnapshot?.depositAmountFen != null ? `${fenToYuan(patentDetail.tradeSnapshot.depositAmountFen)} 元` : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="供给类型">{patentSupplyTypeLabel(patentDetail.tradeSnapshot?.supplyType)}</Descriptions.Item>
              <Descriptions.Item label="卖家" span={2}>
                {displayPatentText(patentDetail.tradeSnapshot?.seller?.displayName || patentDetail.tradeSnapshot?.seller?.nickname)}
              </Descriptions.Item>
              <Descriptions.Item label="摘要" span={2}>
                <Typography.Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>
                  {displayPatentText(patentDetail.abstract)}
                </Typography.Paragraph>
              </Descriptions.Item>
            </Descriptions>
          </Space>
        ) : (
          <Empty description="暂无专利详情" />
        )}
      </Drawer>

      <Modal
        title="编辑挂牌价格/保证金"
        open={listingEditOpen}
        onCancel={() => setListingEditOpen(false)}
        onOk={() => void submitListingEdit()}
        okText="保存"
        confirmLoading={listingEditSubmitting}
        destroyOnClose
        width={520}
      >
        <Form form={listingEditForm} layout="vertical">
          <Form.Item label="价格方式" name="priceType" rules={[{ required: true, message: '请选择价格方式' }]}>
            <Select options={priceTypeOptions} />
          </Form.Item>
          <Form.Item
            label="价格（元）"
            name="priceAmountYuan"
            rules={[
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (getFieldValue('priceType') === 'FIXED' && (value === null || value === undefined)) {
                    return Promise.reject(new Error('固定价需要填写价格'));
                  }
                  return Promise.resolve();
                },
              }),
            ]}
          >
            <InputNumber min={0} precision={2} style={{ width: '100%' }} placeholder="面议时可留空" />
          </Form.Item>
          <Form.Item label="订金（元）" name="depositAmountYuan">
            <InputNumber min={0} precision={2} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
