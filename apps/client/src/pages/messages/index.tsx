import { View, Text, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useMemo, useState } from 'react';
import './index.scss';

import type { components } from '@ipmoney/api-types';

import iconSearch from '../../assets/icons/icon-search-gray.svg';
import iconMore from '../../assets/icons/icon-more-gray.svg';
import iconShield from '../../assets/icons/icon-shield-orange.svg';
import iconBellWhite from '../../assets/icons/icon-bell-white.svg';
import { apiGet, apiPost } from '../../lib/api';
import { usePageAccess } from '../../lib/guard';
import { formatTimeSmart } from '../../lib/format';
import { PageState } from '../../ui/PageState';
import { SearchEntry } from '../../ui/SearchEntry';
import { PopupSheet } from '../../ui/layout';
import { Avatar, Cell, PullToRefresh, Popup, confirm, toast } from '../../ui/nutui';
import { NOTIFICATIONS } from '../notifications/data';

type PagedConversationSummary = components['schemas']['PagedConversationSummary'];
type ConversationSummary = components['schemas']['ConversationSummary'];

type ConversationCategory = 'cs' | 'trade' | 'user';

const CS_NAME_KEYWORDS = ['平台客服', '客服助手', '官方客服', '客服'];
const TRADE_NAME_KEYWORDS = ['交易通知', '系统通知', '订单通知', '支付通知'];
const TRADE_MESSAGE_KEYWORDS = ['订单', '订金', '支付', '退款', '合同', '尾款', '托管', '结算', '发票', '仲裁', '争议', '审核'];

function includesAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

