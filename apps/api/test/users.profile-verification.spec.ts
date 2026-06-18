import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UsersService } from '../src/modules/users/users.service';

describe('UsersService profile and verification strictness suite', () => {
  let prisma: any;
  let audit: any;
  let notifications: any;
  let contentSecurity: any;
  let service: UsersService;

  beforeEach(() => {
    prisma = {
      user: {
        update: vi.fn(),
        findUnique: vi.fn(),
        upsert: vi.fn(),
      },
      userVerification: {
        findFirst: vi.fn(),
        create: vi.fn(),
      },
      techManagerProfile: {
        upsert: vi.fn(),
      },
    };
    audit = { log: vi.fn().mockResolvedValue(undefined) };
    notifications = { create: vi.fn().mockResolvedValue(undefined) };
    contentSecurity = {
      assertSafeText: vi.fn().mockResolvedValue(undefined),
      assertSafeTexts: vi.fn().mockResolvedValue(undefined),
      ensureReferencedFilesReady: vi.fn().mockResolvedValue(undefined),
    };
    service = new UsersService(prisma, audit, notifications, contentSecurity);
  });

  it('validates updateUserProfile patch fields strictly', async () => {
    await expect(service.updateUserProfile('u-1', { regionCode: '   ' } as any)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.updateUserProfile('u-1', { nickname: 'x'.repeat(51) } as any)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('maps missing user update to unauthorized', async () => {
    prisma.user.update.mockRejectedValueOnce({ code: 'P2025' });

    await expect(service.updateUserProfile('u-1', { nickname: 'alice' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('normalizes nullable avatar/region on profile update', async () => {
    prisma.user.update.mockResolvedValueOnce({});
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 'u-1',
      phone: '13800138000',
      nickname: 'Alice',
      avatarUrl: null,
      role: 'buyer',
      regionCode: null,
      createdAt: new Date('2026-03-13T00:00:00.000Z'),
      updatedAt: new Date('2026-03-13T01:00:00.000Z'),
    });
    prisma.userVerification.findFirst.mockResolvedValueOnce(null);

    const result = await service.updateUserProfile('u-1', { avatarUrl: '   ', regionCode: null } as any);

    expect(contentSecurity.assertSafeText).not.toHaveBeenCalled();
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u-1' },
      data: { nickname: undefined, avatarUrl: null, regionCode: null },
    });
    expect(result).toMatchObject({
      id: 'u-1',
      avatarUrl: undefined,
      verificationStatus: null,
      verificationType: null,
    });
  });

  it('validates submitMyVerification payload strictly', async () => {
    await expect(service.submitMyVerification('u-1', { type: '' as any, displayName: 'A' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      service.submitMyVerification('u-1', { type: 'BAD' as any, displayName: 'A' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.submitMyVerification('u-1', { type: 'PERSON', displayName: '   ' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.submitMyVerification('u-1', { type: 'COMPANY', displayName: 'Org' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.submitMyVerification('u-1', {
        type: 'COMPANY',
        displayName: 'Org',
        evidenceFileIds: ['file-1', '  '],
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.submitMyVerification('u-1', {
        type: 'PERSON',
        displayName: 'Alice',
        logoFileId: '   ',
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('blocks duplicate pending verification submissions', async () => {
    prisma.userVerification.findFirst.mockResolvedValueOnce({ id: 'pending-v-1' });

    await expect(
      service.submitMyVerification('u-1', { type: 'PERSON', displayName: 'Alice' } as any),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('auto-approves personal verification and writes audit log', async () => {
    prisma.userVerification.findFirst.mockResolvedValueOnce(null);
    prisma.userVerification.create.mockImplementationOnce(async ({ data }: any) => ({
      id: 'v-1',
      userId: data.userId,
      verificationType: data.verificationType,
      verificationStatus: data.verificationStatus,
      displayName: data.displayName,
      unifiedSocialCreditCodeEnc: data.unifiedSocialCreditCodeEnc,
      contactName: data.contactName,
      contactPhone: data.contactPhone,
      regionCode: data.regionCode,
      intro: data.intro,
      logoFileId: data.logoFileId,
      logoFile: null,
      evidenceFileIdsJson: data.evidenceFileIdsJson,
      submittedAt: data.submittedAt,
      reviewedAt: data.reviewedAt,
      reviewComment: data.reviewComment,
    }));

    const result = await service.submitMyVerification('u-1', {
      type: 'PERSON',
      displayName: '  Alice  ',
      evidenceFileIds: [],
      regionCode: null,
    } as any);

    expect(prisma.userVerification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'u-1',
          verificationType: 'PERSON',
          verificationStatus: 'APPROVED',
          displayName: 'Alice',
          evidenceFileIdsJson: [],
          submittedAt: expect.any(Date),
          reviewedAt: expect.any(Date),
          reviewComment: 'auto approved for personal verification',
        }),
      }),
    );
    expect(contentSecurity.assertSafeTexts).toHaveBeenCalled();
    expect(contentSecurity.ensureReferencedFilesReady).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u-1', fileIds: [], label: 'verification files' }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'u-1',
        action: 'VERIFICATION_SUBMIT',
        targetId: 'v-1',
      }),
    );
    expect(result).toMatchObject({
      id: 'v-1',
      userId: 'u-1',
      type: 'PERSON',
      status: 'APPROVED',
      displayName: 'Alice',
      evidenceFileIds: [],
    });
  });

  it('persists tech manager profile fields when submitting TECH_MANAGER verification', async () => {
    prisma.userVerification.findFirst.mockResolvedValueOnce(null);
    prisma.userVerification.create.mockImplementationOnce(async ({ data }: any) => ({
      id: 'v-tech-1',
      userId: data.userId,
      verificationType: data.verificationType,
      verificationStatus: data.verificationStatus,
      displayName: data.displayName,
      unifiedSocialCreditCodeEnc: data.unifiedSocialCreditCodeEnc,
      contactName: data.contactName,
      contactPhone: data.contactPhone,
      regionCode: data.regionCode,
      intro: data.intro,
      logoFileId: data.logoFileId,
      logoFile: null,
      evidenceFileIdsJson: data.evidenceFileIdsJson,
      submittedAt: data.submittedAt,
      reviewedAt: data.reviewedAt,
      reviewComment: data.reviewComment,
    }));
    prisma.techManagerProfile.upsert.mockResolvedValueOnce({ userId: 'u-1' });

    await service.submitMyVerification('u-1', {
      type: 'TECH_MANAGER',
      displayName: 'Tech A',
      contactPhone: '13800138000',
      intro: 'profile intro',
      evidenceFileIds: ['file-a'],
      serviceTags: ['专利布局', '成果转化'],
      position: '负责人',
      organization: '示例机构',
      serviceDirections: ['专利运营', '成果转化'],
      workHighlights: '服务过多个项目',
      experienceLabel: '10年从业经验',
      levelLabel: '资深顾问',
    } as any);

    expect(prisma.techManagerProfile.upsert).toHaveBeenCalledWith({
      where: { userId: 'u-1' },
      create: expect.objectContaining({
        userId: 'u-1',
        intro: 'profile intro',
        contactPhone: '13800138000',
        serviceTagsJson: ['专利布局', '成果转化'],
        position: '负责人',
        organization: '示例机构',
        serviceDirectionsJson: ['专利运营', '成果转化'],
        workHighlights: '服务过多个项目',
        experienceLabel: '10年从业经验',
        levelLabel: '资深顾问',
      }),
      update: expect.objectContaining({
        intro: 'profile intro',
        contactPhone: '13800138000',
        serviceTagsJson: ['专利布局', '成果转化'],
        position: '负责人',
        organization: '示例机构',
        serviceDirectionsJson: ['专利运营', '成果转化'],
        workHighlights: '服务过多个项目',
        experienceLabel: '10年从业经验',
        levelLabel: '资深顾问',
      }),
    });
  });
});
