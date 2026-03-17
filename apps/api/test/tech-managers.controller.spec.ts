import { ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TechManagersController } from '../src/modules/tech-managers/tech-managers.controller';

const VALID_UUID = '12121212-1212-4121-8121-121212121212';

describe('TechManagersController delegation suite', () => {
  let techManagers: any;
  let controller: TechManagersController;

  beforeEach(() => {
    techManagers = {
      search: vi.fn(),
      getPublic: vi.fn(),
      listAdmin: vi.fn(),
      updateAdmin: vi.fn(),
    };
    controller = new TechManagersController(techManagers);
  });

  it('delegates public search and detail routes', async () => {
    techManagers.search.mockResolvedValueOnce({ items: [] });
    techManagers.getPublic.mockResolvedValueOnce({ id: VALID_UUID });

    await expect(controller.search({ q: 'ai' })).resolves.toEqual({ items: [] });
    await expect(controller.getPublic(VALID_UUID)).resolves.toEqual({ id: VALID_UUID });

    expect(techManagers.search).toHaveBeenCalledWith({ q: 'ai' });
    expect(techManagers.getPublic).toHaveBeenCalledWith(VALID_UUID);
  });

  it('requires listing.read permission for listAdmin', async () => {
    const req: any = { auth: { permissions: new Set(['listing.audit']) } };

    await expect(controller.listAdmin(req, { page: '1' })).rejects.toBeInstanceOf(ForbiddenException);

    expect(techManagers.listAdmin).not.toHaveBeenCalled();
  });

  it('delegates listAdmin and updateAdmin with permission and fallback body', async () => {
    const req: any = { auth: { permissions: new Set(['listing.read', 'listing.audit']) } };
    techManagers.listAdmin.mockResolvedValueOnce({ items: [] });
    techManagers.updateAdmin.mockResolvedValueOnce({ ok: true });

    await expect(controller.listAdmin(req, { pageSize: '20' })).resolves.toEqual({ items: [] });
    await expect(controller.updateAdmin(req, VALID_UUID, undefined as any)).resolves.toEqual({ ok: true });

    expect(techManagers.listAdmin).toHaveBeenCalledWith(req, { pageSize: '20' });
    expect(techManagers.updateAdmin).toHaveBeenCalledWith(req, VALID_UUID, {});
  });
});
