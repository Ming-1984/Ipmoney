import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DemandsController } from '../src/modules/demands/demands.controller';

const VALID_UUID = '22222222-2222-4222-8222-222222222222';

describe('DemandsController delegation suite', () => {
  let demands: any;
  let contentAudit: any;
  let controller: DemandsController;

  beforeEach(() => {
    demands = {
      ensureAdmin: vi.fn(),
      adminUpdate: vi.fn(),
      adminReject: vi.fn(),
      create: vi.fn(),
    };
    contentAudit = {
      listMaterials: vi.fn(),
      listLogs: vi.fn(),
    };
    controller = new DemandsController(demands, contentAudit);
  });

  it('delegates getMaterials with normalized demandId for admin listing.read permission', async () => {
    const req: any = { auth: { permissions: new Set(['listing.read']) } };
    contentAudit.listMaterials.mockResolvedValueOnce({ items: [{ id: 'dm-1' }] });

    await expect(controller.getMaterials(req, ` ${VALID_UUID} `)).resolves.toEqual({ items: [{ id: 'dm-1' }] });

    expect(demands.ensureAdmin).toHaveBeenCalledWith(req);
    expect(contentAudit.listMaterials).toHaveBeenCalledWith('DEMAND', VALID_UUID);
  });

  it('rejects getMaterials when listing.read permission is absent', async () => {
    const req: any = { auth: { permissions: new Set(['auditLog.read']) } };

    await expect(controller.getMaterials(req, VALID_UUID)).rejects.toBeInstanceOf(ForbiddenException);

    expect(demands.ensureAdmin).toHaveBeenCalledWith(req);
    expect(contentAudit.listMaterials).not.toHaveBeenCalled();
  });

  it('delegates getAuditLogs when auditLog.read permission exists', async () => {
    const req: any = { auth: { permissions: new Set(['auditLog.read']) } };
    contentAudit.listLogs.mockResolvedValueOnce({ items: [{ id: 'log-1' }] });

    await expect(controller.getAuditLogs(req, VALID_UUID)).resolves.toEqual({ items: [{ id: 'log-1' }] });

    expect(demands.ensureAdmin).toHaveBeenCalledWith(req);
    expect(contentAudit.listLogs).toHaveBeenCalledWith('DEMAND', VALID_UUID);
  });

  it('rejects getAuditLogs for invalid UUID demandId', async () => {
    const req: any = { auth: { permissions: new Set(['auditLog.read']) } };

    await expect(controller.getAuditLogs(req, 'invalid-id')).rejects.toBeInstanceOf(BadRequestException);

    expect(contentAudit.listLogs).not.toHaveBeenCalled();
  });

  it('delegates adminUpdate with fallback empty body', async () => {
    const req: any = { auth: { permissions: new Set(['listing.audit']) } };
    demands.adminUpdate.mockResolvedValueOnce({ id: VALID_UUID, ok: true });

    await expect(controller.adminUpdate(req, VALID_UUID, undefined as any)).resolves.toEqual({ id: VALID_UUID, ok: true });

    expect(demands.adminUpdate).toHaveBeenCalledWith(req, VALID_UUID, {});
  });

  it('delegates reject with fallback empty body and permission check', async () => {
    const req: any = { auth: { permissions: new Set(['listing.audit']) } };
    demands.adminReject.mockResolvedValueOnce({ ok: true });

    await expect(controller.reject(req, VALID_UUID, null as any)).resolves.toEqual({ ok: true });

    expect(demands.adminReject).toHaveBeenCalledWith(req, VALID_UUID, {});
  });

  it('delegates create with fallback empty body', async () => {
    const req: any = { auth: { userId: 'u-1' } };
    demands.create.mockResolvedValueOnce({ id: VALID_UUID });

    await expect(controller.create(req, undefined as any)).resolves.toEqual({ id: VALID_UUID });

    expect(demands.create).toHaveBeenCalledWith(req, {});
  });
});
