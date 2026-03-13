import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { UsersService } from '../src/modules/users/users.service';

const DEMO_ENV_KEYS = [
  'DEMO_AUTH_ENABLED',
  'DEMO_ADMIN_TOKEN',
  'DEMO_USER_TOKEN',
  'DEMO_ADMIN_ID',
  'DEMO_USER_ID',
  'DEMO_USER_PHONE',
  'DEMO_USER_NICKNAME',
  'DEMO_USER_REGION_CODE',
] as const;

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

describe('UsersService profile readback suite', () => {
  let prisma: any;
  let audit: any;
  let notifications: any;
  let service: UsersService;
  let originalEnv: Record<string, string | undefined>;

  beforeEach(() => {
    originalEnv = Object.fromEntries(DEMO_ENV_KEYS.map((key) => [key, process.env[key]]));
    prisma = {
      user: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
      },
      userVerification: {
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    };
    audit = { log: vi.fn().mockResolvedValue(undefined) };
    notifications = { create: vi.fn().mockResolvedValue(undefined) };
    service = new UsersService(prisma, audit, notifications);
  });

  afterEach(() => {
    for (const key of DEMO_ENV_KEYS) {
      const prev = originalEnv[key];
      if (prev === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = prev;
      }
    }
  });

  it('returns user profile with latest verification fields', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 'user-1',
      phone: '13800138000',
      nickname: 'Alice',
      avatarUrl: 'https://cdn/avatar.png',
      role: 'buyer',
      regionCode: '110000',
      createdAt: new Date('2026-03-14T00:00:00.000Z'),
      updatedAt: new Date('2026-03-14T01:00:00.000Z'),
    });
    prisma.userVerification.findFirst.mockResolvedValueOnce({
      verificationStatus: 'APPROVED',
      verificationType: 'PERSON',
    });

    const result = await service.getUserProfileById('user-1');

    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'user-1' } });
    expect(result).toMatchObject({
      id: 'user-1',
      phone: '13800138000',
      nickname: 'Alice',
      avatarUrl: 'https://cdn/avatar.png',
      role: 'buyer',
      verificationStatus: 'APPROVED',
      verificationType: 'PERSON',
      regionCode: '110000',
      createdAt: '2026-03-14T00:00:00.000Z',
      updatedAt: '2026-03-14T01:00:00.000Z',
    });
  });

  it('throws unauthorized when user missing and demo auth disabled', async () => {
    process.env.DEMO_AUTH_ENABLED = 'false';
    prisma.user.findUnique.mockResolvedValueOnce(null);

    await expect(service.getUserProfileById('missing-user')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('falls back to demo user upsert when demo auth is enabled', async () => {
    process.env.DEMO_AUTH_ENABLED = 'true';
    process.env.DEMO_ADMIN_TOKEN = 'demo-admin-token';
    process.env.DEMO_USER_TOKEN = 'demo-user-token';
    process.env.DEMO_ADMIN_ID = 'demo-admin-1';
    process.env.DEMO_USER_ID = 'demo-user-1';
    process.env.DEMO_USER_PHONE = '13900001111';
    process.env.DEMO_USER_NICKNAME = 'DemoUser';
    process.env.DEMO_USER_REGION_CODE = '310000';

    prisma.user.findUnique.mockResolvedValueOnce(null);
    prisma.user.upsert.mockResolvedValueOnce({
      id: 'demo-user-1',
      phone: '13900001111',
      nickname: 'DemoUser',
      avatarUrl: null,
      role: 'buyer',
      regionCode: '310000',
      createdAt: new Date('2026-03-14T02:00:00.000Z'),
      updatedAt: new Date('2026-03-14T03:00:00.000Z'),
    });
    prisma.userVerification.findFirst.mockResolvedValueOnce(null);

    const result = await service.getUserProfileById('demo-user-1');

    expect(prisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'demo-user-1' },
        create: expect.objectContaining({ id: 'demo-user-1', role: 'buyer' }),
      }),
    );
    expect(result).toMatchObject({
      id: 'demo-user-1',
      phone: '13900001111',
      nickname: 'DemoUser',
      verificationStatus: 'PENDING',
      verificationType: null,
    });
  });

  it('throws not-found when my verification has not been submitted', async () => {
    prisma.userVerification.findFirst.mockResolvedValueOnce(null);

    await expect(service.getMyVerification('user-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns masked verification dto fields', async () => {
    prisma.userVerification.findFirst.mockResolvedValueOnce(buildVerification());

    const result = await service.getMyVerification('user-1');

    expect(result).toMatchObject({
      id: 'verify-1',
      userId: 'user-1',
      type: 'COMPANY',
      status: 'PENDING',
      displayName: 'Acme Corp',
      contactPhoneMasked: '138****8000',
      evidenceFileIds: ['file-a', 'file-b'],
      logoUrl: 'https://cdn/logo.png',
    });
    expect(result.unifiedSocialCreditCodeMasked?.startsWith('91')).toBe(true);
    expect(result.unifiedSocialCreditCodeMasked?.endsWith('1234')).toBe(true);
  });

  it('creates non-person verification in pending state', async () => {
    prisma.userVerification.findFirst.mockResolvedValueOnce(null);
    prisma.userVerification.create.mockImplementationOnce(async ({ data }: any) =>
      buildVerification({
        id: 'verify-2',
        userId: data.userId,
        verificationType: data.verificationType,
        verificationStatus: data.verificationStatus,
        displayName: data.displayName,
        evidenceFileIdsJson: data.evidenceFileIdsJson,
        reviewedAt: data.reviewedAt,
        reviewComment: data.reviewComment,
        submittedAt: data.submittedAt,
      }),
    );

    const result = await service.submitMyVerification('user-1', {
      type: 'COMPANY',
      displayName: '  Acme Corp  ',
      evidenceFileIds: ['file-a'],
      unifiedSocialCreditCode: '91310000ABCDEFGH1234',
      logoFileId: 'file-logo-1',
    } as any);

    expect(prisma.userVerification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          verificationType: 'COMPANY',
          verificationStatus: 'PENDING',
          displayName: 'Acme Corp',
          evidenceFileIdsJson: ['file-a'],
          reviewedAt: null,
          reviewComment: null,
        }),
      }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'VERIFICATION_SUBMIT',
        targetId: 'verify-2',
      }),
    );
    expect(result).toMatchObject({
      id: 'verify-2',
      status: 'PENDING',
      displayName: 'Acme Corp',
      evidenceFileIds: ['file-a'],
    });
  });

  it('truncates approve comment to 500 chars and falls back actor user id', async () => {
    prisma.userVerification.update.mockResolvedValueOnce(
      buildVerification({
        verificationStatus: 'APPROVED',
        reviewedAt: new Date('2026-03-14T00:10:00.000Z'),
      }),
    );

    await service.adminApproveVerification('verify-1', 'x'.repeat(600), '');

    expect(prisma.userVerification.update).toHaveBeenCalledWith({
      where: { id: 'verify-1' },
      data: expect.objectContaining({
        verificationStatus: 'APPROVED',
        reviewComment: 'x'.repeat(500),
        reviewedAt: expect.any(Date),
      }),
      include: { logoFile: true },
    });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'user-1',
        action: 'VERIFICATION_APPROVE',
      }),
    );
  });
});
