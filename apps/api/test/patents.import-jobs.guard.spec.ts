import { BadRequestException, ConflictException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PatentsService } from '../src/modules/patents/patents.service';

const JOB_ID = '11111111-1111-4111-8111-111111111111';
const FILE_ID = '22222222-2222-4222-8222-222222222222';

describe('PatentsService import job guard suite', () => {
  let prisma: any;
  let service: PatentsService;

  beforeEach(() => {
    prisma = {
      patentImportJob: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    };
    service = new PatentsService(prisma);
  });

  it('rejects validateImportJob when job is running', async () => {
    prisma.patentImportJob.findUnique.mockResolvedValueOnce({
      id: JOB_ID,
      fileId: FILE_ID,
      status: 'RUNNING',
    });

    await expect(service.validateImportJob({}, JOB_ID)).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects executeImportJob when job is running', async () => {
    prisma.patentImportJob.findUnique.mockResolvedValueOnce({
      id: JOB_ID,
      fileId: FILE_ID,
      status: 'RUNNING',
      validatedAt: new Date('2026-03-01T00:00:00.000Z'),
    });

    await expect(service.executeImportJob({}, JOB_ID)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.patentImportJob.update).not.toHaveBeenCalled();
  });

  it('requires validatedAt before executeImportJob', async () => {
    prisma.patentImportJob.findUnique.mockResolvedValueOnce({
      id: JOB_ID,
      fileId: FILE_ID,
      status: 'PENDING',
      validatedAt: null,
    });

    await expect(service.executeImportJob({}, JOB_ID)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.patentImportJob.update).not.toHaveBeenCalled();
  });
});

