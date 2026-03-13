import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PatentMapService } from '../src/modules/patent-map/patent-map.service';

describe('PatentMapService admin write-flow suite', () => {
  let prisma: any;
  let service: PatentMapService;

  beforeEach(() => {
    prisma = {
      region: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
      },
      patentMapEntry: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        upsert: vi.fn(),
      },
      $transaction: vi.fn(),
    };
    service = new PatentMapService(prisma);
  });

  it('validates admin get-entry params strictly', async () => {
    await expect(service.adminGetEntry('1100', 2026)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.adminGetEntry('110000', 2026.5)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns normalized dto for existing admin entry', async () => {
    const createdAt = new Date('2026-03-13T01:02:03.000Z');
    const updatedAt = new Date('2026-03-13T04:05:06.000Z');
    prisma.patentMapEntry.findUnique.mockResolvedValueOnce({
      regionCode: '110000',
      year: 2026,
      patentCount: 11,
      industryBreakdownJson: [
        { industryTag: 'AI', count: 6 },
        { industryTag: '', count: 1 },
      ],
      topAssigneesJson: [
        { name: 'Org A', patentCount: 3 },
        { assigneeName: '', patentCount: 2 },
      ],
      createdAt,
      updatedAt,
    });

    const result = await service.adminGetEntry('110000', 2026);

    expect(prisma.patentMapEntry.findUnique).toHaveBeenCalledWith({
      where: { regionCode_year: { regionCode: '110000', year: 2026 } },
    });
    expect(result).toEqual({
      regionCode: '110000',
      year: 2026,
      patentCount: 11,
      industryBreakdown: [{ industryTag: 'AI', count: 6 }],
      topAssignees: [{ name: 'Org A', assigneeName: 'Org A', patentCount: 3 }],
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
    });
  });

  it('returns not found when admin entry does not exist', async () => {
    prisma.patentMapEntry.findUnique.mockResolvedValueOnce(null);
    await expect(service.adminGetEntry('110000', 2026)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('validates admin upsert payload and missing region branch', async () => {
    await expect(service.adminUpsertEntry('110000', 2026, { patentCount: -1 } as any)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    prisma.region.findUnique.mockResolvedValueOnce(null);
    await expect(service.adminUpsertEntry('110000', 2026, { patentCount: 0 })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('upserts admin entry with array fallback defaults', async () => {
    const now = new Date('2026-03-13T08:00:00.000Z');
    prisma.region.findUnique.mockResolvedValueOnce({ code: '110000' });
    prisma.patentMapEntry.upsert.mockResolvedValueOnce({
      regionCode: '110000',
      year: 2026,
      patentCount: 8,
      industryBreakdownJson: [],
      topAssigneesJson: [],
      createdAt: now,
      updatedAt: now,
    });

    const result = await service.adminUpsertEntry('110000', 2026, {
      patentCount: 8,
      industryBreakdown: undefined as any,
      topAssignees: 'invalid' as any,
    });

    expect(prisma.patentMapEntry.upsert).toHaveBeenCalledWith({
      where: { regionCode_year: { regionCode: '110000', year: 2026 } },
      create: {
        regionCode: '110000',
        year: 2026,
        patentCount: 8,
        industryBreakdownJson: [],
        topAssigneesJson: [],
      },
      update: {
        patentCount: 8,
        industryBreakdownJson: [],
        topAssigneesJson: [],
      },
    });
    expect(result.industryBreakdown).toEqual([]);
    expect(result.topAssignees).toEqual([]);
  });

  it('rejects missing file and safely handles non-excel buffer', async () => {
    await expect(service.adminImportExcel(undefined, false)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.adminImportExcel({ buffer: Buffer.from('not-an-xlsx') }, false)).resolves.toEqual({
      dryRun: false,
      importedCount: 0,
      updatedCount: 0,
      errors: [],
    });
  });

  it('imports excel in non-dry-run mode with transaction upserts', async () => {
    const worksheet = XLSX.utils.json_to_sheet([
      {
        regionCode: '110000',
        year: 2026,
        patentCount: 10,
        industryBreakdown: 'AI:2',
        topAssignees: 'Org A:1',
      },
      {
        regionCode: '440100',
        year: 2026,
        patentCount: 6,
        industryBreakdown: 'Robotics:3',
        topAssignees: 'Org B:2',
      },
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'sheet1');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

    prisma.region.findMany.mockResolvedValueOnce([{ code: '110000' }, { code: '440100' }]);
    prisma.patentMapEntry.findMany.mockResolvedValueOnce([{ regionCode: '110000', year: 2026 }]);
    prisma.patentMapEntry.upsert.mockResolvedValue({});
    prisma.$transaction.mockResolvedValueOnce([]);

    const result = await service.adminImportExcel({ buffer }, false);

    expect(result).toEqual({
      dryRun: false,
      importedCount: 1,
      updatedCount: 1,
      errors: [],
    });
    expect(prisma.patentMapEntry.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
