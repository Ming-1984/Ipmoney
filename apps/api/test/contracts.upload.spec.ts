import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ContractsService } from '../src/modules/contracts/contracts.service';

const ORDER_ID = '11111111-1111-4111-8111-111111111111';
const CONTRACT_FILE_ID = '22222222-2222-4222-8222-222222222222';

describe('ContractsService upload suite', () => {
  let prisma: any;
  let service: ContractsService;

  beforeEach(() => {
    prisma = {
      order: {
        findUnique: vi.fn(),
      },
      file: {
        findUnique: vi.fn(),
      },
      contract: {
        upsert: vi.fn(),
      },
    };
    service = new ContractsService(prisma);
  });

  it('requires auth for upload', async () => {
    await expect(service.upload({} as any, ORDER_ID, {})).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects invalid contract id format', async () => {
    const req = { auth: { userId: 'seller-1' } };
    await expect(service.upload(req as any, 'bad-id', {})).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.order.findUnique).not.toHaveBeenCalled();
  });

  it('returns not found when order is missing', async () => {
    const req = { auth: { userId: 'seller-1' } };
    prisma.order.findUnique.mockResolvedValueOnce(null);

    await expect(service.upload(req as any, ORDER_ID, {})).rejects.toBeInstanceOf(NotFoundException);
  });

  it('forbids upload from non-seller user', async () => {
    const req = { auth: { userId: 'buyer-1' } };
    prisma.order.findUnique.mockResolvedValueOnce({
      id: ORDER_ID,
      listing: { sellerUserId: 'seller-1', title: 'Listing A', seller: { nickname: 'Seller' } },
      buyer: { nickname: 'Buyer' },
      contract: null,
      createdAt: new Date('2026-03-13T00:00:00.000Z'),
    });

    await expect(service.upload(req as any, ORDER_ID, {})).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects missing or invalid contractFileId', async () => {
    const req = { auth: { userId: 'seller-1' } };
    prisma.order.findUnique.mockResolvedValue({
      id: ORDER_ID,
      listing: { sellerUserId: 'seller-1', title: 'Listing A', seller: { nickname: 'Seller' } },
      buyer: { nickname: 'Buyer' },
      contract: null,
      createdAt: new Date('2026-03-13T00:00:00.000Z'),
    });

    await expect(service.upload(req as any, ORDER_ID, {})).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.upload(req as any, ORDER_ID, { contractFileId: 'bad-id' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects when contract file is missing or non-pdf', async () => {
    const req = { auth: { userId: 'seller-1' } };
    prisma.order.findUnique.mockResolvedValue({
      id: ORDER_ID,
      listing: { sellerUserId: 'seller-1', title: 'Listing A', seller: { nickname: 'Seller' } },
      buyer: { nickname: 'Buyer' },
      contract: null,
      createdAt: new Date('2026-03-13T00:00:00.000Z'),
    });

    prisma.file.findUnique.mockResolvedValueOnce(null);
    await expect(service.upload(req as any, ORDER_ID, { contractFileId: CONTRACT_FILE_ID })).rejects.toBeInstanceOf(
      BadRequestException,
    );

    prisma.file.findUnique.mockResolvedValueOnce({
      id: CONTRACT_FILE_ID,
      mimeType: 'image/png',
      url: 'https://example.com/file.png',
    });
    await expect(service.upload(req as any, ORDER_ID, { contractFileId: CONTRACT_FILE_ID })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('upserts contract with WAIT_CONFIRM status and prefixed contract id output', async () => {
    const req = { auth: { userId: 'seller-1' } };
    prisma.order.findUnique.mockResolvedValueOnce({
      id: ORDER_ID,
      listing: { sellerUserId: 'seller-1', title: 'Listing A', seller: { nickname: 'Seller' } },
      buyer: { nickname: 'Buyer' },
      contract: null,
      createdAt: new Date('2026-03-13T00:00:00.000Z'),
    });
    prisma.file.findUnique.mockResolvedValueOnce({
      id: CONTRACT_FILE_ID,
      mimeType: 'application/pdf',
      url: 'https://example.com/contract.pdf',
    });
    prisma.contract.upsert.mockResolvedValueOnce({
      orderId: ORDER_ID,
      status: 'WAIT_CONFIRM',
      contractFileId: CONTRACT_FILE_ID,
      fileUrl: 'https://example.com/contract.pdf',
      uploadedAt: new Date('2026-03-13T01:00:00.000Z'),
      signedAt: null,
      watermarkOwner: 'seller-1',
      createdAt: new Date('2026-03-13T01:00:00.000Z'),
      contractFile: { url: 'https://example.com/contract.pdf' },
    });

    const result = await service.upload(req as any, `contract-${ORDER_ID}`, {
      contractFileId: CONTRACT_FILE_ID,
    });

    expect(prisma.contract.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orderId: ORDER_ID },
        create: expect.objectContaining({
          status: 'WAIT_CONFIRM',
          contractFileId: CONTRACT_FILE_ID,
          fileUrl: 'https://example.com/contract.pdf',
          watermarkOwner: 'seller-1',
        }),
        update: expect.objectContaining({
          status: 'WAIT_CONFIRM',
          contractFileId: CONTRACT_FILE_ID,
          fileUrl: 'https://example.com/contract.pdf',
          watermarkOwner: 'seller-1',
        }),
      }),
    );
    expect(result).toMatchObject({
      id: `contract-${ORDER_ID}`,
      orderId: ORDER_ID,
      status: 'WAIT_CONFIRM',
      fileUrl: 'https://example.com/contract.pdf',
      canUpload: true,
    });
  });
});
