import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PublicConfigController } from '../src/modules/config/public-config.controller';

describe('PublicConfigController suite', () => {
  let config: any;
  let controller: PublicConfigController;

  beforeEach(() => {
    config = {
      getTradeRules: vi.fn(),
      getCustomerService: vi.fn(),
      getBanner: vi.fn(),
      getHomeLandingConfig: vi.fn(),
      getPublicHomeAnnouncementFeed: vi.fn(),
    };
    controller = new PublicConfigController(config);
  });

  it('returns trade rules from config service', async () => {
    config.getTradeRules.mockResolvedValueOnce({ version: 5, depositRate: 0.07 });

    const result = await controller.getTradeRules();

    expect(config.getTradeRules).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ version: 5, depositRate: 0.07 });
  });

  it('returns customer service config from config service', async () => {
    config.getCustomerService.mockResolvedValueOnce({
      phone: '400-000-0000',
      defaultReply: 'ok',
      assignStrategy: 'AUTO',
    });

    const result = await controller.getCustomerService();

    expect(config.getCustomerService).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      phone: '400-000-0000',
      defaultReply: 'ok',
      assignStrategy: 'AUTO',
    });
  });

  it('returns banner config from config service', async () => {
    config.getBanner.mockResolvedValueOnce({
      items: [{ id: 'b1', title: 'banner', imageUrl: 'https://a', enabled: true, order: 1 }],
    });

    const result = await controller.getBanner();

    expect(config.getBanner).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      items: [{ id: 'b1', title: 'banner', imageUrl: 'https://a', enabled: true, order: 1 }],
    });
  });

  it('returns home landing config from config service', async () => {
    config.getHomeLandingConfig.mockResolvedValueOnce({
      schemaVersion: 1,
      hero: { tags: ['a'], searchPlaceholder: 's' },
      sectionTexts: { featuredTitle: 't', featuredMoreText: 'm' },
      featuredZones: { enabled: true, displayCount: 4, items: [] },
      listingTopicUi: { items: [] },
    });

    const result = await controller.getHomeLanding();

    expect(config.getHomeLandingConfig).toHaveBeenCalledTimes(1);
    expect(result.schemaVersion).toBe(1);
    expect(result.featuredZones.displayCount).toBe(4);
  });

  it('returns home announcement feed from config service', async () => {
    config.getPublicHomeAnnouncementFeed.mockResolvedValueOnce({
      generatedAt: '2026-03-24T00:00:00.000Z',
      items: [{ id: 'a1', title: 'Top', content: 'Hello' }],
    });

    const result = await controller.getHomeAnnouncements();

    expect(config.getPublicHomeAnnouncementFeed).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      generatedAt: '2026-03-24T00:00:00.000Z',
      items: [{ id: 'a1', title: 'Top', content: 'Hello' }],
    });
  });
});
