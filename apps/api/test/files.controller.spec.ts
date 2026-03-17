import { ForbiddenException, StreamableFile } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FilesController } from '../src/modules/files/files.controller';

const FILE_ID = '16161616-1616-4161-8161-161616161616';

describe('FilesController delegation suite', () => {
  let files: any;
  let audit: any;
  let controller: FilesController;

  beforeEach(() => {
    files = {
      createUserFile: vi.fn(),
      isObjectStorageEnabled: vi.fn(),
      uploadToObjectStorage: vi.fn(),
      getFileById: vi.fn(),
      canAccessFile: vi.fn(),
      getFileBuffer: vi.fn(),
      buildWatermarkedPreview: vi.fn(),
    };
    audit = { log: vi.fn().mockResolvedValue(undefined) };
    controller = new FilesController(files, audit);
  });

  it('delegates uploadFile to createUserFile with normalized metadata', async () => {
    const req: any = {
      auth: { userId: 'user-1' },
      protocol: 'https',
      get: vi.fn().mockReturnValue('api.example.com'),
      __uploadFileId: FILE_ID,
    };
    const file: any = { filename: `${FILE_ID}.png`, mimetype: 'image/png', size: 1234, path: 'unused' };
    files.createUserFile.mockResolvedValueOnce({ id: FILE_ID });
    files.isObjectStorageEnabled.mockReturnValueOnce(false);

    await expect(controller.uploadFile(req, file)).resolves.toEqual({ id: FILE_ID });

    expect(files.createUserFile).toHaveBeenCalledWith(
      expect.objectContaining({
        fileId: FILE_ID,
        userId: 'user-1',
        filename: `${FILE_ID}.png`,
        mimeType: 'image/png',
        sizeBytes: 1234,
        baseUrl: expect.any(String),
      }),
    );
    expect(files.uploadToObjectStorage).not.toHaveBeenCalled();
  });

  it('rejects download when token scope is not download', async () => {
    const req: any = { fileAccess: { viaToken: true, scope: 'preview' } };
    files.getFileById.mockResolvedValueOnce({
      id: FILE_ID,
      fileName: 'proof.pdf',
      url: '/uploads/proof.pdf',
      mimeType: 'application/pdf',
    });

    await expect(controller.downloadFile(req, FILE_ID, { setHeader: vi.fn() } as any)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('serves download via valid token scope and object-storage fallback buffer', async () => {
    const req: any = { fileAccess: { viaToken: true, scope: 'download' } };
    const res: any = { setHeader: vi.fn() };
    files.getFileById.mockResolvedValueOnce({
      id: FILE_ID,
      fileName: 'proof.pdf',
      url: '/uploads/proof.pdf',
      mimeType: 'application/pdf',
    });
    files.isObjectStorageEnabled.mockReturnValueOnce(true);
    files.getFileBuffer.mockResolvedValueOnce(Buffer.from('pdf'));

    const result = await controller.downloadFile(req, FILE_ID, res);

    expect(result).toBeInstanceOf(StreamableFile);
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', 'inline; filename=\"proof.pdf\"');
  });

  it('serves preview via token scope and prefers watermarked output when available', async () => {
    const req: any = { fileAccess: { viaToken: true, scope: 'preview' } };
    const res: any = { setHeader: vi.fn() };
    files.getFileById.mockResolvedValueOnce({
      id: FILE_ID,
      fileName: 'proof.png',
      url: '/uploads/proof.png',
      mimeType: 'image/png',
    });
    files.getFileBuffer.mockResolvedValueOnce(Buffer.from('raw'));
    files.buildWatermarkedPreview.mockResolvedValueOnce({
      buffer: Buffer.from('watermarked'),
      mimeType: 'image/webp',
    });

    const result = await controller.previewFile(req, FILE_ID, res);

    expect(result).toBeInstanceOf(StreamableFile);
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'image/webp');
  });
});
