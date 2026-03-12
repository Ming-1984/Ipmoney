import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CasesService } from '../src/modules/cases/cases.service';

describe('CasesService list filter strictness suite', () => {
  let prisma: any;
  let service: CasesService;

  beforeEach(() => {
    prisma = {
      csCase: {
        findMany: vi.fn(),
        count: vi.fn(),
      },
    };
    service = new CasesService(prisma);
  });

  it('requires auth and permission for list', async () => {
    await expect(service.list({}, {})).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.list({ auth: { userId: 'u-1' } }, {})).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects invalid list filters strictly', async () => {
    const req = { auth: { userId: 'u-1', permissions: new Set(['case.manage']) } };
    await expect(service.list(req, { page: '0' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.list(req, { pageSize: '1.5' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.list(req, { status: 'pending' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.list(req, { type: 'bug' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('caps pageSize and applies uuid query OR filters', async () => {
    const req = { auth: { userId: 'u-1', permissions: new Set(['case.manage']) } };
    prisma.csCase.findMany.mockResolvedValueOnce([]);
    prisma.csCase.count.mockResolvedValueOnce(0);

    await service.list(req, {
      q: '11111111-1111-1111-1111-111111111111',
      status: 'open',
      type: 'refund',
      page: '2',
      pageSize: '100',
    });

    expect(prisma.csCase.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: 'OPEN',
          type: 'REFUND',
          OR: [{ id: '11111111-1111-1111-1111-111111111111' }, { orderId: '11111111-1111-1111-1111-111111111111' }],
        },
        skip: 50,
        take: 50,
      }),
    );
  });

  it('maps case rows with default title and sla status', async () => {
    const req = { auth: { userId: 'u-1', permissions: new Set(['case.manage']) } };
    prisma.csCase.findMany.mockResolvedValueOnce([
      {
        id: 'c-1',
        title: '   ',
        type: 'REFUND',
        status: 'OPEN',
        orderId: null,
        requesterName: 'Alice',
        csUserId: 'cs-1',
        csUser: { nickname: 'CS' },
        priority: 'HIGH',
        description: 'desc',
        createdAt: new Date('2026-03-13T00:00:00.000Z'),
        updatedAt: new Date('2026-03-13T01:00:00.000Z'),
        dueAt: new Date('2026-03-12T00:00:00.000Z'),
        notes: [
          {
            id: 'n-1',
            authorId: 'a-1',
            authorName: 'Admin',
            content: 'note',
            createdAt: new Date('2026-03-13T00:00:00.000Z'),
          },
        ],
        evidences: [
          {
            id: 'e-1',
            fileId: 'f-1',
            fileName: 'evidence.pdf',
            url: 'https://example.com/evidence.pdf',
            file: null,
            createdAt: new Date('2026-03-13T00:00:00.000Z'),
          },
        ],
      },
    ]);
    prisma.csCase.count.mockResolvedValueOnce(1);

    const result = await service.list(req, { q: 'refund', page: '1', pageSize: '20' });

    expect(result.items[0]).toMatchObject({
      id: 'c-1',
      title: '退款争议',
      status: 'OPEN',
      slaStatus: 'OVERDUE',
      assigneeId: 'cs-1',
      assigneeName: 'CS',
      notes: [{ id: 'n-1', authorName: 'Admin', content: 'note' }],
      evidenceFiles: [{ id: 'f-1', name: 'evidence.pdf' }],
    });
    expect(result.page).toEqual({ page: 1, pageSize: 20, total: 1 });
  });
});
