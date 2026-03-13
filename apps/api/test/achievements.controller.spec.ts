import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AchievementsController } from '../src/modules/achievements/achievements.controller';

const VALID_UUID = '33333333-3333-4333-8333-333333333333';

describe('AchievementsController delegation suite', () => {
  let achievements: any;
  let contentAudit: any;
  let controller: AchievementsController;

  beforeEach(() => {
    achievements = {
      ensureAdmin: vi.fn(),
      adminUpdate: vi.fn(),
      adminReject: vi.fn(),
      create: vi.fn(),
    };
    contentAudit = {
      listMaterials: vi.fn(),
      listLogs: vi.fn(),
    };
    controller = new AchievementsController(achievements, contentAudit);
  });

  it('delegates getMaterials with normalized achievementId for admin listing.read permission', async () => {
    const req: any = { auth: { permissions: new Set(['listing.read']) } };
    contentAudit.listMaterials.mockResolvedValueOnce({ items: [{ id: 'ac-1' }] });

    await expect(controller.getMaterials(req, ` ${VALID_UUID} `)).resolves.toEqual({ items: [{ id: 'ac-1' }] });

    expect(achievements.ensureAdmin).toHaveBeenCalledWith(req);
    expect(contentAudit.listMaterials).toHaveBeenCalledWith('ACHIEVEMENT', VALID_UUID);
  });

  it('rejects getMaterials when listing.read permission is absent', async () => {
    const req: any = { auth: { permissions: new Set(['auditLog.read']) } };

    await expect(controller.getMaterials(req, VALID_UUID)).rejects.toBeInstanceOf(ForbiddenException);

    expect(achievements.ensureAdmin).toHaveBeenCalledWith(req);
    expect(contentAudit.listMaterials).not.toHaveBeenCalled();
  });

  it('delegates getAuditLogs when auditLog.read permission exists', async () => {
    const req: any = { auth: { permissions: new Set(['auditLog.read']) } };
    contentAudit.listLogs.mockResolvedValueOnce({ items: [{ id: 'log-1' }] });

    await expect(controller.getAuditLogs(req, VALID_UUID)).resolves.toEqual({ items: [{ id: 'log-1' }] });

    expect(achievements.ensureAdmin).toHaveBeenCalledWith(req);
    expect(contentAudit.listLogs).toHaveBeenCalledWith('ACHIEVEMENT', VALID_UUID);
  });

  it('rejects getAuditLogs for invalid UUID achievementId', async () => {
    const req: any = { auth: { permissions: new Set(['auditLog.read']) } };

    await expect(controller.getAuditLogs(req, 'invalid-id')).rejects.toBeInstanceOf(BadRequestException);

    expect(contentAudit.listLogs).not.toHaveBeenCalled();
  });

  it('delegates adminUpdate with fallback empty body', async () => {
    const req: any = { auth: { permissions: new Set(['listing.audit']) } };
    achievements.adminUpdate.mockResolvedValueOnce({ id: VALID_UUID, ok: true });

    await expect(controller.adminUpdate(req, VALID_UUID, undefined as any)).resolves.toEqual({
      id: VALID_UUID,
      ok: true,
    });

    expect(achievements.adminUpdate).toHaveBeenCalledWith(req, VALID_UUID, {});
  });

  it('delegates reject with fallback empty body and permission check', async () => {
    const req: any = { auth: { permissions: new Set(['listing.audit']) } };
    achievements.adminReject.mockResolvedValueOnce({ ok: true });

    await expect(controller.reject(req, VALID_UUID, null as any)).resolves.toEqual({ ok: true });

    expect(achievements.adminReject).toHaveBeenCalledWith(req, VALID_UUID, {});
  });

  it('delegates create with fallback empty body', async () => {
    const req: any = { auth: { userId: 'u-1' } };
    achievements.create.mockResolvedValueOnce({ id: VALID_UUID });

    await expect(controller.create(req, undefined as any)).resolves.toEqual({ id: VALID_UUID });

    expect(achievements.create).toHaveBeenCalledWith(req, {});
  });
});
