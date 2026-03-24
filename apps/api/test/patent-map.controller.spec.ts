import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PatentMapController } from '../src/modules/patent-map/patent-map.controller';

describe('PatentMapController suite', () => {
  let service: any;
  let controller: PatentMapController;

  beforeEach(() => {
    service = {
      getOverview: vi.fn(),
      getRegionDetails: vi.fn(),
      batchUpdateListings: vi.fn(),
      ensureAdmin: vi.fn(),
    };
    controller = new PatentMapController(service);
  });

  it('delegates overview query', async () => {
    service.getOverview.mockResolvedValueOnce({ ok: true });
    await expect(controller.getOverview({ regionLevel: 'PROVINCE' })).resolves.toEqual({ ok: true });
    expect(service.getOverview).toHaveBeenCalledWith({ regionLevel: 'PROVINCE' });
  });

  it('normalizes region code param and delegates detail query', async () => {
    service.getRegionDetails.mockResolvedValueOnce({ items: [] });
    await expect(controller.getRegionDetails(' 110000 ', { page: 1 })).resolves.toEqual({ items: [] });
    expect(service.getRegionDetails).toHaveBeenCalledWith('110000', { page: 1 });
  });

  it('rejects invalid region code param', async () => {
    await expect(controller.getRegionDetails('bad', {})).rejects.toBeInstanceOf(BadRequestException);
    expect(service.getRegionDetails).not.toHaveBeenCalled();
  });

  it('checks permission before batch update', async () => {
    const req: any = {
      auth: {
        isAdmin: true,
        permissions: new Set(['listing.read']),
      },
    };
    await expect(controller.batchUpdateListings(req, { listingIds: [] })).rejects.toBeInstanceOf(ForbiddenException);
    expect(service.batchUpdateListings).not.toHaveBeenCalled();
  });

  it('delegates batch update when permission is granted', async () => {
    const req: any = {
      auth: {
        isAdmin: true,
        permissions: new Set(['listing.audit']),
      },
    };
    service.batchUpdateListings.mockResolvedValueOnce({ ok: true });
    await expect(controller.batchUpdateListings(req, { listingIds: ['x'] })).resolves.toEqual({ ok: true });
    expect(service.ensureAdmin).toHaveBeenCalledWith(req);
    expect(service.batchUpdateListings).toHaveBeenCalledWith(req, { listingIds: ['x'] });
  });
});
