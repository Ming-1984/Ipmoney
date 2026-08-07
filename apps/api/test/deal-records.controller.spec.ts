import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DealRecordsController } from '../src/modules/deal-records/deal-records.controller';

describe('DealRecordsController', () => {
  let dealRecords: any;
  let controller: DealRecordsController;

  beforeEach(() => {
    dealRecords = {
      executeImportBatched: vi.fn(),
    };
    controller = new DealRecordsController(dealRecords);
  });

  it('uses the resilient import executor for authorized requests', async () => {
    const req = { auth: { permissions: new Set(['dealRecord.import']) } };
    dealRecords.executeImportBatched.mockResolvedValueOnce({ job: { id: 'job-1', status: 'SUCCEEDED' } });

    await expect(controller.executeImport(req, undefined as any)).resolves.toEqual({
      job: { id: 'job-1', status: 'SUCCEEDED' },
    });
    expect(dealRecords.executeImportBatched).toHaveBeenCalledWith(req, {});
  });
});
