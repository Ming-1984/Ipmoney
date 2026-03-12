import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PatentMapService } from '../src/modules/patent-map/patent-map.service';

describe('PatentMapService filter and import strictness suite', () => {
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
      },
      $transaction: vi.fn(),
    };
    service = new PatentMapService(prisma);
  });

  it('validates summary query params strictly', async () => {
    await expect(service.getSummary({ year: 2026.5, level: 'CITY' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.getSummary({ year: 2026, level: 'TOWN' as any })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.getSummary({ year: 2026, level: 'CITY', parentCode: '   ' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.getSummary({ year: 2026, level: 'CITY', parentCode: '1100' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('returns summary with zero fallback for missing entry rows', async () => {
    prisma.region.findMany.mockResolvedValueOnce([
      { code: '110000', name: 'Beijing' },
      { code: '440100', name: 'Guangzhou' },
    ]);
    prisma.patentMapEntry.findMany.mockResolvedValueOnce([{ regionCode: '110000', patentCount: 9 }]);

    const result = await service.getSummary({ year: 2026, level: 'CITY', parentCode: '110000' });

    expect(prisma.region.findMany).toHaveBeenCalledWith({
      where: { level: 'CITY', parentCode: '110000' },
      orderBy: { code: 'asc' },
    });
    expect(result).toEqual([
      { regionCode: '110000', regionName: 'Beijing', patentCount: 9 },
      { regionCode: '440100', regionName: 'Guangzhou', patentCount: 0 },
    ]);
  });

  it('sanitizes hidden test industry tags in public region detail', async () => {
    prisma.region.findUnique.mockResolvedValueOnce({ code: '110000', name: 'Beijing' });
    prisma.patentMapEntry.findUnique.mockResolvedValueOnce({
      regionCode: '110000',
      year: 2026,
      patentCount: 12,
      industryBreakdownJson: [
        { industryTag: 'AI', count: 5 },
        { industryTag: 'smoke-tag-temp', count: 2 },
      ],
      topAssigneesJson: [{ assigneeName: 'Org A', patentCount: 3 }],
      updatedAt: new Date('2026-03-12T00:00:00.000Z'),
    });

    const result = await service.getRegionDetail('110000', 2026);

    expect(result.industryBreakdown).toEqual([{ industryTag: 'AI', count: 5 }]);
    expect(result.topAssignees).toEqual([{ name: 'Org A', assigneeName: 'Org A', patentCount: 3 }]);
  });

  it('returns not found when region detail has no entry', async () => {
    prisma.region.findUnique.mockResolvedValueOnce({ code: '110000', name: 'Beijing' });
    prisma.patentMapEntry.findUnique.mockResolvedValueOnce(null);

    await expect(service.getRegionDetail('110000', 2026)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('parses import list strings and reports duplicate/missing-region rows in dry-run', async () => {
    const fullWidthBreakdown = `AI\uFF1A2\uFF0CRobotics\uFF1A3`;
    const fullWidthAssignees = `Org A\uFF1A2\uFF1BOrg B\uFF1A1`;
    const worksheet = XLSX.utils.json_to_sheet([
      { regionCode: '110000', year: 2026, patentCount: 10, industryBreakdown: fullWidthBreakdown, topAssignees: fullWidthAssignees },
      { regionCode: '110000', year: 2026, patentCount: 8, industryBreakdown: 'AI:1', topAssignees: 'Org A:1' },
      { regionCode: '999999', year: 2026, patentCount: 6, industryBreakdown: 'AI:1', topAssignees: 'Org C:1' },
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'sheet1');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

    prisma.region.findMany.mockResolvedValueOnce([{ code: '110000' }]);
    prisma.patentMapEntry.findMany.mockResolvedValueOnce([{ regionCode: '110000', year: 2026 }]);

    const result = await service.adminImportExcel({ buffer }, true);

    expect(result.dryRun).toBe(true);
    expect(result.importedCount).toBe(0);
    expect(result.updatedCount).toBe(1);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ rowNumber: 3, message: expect.stringContaining('duplicate regionCode/year in file') }),
        expect.objectContaining({ rowNumber: 4, message: expect.stringContaining('region not found') }),
      ]),
    );
  });
});
