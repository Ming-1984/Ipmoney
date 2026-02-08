import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

type InputJsonValue = any;

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
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'regionCode must be 6 digits' });
    }
  }

  private assertRegionLevel(level: string) {
    if (!REGION_LEVELS.has(level)) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'level must be PROVINCE/CITY/DISTRICT' });
    }
  }

  private asIndustryBreakdown(value: unknown): PatentMapIndustryCountDto[] {
    if (!Array.isArray(value)) return [];
    return value
      .map((rawItem: any) => {
        if (!rawItem || typeof rawItem !== 'object') return null;
        const rawObject = rawItem as any;
        const industryTag = String(rawObject.industryTag ?? '').trim();
        const count = Number(rawObject.count ?? 0);
        if (!industryTag || !Number.isFinite(count) || count < 0) return null;
        return { industryTag, count };
      })
      .filter(Boolean) as PatentMapIndustryCountDto[];
  }

  private asTopAssignees(value: unknown): PatentMapTopAssigneeDto[] {
    if (!Array.isArray(value)) return [];
    return value
      .map((rawItem: any) => {
        if (!rawItem || typeof rawItem !== 'object') return null;
        const rawObject = rawItem as any;
        const assigneeName = String(rawObject.assigneeName ?? '').trim();
        const patentCount = Number(rawObject.patentCount ?? 0);
        if (!assigneeName || !Number.isFinite(patentCount) || patentCount < 0) return null;
        return { assigneeName, patentCount };
      })
      .filter(Boolean) as PatentMapTopAssigneeDto[];
  }

  private toEntryDto(entryRow: any): PatentMapEntryDto {
    const industryBreakdown = this.asIndustryBreakdown(entryRow.industryBreakdownJson);
    const topAssignees = this.asTopAssignees(entryRow.topAssigneesJson);
    return {
      regionCode: entryRow.regionCode,
      year: entryRow.year,
      patentCount: entryRow.patentCount,
      industryBreakdown,
      topAssignees,
      createdAt: entryRow.createdAt.toISOString(),
      updatedAt: entryRow.updatedAt.toISOString(),
    };
  }

  async listYears(): Promise<number[]> {
    const rows = await this.prisma.patentMapEntry.findMany({
      distinct: ['year'],
      select: { year: true },
    });
    return rows
      .map((row: any) => row.year)
      .filter((year: any) => Number.isFinite(year))
      .sort((leftYear: number, rightYear: number) => leftYear - rightYear);
  }

  async getSummary(params: { year: number; level: string; parentCode?: string }): Promise<PatentMapSummaryItemDto[]> {
    if (!Number.isFinite(params.year)) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'year is required and must be an integer' });
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

    const codes = regions.map((region: any) => region.code);
    const entries = codes.length
      ? await this.prisma.patentMapEntry.findMany({
          where: { year: params.year, regionCode: { in: codes } },
        })
      : [];
    const entryCountByRegionCode = new Map(entries.map((entry: any) => [entry.regionCode, entry.patentCount]));

    return regions.map((region: any) => ({
      regionCode: region.code,
      regionName: region.name,
      patentCount: entryCountByRegionCode.get(region.code) ?? 0,
    }));
  }

  async getRegionDetail(regionCode: string, year: number): Promise<PatentMapRegionDetailDto> {
    this.assertRegionCode(regionCode);
    if (!Number.isFinite(year)) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'year is required and must be an integer' });
    }

    const region = await this.prisma.region.findUnique({ where: { code: regionCode } });
    if (!region) throw new NotFoundException({ code: 'NOT_FOUND', message: 'region not found' });

    const entry = await this.prisma.patentMapEntry.findUnique({
      where: { regionCode_year: { regionCode, year } },
    });
    if (!entry) throw new NotFoundException({ code: 'NOT_FOUND', message: 'no data for this region/year' });

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
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'year is required and must be an integer' });
    }

    const entry = await this.prisma.patentMapEntry.findUnique({
      where: { regionCode_year: { regionCode, year } },
    });
    if (!entry) throw new NotFoundException({ code: 'NOT_FOUND', message: 'patent map entry not found' });
    return this.toEntryDto(entry);
  }

  async adminUpsertEntry(
    regionCode: string,
    year: number,
    body: PatentMapEntryUpsertRequestDto,
  ): Promise<PatentMapEntryDto> {
    this.assertRegionCode(regionCode);
    if (!Number.isFinite(year)) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'year is required and must be an integer' });
    }
    if (!body || !Number.isFinite(body.patentCount) || body.patentCount < 0) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'patentCount must be >= 0' });
    }

    const region = await this.prisma.region.findUnique({ where: { code: regionCode } });
    if (!region) throw new NotFoundException({ code: 'NOT_FOUND', message: 'region not found' });

    const industryBreakdown = Array.isArray(body.industryBreakdown) ? body.industryBreakdown : [];
    const topAssignees = Array.isArray(body.topAssignees) ? body.topAssignees : [];

    const entry = await this.prisma.patentMapEntry.upsert({
      where: { regionCode_year: { regionCode, year } },
      create: {
        regionCode,
        year,
        patentCount: body.patentCount,
        industryBreakdownJson: industryBreakdown as InputJsonValue,
        topAssigneesJson: topAssignees as InputJsonValue,
      },
      update: {
        patentCount: body.patentCount,
        industryBreakdownJson: industryBreakdown as InputJsonValue,
        topAssigneesJson: topAssignees as InputJsonValue,
      },
    });

    return this.toEntryDto(entry);
  }
}
