import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../common/prisma/prisma.service';
import { normalizeDisplayText, resolvePublicAvatarUrl } from '../content-utils';

const CONTENT_TYPES = ['LISTING', 'ACHIEVEMENT'] as const;
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
    displayName?: string | null;
    nickname?: string | null;
    avatarUrl?: string | null;
    role?: string | null;
  };
};

type AdminCommentDto = CommentDto & {
  contentTitle?: string | null;
  user: CommentDto['user'] & {
    verificationStatus?: string | null;
    verificationType?: string | null;
  };
};

type CommentThread = { root: CommentDto; replies: CommentDto[] };

type PagedCommentThread = { items: CommentThread[]; page: { page: number; pageSize: number; total: number } };

type PagedComment = { items: AdminCommentDto[]; page: { page: number; pageSize: number; total: number } };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class CommentsService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertPublicContentVisible(contentType: CommentContentType, contentId: string): Promise<void> {
    if (contentType === 'LISTING') {
      const listing = await this.prisma.listing.findFirst({
        where: { id: contentId, auditStatus: 'APPROVED', status: 'ACTIVE' },
        select: { id: true },
      });
      if (!listing) throw new NotFoundException({ code: 'NOT_FOUND', message: 'listing not found' });
      return;
    }

    const achievement = await this.prisma.achievement.findFirst({
      where: { id: contentId, auditStatus: 'APPROVED', status: 'ACTIVE' },
      select: { id: true },
    });
    if (!achievement) throw new NotFoundException({ code: 'NOT_FOUND', message: 'achievement not found' });
  }

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

  private hasOwn(input: any, key: string) {
    return !!input && Object.prototype.hasOwnProperty.call(input, key);
  }

  private parsePositiveIntStrict(value: unknown, fieldName: string): number {
    const raw = String(value ?? '').trim();
    if (!raw) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    const parsed = Number(raw);
    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return parsed;
  }

  private parseUuidStrict(value: unknown, fieldName: string): string {
    const raw = String(value ?? '').trim();
    if (!raw || !UUID_RE.test(raw)) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return raw;
  }

  private parseNullableIdStrict(value: unknown, fieldName: string): string | null {
    if (value === null) return null;
    return this.parseUuidStrict(value, fieldName);
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

  private async buildUserBriefMap(userIds: string[], opts?: { includeVerificationMeta?: boolean }) {
    if (!userIds.length) return new Map<string, AdminCommentDto['user']>();
    const users = await this.prisma.user.findMany({ where: { id: { in: userIds } } });
    const includeVerificationMeta = opts?.includeVerificationMeta ?? false;
    const verificationMap = new Map<string, any>();
    if (includeVerificationMeta) {
      const verifications = await this.prisma.userVerification.findMany({
        where: { userId: { in: userIds } },
        orderBy: { submittedAt: 'desc' },
      });
      for (const v of verifications) {
        if (!verificationMap.has(v.userId)) verificationMap.set(v.userId, v);
      }
    }
    const userMap = new Map<string, AdminCommentDto['user']>();
    for (const user of users) {
      const verification = verificationMap.get(user.id);
      userMap.set(user.id, {
        id: user.id,
        displayName: normalizeDisplayText(verification?.displayName) ?? null,
        nickname: user.nickname ?? null,
        avatarUrl: resolvePublicAvatarUrl(user.avatarUrl),
        role: user.role ?? null,
        ...(includeVerificationMeta
          ? {
              verificationStatus: verification?.verificationStatus ?? null,
              verificationType: verification?.verificationType ?? null,
            }
          : {}),
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

  private toAdminDto(item: any, user?: AdminCommentDto['user']): AdminCommentDto {
    return {
      ...this.toDto(item, user),
      contentTitle: normalizeDisplayText(item.contentTitle) || null,
      user: (user || { id: item.userId }) as AdminCommentDto['user'],
    };
  }

  private async buildContentTitleMap(items: Array<{ contentType?: CommentContentType; contentId?: string | null }>) {
    const listingIds = Array.from(
      new Set(
        items
          .filter((item) => item.contentType === 'LISTING' && item.contentId)
          .map((item) => String(item.contentId)),
      ),
    );
    const achievementIds = Array.from(
      new Set(
        items
          .filter((item) => item.contentType === 'ACHIEVEMENT' && item.contentId)
          .map((item) => String(item.contentId)),
      ),
    );

    const [listings, achievements] = await Promise.all([
      listingIds.length
        ? this.prisma.listing.findMany({
            where: { id: { in: listingIds } },
            select: { id: true, title: true },
          })
        : Promise.resolve([]),
      achievementIds.length
        ? this.prisma.achievement.findMany({
            where: { id: { in: achievementIds } },
            select: { id: true, title: true },
          })
        : Promise.resolve([]),
    ]);

    const titleMap = new Map<string, string>();
    for (const item of listings) {
      const title = normalizeDisplayText(item.title);
      if (title) titleMap.set(`LISTING:${item.id}`, title);
    }
    for (const item of achievements) {
      const title = normalizeDisplayText(item.title);
      if (title) titleMap.set(`ACHIEVEMENT:${item.id}`, title);
    }
    return titleMap;
  }

  private matchesAdminSearch(item: AdminCommentDto, keyword: string): boolean {
    const normalizedKeyword = String(keyword || '')
      .trim()
      .toLowerCase();
    if (!normalizedKeyword) return true;
    const candidates = [
      normalizeDisplayText(item.text),
      normalizeDisplayText(item.contentTitle),
      normalizeDisplayText(item.user?.displayName),
      normalizeDisplayText(item.user?.nickname),
    ]
      .filter(Boolean)
      .map((value) => String(value).toLowerCase());
    return candidates.some((candidate) => candidate.includes(normalizedKeyword));
  }

  private scoreAdminSearch(item: AdminCommentDto, keyword: string): number {
    const normalizedKeyword = String(keyword || '')
      .trim()
      .toLowerCase();
    if (!normalizedKeyword) return 0;

    const displayName = normalizeDisplayText(item.user?.displayName)?.toLowerCase() ?? '';
    const nickname = normalizeDisplayText(item.user?.nickname)?.toLowerCase() ?? '';
    const contentTitle = normalizeDisplayText(item.contentTitle)?.toLowerCase() ?? '';
    const text = normalizeDisplayText(item.text)?.toLowerCase() ?? '';

    let score = 0;
    if (displayName === normalizedKeyword) score += 1000;
    else if (displayName.startsWith(normalizedKeyword)) score += 800;
    else if (displayName.includes(normalizedKeyword)) score += 600;

    if (nickname === normalizedKeyword) score += 420;
    else if (nickname.startsWith(normalizedKeyword)) score += 300;
    else if (nickname.includes(normalizedKeyword)) score += 180;

    if (contentTitle === normalizedKeyword) score += 360;
    else if (contentTitle.startsWith(normalizedKeyword)) score += 260;
    else if (contentTitle.includes(normalizedKeyword)) score += 160;

    if (text.includes(normalizedKeyword)) score += 80;

    return score;
  }

  private hasStrongAdminUserMatch(item: AdminCommentDto, keyword: string): boolean {
    const normalizedKeyword = String(keyword || '')
      .trim()
      .toLowerCase();
    if (!normalizedKeyword) return false;
    const displayName = normalizeDisplayText(item.user?.displayName)?.toLowerCase() ?? '';
    const nickname = normalizeDisplayText(item.user?.nickname)?.toLowerCase() ?? '';
    return (
      (Boolean(displayName) && (displayName === normalizedKeyword || displayName.startsWith(normalizedKeyword))) ||
      (Boolean(nickname) && (nickname === normalizedKeyword || nickname.startsWith(normalizedKeyword)))
    );
  }

  private paginateItems<T>(items: T[], page: number, pageSize: number): { items: T[]; total: number } {
    const total = items.length;
    const start = (page - 1) * pageSize;
    return { items: items.slice(start, start + pageSize), total };
  }

  async listThreads(contentType: CommentContentType, contentId: string, query: any): Promise<PagedCommentThread> {
    const normalizedContentId = this.parseUuidStrict(contentId, 'contentId');
    await this.assertPublicContentVisible(contentType, normalizedContentId);
    const page = this.hasOwn(query, 'page') ? this.parsePositiveIntStrict(query?.page, 'page') : 1;
    const pageSizeInput = this.hasOwn(query, 'pageSize') ? this.parsePositiveIntStrict(query?.pageSize, 'pageSize') : 20;
    const pageSize = Math.min(50, pageSizeInput);
    const rootWhere = {
      contentType,
      contentId: normalizedContentId,
      status: 'VISIBLE' as CommentStatus,
      parentCommentId: null,
    };

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
          where: {
            contentType,
            contentId: normalizedContentId,
            status: 'VISIBLE' as CommentStatus,
            parentCommentId: { in: rootIds },
          },
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
    const normalizedContentId = this.parseUuidStrict(contentId, 'contentId');
    await this.assertPublicContentVisible(contentType, normalizedContentId);
    const text = String(body?.text || '').trim();
    if (!text) throw new BadRequestException({ code: 'BAD_REQUEST', message: '内容不能为空' });
    const hasParentCommentId = this.hasOwn(body, 'parentCommentId');
    const parentCommentId = hasParentCommentId
      ? this.parseNullableIdStrict(body?.parentCommentId, 'parentCommentId')
      : null;

    if (parentCommentId) {
      const parent = await this.prisma.comment.findUnique({ where: { id: parentCommentId } });
      if (!parent || parent.status === 'DELETED') {
        throw new NotFoundException({ code: 'NOT_FOUND', message: '评论不存在' });
      }
      if (parent.contentType !== contentType || parent.contentId !== normalizedContentId) {
        throw new BadRequestException({ code: 'BAD_REQUEST', message: 'parentCommentId is invalid' });
      }
    }

    const created = await this.prisma.comment.create({
      data: {
        contentType,
        contentId: normalizedContentId,
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
    const normalizedCommentId = this.parseUuidStrict(commentId, 'commentId');
    const comment = await this.prisma.comment.findUnique({ where: { id: normalizedCommentId } });
    if (!comment || comment.status === 'DELETED') {
      throw new NotFoundException({ code: 'NOT_FOUND', message: '评论不存在' });
    }
    if (comment.userId !== req.auth.userId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: '无权限' });
    }
    const text = String(body?.text || '').trim();
    if (!text) throw new BadRequestException({ code: 'BAD_REQUEST', message: '内容不能为空' });
    const updated = await this.prisma.comment.update({ where: { id: normalizedCommentId }, data: { text } });
    const userMap = await this.buildUserBriefMap([comment.userId]);
    return this.toDto(updated, userMap.get(comment.userId));
  }

  async deleteComment(req: any, commentId: string) {
    this.ensureAuth(req);
    const normalizedCommentId = this.parseUuidStrict(commentId, 'commentId');
    const comment = await this.prisma.comment.findUnique({ where: { id: normalizedCommentId } });
    if (!comment || comment.status === 'DELETED') {
      throw new NotFoundException({ code: 'NOT_FOUND', message: '评论不存在' });
    }
    if (comment.userId !== req.auth.userId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: '无权限' });
    }
    await this.prisma.comment.update({ where: { id: normalizedCommentId }, data: { status: 'DELETED' } });
    return { ok: true };
  }

  async adminList(req: any, query: any): Promise<PagedComment> {
    this.ensureAdmin(req);
    const page = this.hasOwn(query, 'page') ? this.parsePositiveIntStrict(query?.page, 'page') : 1;
    const pageSizeInput = this.hasOwn(query, 'pageSize') ? this.parsePositiveIntStrict(query?.pageSize, 'pageSize') : 20;
    const pageSize = Math.min(50, pageSizeInput);
    const q = String(query?.q || '').trim();
    const hasContentType = this.hasOwn(query, 'contentType');
    const hasStatus = this.hasOwn(query, 'status');
    const hasContentId = this.hasOwn(query, 'contentId');
    const contentType = hasContentType ? this.normalizeContentType(query?.contentType) : undefined;
    const status = hasStatus ? this.normalizeStatus(query?.status) : undefined;
    const contentId = hasContentId ? this.parseUuidStrict(query?.contentId, 'contentId') : '';

    if (hasContentType && !contentType) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'contentType is invalid' });
    }
    if (hasStatus && !status) {
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
        ...(contentType === 'ACHIEVEMENT'
          ? [{ achievement: { title: { contains: q, mode: 'insensitive' } } }]
          : contentType === 'LISTING'
            ? [{ listing: { title: { contains: q, mode: 'insensitive' } } }]
            : [
                { listing: { title: { contains: q, mode: 'insensitive' } } },
                { achievement: { title: { contains: q, mode: 'insensitive' } } },
              ]),
        { user: { verifications: { some: { displayName: { contains: q, mode: 'insensitive' } } } } },
        { user: { nickname: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const queryOptions: any = {
      where,
      include: { user: true },
      orderBy: { createdAt: 'desc' as const },
    };
    const [items, total] = q
      ? await Promise.all([this.prisma.comment.findMany(queryOptions), Promise.resolve(0)])
      : await Promise.all([
          this.prisma.comment.findMany({
            ...queryOptions,
            skip: (page - 1) * pageSize,
            take: pageSize,
          }),
          this.prisma.comment.count({ where }),
        ]);

    const userIds = Array.from(new Set(items.map((c) => c.userId)));
    const userMap = await this.buildUserBriefMap(userIds, { includeVerificationMeta: true });
    const contentTitleMap = await this.buildContentTitleMap(items);
    const mapped = items.map((item) =>
      this.toAdminDto(
        {
          ...item,
          contentTitle: contentTitleMap.get(`${String(item.contentType || '').toUpperCase()}:${item.contentId}`) ?? null,
        },
        userMap.get(item.userId),
      ),
    );

    if (q) {
      const matched = mapped.filter((item) => this.matchesAdminSearch(item, q));
      const strongMatches = matched.filter((item) => this.hasStrongAdminUserMatch(item, q));
      const searchPool = strongMatches.length ? strongMatches : matched;
      const filtered = searchPool.sort((a, b) => this.scoreAdminSearch(b, q) - this.scoreAdminSearch(a, q));
      const paged = this.paginateItems(filtered, page, pageSize);
      return { items: paged.items, page: { page, pageSize, total: paged.total } };
    }

    return { items: mapped, page: { page, pageSize, total } };
  }

  async adminUpdate(req: any, commentId: string, body: any): Promise<CommentDto> {
    this.ensureAdmin(req);
    const normalizedCommentId = this.parseUuidStrict(commentId, 'commentId');
    const status = this.normalizeStatus(body?.status);
    if (!status) throw new BadRequestException({ code: 'BAD_REQUEST', message: 'status is invalid' });
    const existing = await this.prisma.comment.findUnique({ where: { id: normalizedCommentId } });
    if (!existing) throw new NotFoundException({ code: 'NOT_FOUND', message: '评论不存在' });
    const updated = await this.prisma.comment.update({ where: { id: normalizedCommentId }, data: { status } });
    const userMap = await this.buildUserBriefMap([updated.userId], { includeVerificationMeta: true });
    return this.toAdminDto(updated, userMap.get(updated.userId));
  }
}


