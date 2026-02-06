import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';

import { PrismaService } from '../../common/prisma/prisma.service';

type CommentStatus = 'VISIBLE' | 'HIDDEN' | 'DELETED';

type CommentDto = {
  id: string;
  contentType: string;
  contentId: string;
  parentCommentId?: string | null;
  text: string;
  status: CommentStatus;
  createdAt: string;
  updatedAt?: string | null;
  user?: {
    id: string;
    nickname?: string | null;
    avatarUrl?: string | null;
    role?: string | null;
    verificationStatus?: string | null;
    verificationType?: string | null;
  } | null;
};

type CommentThread = { root: CommentDto; replies: CommentDto[] };
type PagedCommentThread = { items: CommentThread[]; page: { page: number; pageSize: number; total: number } };

type CommentRecord = CommentDto & { userId: string };

const COMMENTS: CommentRecord[] = [];

@Injectable()
export class CommentsService {
  constructor(private readonly prisma: PrismaService) {}

  private ensureAuth(req: any) {
    if (!req?.auth?.userId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: '无权限' });
    }
  }

  private async buildUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    return user
      ? {
          id: user.id,
          nickname: user.nickname,
          avatarUrl: user.avatarUrl,
          role: user.role,
        }
      : { id: userId, nickname: '用户' };
  }

  async listThreads(contentType: string, contentId: string, query: any): Promise<PagedCommentThread> {
    const page = Math.max(1, Number(query?.page || 1));
    const pageSize = Math.min(50, Math.max(1, Number(query?.pageSize || 20)));
    const filtered = COMMENTS.filter((c) => c.contentType === contentType && c.contentId === contentId && c.status !== 'DELETED');
    const roots = filtered.filter((c) => !c.parentCommentId);
    const total = roots.length;
    const slice = roots.slice((page - 1) * pageSize, page * pageSize);

    const items: CommentThread[] = slice.map((root) => ({
      root,
      replies: filtered.filter((c) => c.parentCommentId === root.id),
    }));

    return { items, page: { page, pageSize, total } };
  }

  async createComment(req: any, contentType: string, contentId: string, body: any): Promise<CommentDto> {
    this.ensureAuth(req);
    const text = String(body?.text || '').trim();
    if (!text) throw new ForbiddenException({ code: 'BAD_REQUEST', message: '内容不能为空' });
    const parentCommentId = body?.parentCommentId ? String(body.parentCommentId) : null;
    const now = new Date().toISOString();
    const user = await this.buildUser(req.auth.userId);
    const record: CommentRecord = {
      id: randomUUID(),
      contentType,
      contentId,
      parentCommentId,
      text,
      status: 'VISIBLE',
      createdAt: now,
      updatedAt: null,
      user,
      userId: req.auth.userId,
    };
    COMMENTS.unshift(record);
    return record;
  }

  async editComment(req: any, commentId: string, body: any): Promise<CommentDto> {
    this.ensureAuth(req);
    const comment = COMMENTS.find((c) => c.id === commentId);
    if (!comment) throw new NotFoundException({ code: 'NOT_FOUND', message: '评论不存在' });
    if (comment.userId !== req.auth.userId) throw new ForbiddenException({ code: 'FORBIDDEN', message: '无权限' });
    const text = String(body?.text || '').trim();
    if (!text) throw new ForbiddenException({ code: 'BAD_REQUEST', message: '内容不能为空' });
    comment.text = text;
    comment.updatedAt = new Date().toISOString();
    return comment;
  }

  async deleteComment(req: any, commentId: string) {
    this.ensureAuth(req);
    const idx = COMMENTS.findIndex((c) => c.id === commentId);
    if (idx < 0) throw new NotFoundException({ code: 'NOT_FOUND', message: '评论不存在' });
    if (COMMENTS[idx].userId !== req.auth.userId) throw new ForbiddenException({ code: 'FORBIDDEN', message: '无权限' });
    COMMENTS.splice(idx, 1);
    return { ok: true };
  }
}
