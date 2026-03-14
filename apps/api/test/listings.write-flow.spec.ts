import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ListingsService } from '../src/modules/listings/listings.service';

const LISTING_ID = '11111111-1111-1111-1111-111111111111';
const USER_ID = 'user-1';

const USER_REQ = { auth: { userId: USER_ID } };
const ADMIN_REQ = { auth: { userId: 'admin-1', isAdmin: true } };

function buildListing(overrides: Record<string, unknown> = {}) {
  return {
    id: LISTING_ID,
    sellerUserId: USER_ID,
    source: 'USER',
    patentId: null,
    title: 'Listing A',
    summary: 'summary',
    tradeMode: 'ASSIGNMENT',
    licenseMode: null,
    priceType: 'NEGOTIABLE',
    priceAmount: 500,
    depositAmount: 100,
    deliverablesJson: ['deliverable-1'],
    expectedCompletionDays: 30,
    negotiableRangeFen: null,
    negotiableRangePercent: null,
    negotiableNote: null,
    pledgeStatus: 'NONE',
    existingLicenseStatus: 'NONE',
    encumbranceNote: null,
    regionCode: '440300',
    industryTagsJson: ['AI'],
    listingTopicsJson: ['AI'],
    proofFileIdsJson: ['file-1'],
    clusterId: '440304',
    auditStatus: 'PENDING',
    status: 'DRAFT',
    featuredLevel: 'NONE',
    featuredRegionCode: null,
    featuredRank: null,
    featuredUntil: null,
    createdAt: new Date('2026-03-13T00:00:00.000Z'),
    updatedAt: new Date('2026-03-13T01:00:00.000Z'),
    ...overrides,
  };
}

