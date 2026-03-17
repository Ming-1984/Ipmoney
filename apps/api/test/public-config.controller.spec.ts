import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PublicConfigController } from '../src/modules/config/public-config.controller';

describe('PublicConfigController suite', () => {
  let config: any;
  let controller: PublicConfigController;

  beforeEach(() => {
    config = {
      getTradeRules: vi.fn(),
      getCustomerService: vi.fn(),
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
});
