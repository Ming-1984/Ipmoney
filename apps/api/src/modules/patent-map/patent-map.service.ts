import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';

const REGION_CODE_RE = /^[0-9]{6}$/;
const REGION_LEVELS = new Set(['PROVINCE', 'CITY', 'DISTRICT']);

export type PatentMapSummaryItemDto = { regionCode: string; regionName: string; patentCount: number };

export type PatentMapIndustryCountDto = { industryTag: string; count: number };
export type PatentMapTopAssigneeDto = { assigneeName: string; patentCount: number };

export type PatentMapRegionDetailDto = {
  regionCode: string;
  regionName: string;
  year: number;
  patentCount: number;
  industryBreakdown: PatentMapIndustryCountDto[];
  topAssignees: PatentMapTopAssigneeDto[];
  updatedAt?: string;
};

export type PatentMapEntryDto = {
  regionCode: string;
  year: number;
  patentCount: number;
  industryBreakdown: PatentMapIndustryCountDto[];
  topAssignees: PatentMapTopAssigneeDto[];
  createdAt: string;
  updatedAt: string;
};

export type PatentMapEntryUpsertRequestDto = {
  patentCount: number;
  industryBreakdown?: PatentMapIndustryCountDto[];
  topAssignees?: PatentMapTopAssigneeDto[];
};

@Injectable()
export class PatentMapService {
  constructor(private readonly prisma: PrismaService) {}

  private assertRegionCode(code: string) {
    if (!REGION_CODE_RE.test(code)) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'regionCode 必须为 6 位数字字符串' });
    }
  }

  private assertRegionLevel(level: string) {
    if (!REGION_LEVELS.has(level)) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'level 必须为 PROVINCE/CITY/DISTRICT 之一' });
    }
  }

  private asIndustryBreakdown(value: unknown): PatentMapIndustryCountDto[] {
    if (!Array.isArray(value)) return [];
    return value
      .map((it) => {
        if (!it || typeof it !== 'object') return null;
        const obj = it as any;
        const industryTag = String(obj.industryTag ?? '').trim();
        const count = Number(obj.count ?? 0);
        if (!industryTag || !Number.isFinite(count) || count < 0) return null;
        return { industryTag, count };
      })
      .filter(Boolean) as PatentMapIndustryCountDto[];
  }

  private asTopAssignees(value: unknown): PatentMapTopAssigneeDto[] {
    if (!Array.isArray(value)) return [];
    return value
      .map((it) => {
        if (!it || typeof it !== 'object') return null;
        const obj = it as any;
        const assigneeName = String(obj.assigneeName ?? '').trim();
        const patentCount = Number(obj.patentCount ?? 0);
        if (!assigneeName || !Number.isFinite(patentCount) || patentCount < 0) return null;
        return { assigneeName, patentCount };
      })
      .filter(Boolean) as PatentMapTopAssigneeDto[];
  }

  private toEntryDto(row: any): PatentMapEntryDto {
    const industryBreakdown = this.asIndustryBreakdown(row.industryBreakdownJson);
    const topAssignees = this.asTopAssignees(row.topAssigneesJson);
    return {
      regionCode: row.regionCode,
      year: row.year,
      patentCount: row.patentCount,
      industryBreakdown,
      topAssignees,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async listYears(): Promise<number[]> {
    const rows = await this.prisma.patentMapEntry.findMany({
      distinct: ['year'],
      select: { year: true },
    });
    return rows
      .map((r) => r.year)
      .filter((y) => Number.isFinite(y))
      .sort((a, b) => a - b);
  }

  async getSummary(params: { year: number; level: string; parentCode?: string }): Promise<PatentMapSummaryItemDto[]> {
    if (!Number.isFinite(params.year)) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'year 必填且为整数' });
    }
    this.assertRegionLevel(params.level);
    if (params.parentCode) this.assertRegionCode(params.parentCode);

    const regions = await this.prisma.region.findMany({
      where: {
        level: params.level as any,
        ...(params.parentCode ? { parentCode: params.parentCode } : {}),
      },
      orderBy: { code: 'asc' },
    });

    const codes = regions.map((r) => r.code);
    const entries = codes.length
      ? await this.prisma.patentMapEntry.findMany({
          where: { year: params.year, regionCode: { in: codes } },
        })
      : [];
    const map = new Map(entries.map((e) => [e.regionCode, e.patentCount]));

    return regions.map((r) => ({
      regionCode: r.code,
      regionName: r.name,
      patentCount: map.get(r.code) ?? 0,
    }));
  }

  async getRegionDetail(regionCode: string, year: number): Promise<PatentMapRegionDetailDto> {
    this.assertRegionCode(regionCode);
    if (!Number.isFinite(year)) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'year 必填且为整数' });
    }

    const region = await this.prisma.region.findUnique({ where: { code: regionCode } });
    if (!region) throw new NotFoundException({ code: 'NOT_FOUND', message: '区域不存在' });

    const entry = await this.prisma.patentMapEntry.findUnique({
      where: { regionCode_year: { regionCode, year } },
    });
    if (!entry) throw new NotFoundException({ code: 'NOT_FOUND', message: '该区域该年份暂无数据' });

    const industryBreakdown = this.asIndustryBreakdown(entry.industryBreakdownJson);
    const topAssignees = this.asTopAssignees(entry.topAssigneesJson);

    return {
      regionCode,
      regionName: region.name,
      year,
      patentCount: entry.patentCount,
      industryBreakdown,
      topAssignees,
      updatedAt: entry.updatedAt.toISOString(),
    };
  }

  async adminGetEntry(regionCode: string, year: number): Promise<PatentMapEntryDto> {
    this.assertRegionCode(regionCode);
    if (!Number.isFinite(year)) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'year 必填且为整数' });
    }

    const entry = await this.prisma.patentMapEntry.findUnique({
      where: { regionCode_year: { regionCode, year } },
    });
    if (!entry) throw new NotFoundException({ code: 'NOT_FOUND', message: '未找到地图数据' });
    return this.toEntryDto(entry);
  }

  async adminUpsertEntry(
    regionCode: string,
    year: number,
    body: PatentMapEntryUpsertRequestDto,
  ): Promise<PatentMapEntryDto> {
    this.assertRegionCode(regionCode);
    if (!Number.isFinite(year)) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'year 必填且为整数' });
    }
    if (!body || !Number.isFinite(body.patentCount) || body.patentCount < 0) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'patentCount 必填且 >= 0' });
    }

    const region = await this.prisma.region.findUnique({ where: { code: regionCode } });
    if (!region) throw new NotFoundException({ code: 'NOT_FOUND', message: '区域不存在' });

    const industryBreakdown = Array.isArray(body.industryBreakdown) ? body.industryBreakdown : [];
    const topAssignees = Array.isArray(body.topAssignees) ? body.topAssignees : [];

    const entry = await this.prisma.patentMapEntry.upsert({
      where: { regionCode_year: { regionCode, year } },
      create: {
        regionCode,
        year,
        patentCount: body.patentCount,
        industryBreakdownJson: industryBreakdown as Prisma.InputJsonValue,
        topAssigneesJson: topAssignees as Prisma.InputJsonValue,
      },
      update: {
        patentCount: body.patentCount,
        industryBreakdownJson: industryBreakdown as Prisma.InputJsonValue,
        topAssigneesJson: topAssignees as Prisma.InputJsonValue,
      },
    });

    return this.toEntryDto(entry);
  }
}
