import path from 'node:path';

function normalizeRelativeUploadDir(raw: string): string {
  return String(raw || '')
    .trim()
    .replace(/^[./\\]+/, '')
    .replace(/\\/g, '/');
}

export function resolveUploadDir(): string {
  const configured = String(process.env.UPLOAD_DIR || '').trim();
  if (configured) {
    if (path.isAbsolute(configured)) return configured;
    const normalized = normalizeRelativeUploadDir(configured);
    return path.resolve(__dirname, '../../', normalized || 'uploads');
  }
  // Keep a stable default regardless of current working directory:
  // apps/api/src/common -> apps/api/uploads
  return path.resolve(__dirname, '../../uploads');
}
