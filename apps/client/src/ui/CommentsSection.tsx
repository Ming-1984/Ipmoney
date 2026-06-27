import { View, Text, Image, Textarea } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { components } from '@ipmoney/api-types';

import { apiDelete, apiGet, apiPatch, apiPost } from '../lib/api';
import { getToken } from '../lib/auth';
import { displayInitial, displayUserName as resolveUserDisplayName } from '../lib/displayText';
import { formatTimeSmart } from '../lib/format';
import { ensureApproved } from '../lib/guard';
import { SectionHeader, Spacer, Surface } from './layout';
import type { SectionHeaderAccent } from './layout/SectionHeader';
import { Avatar, Button, Empty, Tag, TextArea, confirm, toast } from './nutui';
import emptyComments from '../assets/illustrations/empty-comments.svg';

type CommentStatus = components['schemas']['CommentStatus'];
type CommentThread = components['schemas']['CommentThread'];
type Comment = components['schemas']['Comment'];
type PagedCommentThread = components['schemas']['PagedCommentThread'];
type PageMeta = components['schemas']['PageMeta'];
type Me = components['schemas']['UserProfile'];

type CommentsSectionProps = {
  contentId: string;
  contentType?: 'LISTING' | 'ACHIEVEMENT';
  title?: string;
  accent?: SectionHeaderAccent;
  showHeader?: boolean;
  className?: string;
  composerVariant?: 'inline' | 'bottom-sheet';
  composerOpen?: boolean;
  onComposerOpenChange?: (open: boolean) => void;
};

type ComposerState =
  | { mode: 'new' }
  | { mode: 'reply'; targetId: string; targetName: string }
  | { mode: 'edit'; targetId: string; targetName: string };

const DEFAULT_PAGE_SIZE = 10;

function normalizeStatus(status?: CommentStatus | null): CommentStatus {
  return status || 'VISIBLE';
}

function displayUserName(user?: Comment['user']): string {
  return resolveUserDisplayName(user, '平台用户');
}

function displayUserInitial(user?: Comment['user']): string {
  return displayInitial(displayUserName(user), '平');
}

