import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ReportsController } from '../src/modules/reports/reports.controller';

describe('ReportsController delegation suite', () => {
  let reports: any;
  let controller: ReportsController;

  beforeEach(() => {
    reports = {
      getFinanceSummary: vi.fn(),
      exportFinanceReport: vi.fn(),
    };
    controller = new ReportsController(reports);
  });

  it('delegates financeSummary with request context', async () => {
    const req: any = { auth: { userId: 'finance-1' }, query: { days: '30' } };
    reports.getFinanceSummary.mockResolvedValueOnce({ ordersTotal: 10 });

    await expect(controller.financeSummary(req)).resolves.toEqual({ ordersTotal: 10 });

    expect(reports.getFinanceSummary).toHaveBeenCalledWith(req);
  });

  it('delegates exportFinance with request context', async () => {
    const req: any = { auth: { userId: 'finance-1' }, body: { days: 7 } };
    reports.exportFinanceReport.mockResolvedValueOnce({ exportUrl: '/files/f-1' });

    await expect(controller.exportFinance(req)).resolves.toEqual({ exportUrl: '/files/f-1' });

    expect(reports.exportFinanceReport).toHaveBeenCalledWith(req);
  });
});
