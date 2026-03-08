import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../common/prisma/prisma.service';

const REGION_CODE_RE = /^[0-9]{6}$/;
const REGION_LEVELS = new Set(['PROVINCE', 'CITY', 'DISTRICT']);

type RegionRecord = {
  code: string;
  name: string;
  level: 'PROVINCE' | 'CITY' | 'DISTRICT';
  parentCode?: string | null;
  centerLat?: number | null;
  centerLng?: number | null;
  industryTagsJson?: unknown;
  updatedAt: Date;
};

type IndustryTagRecord = {
  id?: string;
  name: string;
};

type RegionWhereInput = any;

export type RegionNodeDto = {
  code: string;
  name: string;
  level: 'PROVINCE' | 'CITY' | 'DISTRICT';
  parentCode: string | null;
  centerLat: number | null;
  centerLng: number | null;
  industryTags: string[];
  updatedAt: string;
};

export type RegionCreateRequestDto = {
  code: string;
  name: string;
  level: 'PROVINCE' | 'CITY' | 'DISTRICT';
  parentCode?: string | null;
  centerLat?: number | null;
  centerLng?: number | null;
};

export type RegionUpdateRequestDto = Partial<Omit<RegionCreateRequestDto, 'code'>>;

@Injectable()
export class RegionsService {
  constructor(private readonly prisma: PrismaService) {}

  private hasOwn(input: any, key: string) {
    return !!input && Object.prototype.hasOwnProperty.call(input, key);
  }

