import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import { AuditLogService } from '../../common/audit-log.service';
import { PrismaService } from '../../common/prisma/prisma.service';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REGION_CODE_RE = /^[0-9]{6}$/;

type RegionLevel = 'PROVINCE' | 'CITY' | 'DISTRICT';
type FeaturedLevel = 'NONE' | 'CITY' | 'PROVINCE';

type RegionRecord = {
  code: string;
  name: string;
  level: RegionLevel;
  parentCode: string | null;
  centerLat: number | null;
  centerLng: number | null;
};

type OverviewListingRow = {
  id: string;
  patentId: string | null;
  regionCode: string | null;
  featuredLevel: FeaturedLevel;
  featuredRank: number | null;
  featuredUntil: Date | null;
};

type RegionAggregate = {
  regionCode: string;
  regionName: string;
  regionLevel: RegionLevel | 'UNKNOWN';
  centerLat: number | null;
  centerLng: number | null;
  listingCount: number;
  patentIds: Set<string>;
  rankedListingCount: number;
  activeRankedListingCount: number;
  topActiveRank: number | null;
};

type PatentMapOverviewRegionDto = {
  regionCode: string;
  regionName: string;
  regionLevel: RegionLevel | 'UNKNOWN';
  centerLat: number | null;
  centerLng: number | null;
  listingCount: number;
  patentCount: number;
  rankedListingCount: number;
  activeRankedListingCount: number;
  topActiveRank: number | null;
  rankPosition: number;
};

