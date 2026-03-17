import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UsersService } from '../src/modules/users/users.service';

function buildVerification(overrides: Record<string, unknown> = {}) {
  return {
    id: 'verify-1',
    userId: 'user-1',
    verificationType: 'COMPANY',
    verificationStatus: 'PENDING',
    displayName: 'Acme Corp',
    unifiedSocialCreditCodeEnc: '91310000ABCDEFGH1234',
    contactName: 'Alice',
    contactPhone: '13800138000',
    regionCode: '110000',
    intro: 'intro',
    logoFileId: 'file-logo-1',
    logoFile: { url: 'https://cdn/logo.png' },
    evidenceFileIdsJson: ['file-a', 1, 'file-b'],
    submittedAt: new Date('2026-03-14T00:00:00.000Z'),
    reviewedAt: null,
    reviewComment: null,
    ...overrides,
  };
}

describe('UsersService admin verification review suite', () => {
  let prisma: any;
  let audit: any;
  let notifications: any;
  let service: UsersService;

  beforeEach(() => {
    prisma = {
      userVerification: {
        count: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
      },
    };
    audit = { log: vi.fn().mockResolvedValue(undefined) };
    notifications = { create: vi.fn().mockResolvedValue(undefined) };
    service = new UsersService(prisma, audit, notifications);
  });

  it('validates admin list query strictly', async () => {
    await expect(service.adminListUserVerifications({ page: '0' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.adminListUserVerifications({ page: '9007199254740992' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.adminListUserVerifications({ pageSize: '1.2' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.adminListUserVerifications({ pageSize: '9007199254740992' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.adminListUserVerifications({ type: 'BAD' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.adminListUserVerifications({ status: 'BAD' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lists admin verifications with strict where-shape and dto masking', async () => {
    prisma.userVerification.count.mockResolvedValueOnce(1);
    prisma.userVerification.findMany.mockResolvedValueOnce([buildVerification()]);

    const result = await service.adminListUserVerifications({
      page: '2',
      pageSize: '100',
      type: 'company',
      status: 'pending',
      q: 'acme',
    });

    expect(prisma.userVerification.count).toHaveBeenCalledWith({
      where: {
        verificationType: 'COMPANY',
        verificationStatus: 'PENDING',
        OR: [{ displayName: { contains: 'acme' } }, { user: { phone: { contains: 'acme' } } }],
      },
    });
    expect(prisma.userVerification.findMany).toHaveBeenCalledWith({
      where: {
        verificationType: 'COMPANY',
        verificationStatus: 'PENDING',
        OR: [{ displayName: { contains: 'acme' } }, { user: { phone: { contains: 'acme' } } }],
      },
      include: { logoFile: true },
      orderBy: { submittedAt: 'desc' },
      skip: 50,
      take: 50,
    });
    expect(result.page).toEqual({ page: 2, pageSize: 50, total: 1 });
    expect(result.items[0]).toMatchObject({
      id: 'verify-1',
      type: 'COMPANY',
      status: 'PENDING',
      displayName: 'Acme Corp',
      contactPhoneMasked: '138****8000',
      evidenceFileIds: ['file-a', 'file-b'],
      logoUrl: 'https://cdn/logo.png',
    });
    expect(result.items[0].unifiedSocialCreditCodeMasked?.startsWith('91')).toBe(true);
    expect(result.items[0].unifiedSocialCreditCodeMasked?.endsWith('1234')).toBe(true);
  });

  it('maps approve not-found to 404', async () => {
    prisma.userVerification.update.mockRejectedValueOnce({ code: 'P2025' });
    await expect(service.adminApproveVerification('missing-id', 'ok', 'admin-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('approves verification and writes notification + audit', async () => {
    prisma.userVerification.update.mockResolvedValueOnce(
      buildVerification({
        verificationStatus: 'APPROVED',
        reviewedAt: new Date('2026-03-14T00:10:00.000Z'),
        reviewComment: 'ok',
      }),
    );

    const result = await service.adminApproveVerification('verify-1', 'ok', 'admin-1');

    expect(prisma.userVerification.update).toHaveBeenCalledWith({
      where: { id: 'verify-1' },
      data: expect.objectContaining({
        verificationStatus: 'APPROVED',
        reviewComment: 'ok',
        reviewedAt: expect.any(Date),
        reviewedById: 'admin-1',
      }),
      include: { logoFile: true },
    });
    expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-1' }));
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'admin-1',
        action: 'VERIFICATION_APPROVE',
        targetId: 'verify-1',
      }),
    );
    expect(result.status).toBe('APPROVED');
  });

  it('validates reject reason strictly', async () => {
    await expect(service.adminRejectVerification('verify-1', '   ', 'admin-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.adminRejectVerification('verify-1', 'x'.repeat(501), 'admin-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('maps reject not-found to 404', async () => {
    prisma.userVerification.update.mockRejectedValueOnce({ code: 'P2025' });
    await expect(service.adminRejectVerification('missing-id', 'bad', 'admin-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rejects verification and writes notification + audit', async () => {
    prisma.userVerification.update.mockResolvedValueOnce(
      buildVerification({
        verificationStatus: 'REJECTED',
        reviewedAt: new Date('2026-03-14T00:20:00.000Z'),
        reviewComment: 'material missing',
      }),
    );

    const result = await service.adminRejectVerification('verify-1', ' material missing ', 'admin-1');

    expect(prisma.userVerification.update).toHaveBeenCalledWith({
      where: { id: 'verify-1' },
      data: expect.objectContaining({
        verificationStatus: 'REJECTED',
        reviewComment: 'material missing',
        reviewedAt: expect.any(Date),
        reviewedById: 'admin-1',
      }),
      include: { logoFile: true },
    });
    expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-1' }));
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'admin-1',
        action: 'VERIFICATION_REJECT',
        targetId: 'verify-1',
      }),
    );
    expect(result.status).toBe('REJECTED');
    expect(result.reviewComment).toBe('material missing');
  });

  it('getUserIdFromReq enforces auth boundary', () => {
    expect(() => service.getUserIdFromReq({ auth: { userId: 'u-1' } })).not.toThrow();
    expect(() => service.getUserIdFromReq({})).toThrow(UnauthorizedException);
  });
});
