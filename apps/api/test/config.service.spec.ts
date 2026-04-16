import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConfigService } from '../src/modules/config/config.service';

describe('ConfigService behavior suite', () => {
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

  it('getTradeRules merges stored json and row version', async () => {
    prisma.systemConfig.findUnique.mockResolvedValueOnce({
      key: 'trade_rules',
      value: JSON.stringify({ depositRate: 0.12, autoPayoutOnTimeout: true }),
      version: 7,
    });

    const result = await service.getTradeRules();

    expect(result.version).toBe(7);
    expect(result.depositRate).toBe(0.12);
    expect(result.autoPayoutOnTimeout).toBe(true);
    expect(result.payoutCondition).toBe('TRANSFER_COMPLETED_CONFIRMED');
  });

  it('getTradeRules falls back to defaults when json is invalid', async () => {
    prisma.systemConfig.findUnique.mockResolvedValueOnce({
      key: 'trade_rules',
      value: '{bad-json',
      version: 3,
    });

    const result = await service.getTradeRules();

    expect(result.version).toBe(3);
    expect(result.depositRate).toBe(0.05);
    expect(result.commissionRate).toBe(0.05);
  });

  it('updateTradeRules bumps version and persists payload', async () => {
    prisma.systemConfig.findUnique.mockResolvedValueOnce({
      key: 'trade_rules',
      value: JSON.stringify({}),
      version: 2,
    });
    prisma.systemConfig.update.mockResolvedValueOnce({ version: 3 });

    const next = {
      depositRate: 0.08,
      depositMinFen: 20000,
      depositMaxFen: 600000,
      depositFixedForNegotiableFen: 30000,
      autoRefundWindowMinutes: 45,
      sellerMaterialDeadlineBusinessDays: 5,
      contractSignedDeadlineBusinessDays: 12,
      transferCompletedSlaDays: 95,
      commissionRate: 0.06,
      commissionMinFen: 120000,
      commissionMaxFen: 5200000,
      payoutCondition: 'TRANSFER_COMPLETED_CONFIRMED' as const,
      payoutMethodDefault: 'MANUAL' as const,
      autoPayoutOnTimeout: true,
    };

    const result = await service.updateTradeRules(next);

    expect(prisma.systemConfig.update).toHaveBeenCalledWith({
      where: { key: 'trade_rules' },
      data: {
        valueType: 'JSON',
        scope: 'GLOBAL',
        value: JSON.stringify({ ...next, version: 3 }),
        version: 3,
      },
    });
    expect(result).toEqual({ ...next, version: 3 });
  });

  it('getAlertConfig falls back when stored json is invalid', async () => {
    prisma.systemConfig.findUnique.mockResolvedValueOnce({
      key: 'alert_config',
      value: '{bad-json',
      version: 1,
    });

    const result = await service.getAlertConfig();

    expect(result.enabled).toBe(false);
    expect(result.defaultChannels).toEqual(['IN_APP']);
    expect(Array.isArray(result.rules)).toBe(true);
    expect(result.rules.length).toBeGreaterThan(0);
  });

  it('updateAlertConfig merges partial patch with current config', async () => {
    const current = {
      enabled: false,
      defaultChannels: ['IN_APP'],
      rules: [{ type: 'order.refund', severity: 'HIGH', channels: ['IN_APP'], enabled: true }],
    };
    prisma.systemConfig.findUnique.mockResolvedValue({
      key: 'alert_config',
      value: JSON.stringify(current),
      version: 5,
    });
    prisma.systemConfig.update.mockResolvedValueOnce({ version: 6 });

    const result = await service.updateAlertConfig({ enabled: true });

    expect(prisma.systemConfig.update).toHaveBeenCalledWith({
      where: { key: 'alert_config' },
      data: {
        valueType: 'JSON',
        scope: 'GLOBAL',
        value: JSON.stringify({
          enabled: true,
          defaultChannels: ['IN_APP'],
          rules: [{ type: 'order.refund', severity: 'HIGH', channels: ['IN_APP'], enabled: true }],
        }),
        version: 6,
      },
    });
    expect(result).toEqual({
      enabled: true,
      defaultChannels: ['IN_APP'],
      rules: [{ type: 'order.refund', severity: 'HIGH', channels: ['IN_APP'], enabled: true }],
    });
  });

  it('creates home announcement template and persists config with version increment', async () => {
    prisma.systemConfig.findUnique.mockResolvedValueOnce({
      key: 'home_announcement_config',
      value: JSON.stringify({ schemaVersion: 1, templates: [], items: [] }),
      version: 9,
    });
    prisma.systemConfig.update.mockResolvedValueOnce({});

    const result = await service.createHomeAnnouncementTemplate({
      name: 'default',
      title: 'Platform notice',
      content: 'Welcome',
      enabled: true,
    });

    expect(result.id).toBeTruthy();
    expect(result.name).toBe('default');
    expect(result.title).toBe('Platform notice');
    expect(prisma.systemConfig.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: 'home_announcement_config' },
        data: expect.objectContaining({
          valueType: 'JSON',
          scope: 'GLOBAL',
          version: 10,
        }),
      }),
    );
  });

  it('public home announcement feed only returns active published items in sorted order', async () => {
    const now = new Date('2026-03-24T10:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(now);
    prisma.systemConfig.findUnique.mockResolvedValueOnce({
      key: 'home_announcement_config',
      value: JSON.stringify({
        schemaVersion: 1,
        templates: [],
        items: [
          {
            id: 'a1',
            title: 'Pinned First',
            content: 'p1',
            tag: 'HOT',
            linkUrl: null,
            pinned: true,
            order: 10,
            status: 'PUBLISHED',
            startAt: null,
            endAt: null,
            publishedAt: '2026-03-24T09:00:00.000Z',
            createdAt: '2026-03-24T09:00:00.000Z',
            updatedAt: '2026-03-24T09:00:00.000Z',
          },
          {
            id: 'a2',
            title: 'Second',
            content: 'p2',
            tag: null,
            linkUrl: null,
            pinned: false,
            order: 1,
            status: 'PUBLISHED',
            startAt: null,
            endAt: null,
            publishedAt: '2026-03-24T08:00:00.000Z',
            createdAt: '2026-03-24T08:00:00.000Z',
            updatedAt: '2026-03-24T08:00:00.000Z',
          },
          {
            id: 'a3',
            title: 'Future',
            content: 'p3',
            tag: null,
            linkUrl: null,
            pinned: false,
            order: 0,
            status: 'PUBLISHED',
            startAt: '2026-03-25T00:00:00.000Z',
            endAt: null,
            publishedAt: '2026-03-24T08:00:00.000Z',
            createdAt: '2026-03-24T08:00:00.000Z',
            updatedAt: '2026-03-24T08:00:00.000Z',
          },
          {
            id: 'a4',
            title: 'Draft',
            content: 'p4',
            tag: null,
            linkUrl: null,
            pinned: false,
            order: 0,
            status: 'DRAFT',
            startAt: null,
            endAt: null,
            publishedAt: null,
            createdAt: '2026-03-24T08:00:00.000Z',
            updatedAt: '2026-03-24T08:00:00.000Z',
          },
        ],
      }),
      version: 1,
    });

    const result = await service.getPublicHomeAnnouncementFeed();

    expect(result.items.map((item) => item.id)).toEqual(['a1', 'a2']);
    vi.useRealTimers();
  });

  it('getHomeLandingConfig falls back to defaults when stored json is invalid', async () => {
    prisma.systemConfig.findUnique.mockResolvedValueOnce({
      key: 'home_landing_config',
      value: '{bad-json',
      version: 1,
    });

    const result = await service.getHomeLandingConfig();

    expect(result.schemaVersion).toBe(1);
    expect(result.hero.tags.length).toBeGreaterThan(0);
    expect(result.featuredZones.items.length).toBeGreaterThan(0);
    expect(result.listingTopicUi.items.map((item) => item.value)).toEqual([
      'HIGH_TECH_RETIRED',
      'SLEEPING',
      'AWARD_WINNING',
      'FIVE_STAR',
      'OPEN_LICENSE',
    ]);
  });

  it('updateHomeLandingConfig rejects when enabled featured cards are less than displayCount', async () => {
    prisma.systemConfig.findUnique.mockResolvedValueOnce({
      key: 'home_landing_config',
      value: JSON.stringify({ schemaVersion: 1 }),
      version: 1,
    });

    await expect(
      service.updateHomeLandingConfig({
        schemaVersion: 1,
        hero: { tags: ['A', 'B', 'C'], searchPlaceholder: '搜索' },
        sectionTexts: { featuredTitle: '特色专区', featuredMoreText: '更多' },
        featuredZones: {
          enabled: true,
          displayCount: 6,
          items: [
            {
              id: 'z1',
              title: '退役',
              subtitle: 's1',
              imageUrl: 'builtin://z1',
              enabled: true,
              order: 10,
              actionType: 'SEARCH_PREFILL',
              actionPayload: { tab: 'LISTING', listingTopic: 'HIGH_TECH_RETIRED', reset: true },
            },
            {
              id: 'z2',
              title: '沉睡',
              subtitle: 's2',
              imageUrl: 'builtin://z2',
              enabled: true,
              order: 20,
              actionType: 'SEARCH_PREFILL',
              actionPayload: { tab: 'LISTING', listingTopic: 'SLEEPING', reset: true },
            },
            {
              id: 'z3',
              title: '获奖',
              subtitle: 's3',
              imageUrl: 'builtin://z3',
              enabled: true,
              order: 30,
              actionType: 'SEARCH_PREFILL',
              actionPayload: { tab: 'LISTING', listingTopic: 'AWARD_WINNING', reset: true },
            },
            {
              id: 'z4',
              title: '五星',
              subtitle: 's4',
              imageUrl: 'builtin://z4',
              enabled: true,
              order: 40,
              actionType: 'SEARCH_PREFILL',
              actionPayload: { tab: 'LISTING', listingTopic: 'FIVE_STAR', reset: true },
            },
          ],
        },
        listingTopicUi: {
          items: [
            { value: 'HIGH_TECH_RETIRED', label: '退役专利', enabled: true, order: 10 },
            { value: 'SLEEPING', label: '沉睡专利', enabled: true, order: 20 },
            { value: 'AWARD_WINNING', label: '获奖专利', enabled: true, order: 30 },
            { value: 'FIVE_STAR', label: '五星专利', enabled: true, order: 40 },
            { value: 'OPEN_LICENSE', label: '开放许可', enabled: true, order: 50 },
          ],
        },
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'BAD_REQUEST',
      }),
    });
  });

  it('updateHomeLandingConfig persists normalized payload', async () => {
    prisma.systemConfig.findUnique.mockResolvedValueOnce({
      key: 'home_landing_config',
      value: JSON.stringify({ schemaVersion: 1 }),
      version: 3,
    });
    prisma.systemConfig.update.mockResolvedValueOnce({});

    const result = await service.updateHomeLandingConfig({
      schemaVersion: 1,
      hero: { tags: ['零手续费', '快速成交'], searchPlaceholder: '搜专利/机构/技术经理' },
      sectionTexts: { featuredTitle: '特色专区', featuredMoreText: '查看更多' },
      featuredZones: {
        enabled: true,
        displayCount: 4,
        items: [
          {
            id: 'retired',
            title: '退役专利',
            subtitle: '平台审核通过',
            imageUrl: 'builtin://zone-retired',
            enabled: true,
            order: 10,
            actionType: 'SEARCH_PREFILL',
            actionPayload: { tab: 'LISTING', listingTopic: 'HIGH_TECH_RETIRED', reset: true },
          },
          {
            id: 'sleeping',
            title: '沉睡专利',
            subtitle: '转让次数为0',
            imageUrl: 'builtin://zone-sleeping',
            enabled: true,
            order: 20,
            actionType: 'SEARCH_PREFILL',
            actionPayload: { tab: 'LISTING', listingTopic: 'SLEEPING', reset: true },
          },
          {
            id: 'award',
            title: '获奖专利',
            subtitle: '平台标记获奖',
            imageUrl: 'builtin://zone-award',
            enabled: true,
            order: 30,
            actionType: 'SEARCH_PREFILL',
            actionPayload: { tab: 'LISTING', listingTopic: 'AWARD_WINNING', reset: true },
          },
          {
            id: 'five-star',
            title: '五星专利',
            subtitle: '优选高质量专利',
            imageUrl: 'builtin://zone-five-star',
            enabled: true,
            order: 40,
            actionType: 'SEARCH_PREFILL',
            actionPayload: { tab: 'LISTING', listingTopic: 'FIVE_STAR', reset: true },
          },
        ],
      },
      listingTopicUi: {
        items: [
          { value: 'HIGH_TECH_RETIRED', label: '退役专利', enabled: true, order: 10 },
          { value: 'SLEEPING', label: '沉睡专利', enabled: true, order: 20 },
          { value: 'AWARD_WINNING', label: '获奖专利', enabled: true, order: 30 },
          { value: 'FIVE_STAR', label: '五星专利', enabled: true, order: 40 },
          { value: 'OPEN_LICENSE', label: '开放许可', enabled: false, order: 50 },
        ],
      },
    });

    expect(prisma.systemConfig.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: 'home_landing_config' },
        data: expect.objectContaining({
          valueType: 'JSON',
          scope: 'GLOBAL',
          version: 4,
        }),
      }),
    );
    expect(result.hero.searchPlaceholder).toBe('搜专利/机构/技术经理');
    expect(result.featuredZones.displayCount).toBe(4);
    expect(result.listingTopicUi.items.find((item) => item.value === 'OPEN_LICENSE')?.enabled).toBe(false);
  });
});