type PatentMapRegionDetailItemDto = {
  listingId: string;
  patentId: string | null;
  title: string;
  patentTitle: string;
  patentType: 'INVENTION' | 'UTILITY_MODEL' | 'DESIGN' | null;
  applicationNoDisplay: string | null;
  regionCode: string | null;
  tradeMode: 'ASSIGNMENT' | 'LICENSE';
  priceType: 'FIXED' | 'NEGOTIABLE';
  priceAmountFen: number | null;
  depositAmountFen: number;
  featuredLevel: FeaturedLevel;
  featuredRegionCode: string | null;
  featuredRank: number | null;
  featuredUntil: string | null;
  isFeaturedActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type BatchPatchParseResult = {
  data: Record<string, any>;
  patchApplied: Record<string, any>;
  referencedRegionCodes: string[];
};

@Injectable()
export class PatentMapService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  ensureAdmin(req: any) {
    if (!req?.auth?.isAdmin) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'forbidden' });
    }
  }

  private hasOwn(input: unknown, key: string) {
    return input !== null && input !== undefined && Object.prototype.hasOwnProperty.call(input, key);
  }

  private parseUuidStrict(value: unknown, fieldName: string): string {
    const raw = String(value ?? '').trim();
    if (!raw || !UUID_RE.test(raw)) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return raw;
  }

  private parseUuidArrayStrict(value: unknown, fieldName: string, opts?: { min?: number; max?: number }): string[] {
    const list = Array.isArray(value) ? value : [];
    const out: string[] = [];
    const seen = new Set<string>();
    for (const item of list) {
      const id = this.parseUuidStrict(item, fieldName);
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
    const min = opts?.min ?? 0;
    const max = opts?.max ?? 1000;
    if (out.length < min || out.length > max) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return out;
  }

  private parsePositiveIntStrict(value: unknown, fieldName: string): number {
    const raw = String(value ?? '').trim();
    if (!raw) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    const parsed = Number(raw);
    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return parsed;
  }

  private parseNonNegativeIntStrict(value: unknown, fieldName: string): number {
    const raw = String(value ?? '').trim();
    if (!raw) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    const parsed = Number(raw);
    if (!Number.isSafeInteger(parsed) || parsed < 0) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return parsed;
  }

  private parseNullableNonNegativeInt(value: unknown, fieldName: string): number | null {
    if (value === null) return null;
    const raw = String(value ?? '').trim();
    if (!raw) return null;
    return this.parseNonNegativeIntStrict(raw, fieldName);
  }

  private parseRegionCodeStrict(value: unknown, fieldName: string): string {
    const raw = String(value ?? '').trim();
    if (!raw || !REGION_CODE_RE.test(raw)) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return raw;
  }

  private parseNullableRegionCode(value: unknown, fieldName: string): string | null {
    if (value === null) return null;
    const raw = String(value ?? '').trim();
    if (!raw) return null;
    return this.parseRegionCodeStrict(raw, fieldName);
  }

  private parseRegionLevelStrict(value: unknown, fieldName: string): RegionLevel {
    const normalized = String(value ?? '').trim().toUpperCase();
    if (normalized === 'PROVINCE' || normalized === 'CITY' || normalized === 'DISTRICT') {
      return normalized;
    }
    throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
  }

  private parseFeaturedLevelStrict(value: unknown, fieldName: string): FeaturedLevel {
    const normalized = String(value ?? '').trim().toUpperCase();
    if (normalized === 'NONE' || normalized === 'CITY' || normalized === 'PROVINCE') {
      return normalized;
    }
    throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
  }

  private parseNullableDateTime(value: unknown, fieldName: string): Date | null {
    if (value === null) return null;
    const raw = String(value ?? '').trim();
    if (!raw) return null;
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return parsed;
  }

  private parseBooleanStrict(value: unknown, fieldName: string): boolean {
    if (value === true || value === false) return value;
    const raw = String(value ?? '').trim().toLowerCase();
    if (raw === 'true' || raw === '1') return true;
    if (raw === 'false' || raw === '0') return false;
    throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
  }

  private parseOptionalReason(value: unknown): string | null {
    if (value === undefined || value === null) return null;
    const raw = String(value).trim();
    if (!raw) return null;
    if (raw.length > 500) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'reason is invalid' });
    }
    return raw;
  }

  private inferRegionCodeByLevel(code: string, targetLevel: RegionLevel): string {
    if (targetLevel === 'PROVINCE') return `${code.slice(0, 2)}0000`;
    if (targetLevel === 'CITY') return `${code.slice(0, 4)}00`;
    return code;
  }

  private resolveRegionCodeByLevel(
    regionCode: string | null,
    targetLevel: RegionLevel,
    regionMap: Map<string, RegionRecord>,
  ): string | null {
    const raw = String(regionCode || '').trim();
    if (!raw || !REGION_CODE_RE.test(raw)) return null;

    let cursor = regionMap.get(raw) || null;
    const visited = new Set<string>();
    while (cursor) {
      if (cursor.level === targetLevel) return cursor.code;
      const parentCode = String(cursor.parentCode || '').trim();
      if (!parentCode || visited.has(parentCode)) break;
      visited.add(parentCode);
      cursor = regionMap.get(parentCode) || null;
    }

    const inferred = this.inferRegionCodeByLevel(raw, targetLevel);
    if (regionMap.has(inferred)) return inferred;
    if (regionMap.has(raw)) return raw;
    return inferred;
  }

  private buildChildrenMap(regions: RegionRecord[]): Map<string, string[]> {
    const out = new Map<string, string[]>();
    for (const region of regions) {
      const parentCode = String(region.parentCode || '').trim();
      if (!parentCode) continue;
      const children = out.get(parentCode) || [];
      children.push(region.code);
      out.set(parentCode, children);
    }
    return out;
  }

  private collectDescendantCodes(rootCode: string, childrenMap: Map<string, string[]>): string[] {
    const out: string[] = [];
    const queue: string[] = [rootCode];
    const visited = new Set<string>();
    while (queue.length > 0) {
      const current = queue.shift() as string;
      if (!current || visited.has(current)) continue;
      visited.add(current);
      out.push(current);
      const children = childrenMap.get(current) || [];
      for (const child of children) queue.push(child);
    }
    return out;
  }

  private isFeaturedActive(input: { featuredLevel: FeaturedLevel; featuredUntil: Date | null }, now: Date): boolean {
    if (input.featuredLevel === 'NONE') return false;
    if (!input.featuredUntil) return true;
    return input.featuredUntil.getTime() >= now.getTime();
  }

  private sortRegionRankings(a: PatentMapOverviewRegionDto, b: PatentMapOverviewRegionDto): number {
    if (b.activeRankedListingCount !== a.activeRankedListingCount) {
      return b.activeRankedListingCount - a.activeRankedListingCount;
    }
    if (b.rankedListingCount !== a.rankedListingCount) {
      return b.rankedListingCount - a.rankedListingCount;
    }
    if (b.patentCount !== a.patentCount) {
      return b.patentCount - a.patentCount;
    }
    if (b.listingCount !== a.listingCount) {
      return b.listingCount - a.listingCount;
    }
    const aRank = a.topActiveRank;
    const bRank = b.topActiveRank;
    if (aRank === null && bRank !== null) return 1;
    if (aRank !== null && bRank === null) return -1;
    if (aRank !== null && bRank !== null && aRank !== bRank) return aRank - bRank;
    return a.regionCode.localeCompare(b.regionCode);
  }

  async getOverview(query: any) {
    const regionLevel = this.hasOwn(query, 'regionLevel')
      ? this.parseRegionLevelStrict(query?.regionLevel, 'regionLevel')
      : 'PROVINCE';
    const topInput = this.hasOwn(query, 'top') ? this.parsePositiveIntStrict(query?.top, 'top') : 10;
    const top = Math.min(100, topInput);

    const [regions, listings] = await Promise.all([
      this.prisma.region.findMany({
        select: {
          code: true,
          name: true,
          level: true,
          parentCode: true,
          centerLat: true,
          centerLng: true,
        },
      }),
      this.prisma.listing.findMany({
        where: { auditStatus: 'APPROVED', status: 'ACTIVE' },
        select: {
          id: true,
          patentId: true,
          regionCode: true,
          featuredLevel: true,
          featuredRank: true,
          featuredUntil: true,
        },
      }),
    ]);

    const regionMap = new Map<string, RegionRecord>(
      regions.map((region) => [
        region.code,
        {
          code: region.code,
          name: region.name,
          level: region.level,
          parentCode: region.parentCode ?? null,
          centerLat: region.centerLat ?? null,
          centerLng: region.centerLng ?? null,
        },
      ]),
    );

    const targetRegions = Array.from(regionMap.values()).filter((region) => region.level === regionLevel);

    const now = new Date();
    const totalPatentIds = new Set<string>();
    const aggregates = new Map<string, RegionAggregate>(
      targetRegions.map((region) => [
        region.code,
        {
          regionCode: region.code,
          regionName: region.name,
          regionLevel: region.level,
          centerLat: region.centerLat ?? null,
          centerLng: region.centerLng ?? null,
          listingCount: 0,
          patentIds: new Set<string>(),
          rankedListingCount: 0,
          activeRankedListingCount: 0,
          topActiveRank: null,
        },
      ]),
    );
    let rankedListingCount = 0;
    let activeRankedListingCount = 0;
    let unassignedListingCount = 0;

    for (const listing of listings as OverviewListingRow[]) {
      const patentId = String(listing.patentId || '').trim();
      if (patentId) totalPatentIds.add(patentId);

      const resolvedRegionCode = this.resolveRegionCodeByLevel(listing.regionCode, regionLevel, regionMap);
      if (!resolvedRegionCode) {
        unassignedListingCount += 1;
        continue;
      }

      let aggregate = aggregates.get(resolvedRegionCode);
      if (!aggregate) {
        const region = regionMap.get(resolvedRegionCode);
        aggregate = {
          regionCode: resolvedRegionCode,
          regionName: region?.name || resolvedRegionCode,
          regionLevel: region?.level || 'UNKNOWN',
          centerLat: region?.centerLat ?? null,
          centerLng: region?.centerLng ?? null,
          listingCount: 0,
          patentIds: new Set<string>(),
          rankedListingCount: 0,
          activeRankedListingCount: 0,
          topActiveRank: null,
        };
        aggregates.set(resolvedRegionCode, aggregate);
      }

      aggregate.listingCount += 1;
      if (patentId) aggregate.patentIds.add(patentId);

      if (listing.featuredLevel !== 'NONE') {
        aggregate.rankedListingCount += 1;
        rankedListingCount += 1;
      }
      const isActive = this.isFeaturedActive(listing, now);
      if (isActive) {
        aggregate.activeRankedListingCount += 1;
        activeRankedListingCount += 1;
        if (listing.featuredRank !== null && listing.featuredRank !== undefined) {
          if (aggregate.topActiveRank === null || listing.featuredRank < aggregate.topActiveRank) {
            aggregate.topActiveRank = listing.featuredRank;
          }
        }
      }
    }

    const rankedRegions = Array.from(aggregates.values()).map((aggregate) => ({
      regionCode: aggregate.regionCode,
      regionName: aggregate.regionName,
      regionLevel: aggregate.regionLevel,
      centerLat: aggregate.centerLat,
      centerLng: aggregate.centerLng,
      listingCount: aggregate.listingCount,
      patentCount: aggregate.patentIds.size,
      rankedListingCount: aggregate.rankedListingCount,
      activeRankedListingCount: aggregate.activeRankedListingCount,
      topActiveRank: aggregate.topActiveRank,
      rankPosition: 0,
    }));

    rankedRegions.sort((a, b) => this.sortRegionRankings(a, b));
    rankedRegions.forEach((item, index) => {
      item.rankPosition = index + 1;
    });

    return {
      generatedAt: new Date().toISOString(),
      filters: { regionLevel, top },
      summary: {
        totalListingCount: listings.length,
        totalPatentCount: totalPatentIds.size,
        totalRegionCount: rankedRegions.length,
        rankedListingCount,
        activeRankedListingCount,
        unassignedListingCount,
        mappableRegionCount: rankedRegions.filter((item) => item.centerLat !== null && item.centerLng !== null).length,
      },
      ranking: rankedRegions.slice(0, top),
      regions: rankedRegions,
    };
  }

  async getRegionDetails(regionCode: string, query: any) {
    const page = this.hasOwn(query, 'page') ? this.parsePositiveIntStrict(query?.page, 'page') : 1;
    const pageSizeInput = this.hasOwn(query, 'pageSize') ? this.parsePositiveIntStrict(query?.pageSize, 'pageSize') : 20;
    const pageSize = Math.min(50, pageSizeInput);

    const regions = await this.prisma.region.findMany({
      select: {
        code: true,
        name: true,
        level: true,
        parentCode: true,
        centerLat: true,
        centerLng: true,
      },
    });
    const regionMap = new Map<string, RegionRecord>(
      regions.map((region) => [
        region.code,
        {
          code: region.code,
          name: region.name,
          level: region.level,
          parentCode: region.parentCode ?? null,
          centerLat: region.centerLat ?? null,
          centerLng: region.centerLng ?? null,
        },
      ]),
    );
    const root = regionMap.get(regionCode);
    if (!root) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'region not found' });
    }

    const childrenMap = this.buildChildrenMap(Array.from(regionMap.values()));
    const descendantCodes = this.collectDescendantCodes(regionCode, childrenMap);

    const where: any = {
      auditStatus: 'APPROVED',
      status: 'ACTIVE',
      regionCode: { in: descendantCodes },
    };
    const now = new Date();
    const activeFeaturedWhere: any = {
      ...where,
      featuredLevel: { not: 'NONE' },
      OR: [{ featuredUntil: null }, { featuredUntil: { gte: now } }],
    };

    const [total, rankedCount, activeRankedCount, topActiveRankAggregate, distinctPatents, items] = await Promise.all([
      this.prisma.listing.count({ where }),
      this.prisma.listing.count({ where: { ...where, featuredLevel: { not: 'NONE' } } }),
      this.prisma.listing.count({ where: activeFeaturedWhere }),
      this.prisma.listing.aggregate({
        where: { ...activeFeaturedWhere, featuredRank: { not: null } },
        _min: { featuredRank: true },
      }),
      this.prisma.listing.findMany({
        where,
        select: { patentId: true },
        distinct: ['patentId'],
      }),
      this.prisma.listing.findMany({
        where,
        select: {
          id: true,
          patentId: true,
          title: true,
          tradeMode: true,
          priceType: true,
          priceAmount: true,
          depositAmount: true,
          regionCode: true,
          featuredLevel: true,
          featuredRegionCode: true,
          featuredRank: true,
          featuredUntil: true,
          createdAt: true,
          updatedAt: true,
          patent: {
            select: {
              title: true,
              patentType: true,
              applicationNoDisplay: true,
              applicationNoNorm: true,
            },
          },
        },
        orderBy: [{ featuredLevel: 'desc' }, { featuredRank: 'asc' }, { updatedAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const patentCount = distinctPatents.filter((row) => String(row.patentId || '').trim().length > 0).length;
    const itemDtos: PatentMapRegionDetailItemDto[] = items.map((item) => ({
      listingId: item.id,
      patentId: item.patentId ?? null,
      title: item.title,
      patentTitle: String(item.patent?.title || item.title),
      patentType: item.patent?.patentType ?? null,
      applicationNoDisplay: item.patent?.applicationNoDisplay || item.patent?.applicationNoNorm || null,
      regionCode: item.regionCode ?? null,
      tradeMode: item.tradeMode,
      priceType: item.priceType,
      priceAmountFen: item.priceAmount ?? null,
      depositAmountFen: item.depositAmount,
      featuredLevel: item.featuredLevel,
      featuredRegionCode: item.featuredRegionCode ?? null,
      featuredRank: item.featuredRank ?? null,
      featuredUntil: item.featuredUntil ? item.featuredUntil.toISOString() : null,
      isFeaturedActive: this.isFeaturedActive(
        { featuredLevel: item.featuredLevel, featuredUntil: item.featuredUntil ?? null },
        now,
      ),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    }));

    return {
      generatedAt: new Date().toISOString(),
      region: {
        code: root.code,
        name: root.name,
        level: root.level,
        parentCode: root.parentCode,
        centerLat: root.centerLat,
        centerLng: root.centerLng,
        descendantRegionCodeCount: descendantCodes.length,
      },
      summary: {
        listingCount: total,
        patentCount,
        rankedListingCount: rankedCount,
        activeRankedListingCount: activeRankedCount,
        topActiveRank: topActiveRankAggregate?._min?.featuredRank ?? null,
      },
      items: itemDtos,
      page: {
        page,
        pageSize,
        total,
      },
    };
  }

  private parseBatchPatch(payload: any): BatchPatchParseResult {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'patch is invalid' });
    }

    const data: Record<string, any> = {};
    const patchApplied: Record<string, any> = {};
    const referencedRegionCodes = new Set<string>();

    if (this.hasOwn(payload, 'regionCode')) {
      const regionCode = this.parseNullableRegionCode(payload?.regionCode, 'patch.regionCode');
      data.regionCode = regionCode;
      patchApplied.regionCode = regionCode;
      if (regionCode) referencedRegionCodes.add(regionCode);
    }

    let clearRanking = false;
    if (this.hasOwn(payload, 'clearRanking')) {
      clearRanking = this.parseBooleanStrict(payload?.clearRanking, 'patch.clearRanking');
      patchApplied.clearRanking = clearRanking;
    }

    let featuredLevel: FeaturedLevel | null = null;
    if (this.hasOwn(payload, 'featuredLevel')) {
      featuredLevel = this.parseFeaturedLevelStrict(payload?.featuredLevel, 'patch.featuredLevel');
      patchApplied.featuredLevel = featuredLevel;
      if (featuredLevel === 'NONE') {
        clearRanking = true;
      } else {
        data.featuredLevel = featuredLevel;
      }
    }

    if (this.hasOwn(payload, 'featuredRegionCode')) {
      const featuredRegionCode = this.parseNullableRegionCode(payload?.featuredRegionCode, 'patch.featuredRegionCode');
      data.featuredRegionCode = featuredRegionCode;
      patchApplied.featuredRegionCode = featuredRegionCode;
      if (featuredRegionCode) referencedRegionCodes.add(featuredRegionCode);
      if (featuredLevel && featuredLevel !== 'NONE' && featuredRegionCode === null) {
        throw new BadRequestException({ code: 'BAD_REQUEST', message: 'patch.featuredRegionCode is invalid' });
      }
    }

    if (this.hasOwn(payload, 'featuredRank')) {
      const featuredRank = this.parseNullableNonNegativeInt(payload?.featuredRank, 'patch.featuredRank');
      data.featuredRank = featuredRank;
      patchApplied.featuredRank = featuredRank;
    }

    if (this.hasOwn(payload, 'featuredUntil')) {
      const featuredUntil = this.parseNullableDateTime(payload?.featuredUntil, 'patch.featuredUntil');
      data.featuredUntil = featuredUntil;
      patchApplied.featuredUntil = featuredUntil ? featuredUntil.toISOString() : null;
    }

    if (clearRanking) {
      data.featuredLevel = 'NONE';
      data.featuredRegionCode = null;
      data.featuredRank = null;
      data.featuredUntil = null;
      patchApplied.featuredLevel = 'NONE';
      patchApplied.featuredRegionCode = null;
      patchApplied.featuredRank = null;
      patchApplied.featuredUntil = null;
      patchApplied.clearRanking = true;
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'patch is empty' });
    }

    return {
      data,
      patchApplied,
      referencedRegionCodes: Array.from(referencedRegionCodes),
    };
  }

  async batchUpdateListings(req: any, body: any) {
    const operatorUserId = this.parseUuidStrict(req?.auth?.userId, 'operatorUserId');
    const listingIds = this.parseUuidArrayStrict(body?.listingIds, 'listingIds', { min: 1, max: 500 });
    const reason = this.parseOptionalReason(body?.reason);
    const parsedPatch = this.parseBatchPatch(body?.patch);

    if (parsedPatch.referencedRegionCodes.length > 0) {
      const existingRegions = await this.prisma.region.findMany({
        where: { code: { in: parsedPatch.referencedRegionCodes } },
        select: { code: true },
      });
      const existingCodes = new Set(existingRegions.map((region) => region.code));
      const missingRegionCodes = parsedPatch.referencedRegionCodes.filter((code) => !existingCodes.has(code));
      if (missingRegionCodes.length > 0) {
        throw new BadRequestException({ code: 'BAD_REQUEST', message: 'regionCode is invalid' });
      }
    }

    const existingListings = await this.prisma.listing.findMany({
      where: { id: { in: listingIds } },
      select: { id: true },
    });
    const existingIds = existingListings.map((item) => item.id);
    const existingIdSet = new Set(existingIds);
    const missingListingIds = listingIds.filter((id) => !existingIdSet.has(id));

    let updatedCount = 0;
    if (existingIds.length > 0) {
      const updateResult = await this.prisma.listing.updateMany({
        where: { id: { in: existingIds } },
        data: parsedPatch.data,
      });
      updatedCount = updateResult.count;
      await this.audit.log({
        actorUserId: operatorUserId,
        action: 'PATENT_MAP_BATCH_UPDATE',
        targetType: 'LISTING',
        targetId: existingIds[0],
        afterJson: {
          listingIds: existingIds,
          patch: parsedPatch.patchApplied,
          reason,
        },
      });
    }

    return {
      ok: true,
      totalRequested: listingIds.length,
      updatedCount,
      missingListingIds,
      patchApplied: parsedPatch.patchApplied,
      reason,
    };
  }
}
