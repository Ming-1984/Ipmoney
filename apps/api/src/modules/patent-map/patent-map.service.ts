import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as XLSX from 'xlsx';

import { PrismaService } from '../../common/prisma/prisma.service';

type InputJsonValue = any;

const REGION_CODE_RE = /^[0-9]{6}$/;
const REGION_LEVELS = new Set(['PROVINCE', 'CITY', 'DISTRICT']);
const HEADER_ALIASES = {
  regionCode: [
    'regionCode',
    'region_code',
    'region',
    'areaCode',
    'area_code',
    '\u533A\u57DF\u7F16\u7801',
    '\u5730\u533A\u7F16\u7801',
  ],
  year: ['year', '\u5E74\u4EFD', '\u5E74\u5EA6'],
  patentCount: [
    'patentCount',
    'patent_count',
    'count',
    'patentTotal',
    '\u4E13\u5229\u6570\u91CF',
    '\u4E13\u5229\u603B\u91CF',
  ],
  industryBreakdown: [
    'industryBreakdown',
    'industry_breakdown',
    'industry',
    'industryTags',
    '\u4EA7\u4E1A\u5206\u5E03',
    '\u4EA7\u4E1A\u6807\u7B7E',
  ],
  topAssignees: [
    'topAssignees',
    'top_assignees',
    'topAssignee',
    'topCompanies',
    '\u91CD\u70B9\u4F01\u4E1A',
    '\u91CD\u70B9\u673A\u6784',
  ],
};

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