describe('ListingsService write flow suite', () => {
  let prisma: any;
  let audit: any;
  let notifications: any;
  let service: ListingsService;

  beforeEach(() => {
    prisma = {
      listing: {
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      file: {
        findMany: vi.fn(),
      },
      listingAuditLog: {
        create: vi.fn().mockResolvedValue(undefined),
      },
    };
    audit = { log: vi.fn().mockResolvedValue(undefined) };
    notifications = { create: vi.fn().mockResolvedValue(undefined) };
    const events = { recordView: vi.fn().mockResolvedValue(undefined) };
    const config = { getRecommendation: vi.fn().mockResolvedValue({ enabled: false }) };
    service = new ListingsService(prisma, audit, notifications, events as any, config as any);
  });

  it('validates create payload strictly', async () => {
    await expect(service.createListing(USER_REQ, { tradeMode: 'bad' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.createListing(USER_REQ, { licenseMode: '' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.createListing(USER_REQ, { priceType: 'bad' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.createListing(USER_REQ, { regionCode: '   ' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.createListing(USER_REQ, { title: '   ' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.createListing(USER_REQ, { patentNumberRaw: 'CN202410123456.7', transferCount: '9007199254740992' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.createListing(USER_REQ, { negotiableRangeFen: '100', negotiableRangePercent: '10' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('create normalizes payload and persists expected fields', async () => {
    prisma.listing.create.mockResolvedValueOnce(
      buildListing({
        title: 'Listing Create',
        summary: 'summary',
        tradeMode: 'LICENSE',
        licenseMode: 'EXCLUSIVE',
        priceType: 'FIXED',
        priceAmount: 1200,
        depositAmount: 100,
        listingTopicsJson: ['AI', 'ML'],
        proofFileIdsJson: ['file-1'],
        deliverablesJson: ['deliver-1'],
        expectedCompletionDays: 30,
        regionCode: '440300',
        clusterId: '440304',
        pledgeStatus: 'PLEDGED',
        existingLicenseStatus: 'NON_EXCLUSIVE',
        encumbranceNote: 'encumbrance',
      }),
    );

    const result = await service.createListing(USER_REQ, {
      title: ' Listing Create ',
      summary: ' summary ',
      tradeMode: 'license',
      licenseMode: 'exclusive',
      priceType: 'fixed',
      priceAmountFen: '1200',
      depositAmountFen: '100',
      listingTopics: [' ai ', '', 'ml'],
      proofFileIds: [' file-1 ', ''],
      deliverables: [' deliver-1 '],
      expectedCompletionDays: '30',
      regionCode: '440300',
      clusterId: '440304',
      pledgeStatus: 'pledged',
      existingLicenseStatus: 'non_exclusive',
      encumbranceNote: ' encumbrance ',
      industryTags: ['AI', 'smoke-tag-temp'],
    });

    expect(prisma.listing.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sellerUserId: USER_ID,
          source: 'USER',
          title: 'Listing Create',
          summary: 'summary',
          tradeMode: 'LICENSE',
          licenseMode: 'EXCLUSIVE',
          priceType: 'FIXED',
          priceAmount: 1200,
          depositAmount: 100,
          listingTopicsJson: ['AI', 'ML'],
          proofFileIdsJson: ['file-1'],
          deliverablesJson: ['deliver-1'],
          expectedCompletionDays: 30,
          regionCode: '440300',
          clusterId: '440304',
          pledgeStatus: 'PLEDGED',
          existingLicenseStatus: 'NON_EXCLUSIVE',
          encumbranceNote: 'encumbrance',
          industryTagsJson: ['AI', 'smoke-tag-temp'],
        }),
      }),
    );
    expect(result).toMatchObject({
      id: LISTING_ID,
      title: 'Listing Create',
      tradeMode: 'LICENSE',
      priceType: 'FIXED',
      sellerUserId: USER_ID,
    });
  });

  it('update validates ownership and strict patch fields', async () => {
    prisma.listing.findUnique.mockResolvedValueOnce(null);
    await expect(service.updateListing(USER_REQ, LISTING_ID, {})).rejects.toBeInstanceOf(NotFoundException);

    prisma.listing.findUnique.mockResolvedValueOnce(buildListing({ sellerUserId: 'other-user' }));
    await expect(service.updateListing(USER_REQ, LISTING_ID, {})).rejects.toBeInstanceOf(NotFoundException);

    prisma.listing.findUnique.mockResolvedValueOnce(buildListing());
    await expect(service.updateListing(USER_REQ, LISTING_ID, { title: ' ' })).rejects.toBeInstanceOf(BadRequestException);

    prisma.listing.findUnique.mockResolvedValueOnce(buildListing());
    await expect(service.updateListing(USER_REQ, LISTING_ID, { priceType: 'bad' })).rejects.toBeInstanceOf(BadRequestException);

    prisma.listing.findUnique.mockResolvedValueOnce(buildListing());
    await expect(service.updateListing(USER_REQ, LISTING_ID, { regionCode: '' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('update applies normalized patch fields', async () => {
    prisma.listing.findUnique.mockResolvedValueOnce(buildListing());
    prisma.listing.update.mockResolvedValueOnce(
      buildListing({
        title: 'Listing Updated',
        summary: 'summary updated',
        tradeMode: 'ASSIGNMENT',
        licenseMode: 'SOLE',
        priceType: 'NEGOTIABLE',
        priceAmount: 0,
        depositAmount: 200,
        listingTopicsJson: ['BIO'],
        proofFileIdsJson: ['file-2'],
        deliverablesJson: ['deliver-2'],
        expectedCompletionDays: 45,
        pledgeStatus: 'NONE',
        existingLicenseStatus: 'UNKNOWN',
        encumbranceNote: 'clean',
        regionCode: null,
        clusterId: null,
      }),
    );

    const result = await service.updateListing(USER_REQ, LISTING_ID, {
      title: ' Listing Updated ',
      summary: ' summary updated ',
      tradeMode: 'assignment',
      licenseMode: 'sole',
      priceType: 'negotiable',
      priceAmountFen: '0',
      depositAmountFen: '200',
      listingTopics: [' bio '],
      proofFileIds: [' file-2 '],
      deliverables: [' deliver-2 '],
      expectedCompletionDays: '45',
      pledgeStatus: 'none',
      existingLicenseStatus: 'unknown',
      encumbranceNote: ' clean ',
      regionCode: null,
      clusterId: null,
    });

    expect(prisma.listing.update).toHaveBeenCalledWith({
      where: { id: LISTING_ID },
      data: expect.objectContaining({
        title: 'Listing Updated',
        summary: 'summary updated',
        tradeMode: 'ASSIGNMENT',
        licenseMode: 'SOLE',
        priceType: 'NEGOTIABLE',
        priceAmount: 0,
        depositAmount: 200,
        listingTopicsJson: ['BIO'],
        proofFileIdsJson: ['file-2'],
        deliverablesJson: ['deliver-2'],
        expectedCompletionDays: 45,
        pledgeStatus: 'NONE',
        existingLicenseStatus: 'UNKNOWN',
        encumbranceNote: 'clean',
        regionCode: null,
        clusterId: null,
      }),
    });
    expect(result).toMatchObject({
      id: LISTING_ID,
      title: 'Listing Updated',
      tradeMode: 'ASSIGNMENT',
      priceType: 'NEGOTIABLE',
    });
  });

  it('submit and offShelf enforce ownership/file checks and transitions', async () => {
    prisma.listing.findUnique.mockResolvedValueOnce(null);
    await expect(service.submitListing(USER_REQ, LISTING_ID)).rejects.toBeInstanceOf(NotFoundException);

    prisma.listing.findUnique.mockResolvedValueOnce(buildListing({ sellerUserId: 'other-user' }));
    await expect(service.submitListing(USER_REQ, LISTING_ID)).rejects.toBeInstanceOf(NotFoundException);

    prisma.listing.findUnique.mockResolvedValueOnce(buildListing({ proofFileIdsJson: [] }));
    await expect(service.submitListing(USER_REQ, LISTING_ID)).rejects.toBeInstanceOf(BadRequestException);

    prisma.listing.findUnique.mockResolvedValueOnce(buildListing());
    prisma.file.findMany.mockResolvedValueOnce([]);
    await expect(service.submitListing(USER_REQ, LISTING_ID)).rejects.toBeInstanceOf(BadRequestException);

    prisma.listing.findUnique.mockResolvedValueOnce(buildListing());
    prisma.file.findMany.mockResolvedValueOnce([{ id: 'file-1', ownerId: 'other-user' }]);
    await expect(service.submitListing(USER_REQ, LISTING_ID)).rejects.toBeInstanceOf(ForbiddenException);

    prisma.listing.findUnique
      .mockResolvedValueOnce(buildListing())
      .mockResolvedValueOnce(buildListing({ sellerUserId: USER_ID }));
    prisma.file.findMany.mockResolvedValueOnce([{ id: 'file-1', ownerId: USER_ID }]);
    prisma.listing.update
      .mockResolvedValueOnce(buildListing({ status: 'ACTIVE', auditStatus: 'PENDING' }))
      .mockResolvedValueOnce(buildListing({ status: 'OFF_SHELF' }));

    const submitted = await service.submitListing(USER_REQ, LISTING_ID);
    const offShelved = await service.offShelf(USER_REQ, LISTING_ID);

    expect(prisma.listing.update).toHaveBeenNthCalledWith(1, {
      where: { id: LISTING_ID },
      data: { auditStatus: 'PENDING', status: 'ACTIVE' },
    });
    expect(prisma.listing.update).toHaveBeenNthCalledWith(2, {
      where: { id: LISTING_ID },
      data: { status: 'OFF_SHELF' },
    });
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'LISTING_SUBMIT', targetId: LISTING_ID }));
    expect(submitted.status).toBe('ACTIVE');
    expect(offShelved.status).toBe('OFF_SHELF');
  });

  it('adminCreate and adminUpdate validate strict fields and normalize writes', async () => {
    await expect(service.adminCreate(ADMIN_REQ, { title: 'A', status: 'bad' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.adminCreate(ADMIN_REQ, { title: 'A', sellerUserId: '' })).rejects.toBeInstanceOf(
      BadRequestException,
    );

    prisma.listing.create.mockResolvedValueOnce(
      buildListing({
        sellerUserId: 'owner-2',
        source: 'PLATFORM',
        tradeMode: 'LICENSE',
        priceType: 'FIXED',
        auditStatus: 'APPROVED',
        status: 'ACTIVE',
      }),
    );

    const created = await service.adminCreate(ADMIN_REQ, {
      title: ' Admin Listing ',
      source: 'platform',
      sellerUserId: ' owner-2 ',
      tradeMode: 'license',
      priceType: 'fixed',
      auditStatus: 'approved',
      status: 'active',
    });

    expect(prisma.listing.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sellerUserId: 'owner-2',
          source: 'PLATFORM',
          title: 'Admin Listing',
          tradeMode: 'LICENSE',
          priceType: 'FIXED',
          auditStatus: 'APPROVED',
          status: 'ACTIVE',
        }),
      }),
    );
    expect(created.status).toBe('ACTIVE');

    prisma.listing.findUnique.mockResolvedValueOnce(null);
    await expect(service.adminUpdate(ADMIN_REQ, LISTING_ID, { title: 'x' })).rejects.toBeInstanceOf(NotFoundException);

    prisma.listing.findUnique.mockResolvedValueOnce(buildListing());
    prisma.listing.update.mockResolvedValueOnce(
      buildListing({
        sellerUserId: 'owner-3',
        source: 'ADMIN',
        title: 'Admin Updated',
        auditStatus: 'REJECTED',
        status: 'OFF_SHELF',
      }),
    );

    const updated = await service.adminUpdate(ADMIN_REQ, LISTING_ID, {
      sellerUserId: ' owner-3 ',
      source: 'admin',
      title: ' Admin Updated ',
      auditStatus: 'rejected',
      status: 'off_shelf',
    });

    expect(prisma.listing.update).toHaveBeenCalledWith({
      where: { id: LISTING_ID },
      data: expect.objectContaining({
        sellerUserId: 'owner-3',
        source: 'ADMIN',
        title: 'Admin Updated',
        auditStatus: 'REJECTED',
        status: 'OFF_SHELF',
      }),
    });
    expect(updated).toMatchObject({
      id: LISTING_ID,
      title: 'Admin Updated',
      source: 'ADMIN',
      status: 'OFF_SHELF',
    });
  });

  it('admin publish/off-shelf and approve/reject apply expected transitions', async () => {
    prisma.listing.findUnique.mockResolvedValueOnce(null);
    await expect(service.adminPublish(ADMIN_REQ, LISTING_ID)).rejects.toBeInstanceOf(NotFoundException);

    prisma.listing.findUnique.mockResolvedValueOnce(buildListing());
    prisma.listing.update.mockResolvedValueOnce(buildListing({ status: 'ACTIVE', auditStatus: 'APPROVED' }));
    const published = await service.adminPublish(ADMIN_REQ, LISTING_ID);
    expect(published).toMatchObject({ id: LISTING_ID, status: 'ACTIVE', auditStatus: 'APPROVED' });

    prisma.listing.findUnique.mockResolvedValueOnce(null);
    await expect(service.adminOffShelf(ADMIN_REQ, LISTING_ID)).rejects.toBeInstanceOf(NotFoundException);

    prisma.listing.findUnique.mockResolvedValueOnce(buildListing());
    prisma.listing.update.mockResolvedValueOnce(buildListing({ status: 'OFF_SHELF' }));
    const offShelved = await service.adminOffShelf(ADMIN_REQ, LISTING_ID);
    expect(offShelved).toMatchObject({ id: LISTING_ID, status: 'OFF_SHELF' });

    prisma.listing.update.mockRejectedValueOnce({ code: 'P2025' });
    await expect(service.approve(LISTING_ID, 'admin-reviewer', 'ok')).rejects.toBeInstanceOf(NotFoundException);

    prisma.listing.update.mockResolvedValueOnce(buildListing({ auditStatus: 'APPROVED', sellerUserId: USER_ID }));
    const approved = await service.approve(LISTING_ID, 'admin-reviewer', 'ok');
    expect(approved).toMatchObject({ id: LISTING_ID, auditStatus: 'APPROVED' });

    prisma.listing.update.mockRejectedValueOnce({ code: 'P2025' });
    await expect(service.reject(LISTING_ID, 'admin-reviewer', 'bad')).rejects.toBeInstanceOf(NotFoundException);

    prisma.listing.update.mockResolvedValueOnce(buildListing({ auditStatus: 'REJECTED', sellerUserId: USER_ID }));
    const rejected = await service.reject(LISTING_ID, 'admin-reviewer', 'bad');
    expect(rejected).toMatchObject({ id: LISTING_ID, auditStatus: 'REJECTED' });

    expect(prisma.listingAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ listingId: LISTING_ID, reviewerId: 'admin-reviewer', action: 'APPROVE' }),
      }),
    );
    expect(prisma.listingAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ listingId: LISTING_ID, reviewerId: 'admin-reviewer', action: 'REJECT' }),
      }),
    );
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'LISTING_APPROVE', targetId: LISTING_ID }));
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'LISTING_REJECT', targetId: LISTING_ID }));
    expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({ userId: USER_ID }));
  });

  it('updateFeatured rejects unsafe integer featuredRank', async () => {
    await expect(
      service.updateFeatured(LISTING_ID, {
        featuredLevel: 'CITY',
        featuredRegionCode: '110000',
        featuredRank: '9007199254740992',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
