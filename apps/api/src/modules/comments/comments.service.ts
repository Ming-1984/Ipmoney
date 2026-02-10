import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../common/prisma/prisma.service';

const CONTENT_TYPES = ['LISTING', 'DEMAND', 'ACHIEVEMENT', 'ARTWORK'] as const;
const STATUS_TYPES = ['VISIBLE', 'HIDDEN', 'DELETED'] as const;

type CommentContentType = (typeof CONTENT_TYPES)[number];
type CommentStatus = (typeof STATUS_TYPES)[number];

type CommentDto = {
  id: string;
  contentType: CommentContentType;
  contentId: string;
  parentCommentId?: string | null;
  text: string;
  status: CommentStatus;
  createdAt: string;
  updatedAt?: string | null;
  user: {
    id: string;
    nickname?: string | null;
    avatarUrl?: string | null;
    role?: string | null;
    verificationStatus?: string | null;
    verificationType?: string | null;
  };
};

type CommentThread = { root: CommentDto; replies: CommentDto[] };

type PagedCommentThread = { items: CommentThread[]; page: { page: number; pageSize: number; total: number } };

type PagedComment = { items: CommentDto[]; page: { page: number; pageSize: number; total: number } };

@Injectable()
export class CommentsService {
  constructor(private readonly prisma: PrismaService) {}

