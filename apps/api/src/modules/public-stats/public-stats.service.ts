import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../common/prisma/prisma.service';

export type PublicHomeStats = {
  patentsTotal: number;
  techManagersTotal: number;
  registeredUsersTotal: number;
  completedDealsTotal: number;
  updatedAt: string;
};

type PublicHomeStatsCache = {
  data: PublicHomeStats;
  expiresAt: number;
};

const HOME_STATS_CACHE_TTL_MS = 60 * 1000;

@Injectable()
export class PublicStatsService {
  private homeStatsCache: PublicHomeStatsCache | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async getHomeStats(): Promise<PublicHomeStats> {
    const now = Date.now();
    if (this.homeStatsCache && this.homeStatsCache.expiresAt > now) {
      return this.homeStatsCache.data;
    }

    const [patentsTotal, techManagersTotal, registeredUsersTotal, completedDealsTotal] = await Promise.all([
      this.prisma.patent.count(),
      this.prisma.userVerification.count({
        where: {
          verificationType: 'TECH_MANAGER',
          verificationStatus: 'APPROVED',
        },
      }),
      this.prisma.user.count(),
      this.prisma.order.count({ where: { status: 'COMPLETED' } }),
    ]);

    const data: PublicHomeStats = {
      patentsTotal,
      techManagersTotal,
      registeredUsersTotal,
      completedDealsTotal,
      updatedAt: new Date(now).toISOString(),
    };

    this.homeStatsCache = {
      data,
      expiresAt: now + HOME_STATS_CACHE_TTL_MS,
    };

    return data;
  }
}