export type PatentMapImportErrorDto = { rowNumber: number; message: string };
export type PatentMapImportResultDto = {
  dryRun: boolean;
  importedCount: number;
  updatedCount: number;
  errors: PatentMapImportErrorDto[];
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

  private normalizeHeader(value: string) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, '');
  }

  private buildRowLookup(row: Record<string, any>) {
    const map = new Map<string, any>();
    for (const key of Object.keys(row || {})) {
      map.set(this.normalizeHeader(key), (row as any)[key]);
    }
    return map;
  }

  private getRowValue(rowLookup: Map<string, any>, aliases: string[]) {
    for (const alias of aliases) {
      const key = this.normalizeHeader(alias);
      if (rowLookup.has(key)) return rowLookup.get(key);
    }
    return undefined;
  }

  private parseRegionCodeValue(value: unknown) {
    if (value === undefined || value === null) return '';
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(Math.trunc(value)).padStart(6, '0');
    }
    return String(value).trim();
  }

  private parseYearValue(value: unknown) {
    if (value instanceof Date) return value.getFullYear();
    const num = Number(value);
    if (!Number.isFinite(num)) return null;
    return Math.trunc(num);
  }

  private parseNonNegativeInt(value: unknown) {
    const num = Number(value);
    if (!Number.isFinite(num) || num < 0) return null;
    return Math.trunc(num);
  }

  private parseKeyCountList(
    value: unknown,
    keyField: 'industryTag' | 'assigneeName',
    countField: 'count' | 'patentCount',
  ): { items: Array<Record<string, string | number>>; error?: string } {
    if (value === undefined || value === null || value === '') return { items: [] };
    if (Array.isArray(value)) {
      const items: Array<Record<string, string | number>> = [];
      for (const raw of value) {
        if (!raw || typeof raw !== 'object') {
          return { items: [], error: 'invalid list item' };
        }
        const key = String((raw as any)[keyField] ?? '').trim();
        const count = this.parseNonNegativeInt((raw as any)[countField]);
        if (!key || count === null) {
          return { items: [], error: 'invalid list item' };
        }
        items.push({ [keyField]: key, [countField]: count });
      }
      return { items };
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return { items: [] };
      if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
        try {
          const parsed = JSON.parse(trimmed);
          return this.parseKeyCountList(Array.isArray(parsed) ? parsed : [parsed], keyField, countField);
        } catch {
          return { items: [], error: 'invalid JSON list' };
        }
      }
      const items: Array<Record<string, string | number>> = [];
      const parts = trimmed.split(/[;,，；]+/g).map((part) => part.trim()).filter(Boolean);
      for (const part of parts) {
        const [rawKey, rawCount] = part.split(/[:\uFF1A]/g).map((segment) => segment.trim());
        const count = this.parseNonNegativeInt(rawCount);
        if (!rawKey || count === null) {
          return { items: [], error: 'invalid list item' };
        }
        items.push({ [keyField]: rawKey, [countField]: count });
      }
      return { items };
    }
    return { items: [], error: 'invalid list format' };
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

  async adminImportExcel(file: { buffer?: Buffer } | undefined, dryRun = false): Promise<PatentMapImportResultDto> {
    if (!file?.buffer) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'file is required' });
    }

    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(file.buffer, { type: 'buffer' });
    } catch {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'invalid excel file' });
    }

    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return { dryRun, importedCount: 0, updatedCount: 0, errors: [] };
    }

    const sheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });
    if (!rawRows.length) {
      return { dryRun, importedCount: 0, updatedCount: 0, errors: [] };
    }

    type ParsedRow = {
      rowNumber: number;
      regionCode: string;
      year: number;
      patentCount: number;
      industryBreakdown: PatentMapIndustryCountDto[];
      topAssignees: PatentMapTopAssigneeDto[];
    };

    const errors: PatentMapImportErrorDto[] = [];
    const parsedRows: ParsedRow[] = [];
    const seenKeys = new Set<string>();

    rawRows.forEach((row: Record<string, any>, index: number) => {
      const rowNumber = index + 2;
      const rowLookup = this.buildRowLookup(row);
      const rowErrors: string[] = [];

      const regionCode = this.parseRegionCodeValue(this.getRowValue(rowLookup, HEADER_ALIASES.regionCode));
      const year = this.parseYearValue(this.getRowValue(rowLookup, HEADER_ALIASES.year));
      const patentCount = this.parseNonNegativeInt(this.getRowValue(rowLookup, HEADER_ALIASES.patentCount));

      if (!regionCode) rowErrors.push('regionCode is required');
      if (regionCode && !REGION_CODE_RE.test(regionCode)) rowErrors.push('regionCode must be 6 digits');
      if (year === null) rowErrors.push('year is required and must be an integer');
      if (patentCount === null) rowErrors.push('patentCount must be >= 0');

      const breakdownValue = this.getRowValue(rowLookup, HEADER_ALIASES.industryBreakdown);
      const breakdownResult = this.parseKeyCountList(breakdownValue, 'industryTag', 'count');
      if (breakdownResult.error) rowErrors.push(`industryBreakdown ${breakdownResult.error}`);

      const assigneeValue = this.getRowValue(rowLookup, HEADER_ALIASES.topAssignees);
      const assigneeResult = this.parseKeyCountList(assigneeValue, 'assigneeName', 'patentCount');
      if (assigneeResult.error) rowErrors.push(`topAssignees ${assigneeResult.error}`);

      if (!rowErrors.length && regionCode && year !== null) {
        const key = `${regionCode}:${year}`;
        if (seenKeys.has(key)) rowErrors.push('duplicate regionCode/year in file');
        else seenKeys.add(key);
      }

      if (rowErrors.length) {
        errors.push({ rowNumber, message: rowErrors.join('; ') });
        return;
      }

      parsedRows.push({
        rowNumber,
        regionCode,
        year: year as number,
        patentCount: patentCount as number,
        industryBreakdown: (breakdownResult.items as PatentMapIndustryCountDto[]) ?? [],
        topAssignees: (assigneeResult.items as PatentMapTopAssigneeDto[]) ?? [],
      });
    });

    if (!parsedRows.length) {
      return { dryRun, importedCount: 0, updatedCount: 0, errors };
    }

    const regionCodes = Array.from(new Set(parsedRows.map((row) => row.regionCode)));
    const regions = await this.prisma.region.findMany({
      where: { code: { in: regionCodes } },
      select: { code: true },
    });
    const regionSet = new Set(regions.map((region: any) => region.code));

    const validRows: ParsedRow[] = [];
    for (const row of parsedRows) {
      if (!regionSet.has(row.regionCode)) {
        errors.push({ rowNumber: row.rowNumber, message: 'region not found' });
        continue;
      }
      validRows.push(row);
    }

    if (!validRows.length) {
      return { dryRun, importedCount: 0, updatedCount: 0, errors };
    }

    const existingRows = await this.prisma.patentMapEntry.findMany({
      where: {
        OR: validRows.map((row) => ({ regionCode: row.regionCode, year: row.year })),
      },
      select: { regionCode: true, year: true },
    });
    const existingSet = new Set(existingRows.map((row: any) => `${row.regionCode}:${row.year}`));

    let importedCount = 0;
    let updatedCount = 0;
    for (const row of validRows) {
      if (existingSet.has(`${row.regionCode}:${row.year}`)) updatedCount += 1;
      else importedCount += 1;
    }

    if (!dryRun) {
      await this.prisma.$transaction(
        validRows.map((row) =>
          this.prisma.patentMapEntry.upsert({
            where: { regionCode_year: { regionCode: row.regionCode, year: row.year } },
            create: {
              regionCode: row.regionCode,
              year: row.year,
              patentCount: row.patentCount,
              industryBreakdownJson: row.industryBreakdown as InputJsonValue,
              topAssigneesJson: row.topAssignees as InputJsonValue,
            },
            update: {
              patentCount: row.patentCount,
              industryBreakdownJson: row.industryBreakdown as InputJsonValue,
              topAssigneesJson: row.topAssignees as InputJsonValue,
            },
          }),
        ),
      );
    }

    return { dryRun, importedCount, updatedCount, errors };
  }
}
