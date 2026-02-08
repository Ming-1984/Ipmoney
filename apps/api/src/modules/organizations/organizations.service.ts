import { Injectable, NotFoundException } from '@nestjs/common';

type VerificationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
type VerificationType = 'COMPANY' | 'ACADEMY' | 'GOVERNMENT' | 'ASSOCIATION' | 'TECH_MANAGER' | 'INDIVIDUAL';

import { PrismaService } from '../../common/prisma/prisma.service';

const VerificationStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;

const ORG_TYPES: VerificationType[] = ['COMPANY', 'ACADEMY', 'GOVERNMENT', 'ASSOCIATION'];

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: any) {
    const page = Math.max(1, Number(query?.page || 1));
    const pageSize = Math.min(50, Math.max(1, Number(query?.pageSize || 20)));
    const q = String(query?.q || '').trim();
    const regionCode = String(query?.regionCode || '').trim();

    const where: any = {
      verificationStatus: VerificationStatus.APPROVED,
      verificationType: { in: ORG_TYPES },
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

    return {
      items: items.map((v: { userId: string; displayName: string; logoFile?: { url?: string | null } | null; regionCode?: string | null; intro?: string | null }) => ({
        userId: v.userId,
        displayName: v.displayName,
        logoUrl: v.logoFile?.url ?? null,
        regionCode: v.regionCode ?? null,
        tags: null,
        summary: v.intro ?? null,
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
    return {
      userId: v.userId,
      displayName: v.displayName,
      logoUrl: v.logoFile?.url ?? null,
      regionCode: v.regionCode ?? null,
      tags: null,
      summary: v.intro ?? null,
    };
  }
}
