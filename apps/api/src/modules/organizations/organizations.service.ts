import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { VerificationType } from '@prisma/client';

type VerificationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

import { PrismaService } from '../../common/prisma/prisma.service';

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
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  private hasOwn(input: any, key: string) {
    return !!input && Object.prototype.hasOwnProperty.call(input, key);
  }

  private parsePositiveIntStrict(value: unknown, fieldName: string): number {
    const raw = String(value ?? '').trim();
    if (!raw) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return parsed;
  }

  private parseRegionCodeFilterStrict(value: unknown, fieldName: string): string {
    const raw = String(value ?? '').trim();
    if (!raw) {
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
    if (q) where.displayName = { contains: q };
    if (regionCode) where.regionCode = regionCode;

    const [items, total] = await Promise.all([
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
      items: items.map((v: any) => ({
        userId: v.userId,
        displayName: v.displayName,
        verificationType: v.verificationType,
        verificationStatus: v.verificationStatus,
        orgCategory: undefined,
        regionCode: v.regionCode ?? undefined,
        logoUrl: v.logoFile?.url ?? undefined,
        intro: v.intro ?? undefined,
        stats: {
          listingCount: listingCountMap.get(v.userId) ?? 0,
          patentCount: patentCountMap.get(v.userId) ?? 0,
        },
        verifiedAt: v.reviewedAt ? v.reviewedAt.toISOString() : undefined,
      })),
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
      userId: v.userId,
      displayName: v.displayName,
      verificationType: v.verificationType,
      verificationStatus: v.verificationStatus,
      orgCategory: undefined,
      logoUrl: v.logoFile?.url ?? undefined,
      regionCode: v.regionCode ?? undefined,
      intro: v.intro ?? undefined,
      stats: {
        listingCount,
        patentCount,
      },
      verifiedAt: v.reviewedAt ? v.reviewedAt.toISOString() : undefined,
    };
  }
}
