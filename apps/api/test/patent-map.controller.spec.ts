import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PatentMapController } from '../src/modules/patent-map/patent-map.controller';

describe('PatentMapController delegation suite', () => {
  let patentMap: any;
  let controller: PatentMapController;

  beforeEach(() => {
    patentMap = {
      listYears: vi.fn(),
      getSummary: vi.fn(),
      getRegionDetail: vi.fn(),
    };
    controller = new PatentMapController(patentMap);
  });

  it('delegates listYears', async () => {
    patentMap.listYears.mockResolvedValueOnce({ items: [2024] });

    await expect(controller.listYears()).resolves.toEqual({ items: [2024] });

    expect(patentMap.listYears).toHaveBeenCalledTimes(1);
  });

  it('delegates summary with numeric year and normalized parentCode', async () => {
    patentMap.getSummary.mockResolvedValueOnce({ items: [] });

    await expect(controller.summary('2025', 'CITY', undefined)).resolves.toEqual({ items: [] });

    expect(patentMap.getSummary).toHaveBeenCalledWith({
      year: 2025,
      level: 'CITY',
      parentCode: undefined,
    });
  });

  it('delegates regionDetail with numeric year', async () => {
    patentMap.getRegionDetail.mockResolvedValueOnce({ regionCode: '110000' });

    await expect(controller.regionDetail('110000', '2026')).resolves.toEqual({ regionCode: '110000' });

    expect(patentMap.getRegionDetail).toHaveBeenCalledWith('110000', 2026);
  });
});
