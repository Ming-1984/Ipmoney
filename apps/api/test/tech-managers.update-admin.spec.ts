import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TechManagersService } from '../src/modules/tech-managers/tech-managers.service';

const VALID_ID = '11111111-1111-1111-1111-111111111111';
const ADMIN_REQ = { auth: { isAdmin: true, userId: 'admin-1' } };

describe('TechManagersService update/public detail suite', () => {
  let prisma: any;
  let audit: any;
  let service: TechManagersService;

  beforeEach(() => {
    prisma = {
      userVerification: {
        findFirst: vi.fn(),
        update: vi.fn(),
      },
      techManagerProfile: {
        upsert: vi.fn(),
      },
    };
    audit = { log: vi.fn().mockResolvedValue(undefined) };
    service = new TechManagersService(prisma, audit);
  });

  it('validates auth and uuid for getPublic/updateAdmin', async () => {
    await expect(service.updateAdmin({}, VALID_ID, {})).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.getPublic('bad-id')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.updateAdmin(ADMIN_REQ, 'bad-id', {})).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns not found for missing tech manager in getPublic/updateAdmin', async () => {
    prisma.userVerification.findFirst.mockResolvedValue(null);

    await expect(service.getPublic(VALID_ID)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.updateAdmin(ADMIN_REQ, VALID_ID, {})).rejects.toBeInstanceOf(NotFoundException);
  });

  it('maps getPublic detail and sanitizes hidden service tags', async () => {
    prisma.userVerification.findFirst.mockResolvedValueOnce({
      id: 'verification-1',
      userId: VALID_ID,
      displayName: 'Tech Manager A',
      verificationType: 'TECH_MANAGER',
      verificationStatus: 'APPROVED',
      regionCode: '110000',
      intro: 'fallback intro',
      reviewedAt: new Date('2026-03-12T00:00:00.000Z'),
      evidenceFileIdsJson: ['file-1', 12, null, 'file-2'],
      user: {
        avatarUrl: 'https://example.com/avatar.png',
        techManagerProfile: {
          intro: 'profile intro',
          serviceTagsJson: ['Patent Drafting', 'smoke-service-tag-1', 'patent drafting', 'Licensing'],
          consultCount: 3,
          dealCount: 1,
          ratingScore: 4.8,
          ratingCount: 10,
        },
      },
    });

    const result = await service.getPublic(VALID_ID);

    expect(result).toMatchObject({
      userId: VALID_ID,
      displayName: 'Tech Manager A',
      intro: 'profile intro',
      serviceTags: ['Patent Drafting', 'Licensing'],
      evidenceFileIds: ['file-1', 'file-2'],
      verifiedAt: '2026-03-12T00:00:00.000Z',
      stats: {
        consultCount: 3,
        dealCount: 1,
        ratingScore: 4.8,
        ratingCount: 10,
      },
    });
  });

  it('validates updateAdmin payload fields strictly', async () => {
    prisma.userVerification.findFirst.mockResolvedValue({
      id: 'verification-1',
      userId: VALID_ID,
      verificationType: 'TECH_MANAGER',
      user: {},
    });

    await expect(service.updateAdmin(ADMIN_REQ, VALID_ID, { intro: 'x'.repeat(2001) })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.updateAdmin(ADMIN_REQ, VALID_ID, { serviceTags: 'not-array' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.updateAdmin(ADMIN_REQ, VALID_ID, { serviceTags: ['x'.repeat(51)] })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.updateAdmin(ADMIN_REQ, VALID_ID, { featuredRank: '' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.updateAdmin(ADMIN_REQ, VALID_ID, { featuredRank: 1.2 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.updateAdmin(ADMIN_REQ, VALID_ID, { featuredRank: '9007199254740992' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.updateAdmin(ADMIN_REQ, VALID_ID, { featuredRank: -1 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.updateAdmin(ADMIN_REQ, VALID_ID, { featuredUntil: '' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.updateAdmin(ADMIN_REQ, VALID_ID, { featuredUntil: 'not-a-date' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('updates intro/profile fields and writes audit log on success', async () => {
    prisma.userVerification.findFirst.mockResolvedValueOnce({
      id: 'verification-1',
      userId: VALID_ID,
      displayName: 'Tech Manager A',
      verificationType: 'TECH_MANAGER',
      verificationStatus: 'APPROVED',
      regionCode: '110000',
      intro: 'old intro',
      reviewedAt: new Date('2026-03-12T00:00:00.000Z'),
      user: { avatarUrl: 'https://example.com/avatar.png' },
    });
    prisma.userVerification.update.mockResolvedValueOnce({
      id: 'verification-1',
      userId: VALID_ID,
      displayName: 'Tech Manager A',
      verificationType: 'TECH_MANAGER',
      verificationStatus: 'APPROVED',
      regionCode: '110000',
      intro: 'New intro',
      reviewedAt: new Date('2026-03-12T00:00:00.000Z'),
      user: { avatarUrl: 'https://example.com/avatar.png' },
    });
    prisma.techManagerProfile.upsert.mockResolvedValueOnce({
      userId: VALID_ID,
      intro: 'New intro',
      serviceTagsJson: ['Patent Drafting', 'smoke-service-tag-1'],
      consultCount: 0,
      dealCount: 0,
      ratingScore: null,
      ratingCount: 0,
      featuredRank: 3,
      featuredUntil: null,
    });

    const result = await service.updateAdmin(ADMIN_REQ, VALID_ID, {
      intro: ' New intro ',
      serviceTags: ['Patent Drafting', 'smoke-service-tag-1'],
      featuredRank: '3',
      featuredUntil: null,
    });

    expect(prisma.userVerification.update).toHaveBeenCalledWith({
      where: { id: 'verification-1' },
      data: { intro: 'New intro' },
      include: { user: true },
    });
    expect(prisma.techManagerProfile.upsert).toHaveBeenCalledWith({
      where: { userId: VALID_ID },
      create: {
        userId: VALID_ID,
        intro: 'New intro',
        serviceTagsJson: ['Patent Drafting', 'smoke-service-tag-1'],
        featuredRank: 3,
        featuredUntil: null,
      },
      update: {
        intro: 'New intro',
        serviceTagsJson: ['Patent Drafting', 'smoke-service-tag-1'],
        featuredRank: 3,
        featuredUntil: null,
      },
    });
    expect(audit.log).toHaveBeenCalledWith({
      actorUserId: 'admin-1',
      action: 'TECH_MANAGER_UPDATE',
      targetType: 'TECH_MANAGER',
      targetId: 'verification-1',
      afterJson: {
        intro: 'New intro',
        serviceTagsJson: ['Patent Drafting', 'smoke-service-tag-1'],
        featuredRank: 3,
        featuredUntil: null,
      },
    });
    expect(result.serviceTags).toEqual(['Patent Drafting', 'smoke-service-tag-1']);
    expect(result.intro).toBe('New intro');
  });
});
