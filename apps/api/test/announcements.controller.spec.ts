import { ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AnnouncementsController } from '../src/modules/announcements/announcements.controller';

const VALID_UUID = '55555555-5555-4555-8555-555555555555';

describe('AnnouncementsController delegation suite', () => {
  let announcements: any;
  let controller: AnnouncementsController;

  beforeEach(() => {
    announcements = {
      list: vi.fn(),
      getById: vi.fn(),
      adminList: vi.fn(),
      adminCreate: vi.fn(),
      adminUpdate: vi.fn(),
      adminPublish: vi.fn(),
      adminOffShelf: vi.fn(),
      adminDelete: vi.fn(),
    };
    controller = new AnnouncementsController(announcements);
  });

  it('delegates public list query as-is', async () => {
    announcements.list.mockResolvedValueOnce({ items: [] });

    await expect(controller.list({ q: 'policy', page: '2' })).resolves.toEqual({ items: [] });

    expect(announcements.list).toHaveBeenCalledWith({ q: 'policy', page: '2' });
  });

  it('delegates public getById with route id', async () => {
    announcements.getById.mockResolvedValueOnce({ id: VALID_UUID });

    await expect(controller.getById(VALID_UUID)).resolves.toEqual({ id: VALID_UUID });

    expect(announcements.getById).toHaveBeenCalledWith(VALID_UUID);
  });

  it('rejects adminList when announcement.manage permission is absent', async () => {
    const req: any = { auth: { permissions: new Set(['listing.read']) } };

    await expect(controller.adminList(req, {})).rejects.toBeInstanceOf(ForbiddenException);

    expect(announcements.adminList).not.toHaveBeenCalled();
  });

  it('delegates adminCreate with fallback empty body', async () => {
    const req: any = { auth: { permissions: new Set(['announcement.manage']) } };
    announcements.adminCreate.mockResolvedValueOnce({ id: VALID_UUID, status: 'DRAFT' });

    await expect(controller.adminCreate(req, undefined as any)).resolves.toEqual({ id: VALID_UUID, status: 'DRAFT' });

    expect(announcements.adminCreate).toHaveBeenCalledWith(req, {});
  });

  it('delegates adminUpdate with fallback empty body', async () => {
    const req: any = { auth: { permissions: new Set(['announcement.manage']) } };
    announcements.adminUpdate.mockResolvedValueOnce({ id: VALID_UUID, title: 'updated' });

    await expect(controller.adminUpdate(req, VALID_UUID, null as any)).resolves.toEqual({
      id: VALID_UUID,
      title: 'updated',
    });

    expect(announcements.adminUpdate).toHaveBeenCalledWith(req, VALID_UUID, {});
  });

  it('delegates adminPublish with permission check', async () => {
    const req: any = { auth: { permissions: new Set(['announcement.manage']) } };
    announcements.adminPublish.mockResolvedValueOnce({ ok: true });

    await expect(controller.adminPublish(req, VALID_UUID)).resolves.toEqual({ ok: true });

    expect(announcements.adminPublish).toHaveBeenCalledWith(req, VALID_UUID);
  });

  it('delegates adminDelete with permission check', async () => {
    const req: any = { auth: { permissions: new Set(['announcement.manage']) } };
    announcements.adminDelete.mockResolvedValueOnce(undefined);

    await expect(controller.adminDelete(req, VALID_UUID)).resolves.toBeUndefined();

    expect(announcements.adminDelete).toHaveBeenCalledWith(req, VALID_UUID);
  });
});
