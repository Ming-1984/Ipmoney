import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AchievementsService } from '../src/modules/achievements/achievements.service';

const ACHIEVEMENT_ID = '11111111-1111-1111-1111-111111111111';
const USER_ID = 'user-1';

const USER_REQ = { auth: { userId: USER_ID } };
const ADMIN_REQ = { auth: { userId: 'admin-1', isAdmin: true } };

function buildAchievement(overrides: Record<string, unknown> = {}) {
  return {
    id: ACHIEVEMENT_ID,
    publisherUserId: USER_ID,
    source: 'USER',
    title: 'Achievement A',
    summary: 'summary',
    description: 'description',
    keywordsJson: ['AI'],
    maturity: 'PILOT',
    cooperationModesJson: ['COOP'],
    coverFileId: 'cover-file-1',
    regionCode: '440300',
    industryTagsJson: ['AI', 'smoke-tag-temp'],
    auditStatus: 'PENDING',
    status: 'DRAFT',
    createdAt: new Date('2026-03-13T00:00:00.000Z'),
    updatedAt: new Date('2026-03-13T01:00:00.000Z'),
    coverFile: { url: 'https://example.com/cover.png' },
    media: [
      {
        fileId: 'media-1',
        type: 'IMAGE',
        sort: 0,
        file: { url: 'https://example.com/media-1.png', mimeType: 'image/png', sizeBytes: 123, fileName: '1.png' },
      },
    ],
    stats: { viewCount: 1, favoriteCount: 2, consultCount: 3, commentCount: 4 },
    ...overrides,
  };
}

