import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AchievementsService } from '../src/modules/achievements/achievements.service';

const ACHIEVEMENT_ID = '11111111-1111-1111-1111-111111111111';
const USER_ID = 'user-1';

const USER_REQ = { auth: { userId: USER_ID } };

function buildAchievement(overrides: Record<string, unknown> = {}) {
  return {
    id: ACHIEVEMENT_ID,
    publisherUserId: USER_ID,
    title: 'Achievement A',
    summary: null,
    source: 'USER',
    auditStatus: 'PENDING',
    status: 'DRAFT',
    maturity: null,
    regionCode: null,
    industryTagsJson: [],
    keywordsJson: [],
    cooperationModesJson: [],
    stats: null,
    coverFile: null,
    createdAt: new Date('2026-06-15T00:00:00.000Z'),
    ...overrides,
  };
}

describe('AchievementsService write flow suite', () => {
  let prisma: any;
  let service: AchievementsService;

  beforeEach(() => {
    prisma = {
      achievement: {
        count: vi.fn(),
        create: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      user: {
        findMany: vi.fn(),
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

  it('listMine applies status and auditStatus filters for draft views', async () => {
    prisma.achievement.findMany.mockResolvedValueOnce([buildAchievement()]);
    prisma.achievement.count.mockResolvedValueOnce(1);
    prisma.user.findMany.mockResolvedValueOnce([]);

    const result = await service.listMine(USER_REQ, {
      page: '1',
      pageSize: '1',
      status: 'draft',
    });

    expect(prisma.achievement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          publisherUserId: USER_ID,
          status: 'DRAFT',
        },
        take: 1,
      }),
    );
    expect(result.page.total).toBe(1);
  });

  it('listMine can exclude draft achievements from default management views', async () => {
    prisma.achievement.findMany.mockResolvedValueOnce([buildAchievement({ status: 'ACTIVE', auditStatus: 'APPROVED' })]);
    prisma.achievement.count.mockResolvedValueOnce(1);
    prisma.user.findMany.mockResolvedValueOnce([]);

    const result = await service.listMine(USER_REQ, {
      excludeStatus: 'draft',
    });

    expect(prisma.achievement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          publisherUserId: USER_ID,
          status: { not: 'DRAFT' },
        },
      }),
    );
    expect(prisma.achievement.count).toHaveBeenCalledWith({
      where: {
        publisherUserId: USER_ID,
        status: { not: 'DRAFT' },
      },
    });
    expect(result.items[0]).toMatchObject({ id: ACHIEVEMENT_ID });
  });
});
