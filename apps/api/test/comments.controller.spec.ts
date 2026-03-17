import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CommentsController } from '../src/modules/comments/comments.controller';

const VALID_UUID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

describe('CommentsController delegation suite', () => {
  let comments: any;
  let controller: CommentsController;

  beforeEach(() => {
    comments = {
      listThreads: vi.fn(),
      createComment: vi.fn(),
      editComment: vi.fn(),
      deleteComment: vi.fn(),
      adminList: vi.fn(),
      adminUpdate: vi.fn(),
    };
    controller = new CommentsController(comments);
  });

  it('delegates public list routes to listThreads with correct content type', async () => {
    comments.listThreads.mockResolvedValue({ items: [] });

    await controller.listListingComments(VALID_UUID, { page: '1' });
    await controller.listDemandComments(VALID_UUID, { page: '2' });
    await controller.listAchievementComments(VALID_UUID, { pageSize: '20' });
    await controller.listArtworkComments(VALID_UUID, {});

    expect(comments.listThreads).toHaveBeenNthCalledWith(1, 'LISTING', VALID_UUID, { page: '1' });
    expect(comments.listThreads).toHaveBeenNthCalledWith(2, 'DEMAND', VALID_UUID, { page: '2' });
    expect(comments.listThreads).toHaveBeenNthCalledWith(3, 'ACHIEVEMENT', VALID_UUID, { pageSize: '20' });
    expect(comments.listThreads).toHaveBeenNthCalledWith(4, 'ARTWORK', VALID_UUID, {});
  });

  it('delegates create comment routes with fallback empty body', async () => {
    const req: any = { auth: { userId: 'user-1' } };
    comments.createComment.mockResolvedValue({ id: 'comment-1' });

    await controller.createListingComment(req, VALID_UUID, undefined as any);
    await controller.createDemandComment(req, VALID_UUID, null as any);
    await controller.createAchievementComment(req, VALID_UUID, undefined as any);
    await controller.createArtworkComment(req, VALID_UUID, null as any);

    expect(comments.createComment).toHaveBeenNthCalledWith(1, req, 'LISTING', VALID_UUID, {});
    expect(comments.createComment).toHaveBeenNthCalledWith(2, req, 'DEMAND', VALID_UUID, {});
    expect(comments.createComment).toHaveBeenNthCalledWith(3, req, 'ACHIEVEMENT', VALID_UUID, {});
    expect(comments.createComment).toHaveBeenNthCalledWith(4, req, 'ARTWORK', VALID_UUID, {});
  });

  it('delegates edit/delete/admin list/admin update paths', async () => {
    const req: any = { auth: { userId: 'user-1' } };
    comments.editComment.mockResolvedValueOnce({ ok: true });
    comments.deleteComment.mockResolvedValueOnce({ ok: true });
    comments.adminList.mockResolvedValueOnce({ items: [{ id: 'comment-1' }] });
    comments.adminUpdate.mockResolvedValueOnce({ ok: true });

    await expect(controller.editComment(req, VALID_UUID, undefined as any)).resolves.toEqual({ ok: true });
    await expect(controller.deleteComment(req, VALID_UUID)).resolves.toEqual({ ok: true });
    await expect(controller.adminList(req, { contentType: 'LISTING' })).resolves.toEqual({
      items: [{ id: 'comment-1' }],
    });
    await expect(controller.adminUpdate(req, VALID_UUID, null as any)).resolves.toEqual({ ok: true });

    expect(comments.editComment).toHaveBeenCalledWith(req, VALID_UUID, {});
    expect(comments.deleteComment).toHaveBeenCalledWith(req, VALID_UUID);
    expect(comments.adminList).toHaveBeenCalledWith(req, { contentType: 'LISTING' });
    expect(comments.adminUpdate).toHaveBeenCalledWith(req, VALID_UUID, {});
  });
});