export default function MessagesPage() {
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PagedConversationSummary | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [moreOpen, setMoreOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);

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
  const trimmedSearch = searchValue.trim().toLowerCase();
  const showSearch = searchOpen || Boolean(trimmedSearch);

  const getConversationCategory = useCallback((c: ConversationSummary): ConversationCategory => {
    const role = c.counterpart?.role || '';
    if (role === 'cs') return 'cs';
    if (role === 'admin') return 'trade';

    const name = (c.counterpart?.nickname || '').trim();
    if (name) {
      if (includesAny(name, CS_NAME_KEYWORDS)) return 'cs';
      if (includesAny(name, TRADE_NAME_KEYWORDS)) return 'trade';
    }

    const preview = `${c.lastMessagePreview || ''} ${c.contentTitle || ''} ${c.listingTitle || ''}`.trim();
    if (preview && includesAny(preview, TRADE_MESSAGE_KEYWORDS)) return 'trade';

    return 'user';
  }, []);

  const getConversationDisplayName = useCallback((c: ConversationSummary, category: ConversationCategory): string => {
    if (category === 'cs') return '平台客服助手';
    if (category === 'trade') return '交易通知';
    return c.counterpart?.nickname || '对方';
  }, []);

  const viewItems = useMemo(() => {
    return items.map((c) => {
      const category = getConversationCategory(c);
      return {
        ...c,
        _category: category,
        _displayName: getConversationDisplayName(c, category),
      };
    });
  }, [items, getConversationCategory, getConversationDisplayName]);

  const latestNoticeTime = useMemo(() => {
    if (!NOTIFICATIONS.length) return '';
    const latest = NOTIFICATIONS.reduce((prev, next) =>
      new Date(prev.time).getTime() >= new Date(next.time).getTime() ? prev : next,
    );
    return latest.time;
  }, []);

  const consultItems = useMemo(() => {
    return viewItems.filter((c) => c._category === 'user');
  }, [viewItems]);

  const filteredItems = useMemo(() => {
    if (!trimmedSearch) return consultItems;
    return consultItems.filter((c) => {
      const counterpartName = c._displayName || '';
      const contentTitle = c.contentTitle || '';
      const listingTitle = c.listingTitle || '';
      const preview = c.lastMessagePreview || '';
      const merged = `${counterpartName} ${contentTitle} ${listingTitle} ${preview}`.toLowerCase();
      return merged.includes(trimmedSearch);
    });
  }, [consultItems, trimmedSearch]);

  const clearSearch = useCallback(() => {
    setSearchValue('');
    setSearchOpen(false);
  }, []);

  const markAllRead = useCallback(async () => {
    if (!consultItems.length) {
      toast('暂无会话');
      return;
    }
    const unread = consultItems.filter((c) => (c.unreadCount || 0) > 0);
    setMoreOpen(false);
    if (!unread.length) {
      toast('已全部已读', { icon: 'success' });
      return;
    }
    try {
      const results = await Promise.allSettled(
        unread.map((c) => apiPost(`/conversations/${c.id}/read`)),
      );
      const failed = results.filter((res) => res.status === 'rejected');
      const targetIds = new Set(unread.map((c) => c.id));
      setData((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((c) => (targetIds.has(c.id) ? { ...c, unreadCount: 0 } : c)),
            }
          : prev,
      );
      if (failed.length) {
        toast('部分会话标记失败', { icon: 'warn' });
      } else {
        toast('已全部标为已读', { icon: 'success' });
      }
    } catch (e: any) {
      toast(e?.message || '操作失败', { icon: 'fail' });
    }
  }, [consultItems]);

  const bulkClearHistory = useCallback(async () => {
    const targets = trimmedSearch ? filteredItems : consultItems;
    if (!targets.length) {
      toast('暂无可操作会话');
      return;
    }
    setMoreOpen(false);
    const ok = await confirm({
      title: '清空历史',
      content: `确认清空当前${targets.length}条会话历史吗？`,
      confirmText: '清空',
    });
    if (!ok) return;
    const targetIds = new Set(targets.map((c) => c.id));
    setData((prev) =>
      prev
        ? {
            ...prev,
            items: prev.items.map((c) =>
              targetIds.has(c.id)
                ? { ...c, lastMessagePreview: '', lastMessageAt: '', unreadCount: 0 }
                : c,
            ),
          }
        : prev,
    );
    setManageOpen(false);
    toast('已清空历史', { icon: 'success' });
  }, [filteredItems, consultItems, trimmedSearch]);

  const bulkDelete = useCallback(async () => {
    const targets = trimmedSearch ? filteredItems : consultItems;
    if (!targets.length) {
      toast('暂无可操作会话');
      return;
    }
    setMoreOpen(false);
    const ok = await confirm({
      title: '删除会话',
      content: `确认删除当前${targets.length}条会话吗？`,
      confirmText: '删除',
    });
    if (!ok) return;
    const targetIds = new Set(targets.map((c) => c.id));
    setData((prev) =>
      prev
        ? {
            ...prev,
            items: prev.items.filter((c) => !targetIds.has(c.id)),
          }
        : prev,
    );
    setManageOpen(false);
    toast('已删除会话', { icon: 'success' });
  }, [filteredItems, consultItems, trimmedSearch]);

  const emptyTitle = '暂无咨询会话';
  const emptyMessage = '从详情页点击“咨询”即可创建会话。';

  return (
    <View className="container messages-page messages-new">
      <View className="messages-header-new">
        <Text className="messages-title">消息</Text>
        <View className="messages-header-actions">
          <Image
            src={iconSearch}
            svg
            mode="aspectFit"
            className="messages-action-icon"
            onClick={() => {
              if (searchOpen && !trimmedSearch) {
                setSearchOpen(false);
                return;
              }
              setSearchOpen(true);
            }}
          />
          <Image
            src={iconMore}
            svg
            mode="aspectFit"
            className="messages-action-icon"
            onClick={() => setMoreOpen(true)}
          />
        </View>
      </View>

      {showSearch ? (
        <View className="messages-search-row">
          <View className="messages-search-entry">
            <SearchEntry
              value={searchValue}
              placeholder="搜索会话对象/机构名或消息关键词"
              actionText="搜索"
              onChange={(value) => {
                setSearchValue(value);
                if (!value) setSearchOpen(false);
              }}
              onSearch={(value) => setSearchValue(value.trim())}
            />
          </View>
          <Text className="messages-search-cancel" onClick={clearSearch}>
            取消
          </Text>
        </View>
      ) : null}

      <View className="messages-alert">
        <View className="messages-alert-left">
          <Image src={iconShield} svg mode="aspectFit" className="messages-alert-icon" />
          <Text className="messages-alert-text">平台严禁引导线下交易，谨防诈骗</Text>
        </View>
        <Text className="messages-alert-link">详情</Text>
      </View>

      <PageState
        access={access}
        loading={loading}
        loadingText="加载会话中…"
        error={error}
        empty={!filteredItems.length}
        emptyTitle={trimmedSearch ? '未找到会话' : emptyTitle}
        emptyMessage={trimmedSearch ? '换个关键词试试。' : emptyMessage}
        emptyActionText={trimmedSearch ? '清空搜索' : '刷新'}
        onRetry={load}
        onEmptyAction={trimmedSearch ? clearSearch : load}
      >
        <PullToRefresh type="primary" disabled={refreshing} onRefresh={refresh}>
          <View className="messages-list-new">
            <View
              className={`message-item-new notice-entry ${filteredItems.length ? '' : 'is-last'}`}
              onClick={() => {
                Taro.navigateTo({ url: '/pages/notifications/index' });
              }}
            >
              <View className="message-avatar-new">
                <View className="message-system-avatar is-trade">
                  <Image src={iconBellWhite} svg mode="aspectFit" className="message-system-icon" />
                </View>
              </View>
              <View className="message-body-new">
                <View className="message-title-row-new">
                  <View className="message-title-left">
                    <Text className="message-title-new ellipsis">通知</Text>
                  </View>
                  <Text className="message-time-new">
                    {latestNoticeTime ? formatTimeSmart(latestNoticeTime) : ''}
                  </Text>
                </View>
              </View>
            </View>
            {filteredItems.map((c, idx) => (
              <View
                key={c.id}
                className={`message-item-new ${idx === filteredItems.length - 1 ? 'is-last' : ''}`}
                onClick={() => {
                  Taro.navigateTo({ url: `/pages/messages/chat/index?conversationId=${c.id}` });
                }}
              >
                <View className="message-avatar-new">
                  <Avatar
                    size="56"
                    src={c.counterpart?.avatarUrl || ''}
                    background="var(--c-soft)"
                    color="var(--c-primary)"
                  >
                    {(c.counterpart?.nickname || 'U').slice(0, 1).toUpperCase()}
                  </Avatar>
                  {c.unreadCount ? (
                    <View className="message-unread-badge">
                      <Text className="message-unread-text">{c.unreadCount > 99 ? '99+' : c.unreadCount}</Text>
                    </View>
                  ) : null}
                </View>
                <View className="message-body-new">
                  <View className="message-title-row-new">
                    <View className="message-title-left">
                      <Text className="message-title-new ellipsis">{c._displayName}</Text>
                      {c._category !== 'user' ? (
                        <Text className={`message-tag message-tag--${c._category}`}>
                          {c._category === 'cs' ? '官方' : '系统'}
                        </Text>
                      ) : null}
                    </View>
                    <Text className="message-time-new">{formatTimeSmart(c.lastMessageAt)}</Text>
                  </View>
                  <View className="message-meta-row-new">
                    <Text className="message-content-new ellipsis">
                      {c.lastMessagePreview || c.contentTitle || c.listingTitle || '暂无消息'}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </PullToRefresh>
      </PageState>

      <Popup
        visible={moreOpen}
        position="bottom"
        round
        closeable
        title="更多操作"
        onClose={() => setMoreOpen(false)}
        onOverlayClick={() => setMoreOpen(false)}
      >
        <PopupSheet scrollable={false} bodyClassName="messages-popup-body">
          <View className="messages-popup-section">
            <Cell title="全部标为已读" onClick={() => void markAllRead()} />
            <Cell
              title="批量管理"
              onClick={() => {
                setMoreOpen(false);
                setManageOpen(true);
              }}
            />
          </View>
        </PopupSheet>
      </Popup>

      <Popup
        visible={manageOpen}
        position="bottom"
        round
        closeable
        title="批量管理"
        onClose={() => setManageOpen(false)}
        onOverlayClick={() => setManageOpen(false)}
      >
        <PopupSheet scrollable={false} bodyClassName="messages-popup-body">
          <View className="messages-popup-section">
            <Cell title="批量删除会话" onClick={() => void bulkDelete()} />
            <Cell title="批量清空历史" onClick={() => void bulkClearHistory()} />
            <Text className="messages-popup-hint">
              操作范围：{trimmedSearch ? '当前搜索结果' : '当前会话列表'}
            </Text>
          </View>
        </PopupSheet>
      </Popup>
    </View>
  );
}
