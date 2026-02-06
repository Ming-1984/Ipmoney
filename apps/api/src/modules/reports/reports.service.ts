import { ForbiddenException, Injectable } from '@nestjs/common';
import { requirePermission } from '../../common/permissions';

@Injectable()
export class ReportsService {
  private ensureAuth(req: any) {
    if (!req?.auth?.userId) throw new ForbiddenException({ code: 'FORBIDDEN', message: '无权限' });
  }

  getFinanceSummary(req: any) {
    this.ensureAuth(req);
    requirePermission(req, 'report.read');
    return {
      range: {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        end: new Date().toISOString(),
      },
      dealAmountFen: 28800000,
      commissionAmountFen: 2880000,
      refundRate: 0.03,
      payoutSuccessRate: 0.97,
      ordersTotal: 32,
    };
  }

  exportFinanceReport(req: any) {
    this.ensureAuth(req);
    requirePermission(req, 'report.export');
    return { exportUrl: '/exports/finance-report-demo.csv' };
  }
}
