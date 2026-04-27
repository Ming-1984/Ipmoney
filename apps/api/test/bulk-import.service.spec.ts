import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BulkImportService } from '../src/modules/bulk-import/bulk-import.service';

describe('BulkImportService request validation', () => {
  let prisma: any;
  let files: any;
  let audit: any;
  let service: BulkImportService;

  beforeEach(() => {
    prisma = {
      region: { findMany: vi.fn().mockResolvedValue([]) },
      userVerification: { findFirst: vi.fn() },
      user: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
      techManagerProfile: { findUnique: vi.fn(), upsert: vi.fn() },
      achievement: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
      file: { findFirst: vi.fn(), create: vi.fn() },
      idempotencyKey: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
      auditLog: { findMany: vi.fn(), count: vi.fn() },
    };
    files = {
      getFileById: vi.fn(),
      getFileBuffer: vi.fn(),
    };
    audit = { log: vi.fn().mockResolvedValue(undefined) };
    service = new BulkImportService(prisma, files, audit);
  });

  it('requires admin', async () => {
    await expect(service.previewPeopleAchievements({}, {})).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.executePeopleAchievements({}, {})).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('validates import payload', async () => {
    const req: any = { auth: { isAdmin: true, userId: '11111111-1111-1111-1111-111111111111' } };

    await expect(service.previewPeopleAchievements(req, {})).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.previewPeopleAchievements(req, {
        peopleFileId: 'not-uuid',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.previewPeopleAchievements(req, {
        peopleFileId: '11111111-1111-1111-1111-111111111111',
        ratingPolicy: 'INVALID',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.previewPeopleAchievements(req, {
        peopleFileId: '11111111-1111-1111-1111-111111111111',
        defaultRatingScore: 6,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.previewPeopleAchievements(req, {
        peopleFileId: '11111111-1111-1111-1111-111111111111',
        defaultRatingCount: -1,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.previewPeopleAchievements(req, {
        peopleFileId: '11111111-1111-1111-1111-111111111111',
        defaultRatingScore: 4.8,
        defaultRatingCount: 0,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects missing file and invalid workbook in preview pipeline', async () => {
    const req: any = { auth: { isAdmin: true, userId: '11111111-1111-1111-1111-111111111111' } };

    files.getFileById.mockResolvedValueOnce(null);
    await expect(
      service.previewPeopleAchievements(req, {
        peopleFileId: '11111111-1111-1111-1111-111111111111',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    files.getFileById.mockResolvedValueOnce({ id: '11111111-1111-1111-1111-111111111111', fileName: 'people.xlsx' });
    files.getFileBuffer.mockResolvedValueOnce(Buffer.alloc(0));
    await expect(
      service.previewPeopleAchievements(req, {
        peopleFileId: '11111111-1111-1111-1111-111111111111',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lists import history with paging', async () => {
    const req: any = { auth: { isAdmin: true, userId: '11111111-1111-1111-1111-111111111111' } };
    prisma.auditLog.findMany.mockResolvedValueOnce([
      {
        id: '22222222-2222-2222-2222-222222222222',
        action: 'BULK_IMPORT_EXECUTE',
        actorUserId: '11111111-1111-1111-1111-111111111111',
        actor: { nickname: 'ipmoney', phone: '13900000000' },
        createdAt: new Date('2026-04-23T12:00:00.000Z'),
        afterJson: {
          input: { sourceBatch: 'batch-a' },
          people: { totalRows: 5, validRows: 5, invalidRows: 0, created: 3, updated: 2 },
          achievements: { totalRows: 2, validRows: 2, invalidRows: 0, created: 2, updated: 0 },
        },
      },
    ]);
    prisma.auditLog.count.mockResolvedValueOnce(1);

    const result = await service.listPeopleAchievementsHistory(req, { page: 1, pageSize: 20, action: 'EXECUTE' });
    expect(result.page.total).toBe(1);
    expect(result.items[0].action).toBe('BULK_IMPORT_EXECUTE');
    expect(result.items[0].input.sourceBatch).toBe('batch-a');
    expect(result.items[0].people.totalRows).toBe(5);
    expect(prisma.auditLog.findMany).toHaveBeenCalled();
    expect(prisma.auditLog.count).toHaveBeenCalled();
  });
});

