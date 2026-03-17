import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AddressesService } from '../src/modules/addresses/addresses.service';

const VALID_UUID = '22222222-2222-4222-8222-222222222222';
const USER_ID = 'user-1';

describe('AddressesService write-first suite', () => {
  let prisma: any;
  let service: AddressesService;

  beforeEach(() => {
    prisma = {
      $transaction: vi.fn(async (fn: any) => fn(prisma)),
      address: {
        findMany: vi.fn(),
        updateMany: vi.fn(),
        create: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
        deleteMany: vi.fn(),
      },
    };
    service = new AddressesService(prisma);
  });

  const authedReq = { auth: { userId: USER_ID } };

  it('rejects unauthenticated list', async () => {
    await expect(service.list({})).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('creates default address and clears previous default flags', async () => {
    prisma.address.updateMany.mockResolvedValueOnce({ count: 1 });
    prisma.address.create.mockResolvedValueOnce({
      id: VALID_UUID,
      userId: USER_ID,
      name: 'Alice',
      phone: '13800138000',
      regionCode: '110000',
      addressLine: 'Road 1',
      isDefault: true,
      createdAt: new Date('2026-03-12T00:00:00.000Z'),
      updatedAt: new Date('2026-03-12T00:00:00.000Z'),
    });

    const result = await service.create(authedReq, {
      name: 'Alice',
      phone: '13800138000',
      regionCode: '110000',
      addressLine: 'Road 1',
      isDefault: true,
    });

    expect(prisma.address.updateMany).toHaveBeenCalledWith({
      where: { userId: USER_ID, isDefault: true },
      data: { isDefault: false },
    });
    expect(prisma.address.create).toHaveBeenCalledWith({
      data: {
        userId: USER_ID,
        name: 'Alice',
        phone: '13800138000',
        regionCode: '110000',
        addressLine: 'Road 1',
        isDefault: true,
      },
    });
    expect(result).toMatchObject({
      id: VALID_UUID,
      userId: USER_ID,
      name: 'Alice',
      isDefault: true,
    });
  });

  it('rejects empty-string regionCode on create', async () => {
    await expect(
      service.create(authedReq, {
        name: 'Alice',
        phone: '13800138000',
        regionCode: '   ',
        addressLine: 'Road 1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects invalid addressId on update', async () => {
    await expect(service.update(authedReq, 'bad-id', { name: 'B' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects update when address does not exist', async () => {
    prisma.address.findFirst.mockResolvedValueOnce(null);
    await expect(service.update(authedReq, VALID_UUID, { name: 'B' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updates default address and clears previous defaults', async () => {
    prisma.address.findFirst.mockResolvedValueOnce({
      id: VALID_UUID,
      userId: USER_ID,
      name: 'Alice',
      phone: '13800138000',
      regionCode: '110000',
      addressLine: 'Road 1',
      isDefault: false,
      createdAt: new Date('2026-03-12T00:00:00.000Z'),
      updatedAt: new Date('2026-03-12T00:00:00.000Z'),
    });
    prisma.address.updateMany.mockResolvedValueOnce({ count: 1 });
    prisma.address.update.mockResolvedValueOnce({
      id: VALID_UUID,
      userId: USER_ID,
      name: 'Bob',
      phone: '13800138000',
      regionCode: '120000',
      addressLine: 'Road 2',
      isDefault: true,
      createdAt: new Date('2026-03-12T00:00:00.000Z'),
      updatedAt: new Date('2026-03-12T01:00:00.000Z'),
    });

    const result = await service.update(authedReq, VALID_UUID, {
      name: 'Bob',
      regionCode: '120000',
      addressLine: 'Road 2',
      isDefault: true,
    });

    expect(prisma.address.updateMany).toHaveBeenCalledWith({
      where: { userId: USER_ID, isDefault: true },
      data: { isDefault: false },
    });
    expect(prisma.address.update).toHaveBeenCalledWith({
      where: { id: VALID_UUID },
      data: {
        name: 'Bob',
        phone: '13800138000',
        regionCode: '120000',
        addressLine: 'Road 2',
        isDefault: true,
      },
    });
    expect(result).toMatchObject({ id: VALID_UUID, name: 'Bob', isDefault: true });
  });

  it('rejects invalid addressId on remove', async () => {
    await expect(service.remove(authedReq, 'nope')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects remove when target does not exist', async () => {
    prisma.address.deleteMany.mockResolvedValueOnce({ count: 0 });
    await expect(service.remove(authedReq, VALID_UUID)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('removes address successfully', async () => {
    prisma.address.deleteMany.mockResolvedValueOnce({ count: 1 });
    await expect(service.remove(authedReq, VALID_UUID)).resolves.toEqual({ ok: true });
    expect(prisma.address.deleteMany).toHaveBeenCalledWith({
      where: { id: VALID_UUID, userId: USER_ID },
    });
  });
});
