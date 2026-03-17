import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OrganizationsController } from '../src/modules/organizations/organizations.controller';

const VALID_UUID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

describe('OrganizationsController delegation suite', () => {
  let organizations: any;
  let controller: OrganizationsController;

  beforeEach(() => {
    organizations = {
      list: vi.fn(),
      getById: vi.fn(),
    };
    controller = new OrganizationsController(organizations);
  });

  it('delegates list with query payload', async () => {
    organizations.list.mockResolvedValueOnce({ items: [] });

    await expect(controller.list({ q: 'lab', page: '1' })).resolves.toEqual({ items: [] });

    expect(organizations.list).toHaveBeenCalledWith({ q: 'lab', page: '1' });
  });

  it('delegates getById with route param', async () => {
    organizations.getById.mockResolvedValueOnce({ id: VALID_UUID });

    await expect(controller.getById(VALID_UUID)).resolves.toEqual({ id: VALID_UUID });

    expect(organizations.getById).toHaveBeenCalledWith(VALID_UUID);
  });
});
