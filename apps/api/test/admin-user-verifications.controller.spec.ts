import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AdminUserVerificationsController } from '../src/modules/users/admin-user-verifications.controller';

const VERIFICATION_ID = '11111111-1111-4111-8111-111111111111';

describe('AdminUserVerificationsController strictness suite', () => {
  let users: any;
  let contentAudit: any;
  let controller: AdminUserVerificationsController;

  beforeEach(() => {
    users = {
      adminListUserVerifications: vi.fn(),
      adminApproveVerification: vi.fn(),
      adminRejectVerification: vi.fn(),
    };
    contentAudit = {
      listMaterials: vi.fn(),
      listLogs: vi.fn(),
    };
    controller = new AdminUserVerificationsController(users, contentAudit);
  });

  it('requires permissions on list/approve/reject/materials/auditLogs', async () => {
    const req = { auth: { userId: 'admin-1', permissions: new Set<string>() } };

    await expect(controller.list(req, {})).rejects.toBeInstanceOf(ForbiddenException);
    await expect(controller.approve(req, VERIFICATION_ID, {})).rejects.toBeInstanceOf(ForbiddenException);
    await expect(controller.reject(req, VERIFICATION_ID, { reason: 'x' })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(controller.materials(req, VERIFICATION_ID)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(controller.auditLogs(req, VERIFICATION_ID)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('validates verificationId format strictly', async () => {
    const reviewReq = { auth: { userId: 'admin-1', permissions: new Set(['verification.review']) } };
    const readReq = { auth: { userId: 'admin-1', permissions: new Set(['verification.read', 'auditLog.read']) } };

    await expect(controller.approve(reviewReq, 'bad-id', {})).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.reject(reviewReq, 'bad-id', { reason: 'x' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.materials(readReq, 'bad-id')).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.auditLogs(readReq, 'bad-id')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('forwards list query when permission is granted', async () => {
    const req = { auth: { userId: 'admin-1', permissions: new Set(['verification.read']) } };
    users.adminListUserVerifications.mockResolvedValueOnce({ items: [], page: { page: 1, pageSize: 10, total: 0 } });

    const result = await controller.list(req, { page: '2' });

    expect(users.adminListUserVerifications).toHaveBeenCalledWith({ page: '2' });
    expect(result.page).toEqual({ page: 1, pageSize: 10, total: 0 });
  });

  it('normalizes id and forwards approve/reject with reviewer id', async () => {
    const req = { auth: { userId: 'admin-1', permissions: new Set(['verification.review']) } };
    users.adminApproveVerification.mockResolvedValueOnce({ id: VERIFICATION_ID, status: 'APPROVED' });
    users.adminRejectVerification.mockResolvedValueOnce({ id: VERIFICATION_ID, status: 'REJECTED' });

    const approved = await controller.approve(req, ` ${VERIFICATION_ID} `, { comment: 'ok' });
    const rejected = await controller.reject(req, ` ${VERIFICATION_ID} `, { reason: 'missing file' });

    expect(users.adminApproveVerification).toHaveBeenCalledWith(VERIFICATION_ID, 'ok', 'admin-1');
    expect(users.adminRejectVerification).toHaveBeenCalledWith(VERIFICATION_ID, 'missing file', 'admin-1');
    expect(approved).toMatchObject({ id: VERIFICATION_ID, status: 'APPROVED' });
    expect(rejected).toMatchObject({ id: VERIFICATION_ID, status: 'REJECTED' });
  });

  it('forwards materials and audit logs lookup with normalized id', async () => {
    const req = { auth: { userId: 'admin-1', permissions: new Set(['verification.read', 'auditLog.read']) } };
    contentAudit.listMaterials.mockResolvedValueOnce([{ id: 'm-1' }]);
    contentAudit.listLogs.mockResolvedValueOnce([{ id: 'l-1' }]);

    const materials = await controller.materials(req, ` ${VERIFICATION_ID} `);
    const logs = await controller.auditLogs(req, ` ${VERIFICATION_ID} `);

    expect(contentAudit.listMaterials).toHaveBeenCalledWith('VERIFICATION', VERIFICATION_ID);
    expect(contentAudit.listLogs).toHaveBeenCalledWith('VERIFICATION', VERIFICATION_ID);
    expect(materials).toEqual([{ id: 'm-1' }]);
    expect(logs).toEqual([{ id: 'l-1' }]);
  });
});
