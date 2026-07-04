import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AchievementsService } from '../src/modules/achievements/achievements.service';

const ADMIN_REQ = { auth: { isAdmin: true, userId: 'admin-1' } };
const ACHIEVEMENT_ID = '11111111-1111-1111-1111-111111111111';
const PUBLISHER_ID = '22222222-2222-2222-2222-222222222222';
const COVER_ID = '33333333-3333-3333-3333-333333333333';

describe('AchievementsService admin update suite', () => {
  let prisma: any;
  let service: AchievementsService;

  beforeEach(() => {
    prisma = {
      achievement: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        update: vi.fn(),
      },
      achievementMedia: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        createMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      file: {
        findMany: vi.fn().mockResolvedValue([]),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      user: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: PUBLISHER_ID,
            nickname: 'Publisher A',
            regionCode: '440600',
            verifications: [],
          },
        ]),
      },
    };
    const audit = { log: vi.fn().mockResolvedValue(undefined) };
    const events = { recordView: vi.fn().mockResolvedValue(undefined) };
    const contentSecurity = {
      assertSafeTexts: vi.fn().mockResolvedValue(undefined),
      ensureReferencedFilesReady: vi.fn().mockResolvedValue(undefined),
    };
    service = new AchievementsService(prisma, audit as any, events as any, contentSecurity as any);
  });

  it('adminUpdate allows clearing nullable fields and source metadata', async () => {
    prisma.achievement.findUnique
      .mockResolvedValueOnce({
        id: ACHIEVEMENT_ID,
        publisherUserId: PUBLISHER_ID,
        title: 'Old title',
        summary: 'Old summary',
        description: 'Old description',
        maturity: 'PILOT',
        regionCode: '440600',
        coverFileId: COVER_ID,
        industryTagsJson: ['Tag A'],
        keywordsJson: ['alpha'],
        cooperationModesJson: ['Mode A'],
        source: 'ADMIN',
        auditStatus: 'APPROVED',
        status: 'ACTIVE',
        externalId: 'ext-1',
        sourceRawCategory: 'category-a',
        sourceRawStatus: 'status-a',
        sourceBatch: 'batch-a',
        sourceRawRegion: 'region-a',
        sourceOrgName: 'org-a',
      })
      .mockResolvedValueOnce({
        id: ACHIEVEMENT_ID,
        publisherUserId: PUBLISHER_ID,
        title: 'New title',
        summary: null,
        description: null,
        maturity: null,
        regionCode: null,
        coverFileId: null,
        industryTagsJson: null,
        keywordsJson: null,
        cooperationModesJson: null,
        source: 'ADMIN',
        auditStatus: 'APPROVED',
        status: 'ACTIVE',
        externalId: null,
        sourceRawCategory: null,
        sourceRawStatus: null,
        sourceBatch: null,
        sourceRawRegion: null,
        sourceOrgName: null,
        stats: null,
        coverFile: null,
        media: [],
        createdAt: new Date('2026-06-15T00:00:00.000Z'),
      });
    prisma.achievement.update.mockResolvedValueOnce({
      id: ACHIEVEMENT_ID,
      publisherUserId: PUBLISHER_ID,
    });

    const result = await service.adminUpdate(ADMIN_REQ, ACHIEVEMENT_ID, {
      title: ' New title ',
      summary: '',
      description: '',
      maturity: null,
      regionCode: '',
      coverFileId: null,
      industryTags: [],
      keywords: [],
      cooperationModes: [],
      externalId: '',
      sourceRawCategory: '',
      sourceRawStatus: '',
      sourceBatch: '',
      sourceRawRegion: '',
      sourceOrgName: '',
    });

    expect(prisma.achievement.update).toHaveBeenCalledWith({
      where: { id: ACHIEVEMENT_ID },
      data: expect.objectContaining({
        title: 'New title',
        summary: null,
        description: null,
        maturity: null,
        regionCode: null,
        coverFileId: null,
        externalId: null,
        sourceRawCategory: null,
        sourceRawStatus: null,
        sourceBatch: null,
        sourceRawRegion: null,
        sourceOrgName: null,
      }),
    });
    expect(result.coverFileId).toBeNull();
    expect(result.regionCode).toBeNull();
    expect(result.maturity).toBeNull();
    expect(result.summary).toBeNull();
  });

  it('does not fabricate publisher displayName when publisher has no verification name', async () => {
    prisma.achievement.findUnique.mockResolvedValueOnce({
      id: ACHIEVEMENT_ID,
      publisherUserId: PUBLISHER_ID,
      title: 'Achievement A',
      summary: null,
      description: null,
      maturity: null,
      regionCode: null,
      coverFileId: null,
      industryTagsJson: null,
      keywordsJson: null,
      cooperationModesJson: null,
      source: 'ADMIN',
      auditStatus: 'APPROVED',
      status: 'ACTIVE',
      externalId: null,
      sourceRawCategory: null,
      sourceRawStatus: null,
      sourceBatch: null,
      sourceRawRegion: null,
      sourceOrgName: null,
      stats: null,
      coverFile: null,
      media: [],
      createdAt: new Date('2026-06-15T00:00:00.000Z'),
    });
    prisma.user.findMany.mockResolvedValueOnce([
      {
        id: PUBLISHER_ID,
        nickname: 'Publisher A',
        regionCode: '440600',
        verifications: [],
      },
    ]);

    const result = await service.getAdminById(ACHIEVEMENT_ID);
    expect(result.publisher?.displayName).toBe('');
    expect(result.publisher?.verificationType).toBeNull();
    expect(result.publisher?.verificationStatus).toBeNull();
  });

  it('uses sourceOrgName as public-facing publisher fallback when verification displayName is absent', async () => {
    prisma.achievement.findFirst.mockResolvedValueOnce({
      id: ACHIEVEMENT_ID,
      publisherUserId: PUBLISHER_ID,
      title: 'Achievement A',
      summary: null,
      description: null,
      maturity: null,
      regionCode: null,
      coverFileId: null,
      industryTagsJson: null,
      keywordsJson: null,
      cooperationModesJson: null,
      source: 'PLATFORM',
      auditStatus: 'APPROVED',
      status: 'ACTIVE',
      externalId: 'ext-1',
      sourceRawCategory: null,
      sourceRawStatus: null,
      sourceBatch: null,
      sourceRawRegion: null,
      sourceOrgName: '天津工业生物技术研究所',
      stats: null,
      coverFile: null,
      media: [],
      createdAt: new Date('2026-06-15T00:00:00.000Z'),
    });
    prisma.user.findMany.mockResolvedValueOnce([
      {
        id: PUBLISHER_ID,
        nickname: 'Publisher A',
        regionCode: '440600',
        verifications: [],
      },
    ]);

    const result = await service.getPublicById({}, ACHIEVEMENT_ID);
    expect(result.publisher?.displayName).toBe('天津工业生物技术研究所');
    expect(result.publisher?.verificationType).toBeNull();
    expect(result.publisher?.verificationStatus).toBeNull();
  });

  it('uses sourceOrgName fallback when verification displayName is a corrupted placeholder', async () => {
    prisma.achievement.findFirst.mockResolvedValueOnce({
      id: ACHIEVEMENT_ID,
      publisherUserId: PUBLISHER_ID,
      title: 'Achievement A',
      summary: null,
      description: null,
      maturity: null,
      regionCode: null,
      coverFileId: null,
      industryTagsJson: null,
      keywordsJson: null,
      cooperationModesJson: null,
      source: 'PLATFORM',
      auditStatus: 'APPROVED',
      status: 'ACTIVE',
      externalId: 'ext-1',
      sourceRawCategory: null,
      sourceRawStatus: null,
      sourceBatch: null,
      sourceRawRegion: null,
      sourceOrgName: 'Source Org Good',
      stats: null,
      coverFile: null,
      media: [],
      createdAt: new Date('2026-06-15T00:00:00.000Z'),
    });
    prisma.user.findMany.mockResolvedValueOnce([
      {
        id: PUBLISHER_ID,
        nickname: 'Publisher A',
        regionCode: '440600',
        verifications: [
          {
            displayName: '???????????',
            verificationType: 'COMPANY',
            verificationStatus: 'APPROVED',
            regionCode: null,
            logoFile: null,
            intro: null,
            reviewedAt: null,
          },
        ],
      },
    ]);

    const result = await service.getPublicById({}, ACHIEVEMENT_ID);
    expect(result.publisher?.displayName).toBe('Source Org Good');
    expect(result.publisher?.verificationType).toBe('COMPANY');
    expect(result.publisher?.verificationStatus).toBe('APPROVED');
  });

  it('does not expose placeholder sourceOrgName as publisher fallback', async () => {
    prisma.achievement.findFirst.mockResolvedValueOnce({
      id: ACHIEVEMENT_ID,
      publisherUserId: PUBLISHER_ID,
      title: 'Achievement A',
      summary: null,
      description: null,
      maturity: null,
      regionCode: null,
      coverFileId: null,
      industryTagsJson: null,
      keywordsJson: null,
      cooperationModesJson: null,
      source: 'PLATFORM',
      auditStatus: 'APPROVED',
      status: 'ACTIVE',
      externalId: 'ext-1',
      sourceRawCategory: null,
      sourceRawStatus: null,
      sourceBatch: null,
      sourceRawRegion: null,
      sourceOrgName: '-',
      stats: null,
      coverFile: null,
      media: [],
      createdAt: new Date('2026-06-15T00:00:00.000Z'),
    });
    prisma.user.findMany.mockResolvedValueOnce([
      {
        id: PUBLISHER_ID,
        nickname: 'Publisher A',
        regionCode: '440600',
        verifications: [],
      },
    ]);

    const result = await service.getPublicById({}, ACHIEVEMENT_ID);
    expect(result.publisher?.displayName).toBe('');
    expect(result.sourceOrgName).toBeNull();
  });

  it('getPublicById hides non-public achievements', async () => {
    prisma.achievement.findFirst = vi.fn().mockResolvedValueOnce(null);

    await expect(service.getPublicById({}, ACHIEVEMENT_ID)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.achievement.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: ACHIEVEMENT_ID,
          auditStatus: 'APPROVED',
          status: 'ACTIVE',
        }),
      }),
    );
  });

  it('createConsultation hides non-public achievements', async () => {
    prisma.achievement.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.createConsultation({ auth: { userId: 'user-1' } }, ACHIEVEMENT_ID, { channel: 'FORM' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.achievement.findFirst).toHaveBeenCalledWith({
      where: {
        id: ACHIEVEMENT_ID,
        auditStatus: 'APPROVED',
        status: 'ACTIVE',
      },
    });
  });

  it('blocks approval while referenced media moderation is not approved', async () => {
    prisma.achievement.findUnique.mockResolvedValueOnce({
      id: ACHIEVEMENT_ID,
      coverFileId: COVER_ID,
      media: [{ fileId: '44444444-4444-4444-8444-444444444444' }],
    });
    prisma.file.findMany.mockResolvedValueOnce([
      { id: COVER_ID, moderationStatus: 'APPROVED' },
      { id: '44444444-4444-4444-8444-444444444444', moderationStatus: 'PENDING' },
    ]);

    prisma.file.updateMany.mockResolvedValueOnce({ count: 1 });
    prisma.file.findMany.mockResolvedValueOnce([
      { id: COVER_ID, moderationStatus: 'APPROVED' },
      { id: '44444444-4444-4444-8444-444444444444', moderationStatus: 'APPROVED' },
    ]);
    prisma.achievement.update.mockResolvedValueOnce({
      id: ACHIEVEMENT_ID,
      auditStatus: 'APPROVED',
    });

    const result = await service.approve(ACHIEVEMENT_ID, 'admin-1', 'ok');
    expect(prisma.file.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['44444444-4444-4444-8444-444444444444'] } },
        data: expect.objectContaining({ moderationStatus: 'APPROVED', moderationProvider: 'ADMIN' }),
      }),
    );
    expect(result).toMatchObject({ id: ACHIEVEMENT_ID, auditStatus: 'APPROVED' });
  });

  it('approves achievement when referenced media is approved or not required', async () => {
    prisma.achievement.findUnique.mockResolvedValueOnce({
      id: ACHIEVEMENT_ID,
      coverFileId: COVER_ID,
      media: [],
    });
    prisma.file.findMany.mockResolvedValueOnce([{ id: COVER_ID, moderationStatus: 'APPROVED' }]);
    prisma.achievement.update.mockResolvedValueOnce({
      id: ACHIEVEMENT_ID,
      auditStatus: 'APPROVED',
    });

    const result = await service.approve(ACHIEVEMENT_ID, 'admin-1', 'ok');

    expect(prisma.achievement.update).toHaveBeenCalledWith({
      where: { id: ACHIEVEMENT_ID },
      data: { auditStatus: 'APPROVED' },
    });
    expect(result).toMatchObject({ id: ACHIEVEMENT_ID, auditStatus: 'APPROVED' });
  });

  it('getAdminMaterials returns cover and media moderation details', async () => {
    prisma.achievement.findUnique.mockResolvedValueOnce({
      id: ACHIEVEMENT_ID,
      coverFileId: COVER_ID,
      media: [{ fileId: '44444444-4444-4444-8444-444444444444' }],
    });
    prisma.file.findMany.mockResolvedValueOnce([
      {
        id: COVER_ID,
        fileName: 'cover.png',
        mimeType: 'image/png',
        moderationStatus: 'APPROVED',
        moderationLabel: 'manual_review',
        moderationReason: 'ok',
        createdAt: new Date('2026-06-15T00:00:00.000Z'),
      },
      {
        id: '44444444-4444-4444-8444-444444444444',
        fileName: 'media.pdf',
        mimeType: 'application/pdf',
        moderationStatus: 'PENDING',
        moderationLabel: null,
        moderationReason: null,
        createdAt: new Date('2026-06-16T00:00:00.000Z'),
      },
    ]);

    const result = await service.getAdminMaterials(ACHIEVEMENT_ID);
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({ id: COVER_ID, moderationStatus: 'APPROVED' });
    expect(result.items[1]).toMatchObject({ id: '44444444-4444-4444-8444-444444444444', moderationStatus: 'PENDING' });
  });

  it('listAdmin prioritizes strong title and publisher matches before weaker summary matches', async () => {
    prisma.achievement.findMany.mockResolvedValueOnce([
      {
        id: 'a-1',
        publisherUserId: 'publisher-1',
        title: '华南技术转移平台',
        summary: '面向高校成果转化',
        sourceOrgName: null,
        source: 'ADMIN',
        auditStatus: 'APPROVED',
        status: 'ACTIVE',
        externalId: null,
        sourceRawCategory: null,
        sourceRawStatus: null,
        sourceBatch: null,
        sourceRawRegion: null,
        maturity: null,
        regionCode: '440100',
        keywordsJson: ['技术转移'],
        cooperationModesJson: [],
        industryTagsJson: [],
        stats: null,
        coverFile: null,
        createdAt: new Date('2026-06-10T00:00:00.000Z'),
      },
      {
        id: 'a-2',
        publisherUserId: 'publisher-2',
        title: '成果路演专场',
        summary: '服务华南地区高校院所',
        sourceOrgName: null,
        source: 'ADMIN',
        auditStatus: 'APPROVED',
        status: 'ACTIVE',
        externalId: null,
        sourceRawCategory: null,
        sourceRawStatus: null,
        sourceBatch: null,
        sourceRawRegion: null,
        maturity: null,
        regionCode: '440300',
        keywordsJson: [],
        cooperationModesJson: [],
        industryTagsJson: [],
        stats: null,
        coverFile: null,
        createdAt: new Date('2026-06-12T00:00:00.000Z'),
      },
      {
        id: 'a-3',
        publisherUserId: 'publisher-3',
        title: '平台精选成果',
        summary: '聚焦机器人产业化',
        sourceOrgName: '华南科技成果中心',
        source: 'PLATFORM',
        auditStatus: 'APPROVED',
        status: 'ACTIVE',
        externalId: null,
        sourceRawCategory: null,
        sourceRawStatus: null,
        sourceBatch: null,
        sourceRawRegion: null,
        maturity: null,
        regionCode: '440600',
        keywordsJson: [],
        cooperationModesJson: [],
        industryTagsJson: [],
        stats: null,
        coverFile: null,
        createdAt: new Date('2026-06-11T00:00:00.000Z'),
      },
    ]);
    prisma.user.findMany.mockResolvedValueOnce([
      { id: 'publisher-1', nickname: 'P1', regionCode: '440100', verifications: [] },
      {
        id: 'publisher-2',
        nickname: 'P2',
        regionCode: '440300',
        verifications: [
          {
            verificationStatus: 'APPROVED',
            verificationType: 'COMPANY',
            displayName: '华南成果服务公司',
            reviewedAt: new Date('2026-06-01T00:00:00.000Z'),
            logoUrl: null,
            intro: null,
          },
        ],
      },
      { id: 'publisher-3', nickname: 'P3', regionCode: '440600', verifications: [] },
    ]);

    const result = await service.listAdmin({ q: '华南', page: '1', pageSize: '20' });

    expect(prisma.achievement.findMany).toHaveBeenCalledWith({
      where: {},
      include: { stats: true, coverFile: true },
      orderBy: { createdAt: 'desc' },
    });
    expect(result.items.map((item: any) => item.id)).toEqual(['a-1', 'a-2', 'a-3']);
    expect(result.page).toEqual({ page: 1, pageSize: 20, total: 3 });
  });

  it('searchPublic paginates after relevance reranking and preserves recommended fallback order', async () => {
    prisma.achievement.findMany.mockResolvedValueOnce([
      {
        id: 'a-older-strong',
        publisherUserId: 'publisher-1',
        title: '华南专利转化项目',
        summary: 'old but strong match',
        sourceOrgName: null,
        source: 'ADMIN',
        auditStatus: 'APPROVED',
        status: 'ACTIVE',
        externalId: null,
        sourceRawCategory: null,
        sourceRawStatus: null,
        sourceBatch: null,
        sourceRawRegion: null,
        maturity: null,
        regionCode: '440100',
        keywordsJson: [],
        cooperationModesJson: [],
        industryTagsJson: [],
        stats: { consultCount: 1, favoriteCount: 1, viewCount: 10 },
        coverFile: null,
        createdAt: new Date('2026-06-01T00:00:00.000Z'),
      },
      {
        id: 'a-newer-summary',
        publisherUserId: 'publisher-2',
        title: '创新成果精选',
        summary: '服务华南院校技术转移',
        sourceOrgName: null,
        source: 'ADMIN',
        auditStatus: 'APPROVED',
        status: 'ACTIVE',
        externalId: null,
        sourceRawCategory: null,
        sourceRawStatus: null,
        sourceBatch: null,
        sourceRawRegion: null,
        maturity: null,
        regionCode: '440300',
        keywordsJson: [],
        cooperationModesJson: [],
        industryTagsJson: [],
        stats: { consultCount: 99, favoriteCount: 50, viewCount: 999 },
        coverFile: null,
        createdAt: new Date('2026-06-15T00:00:00.000Z'),
      },
      {
        id: 'a-mid-strong',
        publisherUserId: 'publisher-3',
        title: '华南高校成果合集',
        summary: 'strong title match',
        sourceOrgName: null,
        source: 'ADMIN',
        auditStatus: 'APPROVED',
        status: 'ACTIVE',
        externalId: null,
        sourceRawCategory: null,
        sourceRawStatus: null,
        sourceBatch: null,
        sourceRawRegion: null,
        maturity: null,
        regionCode: '440600',
        keywordsJson: [],
        cooperationModesJson: [],
        industryTagsJson: [],
        stats: { consultCount: 5, favoriteCount: 3, viewCount: 15 },
        coverFile: null,
        createdAt: new Date('2026-06-08T00:00:00.000Z'),
      },
    ]);
    prisma.user.findMany.mockResolvedValueOnce([
      { id: 'publisher-1', nickname: 'P1', regionCode: '440100', verifications: [] },
      { id: 'publisher-2', nickname: 'P2', regionCode: '440300', verifications: [] },
      { id: 'publisher-3', nickname: 'P3', regionCode: '440600', verifications: [] },
    ]);

    const result = await service.searchPublic({ q: '华南', sortBy: 'RECOMMENDED', page: '1', pageSize: '2' });

    expect(prisma.achievement.findMany).toHaveBeenCalledWith({
      where: { auditStatus: 'APPROVED', status: 'ACTIVE' },
      include: { stats: true, coverFile: true },
      orderBy: [
        { stats: { consultCount: 'desc' } },
        { stats: { favoriteCount: 'desc' } },
        { stats: { viewCount: 'desc' } },
        { createdAt: 'desc' },
      ],
    });
    expect(result.items.map((item: any) => item.id)).toEqual(['a-mid-strong', 'a-older-strong']);
    expect(result.page).toEqual({ page: 1, pageSize: 2, total: 2 });
  });
});