export function CommentsSection(props: CommentsSectionProps) {
  const {
    contentId,
    contentType = 'LISTING',
    title = '留言',
    accent = 'primary',
    showHeader = true,
    className,
    composerVariant = 'inline',
    composerOpen,
    onComposerOpenChange,
  } = props;
  const [threads, setThreads] = useState<CommentThread[]>([]);
  const [pageMeta, setPageMeta] = useState<PageMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [composerOpenInternal, setComposerOpenInternal] = useState(false);
  const [composer, setComposer] = useState<ComposerState>({ mode: 'new' });
  const [composerText, setComposerText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<Me | null>(null);
  const longPressRef = useRef(false);
  const composerId = 'comment-composer';
  const isBottomSheetComposer = composerVariant === 'bottom-sheet';
  const composerVisible = composerOpen ?? composerOpenInternal;
  const setComposerVisible = useCallback(
    (open: boolean) => {
      if (composerOpen === undefined) setComposerOpenInternal(open);
      onComposerOpenChange?.(open);
    },
    [composerOpen, onComposerOpenChange],
  );

  const commentById = useMemo(() => {
    const map = new Map<string, Comment>();
    for (const thread of threads) {
      if (thread?.root?.id) map.set(thread.root.id, thread.root);
      for (const reply of thread?.replies || []) {
        if (reply?.id) map.set(reply.id, reply);
      }
    }
    return map;
  }, [threads]);

  const loadPage = useCallback(
    async (page: number) => {
      if (!contentId) return;
      if (page === 1) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      setError(null);
      try {
        const params = { page, pageSize: DEFAULT_PAGE_SIZE };
        const d =
          contentType === 'ACHIEVEMENT'
            ? await apiGet<PagedCommentThread>(`/public/achievements/${contentId}/comments`, params)
            : await apiGet<PagedCommentThread>(`/public/listings/${contentId}/comments`, params);
        setPageMeta(d.page);
        setThreads((prev) => (page === 1 ? d.items : [...prev, ...d.items]));
      } catch (e: any) {
        setError(e?.message || '加载失败');
        if (page === 1) setThreads([]);
      } finally {
        if (page === 1) setLoading(false);
        else setLoadingMore(false);
      }
    },
    [contentId, contentType],
  );

  useEffect(() => {
    setThreads([]);
    setPageMeta(null);
    setComposer({ mode: 'new' });
    setComposerText('');
    if (composerOpen === undefined) setComposerOpenInternal(false);
    else onComposerOpenChange?.(false);
    void loadPage(1);
  }, [loadPage]);

  useEffect(() => {
    if (!getToken()) {
      setCurrentUserId(null);
      setCurrentUser(null);
      return;
    }
    apiGet<Me>('/me')
      .then((d) => {
        setCurrentUserId(d.id);
        setCurrentUser(d);
      })
      .catch(() => {
        setCurrentUserId(null);
        setCurrentUser(null);
      });
  }, [contentId]);

  const total = pageMeta?.total ?? threads.length;
  const currentPage = pageMeta?.page ?? 1;
  const hasMore = threads.length < total;

  const resetComposer = useCallback(() => {
    setComposer({ mode: 'new' });
    setComposerText('');
    setComposerVisible(false);
  }, [setComposerVisible]);

  const focusComposer = useCallback(() => {
    if (isBottomSheetComposer) {
      setComposerVisible(true);
      return;
    }
    try {
      Taro.pageScrollTo({ selector: `#${composerId}`, duration: 250 });
    } catch (_) {
      try {
        Taro.pageScrollTo({ scrollTop: 999999, duration: 250 });
      } catch (_) {}
    }
    setComposerVisible(false);
    setTimeout(() => setComposerVisible(true), 200);
  }, [isBottomSheetComposer, setComposerVisible]);

  const startReply = useCallback(
    (comment: Comment, focus = true) => {
      if (!ensureApproved()) return;
      if (normalizeStatus(comment.status) !== 'VISIBLE') {
        toast('该留言暂不可回复');
        return;
      }
      setComposer({ mode: 'reply', targetId: comment.id, targetName: displayUserName(comment.user) });
      setComposerText('');
      if (focus) focusComposer();
    },
    [focusComposer],
  );

  const startEdit = useCallback(
    (comment: Comment, focus = true) => {
      if (!ensureApproved()) return;
      if (!currentUserId || comment.user?.id !== currentUserId) {
        toast('只能编辑自己的留言');
        return;
      }
      if (normalizeStatus(comment.status) !== 'VISIBLE') {
        toast('该留言暂不可编辑');
        return;
      }
      setComposer({ mode: 'edit', targetId: comment.id, targetName: displayUserName(comment.user) });
      setComposerText(comment.text || '');
      if (focus) focusComposer();
    },
    [currentUserId, focusComposer],
  );

  const submit = useCallback(async () => {
    if (!ensureApproved()) return;
    const text = composerText.trim();
    if (!text) {
      toast('请输入留言内容');
      return;
    }
    setSubmitting(true);
    try {
      if (composer.mode === 'edit') {
        const target = commentById.get(composer.targetId);
        if (!target) {
          toast('留言不存在或已删除');
          return;
        }
        if (!currentUserId || target.user?.id !== currentUserId) {
          toast('只能编辑自己的留言');
          return;
        }
        if (normalizeStatus(target.status) !== 'VISIBLE') {
          toast('该留言暂不可编辑');
          return;
        }
        await apiPatch<Comment>(`/comments/${composer.targetId}`, { text }, { idempotencyKey: `comment-edit-${composer.targetId}-${Date.now()}` });
        toast('已更新', { icon: 'success' });
      } else {
        const payload: components['schemas']['CommentCreateRequest'] = { text };
        if (composer.mode === 'reply') payload.parentCommentId = composer.targetId;
        if (contentType === 'ACHIEVEMENT') {
          await apiPost<Comment>(`/achievements/${contentId}/comments`, payload, {
            idempotencyKey: `comment-${contentId}-${Date.now()}`,
          });
        } else {
          await apiPost<Comment>(`/listings/${contentId}/comments`, payload, {
            idempotencyKey: `comment-${contentId}-${Date.now()}`,
          });
        }
        toast('已发布', { icon: 'success' });
      }
      resetComposer();
      await loadPage(1);
    } catch (e: any) {
      toast(e?.message || '操作失败');
    } finally {
      setSubmitting(false);
    }
  }, [commentById, composer, composerText, contentId, contentType, currentUserId, loadPage, resetComposer]);

  const removeComment = useCallback(
    async (comment: Comment) => {
      if (!ensureApproved()) return;
      if (!currentUserId || comment.user?.id !== currentUserId) {
        toast('只能删除自己的留言');
        return;
      }
      const ok = await confirm({
        title: '删除留言？',
        content: '删除后将不可恢复。',
        confirmText: '删除',
        cancelText: '取消',
      });
      if (!ok) return;
      try {
        await apiDelete(`/comments/${comment.id}`, { idempotencyKey: `comment-delete-${comment.id}` });
        toast('已删除', { icon: 'success' });
        await loadPage(1);
      } catch (e: any) {
        toast(e?.message || '操作失败');
      }
    },
    [currentUserId, loadPage],
  );

  const handleLongPress = useCallback(
    async (comment: Comment) => {
      if (!ensureApproved()) return;
      longPressRef.current = true;
      const status = normalizeStatus(comment.status);
      const isOwner = currentUserId && comment.user?.id === currentUserId;
      const isMock = typeof comment.id === 'string' && comment.id.startsWith('mock-');
      const canReply = status === 'VISIBLE' && !isMock;
      const canEdit = Boolean(isOwner && status === 'VISIBLE' && !isMock);
      const canDelete = Boolean(isOwner && status !== 'DELETED' && !isMock);
      const items: string[] = [];
      const actions: Array<'reply' | 'edit' | 'delete'> = [];
      if (canReply) {
        items.push('回复');
        actions.push('reply');
      }
      if (canEdit) {
        items.push('编辑');
        actions.push('edit');
      }
      if (canDelete) {
        items.push('删除');
        actions.push('delete');
      }
      if (!items.length) return;
      try {
        const res = await Taro.showActionSheet({ itemList: items });
        const action = actions[res.tapIndex];
        if (action === 'reply') startReply(comment);
        if (action === 'edit') startEdit(comment);
        if (action === 'delete') void removeComment(comment);
      } catch (_) {
        // ignore cancel
      } finally {
        setTimeout(() => {
          longPressRef.current = false;
        }, 400);
      }
    },
    [currentUserId, removeComment, startEdit, startReply],
  );

  const composerPlaceholder =
    composer.mode === 'reply'
      ? `回复 ${composer.targetName}`
      : composer.mode === 'edit'
        ? '编辑留言内容'
        : '写下你的留言，共同讨论';
  const submitEnabled = composerText.trim().length > 0 && !submitting;
  const handleComposerBlur = useCallback(() => {
    if (isBottomSheetComposer) return;
    setTimeout(() => setComposerVisible(false), 120);
  }, [isBottomSheetComposer, setComposerVisible]);

  const closeComposer = useCallback(() => {
    setComposerVisible(false);
  }, [setComposerVisible]);

  const composerField = isBottomSheetComposer ? (
    <Textarea
      className="comment-composer-floating-input comment-composer-sheet-input"
      value={composerText}
      onInput={(e) => setComposerText(e.detail.value)}
      onConfirm={() => void submit()}
      confirmType="send"
      showConfirmBar={false}
      disableDefaultPadding
      autoHeight
      fixed
      placeholder={composer.mode === 'new' ? '感兴趣就留言，问问更多专利信息~' : composerPlaceholder}
      placeholderClass="comment-composer-sheet-input-placeholder"
      placeholderStyle="font-size:28rpx;line-height:40rpx;color:#8f96a3;"
      maxlength={1000}
      focus={composerVisible}
      onBlur={handleComposerBlur}
    />
  ) : (
    <TextArea
      className="comment-composer-floating-input"
      value={composerText}
      onChange={setComposerText}
      placeholder={composerPlaceholder}
      maxLength={1000}
      focus={composerVisible}
      onBlur={handleComposerBlur}
    />
  );
  const composerSubmitButton = (
    <Button
      className="comment-composer-submit"
      variant={submitEnabled ? 'primary' : 'default'}
      size="small"
      block={false}
      loading={submitting}
      onClick={() => void submit()}
    >
      {composer.mode === 'edit' ? '保存' : isBottomSheetComposer ? '发送' : '发布'}
    </Button>
  );

  const renderComment = (comment: Comment, options?: { isReply?: boolean }) => {
    const status = normalizeStatus(comment.status);
    const isVisible = status === 'VISIBLE';
    const isMock = typeof comment.id === 'string' && comment.id.startsWith('mock-');
    const canReply = isVisible && !isMock;
    const edited = Boolean(comment.updatedAt && comment.updatedAt !== comment.createdAt);
    const replyToName =
      options?.isReply && comment.parentCommentId
        ? displayUserName(commentById.get(comment.parentCommentId)?.user)
        : null;
    const replyPrefix = replyToName ? `回复 ${replyToName}：` : null;

    return (
      <View
        className={`comment-item ${options?.isReply ? 'comment-reply-item' : ''}`}
        onClick={(e) => {
          e.stopPropagation?.();
          if (longPressRef.current) {
            longPressRef.current = false;
            return;
          }
          if (canReply) startReply(comment);
        }}
        onLongPress={() => void handleLongPress(comment)}
      >
        <Avatar size="32" src={comment.user?.avatarUrl || ''} background="rgba(15, 23, 42, 0.06)" color="var(--c-muted)">
          {displayUserInitial(comment.user)}
        </Avatar>
        <View className="comment-body">
          <View className="row-between">
            <View className="comment-user-meta">
              <Text className="text-strong">{displayUserName(comment.user)}</Text>
            </View>
            <View className="row" style={{ gap: '6rpx', alignItems: 'center' }}>
              {edited ? (
                <Tag type="default" plain round>
                  已编辑
                </Tag>
              ) : null}
              {status === 'HIDDEN' ? (
                <Tag type="warning" plain round>
                  已隐藏
                </Tag>
              ) : null}
              {status === 'DELETED' ? (
                <Tag type="danger" plain round>
                  已删除
                </Tag>
              ) : null}
              <Text className="text-caption muted">{formatTimeSmart(comment.createdAt)}</Text>
            </View>
          </View>
          <Spacer size={4} />
          <View className={`comment-bubble ${status === 'VISIBLE' ? '' : 'comment-text-muted'}`}>
            <Text className="comment-text break-word">
              {replyPrefix ? <Text className="comment-reply-prefix">{replyPrefix}</Text> : null}
              {comment.text || ''}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <Surface className={className || ''}>
      {showHeader ? <SectionHeader title={`${title}${total ? `（${total}）` : ''}`} density="compact" accent={accent} /> : null}
      <View className={`comment-composer ${isBottomSheetComposer ? 'comment-composer-external' : ''}`} id={composerId}>
        {isBottomSheetComposer ? (
          <View className="comment-composer-inline comment-composer-entry">
            <View className="comment-composer-placeholder" onClick={focusComposer}>
              <View className="comment-composer-entry-icon" />
              <Text className="comment-composer-placeholder-text">说点什么...</Text>
            </View>
          </View>
        ) : null}

        {!isBottomSheetComposer && !composerVisible ? (
          <View className="comment-composer-inline">
            <Avatar size="32" src={currentUser?.avatarUrl || ''} background="rgba(15, 23, 42, 0.06)" color="var(--c-muted)">
              {displayUserInitial(currentUser || undefined)}
            </Avatar>
            <View className="comment-composer-placeholder" onClick={focusComposer}>
              <Text className="comment-composer-placeholder-text">{composerPlaceholder}</Text>
            </View>
          </View>
        ) : null}

        {!isBottomSheetComposer && composerVisible ? (
          <View className="comment-composer-floating">
            {composerField}
            {composerSubmitButton}
          </View>
        ) : null}

        {isBottomSheetComposer && composerVisible ? (
          <View className="comment-composer-sheet-mask" onClick={closeComposer}>
            <View className="comment-composer-sheet" onClick={(e) => e.stopPropagation?.()}>
              <View className="comment-composer-sheet-row">
                <View className="comment-composer-sheet-input-wrap">
                  {composerField}
                </View>
                {composerSubmitButton}
              </View>
            </View>
          </View>
        ) : null}

        <Text className="comment-composer-hint">公开可见，登录且审核通过可留言/回复</Text>
      </View>

      <Spacer size={12} />

      <View className="comment-list">
        {loading ? (
          <View className="comment-state">
            <Text className="muted">加载中...</Text>
          </View>
        ) : error ? (
          <View className="comment-state">
            <Text className="muted">{error}</Text>
            <View style={{ height: '8rpx' }} />
            <Button variant="ghost" size="mini" block={false} onClick={() => void loadPage(1)}>
              重试
            </Button>
          </View>
        ) : threads.length ? (
          threads.map((thread, idx) => {
            if (!thread?.root) return null;
            return (
              <View key={thread.root.id} className="comment-thread">
                {renderComment(thread.root)}
                {thread.replies?.length ? (
                  <View className="comment-replies">
                    {thread.replies.map((reply) => (
                      <View key={reply.id}>{renderComment(reply, { isReply: true })}</View>
                    ))}
                  </View>
                ) : null}
                {idx < threads.length - 1 ? <View className="divider" /> : null}
              </View>
            );
          })
        ) : (
          <Empty
            image={<Image className="state-empty-ill" src={emptyComments} svg mode="aspectFit" />}
            title="暂无评价"
            description="还没有人评价，快来写下第一条。"
          />
        )}
      </View>

      {hasMore ? (
        <View className="comment-load-more">
          <Button variant="ghost" size="small" block={false} loading={loadingMore} onClick={() => void loadPage(currentPage + 1)}>
            加载更多
          </Button>
        </View>
      ) : null}
    </Surface>
  );
}
