import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ListingsController } from '../src/modules/listings/listings.controller';

const VALID_UUID = '11111111-1111-4111-8111-111111111111';

describe('ListingsController delegation suite', () => {
  let listings: any;
  let contentAudit: any;
  let controller: ListingsController;

  beforeEach(() => {
    listings = {
      ensureAdmin: vi.fn(),
      adminUpdate: vi.fn(),
      approve: vi.fn(),
    };
    contentAudit = {
      listMaterials: vi.fn(),
      listLogs: vi.fn(),
    };
    controller = new ListingsController(listings, contentAudit);
  });

  it('delegates getMaterials with normalized UUID when listing.read permission exists', async () => {
    const req: any = { auth: { permissions: new Set(['listing.read']) } };
    contentAudit.listMaterials.mockResolvedValueOnce({ items: [{ id: 'm-1' }] });

    await expect(controller.getMaterials(req, ` ${VALID_UUID} `)).resolves.toEqual({ items: [{ id: 'm-1' }] });

    expect(listings.ensureAdmin).toHaveBeenCalledWith(req);
    expect(contentAudit.listMaterials).toHaveBeenCalledWith('LISTING', VALID_UUID);
  });

  it('rejects getMaterials when permission is missing', async () => {
    const req: any = { auth: { permissions: new Set(['auditLog.read']) } };

    await expect(controller.getMaterials(req, VALID_UUID)).rejects.toBeInstanceOf(ForbiddenException);

    expect(listings.ensureAdmin).toHaveBeenCalledWith(req);
    expect(contentAudit.listMaterials).not.toHaveBeenCalled();
  });

  it('delegates getAuditLogs with auditLog.read permission', async () => {
    const req: any = { auth: { permissions: new Set(['auditLog.read']) } };
    contentAudit.listLogs.mockResolvedValueOnce({ items: [{ id: 'log-1' }] });

    await expect(controller.getAuditLogs(req, VALID_UUID)).resolves.toEqual({ items: [{ id: 'log-1' }] });

    expect(listings.ensureAdmin).toHaveBeenCalledWith(req);
    expect(contentAudit.listLogs).toHaveBeenCalledWith('LISTING', VALID_UUID);
  });

  it('rejects getAuditLogs when listingId is invalid', async () => {
    const req: any = { auth: { permissions: new Set(['auditLog.read']) } };

    await expect(controller.getAuditLogs(req, 'not-a-uuid')).rejects.toBeInstanceOf(BadRequestException);

    expect(listings.ensureAdmin).toHaveBeenCalledWith(req);
    expect(contentAudit.listLogs).not.toHaveBeenCalled();
  });

  it('delegates adminUpdate with fallback empty body and normalized UUID', async () => {
    const req: any = { auth: { permissions: new Set(['listing.audit']) } };
    listings.adminUpdate.mockResolvedValueOnce({ id: VALID_UUID, title: 'updated' });

    await expect(controller.adminUpdate(req, ` ${VALID_UUID} `, null as any)).resolves.toEqual({
      id: VALID_UUID,
      title: 'updated',
    });

    expect(listings.adminUpdate).toHaveBeenCalledWith(req, VALID_UUID, {});
  });

  it('delegates approve with normalized UUID and operator identity', async () => {
    const req: any = { auth: { userId: 'admin-1', permissions: new Set(['listing.audit']) } };
    listings.approve.mockResolvedValueOnce({ ok: true });

    await expect(controller.approve(req, VALID_UUID, { reason: 'looks good' })).resolves.toEqual({ ok: true });

    expect(listings.approve).toHaveBeenCalledWith(VALID_UUID, 'admin-1', 'looks good');
  });
});
