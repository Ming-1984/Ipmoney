import {
  Avatar,
  Badge,
  Button,
  Card,
  DatePicker,
  Empty,
  Grid,
  Input,
  List,
  Pagination,
  Select,
  Space,
  Switch,
  Tag,
  Typography,
  message,
} from 'antd';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { components } from '@ipmoney/api-types';

import { apiDelete, apiGet, apiPost } from '../lib/api';
import { formatTimeSmart } from '../lib/format';
import { RequestErrorAlert } from '../ui/RequestState';
import { confirmAction } from '../ui/confirm';

type ListingTopic = components['schemas']['ListingTopic'];
type AssignedFilter = 'ALL' | 'MINE' | 'ASSIGNED' | 'UNASSIGNED';
type ConversationChannelFilter = 'ALL' | 'CONSULTATION' | 'SUPPORT' | 'DISPUTE' | 'MAINTENANCE';
type DateRangeValue = [any, any] | null;

type ConversationSummary = {
  id: string;
  contentType: 'LISTING' | 'TECH_MANAGER' | 'SUPPORT' | 'DISPUTE' | 'MAINTENANCE';
  contentId: string;
  contentTitle: string;
  listingId?: string | null;
  listingTitle?: string | null;
  listingTopics?: ListingTopic[];
  lastMessagePreview?: string | null;
  lastMessageAt: string;
  unreadCount?: number;
  assignedAgentUserIds?: string[];
  counterpart: {
    id: string;
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
  createdAt: string;
};

type StaffUser = {
  id: string;
  name: string;
  email?: string;
  roleIds: string[];
};

type AuthSession = { userId: string };

type Paged<T> = { items: T[]; page: { page: number; pageSize: number; total: number } };
type PagedMessages = { items: ConversationMessage[]; nextCursor?: string | null };
type UserListResponse = { items: StaffUser[] };
type TimelineLine = { kind: 'divider'; key: string; label: string } | { kind: 'message'; key: string; message: ConversationMessage };

const LISTING_TOPIC_OPTIONS: Array<{ value: ListingTopic; label: string }> = [
  { value: 'HIGH_TECH_RETIRED', label: '退役专利' },
  { value: 'SLEEPING', label: '沉睡专利' },
  { value: 'AWARD_WINNING', label: '获奖专利' },
  { value: 'FIVE_STAR', label: '五星专利' },
  { value: 'OPEN_LICENSE', label: '开放许可' },
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

function shortId(value: string): string {
  const raw = String(value || '');
  if (raw.length <= 12) return raw;
  return `${raw.slice(0, 6)}...${raw.slice(-4)}`;
}

function toDateKey(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || '').slice(0, 10);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function topicLabel(topic: ListingTopic): string {
  const option = LISTING_TOPIC_OPTIONS.find((item) => item.value === topic);
  return option?.label || topic;
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
  return item.contentTitle || item.listingTitle || '未命名会话';
}

export function PlatformConversationsPage() {
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
  const [assigning, setAssigning] = useState(false);
  const [targetUserId, setTargetUserId] = useState('');
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [currentUserId, setCurrentUserId] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);

  const messageListRef = useRef<HTMLDivElement | null>(null);
  const olderAnchorRef = useRef<number | null>(null);

  const activeConversation = useMemo(
    () => (data?.items || []).find((item) => item.id === activeConversationId) || null,
    [activeConversationId, data?.items],
  );

  const staffNameMap = useMemo(() => {
    const out = new Map<string, string>();
    for (const user of staffUsers) {
      out.set(user.id, user.name || user.email || shortId(user.id));
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

  const loadStaffContext = useCallback(async () => {
    try {
      const [staffRes, sessionRes] = await Promise.all([
        apiGet<UserListResponse>('/admin/rbac/users', { scope: 'STAFF' }),
        apiGet<AuthSession>('/auth/session'),
      ]);
      setStaffUsers(staffRes.items || []);
      setCurrentUserId(String(sessionRes?.userId || ''));
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
      setData(res);
      return res;
    } catch (err: any) {
      setError(err);
      setData(null);
      message.error(err?.message || '会话加载失败');
      return null;
    } finally {
      setLoading(false);
    }
  }, [appliedAssigned, appliedChannel, appliedListingTopic, appliedQ, appliedUpdatedRange, page]);

  const loadLatestMessages = useCallback(
    async (conversationId: string) => {
      setMessagesLoading(true);
      try {
        const res = await apiGet<PagedMessages>(`/conversations/${conversationId}/messages`, { limit: 50 });
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
        setMessagesLoading(false);
      }
    },
    [scrollToBottom],
  );

  const loadOlderMessages = useCallback(async () => {
    if (!activeConversationId || !nextCursor || loadingOlder) return;
    const box = messageListRef.current;
    olderAnchorRef.current = box ? box.scrollHeight - box.scrollTop : null;
    setLoadingOlder(true);
    try {
      const res = await apiGet<PagedMessages>(`/conversations/${activeConversationId}/messages`, {
        cursor: nextCursor,
        limit: 50,
      });
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
    setPage(1);
    setAppliedQ(draftQ);
    setAppliedAssigned(draftAssigned);
    setAppliedChannel(draftChannel);
    setAppliedListingTopic(shouldDropListingTopic ? '' : draftListingTopic);
    setAppliedUpdatedRange(draftUpdatedRange);
    if (shouldDropListingTopic && draftListingTopic) {
      setDraftListingTopic('');
    }
  }, [draftAssigned, draftChannel, draftListingTopic, draftQ, draftUpdatedRange]);

  const resetFilters = useCallback(() => {
    setPage(1);
    setDraftQ('');
    setDraftAssigned('ALL');
    setDraftChannel('ALL');
    setDraftListingTopic('');
    setDraftUpdatedRange(null);
    setAppliedQ('');
    setAppliedAssigned('ALL');
    setAppliedChannel('ALL');
    setAppliedListingTopic('');
    setAppliedUpdatedRange(null);
  }, []);

  const refreshCurrent = useCallback(async () => {
    await loadConversations();
    if (activeConversationId) {
      await loadLatestMessages(activeConversationId);
    }
  }, [activeConversationId, loadConversations, loadLatestMessages]);

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
    try {
      setSending(true);
      await apiPost(
        `/conversations/${activeConversationId}/messages`,
        { type: 'TEXT', text },
        { idempotencyKey: `admin-conv-send-${activeConversationId}-${Date.now()}` },
      );
      setMessageText('');
      await Promise.all([loadLatestMessages(activeConversationId), loadConversations()]);
    } catch (err: any) {
      message.error(err?.message || '发送失败，请确认当前账号已分配到该会话');
    } finally {
      setSending(false);
    }
  }, [activeConversationId, loadConversations, loadLatestMessages, messageText]);

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
        content: `将移除 ${staffNameMap.get(userId) || shortId(userId)} 的处理权限，是否继续？`,
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

  useEffect(() => {
    void loadStaffContext();
  }, [loadStaffContext]);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

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

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card>
        <Typography.Title level={3} style={{ marginTop: 0 }}>
          平台会话中心
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
          统一处理咨询、客服和订单争议会话，支持筛选、分配、连续对话与历史追溯。
        </Typography.Paragraph>
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
              placeholder="关键词（标题/用户昵称/会话ID）"
              onChange={(event) => setDraftQ(event.target.value)}
              onSearch={applyFilters}
            />
            <Space wrap style={{ width: '100%' }}>
              <Select<AssignedFilter>
                value={draftAssigned}
                style={{ width: 140 }}
                options={ASSIGNED_FILTER_OPTIONS}
                onChange={setDraftAssigned}
              />
              <Select<ConversationChannelFilter>
                value={draftChannel}
                style={{ width: 140 }}
                options={CHANNEL_FILTER_OPTIONS}
                onChange={(value) => {
                  setDraftChannel(value);
                  if (value !== 'ALL' && value !== 'CONSULTATION') {
                    setDraftListingTopic('');
                  }
                }}
              />
              <Select
                value={draftListingTopic}
                style={{ width: 180 }}
                options={[{ value: '', label: '全部标签' }, ...LISTING_TOPIC_OPTIONS]}
                onChange={(value) => setDraftListingTopic((value as ListingTopic) || '')}
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
                          {(item.counterpart.nickname || 'U').slice(0, 1)}
                        </Avatar>
                      </Badge>
                      <Space direction="vertical" size={4} style={{ width: '100%' }}>
                        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                          <Typography.Text strong ellipsis style={{ maxWidth: 220 }}>
                            {conversationTitle(item)}
                          </Typography.Text>
                          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                            {formatTimeSmart(item.lastMessageAt)}
                          </Typography.Text>
                        </Space>
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          咨询人：{item.counterpart.nickname || '用户'}（{shortId(item.counterpart.id)}）
                        </Typography.Text>
                        <Typography.Paragraph type="secondary" style={{ margin: 0, fontSize: 12 }} ellipsis={{ rows: 1 }}>
                          {item.lastMessagePreview || '暂无消息'}
                        </Typography.Paragraph>
                        <Space size={[4, 4]} wrap>
                          <Tag color={channelTagColor(item.contentType)}>{channelLabel(item.contentType)}</Tag>
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
                      {conversationTitle(activeConversation)}
                    </Typography.Text>
                    <Space>
                      <Typography.Text type="secondary">自动刷新</Typography.Text>
                      <Switch checked={autoRefresh} onChange={setAutoRefresh} size="small" />
                      <Typography.Text type="secondary">{formatTimeSmart(activeConversation.lastMessageAt)}</Typography.Text>
                    </Space>
                  </Space>

                  <Space size={[6, 6]} wrap>
                    <Tag color={channelTagColor(activeConversation.contentType)}>{channelLabel(activeConversation.contentType)}</Tag>
                    <Tag color="processing">咨询人：{activeConversation.counterpart.nickname || '用户'}</Tag>
                    <Tag>{shortId(activeConversation.counterpart.id)}</Tag>
                    {(activeConversation.listingTopics || []).map((topic) => (
                      <Tag key={`active-topic-${topic}`} color={topicColor(topic)}>
                        {topicLabel(topic)}
                      </Tag>
                    ))}
                  </Space>

                  <Space wrap>
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
                        label: `${user.name || user.email || shortId(user.id)}（${shortId(user.id)}）`,
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
                            <span>{staffNameMap.get(id) || shortId(id)}</span>
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
                        ? activeConversation.counterpart.nickname || '咨询用户'
                        : isMine
                          ? '我'
                          : staffNameMap.get(msg.senderUserId) || shortId(msg.senderUserId);

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
                              <Typography.Text>{msg.text || `[${msg.type}]`}</Typography.Text>
                            </Space>
                          </div>
                        </div>
                      );
                    })
                  )}
                </Space>
              </div>

              <div style={{ borderTop: '1px solid #f0f0f0', padding: 12 }}>
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
                <Space style={{ marginTop: 8 }}>
                  <Button type="primary" loading={sending} onClick={() => void sendMessage()}>
                    发送
                  </Button>
                  <Button onClick={() => setMessageText('')}>清空</Button>
                </Space>
              </div>
            </>
          )}
        </Card>
      </div>
    </Space>
  );
}