  private parseRegionLevelStrict(value: unknown, fieldName: string): 'PROVINCE' | 'CITY' | 'DISTRICT' {
    const raw = String(value ?? '').trim().toUpperCase();
    if (!raw) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} must not be empty` });
    }
    this.assertRegionLevel(raw, fieldName);
    return raw as 'PROVINCE' | 'CITY' | 'DISTRICT';
  }

  private normalizeOptionalRegionCode(
    value: unknown,
    fieldName: string,
    opts: { allowUndefined: boolean },
  ): string | null | undefined {
    if (value === undefined) return opts.allowUndefined ? undefined : null;
    const trimmed = String(value ?? '').trim();
    if (!trimmed) return null;
    this.assertRegionCode(trimmed, fieldName);
    return trimmed;
  }

  private parseOptionalCoordinate(
    value: unknown,
    fieldName: string,
    opts: { allowUndefined: boolean; min: number; max: number },
  ): number | null | undefined {
    if (value === undefined) return opts.allowUndefined ? undefined : null;
    if (value === null) return null;
    const raw = String(value).trim();
    if (!raw) return null;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} must be a number` });
    }
    if (parsed < opts.min || parsed > opts.max) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: `${fieldName} must be between ${opts.min} and ${opts.max}`,
      });
    }
    return parsed;
  }

  private toRegionNode(region: RegionRecord): RegionNodeDto {
    const industryTags = Array.isArray(region.industryTagsJson) ? (region.industryTagsJson as any[]) : [];
    return {
      code: region.code,
      name: region.name,
      level: region.level,
      parentCode: region.parentCode ?? null,
      centerLat: region.centerLat ?? null,
      centerLng: region.centerLng ?? null,
      industryTags: industryTags.filter((tag: unknown) => typeof tag === 'string') as string[],
      updatedAt: region.updatedAt.toISOString(),
    };
  }

  private assertRegionCode(code: string, fieldName: string) {
    if (!REGION_CODE_RE.test(code)) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} must be 6 digits` });
    }
  }

  private assertRegionLevel(level: string, fieldName: string) {
    if (!REGION_LEVELS.has(level)) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: `${fieldName} must be one of PROVINCE/CITY/DISTRICT`,
      });
    }
  }

  async listRegions(params: { level?: string; parentCode?: string | null; q?: string }): Promise<RegionNodeDto[]> {
    const where: RegionWhereInput = {};

    if (params.level !== undefined) {
      const level = String(params.level);
      if (!level.trim()) {
        throw new BadRequestException({ code: 'BAD_REQUEST', message: 'level must not be empty' });
      }
      this.assertRegionLevel(level, 'level');
      where.level = level as any;
    }
    if (params.parentCode !== undefined) {
      if (params.parentCode === null) where.parentCode = null;
      else {
        this.assertRegionCode(params.parentCode, 'parentCode');
        where.parentCode = params.parentCode;
      }
    }

    if (params.q && params.q.trim()) {
      where.name = { contains: params.q.trim() };
    }

    const regions = await this.prisma.region.findMany({
      where,
      orderBy: [{ level: 'asc' }, { code: 'asc' }],
    });
    return regions.map((regionRecord: RegionRecord) => this.toRegionNode(regionRecord));
  }

  async createRegion(input: RegionCreateRequestDto): Promise<RegionNodeDto> {
    this.assertRegionCode(input.code, 'code');
    if (!input.name || !String(input.name).trim()) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'name must not be empty' });
    }
    if (!input.level) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'level must not be empty' });
    }
    this.assertRegionLevel(input.level, 'level');
    const parentCode = this.normalizeOptionalRegionCode(input.parentCode, 'parentCode', { allowUndefined: false });
    const centerLat = this.parseOptionalCoordinate(input.centerLat, 'centerLat', {
      allowUndefined: false,
      min: -90,
      max: 90,
    });
    const centerLng = this.parseOptionalCoordinate(input.centerLng, 'centerLng', {
      allowUndefined: false,
      min: -180,
      max: 180,
    });

    try {
      const region = await this.prisma.region.create({
        data: {
          code: input.code,
          name: String(input.name).trim(),
          level: input.level as any,
          parentCode: parentCode ?? null,
          centerLat: centerLat ?? null,
          centerLng: centerLng ?? null,
          industryTagsJson: [],
        },
      });
      return this.toRegionNode(region as RegionRecord);
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new ConflictException({ code: 'CONFLICT', message: 'region code already exists' });
      }
      throw error;
    }
  }

  async updateRegion(code: string, patch: RegionUpdateRequestDto): Promise<RegionNodeDto> {
    this.assertRegionCode(code, 'regionCode');
    const hasLevel = this.hasOwn(patch, 'level');
    const hasName = this.hasOwn(patch, 'name');
    const level = hasLevel ? this.parseRegionLevelStrict((patch as any)?.level, 'level') : undefined;
    if (hasName && (patch.name === null || !String((patch as any).name).trim())) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'name must not be empty' });
    }
    const name = hasName ? String((patch as any).name).trim() : undefined;

    const parentCode = this.normalizeOptionalRegionCode(patch.parentCode, 'parentCode', { allowUndefined: true });
    const centerLat = this.parseOptionalCoordinate(patch.centerLat, 'centerLat', {
      allowUndefined: true,
      min: -90,
      max: 90,
    });
    const centerLng = this.parseOptionalCoordinate(patch.centerLng, 'centerLng', {
      allowUndefined: true,
      min: -180,
      max: 180,
    });

    try {
      const region = await this.prisma.region.update({
        where: { code },
        data: {
          name,
          level: hasLevel ? (level as any) : undefined,
          parentCode: parentCode === undefined ? undefined : parentCode ?? null,
          centerLat: centerLat === undefined ? undefined : centerLat ?? null,
          centerLng: centerLng === undefined ? undefined : centerLng ?? null,
        },
      });
      return this.toRegionNode(region as RegionRecord);
    } catch (error: any) {
      if (error?.code === 'P2025') {
        throw new NotFoundException({ code: 'NOT_FOUND', message: 'region not found' });
      }
      throw error;
    }
  }

  async setRegionIndustryTags(code: string, tags: string[]): Promise<RegionNodeDto> {
    this.assertRegionCode(code, 'regionCode');
    if (!Array.isArray(tags)) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'industryTags must be an array' });
    }

    const normalizedTags = tags.map((tag: string) => String(tag).trim()).filter((tag: string) => tag.length > 0);

    try {
      const region = await this.prisma.region.update({
        where: { code },
        data: { industryTagsJson: normalizedTags },
      });
      return this.toRegionNode(region as RegionRecord);
    } catch (error: any) {
      if (error?.code === 'P2025') {
        throw new NotFoundException({ code: 'NOT_FOUND', message: 'region not found' });
      }
      throw error;
    }
  }

  async listIndustryTags(): Promise<IndustryTagRecord[]> {
    return this.prisma.industryTag.findMany({ orderBy: { name: 'asc' } });
  }

  async createIndustryTag(name: string): Promise<IndustryTagRecord> {
    const trimmedName = String(name || '').trim();
    if (!trimmedName) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'name must not be empty' });
    }
    if (trimmedName.length > 50) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'name is too long' });
    }

    try {
      return await this.prisma.industryTag.create({ data: { name: trimmedName } });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new ConflictException({ code: 'CONFLICT', message: 'industry tag already exists' });
      }
      throw error;
    }
  }
}
