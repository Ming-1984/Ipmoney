import { ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { IndustryTagsController } from '../src/modules/regions/industry-tags.controller';

describe('IndustryTagsController delegation suite', () => {
  let regions: any;
  let controller: IndustryTagsController;

  beforeEach(() => {
    regions = {
      listIndustryTags: vi.fn(),
      createIndustryTag: vi.fn(),
    };
    controller = new IndustryTagsController(regions);
  });

  it('delegates list with config.manage permission and includes test artifacts', async () => {
    const req: any = { auth: { permissions: new Set(['config.manage']) } };
    regions.listIndustryTags.mockResolvedValueOnce({ items: [] });

    await expect(controller.list(req)).resolves.toEqual({ items: [] });

    expect(regions.listIndustryTags).toHaveBeenCalledWith({ includeTestArtifacts: true });
  });

  it('rejects list/create when config.manage permission is missing', async () => {
    const req: any = { auth: { permissions: new Set(['listing.read']) } };

    await expect(controller.list(req)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(controller.create(req, { name: 'Tag A' })).rejects.toBeInstanceOf(ForbiddenException);

    expect(regions.listIndustryTags).not.toHaveBeenCalled();
    expect(regions.createIndustryTag).not.toHaveBeenCalled();
  });

  it('delegates create and forwards nullable body name', async () => {
    const req: any = { auth: { permissions: new Set(['config.manage']) } };
    regions.createIndustryTag.mockResolvedValueOnce({ id: 'tag-1' });
    regions.createIndustryTag.mockResolvedValueOnce({ id: 'tag-2' });

    await expect(controller.create(req, { name: 'Tag A' })).resolves.toEqual({ id: 'tag-1' });
    await expect(controller.create(req, undefined as any)).resolves.toEqual({ id: 'tag-2' });

    expect(regions.createIndustryTag).toHaveBeenNthCalledWith(1, 'Tag A');
    expect(regions.createIndustryTag).toHaveBeenNthCalledWith(2, undefined);
  });
});
