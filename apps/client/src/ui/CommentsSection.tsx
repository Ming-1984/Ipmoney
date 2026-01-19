import { View, Text } from '@tarojs/components';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import type { components } from '@ipmoney/api-types';

import { apiDelete, apiGet, apiPatch, apiPost } from '../lib/api';
import { getToken } from '../lib/auth';
import { formatTimeSmart } from '../lib/format';
import { ensureApproved } from '../lib/guard';
import { SectionHeader, Spacer, Surface } from './layout';
import { Avatar, Button, Empty, Space, Tag, TextArea, confirm, toast } from './nutui';

type CommentContentType = components['schemas']['CommentContentType'];
type CommentStatus = components['schemas']['CommentStatus'];
type CommentThread = components['schemas']['CommentThread'];
type Comment = components['schemas']['Comment'];
type PagedCommentThread = components['schemas']['PagedCommentThread'];
type PageMeta = components['schemas']['PageMeta'];
type Me = components['schemas']['Me'];

type ComposerState =
  | { mode: 'new' }
  | { mode: 'reply'; targetId: string; targetName: string }
  | { mode: 'edit'; targetId: string; targetName: string };

const DEFAULT_PAGE_SIZE = 10;

function normalizeStatus(status?: CommentStatus | null): CommentStatus {
  return status || 'VISIBLE';
}

function displayUserName(user?: Comment['user']): string {
  return user?.nickname || '用户';
}

function displayUserInitial(user?: Comment['user']): string {
  const name = displayUserName(user);
  return name ? name.slice(0, 1) : 'U';
}

