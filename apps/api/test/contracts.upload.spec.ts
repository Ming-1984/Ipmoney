import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ContractsService } from '../src/modules/contracts/contracts.service';

const ORDER_ID = '11111111-1111-4111-8111-111111111111';
const CONTRACT_FILE_ID = '22222222-2222-4222-8222-222222222222';
const SIGNED_FILE_ID = '33333333-3333-4333-8333-333333333333';
const SUBMISSION_ID = '44444444-4444-4444-8444-444444444444';
const OLD_SUBMISSION_ID = '55555555-5555-4555-8555-555555555555';
const OLD_SIGNED_FILE_ID = '66666666-6666-4666-8666-666666666666';

describe('ContractsService upload suite', () => {
  let prisma: any;
  let audit: any;
  let notifications: any;
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
      contractSignedSubmission: {
        findMany: vi.fn().mockResolvedValue([]),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        create: vi.fn(),
      },
    };
    prisma.$transaction = vi.fn(async (run: any) => run(prisma));
    audit = { log: vi.fn().mockResolvedValue(undefined) };
    notifications = { create: vi.fn().mockResolvedValue(undefined) };
    service = new ContractsService(prisma, audit, notifications);
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
      listing: { sellerUserId: 'seller-1', title: 'Listing A', seller: { nickname: 'Seller', verifications: [] } },
      buyer: { nickname: 'Buyer', verifications: [] },
      contract: null,
      createdAt: new Date('2026-03-13T00:00:00.000Z'),
    });

    await expect(service.upload(req as any, ORDER_ID, {})).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects missing or invalid contractFileId', async () => {
    const req = { auth: { userId: 'seller-1' } };
    prisma.order.findUnique.mockResolvedValue({
      id: ORDER_ID,
      listing: { sellerUserId: 'seller-1', title: 'Listing A', seller: { nickname: 'Seller', verifications: [] } },
      buyer: { nickname: 'Buyer', verifications: [] },
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
      listing: { sellerUserId: 'seller-1', title: 'Listing A', seller: { nickname: 'Seller', verifications: [] } },
      buyer: { nickname: 'Buyer', verifications: [] },
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

  it('rejects contract file that is not owned by the seller', async () => {
    const req = { auth: { userId: 'seller-1' } };
    prisma.order.findUnique.mockResolvedValueOnce({
      id: ORDER_ID,
      listing: { sellerUserId: 'seller-1', title: 'Listing A', seller: { nickname: 'Seller', verifications: [] } },
      buyer: { nickname: 'Buyer', verifications: [] },
      contract: null,
      createdAt: new Date('2026-03-13T00:00:00.000Z'),
    });
    prisma.file.findUnique.mockResolvedValueOnce({
      id: CONTRACT_FILE_ID,
      ownerId: 'other-user',
      mimeType: 'application/pdf',
      url: 'https://example.com/contract.pdf',
    });

    await expect(service.upload(req as any, ORDER_ID, { contractFileId: CONTRACT_FILE_ID })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.contract.upsert).not.toHaveBeenCalled();
    expect(prisma.contractSignedSubmission.updateMany).not.toHaveBeenCalled();
  });

  it('upserts contract with WAIT_CONFIRM status and prefixed contract id output', async () => {
    const req = { auth: { userId: 'seller-1' } };
    prisma.order.findUnique.mockResolvedValueOnce({
      id: ORDER_ID,
      status: 'DEPOSIT_PAID',
      listing: { sellerUserId: 'seller-1', title: 'Listing A', seller: { nickname: 'Seller', verifications: [] } },
      buyer: { nickname: 'Buyer', verifications: [] },
      contract: null,
      createdAt: new Date('2026-03-13T00:00:00.000Z'),
    });
    prisma.file.findUnique.mockResolvedValueOnce({
      id: CONTRACT_FILE_ID,
      ownerId: 'seller-1',
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
          signedContractFileId: null,
          signedSubmissionId: null,
          fileUrl: 'https://example.com/contract.pdf',
          signedAt: null,
          watermarkOwner: 'seller-1',
        }),
        update: expect.objectContaining({
          status: 'WAIT_CONFIRM',
          contractFileId: CONTRACT_FILE_ID,
          signedContractFileId: null,
          signedSubmissionId: null,
          fileUrl: 'https://example.com/contract.pdf',
          signedAt: null,
          watermarkOwner: 'seller-1',
        }),
      }),
    );
    expect(prisma.contractSignedSubmission.findMany).toHaveBeenCalledWith({
      where: { orderId: ORDER_ID, status: 'PENDING' },
      select: { id: true, fileId: true, submittedByUserId: true },
    });
    expect(prisma.contractSignedSubmission.updateMany).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      id: `contract-${ORDER_ID}`,
      orderId: ORDER_ID,
      status: 'WAIT_CONFIRM',
      fileUrl: 'https://example.com/contract.pdf',
      canUpload: true,
    });
  });

  it('submits signed contract PDF and supersedes older pending submissions', async () => {
    const req = {
      auth: { userId: 'buyer-1' },
      headers: { 'x-request-id': 'req-1', 'user-agent': 'vitest' },
      ip: '127.0.0.1',
    };
    prisma.order.findUnique.mockResolvedValueOnce({
      id: ORDER_ID,
      buyerUserId: 'buyer-1',
      assignedCsUserId: 'cs-1',
      listing: { sellerUserId: 'seller-1', title: 'Listing A', seller: { nickname: 'Seller', verifications: [] } },
      buyer: { nickname: 'Buyer', verifications: [] },
      contract: {
        orderId: ORDER_ID,
        status: 'WAIT_CONFIRM',
        contractFileId: CONTRACT_FILE_ID,
        signedSubmissions: [],
      },
      createdAt: new Date('2026-03-13T00:00:00.000Z'),
    });
    prisma.file.findUnique.mockResolvedValueOnce({
      id: SIGNED_FILE_ID,
      ownerId: 'buyer-1',
      mimeType: 'application/pdf',
      fileName: 'signed.pdf',
      url: 'https://example.com/signed.pdf',
    });
    prisma.contractSignedSubmission.findMany.mockResolvedValueOnce([
      { id: OLD_SUBMISSION_ID, fileId: OLD_SIGNED_FILE_ID, submittedByUserId: 'seller-1' },
    ]);
    prisma.contractSignedSubmission.create.mockResolvedValueOnce({
      id: SUBMISSION_ID,
      orderId: ORDER_ID,
      contractOrderId: ORDER_ID,
      fileId: SIGNED_FILE_ID,
      submittedByUserId: 'buyer-1',
      status: 'PENDING',
      file: { id: SIGNED_FILE_ID, fileName: 'signed.pdf', url: 'https://example.com/signed.pdf' },
      submittedBy: { nickname: 'Buyer', verifications: [] },
      createdAt: new Date('2026-03-13T02:00:00.000Z'),
      reviewedAt: null,
      rejectReason: null,
    });

    const result = await service.submitSignedContract(req as any, `contract-${ORDER_ID}`, { fileId: SIGNED_FILE_ID });

    expect(prisma.contractSignedSubmission.updateMany).toHaveBeenCalledWith({
      where: { orderId: ORDER_ID, status: 'PENDING' },
      data: { status: 'SUPERSEDED' },
    });
    expect(prisma.contractSignedSubmission.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orderId: ORDER_ID,
          contractOrderId: ORDER_ID,
          fileId: SIGNED_FILE_ID,
          submittedByUserId: 'buyer-1',
          status: 'PENDING',
        }),
      }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CONTRACT_SIGNED_SUBMISSION_CREATE',
        targetId: SUBMISSION_ID,
        afterJson: expect.objectContaining({ supersededCount: 1 }),
      }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CONTRACT_SIGNED_SUBMISSION_SUPERSEDE',
        targetId: OLD_SUBMISSION_ID,
        afterJson: expect.objectContaining({
          fileId: OLD_SIGNED_FILE_ID,
          reason: 'NEW_SIGNED_SUBMISSION',
          status: 'SUPERSEDED',
        }),
      }),
    );
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'cs-1',
        title: '用户已回传签署版合同',
      }),
    );
    expect(result).toMatchObject({
      id: SUBMISSION_ID,
      orderId: ORDER_ID,
      contractId: `contract-${ORDER_ID}`,
      status: 'PENDING',
      fileId: SIGNED_FILE_ID,
      fileUrl: 'https://example.com/signed.pdf',
      fileName: 'signed.pdf',
    });
  });
});
