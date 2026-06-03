import { Controller, Get, Post, Req, UseGuards } from '@nestjs/common';

import { BearerAuthGuard } from '../../common/guards/bearer-auth.guard';
import { ReportsService } from './reports.service';

@Controller()
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @UseGuards(BearerAuthGuard)
  @Get('/admin/reports/finance/summary')
  async financeSummary(@Req() req: any) {
    return await this.reports.getFinanceSummary(req);
  }

  @UseGuards(BearerAuthGuard)
  @Post('/admin/reports/finance/export')
  async exportFinance(@Req() req: any) {
    return await this.reports.exportFinanceReport(req);
  }
}
