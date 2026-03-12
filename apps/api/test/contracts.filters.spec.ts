import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ContractsService } from '../src/modules/contracts/contracts.service';

describe('ContractsService list filter strictness suite', () => {
  let prisma: any;
  let service: ContractsService;

  beforeEach(() => {
    prisma = {
      order: {
        findMany: vi.fn(),
        count: vi.fn(),
      },
    };
    service = new ContractsService(prisma);
  });

  it('requires auth for list', async () => {
    await expect(service.list({}, {})).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects invalid pagination and status filters', async () => {
    const req = { auth: { userId: 'u-1' } };
    await expect(service.list(req, { page: '0' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.list(req, { pageSize: '1.5' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.list(req, { status: 'pending' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('caps pageSize and applies WAIT_UPLOAD special where-clause', async () => {
    const req = { auth: { userId: 'user-1' } };
    prisma.order.findMany.mockResolvedValueOnce([]);
    prisma.order.count.mockResolvedValueOnce(0);

    const result = await service.list(req, { page: '2', pageSize: '100', status: 'wait_upload' });

    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ buyerUserId: 'user-1' }, { listing: { sellerUserId: 'user-1' } }],
          AND: [
            {
              OR: [{ contract: { is: null } }, { contract: { is: { status: 'WAIT_UPLOAD' } } }],
            },
          ],
        }),
        skip: 50,
        take: 50,
      }),
    );
    expect(result.page).toEqual({ page: 2, pageSize: 50, total: 0 });
  });

  it('maps list rows to contract items with prefixed id and counterpart', async () => {
    const req = { auth: { userId: 'seller-1' } };
    prisma.order.findMany.mockResolvedValueOnce([
      {
        id: '11111111-1111-1111-1111-111111111111',
        createdAt: new Date('2026-03-12T00:00:00.000Z'),
        listing: {
          title: 'Listing A',
          sellerUserId: 'seller-1',
          seller: { nickname: 'Seller' },
        },
        buyer: { nickname: 'Buyer' },
        contract: null,
      },
    ]);
    prisma.order.count.mockResolvedValueOnce(1);

    const result = await service.list(req, {});

    expect(result.items[0]).toMatchObject({
      id: 'contract-11111111-1111-1111-1111-111111111111',
      orderId: '11111111-1111-1111-1111-111111111111',
      listingTitle: 'Listing A',
      counterpartName: 'Buyer',
      status: 'WAIT_UPLOAD',
      canUpload: true,
    });
  });
});
