import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PatentClustersController } from '../src/modules/config/patent-clusters.controller';

describe('PatentClustersController filter strictness suite', () => {
  let config: any;
  let controller: PatentClustersController;

  beforeEach(() => {
    config = {
      getPatentClusters: vi.fn(),
    };
    controller = new PatentClustersController(config);
  });

  it('rejects invalid page/pageSize strictly', async () => {
    config.getPatentClusters.mockResolvedValueOnce({ items: [], featuredInstitutions: [] });

    await expect(controller.listClusters('', undefined)).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.listClusters('1.5', undefined)).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.listClusters('0', undefined)).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.listClusters(undefined, 'abc')).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.listClusters(undefined, '0')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('caps pageSize and paginates correctly', async () => {
    const items = Array.from({ length: 61 }, (_, idx) => ({
      id: `cluster-${idx + 1}`,
      name: `Cluster ${idx + 1}`,
      industryTags: ['AI'],
    }));
    config.getPatentClusters.mockResolvedValueOnce({ items, featuredInstitutions: [] });

    const result = await controller.listClusters('2', '80');

    expect(result.page).toEqual({ page: 2, pageSize: 50, total: 61 });
    expect(result.items).toHaveLength(11);
    expect(result.items[0].id).toBe('cluster-51');
    expect(result.items[10].id).toBe('cluster-61');
  });

  it('sanitizes hidden test tags and deduplicates case-insensitively', async () => {
    config.getPatentClusters.mockResolvedValueOnce({
      items: [
        {
          id: 'cluster-1',
          name: 'Cluster 1',
          industryTags: ['AI', 'smoke-tag-temp', 'ai', 'Robotics'],
        },
      ],
      featuredInstitutions: [
        {
          id: 'inst-1',
          name: 'Institution 1',
          tags: ['新能源', 'qa-tag-1', '新能源', '储能'],
        },
      ],
    });

    const result = await controller.listClusters(undefined, undefined);

    expect(result.items[0].industryTags).toEqual(['AI', 'Robotics']);
    expect(result.featuredInstitutions?.[0].tags).toEqual(['新能源', '储能']);
  });
});
