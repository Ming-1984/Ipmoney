import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ArtworksController } from '../src/modules/artworks/artworks.controller';

const VALID_UUID = '44444444-4444-4444-8444-444444444444';

describe('ArtworksController delegation suite', () => {
  let artworks: any;
  let contentAudit: any;
  let controller: ArtworksController;

  beforeEach(() => {
    artworks = {
      ensureAdmin: vi.fn(),
      adminUpdate: vi.fn(),
      adminReject: vi.fn(),
      create: vi.fn(),
    };
    contentAudit = {
      listMaterials: vi.fn(),
      listLogs: vi.fn(),
    };
    controller = new ArtworksController(artworks, contentAudit);
  });

  it('delegates getMaterials with normalized artworkId for admin listing.read permission', async () => {
    const req: any = { auth: { permissions: new Set(['listing.read']) } };
    contentAudit.listMaterials.mockResolvedValueOnce({ items: [{ id: 'aw-1' }] });

    await expect(controller.getMaterials(req, ` ${VALID_UUID} `)).resolves.toEqual({ items: [{ id: 'aw-1' }] });

    expect(artworks.ensureAdmin).toHaveBeenCalledWith(req);
    expect(contentAudit.listMaterials).toHaveBeenCalledWith('ARTWORK', VALID_UUID);
  });

  it('rejects getMaterials when listing.read permission is absent', async () => {
    const req: any = { auth: { permissions: new Set(['auditLog.read']) } };

    await expect(controller.getMaterials(req, VALID_UUID)).rejects.toBeInstanceOf(ForbiddenException);

    expect(artworks.ensureAdmin).toHaveBeenCalledWith(req);
    expect(contentAudit.listMaterials).not.toHaveBeenCalled();
  });

  it('delegates getAuditLogs when auditLog.read permission exists', async () => {
    const req: any = { auth: { permissions: new Set(['auditLog.read']) } };
    contentAudit.listLogs.mockResolvedValueOnce({ items: [{ id: 'log-1' }] });

    await expect(controller.getAuditLogs(req, VALID_UUID)).resolves.toEqual({ items: [{ id: 'log-1' }] });

    expect(artworks.ensureAdmin).toHaveBeenCalledWith(req);
    expect(contentAudit.listLogs).toHaveBeenCalledWith('ARTWORK', VALID_UUID);
  });

  it('rejects getAuditLogs for invalid UUID artworkId', async () => {
    const req: any = { auth: { permissions: new Set(['auditLog.read']) } };

    await expect(controller.getAuditLogs(req, 'invalid-id')).rejects.toBeInstanceOf(BadRequestException);

    expect(contentAudit.listLogs).not.toHaveBeenCalled();
  });

  it('delegates adminUpdate with fallback empty body', async () => {
    const req: any = { auth: { permissions: new Set(['listing.audit']) } };
    artworks.adminUpdate.mockResolvedValueOnce({ id: VALID_UUID, ok: true });

    await expect(controller.adminUpdate(req, VALID_UUID, undefined as any)).resolves.toEqual({
      id: VALID_UUID,
      ok: true,
    });

    expect(artworks.adminUpdate).toHaveBeenCalledWith(req, VALID_UUID, {});
  });

  it('delegates reject with fallback empty body and permission check', async () => {
    const req: any = { auth: { permissions: new Set(['listing.audit']) } };
    artworks.adminReject.mockResolvedValueOnce({ ok: true });

    await expect(controller.reject(req, VALID_UUID, null as any)).resolves.toEqual({ ok: true });

    expect(artworks.adminReject).toHaveBeenCalledWith(req, VALID_UUID, {});
  });

  it('delegates create with fallback empty body', async () => {
    const req: any = { auth: { userId: 'u-1' } };
    artworks.create.mockResolvedValueOnce({ id: VALID_UUID });

    await expect(controller.create(req, undefined as any)).resolves.toEqual({ id: VALID_UUID });

    expect(artworks.create).toHaveBeenCalledWith(req, {});
  });
});
