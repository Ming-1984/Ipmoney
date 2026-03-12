import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AnnouncementsService } from '../src/modules/announcements/announcements.service';

describe('AnnouncementsService filter and sanitization suite', () => {
  let prisma: any;
  let service: AnnouncementsService;

  beforeEach(() => {
    prisma = {
      announcement: {
        findMany: vi.fn(),
        count: vi.fn(),
      },
    };
    const audit = { log: vi.fn().mockResolvedValue(undefined) };
    service = new AnnouncementsService(prisma, audit as any);
  });

  it('rejects invalid list pagination params', async () => {
    await expect(service.list({ page: '0' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.list({ pageSize: '1.5' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('caps public list pageSize and sanitizes hidden tags', async () => {
    prisma.announcement.findMany.mockResolvedValueOnce([
      {
        id: '11111111-1111-1111-1111-111111111111',
        title: 'Announcement',
        summary: 'summary',
        content: 'content',
        publisherName: 'publisher',
        issueNo: 'A-1',
        sourceUrl: null,
        tagsJson: ['AI', 'smoke-tag-temp', 'e2e-tag-x'],
        relatedPatentsJson: [{ name: 'Patent A', patentNo: 'CN123' }],
        status: 'PUBLISHED',
        createdAt: new Date('2026-03-12T00:00:00.000Z'),
        publishedAt: new Date('2026-03-12T00:00:00.000Z'),
        updatedAt: new Date('2026-03-12T00:00:00.000Z'),
      },
    ]);
    prisma.announcement.count.mockResolvedValueOnce(1);

    const result = await service.list({ page: '2', pageSize: '100' });

    expect(prisma.announcement.findMany).toHaveBeenCalledWith({
      where: { status: 'PUBLISHED' },
      orderBy: { publishedAt: 'desc' },
      skip: 50,
      take: 50,
    });
    expect(result.page).toEqual({ page: 2, pageSize: 50, total: 1 });
    expect(result.items[0].tags).toEqual(['AI']);
  });

  it('rejects invalid announcement id in getById', async () => {
    await expect(service.getById('bad-id')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('validates admin list filters and query shape', async () => {
    await expect(service.adminList({ status: 'unknown' })).rejects.toBeInstanceOf(BadRequestException);

    prisma.announcement.findMany.mockResolvedValueOnce([]);
    prisma.announcement.count.mockResolvedValueOnce(0);

    const result = await service.adminList({ page: '1', pageSize: '90', status: 'draft', q: '  policy  ' });

    expect(prisma.announcement.findMany).toHaveBeenCalledWith({
      where: {
        status: 'DRAFT',
        OR: [{ title: { contains: 'policy' } }, { summary: { contains: 'policy' } }],
      },
      orderBy: { updatedAt: 'desc' },
      skip: 0,
      take: 50,
    });
    expect(result.page).toEqual({ page: 1, pageSize: 50, total: 0 });
  });
});
