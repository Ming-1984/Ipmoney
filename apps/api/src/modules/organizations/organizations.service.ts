import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { VerificationType } from '@prisma/client';

type VerificationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

import { PrismaService } from '../../common/prisma/prisma.service';
import { normalizeDisplayText, resolvePublicFileUrl } from '../content-utils';

const VerificationStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;

const ORG_TYPES: VerificationType[] = [
  VerificationType.COMPANY,
  VerificationType.ACADEMY,
  VerificationType.GOVERNMENT,
  VerificationType.ASSOCIATION,
];
const REGION_CODE_RE = /^[0-9]{6}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeOptionalString(value: unknown): string | undefined {
    return normalizeDisplayText(value);
  }

  private toPublicSummary(
    verification: any,
    stats?: {
      listingCountMap?: Map<string, number>;
      patentCountMap?: Map<string, number>;
      listingCount?: number;
      patentCount?: number;
    },
  ) {
    const listingCount =
      typeof stats?.listingCount === 'number' ? stats.listingCount : (stats?.listingCountMap?.get(verification.userId) ?? 0);
    const patentCount =
      typeof stats?.patentCount === 'number' ? stats.patentCount : (stats?.patentCountMap?.get(verification.userId) ?? 0);
    return {
      userId: verification.userId,
      displayName: this.normalizeOptionalString(verification.displayName),
      verificationType: verification.verificationType,
      verificationStatus: verification.verificationStatus,
      orgCategory: undefined,
      regionCode: verification.regionCode ?? undefined,
      logoUrl: this.resolveOrganizationLogoUrl(verification),
      intro: this.normalizeOptionalString(verification.intro),
      stats: {
        listingCount,
        patentCount,
      },
      verifiedAt: verification.reviewedAt ? verification.reviewedAt.toISOString() : undefined,
    };
  }

  private matchesSearchSummary(summary: any, keyword: string): boolean {
    const normalizedKeyword = String(keyword || '')
      .trim()
      .toLowerCase();
    if (!normalizedKeyword) return true;

    const candidates: string[] = [];
    const pushCandidate = (value: unknown) => {
      const normalized = this.normalizeOptionalString(value);
      if (normalized) candidates.push(normalized.toLowerCase());
    };

    pushCandidate(summary?.displayName);
    pushCandidate(summary?.intro);
    pushCandidate(summary?.regionCode);

    return candidates.some((candidate) => candidate.includes(normalizedKeyword));
  }

  private scoreSearchSummary(summary: any, keyword: string): number {
    const normalizedKeyword = String(keyword || '')
      .trim()
      .toLowerCase();
    if (!normalizedKeyword) return 0;

    const displayName = this.normalizeOptionalString(summary?.displayName)?.toLowerCase() ?? '';
    const intro = this.normalizeOptionalString(summary?.intro)?.toLowerCase() ?? '';
    const regionCode = this.normalizeOptionalString(summary?.regionCode)?.toLowerCase() ?? '';

    let score = 0;
    if (displayName === normalizedKeyword) score += 1000;
    else if (displayName.startsWith(normalizedKeyword)) score += 800;
    else if (displayName.includes(normalizedKeyword)) score += 600;

    if (intro.includes(normalizedKeyword)) score += 80;
    if (regionCode.includes(normalizedKeyword)) score += 20;

    return score;
  }

  private hasStrongDisplayNameMatch(summary: any, keyword: string): boolean {
    const displayName = this.normalizeOptionalString(summary?.displayName)?.toLowerCase() ?? '';
    const normalizedKeyword = String(keyword || '')
      .trim()
      .toLowerCase();
    if (!displayName || !normalizedKeyword) return false;
    return displayName === normalizedKeyword || displayName.startsWith(normalizedKeyword);
  }

  private paginateItems<T>(items: T[], page: number, pageSize: number): { items: T[]; total: number } {
    const total = items.length;
    const start = (page - 1) * pageSize;
    return { items: items.slice(start, start + pageSize), total };
  }

  private resolveOrganizationLogoUrl(verification: { logoFile?: any; logoUrl?: string | null }) {
    return (
      resolvePublicFileUrl(verification?.logoFile) ??
      resolvePublicFileUrl({ url: verification?.logoUrl ?? null }) ??
      undefined
    );
  }

  private hasOwn(input: any, key: string) {
    return !!input && Object.prototype.hasOwnProperty.call(input, key);
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

  private parseRegionCodeFilterStrict(value: unknown, fieldName: string): string {
    const raw = String(value ?? '').trim();
    if (!raw || !REGION_CODE_RE.test(raw)) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return raw;
  }

  private parseUuidStrict(value: unknown, fieldName: string): string {
    const raw = String(value ?? '').trim();
    if (!raw || !UUID_RE.test(raw)) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return raw;
  }

  private normalizeOrganizationTypes(input: any) {
    if (input === undefined || input === null) {
      return { values: [] as VerificationType[], invalid: false };
    }
    const raw = Array.isArray(input) ? input : [input];
    const values: VerificationType[] = [];
    let invalid = false;

    for (const item of raw) {
      const normalized = String(item || '').trim().toUpperCase();
      if (!normalized) {
        invalid = true;
        continue;
      }
      if (!Object.values(VerificationType).includes(normalized as VerificationType)) {
        invalid = true;
        continue;
      }
      const typed = normalized as VerificationType;
      if (!ORG_TYPES.includes(typed)) {
        invalid = true;
        continue;
      }
      values.push(typed);
    }

    return { values: Array.from(new Set(values)), invalid };
  }

  private async buildStats(userIds: string[]) {
    if (!userIds.length) return { listingCountMap: new Map<string, number>(), patentCountMap: new Map<string, number>() };

    const [listingCounts, patentCounts] = await Promise.all([
      this.prisma.listing.groupBy({
        by: ['sellerUserId'],
        where: {
          sellerUserId: { in: userIds },
          auditStatus: VerificationStatus.APPROVED,
          status: { in: ['ACTIVE', 'SOLD'] },
        },
        _count: { _all: true },
      }),
      this.prisma.listing.findMany({
        where: {
          sellerUserId: { in: userIds },
          patentId: { not: null },
          auditStatus: VerificationStatus.APPROVED,
          status: { in: ['ACTIVE', 'SOLD'] },
        },
        select: { sellerUserId: true, patentId: true },
        distinct: ['sellerUserId', 'patentId'],
      }),
    ]);

    const listingCountMap = new Map(listingCounts.map((row) => [row.sellerUserId, row._count._all]));
    const patentCountMap = new Map<string, number>();
    for (const row of patentCounts) {
      const current = patentCountMap.get(row.sellerUserId) ?? 0;
      patentCountMap.set(row.sellerUserId, current + 1);
    }
    return { listingCountMap, patentCountMap };
  }

  async list(query: any) {
    const page = this.hasOwn(query, 'page') ? this.parsePositiveIntStrict(query?.page, 'page') : 1;
    const pageSizeInput = this.hasOwn(query, 'pageSize') ? this.parsePositiveIntStrict(query?.pageSize, 'pageSize') : 20;
    const pageSize = Math.min(50, pageSizeInput);
    const q = String(query?.q || '').trim();
    const hasRegionCode = this.hasOwn(query, 'regionCode');
    const regionCode = hasRegionCode ? this.parseRegionCodeFilterStrict(query?.regionCode, 'regionCode') : '';
    const hasTypes = this.hasOwn(query, 'types');
    const hasType = this.hasOwn(query, 'type');
    const hasVerificationType = this.hasOwn(query, 'verificationType');
    const hasTypeInput = hasTypes || hasType || hasVerificationType;
    const rawTypeInput = hasTypes ? query?.types : hasType ? query?.type : query?.verificationType;
    const { values: typeFilters, invalid: typeInvalid } = this.normalizeOrganizationTypes(rawTypeInput);

    if (hasTypeInput && (typeInvalid || typeFilters.length === 0)) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'type is invalid' });
    }

    const orgTypes = hasTypeInput ? typeFilters : ORG_TYPES;

    const where: any = {
      verificationStatus: VerificationStatus.APPROVED,
      verificationType: { in: orgTypes.length ? orgTypes : ORG_TYPES },
    };
    if (regionCode) where.regionCode = regionCode;

    let items: any[] = [];
    let total = 0;

    if (q) {
      const rows = await this.prisma.userVerification.findMany({
        where,
        include: { logoFile: true },
        orderBy: { reviewedAt: 'desc' },
      });
      const userIds = rows.map((item: any) => item.userId);
      const { listingCountMap, patentCountMap } = await this.buildStats(userIds);
      const summaries = rows.map((item: any) => this.toPublicSummary(item, { listingCountMap, patentCountMap }));
      const matched = summaries.filter((summary) => this.matchesSearchSummary(summary, q));
      const strongDisplayNameMatches = matched.filter((summary) => this.hasStrongDisplayNameMatch(summary, q));
      const searchPool = strongDisplayNameMatches.length ? strongDisplayNameMatches : matched;
      const filtered = searchPool.sort((a, b) => this.scoreSearchSummary(b, q) - this.scoreSearchSummary(a, q));
      const paged = this.paginateItems(filtered, page, pageSize);
      return {
        items: paged.items,
        page: { page, pageSize, total: paged.total },
      };
    }

    [items, total] = await Promise.all([
      this.prisma.userVerification.findMany({
        where,
        include: { logoFile: true },
        orderBy: { reviewedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.userVerification.count({ where }),
    ]);

    const userIds = items.map((item: any) => item.userId);
    const { listingCountMap, patentCountMap } = await this.buildStats(userIds);

    return {
      items: items.map((v: any) => this.toPublicSummary(v, { listingCountMap, patentCountMap })),
      page: { page, pageSize, total },
    };
  }

  async getById(orgUserId: string) {
    const normalizedOrgUserId = this.parseUuidStrict(orgUserId, 'orgUserId');
    const v = await this.prisma.userVerification.findFirst({
      where: {
        userId: normalizedOrgUserId,
        verificationStatus: VerificationStatus.APPROVED,
        verificationType: { in: ORG_TYPES },
      },
      include: { logoFile: true },
    });
    if (!v) throw new NotFoundException({ code: 'NOT_FOUND', message: 'organization not found' });
    const [listingCount, patentCount] = await Promise.all([
      this.prisma.listing.count({
        where: {
          sellerUserId: normalizedOrgUserId,
          auditStatus: VerificationStatus.APPROVED,
          status: { in: ['ACTIVE', 'SOLD'] },
        },
      }),
      this.prisma.listing
        .findMany({
          where: {
            sellerUserId: normalizedOrgUserId,
            patentId: { not: null },
            auditStatus: VerificationStatus.APPROVED,
            status: { in: ['ACTIVE', 'SOLD'] },
          },
          select: { patentId: true },
          distinct: ['patentId'],
        })
        .then((rows) => rows.length),
    ]);
    return {
      ...this.toPublicSummary(v, { listingCount, patentCount }),
    };
  }
}
