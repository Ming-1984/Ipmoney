import { ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AdminConfigController } from '../src/modules/config/admin-config.controller';

describe('AdminConfigController permission and audit suite', () => {
  let config: any;
  let audit: any;
  let controller: AdminConfigController;

  beforeEach(() => {
    config = {
      getTradeRules: vi.fn(),
      updateTradeRules: vi.fn(),
      getRecommendation: vi.fn(),
      updateRecommendation: vi.fn(),
      getBanner: vi.fn(),
      updateBanner: vi.fn(),
      getCustomerService: vi.fn(),
      updateCustomerService: vi.fn(),
      getTaxonomy: vi.fn(),
      updateTaxonomy: vi.fn(),
      getSensitiveWords: vi.fn(),
      updateSensitiveWords: vi.fn(),
      getHotSearch: vi.fn(),
      updateHotSearch: vi.fn(),
      getAlertConfig: vi.fn(),
      updateAlertConfig: vi.fn(),
    };
    audit = { log: vi.fn().mockResolvedValue(undefined) };
    controller = new AdminConfigController(config, audit);
  });

  it('requires config.manage permission for all admin config endpoints', async () => {
    const req = { auth: { userId: 'admin-1', permissions: new Set<string>() } };

    const calls: Array<() => Promise<unknown>> = [
      () => controller.getTradeRules(req),
      () => controller.updateTradeRules(req, {} as any),
      () => controller.getRecommendation(req),
      () => controller.updateRecommendation(req, {} as any),
      () => controller.getBanner(req),
      () => controller.updateBanner(req, {} as any),
      () => controller.getCustomerService(req),
      () => controller.updateCustomerService(req, {} as any),
      () => controller.getTaxonomy(req),
      () => controller.updateTaxonomy(req, {} as any),
      () => controller.getSensitiveWords(req),
      () => controller.updateSensitiveWords(req, {} as any),
      () => controller.getHotSearch(req),
      () => controller.updateHotSearch(req, {} as any),
      () => controller.getAlertConfig(req),
      () => controller.updateAlertConfig(req, {} as any),
    ];

    for (const call of calls) {
      await expect(call()).rejects.toBeInstanceOf(ForbiddenException);
    }
  });

  it('forwards get endpoints when permission is granted', async () => {
    const req = { auth: { userId: 'admin-1', permissions: new Set(['config.manage']) } };
    config.getTradeRules.mockResolvedValueOnce({ version: 2 });
    config.getRecommendation.mockResolvedValueOnce({ enabled: true });
    config.getBanner.mockResolvedValueOnce({ items: [] });
    config.getCustomerService.mockResolvedValueOnce({ phone: '400' });
    config.getTaxonomy.mockResolvedValueOnce({ industries: [] });
    config.getSensitiveWords.mockResolvedValueOnce({ words: [] });
    config.getHotSearch.mockResolvedValueOnce({ keywords: [] });
    config.getAlertConfig.mockResolvedValueOnce({ enabled: false, rules: [] });

    await expect(controller.getTradeRules(req)).resolves.toEqual({ version: 2 });
    await expect(controller.getRecommendation(req)).resolves.toEqual({ enabled: true });
    await expect(controller.getBanner(req)).resolves.toEqual({ items: [] });
    await expect(controller.getCustomerService(req)).resolves.toEqual({ phone: '400' });
    await expect(controller.getTaxonomy(req)).resolves.toEqual({ industries: [] });
    await expect(controller.getSensitiveWords(req)).resolves.toEqual({ words: [] });
    await expect(controller.getHotSearch(req)).resolves.toEqual({ keywords: [] });
    await expect(controller.getAlertConfig(req)).resolves.toEqual({ enabled: false, rules: [] });
  });

  it('writes audit logs with expected action and target ids on updates', async () => {
    const req = { auth: { userId: 'admin-1', permissions: new Set(['config.manage']) } };

    const cases = [
      {
        label: 'trade-rules',
        call: () => controller.updateTradeRules(req, {} as any),
        mock: config.updateTradeRules,
        action: 'CONFIG_TRADE_RULES_UPDATE',
        targetId: '91da3cd0-6e2b-4cf2-a0da-2b248cd1d15e',
      },
      {
        label: 'recommendation',
        call: () => controller.updateRecommendation(req, {} as any),
        mock: config.updateRecommendation,
        action: 'CONFIG_RECOMMENDATION_UPDATE',
        targetId: '29e10f9c-d17f-4f51-b56c-0a0300af7cdb',
      },
      {
        label: 'banner',
        call: () => controller.updateBanner(req, {} as any),
        mock: config.updateBanner,
        action: 'CONFIG_BANNER_UPDATE',
        targetId: 'fa7f5e92-cf58-49de-b744-f5af599e8465',
      },
      {
        label: 'customer-service',
        call: () => controller.updateCustomerService(req, {} as any),
        mock: config.updateCustomerService,
        action: 'CONFIG_CS_UPDATE',
        targetId: '712253f8-ae4e-4fd2-a2cf-43596e0bd0d4',
      },
      {
        label: 'taxonomy',
        call: () => controller.updateTaxonomy(req, {} as any),
        mock: config.updateTaxonomy,
        action: 'CONFIG_TAXONOMY_UPDATE',
        targetId: 'f9f67fd8-cf25-4da4-8517-72510ed6eb6f',
      },
      {
        label: 'sensitive-words',
        call: () => controller.updateSensitiveWords(req, {} as any),
        mock: config.updateSensitiveWords,
        action: 'CONFIG_SENSITIVE_UPDATE',
        targetId: '0aca260f-4c11-42e6-ad9b-c7a7ca45f6a1',
      },
      {
        label: 'hot-search',
        call: () => controller.updateHotSearch(req, {} as any),
        mock: config.updateHotSearch,
        action: 'CONFIG_HOT_SEARCH_UPDATE',
        targetId: '8dd52cb6-7fae-492d-8c8f-8a6ca6f74f42',
      },
      {
        label: 'alerts',
        call: () => controller.updateAlertConfig(req, {} as any),
        mock: config.updateAlertConfig,
        action: 'CONFIG_ALERT_UPDATE',
        targetId: 'e92da947-d8e6-4648-a550-6f2fc0e933f3',
      },
    ];

    for (const item of cases) {
      item.mock.mockResolvedValueOnce({ module: item.label });
      const result = await item.call();
      expect(result).toEqual({ module: item.label });
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actorUserId: 'admin-1',
          action: item.action,
          targetType: 'SYSTEM_CONFIG',
          targetId: item.targetId,
          afterJson: { module: item.label },
        }),
      );
    }
  });
});
