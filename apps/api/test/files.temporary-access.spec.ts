import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FilesController } from '../src/modules/files/files.controller';

const FILE_ID = '11111111-1111-4111-8111-111111111111';

describe('FilesController temporary-access strictness suite', () => {
  let files: any;
  let audit: any;
  let controller: FilesController;

  beforeEach(() => {
    files = {
      getFileById: vi.fn(),
      canAccessFile: vi.fn(),
      createTempToken: vi.fn(),
      resolvePublicBaseUrl: vi.fn(),
    };
    audit = { log: vi.fn().mockResolvedValue(undefined) };
    controller = new FilesController(files, audit);
  });

  it('requires auth and existing file', async () => {
    await expect(controller.createTemporaryAccess({}, FILE_ID, {})).rejects.toBeInstanceOf(UnauthorizedException);

    files.getFileById.mockResolvedValueOnce(null);
    await expect(
      controller.createTemporaryAccess({ auth: { userId: 'u-1', isAdmin: false } }, FILE_ID, {}),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects inaccessible file', async () => {
    files.getFileById.mockResolvedValueOnce({ id: FILE_ID });
    files.canAccessFile.mockResolvedValueOnce(false);

    await expect(
      controller.createTemporaryAccess({ auth: { userId: 'u-1', isAdmin: false } }, FILE_ID, {}),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('validates scope and ttl fields strictly', async () => {
    const req = { auth: { userId: 'u-1', isAdmin: false } };
    files.getFileById.mockResolvedValue({ id: FILE_ID });
    files.canAccessFile.mockResolvedValue(true);

    await expect(controller.createTemporaryAccess(req, FILE_ID, { scope: 'bad' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(controller.createTemporaryAccess(req, FILE_ID, { expiresInSeconds: '   ' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(controller.createTemporaryAccess(req, FILE_ID, { ttlSeconds: '1.2' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(controller.createTemporaryAccess(req, FILE_ID, { expiresInSeconds: -1 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('accepts ttlSeconds alias and returns preview url', async () => {
    const req = {
      auth: { userId: 'u-1', isAdmin: false },
      protocol: 'https',
      get: vi.fn().mockReturnValue('api.example.com'),
      headers: {},
      ip: '127.0.0.1',
    };
    files.getFileById.mockResolvedValueOnce({ id: FILE_ID });
    files.canAccessFile.mockResolvedValueOnce(true);
    files.createTempToken.mockReturnValueOnce({ token: 'signed-token', expiresAt: 1_900_000_000 });
    files.resolvePublicBaseUrl.mockReturnValueOnce('https://api.example.com');

    const result = await controller.createTemporaryAccess(req, FILE_ID, {
      scope: 'preview',
      ttlSeconds: '120',
    });

    expect(files.createTempToken).toHaveBeenCalledWith(FILE_ID, 'preview', 120);
    expect(result).toEqual({
      url: `https://api.example.com/files/${FILE_ID}/preview?token=signed-token`,
      expiresAt: 1_900_000_000,
      scope: 'preview',
    });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'FILE_TEMP_ACCESS_ISSUED',
        targetId: FILE_ID,
        actorUserId: 'u-1',
      }),
    );
  });
});
