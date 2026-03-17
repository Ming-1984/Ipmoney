import { beforeEach, describe, expect, it, vi } from 'vitest';

import { InventorsController } from '../src/modules/inventors/inventors.controller';

describe('InventorsController delegation suite', () => {
  let inventors: any;
  let controller: InventorsController;

  beforeEach(() => {
    inventors = {
      search: vi.fn(),
    };
    controller = new InventorsController(inventors);
  });

  it('delegates search with query payload', async () => {
    inventors.search.mockResolvedValueOnce({ items: [] });

    await expect(controller.search({ q: 'alice', pageSize: '20' })).resolves.toEqual({ items: [] });

    expect(inventors.search).toHaveBeenCalledWith({ q: 'alice', pageSize: '20' });
  });
});
