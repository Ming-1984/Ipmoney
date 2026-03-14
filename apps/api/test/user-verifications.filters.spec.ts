import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UsersService } from '../src/modules/users/users.service';

describe('UsersService admin verification list filter strictness suite', () => {
  let prisma: any;
  let service: UsersService;

  beforeEach(() => {
    prisma = {
      userVerification: {
        count: vi.fn(),
        findMany: vi.fn(),
      },
    };
    const audit = { log: vi.fn().mockResolvedValue(undefined) };
    const notifications = { create: vi.fn().mockResolvedValue(undefined) };
    service = new UsersService(prisma, audit as any, notifications as any);
  });

  it('rejects invalid pagination/type/status filters', async () => {
    await expect(service.adminListUserVerifications({ page: '0' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.adminListUserVerifications({ pageSize: '1.1' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.adminListUserVerifications({ type: '   ' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.adminListUserVerifications({ type: 'bad' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.adminListUserVerifications({ status: '   ' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.adminListUserVerifications({ status: 'bad' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('uses default pagination and empty where when no filters are provided', async () => {
    prisma.userVerification.count.mockResolvedValueOnce(0);
    prisma.userVerification.findMany.mockResolvedValueOnce([]);

    const result = await service.adminListUserVerifications({ q: '   ' });

    expect(prisma.userVerification.count).toHaveBeenCalledWith({ where: {} });
    expect(prisma.userVerification.findMany).toHaveBeenCalledWith({
      where: {},
      include: { logoFile: true },
      orderBy: { submittedAt: 'desc' },
      skip: 0,
      take: 10,
    });
    expect(result).toEqual({
      items: [],
      page: { page: 1, pageSize: 10, total: 0 },
    });
  });

  it('caps pageSize and applies normalized type/status + q filters', async () => {
    prisma.userVerification.count.mockResolvedValueOnce(1);
    prisma.userVerification.findMany.mockResolvedValueOnce([
      {
        id: 'v-1',
        userId: 'u-1',
        verificationType: 'COMPANY',
        verificationStatus: 'PENDING',
        displayName: 'Org A',
        unifiedSocialCreditCodeEnc: '9133XXXX',
        contactName: 'Alice',
        contactPhone: '13800138000',
        regionCode: '110000',
        intro: 'intro',
        logoFileId: 'f-1',
        logoFile: { url: 'https://example.com/logo.png' },
        evidenceFileIdsJson: ['e-1', 'e-2'],
        submittedAt: new Date('2026-03-13T00:00:00.000Z'),
        reviewedAt: null,
        reviewComment: null,
      },
    ]);

    const result = await service.adminListUserVerifications({
      page: '2',
      pageSize: '100',
      q: '  138  ',
      type: 'company',
      status: 'pending',
    });

    expect(prisma.userVerification.count).toHaveBeenCalledWith({
      where: {
        verificationType: 'COMPANY',
        verificationStatus: 'PENDING',
        OR: [{ displayName: { contains: '138' } }, { user: { phone: { contains: '138' } } }],
      },
    });
    expect(prisma.userVerification.findMany).toHaveBeenCalledWith({
      where: {
        verificationType: 'COMPANY',
        verificationStatus: 'PENDING',
        OR: [{ displayName: { contains: '138' } }, { user: { phone: { contains: '138' } } }],
      },
      include: { logoFile: true },
      orderBy: { submittedAt: 'desc' },
      skip: 50,
      take: 50,
    });
    expect(result.page).toEqual({ page: 2, pageSize: 50, total: 1 });
    expect(result.items[0]).toMatchObject({
      id: 'v-1',
      userId: 'u-1',
      type: 'COMPANY',
      status: 'PENDING',
      logoUrl: 'https://example.com/logo.png',
      evidenceFileIds: ['e-1', 'e-2'],
    });
  });
});
