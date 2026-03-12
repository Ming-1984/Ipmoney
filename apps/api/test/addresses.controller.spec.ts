import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AddressesController } from '../src/modules/addresses/addresses.controller';

describe('AddressesController delegation suite', () => {
  let addresses: any;
  let controller: AddressesController;

  beforeEach(() => {
    addresses = {
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    };
    controller = new AddressesController(addresses);
  });

  it('delegates list with request object', async () => {
    const req = { auth: { userId: 'u-1' } };
    addresses.list.mockResolvedValueOnce([{ id: 'a-1' }]);

    await expect(controller.list(req as any)).resolves.toEqual([{ id: 'a-1' }]);
    expect(addresses.list).toHaveBeenCalledWith(req);
  });

  it('delegates create with fallback empty body', async () => {
    const req = { auth: { userId: 'u-1' } };
    addresses.create.mockResolvedValueOnce({ id: 'a-1' });

    await expect(controller.create(req as any, undefined as any)).resolves.toEqual({ id: 'a-1' });
    expect(addresses.create).toHaveBeenCalledWith(req, {});
  });

  it('delegates update with path id and fallback empty body', async () => {
    const req = { auth: { userId: 'u-1' } };
    addresses.update.mockResolvedValueOnce({ id: 'a-1' });

    await expect(controller.update(req as any, 'a-1', null as any)).resolves.toEqual({ id: 'a-1' });
    expect(addresses.update).toHaveBeenCalledWith(req, 'a-1', {});
  });

  it('delegates remove with path id', async () => {
    const req = { auth: { userId: 'u-1' } };
    addresses.remove.mockResolvedValueOnce({ ok: true });

    await expect(controller.remove(req as any, 'a-1')).resolves.toEqual({ ok: true });
    expect(addresses.remove).toHaveBeenCalledWith(req, 'a-1');
  });
});
