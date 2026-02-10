import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, VerificationType } from '@prisma/client';

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

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeTypes(input: any): VerificationType[] {
    if (!input) return [];
    const raw = Array.isArray(input) ? input : [input];
    const types = raw
      .map((value) => String(value || '').trim().toUpperCase())
      .filter(Boolean)
      .filter((value) => Object.values(VerificationType).includes(value as VerificationType))
      .map((value) => value as VerificationType);
    return types;
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
      this.prisma.$queryRaw<Array<{ sellerUserId: string; patentCount: number }>>(Prisma.sql`
        SELECT
          seller_user_id AS "sellerUserId",
          COUNT(DISTINCT patent_id)::int AS "patentCount"
        FROM listings
        WHERE seller_user_id IN (${Prisma.join(userIds)})
          AND patent_id IS NOT NULL
          AND audit_status = 'APPROVED'
          AND status IN ('ACTIVE', 'SOLD')
        GROUP BY seller_user_id
      `),
    ]);

    const listingCountMap = new Map(listingCounts.map((row) => [row.sellerUserId, row._count._all]));
    const patentCountMap = new Map(patentCounts.map((row) => [row.sellerUserId, row.patentCount]));
    return { listingCountMap, patentCountMap };
  }

  async list(query: any) {
    const page = Math.max(1, Number(query?.page || 1));
    const pageSize = Math.min(50, Math.max(1, Number(query?.pageSize || 20)));
    const q = String(query?.q || '').trim();
    const regionCode = String(query?.regionCode || '').trim();
    const typeFilters = this.normalizeTypes(query?.types || query?.type || query?.verificationType);
    const orgTypes = typeFilters.length ? typeFilters.filter((type) => ORG_TYPES.includes(type)) : ORG_TYPES;

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
    const v = await this.prisma.userVerification.findFirst({
      where: {
        userId: orgUserId,
        verificationStatus: VerificationStatus.APPROVED,
        verificationType: { in: ORG_TYPES },
      },
      include: { logoFile: true },
    });
    if (!v) throw new NotFoundException({ code: 'NOT_FOUND', message: 'organization not found' });
    const [listingCount, patentCount] = await Promise.all([
      this.prisma.listing.count({
        where: {
          sellerUserId: orgUserId,
          auditStatus: VerificationStatus.APPROVED,
          status: { in: ['ACTIVE', 'SOLD'] },
        },
      }),
      this.prisma
        .$queryRaw<Array<{ patentCount: number }>>(Prisma.sql`
          SELECT COUNT(DISTINCT patent_id)::int AS "patentCount"
          FROM listings
          WHERE seller_user_id = ${orgUserId}
            AND patent_id IS NOT NULL
            AND audit_status = 'APPROVED'
            AND status IN ('ACTIVE', 'SOLD')
        `)
        .then((rows) => Number(rows[0]?.patentCount ?? 0)),
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
