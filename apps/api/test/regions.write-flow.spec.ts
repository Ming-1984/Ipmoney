import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RegionsService } from '../src/modules/regions/regions.service';

function buildRegion(overrides: Record<string, unknown> = {}) {
  return {
    code: '440300',
    name: 'Shenzhen',
    level: 'CITY',
    parentCode: '440000',
    centerLat: 22.5431,
    centerLng: 114.0579,
    industryTagsJson: ['AI'],
    updatedAt: new Date('2026-03-13T00:00:00.000Z'),
    ...overrides,
  };
}

describe('RegionsService write flow suite', () => {
  let prisma: any;
  let service: RegionsService;

  beforeEach(() => {
    prisma = {
      region: {
        create: vi.fn(),
        update: vi.fn(),
      },
      industryTag: {
        create: vi.fn(),
        findMany: vi.fn(),
      },
    };
    service = new RegionsService(prisma);
  });

  it('validates createRegion payload strictly', async () => {
    await expect(service.createRegion({ code: 'bad', name: 'A', level: 'CITY' as any })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.createRegion({ code: '440300', name: '   ', level: 'CITY' as any })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.createRegion({ code: '440300', name: 'A', level: 'TOWN' as any })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      service.createRegion({ code: '440300', name: 'A', level: 'CITY' as any, parentCode: 'bad' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.createRegion({ code: '440300', name: 'A', level: 'CITY' as any, centerLat: 91 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.createRegion({ code: '440300', name: 'A', level: 'CITY' as any, centerLng: 'x' as any }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('createRegion normalizes optional fields and maps duplicate conflicts', async () => {
    prisma.region.create.mockResolvedValueOnce(
      buildRegion({
        code: '440304',
        name: 'Nanshan',
        level: 'DISTRICT',
        parentCode: null,
        centerLat: 22.53,
        centerLng: 113.93,
        industryTagsJson: [],
      }),
    );

    const created = await service.createRegion({
      code: '440304',
      name: ' Nanshan ',
      level: 'DISTRICT' as any,
      parentCode: ' ',
      centerLat: '22.53' as any,
      centerLng: '113.93' as any,
    });

    expect(prisma.region.create).toHaveBeenCalledWith({
      data: {
        code: '440304',
        name: 'Nanshan',
        level: 'DISTRICT',
        parentCode: null,
        centerLat: 22.53,
        centerLng: 113.93,
        industryTagsJson: [],
      },
    });
    expect(created).toMatchObject({
      code: '440304',
      name: 'Nanshan',
      level: 'DISTRICT',
      parentCode: null,
      centerLat: 22.53,
      centerLng: 113.93,
      industryTags: [],
    });

    prisma.region.create.mockRejectedValueOnce({ code: 'P2002' });
    await expect(
      service.createRegion({ code: '440304', name: 'Nanshan', level: 'DISTRICT' as any }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('validates updateRegion patch strictly and maps not-found', async () => {
    await expect(service.updateRegion('bad', {})).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.updateRegion('440300', { level: 'town' as any })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.updateRegion('440300', { name: '   ' } as any)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.updateRegion('440300', { parentCode: 'bad' } as any)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.updateRegion('440300', { centerLat: -91 } as any)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.updateRegion('440300', { centerLng: 'x' as any })).rejects.toBeInstanceOf(
      BadRequestException,
    );

    prisma.region.update.mockRejectedValueOnce({ code: 'P2025' });
    await expect(service.updateRegion('440300', { name: 'X' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updateRegion applies normalized patch values', async () => {
    prisma.region.update.mockResolvedValueOnce(
      buildRegion({
        code: '440300',
        name: 'Shenzhen Nanshan',
        level: 'CITY',
        parentCode: null,
        centerLat: null,
        centerLng: 113.95,
        industryTagsJson: ['AI'],
      }),
    );

    const updated = await service.updateRegion('440300', {
      name: ' Shenzhen Nanshan ',
      level: 'CITY' as any,
      parentCode: ' ',
      centerLat: '',
      centerLng: '113.95' as any,
    });

    expect(prisma.region.update).toHaveBeenCalledWith({
      where: { code: '440300' },
      data: {
        name: 'Shenzhen Nanshan',
        level: 'CITY',
        parentCode: null,
        centerLat: null,
        centerLng: 113.95,
      },
    });
    expect(updated).toMatchObject({
      code: '440300',
      name: 'Shenzhen Nanshan',
      level: 'CITY',
      parentCode: null,
      centerLat: null,
      centerLng: 113.95,
    });
  });

  it('setRegionIndustryTags validates payload, normalizes tags, and maps not-found', async () => {
    await expect(service.setRegionIndustryTags('bad', ['AI'])).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.setRegionIndustryTags('440300', 'bad' as any)).rejects.toBeInstanceOf(BadRequestException);

    prisma.region.update.mockResolvedValueOnce(
      buildRegion({
        industryTagsJson: ['AI', 'Robotics'],
      }),
    );
    const updated = await service.setRegionIndustryTags('440300', [' AI ', '', 'Robotics']);

    expect(prisma.region.update).toHaveBeenCalledWith({
      where: { code: '440300' },
      data: { industryTagsJson: ['AI', 'Robotics'] },
    });
    expect(updated.industryTags).toEqual(['AI', 'Robotics']);

    prisma.region.update.mockRejectedValueOnce({ code: 'P2025' });
    await expect(service.setRegionIndustryTags('440300', ['AI'])).rejects.toBeInstanceOf(NotFoundException);
  });

  it('createIndustryTag validates, trims payload, and maps duplicate conflict', async () => {
    await expect(service.createIndustryTag('   ')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.createIndustryTag('a'.repeat(51))).rejects.toBeInstanceOf(BadRequestException);

    prisma.industryTag.create.mockResolvedValueOnce({ id: 'tag-1', name: 'AI' });
    const created = await service.createIndustryTag(' AI ');
    expect(prisma.industryTag.create).toHaveBeenCalledWith({ data: { name: 'AI' } });
    expect(created).toEqual({ id: 'tag-1', name: 'AI' });

    prisma.industryTag.create.mockRejectedValueOnce({ code: 'P2002' });
    await expect(service.createIndustryTag('AI')).rejects.toBeInstanceOf(ConflictException);
  });

  it('listIndustryTags respects includeTestArtifacts toggle', async () => {
    prisma.industryTag.findMany.mockResolvedValueOnce([
      { id: '1', name: 'AI' },
      { id: '2', name: 'smoke-tag-temp' },
      { id: '3', name: 'Robotics' },
    ]);
    const visibleOnly = await service.listIndustryTags();
    expect(visibleOnly).toEqual([
      { id: '1', name: 'AI' },
      { id: '3', name: 'Robotics' },
    ]);

    prisma.industryTag.findMany.mockResolvedValueOnce([
      { id: '1', name: 'AI' },
      { id: '2', name: 'smoke-tag-temp' },
    ]);
    const all = await service.listIndustryTags({ includeTestArtifacts: true });
    expect(all).toEqual([
      { id: '1', name: 'AI' },
      { id: '2', name: 'smoke-tag-temp' },
    ]);
  });
});
