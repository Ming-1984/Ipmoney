import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AiService } from '../src/modules/ai/ai.service';

describe('AiService query filter strictness suite', () => {
  let prisma: any;
  let service: AiService;

  beforeEach(() => {
    prisma = {
      listing: { findMany: vi.fn() },
      demand: { findMany: vi.fn() },
      achievement: { findMany: vi.fn() },
      artwork: { findMany: vi.fn() },
      aiParseResult: {
        count: vi.fn(),
        findMany: vi.fn(),
      },
    };
    const audit = { log: vi.fn().mockResolvedValue(undefined) };
    service = new AiService(prisma, audit as any);
  });

  it('rejects invalid inputType/content filters and regionCode strictly', async () => {
    await expect(service.createAgentQuery({ inputType: 'img' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.createAgentQuery({ inputType: 'text', contentScope: 'foo' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.createAgentQuery({ inputType: 'text', contentType: 'foo' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.createAgentQuery({ inputType: 'text', regionCode: 'abc' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('sanitizes hidden industry tags and keeps parsed regionCode in query filters', async () => {
    prisma.listing.findMany.mockResolvedValueOnce([{ id: 'l-1', title: 'AI Listing' }]);

    const result = await service.createAgentQuery({
      inputType: 'text',
      inputText: 'AI listing',
      contentScope: 'listing',
      regionCode: '110000',
      industryTags: ['AI', 'smoke-tag-temp', 'ai'],
    });

    expect(result.parsedQuery).toMatchObject({
      contentType: 'LISTING',
      filters: { q: 'AI listing', regionCode: '110000', industryTags: ['AI'] },
    });
    expect(result.topMatches[0]).toMatchObject({ contentType: 'LISTING', contentId: 'l-1' });
  });

  it('ignores non-array industryTags payload in createAgentQuery filters', async () => {
    prisma.listing.findMany.mockResolvedValueOnce([]);
    prisma.demand.findMany.mockResolvedValueOnce([]);
    prisma.achievement.findMany.mockResolvedValueOnce([]);
    prisma.artwork.findMany.mockResolvedValueOnce([]);

    const result = await service.createAgentQuery({
      inputType: 'text',
      inputText: 'keyword',
      contentScope: 'all',
      industryTags: 'AI,Robotics',
    });

    expect(result.parsedQuery.filters.industryTags).toBeUndefined();
  });

  it('validates admin list filters and caps pageSize', async () => {
    const req = { auth: { userId: 'admin-1', permissions: new Set(['ai.manage']) } };
    prisma.aiParseResult.count.mockResolvedValueOnce(1);

    await expect(service.adminListParseResults(req, { status: 'bad' })).rejects.toBeInstanceOf(BadRequestException);

    prisma.aiParseResult.count.mockResolvedValueOnce(1);
    prisma.aiParseResult.findMany.mockResolvedValueOnce([
      {
        id: '11111111-1111-1111-1111-111111111111',
        contentType: 'LISTING',
        contentId: 'l-1',
        summaryPlain: 'summary',
        featuresPlain: null,
        keywordsJson: [],
        confidence: 0.8,
        modelVersion: 'v1',
        status: 'ACTIVE',
        createdAt: new Date('2026-03-12T00:00:00.000Z'),
        updatedAt: new Date('2026-03-12T00:00:00.000Z'),
      },
    ]);
    prisma.aiParseResult.count.mockResolvedValueOnce(1);

    const result = await service.adminListParseResults(req, {
      page: '2',
      pageSize: '100',
      status: 'active',
      contentType: 'listing',
    });

    expect(prisma.aiParseResult.findMany).toHaveBeenCalledWith({
      where: { contentType: 'LISTING', status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
      skip: 50,
      take: 50,
    });
    expect(result.page).toEqual({ page: 2, pageSize: 50, total: 1 });
  });
});
