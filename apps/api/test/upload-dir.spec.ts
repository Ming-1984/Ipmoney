import { afterEach, describe, expect, it } from 'vitest';

import { resolveUploadDir } from '../src/common/upload-dir';

const ORIGINAL_UPLOAD_DIR = process.env.UPLOAD_DIR;

describe('resolveUploadDir', () => {
  afterEach(() => {
    if (ORIGINAL_UPLOAD_DIR === undefined) {
      delete process.env.UPLOAD_DIR;
    } else {
      process.env.UPLOAD_DIR = ORIGINAL_UPLOAD_DIR;
    }
  });

  it('uses apps/api/uploads as default stable dir when env is missing', () => {
    delete process.env.UPLOAD_DIR;
    const dir = resolveUploadDir();
    expect(dir.replace(/\\/g, '/')).toContain('/apps/api/uploads');
  });

  it('keeps absolute UPLOAD_DIR value on current platform', () => {
    const isWin = process.platform === 'win32';
    process.env.UPLOAD_DIR = isWin ? 'C:\\tmp\\ipmoney-uploads' : '/tmp/ipmoney-uploads';
    const dir = resolveUploadDir();
    if (isWin) {
      expect(dir.toLowerCase()).toBe('c:\\tmp\\ipmoney-uploads');
    } else {
      expect(dir).toBe('/tmp/ipmoney-uploads');
    }
  });

  it('resolves relative UPLOAD_DIR from api package root instead of process cwd', () => {
    process.env.UPLOAD_DIR = './uploads';
    const dir = resolveUploadDir();
    expect(dir.replace(/\\/g, '/')).toContain('/apps/api/uploads');
  });
});
