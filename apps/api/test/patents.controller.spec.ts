import { ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PatentsController } from '../src/modules/patents/patents.controller';

const VALID_UUID = '15151515-1515-4151-8151-151515151515';

describe('PatentsController delegation suite', () => {
  let patents: any;
  let controller: PatentsController;

  beforeEach(() => {
    patents = {
      ensureAdmin: vi.fn(),
      adminList: vi.fn(),
      adminCreate: vi.fn(),
      adminGetById: vi.fn(),
      adminUpdate: vi.fn(),
      normalizeNumber: vi.fn(),
      getPatentById: vi.fn(),
    };
    controller = new PatentsController(patents);
  });

  it('delegates admin list/get with listing.read permission', async () => {
    const req: any = { auth: { permissions: new Set(['listing.read']) } };
    patents.adminList.mockResolvedValueOnce({ items: [] });
    patents.adminGetById.mockResolvedValueOnce({ id: VALID_UUID });

    await expect(controller.adminList(req, undefined as any)).resolves.toEqual({ items: [] });
    await expect(controller.adminGetById(req, VALID_UUID)).resolves.toEqual({ id: VALID_UUID });

    expect(patents.ensureAdmin).toHaveBeenCalledWith(req);
    expect(patents.adminList).toHaveBeenCalledWith(req, {});
    expect(patents.adminGetById).toHaveBeenCalledWith(req, VALID_UUID);
  });

  it('delegates admin create/update with listing.audit permission and body fallback', async () => {
    const req: any = { auth: { permissions: new Set(['listing.audit']) } };
    patents.adminCreate.mockResolvedValueOnce({ id: VALID_UUID });
    patents.adminUpdate.mockResolvedValueOnce({ ok: true });

    await expect(controller.adminCreate(req, undefined as any)).resolves.toEqual({ id: VALID_UUID });
    await expect(controller.adminUpdate(req, VALID_UUID, null as any)).resolves.toEqual({ ok: true });

    expect(patents.ensureAdmin).toHaveBeenCalledWith(req);
    expect(patents.adminCreate).toHaveBeenCalledWith(req, {});
    expect(patents.adminUpdate).toHaveBeenCalledWith(req, VALID_UUID, {});
  });

  it('rejects admin read/write when corresponding permission is missing', async () => {
    const reqRead: any = { auth: { permissions: new Set(['listing.audit']) } };
    const reqWrite: any = { auth: { permissions: new Set(['listing.read']) } };

    await expect(controller.adminList(reqRead, {} as any)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(controller.adminCreate(reqWrite, {} as any)).rejects.toBeInstanceOf(ForbiddenException);

    expect(patents.adminList).not.toHaveBeenCalled();
    expect(patents.adminCreate).not.toHaveBeenCalled();
  });

  it('delegates normalize and public getById routes', async () => {
    patents.normalizeNumber.mockResolvedValueOnce({ normalized: 'CN123' });
    patents.getPatentById.mockResolvedValueOnce({ id: VALID_UUID });

    await expect(controller.normalize({ raw: ' cn123 ' })).resolves.toEqual({ normalized: 'CN123' });
    await expect(controller.getById(VALID_UUID)).resolves.toEqual({ id: VALID_UUID });

    expect(patents.normalizeNumber).toHaveBeenCalledWith(' cn123 ');
    expect(patents.getPatentById).toHaveBeenCalledWith(VALID_UUID);
  });
});
