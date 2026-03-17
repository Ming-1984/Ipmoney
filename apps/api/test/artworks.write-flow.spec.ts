import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ArtworksService } from '../src/modules/artworks/artworks.service';

const ARTWORK_ID = '11111111-1111-1111-1111-111111111111';
const USER_ID = 'user-1';

const USER_REQ = { auth: { userId: USER_ID } };
const ADMIN_REQ = { auth: { userId: 'admin-1', isAdmin: true } };

function buildArtwork(overrides: Record<string, unknown> = {}) {
  return {
    id: ARTWORK_ID,
    sellerUserId: USER_ID,
    source: 'USER',
    title: 'Artwork A',
    description: 'description',
    category: 'PAINTING',
    calligraphyScript: null,
    paintingGenre: 'LANDSCAPE',
    creatorName: 'Artist A',
    creationDate: new Date('2020-01-01T00:00:00.000Z'),
    creationYear: 2020,
    certificateNo: 'CERT-1',
    certificateFileIdsJson: ['file-1'],
    priceType: 'FIXED',
    priceAmountFen: 1000,
    depositAmountFen: 100,
    regionCode: '440300',
    material: 'paper',
    size: '50x70',
    coverFileId: 'cover-file-1',
    auditStatus: 'PENDING',
    status: 'DRAFT',
    createdAt: new Date('2026-03-13T00:00:00.000Z'),
    updatedAt: new Date('2026-03-13T01:00:00.000Z'),
    coverFile: { url: 'https://example.com/cover.png' },
    media: [
      {
        fileId: 'media-1',
        type: 'IMAGE',
        sort: 0,
        file: { url: 'https://example.com/media-1.png', mimeType: 'image/png', sizeBytes: 123, fileName: '1.png' },
      },
    ],
    stats: { viewCount: 1, favoriteCount: 2, consultCount: 3, commentCount: 4 },
    ...overrides,
  };
}

