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
      },
      listing: {
        count: vi.fn(),
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
});
