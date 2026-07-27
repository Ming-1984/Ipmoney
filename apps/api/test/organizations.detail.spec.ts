import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OrganizationsService } from '../src/modules/organizations/organizations.service';

const VALID_ORG_USER_ID = '33333333-3333-4333-8333-333333333333';

describe('OrganizationsService detail suite', () => {
  let prisma: any;
  let service: OrganizationsService;

  beforeEach(() => {
    prisma = {
      userVerification: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      listing: {
        count: vi.fn(),
        groupBy: vi.fn(),
        findMany: vi.fn(),
      },
    };
    service = new OrganizationsService(prisma);
  });

  it('rejects invalid orgUserId format', async () => {
    await expect(service.getById('bad-id')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.userVerification.findFirst).not.toHaveBeenCalled();
  });

  it('returns not found when organization is missing or not approved org type', async () => {
    prisma.userVerification.findFirst.mockResolvedValueOnce(null);

    await expect(service.getById(VALID_ORG_USER_ID)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.listing.count).not.toHaveBeenCalled();
  });

  it('does not expose approved organizations without a public display name', async () => {
    prisma.userVerification.findMany.mockResolvedValueOnce([
      {
        userId: '11111111-1111-4111-8111-111111111111',
        displayName: '',
        verificationType: 'COMPANY',
        verificationStatus: 'APPROVED',
        regionCode: '110000',
        intro: 'hidden empty name',
        reviewedAt: new Date('2026-03-12T00:00:00.000Z'),
        logoFile: null,
      },
      {
        userId: VALID_ORG_USER_ID,
        displayName: 'Org Alpha',
        verificationType: 'COMPANY',
        verificationStatus: 'APPROVED',
        regionCode: '110000',
        intro: 'intro text',
        reviewedAt: new Date('2026-03-13T00:00:00.000Z'),
        logoFile: null,
      },
    ]);
    prisma.listing.groupBy.mockResolvedValueOnce([]);
    prisma.listing.findMany.mockResolvedValueOnce([]);

    const result = await service.list({ page: '1', pageSize: '20' });

    expect(result.page.total).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].displayName).toBe('Org Alpha');
  });

  it('returns not found when organization detail has no public display name', async () => {
    prisma.userVerification.findFirst.mockResolvedValueOnce({
      userId: VALID_ORG_USER_ID,
      displayName: '   ',
      verificationType: 'COMPANY',
      verificationStatus: 'APPROVED',
      regionCode: '110000',
      intro: 'hidden empty name',
      reviewedAt: new Date('2026-03-13T00:00:00.000Z'),
      logoFile: null,
    });

    await expect(service.getById(VALID_ORG_USER_ID)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.listing.count).not.toHaveBeenCalled();
  });

  it('returns organization detail with listing/patent stats', async () => {
    prisma.userVerification.findFirst.mockResolvedValueOnce({
      userId: VALID_ORG_USER_ID,
      displayName: 'Org Alpha',
      verificationType: 'COMPANY',
      verificationStatus: 'APPROVED',
      regionCode: '110000',
      intro: 'intro text',
      reviewedAt: new Date('2026-03-13T00:00:00.000Z'),
      logoFile: { url: 'https://example.com/logo.png' },
    });
    prisma.listing.count.mockResolvedValueOnce(3);
    prisma.listing.findMany.mockResolvedValueOnce([{ patentId: 'p-1' }, { patentId: 'p-2' }]);

    const result = await service.getById(VALID_ORG_USER_ID);

    expect(prisma.userVerification.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: VALID_ORG_USER_ID,
          verificationStatus: 'APPROVED',
          verificationType: { in: ['COMPANY', 'ACADEMY', 'GOVERNMENT', 'ASSOCIATION'] },
        }),
      }),
    );
    expect(prisma.listing.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          sellerUserId: VALID_ORG_USER_ID,
          auditStatus: 'APPROVED',
          status: { in: ['ACTIVE', 'SOLD'] },
        }),
      }),
    );
    expect(result).toEqual({
      userId: VALID_ORG_USER_ID,
      displayName: 'Org Alpha',
      verificationType: 'COMPANY',
      verificationStatus: 'APPROVED',
      orgCategory: undefined,
      logoUrl: 'https://example.com/logo.png',
      regionCode: '110000',
      intro: 'intro text',
      stats: {
        listingCount: 3,
        patentCount: 2,
      },
      verifiedAt: '2026-03-13T00:00:00.000Z',
    });
  });

  it('maps nullable detail fields to undefined and returns zero stats', async () => {
    prisma.userVerification.findFirst.mockResolvedValueOnce({
      userId: VALID_ORG_USER_ID,
      displayName: 'Org Beta',
      verificationType: 'ACADEMY',
      verificationStatus: 'APPROVED',
      regionCode: null,
      intro: null,
      reviewedAt: null,
      logoFile: null,
    });
    prisma.listing.count.mockResolvedValueOnce(0);
    prisma.listing.findMany.mockResolvedValueOnce([]);

    const result = await service.getById(VALID_ORG_USER_ID);

    expect(result).toEqual({
      userId: VALID_ORG_USER_ID,
      displayName: 'Org Beta',
      verificationType: 'ACADEMY',
      verificationStatus: 'APPROVED',
      orgCategory: undefined,
      logoUrl: undefined,
      regionCode: undefined,
      intro: undefined,
      stats: {
        listingCount: 0,
        patentCount: 0,
      },
      verifiedAt: undefined,
    });
  });
});
