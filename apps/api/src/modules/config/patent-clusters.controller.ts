import { Controller, Get, Query } from '@nestjs/common';

import {
  ConfigService,
  type PatentClusterInstitutionSummary,
  type PatentClusterSummary,
} from './config.service';

type PatentClustersResponse = {
  items: PatentClusterSummary[];
  featuredInstitutions?: PatentClusterInstitutionSummary[];
  page: { page: number; pageSize: number; total: number };
};

@Controller()
export class PatentClustersController {
  constructor(private readonly config: ConfigService) {}

  @Get('/public/patent-clusters')
  async listClusters(
    @Query('page') pageRaw?: string,
    @Query('pageSize') pageSizeRaw?: string,
  ): Promise<PatentClustersResponse> {
    const page = this.normalizePositiveInt(pageRaw, 1);
    const pageSize = Math.min(50, this.normalizePositiveInt(pageSizeRaw, 20));

    const clustersConfig = await this.config.getPatentClusters();
    const items = clustersConfig.items ?? [];
    const total = items.length;
    const startIndex = (page - 1) * pageSize;
    const pagedItems = items.slice(startIndex, startIndex + pageSize);

    return {
      items: pagedItems,
      featuredInstitutions: clustersConfig.featuredInstitutions ?? [],
      page: { page, pageSize, total },
    };
  }

  private normalizePositiveInt(rawValue: string | undefined, fallback: number): number {
    if (!rawValue) return fallback;
    const parsedValue = Number(rawValue);
    if (!Number.isFinite(parsedValue)) return fallback;
    const integerValue = Math.floor(parsedValue);
    return integerValue > 0 ? integerValue : fallback;
  }
}
