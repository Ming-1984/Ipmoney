import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AiService } from '../src/modules/ai/ai.service';

const VALID_ID = '11111111-1111-1111-1111-111111111111';

describe('AiService feedback and parse-update suite', () => {
  let prisma: any;
  let audit: any;
  let service: AiService;

  beforeEach(() => {
    prisma = {
      aiParseResult: {
        count: vi.fn().mockResolvedValue(1),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      aiParseFeedback: {
        create: vi.fn(),
      },
      listing: { findMany: vi.fn() },
      demand: { findMany: vi.fn() },
      achievement: { findMany: vi.fn() },
      artwork: { findMany: vi.fn() },
    };
    audit = { log: vi.fn().mockResolvedValue(undefined) };
    service = new AiService(prisma, audit);
  });

  it('validates auth, parseResultId, and score in feedback path', async () => {
    await expect(service.createFeedback({}, VALID_ID, { score: 3 })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.createFeedback({ auth: { userId: 'u-1' } }, 'bad-id', { score: 3 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.createFeedback({ auth: { userId: 'u-1' } }, VALID_ID, { score: '' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      service.createFeedback({ auth: { userId: 'u-1' } }, VALID_ID, {
        score: '1.5',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.createFeedback({ auth: { userId: 'u-1' } }, VALID_ID, { score: 0 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('returns not found when feedback parse result is missing', async () => {
    prisma.aiParseResult.findUnique.mockResolvedValueOnce(null);

    await expect(service.createFeedback({ auth: { userId: 'u-1' } }, VALID_ID, { score: 5 })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('creates feedback with normalized tags/comment and admin actor type', async () => {
    prisma.aiParseResult.findUnique.mockResolvedValueOnce({ id: VALID_ID });
    prisma.aiParseFeedback.create.mockResolvedValueOnce({
      id: 'f-1',
      parseResultId: VALID_ID,
      actorUserId: 'admin-1',
      actorType: 'ADMIN',
      score: 5,
      reasonTagsJson: ['accuracy', 'latency'],
      comment: 'looks good',
      createdAt: new Date('2026-03-13T00:00:00.000Z'),
    });

    const result = await service.createFeedback(
      { auth: { userId: 'admin-1', isAdmin: true } },
      VALID_ID,
      {
        score: '5',
        reasonTags: [' accuracy ', '', 'accuracy', 'latency'],
        comment: '  looks good  ',
      },
    );

    expect(prisma.aiParseFeedback.create).toHaveBeenCalledWith({
      data: {
        parseResultId: VALID_ID,
        actorUserId: 'admin-1',
        actorType: 'ADMIN',
        score: 5,
        reasonTagsJson: ['accuracy', 'latency'],
        comment: 'looks good',
      },
    });
    expect(result).toMatchObject({
      id: 'f-1',
      parseResultId: VALID_ID,
      actorType: 'ADMIN',
      score: 5,
      reasonTags: ['accuracy', 'latency'],
      comment: 'looks good',
      createdAt: '2026-03-13T00:00:00.000Z',
    });
  });

  it('validates admin parse-result id and missing branch in get path', async () => {
    const req = { auth: { userId: 'admin-1', permissions: new Set(['ai.manage']) } };

    await expect(service.adminGetParseResult(req, 'bad-id')).rejects.toBeInstanceOf(BadRequestException);

    prisma.aiParseResult.findUnique.mockResolvedValueOnce(null);
    await expect(service.adminGetParseResult(req, VALID_ID)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('validates admin update payload status and not found branch', async () => {
    const req = { auth: { userId: 'admin-1', permissions: new Set(['ai.manage']) } };
    prisma.aiParseResult.findUnique.mockResolvedValueOnce({
      id: VALID_ID,
      contentType: 'LISTING',
      contentId: 'l-1',
    });

    await expect(service.adminUpdateParseResult(req, VALID_ID, { status: 'bad' })).rejects.toBeInstanceOf(
      BadRequestException,
    );

    prisma.aiParseResult.findUnique.mockResolvedValueOnce(null);
    await expect(service.adminUpdateParseResult(req, VALID_ID, {})).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updates parse result with normalized payload and writes audit log', async () => {
    const req = { auth: { userId: 'admin-1', permissions: new Set(['ai.manage']) } };
    prisma.aiParseResult.findUnique.mockResolvedValueOnce({
      id: VALID_ID,
      contentType: 'LISTING',
      contentId: 'l-1',
      summaryPlain: 'old',
      featuresPlain: null,
      keywordsJson: ['old'],
      confidence: 0.5,
      modelVersion: 'v1',
      status: 'ACTIVE',
      createdAt: new Date('2026-03-12T00:00:00.000Z'),
      updatedAt: new Date('2026-03-12T00:00:00.000Z'),
    });
    prisma.aiParseResult.update.mockResolvedValueOnce({
      id: VALID_ID,
      contentType: 'LISTING',
      contentId: 'l-1',
      summaryPlain: null,
      featuresPlain: 'Feature',
      keywordsJson: ['Alpha', 'Beta'],
      confidence: 0.5,
      modelVersion: 'v1',
      status: 'REVIEW_REQUIRED',
      note: null,
      createdAt: new Date('2026-03-12T00:00:00.000Z'),
      updatedAt: new Date('2026-03-13T00:00:00.000Z'),
    });

    const result = await service.adminUpdateParseResult(req, VALID_ID, {
      summaryPlain: '   ',
      featuresPlain: ' Feature ',
      keywords: ['Alpha', '', 'Alpha', 'Beta'],
      status: 'review_required',
      note: '',
    });

    expect(prisma.aiParseResult.update).toHaveBeenCalledWith({
      where: { id: VALID_ID },
      data: {
        summaryPlain: null,
        featuresPlain: 'Feature',
        keywordsJson: ['Alpha', 'Beta'],
        status: 'REVIEW_REQUIRED',
        note: null,
      },
    });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'admin-1',
        action: 'AI_PARSE_UPDATE',
        targetType: 'AI_PARSE_RESULT',
        targetId: VALID_ID,
      }),
    );
    expect(result).toMatchObject({
      id: VALID_ID,
      status: 'REVIEW_REQUIRED',
      summaryPlain: undefined,
      featuresPlain: 'Feature',
      keywords: ['Alpha', 'Beta'],
    });
  });
});
