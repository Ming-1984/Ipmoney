import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PatentsService } from '../src/modules/patents/patents.service';

const ADMIN_REQ = { auth: { isAdmin: true } };
const VALID_ID = '11111111-1111-1111-1111-111111111111';

describe('PatentsService write and normalize suite', () => {
  let prisma: any;
  let service: PatentsService;

  beforeEach(() => {
    prisma = {
      patent: {
        upsert: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      patentParty: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        createMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };
    service = new PatentsService(prisma);
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
      parties: [
        { role: 'INVENTOR', name: 'Alice' },
        { role: 'ASSIGNEE', name: 'Org A' },
        { role: 'APPLICANT', name: 'Applicant A' },
      ],
    });

    const result = await service.getPatentById(VALID_ID);
    expect(result).toMatchObject({
      id: VALID_ID,
      legalStatus: 'PENDING',
      inventorNames: ['Alice'],
      assigneeNames: ['Org A'],
      applicantNames: ['Applicant A'],
      transferCount: 3,
      filingDate: '2024-01-01',
      applicationNoNorm: '2024100000001',
    });
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
});
