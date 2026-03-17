import { ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AdminRegionsController } from '../src/modules/regions/admin-regions.controller';

describe('AdminRegionsController delegation suite', () => {
  let regions: any;
  let controller: AdminRegionsController;

  beforeEach(() => {
    regions = {
      listRegions: vi.fn(),
      createRegion: vi.fn(),
      updateRegion: vi.fn(),
      setRegionIndustryTags: vi.fn(),
    };
    controller = new AdminRegionsController(regions);
  });

  it('delegates listRegions with includeTestArtifacts for config.manage permission', async () => {
    const req: any = { auth: { permissions: new Set(['config.manage']) } };
    regions.listRegions.mockResolvedValueOnce({ items: [{ regionCode: '110000' }] });

    await expect(controller.listRegions(req, 'CITY', '110000', 'beijing')).resolves.toEqual({
      items: [{ regionCode: '110000' }],
    });

    expect(regions.listRegions).toHaveBeenCalledWith({
      level: 'CITY',
      parentCode: '110000',
      q: 'beijing',
      includeTestArtifacts: true,
    });
  });

  it('rejects listRegions when config.manage permission is absent', async () => {
    const req: any = { auth: { permissions: new Set(['listing.read']) } };

    await expect(controller.listRegions(req, undefined, undefined, undefined)).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    expect(regions.listRegions).not.toHaveBeenCalled();
  });

  it('delegates createRegion with body payload', async () => {
    const req: any = { auth: { permissions: new Set(['config.manage']) } };
    const body = { code: '110101', name: 'Dongcheng', level: 'DISTRICT', parentCode: '110000' };
    regions.createRegion.mockResolvedValueOnce({ ok: true });

    await expect(controller.createRegion(req, body as any)).resolves.toEqual({ ok: true });

    expect(regions.createRegion).toHaveBeenCalledWith(body);
  });

  it('delegates updateRegion with path regionCode and body', async () => {
    const req: any = { auth: { permissions: new Set(['config.manage']) } };
    const body = { name: 'Updated Name' };
    regions.updateRegion.mockResolvedValueOnce({ ok: true });

    await expect(controller.updateRegion(req, '110000', body as any)).resolves.toEqual({ ok: true });

    expect(regions.updateRegion).toHaveBeenCalledWith('110000', body);
  });

  it('delegates setIndustryTags and forwards undefined tags when body is empty', async () => {
    const req: any = { auth: { permissions: new Set(['config.manage']) } };
    regions.setRegionIndustryTags.mockResolvedValueOnce({ ok: true });

    await expect(controller.setIndustryTags(req, '110000', undefined as any)).resolves.toEqual({ ok: true });

    expect(regions.setRegionIndustryTags).toHaveBeenCalledWith('110000', undefined);
  });
});
