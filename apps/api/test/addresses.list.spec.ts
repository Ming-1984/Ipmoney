import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';

import { AddressesService } from '../src/modules/addresses/addresses.service';

describe('AddressesService list strictness suite', () => {
  let prisma: any;
  let service: AddressesService;

  beforeEach(() => {
    prisma = {
      address: {
        findMany: vi.fn(),
      },
    };
    service = new AddressesService(prisma);
  });

  it('rejects unauthenticated list', async () => {
    await expect(service.list({} as any)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.address.findMany).not.toHaveBeenCalled();
  });

  it('queries only current user addresses with stable default/update ordering', async () => {
    prisma.address.findMany.mockResolvedValueOnce([]);
    const req = { auth: { userId: 'u-1' } };

    await expect(service.list(req as any)).resolves.toEqual([]);

    expect(prisma.address.findMany).toHaveBeenCalledWith({
      where: { userId: 'u-1' },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    });
  });

  it('maps list entities to dto with iso datetime fields', async () => {
    prisma.address.findMany.mockResolvedValueOnce([
      {
        id: '11111111-1111-4111-8111-111111111111',
        userId: 'u-1',
        name: 'Alice',
        phone: '13800138000',
        regionCode: null,
        addressLine: 'Road 1',
        isDefault: 1,
        createdAt: new Date('2026-03-13T00:00:00.000Z'),
        updatedAt: new Date('2026-03-13T01:00:00.000Z'),
      },
    ]);

    const result = await service.list({ auth: { userId: 'u-1' } } as any);

    expect(result).toEqual([
      {
        id: '11111111-1111-4111-8111-111111111111',
        userId: 'u-1',
        name: 'Alice',
        phone: '13800138000',
        regionCode: null,
        addressLine: 'Road 1',
        isDefault: true,
        createdAt: '2026-03-13T00:00:00.000Z',
        updatedAt: '2026-03-13T01:00:00.000Z',
      },
    ]);
  });
});
