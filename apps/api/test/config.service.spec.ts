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
});
