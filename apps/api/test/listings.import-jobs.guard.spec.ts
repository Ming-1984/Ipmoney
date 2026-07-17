import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ListingsService } from '../src/modules/listings/listings.service';

const JOB_ID = '11111111-1111-4111-8111-111111111111';
const FILE_ID = '22222222-2222-4222-8222-222222222222';

describe('ListingsService import job guard suite', () => {
  let prisma: any;
  let service: ListingsService;

  beforeEach(() => {
    prisma = {
      listingImportJob: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    };
    const audit = { log: vi.fn().mockResolvedValue(undefined) };
    const notifications = { create: vi.fn().mockResolvedValue(undefined) };
    const opsNotifications = { enqueueListingConsultationCreated: vi.fn().mockResolvedValue({ count: 1 }) };
    const events = { adjustFavoriteCount: vi.fn().mockResolvedValue(undefined) };
    const config = { getRecommendation: vi.fn().mockResolvedValue({ enabled: false }) };
    const contentSecurity = {
      assertSafeTexts: vi.fn().mockResolvedValue(undefined),
      ensureReferencedFilesReady: vi.fn().mockResolvedValue(undefined),
    };

    service = new ListingsService(
      prisma,
      audit as any,
      notifications as any,
      opsNotifications as any,
      events as any,
      config as any,
      contentSecurity,
    );
  });

  it('rejects validateImportJob when job is running', async () => {
    prisma.listingImportJob.findUnique.mockResolvedValueOnce({
      id: JOB_ID,
      fileId: FILE_ID,
      status: 'RUNNING',
    });

    await expect(service.validateImportJob({}, JOB_ID)).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects executeImportJob when job is running', async () => {
    prisma.listingImportJob.findUnique.mockResolvedValueOnce({
      id: JOB_ID,
      fileId: FILE_ID,
      status: 'RUNNING',
      validatedAt: new Date('2026-03-01T00:00:00.000Z'),
    });

    await expect(service.executeImportJob({}, JOB_ID)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.listingImportJob.update).not.toHaveBeenCalled();
  });

  it('requires validatedAt before executeImportJob', async () => {
    prisma.listingImportJob.findUnique.mockResolvedValueOnce({
      id: JOB_ID,
      fileId: FILE_ID,
      status: 'PENDING',
      validatedAt: null,
    });

    await expect(service.executeImportJob({}, JOB_ID)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.listingImportJob.update).not.toHaveBeenCalled();
  });

  it('rejects missing import job consistently', async () => {
    prisma.listingImportJob.findUnique.mockResolvedValueOnce(null);
    await expect(service.validateImportJob({}, JOB_ID)).rejects.toBeInstanceOf(NotFoundException);

    prisma.listingImportJob.findUnique.mockResolvedValueOnce(null);
    await expect(service.executeImportJob({}, JOB_ID)).rejects.toBeInstanceOf(NotFoundException);
  });
});
