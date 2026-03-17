import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PatentClustersController } from '../src/modules/config/patent-clusters.controller';

describe('PatentClustersController delegation suite', () => {
  let config: any;
  let controller: PatentClustersController;

  beforeEach(() => {
    config = {
      getPatentClusters: vi.fn(),
    };
    controller = new PatentClustersController(config);
  });

  it('returns default pagination and sanitizes hidden/duplicate tags', async () => {
    config.getPatentClusters.mockResolvedValueOnce({
      items: [
        { id: 'c1', industryTags: ['新能源', 'smoke-tag-x', '新能源', '储能'] },
        { id: 'c2', industryTags: ['qa tag internal', '新材料'] },
      ],
      featuredInstitutions: [{ id: 'f1', tags: ['AI', 'e2e-tag-a', 'ai'] }],
    });

    const result = await controller.listClusters(undefined, undefined);

    expect(result.page).toEqual({ page: 1, pageSize: 20, total: 2 });
    expect(result.items[0].industryTags).toEqual(['新能源', '储能']);
    expect(result.items[1].industryTags).toEqual(['新材料']);
    expect(result.featuredInstitutions?.[0].tags).toEqual(['AI']);
  });

  it('caps pageSize to 50 and slices by page offset', async () => {
    config.getPatentClusters.mockResolvedValueOnce({
      items: Array.from({ length: 120 }, (_, i) => ({ id: `c-${i + 1}`, industryTags: [] })),
      featuredInstitutions: [],
    });

    const result = await controller.listClusters('2', '100');

    expect(result.page).toEqual({ page: 2, pageSize: 50, total: 120 });
    expect(result.items).toHaveLength(50);
    expect(result.items[0].id).toBe('c-51');
  });

  it('rejects invalid page/pageSize query values', async () => {
    config.getPatentClusters.mockResolvedValueOnce({ items: [], featuredInstitutions: [] });

    await expect(controller.listClusters('', '20')).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.listClusters('1', '2.5')).rejects.toBeInstanceOf(BadRequestException);
  });
});