describe('ArtworksService write flow suite', () => {
  let prisma: any;
  let audit: any;
  let notifications: any;
  let service: ArtworksService;

  beforeEach(() => {
    prisma = {
      $transaction: vi.fn(async (fn: any) => fn(prisma)),
      artwork: {
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      artworkMedia: {
        createMany: vi.fn(),
        deleteMany: vi.fn(),
      },
      file: {
        findMany: vi.fn(),
      },
    };
    audit = { log: vi.fn().mockResolvedValue(undefined) };
    notifications = { create: vi.fn().mockResolvedValue(undefined) };
    const events = { recordView: vi.fn().mockResolvedValue(undefined) };
    const config = { getRecommendation: vi.fn().mockResolvedValue({ enabled: false }) };
    service = new ArtworksService(prisma, audit, notifications, events as any, config as any);
  });

  it('validates create payload strictly', async () => {
    await expect(service.create(USER_REQ, { title: ' ' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create(USER_REQ, { title: 'A', category: 'bad' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create(USER_REQ, { title: 'A', category: 'painting', creatorName: '' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      service.create(USER_REQ, { title: 'A', category: 'painting', creatorName: 'x', priceType: 'bad' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.create(USER_REQ, { title: 'A', category: 'painting', creatorName: 'x', priceType: 'fixed', regionCode: '' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('create normalizes payload and writes media rows', async () => {
    prisma.artwork.create.mockResolvedValueOnce({ id: ARTWORK_ID });
    prisma.artwork.findUnique.mockResolvedValueOnce(buildArtwork({ title: 'Artwork Create', category: 'CALLIGRAPHY' }));

    const result = await service.create(USER_REQ, {
      title: '  Artwork Create ',
      category: 'calligraphy',
      creatorName: ' Artist A ',
      priceType: 'fixed',
      description: ' desc ',
      calligraphyScript: 'xingshu',
      creationDate: '2020-02-03',
      creationYear: '2020',
      certificateNo: ' CERT-1 ',
      certificateFileIds: [' file-1 ', ''],
      priceAmountFen: '1200',
      depositAmountFen: '200',
      regionCode: '440300',
      material: ' paper ',
      size: ' 50x70 ',
      coverFileId: ' cover-file-1 ',
      media: [
        { fileId: ' media-1 ', type: 'image', sort: 3 },
        { fileId: '', type: 'image', sort: 4 },
      ],
    });

    expect(prisma.artwork.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sellerUserId: USER_ID,
          source: 'USER',
          title: 'Artwork Create',
          category: 'CALLIGRAPHY',
          creatorName: 'Artist A',
          priceType: 'FIXED',
          description: 'desc',
          calligraphyScript: 'XINGSHU',
          certificateNo: 'CERT-1',
          certificateFileIdsJson: ['file-1'],
          priceAmountFen: 1200,
          depositAmountFen: 200,
          regionCode: '440300',
          material: 'paper',
          size: '50x70',
          coverFileId: 'cover-file-1',
        }),
      }),
    );
    expect(prisma.artworkMedia.createMany).toHaveBeenCalledWith({
      data: [{ artworkId: ARTWORK_ID, fileId: 'media-1', type: 'IMAGE', sort: 3 }],
    });
    expect(result).toMatchObject({ id: ARTWORK_ID, title: 'Artwork Create', category: 'CALLIGRAPHY' });
  });

  it('update validates ownership and strict patch fields', async () => {
    prisma.artwork.findUnique.mockResolvedValueOnce(null);
    await expect(service.update(USER_REQ, ARTWORK_ID, {})).rejects.toBeInstanceOf(NotFoundException);

    prisma.artwork.findUnique.mockResolvedValueOnce(buildArtwork({ sellerUserId: 'other-user' }));
    await expect(service.update(USER_REQ, ARTWORK_ID, {})).rejects.toBeInstanceOf(NotFoundException);

    prisma.artwork.findUnique.mockResolvedValueOnce(buildArtwork());
    await expect(service.update(USER_REQ, ARTWORK_ID, { title: ' ' })).rejects.toBeInstanceOf(BadRequestException);

    prisma.artwork.findUnique.mockResolvedValueOnce(buildArtwork());
    await expect(service.update(USER_REQ, ARTWORK_ID, { priceType: 'bad' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('update applies normalized patch and media replacement', async () => {
    prisma.artwork.findUnique.mockResolvedValueOnce(buildArtwork());
    prisma.artwork.update.mockResolvedValueOnce({ id: ARTWORK_ID });
    prisma.artwork.findUnique.mockResolvedValueOnce(
      buildArtwork({
        title: 'Artwork Updated',
        category: 'PAINTING',
        priceType: 'NEGOTIABLE',
        priceAmountFen: null,
        regionCode: null,
      }),
    );

    const result = await service.update(USER_REQ, ARTWORK_ID, {
      title: ' Artwork Updated ',
      category: 'painting',
      creatorName: ' Artist B ',
      priceType: 'negotiable',
      priceAmountFen: null,
      regionCode: null,
      certificateFileIds: [],
      media: [{ fileId: ' media-2 ', type: 'image', sort: 1 }],
    });

    expect(prisma.artwork.update).toHaveBeenCalledWith({
      where: { id: ARTWORK_ID },
      data: expect.objectContaining({
        title: 'Artwork Updated',
        category: 'PAINTING',
        creatorName: 'Artist B',
        priceType: 'NEGOTIABLE',
        priceAmountFen: null,
        regionCode: null,
      }),
    });
    expect(prisma.artworkMedia.deleteMany).toHaveBeenCalledWith({ where: { artworkId: ARTWORK_ID } });
    expect(prisma.artworkMedia.createMany).toHaveBeenCalledWith({
      data: [{ artworkId: ARTWORK_ID, fileId: 'media-2', type: 'IMAGE', sort: 1 }],
    });
    expect(result).toMatchObject({ id: ARTWORK_ID, title: 'Artwork Updated', priceType: 'NEGOTIABLE' });
  });

  it('submit and offShelf enforce validation/ownership and apply transitions', async () => {
    prisma.artwork.findUnique.mockResolvedValueOnce(null);
    await expect(service.submit(USER_REQ, ARTWORK_ID)).rejects.toBeInstanceOf(NotFoundException);

    prisma.artwork.findUnique.mockResolvedValueOnce(buildArtwork({ sellerUserId: 'other-user' }));
    await expect(service.submit(USER_REQ, ARTWORK_ID)).rejects.toBeInstanceOf(NotFoundException);

    prisma.artwork.findUnique.mockResolvedValueOnce(buildArtwork({ certificateNo: null, media: [] }));
    await expect(service.submit(USER_REQ, ARTWORK_ID)).rejects.toBeInstanceOf(BadRequestException);

    prisma.artwork.findUnique.mockResolvedValueOnce(buildArtwork());
    prisma.file.findMany.mockResolvedValueOnce([]);
    await expect(service.submit(USER_REQ, ARTWORK_ID)).rejects.toBeInstanceOf(BadRequestException);

    prisma.artwork.findUnique.mockResolvedValueOnce(buildArtwork());
    prisma.file.findMany.mockResolvedValueOnce([{ id: 'file-1', ownerId: 'other-user' }]);
    await expect(service.submit(USER_REQ, ARTWORK_ID)).rejects.toBeInstanceOf(ForbiddenException);

    prisma.artwork.findUnique
      .mockResolvedValueOnce(buildArtwork())
      .mockResolvedValueOnce(buildArtwork({ sellerUserId: USER_ID }));
    prisma.file.findMany.mockResolvedValueOnce([{ id: 'file-1', ownerId: USER_ID }]);
    prisma.artwork.update
      .mockResolvedValueOnce(buildArtwork({ status: 'ACTIVE', auditStatus: 'PENDING' }))
      .mockResolvedValueOnce(buildArtwork({ status: 'OFF_SHELF' }));

    const submitted = await service.submit(USER_REQ, ARTWORK_ID);
    const offShelved = await service.offShelf(USER_REQ, ARTWORK_ID, {});

    expect(prisma.artwork.update).toHaveBeenNthCalledWith(1, {
      where: { id: ARTWORK_ID },
      data: { status: 'ACTIVE', auditStatus: 'PENDING' },
    });
    expect(prisma.artwork.update).toHaveBeenNthCalledWith(2, {
      where: { id: ARTWORK_ID },
      data: { status: 'OFF_SHELF' },
    });
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'ARTWORK_SUBMIT', targetId: ARTWORK_ID }));
    expect(submitted.status).toBe('ACTIVE');
    expect(offShelved.status).toBe('OFF_SHELF');
  });

  it('adminCreate and adminUpdate validate strict fields and normalize writes', async () => {
    await expect(service.adminCreate(ADMIN_REQ, { title: 'A', category: 'painting', creatorName: 'x', priceType: 'fixed', status: 'bad' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.adminCreate(ADMIN_REQ, { title: 'A', category: 'painting', creatorName: 'x', priceType: 'fixed', ownerId: '' })).rejects.toBeInstanceOf(
      BadRequestException,
    );

    prisma.artwork.create.mockResolvedValueOnce({ id: ARTWORK_ID });
    prisma.artwork.findUnique.mockResolvedValueOnce(
      buildArtwork({ sellerUserId: 'owner-2', source: 'PLATFORM', auditStatus: 'APPROVED', status: 'ACTIVE' }),
    );

    const created = await service.adminCreate(ADMIN_REQ, {
      title: ' Admin Artwork ',
      category: 'painting',
      creatorName: 'Artist A',
      priceType: 'fixed',
      source: 'platform',
      ownerId: ' owner-2 ',
      auditStatus: 'approved',
      status: 'active',
      media: [{ fileId: ' media-3 ', type: 'image', sort: 2 }],
    });

    expect(prisma.artwork.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sellerUserId: 'owner-2',
          source: 'PLATFORM',
          title: 'Admin Artwork',
          category: 'PAINTING',
          creatorName: 'Artist A',
          priceType: 'FIXED',
          auditStatus: 'APPROVED',
          status: 'ACTIVE',
        }),
      }),
    );
    expect(created.status).toBe('ACTIVE');

    prisma.artwork.findUnique.mockResolvedValueOnce(buildArtwork());
    prisma.artwork.update.mockResolvedValueOnce({ id: ARTWORK_ID });
    prisma.artwork.findUnique.mockResolvedValueOnce(
      buildArtwork({ sellerUserId: 'owner-3', source: 'ADMIN', title: 'Admin Updated', status: 'OFF_SHELF' }),
    );

    const updated = await service.adminUpdate(ADMIN_REQ, ARTWORK_ID, {
      sellerUserId: ' owner-3 ',
      source: 'admin',
      title: ' Admin Updated ',
      status: 'off_shelf',
      media: [],
    });

    expect(prisma.artwork.update).toHaveBeenCalledWith({
      where: { id: ARTWORK_ID },
      data: expect.objectContaining({
        sellerUserId: 'owner-3',
        source: 'ADMIN',
        title: 'Admin Updated',
        status: 'OFF_SHELF',
      }),
    });
    expect(prisma.artworkMedia.deleteMany).toHaveBeenCalledWith({ where: { artworkId: ARTWORK_ID } });
    expect(updated).toMatchObject({ sellerUserId: 'owner-3', status: 'OFF_SHELF' });
  });

  it('admin publish/off-shelf/approve/reject cover missing and success branches', async () => {
    prisma.artwork.findUnique.mockResolvedValueOnce(null);
    await expect(service.adminPublish(ADMIN_REQ, ARTWORK_ID)).rejects.toBeInstanceOf(NotFoundException);

    prisma.artwork.findUnique
      .mockResolvedValueOnce(buildArtwork({ status: 'DRAFT' }))
      .mockResolvedValueOnce(buildArtwork({ status: 'ACTIVE' }))
      .mockResolvedValueOnce(buildArtwork({ status: 'DRAFT' }))
      .mockResolvedValueOnce(buildArtwork({ status: 'ACTIVE' }));
    prisma.artwork.update
      .mockResolvedValueOnce(buildArtwork({ status: 'ACTIVE', auditStatus: 'APPROVED' }))
      .mockResolvedValueOnce(buildArtwork({ status: 'OFF_SHELF' }))
      .mockResolvedValueOnce(buildArtwork({ status: 'ACTIVE', auditStatus: 'APPROVED', title: 'Artwork A' }))
      .mockResolvedValueOnce(buildArtwork({ status: 'ACTIVE', auditStatus: 'REJECTED', title: 'Artwork A' }));

    const published = await service.adminPublish(ADMIN_REQ, ARTWORK_ID);
    const offShelved = await service.adminOffShelf(ADMIN_REQ, ARTWORK_ID);
    const approved = await service.adminApprove(ADMIN_REQ, ARTWORK_ID);
    const rejected = await service.adminReject(ADMIN_REQ, ARTWORK_ID, { reason: 'need more details' });

    expect(published.status).toBe('ACTIVE');
    expect(offShelved.status).toBe('OFF_SHELF');
    expect(approved.auditStatus).toBe('APPROVED');
    expect(rejected.auditStatus).toBe('REJECTED');
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'ARTWORK_APPROVE', targetId: ARTWORK_ID }));
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'ARTWORK_REJECT', targetId: ARTWORK_ID }));
    expect(notifications.create).toHaveBeenCalledTimes(2);
  });
});