describe('AchievementsService write flow suite', () => {
  let prisma: any;
  let audit: any;
  let notifications: any;
  let service: AchievementsService;

  beforeEach(() => {
    prisma = {
      $transaction: vi.fn(async (fn: any) => fn(prisma)),
      achievement: {
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      achievementMedia: {
        createMany: vi.fn(),
        deleteMany: vi.fn(),
      },
      user: {
        findMany: vi.fn().mockResolvedValue([
          { id: USER_ID, nickname: 'User One', regionCode: '440300', verifications: [] },
          { id: 'owner-2', nickname: 'Owner Two', regionCode: '110000', verifications: [] },
          { id: 'owner-3', nickname: 'Owner Three', regionCode: '310000', verifications: [] },
        ]),
      },
    };
    audit = { log: vi.fn().mockResolvedValue(undefined) };
    notifications = { create: vi.fn().mockResolvedValue(undefined) };
    const events = { recordView: vi.fn().mockResolvedValue(undefined) };
    const config = { getRecommendation: vi.fn().mockResolvedValue({ enabled: false }) };
    service = new AchievementsService(prisma, audit, notifications, events as any, config as any);
  });

  it('validates create payload strictly', async () => {
    await expect(service.create(USER_REQ, { title: '   ' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create(USER_REQ, { title: 'A', maturity: '' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create(USER_REQ, { title: 'A', maturity: 'bad' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create(USER_REQ, { title: 'A', regionCode: '   ' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create(USER_REQ, { title: 'A', coverFileId: '' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('create normalizes payload and writes media rows', async () => {
    prisma.achievement.create.mockResolvedValueOnce({ id: ACHIEVEMENT_ID });
    prisma.achievement.findUnique.mockResolvedValueOnce(buildAchievement({ title: 'Achievement Create', maturity: 'PILOT' }));

    const result = await service.create(USER_REQ, {
      title: '  Achievement Create  ',
      summary: null,
      description: '  desc  ',
      keywords: [' AI ', '', 'ml'],
      cooperationModes: ' COOP_A , COOP_B ',
      maturity: 'pilot',
      coverFileId: ' cover-file-1 ',
      regionCode: '440300',
      industryTags: ['AI', 'smoke-tag-temp'],
      media: [
        { fileId: ' media-1 ', type: 'image', sort: 3 },
        { fileId: '', type: 'image', sort: 4 },
      ],
    });

    expect(prisma.achievement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          publisherUserId: USER_ID,
          source: 'USER',
          title: 'Achievement Create',
          description: 'desc',
          keywordsJson: ['AI', 'ml'],
          cooperationModesJson: ['COOP_A', 'COOP_B'],
          maturity: 'PILOT',
          coverFileId: 'cover-file-1',
          regionCode: '440300',
          industryTagsJson: ['AI'],
        }),
      }),
    );
    expect(prisma.achievementMedia.createMany).toHaveBeenCalledWith({
      data: [{ achievementId: ACHIEVEMENT_ID, fileId: 'media-1', type: 'IMAGE', sort: 3 }],
    });
    expect(result).toMatchObject({
      id: ACHIEVEMENT_ID,
      title: 'Achievement Create',
      maturity: 'PILOT',
      publisherUserId: USER_ID,
    });
  });

  it('update validates ownership and strict patch fields', async () => {
    prisma.achievement.findUnique.mockResolvedValueOnce(null);
    await expect(service.update(USER_REQ, ACHIEVEMENT_ID, {})).rejects.toBeInstanceOf(NotFoundException);

    prisma.achievement.findUnique.mockResolvedValueOnce(buildAchievement({ publisherUserId: 'other-user' }));
    await expect(service.update(USER_REQ, ACHIEVEMENT_ID, {})).rejects.toBeInstanceOf(NotFoundException);

    prisma.achievement.findUnique.mockResolvedValueOnce(buildAchievement());
    await expect(service.update(USER_REQ, ACHIEVEMENT_ID, { title: '   ' })).rejects.toBeInstanceOf(BadRequestException);

    prisma.achievement.findUnique.mockResolvedValueOnce(buildAchievement());
    await expect(service.update(USER_REQ, ACHIEVEMENT_ID, { coverFileId: '' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('update applies normalized patch and media replacement', async () => {
    prisma.achievement.findUnique.mockResolvedValueOnce(buildAchievement());
    prisma.achievement.update.mockResolvedValueOnce({ id: ACHIEVEMENT_ID });
    prisma.achievement.findUnique.mockResolvedValueOnce(
      buildAchievement({
        title: 'Achievement Updated',
        summary: null,
        description: 'new desc',
        maturity: 'COMMERCIALIZED',
        regionCode: null,
        status: 'ACTIVE',
      }),
    );

    const result = await service.update(USER_REQ, ACHIEVEMENT_ID, {
      title: '  Achievement Updated ',
      summary: null,
      description: ' new desc ',
      maturity: 'commercialized',
      regionCode: null,
      keywords: ['AI'],
      cooperationModes: 'COOP_X',
      industryTags: ['AI', 'smoke-tag-temp'],
      media: [{ fileId: ' media-2 ', type: 'image', sort: 1 }],
    });

    expect(prisma.achievement.update).toHaveBeenCalledWith({
      where: { id: ACHIEVEMENT_ID },
      data: expect.objectContaining({
        title: 'Achievement Updated',
        summary: null,
        description: 'new desc',
        maturity: 'COMMERCIALIZED',
        regionCode: null,
        keywordsJson: ['AI'],
        cooperationModesJson: ['COOP_X'],
        industryTagsJson: ['AI'],
      }),
    });
    expect(prisma.achievementMedia.deleteMany).toHaveBeenCalledWith({ where: { achievementId: ACHIEVEMENT_ID } });
    expect(prisma.achievementMedia.createMany).toHaveBeenCalledWith({
      data: [{ achievementId: ACHIEVEMENT_ID, fileId: 'media-2', type: 'IMAGE', sort: 1 }],
    });
    expect(result).toMatchObject({ id: ACHIEVEMENT_ID, title: 'Achievement Updated', maturity: 'COMMERCIALIZED' });
  });

  it('submit and offShelf enforce owner checks and apply transitions', async () => {
    prisma.achievement.findUnique.mockResolvedValueOnce(null);
    await expect(service.submit(USER_REQ, ACHIEVEMENT_ID)).rejects.toBeInstanceOf(NotFoundException);

    prisma.achievement.findUnique.mockResolvedValueOnce(buildAchievement({ publisherUserId: 'other-user' }));
    await expect(service.submit(USER_REQ, ACHIEVEMENT_ID)).rejects.toBeInstanceOf(NotFoundException);

    prisma.achievement.findUnique
      .mockResolvedValueOnce(buildAchievement({ publisherUserId: USER_ID }))
      .mockResolvedValueOnce(buildAchievement({ publisherUserId: USER_ID }));
    prisma.achievement.update
      .mockResolvedValueOnce(buildAchievement({ status: 'ACTIVE', auditStatus: 'PENDING' }))
      .mockResolvedValueOnce(buildAchievement({ status: 'OFF_SHELF' }));

    const submitted = await service.submit(USER_REQ, ACHIEVEMENT_ID);
    const offShelved = await service.offShelf(USER_REQ, ACHIEVEMENT_ID, {});

    expect(prisma.achievement.update).toHaveBeenNthCalledWith(1, {
      where: { id: ACHIEVEMENT_ID },
      data: { status: 'ACTIVE', auditStatus: 'PENDING' },
    });
    expect(prisma.achievement.update).toHaveBeenNthCalledWith(2, {
      where: { id: ACHIEVEMENT_ID },
      data: { status: 'OFF_SHELF' },
    });
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'ACHIEVEMENT_SUBMIT', targetId: ACHIEVEMENT_ID }));
    expect(submitted.status).toBe('ACTIVE');
    expect(offShelved.status).toBe('OFF_SHELF');
  });

  it('adminCreate and adminUpdate validate strict fields and normalize writes', async () => {
    await expect(service.adminCreate(ADMIN_REQ, { title: 'A', status: 'bad' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.adminCreate(ADMIN_REQ, { title: 'A', ownerId: '' })).rejects.toBeInstanceOf(BadRequestException);

    prisma.achievement.create.mockResolvedValueOnce({ id: ACHIEVEMENT_ID });
    prisma.achievement.findUnique.mockResolvedValueOnce(
      buildAchievement({ publisherUserId: 'owner-2', source: 'PLATFORM', auditStatus: 'APPROVED', status: 'ACTIVE' }),
    );
    const created = await service.adminCreate(ADMIN_REQ, {
      title: ' Admin Achievement ',
      source: 'platform',
      ownerId: ' owner-2 ',
      maturity: 'pilot',
      auditStatus: 'approved',
      status: 'active',
      media: [{ fileId: ' media-3 ', type: 'image', sort: 2 }],
    });

    expect(prisma.achievement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          publisherUserId: 'owner-2',
          source: 'PLATFORM',
          title: 'Admin Achievement',
          maturity: 'PILOT',
          auditStatus: 'APPROVED',
          status: 'ACTIVE',
        }),
      }),
    );
    expect(created.status).toBe('ACTIVE');

    prisma.achievement.findUnique.mockResolvedValueOnce(buildAchievement());
    prisma.achievement.update.mockResolvedValueOnce({ id: ACHIEVEMENT_ID });
    prisma.achievement.findUnique.mockResolvedValueOnce(
      buildAchievement({
        publisherUserId: 'owner-3',
        source: 'ADMIN',
        title: 'Admin Updated',
        maturity: 'PROTOTYPE',
        auditStatus: 'REJECTED',
        status: 'OFF_SHELF',
      }),
    );

    const updated = await service.adminUpdate(ADMIN_REQ, ACHIEVEMENT_ID, {
      publisherUserId: ' owner-3 ',
      source: 'admin',
      title: ' Admin Updated ',
      maturity: 'prototype',
      auditStatus: 'rejected',
      status: 'off_shelf',
      media: [],
    });

    expect(prisma.achievement.update).toHaveBeenCalledWith({
      where: { id: ACHIEVEMENT_ID },
      data: expect.objectContaining({
        publisherUserId: 'owner-3',
        source: 'ADMIN',
        title: 'Admin Updated',
        maturity: 'PROTOTYPE',
        auditStatus: 'REJECTED',
        status: 'OFF_SHELF',
      }),
    });
    expect(prisma.achievementMedia.deleteMany).toHaveBeenCalledWith({ where: { achievementId: ACHIEVEMENT_ID } });
    expect(updated).toMatchObject({ publisherUserId: 'owner-3', status: 'OFF_SHELF' });
  });

  it('admin publish/off-shelf/approve/reject cover missing and success branches', async () => {
    prisma.achievement.findUnique.mockResolvedValueOnce(null);
    await expect(service.adminPublish(ADMIN_REQ, ACHIEVEMENT_ID)).rejects.toBeInstanceOf(NotFoundException);

    prisma.achievement.findUnique
      .mockResolvedValueOnce(buildAchievement({ status: 'DRAFT' }))
      .mockResolvedValueOnce(buildAchievement({ status: 'ACTIVE' }))
      .mockResolvedValueOnce(buildAchievement({ status: 'DRAFT' }))
      .mockResolvedValueOnce(buildAchievement({ status: 'ACTIVE' }));
    prisma.achievement.update
      .mockResolvedValueOnce(buildAchievement({ status: 'ACTIVE', auditStatus: 'APPROVED' }))
      .mockResolvedValueOnce(buildAchievement({ status: 'OFF_SHELF' }))
      .mockResolvedValueOnce(buildAchievement({ status: 'ACTIVE', auditStatus: 'APPROVED', title: 'Achievement A' }))
      .mockResolvedValueOnce(buildAchievement({ status: 'ACTIVE', auditStatus: 'REJECTED', title: 'Achievement A' }));

    const published = await service.adminPublish(ADMIN_REQ, ACHIEVEMENT_ID);
    const offShelved = await service.adminOffShelf(ADMIN_REQ, ACHIEVEMENT_ID);
    const approved = await service.adminApprove(ADMIN_REQ, ACHIEVEMENT_ID);
    const rejected = await service.adminReject(ADMIN_REQ, ACHIEVEMENT_ID, { reason: 'need more details' });

    expect(published.status).toBe('ACTIVE');
    expect(offShelved.status).toBe('OFF_SHELF');
    expect(approved.auditStatus).toBe('APPROVED');
    expect(rejected.auditStatus).toBe('REJECTED');
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'ACHIEVEMENT_APPROVE', targetId: ACHIEVEMENT_ID }));
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'ACHIEVEMENT_REJECT', targetId: ACHIEVEMENT_ID }));
    expect(notifications.create).toHaveBeenCalledTimes(2);
  });
});
