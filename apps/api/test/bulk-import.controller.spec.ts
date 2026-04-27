import { ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BulkImportController } from '../src/modules/bulk-import/bulk-import.controller';

describe('BulkImportController', () => {
  let bulkImport: any;
  let controller: BulkImportController;

  beforeEach(() => {
    bulkImport = {
      previewPeopleAchievements: vi.fn(),
      executePeopleAchievements: vi.fn(),
      listPeopleAchievementsHistory: vi.fn(),
    };
    controller = new BulkImportController(bulkImport);
  });

  it('requires patent.import permission', async () => {
    const req: any = { auth: { permissions: new Set(['listing.read']) } };

    await expect(controller.previewPeopleAchievements(req, {})).rejects.toBeInstanceOf(ForbiddenException);
    await expect(controller.executePeopleAchievements(req, {})).rejects.toBeInstanceOf(ForbiddenException);

    expect(bulkImport.previewPeopleAchievements).not.toHaveBeenCalled();
    expect(bulkImport.executePeopleAchievements).not.toHaveBeenCalled();
    await expect(controller.listPeopleAchievementsHistory(req, {})).rejects.toBeInstanceOf(ForbiddenException);
    expect(bulkImport.listPeopleAchievementsHistory).not.toHaveBeenCalled();
  });

  it('delegates preview and execute', async () => {
    const req: any = { auth: { permissions: new Set(['patent.import']) } };
    bulkImport.previewPeopleAchievements.mockResolvedValueOnce({ preview: true });
    bulkImport.executePeopleAchievements.mockResolvedValueOnce({ execute: true });

    await expect(controller.previewPeopleAchievements(req, { peopleFileId: 'x' })).resolves.toEqual({ preview: true });
    await expect(controller.executePeopleAchievements(req, { achievementsFileId: 'y' })).resolves.toEqual({ execute: true });

    expect(bulkImport.previewPeopleAchievements).toHaveBeenCalledWith(req, { peopleFileId: 'x' });
    expect(bulkImport.executePeopleAchievements).toHaveBeenCalledWith(req, { achievementsFileId: 'y' });
  });

  it('delegates history query', async () => {
    const req: any = { auth: { permissions: new Set(['patent.import']) } };
    bulkImport.listPeopleAchievementsHistory.mockResolvedValueOnce({ items: [], page: { page: 1, pageSize: 20, total: 0 } });
    await expect(controller.listPeopleAchievementsHistory(req, { page: 1 })).resolves.toEqual({
      items: [],
      page: { page: 1, pageSize: 20, total: 0 },
    });
    expect(bulkImport.listPeopleAchievementsHistory).toHaveBeenCalledWith(req, { page: 1 });
  });
});
