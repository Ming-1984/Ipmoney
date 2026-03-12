import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CommentsService } from '../src/modules/comments/comments.service';

const CONTENT_ID = '33333333-3333-4333-8333-333333333333';
const COMMENT_ID = '44444444-4444-4444-8444-444444444444';
const PARENT_ID = '55555555-5555-4555-8555-555555555555';
const USER_ID = 'user-1';
const ADMIN_ID = 'admin-1';

function makeComment(overrides: Record<string, unknown> = {}) {
  return {
    id: COMMENT_ID,
    contentType: 'LISTING',
    contentId: CONTENT_ID,
    parentCommentId: null,
    text: 'hello',
    status: 'VISIBLE',
    userId: USER_ID,
    createdAt: new Date('2026-03-12T00:00:00.000Z'),
    updatedAt: new Date('2026-03-12T00:00:00.000Z'),
    ...overrides,
  };
}

describe('CommentsService write-first suite', () => {
  let prisma: any;
  let service: CommentsService;

  beforeEach(() => {
    prisma = {
      comment: {
        findMany: vi.fn(),
        count: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      user: { findMany: vi.fn() },
      userVerification: { findMany: vi.fn() },
    };
    service = new CommentsService(prisma);
    prisma.user.findMany.mockResolvedValue([{ id: USER_ID, nickname: 'Alice' }]);
    prisma.userVerification.findMany.mockResolvedValue([]);
  });

  const authedReq = { auth: { userId: USER_ID } };
  const adminReq = { auth: { userId: ADMIN_ID, isAdmin: true } };

  it('rejects invalid contentId in listThreads', async () => {
    await expect(service.listThreads('LISTING', 'bad-id', {})).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects non-positive page in listThreads', async () => {
    await expect(service.listThreads('LISTING', CONTENT_ID, { page: '0' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('caps pageSize to 50 and groups roots/replies', async () => {
    const rootId = '66666666-6666-4666-8666-666666666666';
    prisma.comment.findMany
      .mockResolvedValueOnce([makeComment({ id: rootId })])
      .mockResolvedValueOnce([makeComment({ id: PARENT_ID, parentCommentId: rootId })]);
    prisma.comment.count.mockResolvedValueOnce(1);

    const result = await service.listThreads('LISTING', CONTENT_ID, { page: '2', pageSize: '80' });

    expect(prisma.comment.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({ contentType: 'LISTING', contentId: CONTENT_ID, parentCommentId: null }),
        skip: 50,
        take: 50,
      }),
    );
    expect(result.page).toEqual({ page: 2, pageSize: 50, total: 1 });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].replies).toHaveLength(1);
  });

  it('rejects unauthenticated createComment', async () => {
    await expect(service.createComment({}, 'LISTING', CONTENT_ID, { text: 'a' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects empty text on createComment', async () => {
    await expect(service.createComment(authedReq, 'LISTING', CONTENT_ID, { text: '   ' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects invalid parentCommentId on createComment', async () => {
    await expect(
      service.createComment(authedReq, 'LISTING', CONTENT_ID, { text: 'a', parentCommentId: 'bad-id' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects missing parent comment on createComment', async () => {
    prisma.comment.findUnique.mockResolvedValueOnce(null);
    await expect(
      service.createComment(authedReq, 'LISTING', CONTENT_ID, { text: 'a', parentCommentId: PARENT_ID }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects deleted parent comment on createComment', async () => {
    prisma.comment.findUnique.mockResolvedValueOnce(makeComment({ id: PARENT_ID, status: 'DELETED' }));
    await expect(
      service.createComment(authedReq, 'LISTING', CONTENT_ID, { text: 'a', parentCommentId: PARENT_ID }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects parentCommentId with mismatched content target', async () => {
    prisma.comment.findUnique.mockResolvedValueOnce(
      makeComment({ id: PARENT_ID, contentType: 'DEMAND', contentId: CONTENT_ID }),
    );
    await expect(
      service.createComment(authedReq, 'LISTING', CONTENT_ID, { text: 'a', parentCommentId: PARENT_ID }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates root comment with trimmed text', async () => {
    prisma.comment.create.mockResolvedValueOnce(makeComment({ text: 'hello world' }));

    const result = await service.createComment(authedReq, 'LISTING', CONTENT_ID, { text: ' hello world ' });

    expect(prisma.comment.create).toHaveBeenCalledWith({
      data: {
        contentType: 'LISTING',
        contentId: CONTENT_ID,
        parentCommentId: null,
        text: 'hello world',
        status: 'VISIBLE',
        userId: USER_ID,
      },
    });
    expect(result).toMatchObject({ id: COMMENT_ID, text: 'hello world', status: 'VISIBLE' });
  });

  it('creates reply comment when parent is valid', async () => {
    prisma.comment.findUnique.mockResolvedValueOnce(makeComment({ id: PARENT_ID }));
    prisma.comment.create.mockResolvedValueOnce(makeComment({ parentCommentId: PARENT_ID, text: 'reply' }));

    const result = await service.createComment(authedReq, 'LISTING', CONTENT_ID, {
      text: 'reply',
      parentCommentId: PARENT_ID,
    });

    expect(result).toMatchObject({ parentCommentId: PARENT_ID, text: 'reply' });
  });

  it('rejects unauthenticated editComment', async () => {
    await expect(service.editComment({}, COMMENT_ID, { text: 'x' })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects invalid commentId on editComment', async () => {
    await expect(service.editComment(authedReq, 'bad-id', { text: 'x' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects missing/deleted comment on editComment', async () => {
    prisma.comment.findUnique.mockResolvedValueOnce(null);
    await expect(service.editComment(authedReq, COMMENT_ID, { text: 'x' })).rejects.toBeInstanceOf(NotFoundException);

    prisma.comment.findUnique.mockResolvedValueOnce(makeComment({ status: 'DELETED' }));
    await expect(service.editComment(authedReq, COMMENT_ID, { text: 'x' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects editing comment owned by another user', async () => {
    prisma.comment.findUnique.mockResolvedValueOnce(makeComment({ userId: 'user-2' }));
    await expect(service.editComment(authedReq, COMMENT_ID, { text: 'x' })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects empty text on editComment', async () => {
    prisma.comment.findUnique.mockResolvedValueOnce(makeComment());
    await expect(service.editComment(authedReq, COMMENT_ID, { text: '   ' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('updates own comment text', async () => {
    prisma.comment.findUnique.mockResolvedValueOnce(makeComment());
    prisma.comment.update.mockResolvedValueOnce(makeComment({ text: 'updated text' }));

    const result = await service.editComment(authedReq, COMMENT_ID, { text: ' updated text ' });

    expect(prisma.comment.update).toHaveBeenCalledWith({ where: { id: COMMENT_ID }, data: { text: 'updated text' } });
    expect(result).toMatchObject({ id: COMMENT_ID, text: 'updated text' });
  });

  it('rejects unauthenticated deleteComment', async () => {
    await expect(service.deleteComment({}, COMMENT_ID)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects invalid commentId on deleteComment', async () => {
    await expect(service.deleteComment(authedReq, 'bad-id')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects deleting missing/deleted comment', async () => {
    prisma.comment.findUnique.mockResolvedValueOnce(null);
    await expect(service.deleteComment(authedReq, COMMENT_ID)).rejects.toBeInstanceOf(NotFoundException);

    prisma.comment.findUnique.mockResolvedValueOnce(makeComment({ status: 'DELETED' }));
    await expect(service.deleteComment(authedReq, COMMENT_ID)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects deleting comment owned by another user', async () => {
    prisma.comment.findUnique.mockResolvedValueOnce(makeComment({ userId: 'user-2' }));
    await expect(service.deleteComment(authedReq, COMMENT_ID)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('marks own comment as deleted', async () => {
    prisma.comment.findUnique.mockResolvedValueOnce(makeComment());
    prisma.comment.update.mockResolvedValueOnce(makeComment({ status: 'DELETED' }));

    await expect(service.deleteComment(authedReq, COMMENT_ID)).resolves.toEqual({ ok: true });
    expect(prisma.comment.update).toHaveBeenCalledWith({ where: { id: COMMENT_ID }, data: { status: 'DELETED' } });
  });

  it('rejects non-admin adminList/adminUpdate', async () => {
    await expect(service.adminList({ auth: { userId: USER_ID, isAdmin: false } }, {})).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(
      service.adminUpdate({ auth: { userId: USER_ID, isAdmin: false } }, COMMENT_ID, { status: 'VISIBLE' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('validates adminList filters strictly', async () => {
    await expect(service.adminList(adminReq, { contentType: 'bad' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.adminList(adminReq, { status: 'bad' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.adminList(adminReq, { contentId: 'bad-id' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.adminList(adminReq, { page: '0' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lists admin comments with normalized filters and capped pageSize', async () => {
    prisma.comment.findMany.mockResolvedValueOnce([makeComment()]);
    prisma.comment.count.mockResolvedValueOnce(1);

    const result = await service.adminList(adminReq, {
      contentType: ' listing ',
      status: ' visible ',
      contentId: CONTENT_ID,
      q: 'hello',
      page: '1',
      pageSize: '80',
    });

    expect(prisma.comment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          contentType: 'LISTING',
          status: 'VISIBLE',
          contentId: CONTENT_ID,
        }),
        include: { user: true },
        skip: 0,
        take: 50,
      }),
    );
    expect(result.page).toEqual({ page: 1, pageSize: 50, total: 1 });
    expect(result.items).toHaveLength(1);
  });

  it('validates adminUpdate id and status strictly', async () => {
    await expect(service.adminUpdate(adminReq, 'bad-id', { status: 'VISIBLE' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.adminUpdate(adminReq, COMMENT_ID, { status: 'bad' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects adminUpdate when comment does not exist', async () => {
    prisma.comment.findUnique.mockResolvedValueOnce(null);
    await expect(service.adminUpdate(adminReq, COMMENT_ID, { status: 'HIDDEN' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('updates status on adminUpdate success', async () => {
    prisma.comment.findUnique.mockResolvedValueOnce(makeComment());
    prisma.comment.update.mockResolvedValueOnce(makeComment({ status: 'HIDDEN' }));

    const result = await service.adminUpdate(adminReq, COMMENT_ID, { status: ' hidden ' });

    expect(prisma.comment.update).toHaveBeenCalledWith({ where: { id: COMMENT_ID }, data: { status: 'HIDDEN' } });
    expect(result).toMatchObject({ id: COMMENT_ID, status: 'HIDDEN' });
  });
});
