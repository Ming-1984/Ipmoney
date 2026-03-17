import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RegionsController } from '../src/modules/regions/regions.controller';

describe('RegionsController delegation suite', () => {
  let regions: any;
  let controller: RegionsController;

  beforeEach(() => {
    regions = {
      listRegions: vi.fn(),
      listIndustryTags: vi.fn(),
    };
    controller = new RegionsController(regions);
  });

  it('delegates listRegions with includeTestArtifacts=false and normalized parentCode', async () => {
    regions.listRegions.mockResolvedValueOnce({ items: [] });

    await expect(controller.listRegions('CITY', undefined, 'beijing')).resolves.toEqual({ items: [] });

    expect(regions.listRegions).toHaveBeenCalledWith({
      level: 'CITY',
      parentCode: undefined,
      q: 'beijing',
      includeTestArtifacts: false,
    });
  });

  it('delegates listPublicIndustryTags with includeTestArtifacts=false', async () => {
    regions.listIndustryTags.mockResolvedValueOnce({ items: [] });

    await expect(controller.listPublicIndustryTags()).resolves.toEqual({ items: [] });

    expect(regions.listIndustryTags).toHaveBeenCalledWith({ includeTestArtifacts: false });
  });
});