export function CommentsSection(props: { contentType: CommentContentType; contentId: string }) {
  const { contentType, contentId } = props;
  const [threads, setThreads] = useState<CommentThread[]>([]);
  const [pageMeta, setPageMeta] = useState<PageMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [composer, setComposer] = useState<ComposerState>({ mode: 'new' });
  const [composerText, setComposerText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

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
          contentType === 'LISTING'
            ? await apiGet<PagedCommentThread>(`/public/listings/${contentId}/comments`, params)
            : contentType === 'DEMAND'
              ? await apiGet<PagedCommentThread>(`/public/demands/${contentId}/comments`, params)
              : contentType === 'ARTWORK'
                ? await apiGet<PagedCommentThread>(`/public/artworks/${contentId}/comments`, params)
                : await apiGet<PagedCommentThread>(`/public/achievements/${contentId}/comments`, params);
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
    void loadPage(1);
  }, [loadPage]);

  useEffect(() => {
    if (!getToken()) {
      setCurrentUserId(null);
      return;
    }
    apiGet<Me>('/me')
      .then((d) => setCurrentUserId(d.id))
      .catch(() => setCurrentUserId(null));
  }, [contentId, contentType]);

  const total = pageMeta?.total ?? threads.length;
  const currentPage = pageMeta?.page ?? 1;
  const hasMore = threads.length < total;

  const resetComposer = useCallback(() => {
    setComposer({ mode: 'new' });
    setComposerText('');
  }, []);

  const startReply = useCallback(
    (comment: Comment) => {
      if (!ensureApproved()) return;
      if (normalizeStatus(comment.status) !== 'VISIBLE') {
        toast('该留言暂不可回复');
        return;
      }
      setComposer({ mode: 'reply', targetId: comment.id, targetName: displayUserName(comment.user) });
      setComposerText('');
    },
    [],
  );

  const startEdit = useCallback(
    (comment: Comment) => {
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
    },
    [currentUserId],
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
        if (contentType === 'LISTING') {
          await apiPost<Comment>(`/listings/${contentId}/comments`, payload, {
            idempotencyKey: `comment-${contentId}-${Date.now()}`,
          });
        } else if (contentType === 'DEMAND') {
          await apiPost<Comment>(`/demands/${contentId}/comments`, payload, {
            idempotencyKey: `comment-${contentId}-${Date.now()}`,
          });
        } else if (contentType === 'ARTWORK') {
          await apiPost<Comment>(`/artworks/${contentId}/comments`, payload, {
            idempotencyKey: `comment-${contentId}-${Date.now()}`,
          });
        } else {
          await apiPost<Comment>(`/achievements/${contentId}/comments`, payload, {
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

  const composerLabel =
    composer.mode === 'reply'
      ? `回复 ${composer.targetName}`
      : composer.mode === 'edit'
        ? '编辑留言'
        : '';

  const composerPlaceholder =
    composer.mode === 'reply'
      ? `回复 ${composer.targetName}`
      : composer.mode === 'edit'
        ? '编辑留言内容'
        : '写下你的留言，帮助大家更快了解…';

  const renderComment = (comment: Comment, options?: { isReply?: boolean; rootId?: string }) => {
    const status = normalizeStatus(comment.status);
    const isOwner = currentUserId && comment.user?.id === currentUserId;
    const isVisible = status === 'VISIBLE';
    const canReply = isVisible;
    const canEdit = Boolean(isOwner && isVisible);
    const canDelete = Boolean(isOwner && status !== 'DELETED');
    const edited = Boolean(comment.updatedAt && comment.updatedAt !== comment.createdAt);
    const replyToName =
      options?.isReply && comment.parentCommentId
        ? displayUserName(commentById.get(comment.parentCommentId)?.user)
        : null;

    return (
      <View className={`comment-item ${options?.isReply ? 'comment-reply-item' : ''}`}>
        <Avatar size="32" src={comment.user?.avatarUrl || ''} background="rgba(15, 23, 42, 0.06)" color="var(--c-muted)">
          {displayUserInitial(comment.user)}
        </Avatar>
        <View className="comment-body">
          <View className="row-between">
            <Text className="text-strong">{displayUserName(comment.user)}</Text>
            <Space size={6} align="center">
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
            </Space>
          </View>
          <Spacer size={4} />
          <Text className={`comment-text break-word ${status === 'VISIBLE' ? '' : 'comment-text-muted'}`}>
            {replyToName ? <Text className="comment-reply-prefix">回复 {replyToName}：</Text> : null}
            {comment.text || ''}
          </Text>
          <View className="comment-actions">
            {canReply ? (
              <Button variant="ghost" size="mini" block={false} onClick={() => startReply(comment)}>
                回复
              </Button>
            ) : null}
            {canEdit ? (
              <Button variant="ghost" size="mini" block={false} onClick={() => startEdit(comment)}>
                编辑
              </Button>
            ) : null}
            {canDelete ? (
              <Button variant="danger" size="mini" block={false} onClick={() => void removeComment(comment)}>
                删除
              </Button>
            ) : null}
          </View>
        </View>
      </View>
    );
  };

  return (
    <Surface>
      <SectionHeader title={`留言${total ? `（${total}）` : ''}`} density="compact" />
      <View className="comment-composer">
        {composerLabel ? (
          <View className="comment-composer-mode">
            <Tag type="default" plain round>
              {composerLabel}
            </Tag>
            <Button variant="ghost" size="mini" block={false} onClick={resetComposer}>
              取消
            </Button>
          </View>
        ) : null}
        <TextArea value={composerText} onChange={setComposerText} placeholder={composerPlaceholder} maxLength={1000} />
        <View className="comment-composer-actions">
          <Text className="comment-composer-hint">公开可见，登录且审核通过可留言/回复</Text>
          <Button variant="primary" size="small" block={false} loading={submitting} onClick={() => void submit()}>
            {composer.mode === 'edit' ? '保存' : '发布'}
          </Button>
        </View>
      </View>

      <Spacer size={12} />

      <View className="comment-list">
        {loading ? (
          <View className="comment-state">
            <Text className="muted">加载中…</Text>
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
                      <View key={reply.id}>{renderComment(reply, { isReply: true, rootId: thread.root.id })}</View>
                    ))}
                  </View>
                ) : null}
                {idx < threads.length - 1 ? <View className="divider" /> : null}
              </View>
            );
          })
        ) : (
          <Empty description="暂无留言" />
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
