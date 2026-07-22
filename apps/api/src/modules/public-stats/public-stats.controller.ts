import { Controller, Get } from '@nestjs/common';

import { PublicStatsService, type PublicHomeStats } from './public-stats.service';

@Controller('/public')
export class PublicStatsController {
  constructor(private readonly publicStats: PublicStatsService) {}

  @Get('/home-stats')
  async getHomeStats(): Promise<PublicHomeStats> {
    return await this.publicStats.getHomeStats();
  }
}
