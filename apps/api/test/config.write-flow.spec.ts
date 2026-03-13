import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConfigService } from '../src/modules/config/config.service';

describe('ConfigService extended write flow suite', () => {
  let prisma: any;
  let service: ConfigService;

  beforeEach(() => {
    prisma = {
      systemConfig: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    };
    service = new ConfigService(prisma);
  });

  it('creates recommendation config row when missing on first read', async () => {
    prisma.systemConfig.findUnique.mockResolvedValueOnce(null);
    prisma.systemConfig.create.mockResolvedValueOnce({
      key: 'recommendation_config',
      value: JSON.stringify({ enabled: false }),
      version: 1,
      updatedAt: new Date('2026-03-13T00:00:00.000Z'),
    });

    const result = await service.getRecommendation();

    expect(prisma.systemConfig.create).toHaveBeenCalledWith({
      data: {
        key: 'recommendation_config',
        valueType: 'JSON',
        scope: 'GLOBAL',
        value: expect.any(String),
        version: 1,
      },
    });
    expect(result.enabled).toBe(false);
  });

  it('getRecommendation uses row updatedAt when payload lacks updatedAt', async () => {
    prisma.systemConfig.findUnique.mockResolvedValueOnce({
      key: 'recommendation_config',
      value: JSON.stringify({
        enabled: true,
        dedupeWindowHours: 12,
      }),
      version: 4,
      updatedAt: new Date('2026-03-13T02:00:00.000Z'),
    });

    const result = await service.getRecommendation();

    expect(result.enabled).toBe(true);
    expect(result.dedupeWindowHours).toBe(12);
    expect(result.updatedAt).toBe('2026-03-13T02:00:00.000Z');
  });

  it('updateRecommendation bumps version and returns db updatedAt', async () => {
    prisma.systemConfig.findUnique.mockResolvedValueOnce({
      key: 'recommendation_config',
      value: JSON.stringify({ enabled: true }),
      version: 7,
      updatedAt: new Date('2026-03-13T00:00:00.000Z'),
    });
    prisma.systemConfig.update.mockResolvedValueOnce({
      key: 'recommendation_config',
      updatedAt: new Date('2026-03-13T03:00:00.000Z'),
    });

    const result = await service.updateRecommendation({
      enabled: false,
      timeDecayHalfLifeHours: 48,
      dedupeWindowHours: 8,
      weights: { time: 1, view: 2, favorite: 3, consult: 4, region: 5, user: 6 },
      featuredBoost: { province: 3, city: 4 },
    });

    expect(prisma.systemConfig.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: 'recommendation_config' },
        data: expect.objectContaining({
          valueType: 'JSON',
          scope: 'GLOBAL',
          version: 8,
        }),
      }),
    );
    expect(result.updatedAt).toBe('2026-03-13T03:00:00.000Z');
    expect(result.enabled).toBe(false);
  });

  it('updateBanner persists payload with version increment', async () => {
    prisma.systemConfig.findUnique.mockResolvedValueOnce({
      key: 'banner_config',
      value: JSON.stringify({ items: [] }),
      version: 1,
      updatedAt: new Date('2026-03-13T00:00:00.000Z'),
    });
    prisma.systemConfig.update.mockResolvedValueOnce({});

    const payload = {
      items: [{ id: 'b-1', title: 'Top', imageUrl: 'https://example.com/top.png', enabled: true, order: 1 }],
    };
    const result = await service.updateBanner(payload);

    expect(prisma.systemConfig.update).toHaveBeenCalledWith({
      where: { key: 'banner_config' },
      data: {
        valueType: 'JSON',
        scope: 'GLOBAL',
        value: JSON.stringify(payload),
        version: 2,
      },
    });
    expect(result).toEqual(payload);
  });

  it('updateCustomerService persists payload with version increment', async () => {
    prisma.systemConfig.findUnique.mockResolvedValueOnce({
      key: 'customer_service_config',
      value: JSON.stringify({ phone: '400', defaultReply: 'x', assignStrategy: 'AUTO' }),
      version: 2,
      updatedAt: new Date('2026-03-13T00:00:00.000Z'),
    });
    prisma.systemConfig.update.mockResolvedValueOnce({});

    const payload = { phone: '400-800-9000', defaultReply: 'Hello', assignStrategy: 'MANUAL' as const };
    const result = await service.updateCustomerService(payload);

    expect(prisma.systemConfig.update).toHaveBeenCalledWith({
      where: { key: 'customer_service_config' },
      data: {
        valueType: 'JSON',
        scope: 'GLOBAL',
        value: JSON.stringify(payload),
        version: 3,
      },
    });
    expect(result).toEqual(payload);
  });

  it('updates taxonomy, sensitive words, and hot search configs with independent keys', async () => {
    prisma.systemConfig.findUnique
      .mockResolvedValueOnce({
        key: 'taxonomy_config',
        value: '{}',
        version: 2,
      })
      .mockResolvedValueOnce({
        key: 'sensitive_words_config',
        value: '{}',
        version: 3,
      })
      .mockResolvedValueOnce({
        key: 'hot_search_config',
        value: '{}',
        version: 4,
      });
    prisma.systemConfig.update.mockResolvedValue({});

    const taxonomy = {
      industries: ['AI'],
      ipcMappings: ['G06'],
      locMappings: ['01'],
      artworkCategories: ['Painting'],
      calligraphyStyles: ['Regular Script'],
      paintingThemes: ['Landscape Painting'],
      artworkMaterials: ['Paper'],
    };
    const sensitive = { words: ['blocked-a', 'blocked-b'] };
    const hot = { keywords: ['Patent Transfer', 'Tech Broker'] };

    await expect(service.updateTaxonomy(taxonomy)).resolves.toEqual(taxonomy);
    await expect(service.updateSensitiveWords(sensitive)).resolves.toEqual(sensitive);
    await expect(service.updateHotSearch(hot)).resolves.toEqual(hot);

    expect(prisma.systemConfig.update).toHaveBeenNthCalledWith(1, {
      where: { key: 'taxonomy_config' },
      data: {
        valueType: 'JSON',
        scope: 'GLOBAL',
        value: JSON.stringify(taxonomy),
        version: 3,
      },
    });
    expect(prisma.systemConfig.update).toHaveBeenNthCalledWith(2, {
      where: { key: 'sensitive_words_config' },
      data: {
        valueType: 'JSON',
        scope: 'GLOBAL',
        value: JSON.stringify(sensitive),
        version: 4,
      },
    });
    expect(prisma.systemConfig.update).toHaveBeenNthCalledWith(3, {
      where: { key: 'hot_search_config' },
      data: {
        valueType: 'JSON',
        scope: 'GLOBAL',
        value: JSON.stringify(hot),
        version: 5,
      },
    });
  });

  it('getPatentClusters merges partial payload and falls back updatedAt', async () => {
    prisma.systemConfig.findUnique.mockResolvedValueOnce({
      key: 'patent_clusters_config',
      value: JSON.stringify({
        items: [{ id: 'c-1', name: 'Cluster A' }],
      }),
      version: 1,
      updatedAt: new Date('2026-03-13T04:00:00.000Z'),
    });

    const result = await service.getPatentClusters();

    expect(result.items).toEqual([{ id: 'c-1', name: 'Cluster A' }]);
    expect(Array.isArray(result.featuredInstitutions)).toBe(true);
    expect(result.updatedAt).toBe('2026-03-13T04:00:00.000Z');
  });
});
