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
      user: {
        update: vi.fn(),
      },
      userVerification: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
      },
      techManagerProfile: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
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

  it('maps getPublic detail, sanitizes hidden service tags, and does not expose admin-only fields', async () => {
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
      contactName: 'review-contact',
      contactPhone: '13900000000',
      user: {
        avatarUrl: 'https://example.com/avatar.png',
        techManagerProfile: {
          intro: 'profile intro',
          serviceTagsJson: ['Patent Drafting', 'smoke-service-tag-1', 'patent drafting', 'Licensing'],
          experienceLabel: '10 years',
          levelLabel: 'Senior',
          contactName: 'profile-contact',
          contactPhone: '13800000000',
          featuredRank: 2,
          featuredUntil: new Date('2026-12-31T00:00:00.000Z'),
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
      experienceLabel: '10 years',
      levelLabel: 'Senior',
      verifiedAt: '2026-03-12T00:00:00.000Z',
      stats: {
        consultCount: 3,
        dealCount: 1,
        ratingScore: 4.8,
        ratingCount: 10,
      },
    });
    expect(result).not.toHaveProperty('contactName');
    expect(result).not.toHaveProperty('contactPhone');
    expect(result).not.toHaveProperty('evidenceFileIds');
    expect(result).not.toHaveProperty('featuredRank');
    expect(result).not.toHaveProperty('featuredUntil');
    expect(result).not.toHaveProperty('verificationType');
    expect(result).not.toHaveProperty('verificationStatus');
  });

  it('uses profile intro first, then verification intro, and falls back to workHighlights when intro is absent', async () => {
    prisma.userVerification.findFirst.mockResolvedValueOnce({
      id: 'verification-1',
      userId: VALID_ID,
      displayName: 'Tech Manager A',
      verificationType: 'TECH_MANAGER',
      verificationStatus: 'APPROVED',
      regionCode: '110000',
      intro: 'verification intro',
      reviewedAt: new Date('2026-03-12T00:00:00.000Z'),
      evidenceFileIdsJson: [],
      user: {
        avatarUrl: 'https://example.com/avatar.png',
        techManagerProfile: {
          intro: '   ',
          workHighlights: 'profile highlights',
          serviceTagsJson: ['Patent Drafting'],
          consultCount: 3,
          dealCount: 1,
          ratingScore: 4.8,
          ratingCount: 0,
        },
      },
    });

    const result = await service.getPublic(VALID_ID);

    expect(result.intro).toBe('verification intro');
    expect(result.stats?.ratingScore).toBe(0);
    expect(result.stats?.ratingCount).toBe(0);

    prisma.userVerification.findFirst.mockResolvedValueOnce({
      id: 'verification-1',
      userId: VALID_ID,
      displayName: 'Tech Manager A',
      verificationType: 'TECH_MANAGER',
      verificationStatus: 'APPROVED',
      regionCode: '110000',
      intro: '   ',
      reviewedAt: new Date('2026-03-12T00:00:00.000Z'),
      evidenceFileIdsJson: [],
      user: {
        avatarUrl: 'https://example.com/avatar.png',
        techManagerProfile: {
          intro: '   ',
          workHighlights: 'profile highlights',
          serviceTagsJson: ['Patent Drafting'],
          consultCount: 3,
          dealCount: 1,
          ratingScore: 0,
          ratingCount: 0,
        },
      },
    });

    const result2 = await service.getPublic(VALID_ID);
    expect(result2.intro).toBe('profile highlights');
  });

  it('replaces organization-like intro with workHighlights in public detail', async () => {
    prisma.userVerification.findFirst.mockResolvedValueOnce({
      id: 'verification-1',
      userId: VALID_ID,
      displayName: 'Tech Manager A',
      verificationType: 'TECH_MANAGER',
      verificationStatus: 'APPROVED',
      regionCode: '110000',
      intro: 'Example organization',
      reviewedAt: new Date('2026-03-12T00:00:00.000Z'),
      evidenceFileIdsJson: [],
      user: {
        avatarUrl: 'https://example.com/avatar.png',
        techManagerProfile: {
          intro: 'Example organization',
          organization: 'Example organization',
          workHighlights: '从事技术转移转化服务15年，累计服务企业超500家。',
          serviceTagsJson: ['Patent Drafting'],
          consultCount: 3,
          dealCount: 1,
          ratingScore: 0,
          ratingCount: 0,
        },
      },
    });

    const result = await service.getPublic(VALID_ID);
    expect(result.intro).toContain('15');
    expect(result.experienceLabel).toBeTruthy();
    expect(result.experienceLabel).toContain('15');
  });

  it('falls back to workHighlights but keeps experience label empty when intro is organization-like', async () => {
    prisma.userVerification.findFirst.mockResolvedValueOnce({
      id: 'verification-1',
      userId: VALID_ID,
      displayName: 'Tech Manager A',
      verificationType: 'TECH_MANAGER',
      verificationStatus: 'APPROVED',
      regionCode: '110000',
      intro: 'Example organization',
      reviewedAt: new Date('2026-03-12T00:00:00.000Z'),
      evidenceFileIdsJson: [],
      user: {
        avatarUrl: 'https://example.com/avatar.png',
        techManagerProfile: {
          intro: 'Example organization',
          organization: 'Example organization',
          workHighlights: '从事技术转移转化服务15年，累计服务企业超500家。',
          serviceTagsJson: ['Patent Drafting'],
          consultCount: 3,
          dealCount: 1,
          ratingScore: 0,
          ratingCount: 0,
        },
      },
    });

    const result = await service.getPublic(VALID_ID);

    expect(result.intro).toContain('15');
    expect(result.experienceLabel).toBeTruthy();
    expect(result.experienceLabel).toContain('15');
  });

  it('treats placeholder values like 鏃?and - as missing in public output', async () => {
    prisma.userVerification.findFirst.mockResolvedValueOnce({
      id: 'verification-1',
      userId: VALID_ID,
      displayName: 'Tech Manager A',
      verificationType: 'TECH_MANAGER',
      verificationStatus: 'APPROVED',
      regionCode: '110000',
      intro: 'none',
      reviewedAt: new Date('2026-03-12T00:00:00.000Z'),
      evidenceFileIdsJson: [],
      user: {
        avatarUrl: 'https://example.com/avatar.png',
        techManagerProfile: {
          intro: 'none',
          position: '-',
          organization: '-',
          workHighlights: 'none',
          serviceTagsJson: ['Patent Drafting'],
          consultCount: 0,
          dealCount: 0,
          ratingScore: 0,
          ratingCount: 0,
        },
      },
    });

    const result = await service.getPublic(VALID_ID);

    expect(result.intro).toBeUndefined();
    expect(result.position).toBeUndefined();
    expect(result.organization).toBeUndefined();
    expect(result.workHighlights).toBeUndefined();
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
    await expect(service.updateAdmin(ADMIN_REQ, VALID_ID, { avatarUrl: 'x'.repeat(1001) })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.updateAdmin(ADMIN_REQ, VALID_ID, { ratingScore: '5.1' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.updateAdmin(ADMIN_REQ, VALID_ID, { ratingScore: '-0.1' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.updateAdmin(ADMIN_REQ, VALID_ID, { ratingCount: '-1' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.updateAdmin(ADMIN_REQ, VALID_ID, { ratingCount: '1.2' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.updateAdmin(ADMIN_REQ, VALID_ID, { ratingScore: 4.8, ratingCount: 0 })).rejects.toBeInstanceOf(
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
      serviceTagsJson: ['Patent Drafting'],
      experienceLabel: '10 years',
      levelLabel: 'Senior',
      consultCount: 0,
      dealCount: 0,
      ratingScore: null,
      ratingCount: 0,
      featuredRank: 3,
      featuredUntil: null,
    });
    prisma.techManagerProfile.findUnique.mockResolvedValueOnce({
      userId: VALID_ID,
      intro: 'New intro',
      serviceTagsJson: ['Patent Drafting'],
      experienceLabel: '10 years',
      levelLabel: 'Senior',
      consultCount: 0,
      dealCount: 0,
      ratingScore: 4.8,
      ratingCount: 17,
      featuredRank: 3,
      featuredUntil: null,
      badges: [],
    });

    const result = await service.updateAdmin(ADMIN_REQ, VALID_ID, {
      intro: ' New intro ',
      serviceTags: ['Patent Drafting', 'smoke-service-tag-1'],
      experienceLabel: '10 years',
      levelLabel: 'Senior',
      featuredRank: '3',
      featuredUntil: null,
      ratingScore: '4.8',
      ratingCount: '17',
    });

    expect(prisma.userVerification.update).toHaveBeenCalledWith({
      where: { id: 'verification-1' },
      data: { intro: 'New intro' },
    });
    expect(prisma.techManagerProfile.upsert).toHaveBeenCalledWith({
      where: { userId: VALID_ID },
      create: {
        userId: VALID_ID,
        intro: 'New intro',
        serviceTagsJson: ['Patent Drafting'],
        experienceLabel: '10 years',
        levelLabel: 'Senior',
        featuredRank: 3,
        featuredUntil: null,
        ratingScore: 4.8,
        ratingCount: 17,
      },
      update: {
        intro: 'New intro',
        serviceTagsJson: ['Patent Drafting'],
        experienceLabel: '10 years',
        levelLabel: 'Senior',
        featuredRank: 3,
        featuredUntil: null,
        ratingScore: 4.8,
        ratingCount: 17,
      },
    });
    expect(audit.log).toHaveBeenCalledWith({
      actorUserId: 'admin-1',
      action: 'TECH_MANAGER_UPDATE',
      targetType: 'TECH_MANAGER',
      targetId: 'verification-1',
      afterJson: {
        intro: 'New intro',
        serviceTagsJson: ['Patent Drafting'],
        experienceLabel: '10 years',
        levelLabel: 'Senior',
        featuredRank: 3,
        featuredUntil: null,
        ratingScore: 4.8,
        ratingCount: 17,
      },
    });
    expect(result.serviceTags).toEqual(['Patent Drafting']);
    expect(result.intro).toBe('New intro');
    expect(result.experienceLabel).toBe('10 years');
    expect(result.levelLabel).toBe('Senior');
  });

  it('updates avatarUrl on user profile and supports clearing', async () => {
    prisma.userVerification.findFirst.mockResolvedValue({
      id: 'verification-1',
      userId: VALID_ID,
      displayName: 'Tech Manager A',
      verificationType: 'TECH_MANAGER',
      verificationStatus: 'APPROVED',
      regionCode: '110000',
      intro: 'old intro',
      reviewedAt: new Date('2026-03-12T00:00:00.000Z'),
      user: { avatarUrl: 'https://example.com/old.png' },
    });
    prisma.techManagerProfile.upsert.mockResolvedValue({
      userId: VALID_ID,
      intro: 'old intro',
      serviceTagsJson: [],
      consultCount: 0,
      dealCount: 0,
      ratingScore: 0,
      ratingCount: 0,
      featuredRank: null,
      featuredUntil: null,
    });
    prisma.techManagerProfile.findUnique.mockResolvedValue({
      userId: VALID_ID,
      intro: 'old intro',
      serviceTagsJson: [],
      consultCount: 0,
      dealCount: 0,
      ratingScore: 0,
      ratingCount: 0,
      featuredRank: null,
      featuredUntil: null,
    });

    prisma.user.update.mockResolvedValueOnce({});
    const updated = await service.updateAdmin(ADMIN_REQ, VALID_ID, { avatarUrl: ' https://example.com/new.png ' });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: VALID_ID },
      data: { avatarUrl: 'https://example.com/new.png' },
    });
    expect(updated.avatarUrl).toBe('https://example.com/new.png');
    expect(audit.log).toHaveBeenLastCalledWith({
      actorUserId: 'admin-1',
      action: 'TECH_MANAGER_UPDATE',
      targetType: 'TECH_MANAGER',
      targetId: 'verification-1',
      afterJson: { avatarUrl: 'https://example.com/new.png' },
    });
    expect(prisma.techManagerProfile.upsert).not.toHaveBeenCalled();
    expect(prisma.techManagerProfile.findUnique).toHaveBeenCalledWith({
      where: { userId: VALID_ID },
      include: {
        badges: {
          where: { expiresAt: null },
          include: { badgeDefinition: true },
        },
      },
    });

    prisma.user.update.mockResolvedValueOnce({});
    const cleared = await service.updateAdmin(ADMIN_REQ, VALID_ID, { avatarUrl: '' });
    expect(prisma.user.update).toHaveBeenLastCalledWith({
      where: { id: VALID_ID },
      data: { avatarUrl: null },
    });
    expect(cleared.avatarUrl).toBeUndefined();
    expect(prisma.techManagerProfile.upsert).not.toHaveBeenCalled();
  });

  it('supports clearing featuredUntil while keeping featuredRank only in admin storage', async () => {
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
    prisma.techManagerProfile.upsert.mockResolvedValueOnce({
      userId: VALID_ID,
      intro: 'old intro',
      serviceTagsJson: [],
      consultCount: 0,
      dealCount: 0,
      ratingScore: 0,
      ratingCount: 0,
      featuredRank: 5,
      featuredUntil: null,
    });

    const result = await service.updateAdmin(ADMIN_REQ, VALID_ID, {
      featuredRank: 5,
      featuredUntil: null,
    });

    expect(prisma.techManagerProfile.upsert).toHaveBeenCalledWith({
      where: { userId: VALID_ID },
      create: expect.objectContaining({
        userId: VALID_ID,
        featuredRank: 5,
        featuredUntil: null,
      }),
      update: expect.objectContaining({
        featuredRank: 5,
        featuredUntil: null,
      }),
    });
    expect(result).not.toHaveProperty('featuredRank');
    expect(result.featuredUntil).toBeUndefined();
  });

  it('batch updates ratings for multiple tech managers with audit logs', async () => {
    const id2 = '22222222-2222-2222-2222-222222222222';
    prisma.userVerification.findMany.mockResolvedValueOnce([
      {
        id: 'verification-1',
        userId: VALID_ID,
        displayName: 'Tech Manager A',
        verificationType: 'TECH_MANAGER',
        verificationStatus: 'APPROVED',
        regionCode: '110000',
        intro: 'old intro',
        reviewedAt: new Date('2026-03-12T00:00:00.000Z'),
        user: { avatarUrl: 'https://example.com/a.png' },
      },
      {
        id: 'verification-2',
        userId: id2,
        displayName: 'Tech Manager B',
        verificationType: 'TECH_MANAGER',
        verificationStatus: 'APPROVED',
        regionCode: '110000',
        intro: 'old intro b',
        reviewedAt: new Date('2026-03-12T00:00:00.000Z'),
        user: { avatarUrl: 'https://example.com/b.png' },
      },
    ]);
    prisma.techManagerProfile.findMany.mockResolvedValueOnce([
      { userId: VALID_ID, ratingScore: 3.2, ratingCount: 4 },
      { userId: id2, ratingScore: 0, ratingCount: 0 },
    ]);
    prisma.techManagerProfile.upsert.mockResolvedValueOnce({
      userId: VALID_ID,
      ratingScore: 4.7,
      ratingCount: 22,
    });
    prisma.techManagerProfile.upsert.mockResolvedValueOnce({
      userId: id2,
      ratingScore: 4.7,
      ratingCount: 22,
    });

    const result = await service.batchUpdateRating(ADMIN_REQ, {
      techManagerIds: [VALID_ID, id2],
      ratingScore: '4.7',
      ratingCount: '22',
    });

    expect(prisma.userVerification.findMany).toHaveBeenCalledWith({
      where: {
        userId: { in: [VALID_ID, id2] },
        verificationType: 'TECH_MANAGER',
      },
      include: { user: true },
    });
    expect(prisma.techManagerProfile.upsert).toHaveBeenCalledTimes(2);
    expect(result.updatedCount).toBe(2);
    expect(result.ratingScore).toBe(4.7);
    expect(result.ratingCount).toBe(22);
    expect(audit.log).toHaveBeenCalledTimes(2);
    expect(audit.log).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        actorUserId: 'admin-1',
        action: 'TECH_MANAGER_BATCH_RATING_UPDATE',
        targetType: 'TECH_MANAGER',
      }),
    );
  });

  it('validates batch rating payload and rejects missing managers', async () => {
    await expect(
      service.batchUpdateRating(ADMIN_REQ, { techManagerIds: [], ratingScore: 4.6, ratingCount: 10 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.batchUpdateRating(ADMIN_REQ, { techManagerIds: [VALID_ID], ratingScore: 4.6, ratingCount: -1 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.batchUpdateRating(ADMIN_REQ, { techManagerIds: [VALID_ID], ratingScore: 4.6, ratingCount: 0 }),
    ).rejects.toBeInstanceOf(BadRequestException);

    prisma.userVerification.findMany.mockResolvedValueOnce([]);
    await expect(
      service.batchUpdateRating(ADMIN_REQ, { techManagerIds: [VALID_ID], ratingScore: 4.6, ratingCount: 12 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('does not derive public experience label from work highlights when the formal field is missing', async () => {
    prisma.userVerification.findFirst.mockResolvedValueOnce({
      id: 'verification-1',
      userId: VALID_ID,
      displayName: 'Tech Manager A',
      verificationType: 'TECH_MANAGER',
      verificationStatus: 'APPROVED',
      regionCode: '110000',
      intro: '示例机构',
      reviewedAt: new Date('2026-03-12T00:00:00.000Z'),
      evidenceFileIdsJson: [],
      user: {
        avatarUrl: 'https://example.com/avatar.png',
        techManagerProfile: {
          intro: '示例机构',
          organization: '示例机构',
          workHighlights: '从事技术转移转化服务5年，累计服务企业超100家。',
          serviceTagsJson: ['Patent Drafting'],
          consultCount: 3,
          dealCount: 1,
          ratingScore: 0,
          ratingCount: 0,
        },
      },
    });

    const result = await service.getPublic(VALID_ID);

    expect(result.intro).toContain('5');
    expect(result.experienceLabel).toBeTruthy();
    expect(result.experienceLabel).toContain('5');
  });
});
