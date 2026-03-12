import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RegionsService } from '../src/modules/regions/regions.service';

describe('RegionsService filter and sanitization suite', () => {
  let prisma: any;
  let service: RegionsService;

  beforeEach(() => {
    prisma = {
      region: {
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      industryTag: {
        findMany: vi.fn(),
        create: vi.fn(),
      },
    };
    service = new RegionsService(prisma);
  });

  it('validates listRegions level/parentCode strictly', async () => {
    await expect(service.listRegions({ level: '   ' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.listRegions({ level: 'town' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.listRegions({ parentCode: 'bad' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('filters hidden test artifacts when includeTestArtifacts is false', async () => {
    prisma.region.findMany.mockResolvedValueOnce([
      {
        code: '110000',
        name: 'Normal Region',
        level: 'PROVINCE',
        parentCode: null,
        centerLat: null,
        centerLng: null,
        industryTagsJson: ['AI', 'smoke-tag-x'],
        updatedAt: new Date('2026-03-12T00:00:00.000Z'),
      },
      {
        code: '220000',
        name: 'smoke-region-hidden',
        level: 'PROVINCE',
        parentCode: null,
        centerLat: null,
        centerLng: null,
        industryTagsJson: ['Robotics'],
        updatedAt: new Date('2026-03-12T00:00:00.000Z'),
      },
    ]);

    const result = await service.listRegions({ includeTestArtifacts: false });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      code: '110000',
      name: 'Normal Region',
      industryTags: ['AI'],
    });
  });

  it('validates createRegion fields and duplicate conflict mapping', async () => {
    await expect(service.createRegion({ code: 'bad', name: 'A', level: 'CITY' as any })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.createRegion({ code: '110000', name: '  ', level: 'CITY' as any })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.createRegion({ code: '110000', name: 'A', level: 'CITY' as any, centerLat: 91 })).rejects.toBeInstanceOf(
      BadRequestException,
    );

    prisma.region.create.mockRejectedValueOnce({ code: 'P2002' });
    await expect(service.createRegion({ code: '110000', name: 'A', level: 'CITY' as any })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('validates updateRegion and maps not-found errors', async () => {
    await expect(service.updateRegion('bad', {})).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.updateRegion('110000', { name: '   ' } as any)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.updateRegion('110000', { level: 'town' as any })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.updateRegion('110000', { centerLng: -181 } as any)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    prisma.region.update.mockRejectedValueOnce({ code: 'P2025' });
    await expect(service.updateRegion('110000', { name: 'X' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('validates and normalizes setRegionIndustryTags', async () => {
    await expect(service.setRegionIndustryTags('110000', 'bad' as any)).rejects.toBeInstanceOf(BadRequestException);

    prisma.region.update.mockResolvedValueOnce({
      code: '110000',
      name: 'A',
      level: 'CITY',
      parentCode: null,
      centerLat: null,
      centerLng: null,
      industryTagsJson: ['AI', 'Robotics'],
      updatedAt: new Date('2026-03-12T00:00:00.000Z'),
    });
    const result = await service.setRegionIndustryTags('110000', [' AI ', '', 'Robotics']);

    expect(prisma.region.update).toHaveBeenCalledWith({
      where: { code: '110000' },
      data: { industryTagsJson: ['AI', 'Robotics'] },
    });
    expect(result.industryTags).toEqual(['AI', 'Robotics']);
  });

  it('filters hidden test industry tags on listIndustryTags', async () => {
    prisma.industryTag.findMany.mockResolvedValueOnce([
      { id: '1', name: 'AI' },
      { id: '2', name: 'smoke-tag-temp' },
      { id: '3', name: 'Robotics' },
    ]);

    const result = await service.listIndustryTags();
    expect(result).toEqual([
      { id: '1', name: 'AI' },
      { id: '3', name: 'Robotics' },
    ]);
  });
});
