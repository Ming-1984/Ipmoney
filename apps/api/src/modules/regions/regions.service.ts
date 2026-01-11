import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { IndustryTag, Region } from '@prisma/client';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';

const REGION_CODE_RE = /^[0-9]{6}$/;
const REGION_LEVELS = new Set(['PROVINCE', 'CITY', 'DISTRICT']);

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

  private toRegionNode(region: Region): RegionNodeDto {
    const industryTags = Array.isArray(region.industryTagsJson) ? (region.industryTagsJson as any[]) : [];
    return {
      code: region.code,
      name: region.name,
      level: region.level,
      parentCode: region.parentCode ?? null,
      centerLat: region.centerLat ?? null,
      centerLng: region.centerLng ?? null,
      industryTags: industryTags.filter((t) => typeof t === 'string'),
      updatedAt: region.updatedAt.toISOString(),
    };
  }

  private assertRegionCode(code: string, fieldName: string) {
    if (!REGION_CODE_RE.test(code)) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} 必须为 6 位数字字符串` });
    }
  }

  private assertRegionLevel(level: string, fieldName: string) {
    if (!REGION_LEVELS.has(level)) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: `${fieldName} 必须为 PROVINCE/CITY/DISTRICT 之一`,
      });
    }
  }

  async listRegions(params: { level?: string; parentCode?: string | null; q?: string }): Promise<RegionNodeDto[]> {
    const where: Prisma.RegionWhereInput = {};

    if (params.level) {
      this.assertRegionLevel(params.level, 'level');
      where.level = params.level as any;
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
    return regions.map((r) => this.toRegionNode(r));
  }

  async createRegion(input: RegionCreateRequestDto): Promise<RegionNodeDto> {
    this.assertRegionCode(input.code, 'code');
    if (!input.name || !String(input.name).trim()) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'name 不能为空' });
    }
    if (!input.level) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'level 不能为空' });
    }
    this.assertRegionLevel(input.level, 'level');

    if (input.parentCode) this.assertRegionCode(input.parentCode, 'parentCode');

    try {
      const region = await this.prisma.region.create({
        data: {
          code: input.code,
          name: String(input.name).trim(),
          level: input.level as any,
          parentCode: input.parentCode ?? null,
          centerLat: input.centerLat ?? null,
          centerLng: input.centerLng ?? null,
          industryTagsJson: [],
        },
      });
      return this.toRegionNode(region);
    } catch (err: any) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException({ code: 'CONFLICT', message: '区域 code 已存在' });
      }
      throw err;
    }
  }

  async updateRegion(code: string, patch: RegionUpdateRequestDto): Promise<RegionNodeDto> {
    this.assertRegionCode(code, 'regionCode');

    if (patch.level) this.assertRegionLevel(patch.level, 'level');
    if (patch.parentCode) this.assertRegionCode(patch.parentCode, 'parentCode');
    if (patch.name !== undefined && !String(patch.name).trim()) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'name 不能为空' });
    }

    try {
      const region = await this.prisma.region.update({
        where: { code },
        data: {
          name: patch.name !== undefined ? String(patch.name).trim() : undefined,
          level: patch.level !== undefined ? (patch.level as any) : undefined,
          parentCode: patch.parentCode === undefined ? undefined : patch.parentCode ?? null,
          centerLat: patch.centerLat === undefined ? undefined : patch.centerLat ?? null,
          centerLng: patch.centerLng === undefined ? undefined : patch.centerLng ?? null,
        },
      });
      return this.toRegionNode(region);
    } catch (err: any) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new NotFoundException({ code: 'NOT_FOUND', message: '区域不存在' });
      }
      throw err;
    }
  }

  async setRegionIndustryTags(code: string, tags: string[]): Promise<RegionNodeDto> {
    this.assertRegionCode(code, 'regionCode');
    if (!Array.isArray(tags)) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'industryTags 必须为数组' });
    }

    const normalized = tags.map((t) => String(t).trim()).filter((t) => t.length > 0);

    try {
      const region = await this.prisma.region.update({
        where: { code },
        data: { industryTagsJson: normalized },
      });
      return this.toRegionNode(region);
    } catch (err: any) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new NotFoundException({ code: 'NOT_FOUND', message: '区域不存在' });
      }
      throw err;
    }
  }

  async listIndustryTags(): Promise<IndustryTag[]> {
    return this.prisma.industryTag.findMany({ orderBy: { name: 'asc' } });
  }

  async createIndustryTag(name: string): Promise<IndustryTag> {
    const trimmed = String(name || '').trim();
    if (!trimmed) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'name 不能为空' });
    }
    if (trimmed.length > 50) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'name 过长' });
    }

    try {
      return await this.prisma.industryTag.create({ data: { name: trimmed } });
    } catch (err: any) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException({ code: 'CONFLICT', message: '标签已存在' });
      }
      throw err;
    }
  }
}
