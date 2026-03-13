import { ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AdminPatentMapController } from '../src/modules/patent-map/admin-patent-map.controller';

describe('AdminPatentMapController delegation suite', () => {
  let patentMap: any;
  let controller: AdminPatentMapController;

  beforeEach(() => {
    patentMap = {
      adminGetEntry: vi.fn(),
      adminUpsertEntry: vi.fn(),
      adminImportExcel: vi.fn(),
    };
    controller = new AdminPatentMapController(patentMap);
  });

  it('delegates getEntry with numeric year conversion under config.manage permission', async () => {
    const req: any = { auth: { permissions: new Set(['config.manage']) } };
    patentMap.adminGetEntry.mockResolvedValueOnce({ regionCode: '110000', year: 2025 });

    await expect(controller.getEntry(req, '110000', '2025')).resolves.toEqual({ regionCode: '110000', year: 2025 });

    expect(patentMap.adminGetEntry).toHaveBeenCalledWith('110000', 2025);
  });

  it('rejects getEntry when config.manage permission is absent', async () => {
    const req: any = { auth: { permissions: new Set(['listing.read']) } };

    await expect(controller.getEntry(req, '110000', '2025')).rejects.toBeInstanceOf(ForbiddenException);

    expect(patentMap.adminGetEntry).not.toHaveBeenCalled();
  });

  it('delegates upsertEntry with numeric year conversion and body payload', async () => {
    const req: any = { auth: { permissions: new Set(['config.manage']) } };
    const body = { value: 100 } as any;
    patentMap.adminUpsertEntry.mockResolvedValueOnce({ ok: true });

    await expect(controller.upsertEntry(req, '110000', '2026', body)).resolves.toEqual({ ok: true });

    expect(patentMap.adminUpsertEntry).toHaveBeenCalledWith('110000', 2026, body);
  });

  it('parses dryRun=true in importExcel with trim and case-insensitive conversion', async () => {
    const req: any = { auth: { permissions: new Set(['config.manage']) } };
    const file = { originalname: 'import.xlsx' };
    patentMap.adminImportExcel.mockResolvedValueOnce({ ok: true, dryRun: true });

    await expect(controller.importExcel(req, file, '  TRUE  ')).resolves.toEqual({ ok: true, dryRun: true });

    expect(patentMap.adminImportExcel).toHaveBeenCalledWith(file, true);
  });

  it('defaults dryRun=false in importExcel when body field is missing', async () => {
    const req: any = { auth: { permissions: new Set(['config.manage']) } };
    const file = { originalname: 'import.xlsx' };
    patentMap.adminImportExcel.mockResolvedValueOnce({ ok: true, dryRun: false });

    await expect(controller.importExcel(req, file, undefined)).resolves.toEqual({ ok: true, dryRun: false });

    expect(patentMap.adminImportExcel).toHaveBeenCalledWith(file, false);
  });
});
