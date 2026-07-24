import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PatentsService } from '../src/modules/patents/patents.service';

const ADMIN_REQ = { auth: { isAdmin: true } };
const VALID_ID = '11111111-1111-1111-1111-111111111111';

describe('PatentsService write and normalize suite', () => {
  let prisma: any;
  let service: PatentsService;

  beforeEach(() => {
    prisma = {
      $transaction: vi.fn(),
      file: {
        findUnique: vi.fn(),
      },
      idempotencyKey: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      patentImportJob: {
        create: vi.fn(),
      },
      patent: {
        upsert: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      order: {
        count: vi.fn(),
      },
      listing: {
        updateMany: vi.fn(),
      },
      patentClaimRequest: {
        findUnique: vi.fn(),
        updateMany: vi.fn(),
      },
      patentParty: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        createMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };
    service = new PatentsService(prisma);
    prisma.$transaction.mockImplementation(async (handler: any) =>
      typeof handler === 'function' ? handler(prisma) : Promise.all(handler),
    );
    prisma.idempotencyKey.findUnique.mockResolvedValue(null);
    prisma.idempotencyKey.create.mockResolvedValue({ id: 'idem-1', status: 'PENDING', responseCode: null, responseBody: null });
    prisma.idempotencyKey.update.mockResolvedValue({ id: 'idem-1', status: 'SUCCEEDED', responseCode: 200, responseBody: '{}' });
  });

  it('requires admin for write paths', async () => {
    await expect(service.adminCreate({}, {})).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.adminUpdate({}, VALID_ID, {})).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('validates adminCreate payload strictly', async () => {
    await expect(
      service.adminCreate(ADMIN_REQ, {
        applicationNoDisplay: 'bad-no',
        patentType: 'INVENTION',
        title: 'x',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.adminCreate(ADMIN_REQ, {
        applicationNoDisplay: '202410000000.1',
        title: 'x',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.adminCreate(ADMIN_REQ, {
        applicationNoDisplay: '202410000000.1',
        patentType: 'INVENTION',
        title: ' ',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.adminCreate(ADMIN_REQ, {
        applicationNoDisplay: '202410000000.1',
        patentType: 'INVENTION',
        title: 'x',
        jurisdiction: 'US',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.adminCreate(ADMIN_REQ, {
        applicationNoDisplay: '202410000000.1',
        patentType: 'INVENTION',
        title: 'x',
        sourcePrimary: 'bad-source',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('adminCreate upserts patent, syncs parties, and returns by id', async () => {
    prisma.patent.upsert.mockResolvedValueOnce({ id: VALID_ID });
    const getByIdSpy = vi.spyOn(service, 'getPatentById').mockResolvedValueOnce({ id: VALID_ID } as any);

    const result = await service.adminCreate(ADMIN_REQ, {
      applicationNoDisplay: '202410000000.1',
      patentType: 'invention',
      title: ' Patent A ',
      abstract: '',
      inventorNames: ['Alice', 'Alice', ''],
      assigneeNames: 'Org A,Org B',
      applicantNames: ['   '],
      filingDate: '2024-01-01',
      publicationDate: null,
      sourcePrimary: 'admin',
      sourceUpdatedAt: '2026-03-13T00:00:00.000Z',
    });

    expect(prisma.patent.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          jurisdiction_applicationNoNorm: {
            jurisdiction: 'CN',
            applicationNoNorm: '2024100000001',
          },
        },
        create: expect.objectContaining({
          jurisdiction: 'CN',
          applicationNoNorm: '2024100000001',
          applicationNoDisplay: '202410000000.1',
          patentType: 'INVENTION',
          title: 'Patent A',
          abstract: null,
          sourcePrimary: 'ADMIN',
        }),
      }),
    );
    expect(prisma.patentParty.deleteMany).toHaveBeenCalledWith({ where: { patentId: VALID_ID, role: 'INVENTOR' } });
    expect(prisma.patentParty.deleteMany).toHaveBeenCalledWith({ where: { patentId: VALID_ID, role: 'ASSIGNEE' } });
    expect(prisma.patentParty.deleteMany).toHaveBeenCalledWith({ where: { patentId: VALID_ID, role: 'APPLICANT' } });
    expect(prisma.patentParty.createMany).toHaveBeenCalledWith({
      data: [{ patentId: VALID_ID, role: 'INVENTOR', name: 'Alice' }],
    });
    expect(prisma.patentParty.createMany).toHaveBeenCalledWith({
      data: [
        { patentId: VALID_ID, role: 'ASSIGNEE', name: 'Org A' },
        { patentId: VALID_ID, role: 'ASSIGNEE', name: 'Org B' },
      ],
    });
    expect(getByIdSpy).toHaveBeenCalledWith(VALID_ID);
    expect(result).toEqual({ id: VALID_ID });
  });

  it('validates adminUpdate id and missing branches', async () => {
    await expect(service.adminUpdate(ADMIN_REQ, 'bad-id', {})).rejects.toBeInstanceOf(BadRequestException);

    prisma.patent.findUnique.mockResolvedValueOnce(null);
    await expect(service.adminUpdate(ADMIN_REQ, VALID_ID, {})).rejects.toBeInstanceOf(NotFoundException);
  });

  it('adminUpdate applies normalized patch and party sync', async () => {
    prisma.patent.findUnique.mockResolvedValueOnce({ id: VALID_ID });
    const getByIdSpy = vi.spyOn(service, 'getPatentById').mockResolvedValueOnce({ id: VALID_ID } as any);

    const result = await service.adminUpdate(ADMIN_REQ, VALID_ID, {
      applicationNoDisplay: '202410000000.1',
      patentType: 'design',
      title: ' New title ',
      abstract: '',
      filingDate: null,
      legalStatus: null,
      sourcePrimary: 'provider',
      sourceUpdatedAt: '2026-03-13T01:02:03.000Z',
      inventorNames: ['Alice', 'Bob'],
      applicantNames: 'Applicant A',
    });

    expect(prisma.patent.update).toHaveBeenCalledWith({
      where: { id: VALID_ID },
      data: expect.objectContaining({
        applicationNoDisplay: '202410000000.1',
        patentType: 'DESIGN',
        title: 'New title',
        abstract: null,
        filingDate: null,
        legalStatus: null,
        sourcePrimary: 'PROVIDER',
      }),
    });
    expect(prisma.patentParty.deleteMany).toHaveBeenCalledWith({ where: { patentId: VALID_ID, role: 'INVENTOR' } });
    expect(prisma.patentParty.deleteMany).toHaveBeenCalledWith({ where: { patentId: VALID_ID, role: 'APPLICANT' } });
    expect(prisma.patentParty.createMany).toHaveBeenCalledWith({
      data: [
        { patentId: VALID_ID, role: 'INVENTOR', name: 'Alice' },
        { patentId: VALID_ID, role: 'INVENTOR', name: 'Bob' },
      ],
    });
    expect(prisma.patentParty.createMany).toHaveBeenCalledWith({
      data: [{ patentId: VALID_ID, role: 'APPLICANT', name: 'Applicant A' }],
    });
    expect(getByIdSpy).toHaveBeenCalledWith(VALID_ID);
    expect(result).toEqual({ id: VALID_ID });
  });

  it('adminUpdate allows clearing nullable display and status fields', async () => {
    prisma.patent.findUnique.mockResolvedValueOnce({ id: VALID_ID });
    const getByIdSpy = vi.spyOn(service, 'getPatentById').mockResolvedValueOnce({ id: VALID_ID } as any);

    await service.adminUpdate(ADMIN_REQ, VALID_ID, {
      applicationNoDisplay: '',
      abstract: '',
      filingDate: '',
      publicationDate: '',
      grantDate: '',
      legalStatus: '',
      sourcePrimary: '',
      sourceUpdatedAt: '',
      inventorNames: [],
      assigneeNames: [],
      applicantNames: [],
    });

    expect(prisma.patent.update).toHaveBeenCalledWith({
      where: { id: VALID_ID },
      data: expect.objectContaining({
        applicationNoDisplay: null,
        abstract: null,
        filingDate: null,
        publicationDate: null,
        grantDate: null,
        legalStatus: null,
        sourcePrimary: null,
        sourceUpdatedAt: null,
      }),
    });
    expect(prisma.patentParty.deleteMany).toHaveBeenCalledWith({ where: { patentId: VALID_ID, role: 'INVENTOR' } });
    expect(prisma.patentParty.deleteMany).toHaveBeenCalledWith({ where: { patentId: VALID_ID, role: 'ASSIGNEE' } });
    expect(prisma.patentParty.deleteMany).toHaveBeenCalledWith({ where: { patentId: VALID_ID, role: 'APPLICANT' } });
    expect(getByIdSpy).toHaveBeenCalledWith(VALID_ID);
  });

  it('getPatentById validates id and maps record dto', async () => {
    await expect(service.getPatentById('bad-id')).rejects.toBeInstanceOf(BadRequestException);

    prisma.patent.findUnique.mockResolvedValueOnce(null);
    await expect(service.getPatentById(VALID_ID)).rejects.toBeInstanceOf(NotFoundException);

    prisma.patent.findUnique.mockResolvedValueOnce({
      id: VALID_ID,
      applicationNoNorm: '2024100000001',
      applicationNoDisplay: '202410000000.1',
      publicationNoDisplay: 'CN1234567A',
      patentNoDisplay: 'ZL202410000000.1',
      grantPublicationNoDisplay: null,
      patentType: 'INVENTION',
      title: 'Patent A',
      abstract: null,
      filingDate: new Date('2024-01-01T00:00:00.000Z'),
      publicationDate: null,
      grantDate: null,
      legalStatus: 'pending',
      sourcePrimary: 'ADMIN',
      sourceUpdatedAt: new Date('2026-03-13T00:00:00.000Z'),
      transferCount: '3',
      createdAt: new Date('2026-03-13T00:00:00.000Z'),
      updatedAt: new Date('2026-03-13T01:00:00.000Z'),
      listings: [
        {
          id: 'listing-1',
          source: 'USER',
          consultationRouting: 'OWNER',
          priceType: 'NEGOTIABLE',
          priceAmount: 880000,
          depositAmount: 20000,
          seller: {
            id: 'seller-1',
            nickname: 'Seller A',
            avatarUrl: 'https://example.com/seller-a.png',
            verifications: [{ displayName: '上海成果转化中心', verificationType: 'ACADEMY', verificationStatus: 'APPROVED' }],
          },
        },
      ],
      parties: [
        { role: 'INVENTOR', name: 'Alice' },
        { role: 'ASSIGNEE', name: 'Org A' },
        { role: 'APPLICANT', name: 'Applicant A' },
      ],
      classifications: [
        { system: 'IPC', code: 'G06F17/50', isMain: true },
        { system: 'IPC', code: 'G06Q10/10', isMain: false },
      ],
    });

    const result = await service.getPatentById(VALID_ID);
    expect(result).toMatchObject({
      id: VALID_ID,
      legalStatus: 'PENDING',
      patentTermYears: 20,
      inventorNames: ['Alice'],
      assigneeNames: ['Org A'],
      applicantNames: ['Applicant A'],
      transferCount: 3,
      filingDate: '2024-01-01',
      applicationNoNorm: '2024100000001',
      mainIpcCode: 'G06F17/50',
      tradeSnapshot: {
        listingId: 'listing-1',
        priceType: 'NEGOTIABLE',
        priceAmountFen: 880000,
        depositAmountFen: 20000,
        supplyType: 'RESEARCH_INSTITUTE',
        seller: {
          id: 'seller-1',
          nickname: '上海成果转化中心',
          avatarUrl: 'https://example.com/seller-a.png',
          verificationStatus: 'APPROVED',
          verificationType: 'ACADEMY',
          orgCategory: 'RESEARCH_INSTITUTE',
        },
      },
    });
  });

  it('getPatentById does not fall back to seller nickname when no formal displayName exists', async () => {
    prisma.patent.findUnique.mockResolvedValueOnce({
      id: VALID_ID,
      applicationNoNorm: '2024100000001',
      applicationNoDisplay: '202410000000.1',
      publicationNoDisplay: null,
      patentNoDisplay: null,
      grantPublicationNoDisplay: null,
      patentType: 'INVENTION',
      title: 'Patent Without Formal Seller Name',
      abstract: null,
      filingDate: null,
      publicationDate: null,
      grantDate: null,
      legalStatus: null,
      sourcePrimary: 'USER',
      sourceUpdatedAt: null,
      transferCount: 0,
      createdAt: new Date('2026-03-13T00:00:00.000Z'),
      updatedAt: new Date('2026-03-13T01:00:00.000Z'),
      listings: [
        {
          id: 'listing-no-formal-seller',
          source: 'USER',
          consultationRouting: 'OWNER',
          priceType: 'NEGOTIABLE',
          priceAmount: null,
          depositAmount: 10000,
          seller: {
            id: 'seller-no-formal',
            nickname: 'Fallback Nick',
            avatarUrl: 'https://example.com/seller-no-formal.png',
            verifications: [],
          },
        },
      ],
      parties: [],
      classifications: [],
    });

    const result = await service.getPatentById(VALID_ID);

    expect(result.tradeSnapshot?.seller).toMatchObject({
      id: 'seller-no-formal',
      avatarUrl: 'https://example.com/seller-no-formal.png',
    });
    expect(result.tradeSnapshot?.seller?.nickname).toBeUndefined();
    expect(result.tradeSnapshot?.seller?.verificationStatus).toBeUndefined();
    expect(result.tradeSnapshot?.seller?.verificationType).toBeUndefined();
  });

  it('getPatentById hides personal verification metadata for platform-branded trade snapshot seller', async () => {
    prisma.patent.findUnique.mockResolvedValueOnce({
      id: VALID_ID,
      applicationNoNorm: '2024100000001',
      applicationNoDisplay: '202410000000.1',
      publicationNoDisplay: null,
      patentNoDisplay: null,
      grantPublicationNoDisplay: null,
      patentType: 'INVENTION',
      title: 'Platform Patent',
      abstract: null,
      filingDate: null,
      publicationDate: null,
      grantDate: null,
      legalStatus: null,
      sourcePrimary: 'ADMIN',
      sourceUpdatedAt: null,
      transferCount: 0,
      createdAt: new Date('2026-03-13T00:00:00.000Z'),
      updatedAt: new Date('2026-03-13T01:00:00.000Z'),
      listings: [
        {
          id: 'listing-platform-brand',
          source: 'ADMIN',
          consultationRouting: 'PLATFORM',
          priceType: 'NEGOTIABLE',
          priceAmount: null,
          depositAmount: 10000,
          seller: {
            id: 'seller-platform',
            nickname: 'Raw Platform User',
            avatarUrl: null,
            verifications: [{ displayName: '个人主体', verificationType: 'PERSON', verificationStatus: 'APPROVED' }],
          },
        },
      ],
      parties: [],
      classifications: [],
    });

    const result = await service.getPatentById(VALID_ID);

    expect(result.tradeSnapshot?.seller).toMatchObject({
      id: 'seller-platform',
      nickname: 'ipmoney',
    });
    expect(result.tradeSnapshot?.seller?.verificationStatus).toBeUndefined();
    expect(result.tradeSnapshot?.seller?.verificationType).toBeUndefined();
    expect(result.tradeSnapshot?.seller?.orgCategory).toBeUndefined();
  });

  it('normalizes application/patent/publication numbers and rejects invalid format', () => {
    const byApplication = service.normalizeNumber('202410000000.1');
    expect(byApplication).toMatchObject({
      jurisdiction: 'CN',
      inputType: 'APPLICATION_NO',
      applicationNoNorm: '2024100000001',
      applicationNoDisplay: '202410000000.1',
      patentType: 'INVENTION',
    });

    const byPatentNo = service.normalizeNumber('ZL202410000000.1');
    expect(byPatentNo).toMatchObject({
      inputType: 'PATENT_NO',
      patentNoNorm: 'ZL2024100000001',
      patentNoDisplay: 'ZL202410000000.1',
    });

    const byPublication = service.normalizeNumber('CN12345678A');
    expect(byPublication).toMatchObject({
      inputType: 'PUBLICATION_NO',
      publicationNoNorm: 'CN12345678A',
      kindCode: 'A',
      patentType: 'INVENTION',
    });

    expect(() => service.normalizeNumber('BAD')).toThrow(BadRequestException);
  });

  it('createImportJob rejects OPEN_LICENSE defaults when tradeMode is not LICENSE', async () => {
    prisma.file.findUnique.mockResolvedValueOnce({ id: VALID_ID });

    await expect(
      service.createImportJob(
        { auth: { isAdmin: true, userId: VALID_ID }, headers: { 'idempotency-key': 'patent-import-1' } },
        {
          fileId: VALID_ID,
          defaults: {
            listing: {
              tradeMode: 'ASSIGNMENT',
              listingTopics: ['OPEN_LICENSE'],
            },
          },
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('createImportJob rejects LICENSE defaults when licenseMode is missing', async () => {
    prisma.file.findUnique.mockResolvedValueOnce({ id: VALID_ID });

    await expect(
      service.createImportJob(
        { auth: { isAdmin: true, userId: VALID_ID }, headers: { 'idempotency-key': 'patent-import-2' } },
        {
          fileId: VALID_ID,
          defaults: {
            listing: {
              tradeMode: 'LICENSE',
            },
          },
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('createImportJob accepts open license defaults', async () => {
    prisma.file.findUnique.mockResolvedValueOnce({ id: VALID_ID });
    prisma.patentImportJob.create.mockImplementationOnce(async ({ data }: any) => ({
      id: VALID_ID,
      ...data,
      totalCount: 0,
      validCount: 0,
      invalidCount: 0,
      successCount: 0,
      failedCount: 0,
      skippedCount: 0,
      failRate: 0,
      createdAt: new Date('2026-03-13T00:00:00.000Z'),
      updatedAt: new Date('2026-03-13T00:00:00.000Z'),
    }));

    const result = await service.createImportJob(
      { auth: { isAdmin: true, userId: VALID_ID }, headers: { 'idempotency-key': 'patent-import-open-license' } },
      {
        fileId: VALID_ID,
        defaults: {
          listing: {
            consultationRouting: 'OWNER',
            tradeMode: 'LICENSE',
            licenseMode: 'OPEN_LICENSE',
          },
        },
      },
    );

    expect(prisma.patentImportJob.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          defaultsJson: expect.objectContaining({
            listing: expect.objectContaining({
              tradeMode: 'LICENSE',
              licenseMode: 'OPEN_LICENSE',
            }),
          }),
        }),
      }),
    );
    expect(result.defaults?.listing?.licenseMode).toBe('OPEN_LICENSE');
  });

  it('createImportJob rejects PLATFORM defaults when sellerUserId is missing', async () => {
    prisma.file.findUnique.mockResolvedValueOnce({ id: VALID_ID });

    await expect(
      service.createImportJob(
        { auth: { isAdmin: true, userId: VALID_ID }, headers: { 'idempotency-key': 'patent-import-3' } },
        {
          fileId: VALID_ID,
          defaults: {
            listing: {
              consultationRouting: 'PLATFORM',
            },
          },
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('uses patent metadata instead of synthetic english title when generating listing', async () => {
    prisma.user = {
      findUnique: vi.fn().mockResolvedValueOnce({ id: VALID_ID }),
    };
    prisma.listing = {
      findFirst: vi.fn().mockResolvedValueOnce(null),
      create: vi.fn().mockResolvedValueOnce({ id: 'listing-1' }),
      updateMany: vi.fn(),
    };

    const result = await (service as any).upsertListingForPatent({
      patent: {
        id: 'patent-1',
        title: '',
        applicationNoNorm: '2024100000001',
        applicationNoDisplay: '202410000000.1',
        publicationNoDisplay: null,
        patentNoDisplay: null,
        grantPublicationNoDisplay: null,
        abstract: null,
      },
      operatorUserId: VALID_ID,
      listingDefaults: {
        consultationRouting: 'PLATFORM',
        sellerUserId: VALID_ID,
      },
      duplicatePolicy: 'OVERWRITE',
    });

    expect(prisma.listing.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        title: '202410000000.1',
      }),
    });
    expect(result).toMatchObject({ status: 'SUCCEEDED', listingId: 'listing-1' });
  });

  it('fails listing generation when PLATFORM routing has no explicit sellerUserId', async () => {
    const result = await (service as any).upsertListingForPatent({
      patent: {
        id: 'patent-2',
        title: 'Platform Patent',
        applicationNoNorm: '2024100000002',
        applicationNoDisplay: '202410000000.2',
        publicationNoDisplay: null,
        patentNoDisplay: null,
        grantPublicationNoDisplay: null,
        abstract: null,
      },
      operatorUserId: VALID_ID,
      listingDefaults: {
        consultationRouting: 'PLATFORM',
      },
      duplicatePolicy: 'OVERWRITE',
    });

    expect(result).toMatchObject({
      status: 'FAILED',
      errorCode: 'SELLER_REQUIRED',
    });
  });

  it('approveClaim uses conditional update inside transaction and rejects already processed races', async () => {
    const req = { auth: { isAdmin: true, userId: VALID_ID } };
    const claimId = '22222222-2222-2222-2222-222222222222';
    const patentId = '33333333-3333-3333-3333-333333333333';
    const applicantUserId = '44444444-4444-4444-4444-444444444444';
    prisma.patentClaimRequest.findUnique
      .mockResolvedValueOnce({
        id: claimId,
        patentId,
        applicantUserId,
        status: 'PENDING',
      })
      .mockResolvedValueOnce({
        id: claimId,
        patentId,
        applicantUserId,
        status: 'APPROVED',
        reviewerUserId: VALID_ID,
        reviewComment: null,
        reviewedAt: new Date('2026-03-13T02:00:00.000Z'),
        submittedAt: new Date('2026-03-13T01:00:00.000Z'),
        createdAt: new Date('2026-03-13T01:00:00.000Z'),
        updatedAt: new Date('2026-03-13T02:00:00.000Z'),
        evidenceFileIdsJson: [],
      });
    prisma.order.count.mockResolvedValueOnce(0);
    prisma.patentClaimRequest.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    prisma.patent.update.mockResolvedValueOnce({ id: patentId });
    prisma.listing.updateMany.mockResolvedValueOnce({ count: 2 });

    const result = await service.approveClaim(req, claimId, {});

    expect(prisma.patentClaimRequest.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: claimId, status: 'PENDING' },
      data: {
        status: 'APPROVED',
        reviewerUserId: VALID_ID,
        reviewComment: null,
        reviewedAt: expect.any(Date),
      },
    });
    expect(prisma.listing.updateMany).toHaveBeenCalledWith({
      where: { patentId, consultationRouting: 'OWNER' },
      data: { sellerUserId: applicantUserId },
    });
    expect(result).toMatchObject({
      id: claimId,
      status: 'APPROVED',
      applicantUserId,
      patentId,
    });

    prisma.patentClaimRequest.findUnique.mockResolvedValueOnce({
      id: claimId,
      patentId,
      applicantUserId,
      status: 'PENDING',
    });
    prisma.order.count.mockResolvedValueOnce(0);
    prisma.patentClaimRequest.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(service.approveClaim(req, claimId, {})).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejectClaim uses conditional update and rejects already processed races', async () => {
    const req = { auth: { isAdmin: true, userId: VALID_ID } };
    const claimId = '22222222-2222-2222-2222-222222222222';
    const patentId = '33333333-3333-3333-3333-333333333333';
    const applicantUserId = '44444444-4444-4444-4444-444444444444';
    prisma.patentClaimRequest.findUnique
      .mockResolvedValueOnce({
        id: claimId,
        patentId,
        applicantUserId,
        status: 'PENDING',
      })
      .mockResolvedValueOnce({
        id: claimId,
        patentId,
        applicantUserId,
        status: 'REJECTED',
        reviewerUserId: VALID_ID,
        reviewComment: 'bad evidence',
        reviewedAt: new Date('2026-03-13T02:00:00.000Z'),
        submittedAt: new Date('2026-03-13T01:00:00.000Z'),
        createdAt: new Date('2026-03-13T01:00:00.000Z'),
        updatedAt: new Date('2026-03-13T02:00:00.000Z'),
        evidenceFileIdsJson: [],
      });
    prisma.patentClaimRequest.updateMany.mockResolvedValueOnce({ count: 1 });

    const result = await service.rejectClaim(req, claimId, { reviewComment: 'bad evidence' });

    expect(prisma.patentClaimRequest.updateMany).toHaveBeenCalledWith({
      where: { id: claimId, status: 'PENDING' },
      data: {
        status: 'REJECTED',
        reviewerUserId: VALID_ID,
        reviewComment: 'bad evidence',
        reviewedAt: expect.any(Date),
      },
    });
    expect(result).toMatchObject({
      id: claimId,
      status: 'REJECTED',
      patentId,
    });

    prisma.patentClaimRequest.findUnique.mockResolvedValueOnce({
      id: claimId,
      patentId,
      applicantUserId,
      status: 'PENDING',
    });
    prisma.patentClaimRequest.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(service.rejectClaim(req, claimId, { reviewComment: 'bad evidence' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('listMyClaims supports patentId filtering within applicant scope', async () => {
    const req = { auth: { userId: VALID_ID } };
    const patentId = '33333333-3333-3333-3333-333333333333';
    prisma.patentClaimRequest.findMany = vi.fn().mockResolvedValueOnce([
      {
        id: '22222222-2222-2222-2222-222222222222',
        patentId,
        applicantUserId: VALID_ID,
        status: 'PENDING',
        claimReason: null,
        evidenceFileIdsJson: [],
        reviewerUserId: null,
        reviewComment: null,
        submittedAt: new Date('2026-03-13T01:00:00.000Z'),
        reviewedAt: null,
        createdAt: new Date('2026-03-13T01:00:00.000Z'),
        updatedAt: new Date('2026-03-13T01:00:00.000Z'),
      },
    ]);
    prisma.patentClaimRequest.count = vi.fn().mockResolvedValueOnce(1);

    const result = await service.listMyClaims(req, {
      page: '1',
      pageSize: '20',
      patentId,
      status: 'pending',
    });

    expect(prisma.patentClaimRequest.findMany).toHaveBeenCalledWith({
      where: {
        applicantUserId: VALID_ID,
        patentId,
        status: 'PENDING',
      },
      orderBy: { submittedAt: 'desc' },
      skip: 0,
      take: 20,
      include: {
        applicant: {
          select: {
            nickname: true,
            verifications: {
              orderBy: { submittedAt: 'desc' },
              take: 1,
              select: { displayName: true },
            },
          },
        },
        reviewer: {
          select: {
            nickname: true,
            verifications: {
              orderBy: { submittedAt: 'desc' },
              take: 1,
              select: { displayName: true },
            },
          },
        },
      },
    });
    expect(prisma.patentClaimRequest.count).toHaveBeenCalledWith({
      where: {
        applicantUserId: VALID_ID,
        patentId,
        status: 'PENDING',
      },
    });
    expect(result.page).toEqual({ page: 1, pageSize: 20, total: 1 });
    expect(result.items[0]).toMatchObject({ patentId, applicantUserId: VALID_ID, status: 'PENDING' });
  });
});
