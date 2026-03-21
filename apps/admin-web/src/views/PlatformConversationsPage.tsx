import { Button, Card, Drawer, Input, List, Space, Switch, Table, Tag, Typography, message } from 'antd';
import React, { useCallback, useEffect, useState } from 'react';

import { apiDelete, apiGet, apiPost } from '../lib/api';
import { formatTimeSmart } from '../lib/format';
import { RequestErrorAlert } from '../ui/RequestState';
import { confirmAction } from '../ui/confirm';

type ConversationSummary = {
  id: string;
  contentType: 'LISTING' | 'TECH_MANAGER';
  contentId: string;
  contentTitle: string;
  listingId?: string | null;
  listingTitle?: string | null;
  lastMessageAt: string;
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

type Paged<T> = { items: T[]; page: { page: number; pageSize: number; total: number } };

export function PlatformConversationsPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown | null>(null);
  const [page, setPage] = useState(1);
  const [mineOnly, setMineOnly] = useState(false);
  const [data, setData] = useState<Paged<ConversationSummary> | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeConversation, setActiveConversation] = useState<ConversationSummary | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [targetUserId, setTargetUserId] = useState('');

  const loadConversations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<Paged<ConversationSummary>>('/admin/conversations/platform', {
        page,
        pageSize: 20,
        mineOnly: mineOnly ? 'true' : undefined,
      });
      setData(res);
      return res;
    } catch (e: any) {
      setError(e);
      setData(null);
      message.error(e?.message || '加载会话失败');
      return null;
    } finally {
      setLoading(false);
    }
  }, [mineOnly, page]);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    setPage(1);
  }, [mineOnly]);

  const loadMessages = useCallback(async (conversationId: string) => {
    setMessagesLoading(true);
    try {
      const res = await apiGet<{ items: ConversationMessage[] }>(`/conversations/${conversationId}/messages`);
      setMessages(res.items || []);
      try {
        await apiPost(`/conversations/${conversationId}/read`, {}, { idempotencyKey: `admin-conversation-read-${Date.now()}` });
      } catch {
        // ignore read marker errors
      }
    } catch (e: any) {
      message.error(e?.message || '加载消息失败');
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  const openConversation = useCallback(
    (row: ConversationSummary) => {
      setActiveConversation(row);
      setMessageText('');
      setTargetUserId('');
      setDrawerOpen(true);
      void loadMessages(row.id);
    },
    [loadMessages],
  );

  const refreshActive = useCallback(
    async (conversationId: string) => {
      const refreshed = await loadConversations();
      const next = refreshed?.items.find((it) => it.id === conversationId) || null;
      setActiveConversation(next);
    },
    [loadConversations],
  );

  const sendMessage = useCallback(async () => {
    const text = String(messageText || '').trim();
    if (!activeConversation) return message.warning('请先选择会话');
    if (!text) return message.warning('请输入消息内容');
    try {
      setSending(true);
      await apiPost(
        `/conversations/${activeConversation.id}/messages`,
        { type: 'TEXT', text },
        { idempotencyKey: `admin-conversation-send-${activeConversation.id}-${Date.now()}` },
      );
      setMessageText('');
      await Promise.all([loadMessages(activeConversation.id), refreshActive(activeConversation.id)]);
    } catch (e: any) {
      message.error(e?.message || '发送失败（请先把当前账号分配为坐席）');
    } finally {
      setSending(false);
    }
  }, [activeConversation, loadMessages, messageText, refreshActive]);

  const assignAgent = useCallback(
    async (userId?: string) => {
      if (!activeConversation) return message.warning('请先选择会话');
      try {
        setAssigning(true);
        const body = String(userId || '').trim() ? { userId: String(userId || '').trim() } : {};
        await apiPost(`/admin/conversations/${activeConversation.id}/agents`, body, {
          idempotencyKey: `admin-conversation-agent-add-${activeConversation.id}-${Date.now()}`,
        });
        setTargetUserId('');
        message.success('坐席分配成功');
        await refreshActive(activeConversation.id);
      } catch (e: any) {
        message.error(e?.message || '坐席分配失败');
      } finally {
        setAssigning(false);
      }
    },
    [activeConversation, refreshActive],
  );

  const removeAgent = useCallback(
    async (userId: string) => {
      if (!activeConversation) return;
      const ok = await confirmAction({ title: '确认移除坐席？', content: `将移除 ${userId} 的坐席权限`, danger: true });
      if (!ok) return;
      try {
        setAssigning(true);
        await apiDelete(`/admin/conversations/${activeConversation.id}/agents/${userId}`, {
          idempotencyKey: `admin-conversation-agent-remove-${activeConversation.id}-${userId}-${Date.now()}`,
        });
        message.success('坐席已移除');
        await refreshActive(activeConversation.id);
      } catch (e: any) {
        message.error(e?.message || '移除失败');
      } finally {
        setAssigning(false);
      }
    },
    [activeConversation, refreshActive],
  );

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card>
        <Typography.Title level={3} style={{ marginTop: 0 }}>平台咨询会话</Typography.Title>
        <Typography.Paragraph type="secondary">管理平台发布专利的咨询会话，支持坐席分配与后台回复。</Typography.Paragraph>
        {error ? <RequestErrorAlert error={error} onRetry={loadConversations} /> : null}
        <Space style={{ marginBottom: 12 }}>
          <Switch checked={mineOnly} onChange={setMineOnly} />
          <Typography.Text>仅看我负责</Typography.Text>
          <Button onClick={() => void loadConversations()}>刷新</Button>
        </Space>
        <Table<ConversationSummary>
          rowKey="id"
          loading={loading}
          dataSource={data?.items || []}
          pagination={{ current: data?.page.page || page, pageSize: data?.page.pageSize || 20, total: data?.page.total || 0, onChange: (next) => setPage(next) }}
          columns={[
            {
              title: '会话',
              render: (_, row) => (
                <Space direction="vertical" size={0}>
                  <Typography.Text>{row.contentTitle || row.listingTitle || '-'}</Typography.Text>
                  <Typography.Text type="secondary">{row.id}</Typography.Text>
                </Space>
              ),
            },
            {
              title: '咨询用户',
              render: (_, row) => (
                <Space direction="vertical" size={0}>
                  <Typography.Text>{row.counterpart.nickname || 'User'}</Typography.Text>
                  <Typography.Text type="secondary">{row.counterpart.id}</Typography.Text>
                </Space>
              ),
              width: 220,
            },
            {
              title: '坐席',
              width: 260,
              render: (_, row) => (row.assignedAgentUserIds?.length ? row.assignedAgentUserIds.map((id) => <Tag key={id}>{id}</Tag>) : <Typography.Text type="secondary">未分配</Typography.Text>),
            },
            { title: '最近消息', dataIndex: 'lastMessageAt', width: 150, render: (v: string) => formatTimeSmart(v) },
            { title: '操作', width: 120, render: (_, row) => <Button size="small" onClick={() => openConversation(row)}>打开会话</Button> },
          ]}
        />
      </Card>

      <Drawer
        open={drawerOpen}
        width={900}
        title={activeConversation ? `会话 ${activeConversation.id}` : '会话'}
        onClose={() => {
          setDrawerOpen(false);
          setActiveConversation(null);
          setMessages([]);
          setMessageText('');
          setTargetUserId('');
        }}
      >
        {activeConversation ? (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Card size="small" title="坐席分配">
              <Space wrap>
                <Button size="small" loading={assigning} onClick={() => void assignAgent()}>分配给我</Button>
                <Input value={targetUserId} style={{ width: 260 }} placeholder="坐席用户ID" onChange={(e) => setTargetUserId(e.target.value)} />
                <Button size="small" loading={assigning} onClick={() => void assignAgent(targetUserId)}>指定分配</Button>
              </Space>
              <div style={{ marginTop: 10 }}>
                {(activeConversation.assignedAgentUserIds || []).length ? (
                  (activeConversation.assignedAgentUserIds || []).map((id) => (
                    <Tag key={id} color="blue" style={{ marginBottom: 6 }}>
                      <Space size={4}>
                        <span>{id}</span>
                        <Button type="link" size="small" danger onClick={() => void removeAgent(id)}>移除</Button>
                      </Space>
                    </Tag>
                  ))
                ) : (
                  <Typography.Text type="secondary">当前未分配坐席</Typography.Text>
                )}
              </div>
            </Card>

            <Card size="small" title="会话消息">
              <List<ConversationMessage>
                loading={messagesLoading}
                dataSource={messages}
                locale={{ emptyText: '暂无消息' }}
                renderItem={(item) => (
                  <List.Item>
                    <Space direction="vertical" size={2} style={{ width: '100%' }}>
                      <Space>
                        <Typography.Text strong>{item.senderUserId}</Typography.Text>
                        <Typography.Text type="secondary">{formatTimeSmart(item.createdAt)}</Typography.Text>
                      </Space>
                      <Typography.Text>{item.text || `[${item.type}]`}</Typography.Text>
                    </Space>
                  </List.Item>
                )}
              />
            </Card>

            <Card size="small" title="发送消息">
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                <Input.TextArea rows={4} value={messageText} placeholder="输入回复内容" onChange={(e) => setMessageText(e.target.value)} />
                <Space>
                  <Button type="primary" loading={sending} onClick={() => void sendMessage()}>发送</Button>
                  <Button onClick={() => void loadMessages(activeConversation.id)}>刷新消息</Button>
                </Space>
              </Space>
            </Card>
          </Space>
        ) : null}
      </Drawer>
    </Space>
  );
}
