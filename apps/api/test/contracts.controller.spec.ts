import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ContractsController } from '../src/modules/contracts/contracts.controller';

const VALID_UUID = '13131313-1313-4131-8131-131313131313';

describe('ContractsController delegation suite', () => {
  let contracts: any;
  let controller: ContractsController;

  beforeEach(() => {
    contracts = {
      list: vi.fn(),
      upload: vi.fn(),
    };
    controller = new ContractsController(contracts);
  });

  it('delegates list with request and query', async () => {
    const req: any = { auth: { userId: 'user-1' } };
    contracts.list.mockResolvedValueOnce({ items: [] });

    await expect(controller.list(req, { status: 'WAIT_UPLOAD' })).resolves.toEqual({ items: [] });

    expect(contracts.list).toHaveBeenCalledWith(req, { status: 'WAIT_UPLOAD' });
  });

  it('delegates upload with fallback empty body', async () => {
    const req: any = { auth: { userId: 'user-1' } };
    contracts.upload.mockResolvedValueOnce({ ok: true });

    await expect(controller.upload(req, VALID_UUID, undefined as any)).resolves.toEqual({ ok: true });

    expect(contracts.upload).toHaveBeenCalledWith(req, VALID_UUID, {});
  });
});
