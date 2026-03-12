import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UsersService } from '../src/modules/users/users.service';

describe('UsersService profile and verification strictness suite', () => {
  let prisma: any;
  let audit: any;
  let notifications: any;
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
    };
    audit = { log: vi.fn().mockResolvedValue(undefined) };
    notifications = { create: vi.fn().mockResolvedValue(undefined) };
    service = new UsersService(prisma, audit, notifications);
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

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u-1' },
      data: { nickname: undefined, avatarUrl: null, regionCode: null },
    });
    expect(result).toMatchObject({
      id: 'u-1',
      avatarUrl: undefined,
      verificationStatus: 'PENDING',
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
});