  private ensureAuth(req: any) {
    if (!req?.auth?.userId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: '无权限' });
    }
  }

  private ensureAdmin(req: any) {
    if (!req?.auth?.isAdmin) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: '无权限' });
    }
  }

  private normalizeContentType(value: any): CommentContentType | undefined {
    const v = String(value || '').trim().toUpperCase();
    if ((CONTENT_TYPES as readonly string[]).includes(v)) return v as CommentContentType;
    return undefined;
  }

  private normalizeStatus(value: any): CommentStatus | undefined {
    const v = String(value || '').trim().toUpperCase();
    if ((STATUS_TYPES as readonly string[]).includes(v)) return v as CommentStatus;
    return undefined;
  }

  private async buildUserBriefMap(userIds: string[]) {
    if (!userIds.length) return new Map<string, CommentDto['user']>();
    const users = await this.prisma.user.findMany({ where: { id: { in: userIds } } });
    const verifications = await this.prisma.userVerification.findMany({
      where: { userId: { in: userIds } },
      orderBy: { submittedAt: 'desc' },
    });
    const verificationMap = new Map<string, any>();
    for (const v of verifications) {
      if (!verificationMap.has(v.userId)) verificationMap.set(v.userId, v);
    }
    const userMap = new Map<string, CommentDto['user']>();
    for (const user of users) {
      const verification = verificationMap.get(user.id);
      userMap.set(user.id, {
        id: user.id,
        nickname: user.nickname ?? null,
        avatarUrl: user.avatarUrl ?? null,
        role: user.role ?? null,
        verificationStatus: verification?.verificationStatus ?? null,
        verificationType: verification?.verificationType ?? null,
      });
    }
    return userMap;
  }

  private toDto(item: any, user?: CommentDto['user']): CommentDto {
    return {
      id: item.id,
      contentType: item.contentType,
      contentId: item.contentId,
      parentCommentId: item.parentCommentId ?? null,
      text: item.text,
      status: item.status,
      createdAt: item.createdAt ? item.createdAt.toISOString() : new Date().toISOString(),
      updatedAt: item.updatedAt ? item.updatedAt.toISOString() : null,
      user: user || { id: item.userId },
    };
  }

  async listThreads(contentType: CommentContentType, contentId: string, query: any): Promise<PagedCommentThread> {
    const page = Math.max(1, Number(query?.page || 1));
    const pageSize = Math.min(50, Math.max(1, Number(query?.pageSize || 20)));
    const rootWhere = { contentType, contentId, status: 'VISIBLE' as CommentStatus, parentCommentId: null };

    const [roots, total] = await Promise.all([
      this.prisma.comment.findMany({
        where: rootWhere,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.comment.count({ where: rootWhere }),
    ]);

    const rootIds = roots.map((r) => r.id);
    const replies = rootIds.length
      ? await this.prisma.comment.findMany({
          where: { contentType, contentId, status: 'VISIBLE' as CommentStatus, parentCommentId: { in: rootIds } },
          orderBy: { createdAt: 'asc' },
        })
      : [];

    const userIds = Array.from(new Set([...roots, ...replies].map((c) => c.userId)));
    const userMap = await this.buildUserBriefMap(userIds);

    const repliesByParent = new Map<string, CommentDto[]>();
    for (const reply of replies) {
      const parentId = reply.parentCommentId as string;
      const list = repliesByParent.get(parentId) || [];
      list.push(this.toDto(reply, userMap.get(reply.userId)));
      repliesByParent.set(parentId, list);
    }

    const items: CommentThread[] = roots.map((root) => ({
      root: this.toDto(root, userMap.get(root.userId)),
      replies: repliesByParent.get(root.id) || [],
    }));

    return { items, page: { page, pageSize, total } };
  }

  async createComment(req: any, contentType: CommentContentType, contentId: string, body: any): Promise<CommentDto> {
    this.ensureAuth(req);
    const text = String(body?.text || '').trim();
    if (!text) throw new ForbiddenException({ code: 'BAD_REQUEST', message: '内容不能为空' });
    const parentCommentId = body?.parentCommentId ? String(body.parentCommentId) : null;

    if (parentCommentId) {
      const parent = await this.prisma.comment.findUnique({ where: { id: parentCommentId } });
      if (!parent || parent.status === 'DELETED') {
        throw new NotFoundException({ code: 'NOT_FOUND', message: '评论不存在' });
      }
      if (parent.contentType !== contentType || parent.contentId !== contentId) {
        throw new BadRequestException({ code: 'BAD_REQUEST', message: 'parentCommentId is invalid' });
      }
    }

    const created = await this.prisma.comment.create({
      data: {
        contentType,
        contentId,
        parentCommentId,
        text,
        status: 'VISIBLE',
        userId: req.auth.userId,
      },
    });

    const userMap = await this.buildUserBriefMap([req.auth.userId]);
    return this.toDto(created, userMap.get(req.auth.userId));
  }

  async editComment(req: any, commentId: string, body: any): Promise<CommentDto> {
    this.ensureAuth(req);
    const comment = await this.prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment || comment.status === 'DELETED') {
      throw new NotFoundException({ code: 'NOT_FOUND', message: '评论不存在' });
    }
    if (comment.userId !== req.auth.userId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: '无权限' });
    }
    const text = String(body?.text || '').trim();
    if (!text) throw new ForbiddenException({ code: 'BAD_REQUEST', message: '内容不能为空' });
    const updated = await this.prisma.comment.update({ where: { id: commentId }, data: { text } });
    const userMap = await this.buildUserBriefMap([comment.userId]);
    return this.toDto(updated, userMap.get(comment.userId));
  }

  async deleteComment(req: any, commentId: string) {
    this.ensureAuth(req);
    const comment = await this.prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment || comment.status === 'DELETED') {
      throw new NotFoundException({ code: 'NOT_FOUND', message: '评论不存在' });
    }
    if (comment.userId !== req.auth.userId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: '无权限' });
    }
    await this.prisma.comment.update({ where: { id: commentId }, data: { status: 'DELETED' } });
    return { ok: true };
  }

  async adminList(req: any, query: any): Promise<PagedComment> {
    this.ensureAdmin(req);
    const page = Math.max(1, Number(query?.page || 1));
    const pageSize = Math.min(50, Math.max(1, Number(query?.pageSize || 20)));
    const q = String(query?.q || '').trim();
    const contentTypeRaw = query?.contentType;
    const statusRaw = query?.status;
    const contentType = contentTypeRaw ? this.normalizeContentType(contentTypeRaw) : undefined;
    const status = statusRaw ? this.normalizeStatus(statusRaw) : undefined;
    const contentId = query?.contentId ? String(query.contentId).trim() : '';

    if (contentTypeRaw && !contentType) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'contentType is invalid' });
    }
    if (statusRaw && !status) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'status is invalid' });
    }

    const where: any = {};
    if (contentType) where.contentType = contentType;
    if (contentId) where.contentId = contentId;
    if (status) where.status = status;
    if (q) {
      where.OR = [
        { text: { contains: q, mode: 'insensitive' } },
        { userId: q },
        { user: { nickname: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.comment.findMany({
        where,
        include: { user: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.comment.count({ where }),
    ]);

    const userIds = Array.from(new Set(items.map((c) => c.userId)));
    const userMap = await this.buildUserBriefMap(userIds);
    const mapped = items.map((item) => this.toDto(item, userMap.get(item.userId)));

    return { items: mapped, page: { page, pageSize, total } };
  }

  async adminUpdate(req: any, commentId: string, body: any): Promise<CommentDto> {
    this.ensureAdmin(req);
    const status = this.normalizeStatus(body?.status);
    if (!status) throw new BadRequestException({ code: 'BAD_REQUEST', message: 'status is invalid' });
    const existing = await this.prisma.comment.findUnique({ where: { id: commentId } });
    if (!existing) throw new NotFoundException({ code: 'NOT_FOUND', message: '评论不存在' });
    const updated = await this.prisma.comment.update({ where: { id: commentId }, data: { status } });
    const userMap = await this.buildUserBriefMap([updated.userId]);
    return this.toDto(updated, userMap.get(updated.userId));
  }
}
