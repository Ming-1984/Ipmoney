import { BadRequestException, Controller, Get, Query } from '@nestjs/common';

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
    const page = this.parsePositiveInt(pageRaw, 1, 'page');
    const pageSize = Math.min(50, this.parsePositiveInt(pageSizeRaw, 20, 'pageSize'));

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

  private parsePositiveInt(rawValue: string | undefined, fallback: number, fieldName: string): number {
    if (rawValue === undefined) return fallback;
    const normalized = String(rawValue).trim();
    if (!normalized) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} must be a positive integer` });
    }
    if (!/^[0-9]+$/.test(normalized)) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} must be a positive integer` });
    }

    const parsed = Number(normalized);
    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} must be a positive integer` });
    }
    return parsed;
  }
}
