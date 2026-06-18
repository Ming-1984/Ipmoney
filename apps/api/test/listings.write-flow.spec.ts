import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
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
    listingTopicsJson: ['AWARD_WINNING'],
    proofFileIdsJson: ['file-1'],
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
  let contentSecurity: any;
  let service: ListingsService;

  beforeEach(() => {
    prisma = {
      listing: {
        create: vi.fn(),
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      conversation: {
        findFirst: vi.fn(),
        create: vi.fn(),
      },
      listingConsultEvent: {
        create: vi.fn().mockResolvedValue(undefined),
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
    const events = { recordView: vi.fn().mockResolvedValue(undefined), recordConsult: vi.fn().mockResolvedValue(true) };
    const config = { getRecommendation: vi.fn().mockResolvedValue({ enabled: false }) };
    contentSecurity = {
      assertSafeTexts: vi.fn().mockResolvedValue(undefined),
      ensureReferencedFilesReady: vi.fn().mockResolvedValue(undefined),
    };
    service = new ListingsService(prisma, audit, notifications, events as any, config as any, contentSecurity);
  });

  it('validates create payload strictly', async () => {
    await expect(service.createListing(USER_REQ, { tradeMode: 'bad' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.createListing(USER_REQ, { licenseMode: '' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.createListing(USER_REQ, { priceType: 'bad' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.createListing(USER_REQ, { regionCode: '   ' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.createListing(USER_REQ, { regionCode: 'abc' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.createListing(USER_REQ, { title: '   ' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.createListing(USER_REQ, { patentNumberRaw: 'CN202410123456.7', transferCount: '9007199254740992' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.createListing(USER_REQ, { negotiableRangeFen: '100', negotiableRangePercent: '10' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('create normalizes payload and persists expected fields', async () => {
    prisma.file.findMany.mockResolvedValueOnce([{ id: 'file-1', ownerId: USER_ID }]);
    prisma.listing.create.mockResolvedValueOnce(
      buildListing({
        title: 'Listing Create',
        summary: 'summary',
        tradeMode: 'LICENSE',
        licenseMode: 'EXCLUSIVE',
        priceType: 'FIXED',
        priceAmount: 1200,
        depositAmount: 100,
        listingTopicsJson: ['HIGH_TECH_RETIRED', 'AWARD_WINNING'],
        proofFileIdsJson: ['file-1'],
        deliverablesJson: ['deliver-1'],
        expectedCompletionDays: 30,
        regionCode: '440300',
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
      listingTopics: [' high_tech_retired ', '', 'award_winning'],
      proofFileIds: [' file-1 ', ''],
      deliverables: [' deliver-1 '],
      expectedCompletionDays: '30',
      regionCode: '440300',
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
          listingTopicsJson: ['HIGH_TECH_RETIRED', 'AWARD_WINNING'],
          proofFileIdsJson: ['file-1'],
          deliverablesJson: ['deliver-1'],
          expectedCompletionDays: 30,
          regionCode: '440300',
          pledgeStatus: 'PLEDGED',
          existingLicenseStatus: 'NON_EXCLUSIVE',
          encumbranceNote: 'encumbrance',
          industryTagsJson: ['AI'],
        }),
      }),
    );
    expect(contentSecurity.assertSafeTexts).toHaveBeenCalled();
    expect(contentSecurity.ensureReferencedFilesReady).toHaveBeenCalledWith(
      expect.objectContaining({ userId: USER_ID, fileIds: ['file-1'], label: 'proofFileIds' }),
    );
    expect(result).toMatchObject({
      id: LISTING_ID,
      title: 'Listing Create',
      tradeMode: 'LICENSE',
      priceType: 'FIXED',
      sellerUserId: USER_ID,
    });
  });

  it('create keeps supported listingTopics values only when semantics are valid', async () => {
    prisma.listing.create.mockResolvedValueOnce(
      buildListing({
        title: 'Listing Topic Strict',
        tradeMode: 'LICENSE',
        licenseMode: 'NON_EXCLUSIVE',
        priceType: 'NEGOTIABLE',
        listingTopicsJson: ['OPEN_LICENSE'],
      }),
    );

    await service.createListing(USER_REQ, {
      title: 'Listing Topic Strict',
      tradeMode: 'license',
      licenseMode: 'non_exclusive',
      priceType: 'negotiable',
      listingTopics: ['legacy_retired_tag', 'open_license', 'foo', 'bar'],
    });

    expect(prisma.listing.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          listingTopicsJson: ['OPEN_LICENSE'],
        }),
      }),
    );
  });

  it('create rejects OPEN_LICENSE when tradeMode is not LICENSE', async () => {
    await expect(
      service.createListing(USER_REQ, {
        title: 'Listing Topic Strict',
        tradeMode: 'assignment',
        priceType: 'negotiable',
        listingTopics: ['open_license'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('create falls back to patent display number instead of synthetic english title', async () => {
    prisma.patent = {
      findFirst: vi.fn().mockResolvedValueOnce(null),
      create: vi.fn().mockResolvedValueOnce({
        id: 'patent-1',
        title: '202410123456.7',
        applicationNoDisplay: '202410123456.7',
        publicationNoDisplay: null,
        patentNoDisplay: null,
        grantPublicationNoDisplay: null,
      }),
    };
    prisma.patentIdentifier = {
      findUnique: vi.fn(),
      createMany: vi.fn().mockResolvedValueOnce({ count: 1 }),
    };
    prisma.listing.create.mockResolvedValueOnce(
      buildListing({
        patentId: 'patent-1',
        title: '202410123456.7',
      }),
    );

    await service.createListing(USER_REQ, {
      patentNumberRaw: '202410123456.7',
      patentType: 'invention',
      priceType: 'negotiable',
    });

    expect(prisma.patent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: '202410123456.7',
        }),
      }),
    );
    expect(prisma.listing.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: '202410123456.7',
        }),
      }),
    );
  });

  it('update validates ownership and strict patch fields', async () => {
    prisma.listing.findUnique.mockResolvedValueOnce(null);
    await expect(service.updateListing(USER_REQ, LISTING_ID, {})).rejects.toBeInstanceOf(NotFoundException);

    prisma.listing.findUnique.mockResolvedValueOnce(buildListing({ sellerUserId: 'other-user' }));
    await expect(service.updateListing(USER_REQ, LISTING_ID, {})).rejects.toBeInstanceOf(NotFoundException);

    prisma.listing.findUnique.mockResolvedValueOnce(buildListing({ auditStatus: 'APPROVED' }));
    await expect(service.updateListing(USER_REQ, LISTING_ID, { title: ' ' })).rejects.toBeInstanceOf(BadRequestException);

    prisma.listing.findUnique.mockResolvedValueOnce(buildListing({ auditStatus: 'APPROVED' }));
    await expect(service.updateListing(USER_REQ, LISTING_ID, { priceType: 'bad' })).rejects.toBeInstanceOf(BadRequestException);

    prisma.listing.findUnique.mockResolvedValueOnce(buildListing({ auditStatus: 'APPROVED' }));
    await expect(service.updateListing(USER_REQ, LISTING_ID, { regionCode: '' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('update applies normalized patch fields', async () => {
    prisma.listing.findUnique.mockResolvedValueOnce(buildListing({ auditStatus: 'PENDING', status: 'DRAFT' }));
    prisma.file.findMany.mockResolvedValueOnce([{ id: 'file-2', ownerId: USER_ID }]);
    prisma.listing.update.mockResolvedValueOnce(
      buildListing({
        title: 'Listing Updated',
        summary: 'summary updated',
        tradeMode: 'ASSIGNMENT',
        licenseMode: 'SOLE',
        priceType: 'NEGOTIABLE',
        priceAmount: 0,
        depositAmount: 200,
        listingTopicsJson: ['SLEEPING'],
        proofFileIdsJson: ['file-2'],
        deliverablesJson: ['deliver-2'],
        expectedCompletionDays: 45,
        pledgeStatus: 'NONE',
        existingLicenseStatus: 'UNKNOWN',
        encumbranceNote: 'clean',
        regionCode: null,
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
      listingTopics: [' sleeping '],
      proofFileIds: [' file-2 '],
      deliverables: [' deliver-2 '],
      expectedCompletionDays: '45',
      pledgeStatus: 'none',
      existingLicenseStatus: 'unknown',
      encumbranceNote: ' clean ',
      regionCode: null,
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
        listingTopicsJson: ['SLEEPING'],
        proofFileIdsJson: ['file-2'],
        deliverablesJson: ['deliver-2'],
        expectedCompletionDays: 45,
        pledgeStatus: 'NONE',
        existingLicenseStatus: 'UNKNOWN',
        encumbranceNote: 'clean',
        regionCode: null,
      }),
    });
    expect(contentSecurity.ensureReferencedFilesReady).toHaveBeenCalledWith(
      expect.objectContaining({ userId: USER_ID, fileIds: ['file-2'], label: 'proofFileIds' }),
    );
    expect(result).toMatchObject({
      id: LISTING_ID,
      title: 'Listing Updated',
      tradeMode: 'ASSIGNMENT',
      priceType: 'NEGOTIABLE',
    });
  });

  it('update rejects OPEN_LICENSE when effective tradeMode is not LICENSE', async () => {
    prisma.listing.findUnique.mockResolvedValueOnce(buildListing({ tradeMode: 'ASSIGNMENT', listingTopicsJson: [] }));

    await expect(
      service.updateListing(USER_REQ, LISTING_ID, {
        listingTopics: ['open_license'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('update allows clearing nullable text and amount fields', async () => {
    prisma.listing.findUnique.mockResolvedValueOnce(
      buildListing({
        summary: 'summary to clear',
        priceAmount: 500,
        depositAmount: 100,
        negotiableNote: 'note to clear',
        encumbranceNote: 'encumbrance to clear',
      }),
    );
    prisma.file.findMany.mockResolvedValueOnce([{ id: 'file-1', ownerId: USER_ID }]);
    prisma.listing.update.mockResolvedValueOnce(
      buildListing({
        summary: null,
        priceAmount: null,
        depositAmount: 0,
        negotiableNote: null,
        encumbranceNote: null,
      }),
    );

    const result = await service.updateListing(USER_REQ, LISTING_ID, {
      summary: '',
      priceAmountFen: null,
      depositAmountFen: null,
      negotiableNote: '',
      encumbranceNote: '',
    });

    expect(prisma.listing.update).toHaveBeenCalledWith({
      where: { id: LISTING_ID },
      data: expect.objectContaining({
        summary: null,
        priceAmount: null,
        depositAmount: 0,
        negotiableNote: null,
        encumbranceNote: null,
      }),
    });
    expect(result).toMatchObject({
      id: LISTING_ID,
      depositAmountFen: 0,
      negotiableNote: null,
      encumbranceNote: null,
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

    prisma.listing.findUnique.mockResolvedValueOnce(buildListing({ regionCode: null }));
    prisma.file.findMany.mockResolvedValueOnce([{ id: 'file-1', ownerId: USER_ID }]);
    await expect(service.submitListing(USER_REQ, LISTING_ID)).rejects.toBeInstanceOf(BadRequestException);

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
    await expect(service.adminCreate(ADMIN_REQ, { title: 'A', status: 'active' })).rejects.toBeInstanceOf(
      BadRequestException,
    );

    prisma.listing.create.mockResolvedValueOnce(
      buildListing({
        sellerUserId: 'owner-2',
        source: 'PLATFORM',
        tradeMode: 'LICENSE',
        licenseMode: 'EXCLUSIVE',
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
      licenseMode: 'exclusive',
      priceType: 'fixed',
      regionCode: '110000',
      auditStatus: 'approved',
      status: 'active',
    });

    expect(contentSecurity.ensureReferencedFilesReady).not.toHaveBeenCalled();
    expect(prisma.listing.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sellerUserId: 'owner-2',
          source: 'PLATFORM',
          title: 'Admin Listing',
          tradeMode: 'LICENSE',
          priceType: 'FIXED',
          regionCode: '110000',
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

    prisma.listing.findUnique.mockResolvedValueOnce(buildListing({ status: 'OFF_SHELF', auditStatus: 'PENDING', regionCode: null }));
    await expect(service.adminUpdate(ADMIN_REQ, LISTING_ID, { status: 'active' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('adminCreate falls back to patent metadata instead of synthetic listing title', async () => {
    prisma.patent = {
      findFirst: vi.fn().mockResolvedValueOnce(null),
      create: vi.fn().mockResolvedValueOnce({
        id: 'patent-2',
        title: '202410000000.1',
        applicationNoDisplay: '202410000000.1',
        publicationNoDisplay: null,
        patentNoDisplay: null,
        grantPublicationNoDisplay: null,
      }),
    };
    prisma.patentIdentifier = {
      findUnique: vi.fn(),
      createMany: vi.fn().mockResolvedValueOnce({ count: 1 }),
    };
    prisma.listing.create.mockResolvedValueOnce(
      buildListing({
        title: '202410000000.1',
        patentId: 'patent-2',
      }),
    );

    await service.adminCreate(ADMIN_REQ, {
      sellerUserId: USER_ID,
      patentNumberRaw: '202410000000.1',
      patentType: 'invention',
      auditStatus: 'pending',
      status: 'draft',
    });

    expect(prisma.listing.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: '202410000000.1',
        }),
      }),
    );
  });

  it('adminUpdate allows clearing nullable text and amount fields', async () => {
    prisma.listing.findUnique.mockResolvedValueOnce(
      buildListing({
        summary: 'summary to clear',
        priceAmount: 800,
        depositAmount: 300,
        negotiableNote: 'note to clear',
        encumbranceNote: 'encumbrance to clear',
      }),
    );
    prisma.listing.update.mockResolvedValueOnce(
      buildListing({
        summary: null,
        priceAmount: null,
        depositAmount: 0,
        negotiableNote: null,
        encumbranceNote: null,
      }),
    );

    const result = await service.adminUpdate(ADMIN_REQ, LISTING_ID, {
      summary: '',
      priceAmountFen: null,
      depositAmountFen: null,
      negotiableNote: '',
      encumbranceNote: '',
    });

    expect(prisma.listing.update).toHaveBeenCalledWith({
      where: { id: LISTING_ID },
      data: expect.objectContaining({
        summary: null,
        priceAmount: null,
        depositAmount: 0,
        negotiableNote: null,
        encumbranceNote: null,
      }),
    });
    expect(result).toMatchObject({
      id: LISTING_ID,
      depositAmountFen: 0,
      negotiableNote: null,
      encumbranceNote: null,
    });
  });

  it('admin publish/off-shelf and approve/reject apply expected transitions', async () => {
    prisma.listing.findUnique.mockResolvedValueOnce(null);
    await expect(service.adminPublish(ADMIN_REQ, LISTING_ID)).rejects.toBeInstanceOf(NotFoundException);

    prisma.listing.findUnique.mockResolvedValueOnce(buildListing({ auditStatus: 'PENDING' }));
    await expect(service.adminPublish(ADMIN_REQ, LISTING_ID)).rejects.toBeInstanceOf(ConflictException);

    prisma.listing.findUnique.mockResolvedValueOnce(buildListing({ auditStatus: 'APPROVED', regionCode: null }));
    await expect(service.adminPublish(ADMIN_REQ, LISTING_ID)).rejects.toBeInstanceOf(BadRequestException);

    prisma.listing.findUnique.mockResolvedValueOnce(buildListing({ auditStatus: 'APPROVED' }));
    prisma.listing.update.mockResolvedValueOnce(buildListing({ status: 'ACTIVE', auditStatus: 'APPROVED' }));
    const published = await service.adminPublish(ADMIN_REQ, LISTING_ID);
    expect(published).toMatchObject({ id: LISTING_ID, status: 'ACTIVE', auditStatus: 'APPROVED' });
    expect(prisma.listing.update).toHaveBeenCalledWith({
      where: { id: LISTING_ID },
      data: { status: 'ACTIVE' },
    });

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

  it('createConsultation returns conversationId and reuses existing conversation', async () => {
    const req = { auth: { userId: USER_ID } };
    prisma.listing.findFirst.mockResolvedValueOnce(
      buildListing({ sellerUserId: 'seller-1', auditStatus: 'APPROVED', status: 'ACTIVE' }),
    );
    prisma.conversation.findFirst.mockResolvedValueOnce({
      id: 'conv-1',
      contentType: 'LISTING',
      contentId: LISTING_ID,
      listingId: LISTING_ID,
      buyerUserId: USER_ID,
      sellerUserId: 'seller-1',
    });

    const res = await service.createConsultation(req, LISTING_ID, { channel: 'FORM' });

    expect(res).toEqual({ ok: true, conversationId: 'conv-1' });
    expect(prisma.conversation.create).not.toHaveBeenCalled();
    expect(prisma.listingConsultEvent.create).toHaveBeenCalledWith({
      data: {
        listingId: LISTING_ID,
        userId: USER_ID,
        channel: 'FORM',
      },
    });
  });

  it('createConsultation hides non-public listings', async () => {
    const req = { auth: { userId: USER_ID } };
    prisma.listing.findFirst.mockResolvedValueOnce(null);

    await expect(service.createConsultation(req, LISTING_ID, { channel: 'FORM' })).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.listing.findFirst).toHaveBeenCalledWith({
      where: {
        id: LISTING_ID,
        auditStatus: 'APPROVED',
        status: 'ACTIVE',
      },
    });
    expect(prisma.listingConsultEvent.create).not.toHaveBeenCalled();
    expect(prisma.conversation.create).not.toHaveBeenCalled();
  });

  it('getPublicById uses formal seller displayName and does not fall back to nickname', async () => {
    prisma.listing.findFirst.mockResolvedValueOnce({
      ...buildListing({
        source: 'USER',
        auditStatus: 'APPROVED',
        status: 'ACTIVE',
      }),
      patent: {
        parties: [],
        classifications: [],
      },
      seller: {
        id: 'seller-public-1',
        nickname: 'Fallback Nick',
        avatarUrl: 'https://example.com/seller-public-1.png',
        verifications: [{ displayName: '正式机构名', verificationType: 'COMPANY', verificationStatus: 'APPROVED' }],
      },
      stats: null,
      media: [],
    });

    const result = await service.getPublicById({}, LISTING_ID);

    expect(result.seller).toMatchObject({
      id: 'seller-public-1',
      nickname: '正式机构名',
      avatarUrl: 'https://example.com/seller-public-1.png',
      verificationType: 'COMPANY',
      verificationStatus: 'APPROVED',
      orgCategory: 'OTHER',
    });
  });

  it('getPublicById leaves seller nickname empty when no formal displayName exists', async () => {
    prisma.listing.findFirst.mockResolvedValueOnce({
      ...buildListing({
        source: 'USER',
        auditStatus: 'APPROVED',
        status: 'ACTIVE',
      }),
      patent: {
        parties: [],
        classifications: [],
      },
      seller: {
        id: 'seller-public-2',
        nickname: 'Fallback Nick',
        avatarUrl: 'https://example.com/seller-public-2.png',
        verifications: [],
      },
      stats: null,
      media: [],
    });

    const result = await service.getPublicById({}, LISTING_ID);

    expect(result.seller).toMatchObject({
      id: 'seller-public-2',
      avatarUrl: 'https://example.com/seller-public-2.png',
    });
    expect(result.seller?.nickname).toBeUndefined();
    expect(result.seller?.verificationType).toBeUndefined();
    expect(result.seller?.verificationStatus).toBeUndefined();
  });

  it('getPublicById hides personal verification metadata for platform-branded seller summary', async () => {
    prisma.listing.findFirst.mockResolvedValueOnce({
      ...buildListing({
        source: 'ADMIN',
        consultationRouting: 'PLATFORM',
        auditStatus: 'APPROVED',
        status: 'ACTIVE',
      }),
      patent: {
        parties: [],
        classifications: [],
      },
      seller: {
        id: 'seller-platform',
        nickname: 'Raw Platform User',
        avatarUrl: null,
        verifications: [{ displayName: '个人主体', verificationType: 'PERSON', verificationStatus: 'APPROVED' }],
      },
      stats: null,
      media: [],
    });

    const result = await service.getPublicById({}, LISTING_ID);

    expect(result.seller).toMatchObject({
      id: 'seller-platform',
      nickname: 'ipmoney',
      avatarUrl: null,
    });
    expect(result.seller?.verificationType).toBeUndefined();
    expect(result.seller?.verificationStatus).toBeUndefined();
    expect(result.seller?.orgCategory).toBeUndefined();
  });

  it('getPublicById hides non-public listings', async () => {
    prisma.listing.findFirst = vi.fn().mockResolvedValueOnce(null);

    await expect(service.getPublicById({}, LISTING_ID)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.listing.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: LISTING_ID,
          auditStatus: 'APPROVED',
          status: 'ACTIVE',
        }),
      }),
    );
  });
});
